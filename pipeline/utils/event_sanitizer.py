from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Tuple

STR_FIELDS = [
    "startup_name",
    "geography",
    "funding_stage",
    "lead_investor",
    "sub_sector",
    "source_url",
]


def _to_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _parse_amount_usd(v: Any) -> int | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        try:
            return int(v)
        except Exception:
            return None
    s = str(v)
    # keep digits only
    digits = re.sub(r"[^0-9]", "", s)
    if not digits:
        return None
    try:
        return int(digits)
    except Exception:
        return None


def _normalize_date(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    # Accept YYYY-MM-DD; else None
    try:
        dt = datetime.strptime(s, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def sanitize_events(events: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Return (valid, dropped) after normalizing fields and enforcing required columns.

    Rules:
    - startup_name: required, non-empty
    - source_url: required, must start with http
    - amount_raised_usd: int or None (extract digits from strings)
    - funding_date: YYYY-MM-DD or None
    - Trim whitespace on string fields
    """
    valid: List[Dict[str, Any]] = []
    dropped: List[Dict[str, Any]] = []

    for e in events or []:
        norm: Dict[str, Any] = {}
        # strings
        for key in STR_FIELDS:
            norm[key] = _to_str(e.get(key))
        # amount
        norm["amount_raised_usd"] = _parse_amount_usd(e.get("amount_raised_usd"))
        # date
        norm["funding_date"] = _normalize_date(e.get("funding_date"))

        # required checks
        if not norm.get("startup_name"):
            dropped.append({**e, "__reason": "missing_startup_name"})
            continue
        src = norm.get("source_url")
        if not src or not str(src).lower().startswith("https"):
            dropped.append({**e, "__reason": "invalid_source_url"})
            continue

        valid.append(norm)

    return valid, dropped
