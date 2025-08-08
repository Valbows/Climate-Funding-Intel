from __future__ import annotations

import re
from typing import Any, Dict

import pytest

from pipeline.telemetry import build_run_record, insert_run
from pipeline import supabase_client


def test_build_run_record_shapes_and_types():
    rec = build_run_record(
        model="gemini-2.0-flash",
        raw_count=5,
        sanitized_valid_count=3,
        sanitized_dropped_count=2,
        validated_count=2,
        validation_dropped_count=1,
        duration_ms=1234,
        status="ok",
    )
    # basic shape
    for key in [
        "ts",
        "model",
        "raw_count",
        "sanitized_valid_count",
        "sanitized_dropped_count",
        "validated_count",
        "validation_dropped_count",
        "duration_ms",
        "status",
        "error",
    ]:
        assert key in rec

    # type assertions
    assert isinstance(rec["model"], str)
    assert isinstance(rec["raw_count"], int)
    assert isinstance(rec["sanitized_valid_count"], int)
    assert isinstance(rec["sanitized_dropped_count"], int)
    assert isinstance(rec["validated_count"], int)
    assert isinstance(rec["validation_dropped_count"], int)
    assert isinstance(rec["duration_ms"], int)
    assert rec["status"] in {"ok", "error"}

    # ts looks like ISO 8601
    assert re.match(r"^\d{4}-\d{2}-\d{2}T", rec["ts"]) is not None


class _Resp:
    def __init__(self, data=None, error=None):
        self.data = data
        self.error = error


class _Table:
    def __init__(self, name: str):
        self.name = name
        self.inserted: Dict[str, Any] | None = None

    def insert(self, record: Dict[str, Any]):
        self.inserted = record
        return self

    def execute(self):
        return _Resp(data=[{"ok": True}], error=None)


class _Client:
    def __init__(self):
        self.table_name = None

    def table(self, name: str):
        self.table_name = name
        return _Table(name)


def test_insert_run_success(monkeypatch):
    rec = build_run_record(
        model="gemini-2.0-flash",
        raw_count=0,
        sanitized_valid_count=0,
        sanitized_dropped_count=0,
        validated_count=0,
        validation_dropped_count=0,
        duration_ms=0,
        status="ok",
    )

    def fake_get_client():
        return _Client()

    monkeypatch.setattr(supabase_client, "get_client", fake_get_client)
    out = insert_run(rec)
    assert out["error"] is None
    assert isinstance(out["data"], list)


def test_insert_run_failure_graceful(monkeypatch):
    rec = build_run_record(
        model="gemini-2.0-flash",
        raw_count=0,
        sanitized_valid_count=0,
        sanitized_dropped_count=0,
        validated_count=0,
        validation_dropped_count=0,
        duration_ms=0,
        status="ok",
    )

    def raise_get_client():
        raise RuntimeError("no client")

    monkeypatch.setattr(supabase_client, "get_client", raise_get_client)
    out = insert_run(rec)
    assert out["data"] is None
    assert "no client" in str(out["error"])  # graceful path
