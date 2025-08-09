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

# Simple heuristics to keep only climate-tech Energy/Grid related entries
# and drop obvious non-climate sectors (e.g., fintech, crypto, brokerage).
CLIMATE_POSITIVE = [
    "energy",
    "grid",
    "storage",
    "battery",
    "ev",
    "charging",
    "renewable",
    "solar",
    "wind",
    "geothermal",
    "transmission",
    "smart",
    "meter",
    "microgrid",
    "hydrogen",
    "carbon",
    "ccus",
    "cleantech",
    "climate",
    "heat pump",
    "hvac",
    "inverter",
    "photovoltaic",
    "biomass",
    "biofuel",
    "demand response",
]

CLIMATE_NEGATIVE = [
    "fintech",
    "trading",
    "brokerage",
    "crypto",
    "bitcoin",
    "wallet",
    "payment",
    "payments",
    "bank",
    "banking",
    "neobank",
]

# Known non-climate company names often returned by generic crawls
CLIMATE_NEGATIVE_NAMES = [
    "robinhood",
    "coinbase",
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


def _is_climate_relevant(e: Dict[str, Any]) -> bool:
    """Best-effort keyword-based filter for climate-tech relevance.

    Checks `sub_sector` first, then falls back to `startup_name` if needed.
    Any negative keyword present -> reject. Otherwise require at least one
    positive keyword.
    """
    sub = e.get("sub_sector")
    name = e.get("startup_name")
    sub_l = str(sub).lower().strip() if isinstance(sub, str) else ""
    name_l = str(name).lower().strip() if isinstance(name, str) else ""

    # Block obvious non-climate
    if any(neg in (sub_l + " " + name_l) for neg in CLIMATE_NEGATIVE):
        return False
    if any(bad in name_l for bad in CLIMATE_NEGATIVE_NAMES):
        return False

    # If sub_sector provided, require a positive signal in sub_sector
    if sub_l:
        return any(pos in sub_l for pos in CLIMATE_POSITIVE)

    # If no sub_sector info, be permissive (allow) unless explicitly negative
    return True


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

        # climate-tech relevance filter
        if not _is_climate_relevant(norm):
            dropped.append({**e, "__reason": "non_climate"})
            continue

        valid.append(norm)

    return valid, dropped
