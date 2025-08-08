from __future__ import annotations

"""
Pipeline main entrypoint.

- Constructs LLM (Gemini) via CrewAI `LLM`
- Builds agents and tasks
- Runs the crew sequentially
- Attempts to parse structured JSON and upsert into Supabase

Environment:
- See ../.env.example. For local dev, copy to pipeline/.env and fill values.
"""
import logging
import os
import time
import random
from typing import Any, Dict, List

from dotenv import load_dotenv

from pipeline.llm.gemini_client import build_llm
from pipeline.utils.json_utils import extract_json
from pipeline.utils.event_sanitizer import sanitize_events
from pipeline.agents.researcher import create_researcher
from pipeline.agents.verifier import create_verifier
from pipeline.tasks.research_task import create_research_task
from pipeline.tasks.verification_task import create_verification_task
from pipeline.supabase_client import upsert_funding_events
from pipeline.models import FundingEvent, ValidationError
from pipeline.telemetry import build_run_record, insert_run


def setup_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def _is_rate_limit_error(e: Exception) -> bool:
    msg = str(e).lower()
    # Best-effort detection without importing litellm directly
    indicators = [
        "429",
        "rate limit",
        "resouce_exhausted",  # common typo guard
        "resource_exhausted",
        "quota",
        "retryinfo",
        "too many requests",
        "invalid response from llm call",
        "none or empty",
        "httpx",
        "timeout",
        "temporarily unavailable",
        "service unavailable",
        "overloaded",
    ]
    return any(s in msg for s in indicators)


def _is_non_retryable_error(e: Exception) -> bool:
    msg = str(e).lower()
    non_retryable = [
        "invalid api key",
        "permission denied",
        "forbidden",
        "unauthorized",
        "auth",
        "model not found",
        "unsupported model",
        "invalid model",
        "bad request",
        "invalid argument",
        "malformed",
    ]
    return any(s in msg for s in non_retryable)


def _parse_model_fallbacks() -> List[str]:
    """Return ordered list of model ids to try: primary MODEL then fallbacks.

    Environment:
    - MODEL (primary, default: gemini-2.0-flash)
    - LLM_MODEL_FALLBACKS (comma-separated list, optional)
    """
    primary = os.getenv("MODEL", "gemini-2.0-flash")
    fallbacks = os.getenv("LLM_MODEL_FALLBACKS", "")

    def _unq(s: str) -> str:
        s2 = s.strip()
        if (s2.startswith('"') and s2.endswith('"')) or (s2.startswith("'") and s2.endswith("'")):
            return s2[1:-1].strip()
        return s2

    models: List[str] = []
    raw_list = [primary] + [p for p in fallbacks.split(",") if p.strip()]
    for raw in raw_list:
        m = _unq(raw)
        if m and m not in models:
            models.append(m)
    return models


def kickoff_with_retry(crew) -> str:
    """Run crew.kickoff() with simple exponential backoff on transient LLM errors.

    Controlled via env vars:
    - LLM_MAX_RETRIES (default 3)
    - LLM_RETRY_BASE_DELAY (seconds, default 30)
    """
    max_retries = int(os.getenv("LLM_MAX_RETRIES", "3"))
    base_delay = int(os.getenv("LLM_RETRY_BASE_DELAY", "30"))

    for attempt in range(max_retries + 1):
        try:
            return crew.kickoff()
        except Exception as e:  # noqa: BLE001
            logging.warning(
                "kickoff failed (attempt %d/%d): %s",
                attempt + 1,
                max_retries,
                e,
            )
            # Try to extract suggested retryDelay like '42s' if present
            delay = None
            msg = str(e)
            for token in ("retryDelay\": \"", "retrydelay\": \""):
                if token in msg:
                    try:
                        after = msg.split(token, 1)[1]
                        seconds_str = after.split("s\"", 1)[0]
                        delay = int(seconds_str)
                    except Exception:  # pragma: no cover - best effort only
                        delay = None
                    break

            non_retryable = _is_non_retryable_error(e)
            logging.debug("non_retryable=%s, attempt=%d, max_retries=%d", non_retryable, attempt, max_retries)
            # If clearly non-retryable or retries exhausted, re-raise
            if attempt >= max_retries or non_retryable:
                raise

            # Default to retry for transient/unknown errors
            base_wait = delay if delay is not None else base_delay * (2**attempt)
            jitter = random.uniform(0.5, 1.5)
            wait_s = int(base_wait * jitter)
            logging.warning(
                "Retrying LLM call due to transient error. Attempt %d/%d in %ss. Error: %s",
                attempt + 1,
                max_retries,
                wait_s,
                e,
            )
            time.sleep(wait_s)


