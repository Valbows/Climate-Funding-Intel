from __future__ import annotations

from pipeline.supabase_client import upsert_funding_events


def test_upsert_no_events_returns_empty():
    resp = upsert_funding_events([])
    assert resp["data"] == []
    assert resp["error"] is None
