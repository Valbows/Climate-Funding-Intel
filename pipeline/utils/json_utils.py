from __future__ import annotations

import json
import re
from typing import Any, Dict


def extract_json(text: str) -> Dict[str, Any]:
    """Best-effort JSON extraction from LLM output or free text.

    Tries:
    1) direct json.loads
    2) fenced block between triple backticks (```json or ```)
    3) greedy braces from first '{' to last '}'
    """
    text = (text or "").strip()

    def _normalize(obj: Any) -> Dict[str, Any]:
        # If the model returned a top-level list, treat it as events
        if isinstance(obj, list):
            return {"events": obj}
        if isinstance(obj, dict):
            return obj
        raise ValueError("Parsed JSON is neither object nor list")

    # 1) direct
    try:
        return _normalize(json.loads(text))
    except Exception:
        pass

    # 2) fenced
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fence_match:
        fenced = fence_match.group(1).strip()
        try:
            return _normalize(json.loads(fenced))
        except Exception:
            pass

    # 3) greedy braces
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        try:
            return _normalize(json.loads(candidate))
        except Exception:
            pass

    raise ValueError("Could not parse JSON from text")
