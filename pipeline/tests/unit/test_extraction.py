from __future__ import annotations

from pipeline.utils.json_utils import extract_json


def test_extract_events_shape():
    payload = {
        "events": [
            {
                "startup_name": "Gridlytics",
                "geography": "US",
                "funding_stage": "Seed",
                "amount_raised_usd": 5000000,
                "lead_investor": "Future Energy VC",
                "funding_date": "2025-06-01",
                "sub_sector": "Grid Optimization",
                "source_url": "https://example.com/article",
            }
        ]
    }
    out = extract_json(str(payload).replace("'", '"'))
    assert isinstance(out["events"], list)
    assert "source_url" in out["events"][0]
