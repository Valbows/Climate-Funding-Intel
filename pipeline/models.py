from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ValidationError, field_validator


class FundingEvent(BaseModel):
    """Pydantic model for a funding event.

    Normalizes and validates inputs to match DB expectations and existing sanitizer rules:
    - startup_name: required, non-empty after trim
    - source_url: required, must start with https
    - amount_raised_usd: optional, parsed to int from strings with symbols (digits only)
    - funding_date: optional, must be YYYY-MM-DD if provided (stored as date)
    - other string fields: trimmed; empty -> None
    """

    startup_name: str = Field(...)
    geography: Optional[str] = None
    funding_stage: Optional[str] = None
    amount_raised_usd: Optional[int] = None
    lead_investor: Optional[str] = None
    funding_date: Optional[date] = None
    source_url: str = Field(...)
    sub_sector: Optional[str] = None

    @staticmethod
    def _strip_or_none(v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    @field_validator("startup_name", mode="before")
    @classmethod
    def _validate_startup_name(cls, v):
        s = cls._strip_or_none(v)
        if not s:
            raise ValueError("startup_name is required")
        return s

    @field_validator("source_url", mode="before")
    @classmethod
    def _validate_source_url(cls, v):
        s = cls._strip_or_none(v)
        if not s or not s.lower().startswith("https"):
            raise ValueError("source_url must be https URL")
        return s

    @field_validator("geography", "funding_stage", "lead_investor", "sub_sector", mode="before")
    @classmethod
    def _normalize_optional_strs(cls, v):
        return cls._strip_or_none(v)

    @field_validator("amount_raised_usd", mode="before")
    @classmethod
    def _normalize_amount(cls, v):
        if v is None:
            return None
        if isinstance(v, (int,)):
            return v
        # extract digits
        digits = "".join(ch for ch in str(v) if ch.isdigit())
        return int(digits) if digits else None

    @field_validator("funding_date", mode="before")
    @classmethod
    def _normalize_date(cls, v):
        if v in (None, "", "null", "None"):
            return None
        if isinstance(v, date):
            return v
        s = str(v).strip()
        try:
            dt = datetime.strptime(s, "%Y-%m-%d").date()
            return dt
        except Exception as e:
            raise ValueError("funding_date must be YYYY-MM-DD") from e

    def to_db_dict(self) -> dict:
        """Return a dict ready for DB upsert (funding_date as YYYY-MM-DD string or None)."""
        d = self.model_dump()
        if d.get("funding_date"):
            d["funding_date"] = self.funding_date.strftime("%Y-%m-%d")  # type: ignore[arg-type]
        return d


__all__ = ["FundingEvent", "ValidationError"]
