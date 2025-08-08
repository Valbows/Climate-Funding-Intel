from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from . import supabase_client

logger = logging.getLogger(__name__)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_run_record(
    *,
    model: str,
    raw_count: int,
    sanitized_valid_count: int,
    sanitized_dropped_count: int,
    validated_count: int,
    validation_dropped_count: int,
    duration_ms: int,
    status: str,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "ts": _iso_now(),
        "model": model,
        "raw_count": int(raw_count),
        "sanitized_valid_count": int(sanitized_valid_count),
        "sanitized_dropped_count": int(sanitized_dropped_count),
        "validated_count": int(validated_count),
        "validation_dropped_count": int(validation_dropped_count),
        "duration_ms": int(duration_ms),
        "status": status,
        "error": error,
    }


def insert_run(record: Dict[str, Any]) -> Dict[str, Any]:
    """Insert a pipeline run record into Supabase telemetry table.

    Safe to call without configured env; logs and returns error on failure.
    Table name from TELEMETRY_TABLE (default: pipeline_runs).
    """
    table = os.getenv("TELEMETRY_TABLE", "pipeline_runs").strip() or "pipeline_runs"
    try:
        client = supabase_client.get_client()
        resp = client.table(table).insert(record).execute()
        data = getattr(resp, "data", None)
        error = getattr(resp, "error", None)
        if error:
            logger.error("Telemetry insert error: %s", error)
        else:
            logger.info("Telemetry inserted into %s", table)
        return {"data": data, "error": error}
    except Exception as e:  # pragma: no cover
        logger.debug("Telemetry insert skipped/failure: %s", e)
        return {"data": None, "error": str(e)}
