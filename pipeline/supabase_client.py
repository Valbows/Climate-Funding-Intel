"""
Supabase client and upsert helper for funding events.

Env vars required:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_TABLE (optional, default: funding_events)

Table schema is documented in plan.md Section 6.
"""
from __future__ import annotations

import os
import logging
from typing import List, Dict, Any

try:
    from supabase import create_client, Client  # type: ignore
except Exception:  # pragma: no cover - handled at runtime
    create_client = None  # type: ignore
    Client = object  # type: ignore

logger = logging.getLogger(__name__)


def _get_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise ValueError(f"Missing required environment variable: {name}")
    return _unquote(val)


def _unquote(s: str) -> str:
    s2 = s.strip()
    if (s2.startswith('"') and s2.endswith('"')) or (
        s2.startswith("'") and s2.endswith("'")
    ):
        return s2[1:-1].strip()
    return s2


def get_client() -> "Client":
    if create_client is None:
        raise RuntimeError(
            "supabase package not installed. Please install dependencies from pipeline/requirements.txt"
        )
    url = _get_env("SUPABASE_URL")
    key = _get_env("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def upsert_funding_events(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Upsert a list of funding event dicts into Supabase with dedupe on source_url."""
    if not events:
        logger.info("No events to upsert.")
        return {"data": [], "error": None}

    client = get_client()
    table = _unquote(os.getenv("SUPABASE_TABLE", "funding_events"))

    try:
        # Postgrest response typically has .data and .error
        resp = client.table(table).upsert(events, on_conflict="source_url").execute()
        data = getattr(resp, "data", None)
        error = getattr(resp, "error", None)
        logger.info("Upserted %s events into %s", len(events), table)
        if error:
            logger.error("Supabase upsert error: %s", error)
        return {"data": data, "error": error}
    except Exception as e:  # pragma: no cover
        logger.exception("Exception during Supabase upsert: %s", e)
        return {"data": None, "error": str(e)}
