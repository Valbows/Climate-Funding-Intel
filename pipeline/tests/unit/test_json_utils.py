from __future__ import annotations

import pytest

from pipeline.utils.json_utils import extract_json


def test_extract_json_direct():
    src = '{"events": [{"startup_name": "A"}]}'
    out = extract_json(src)
    assert isinstance(out, dict)
    assert out.get("events")[0]["startup_name"] == "A"


def test_extract_json_fenced_block():
    src = """
    Here is the result:
    ```json
    {"events": [{"startup_name": "B"}]}
    ```
    """
    out = extract_json(src)
    assert out["events"][0]["startup_name"] == "B"


def test_extract_json_greedy_braces():
    src = "Noise before {\n  \"events\": [{\"startup_name\": \"C\"}]\n}\n and after"
    out = extract_json(src)
    assert out["events"][0]["startup_name"] == "C"


def test_extract_json_failure():
    with pytest.raises(ValueError):
        extract_json("not a json payload")
