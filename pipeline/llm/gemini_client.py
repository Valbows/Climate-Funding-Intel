"""
Gemini LLM configuration for CrewAI.

Requires environment:
- GEMINI_API_KEY: Google AI Studio API key
- MODEL (optional, default: gemini-2.0-flash)
- LLM_TEMPERATURE (optional, default: 0.2)
- LLM_TIMEOUT (optional, seconds, default: 120)
- LLM_MAX_TOKENS (optional, default: 4000)
- LLM_SEED (optional, default: 42)

Docs:
- CrewAI LLMs: https://docs.crewai.com/en/concepts/llms
- Gemini API keys: https://aistudio.google.com/apikey
"""
from __future__ import annotations

import os
from typing import Optional

try:
    from crewai import LLM  # type: ignore
except Exception:  # pragma: no cover - allows import without crewai for tests
    LLM = None  # type: ignore


def _provider_model(model_id: str) -> str:
    """Ensure provider prefix for CrewAI's LLM, e.g., gemini/<model>.

    CrewAI supports plain model ids via env MODEL, but API examples
    recommend provider-prefixed ids when constructing LLM directly.
    """
    model_id = (model_id or "gemini-2.0-flash").strip()
    # Strip surrounding single/double quotes if present (Docker --env-file keeps quotes)
    if (model_id.startswith('"') and model_id.endswith('"')) or (
        model_id.startswith("'") and model_id.endswith("'")
    ):
        model_id = model_id[1:-1].strip()
    if "/" in model_id:
        return model_id
    # Default to Gemini provider
    return f"gemini/{model_id}"


def build_llm(
    model: Optional[str] = None,
    *,
    temperature: Optional[float] = None,
    timeout: Optional[int] = None,
    max_tokens: Optional[int] = None,
    seed: Optional[int] = None,
) -> LLM:
    """Construct a CrewAI LLM configured for Gemini.

    Values fall back to environment variables where provided.
    """
    env_model = os.getenv("MODEL", "gemini-2.0-flash")
    env_temperature = os.getenv("LLM_TEMPERATURE", "0.2")
    env_timeout = os.getenv("LLM_TIMEOUT", "120")
    env_max_tokens = os.getenv("LLM_MAX_TOKENS", "4000")
    env_seed = os.getenv("LLM_SEED", "42")

    # Normalize potential quoted values (e.g., "0.2") from Docker env-file
    def _unquote(s: Optional[str]) -> Optional[str]:
        if s is None:
            return None
        s2 = s.strip()
        if (s2.startswith('"') and s2.endswith('"')) or (s2.startswith("'") and s2.endswith("'")):
            return s2[1:-1].strip()
        return s2

    env_temperature = _unquote(env_temperature)
    env_timeout = _unquote(env_timeout)
    env_max_tokens = _unquote(env_max_tokens)
    env_seed = _unquote(env_seed)

    model_final = _provider_model(model or env_model)

    # Convert types with safe fallbacks
    def _to_float(v: Optional[str], default: float) -> float:
        try:
            return float(v) if v is not None else default
        except ValueError:
            return default

    def _to_int(v: Optional[str], default: int) -> int:
        try:
            return int(v) if v is not None else default
        except ValueError:
            return default

    temperature_final = temperature if temperature is not None else _to_float(env_temperature, 0.2)
    timeout_final = timeout if timeout is not None else _to_int(env_timeout, 120)
    max_tokens_final = max_tokens if max_tokens is not None else _to_int(env_max_tokens, 4000)
    seed_final = seed if seed is not None else _to_int(env_seed, 42)

    if LLM is None:  # pragma: no cover - real runs require crewai installed
        raise RuntimeError(
            "crewai is not installed. Please install dependencies from pipeline/requirements.txt"
        )

    return LLM(  # type: ignore[misc]
        model=model_final,
        temperature=temperature_final,
        timeout=timeout_final,
        max_tokens=max_tokens_final,
        seed=seed_final,
    )

