from __future__ import annotations

import argparse
import os
import random
from datetime import datetime, timezone

from pipeline.telemetry import build_run_record, insert_run


def main() -> int:
    parser = argparse.ArgumentParser(description="Insert a synthetic telemetry record for verification")
    parser.add_argument("--model", default=os.getenv("MODEL", "gemini-2.0-flash"))
    parser.add_argument("--table", default=os.getenv("TELEMETRY_TABLE", "pipeline_runs"))
    parser.add_argument("--tag", default=None, help="Optional tag appended to model for dedupe-free search")
    args = parser.parse_args()

    model = args.model
    if args.tag:
        model = f"{model}-tag-{args.tag}"

    # generate a small random payload
    raw = random.randint(0, 3)
    sanitized_valid = max(0, raw - random.randint(0, 1))
    sanitized_dropped = raw - sanitized_valid
    validated = max(0, sanitized_valid - random.randint(0, 1))
    validation_dropped = sanitized_valid - validated
    duration_ms = random.randint(10, 100)

    record = build_run_record(
        model=model,
        raw_count=raw,
        sanitized_valid_count=sanitized_valid,
        sanitized_dropped_count=sanitized_dropped,
        validated_count=validated,
        validation_dropped_count=validation_dropped,
        duration_ms=duration_ms,
        status="ok",
    )

    # Ensure table from env if provided
    if args.table:
        os.environ["TELEMETRY_TABLE"] = args.table

    out = insert_run(record)
    error = out.get("error")
    if error:
        print(f"insert_error: {error}")
        return 2
    print("insert_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
