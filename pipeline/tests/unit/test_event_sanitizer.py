from __future__ import annotations

from pipeline.utils.event_sanitizer import sanitize_events


def test_sanitize_events_valid_and_dropped():
    events = [
        {
            "startup_name": " Aetherflux ",
            "source_url": "https://example.com/article",
            "amount_raised_usd": "$50,000,000",
            "funding_date": "2025-04-02",
            "geography": "  US  ",
            "funding_stage": None,
            "lead_investor": None,
            "sub_sector": None,
        },
        {  # drop: missing startup_name
            "startup_name": "",
            "source_url": "https://example.com/a",
        },
        {  # drop: non-https URL
            "startup_name": "Foo",
            "source_url": "http://example.com/a",
        },
        {  # drop: missing url
            "startup_name": "Bar",
            "source_url": None,
        },
        {
            "startup_name": "Baz",
            "source_url": "https://example.com/b",
            "amount_raised_usd": "5,000,000",
            "funding_date": "2025-13-40",  # invalid -> None
            "geography": None,
            "funding_stage": "Seed",
            "lead_investor": "Alpha",
            "sub_sector": "Energy Storage",
        },
    ]

    valid, dropped = sanitize_events(events)

    # We expect 2 valid entries (Aetherflux, Baz) and 3 dropped
    assert len(valid) == 2
    assert len(dropped) == 3

    # Validate normalization of the first valid event
    v0 = valid[0]
    assert v0["startup_name"] == "Aetherflux"
    assert v0["source_url"] == "https://example.com/article"
    assert v0["amount_raised_usd"] == 50000000
    assert v0["funding_date"] == "2025-04-02"
    assert v0["geography"] == "US"

    # Validate normalization of the second valid event
    v1 = valid[1]
    assert v1["startup_name"] == "Baz"
    assert v1["source_url"] == "https://example.com/b"
    assert v1["amount_raised_usd"] == 5000000
    assert v1["funding_date"] is None
    assert v1["geography"] is None

    # Dropped reasons included
    reasons = {d.get("__reason") for d in dropped}
    assert {"missing_startup_name", "invalid_source_url"}.issubset(reasons)
