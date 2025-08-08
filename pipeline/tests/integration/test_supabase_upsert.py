from __future__ import annotations

import os
import uuid
import pytest

from pipeline.supabase_client import upsert_funding_events
from pipeline.models import FundingEvent

REQUIRED_ENVS = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_TABLE_SANDBOX")


def _missing_envs():
    return [k for k in REQUIRED_ENVS if not os.getenv(k)]


@pytest.mark.skipif(_missing_envs(), reason="Supabase sandbox env vars not set; skipping integration test")
def test_supabase_upsert_sandbox(monkeypatch):
    sandbox_table = os.getenv("SUPABASE_TABLE_SANDBOX")
    monkeypatch.setenv("SUPABASE_TABLE", sandbox_table)

    unique_src = f"https://example.com/test?u={uuid.uuid4().hex}"
    event = dict(
        startup_name="Integration Test Co",
        geography="TestLand",
        funding_stage="Seed",
        amount_raised_usd="1,234",
        lead_investor="Test Capital",
        funding_date="2024-01-02",
        source_url=unique_src,
        sub_sector="Testing",
    )

    fe = FundingEvent(**event)
    resp = upsert_funding_events([fe.to_db_dict()])
    assert resp["error"] is None
    assert isinstance(resp["data"], list)
