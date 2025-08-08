from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable


def extract_json(text: str) -> Dict[str, Any]:
    """Best-effort JSON extraction from LLM output or free text.

    Strategy (in order):
    1) direct json.loads on whole text
    2) iterate ALL fenced blocks (```json and ```), return first valid JSON
    3) locate a JSON object containing an "events" key via balanced-brace scan
    4) greedy braces from first '{' to last '}' as final fallback
    """
    text = (text or "").strip()

    def _normalize(obj: Any) -> Dict[str, Any]:
        # If the model returned a top-level list, treat it as events
        if isinstance(obj, list):
            return {"events": obj}
        if isinstance(obj, dict):
            return obj
        raise ValueError("Parsed JSON is neither object nor list")

    def _try_load(s: str) -> Dict[str, Any] | None:
        try:
            return _normalize(json.loads(s))
        except Exception:
            return None

    def _iter_fenced_blocks(pattern: str) -> Iterable[str]:
        for m in re.finditer(pattern, text, re.DOTALL | re.IGNORECASE):
            yield m.group(1).strip()

    # 1) direct
    direct = _try_load(text)
    if direct is not None:
        return direct

    # 2) fenced blocks (json first, then any)
    for block in _iter_fenced_blocks(r"```json\s*(.*?)```"):
        parsed = _try_load(block)
        if parsed is not None:
            return parsed
    for block in _iter_fenced_blocks(r"```\s*(.*?)```"):
        parsed = _try_load(block)
        if parsed is not None:
            return parsed

    # 3) Search for an object containing an "events" key using balanced braces
    for ev_match in re.finditer(r'"events"\s*:', text, re.IGNORECASE):
        # Find nearest preceding '{'
        start_idx = text.rfind('{', 0, ev_match.start())
        if start_idx == -1:
            continue
        depth = 0
        end_idx = -1
        for i in range(start_idx, len(text)):
            ch = text[i]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end_idx = i
                    break
        if end_idx != -1:
            candidate = text[start_idx : end_idx + 1]
            parsed = _try_load(candidate)
            if parsed is not None:
                return parsed

    # 4) greedy braces
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        parsed = _try_load(candidate)
        if parsed is not None:
            return parsed

    raise ValueError("Could not parse JSON from text")
