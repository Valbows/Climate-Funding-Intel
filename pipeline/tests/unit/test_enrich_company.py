from __future__ import annotations

import sys
import types
import importlib
import pytest


# Pre-seed lightweight stubs to avoid importing heavy/optional deps during unit tests
pkg_agents = types.ModuleType('pipeline.agents')
mod_enricher = types.ModuleType('pipeline.agents.enricher')
setattr(mod_enricher, 'create_enricher', lambda llm=None: None)
pkg_llm = types.ModuleType('pipeline.llm')
mod_gemini = types.ModuleType('pipeline.llm.gemini_client')
setattr(mod_gemini, 'build_llm', lambda: None)
mod_json_utils = types.ModuleType('pipeline.utils.json_utils')
setattr(mod_json_utils, 'extract_json', lambda s: {})
mod_supabase = types.ModuleType('pipeline.supabase_client')
setattr(mod_supabase, 'get_client', lambda: types.SimpleNamespace(
    table=lambda name: types.SimpleNamespace(
        upsert=lambda rec, on_conflict=None: types.SimpleNamespace(
            execute=lambda: types.SimpleNamespace(data=None, error=None)
        )
    )
))

sys.modules.setdefault('pipeline.agents', pkg_agents)
sys.modules.setdefault('pipeline.agents.enricher', mod_enricher)
sys.modules.setdefault('pipeline.llm', pkg_llm)
sys.modules.setdefault('pipeline.llm.gemini_client', mod_gemini)
sys.modules.setdefault('pipeline.utils.json_utils', mod_json_utils)
sys.modules.setdefault('pipeline.supabase_client', mod_supabase)

enrich_company = importlib.import_module('pipeline.enrich_company')
sanitize_bio = getattr(enrich_company, 'sanitize_bio')


def test_sanitize_bio_none():
    assert sanitize_bio(None) is None
    assert sanitize_bio("") is None  # empty becomes None


def test_sanitize_bio_strips_html_and_whitespace():
    html = "<p> Climate <strong>startup</strong><br>building grid software.</p>"
    out = sanitize_bio(html)
    # basic assertions
    assert out is not None
    # <br> becomes newline then whitespace collapsed; result contains a space
    assert "startup" in out
    assert "grid software" in out
    # no angle brackets remain
    assert "<" not in out and ">" not in out


def test_sanitize_bio_caps_length_with_ellipsis():
    long = "word " * 1000  # 5000+ chars
    out = sanitize_bio(long)
    assert out is not None
    assert len(out) <= 805  # 800 plus potential ellipsis and trim
    assert out.endswith("…")


def test_sanitize_bio_plain_text_passthrough():
    s = "We build climate-tech for grid reliability."
    out = sanitize_bio(s)
    assert out == s
