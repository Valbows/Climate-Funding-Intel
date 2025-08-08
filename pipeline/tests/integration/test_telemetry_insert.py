from __future__ import annotations

import os
import uuid
import pytest

from pipeline.telemetry import build_run_record, insert_run


REQUIRED_ENVS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TELEMETRY_TABLE_SANDBOX",
]


@pytest.mark.skipif(
    any(not os.getenv(k) for k in REQUIRED_ENVS),
    reason="Sandbox Supabase envs not set; skipping telemetry integration test.",
)
def test_insert_run_into_sandbox_table(monkeypatch):
    sandbox_table = os.environ["TELEMETRY_TABLE_SANDBOX"].strip()
    assert sandbox_table, "TELEMETRY_TABLE_SANDBOX must be non-empty"

    # Force telemetry to use sandbox table
    monkeypatch.setenv("TELEMETRY_TABLE", sandbox_table)

    # Unique model marker for dedupe-free insert visibility
    model_tag = f"it-{uuid.uuid4()}"
    rec = build_run_record(
        model=model_tag,
        raw_count=1,
        sanitized_valid_count=1,
        sanitized_dropped_count=0,
        validated_count=1,
        validation_dropped_count=0,
        duration_ms=10,
        status="ok",
    )

    out = insert_run(rec)
    assert out.get("error") is None
