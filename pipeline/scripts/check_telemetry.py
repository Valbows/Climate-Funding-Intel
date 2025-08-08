from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone

from pipeline import supabase_client


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description="Check telemetry records in Supabase")
    parser.add_argument("--table", default=os.getenv("TELEMETRY_TABLE", "pipeline_runs"), help="Telemetry table name")
    parser.add_argument("--limit", type=int, default=5, help="Max rows to fetch")
    parser.add_argument("--since-mins", type=int, default=0, help="Only show rows since N minutes ago")
    args = parser.parse_args()

    table = args.table.strip() or "pipeline_runs"

    try:
        client = supabase_client.get_client()
    except Exception as e:  # pragma: no cover
        print(json.dumps({"ok": False, "error": f"client_error: {e}"}))
        return 1

    try:
        query = client.table(table).select("*")
        if args.since_mins > 0:
            since = _iso(datetime.now(timezone.utc) - timedelta(minutes=args.since_mins))
            # postgrest gte filter on ts
            query = query.gte("ts", since)
        # newest first
        query = query.order("ts", desc=True).limit(args.limit)
        resp = query.execute()
        data = getattr(resp, "data", []) or []
        error = getattr(resp, "error", None)
        print(json.dumps({
            "ok": error is None,
            "count": len(data),
            "table": table,
            "rows": data,
            "error": error,
        }, ensure_ascii=False))
        return 0 if error is None else 2
    except Exception as e:  # pragma: no cover
        print(json.dumps({"ok": False, "error": f"query_error: {e}"}))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
