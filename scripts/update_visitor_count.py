#!/usr/bin/env python3
"""Update the public visitor-count snapshot from the authenticated GoatCounter API.

The API key is read exclusively from GOATCOUNTER_API_KEY. It is never written to
the repository or exposed to the browser.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests

SITE_CODE = "nba-analytics-tap"
API_URL = f"https://{SITE_CODE}.goatcounter.com/api/v0/stats/total"
OUTPUT = Path("data/visitor_count.json")


def main() -> int:
    token = os.getenv("GOATCOUNTER_API_KEY", "").strip()
    if not token:
        print("GOATCOUNTER_API_KEY is not configured; visitor snapshot not updated.")
        return 0

    response = requests.get(
        API_URL,
        params={"start": "1970-01-01T00:00:00Z"},
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "nba-analytics-github-actions/1.0",
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()

    if "total" not in payload:
        raise RuntimeError(f"Unexpected GoatCounter response: keys={sorted(payload.keys())}")

    count = int(payload["total"])
    snapshot = {
        "count": count,
        "updated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "goatcounter-api",
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Visitor snapshot updated: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