def run_once_with_model(model_id: str) -> Dict[str, Any]:
    from crewai import Crew, Process  # type: ignore

    # Create agents & tasks
    llm = build_llm(model=model_id)
    researcher = create_researcher(llm=llm)
    research_task = create_research_task(agent=researcher)

    verifier = create_verifier(llm=llm)
    verification_task = create_verification_task(agent=verifier, research_task=research_task)

    # Log tool names for diagnostics
    try:
        r_tools = getattr(researcher, "tools", [])
        v_tools = getattr(verifier, "tools", [])
        r_tool_names = [getattr(t, "name", type(t).__name__) for t in r_tools]
        v_tool_names = [getattr(t, "name", type(t).__name__) for t in v_tools]
        logging.debug("Researcher tools: %s", r_tool_names)
        logging.debug("Verifier tools: %s", v_tool_names)
    except Exception as tool_log_err:  # pragma: no cover
        logging.debug("Failed to log agent tools: %s", tool_log_err)

    crew = Crew(
        agents=[researcher, verifier],
        tasks=[research_task, verification_task],
        process=Process.sequential,
    )
    t0 = time.time()

    result = kickoff_with_retry(crew)

    # CrewAI returns a result object; stringify for safety
    result_text = str(result)
    logging.info("Crew result received (%s chars)", len(result_text))
    logging.debug("Crew raw result preview:\n%s", result_text[:1000])
    try:
        out_path = os.path.join(os.path.dirname(__file__), "last_result.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(result_text)
        logging.debug("Wrote raw result to %s", out_path)
    except Exception as write_err:  # pragma: no cover
        logging.warning("Failed to persist raw result: %s", write_err)

    try:
        payload = extract_json(result_text)
        events: List[Dict[str, Any]] = payload.get("events", []) if isinstance(payload, dict) else []
    except Exception as e:
        logging.warning("Failed to parse JSON from result: %s", e)
        events = []

    raw_count = len(events)
    sanitized_valid, sanitized_dropped = sanitize_events(events)
    logging.info(
        "Sanitized events: %s valid, %s dropped (raw %s)",
        len(sanitized_valid),
        len(sanitized_dropped),
        raw_count,
    )

    # Pydantic validation stage: ensure strict schema prior to DB upsert
    validated_events: List[Dict[str, Any]] = []
    pydantic_dropped: List[Dict[str, Any]] = []
    for e in sanitized_valid:
        try:
            fe = FundingEvent(**e)
            validated_events.append(fe.to_db_dict())
        except ValidationError as ve:
            # Persist errors for offline debugging alongside sanitizer drops
            pydantic_dropped.append({**e, "__reason": "pydantic_validation_error", "__errors": ve.errors()})

    if pydantic_dropped:
        logging.info("Pydantic validation dropped %s additional event(s)", len(pydantic_dropped))

    # Combine drops and persist for inspection
    combined_dropped = sanitized_dropped + pydantic_dropped
    if combined_dropped:
        try:
            import json as _json
            drop_path = os.path.join(os.path.dirname(__file__), "dropped_events.json")
            with open(drop_path, "w", encoding="utf-8") as f:
                _json.dump(combined_dropped, f, ensure_ascii=False, indent=2)
            logging.debug("Wrote dropped events to %s", drop_path)
        except Exception as persist_err:  # pragma: no cover
            logging.debug("Failed to persist dropped events: %s", persist_err)

    if validated_events:
        upsert_resp = upsert_funding_events(validated_events)
        logging.info("Upsert response: %s", upsert_resp)
    else:
        logging.info("No valid events after validation; skipping Supabase upsert.")

    # Telemetry: record successful run
    try:
        duration_ms = int((time.time() - t0) * 1000)
        record = build_run_record(
            model=model_id,
            raw_count=raw_count,
            sanitized_valid_count=len(sanitized_valid),
            sanitized_dropped_count=len(sanitized_dropped),
            validated_count=len(validated_events),
            validation_dropped_count=len(pydantic_dropped),
            duration_ms=duration_ms,
            status="ok",
        )
        insert_run(record)
    except Exception as tel_err:  # pragma: no cover
        logging.debug("Telemetry record failed: %s", tel_err)

    return {"events_count": len(validated_events), "dropped_count": len(combined_dropped), "model": model_id}


def run() -> Dict[str, Any]:
    models = _parse_model_fallbacks()
    last_error: Exception | None = None
    for model_id in models:
        logging.info("Attempting pipeline with model: %s", model_id)
        attempt_t0 = time.time()
        try:
            return run_once_with_model(model_id)
        except Exception as e:  # noqa: BLE001
            last_error = e
            if _is_non_retryable_error(e):
                logging.error("Non-retryable error with model %s: %s", model_id, e)
                try:
                    duration_ms = int((time.time() - attempt_t0) * 1000)
                    record = build_run_record(
                        model=model_id,
                        raw_count=0,
                        sanitized_valid_count=0,
                        sanitized_dropped_count=0,
                        validated_count=0,
                        validation_dropped_count=0,
                        duration_ms=duration_ms,
                        status="error",
                        error=str(e),
                    )
                    insert_run(record)
                except Exception:  # pragma: no cover
                    pass
                raise
            if _is_rate_limit_error(e):
                logging.warning(
                    "Model %s hit rate limit/quota. Trying next model if available...", model_id
                )
                continue
            # Unknown error: propagate
            try:
                duration_ms = int((time.time() - attempt_t0) * 1000)
                record = build_run_record(
                    model=model_id,
                    raw_count=0,
                    sanitized_valid_count=0,
                    sanitized_dropped_count=0,
                    validated_count=0,
                    validation_dropped_count=0,
                    duration_ms=duration_ms,
                    status="error",
                    error=str(e),
                )
                insert_run(record)
            except Exception:  # pragma: no cover
                pass
            raise

    # If we exhausted all models
    assert last_error is not None
    err = RuntimeError(
        f"All configured LLM models failed due to rate limits or errors. Last error: {last_error}"
    )
    try:
        record = build_run_record(
            model=";".join(models),
            raw_count=0,
            sanitized_valid_count=0,
            sanitized_dropped_count=0,
            validated_count=0,
            validation_dropped_count=0,
            duration_ms=0,
            status="error",
            error=str(last_error),
        )
        insert_run(record)
    except Exception:  # pragma: no cover
        pass
    raise err


if __name__ == "__main__":
    # Load env from pipeline/.env if present
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(env_path, override=False)

    setup_logging()
    try:
        summary = run()
        logging.info("Run complete: %s", summary)
    except Exception as e:
        logging.exception("Pipeline run failed: %s", e)
        raise
