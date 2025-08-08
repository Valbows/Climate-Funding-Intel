from datetime import date
import pytest

from pipeline.models import FundingEvent, ValidationError


def test_valid_event_to_db_dict_normalizes_fields():
    ev = FundingEvent(
        startup_name="  Gridlytics  ",
        geography="  USA ",
        funding_stage=" Series A ",
        amount_raised_usd="$5,000,000",
        lead_investor=" Acme Capital ",
        funding_date="2025-02-03",
        source_url="https://example.com/news/gridlytics-raises-5m",
        sub_sector=" Energy Storage ",
    )
    d = ev.to_db_dict()
    assert d["startup_name"] == "Gridlytics"
    assert d["geography"] == "USA"
    assert d["funding_stage"] == "Series A"
    assert d["amount_raised_usd"] == 5000000
    assert d["lead_investor"] == "Acme Capital"
    assert d["funding_date"] == "2025-02-03"
    assert d["source_url"].startswith("https://")
    assert d["sub_sector"] == "Energy Storage"


def test_missing_startup_name_raises():
    with pytest.raises(ValidationError):
        FundingEvent(
            startup_name="  ",
            source_url="https://example.com/x",
        )


def test_invalid_source_url_raises():
    with pytest.raises(ValidationError):
        FundingEvent(
            startup_name="Gridlytics",
            source_url="http://example.com/unsafe",
        )


def test_invalid_funding_date_raises():
    with pytest.raises(ValidationError):
        FundingEvent(
            startup_name="Gridlytics",
            source_url="https://example.com/x",
            funding_date="2025/01/02",
        )


def test_amount_parsing_digits_only():
    ev = FundingEvent(
        startup_name="Gridlytics",
        source_url="https://example.com/x",
        amount_raised_usd="$1,234,567",
    )
    assert ev.amount_raised_usd == 1234567
    ev2 = FundingEvent(
        startup_name="Gridlytics",
        source_url="https://example.com/x",
        amount_raised_usd="987654",
    )
    assert ev2.amount_raised_usd == 987654


def test_amount_none_when_no_digits():
    ev = FundingEvent(
        startup_name="Gridlytics",
        source_url="https://example.com/x",
        amount_raised_usd="N/A",
    )
    assert ev.amount_raised_usd is None


def test_accepts_native_date_and_keeps_iso_on_dump():
    ev = FundingEvent(
        startup_name="Gridlytics",
        source_url="https://example.com/x",
        funding_date=date(2025, 5, 6),
    )
    # internal is date
    assert isinstance(ev.funding_date, date)
    d = ev.to_db_dict()
    assert d["funding_date"] == "2025-05-06"
