#!/usr/bin/env python3
"""Synchronize the public visitor-count snapshot from GoatCounter.

The authenticated API is preferred when GOATCOUNTER_API_KEY is configured.
When it is not configured (or the authenticated request fails), the script
falls back to GoatCounter's official public TOTAL JSON counter.

The snapshot is committed only when the count changes or when a maintenance
heartbeat is due, which keeps scheduled GitHub Actions alive without creating
hourly no-op commits.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

SITE_CODE = os.getenv("GOATCOUNTER_SITE_CODE", "nba-analytics-tap").strip()
AUTH_API_URL = f"https://{SITE_CODE}.goatcounter.com/api/v0/stats/total"
PUBLIC_COUNTER_URL = f"https://{SITE_CODE}.goatcounter.com/counter/TOTAL.json"
OUTPUT = Path("data/visitor_count.json")
REQUEST_TIMEOUT_SECONDS = 30
DEFAULT_HEARTBEAT_DAYS = 30


class VisitorCountError(RuntimeError):
    """Raised when a visitor count cannot be retrieved or parsed safely."""


def parse_count(value: Any) -> int:
    """Parse GoatCounter integer or formatted JSON count into a non-negative int."""
    if isinstance(value, bool) or value is None:
        raise VisitorCountError(f"Invalid visitor count: {value!r}")

    if isinstance(value, int):
        if value < 0:
            raise VisitorCountError(f"Visitor count cannot be negative: {value}")
        return value

    text = str(value).strip()
    digits = re.sub(r"\D", "", text)
    if not digits:
        raise VisitorCountError(f"Visitor count has no digits: {value!r}")
    return int(digits)


def request_json(url: str, **kwargs: Any) -> dict[str, Any]:
    response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS, **kwargs)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise VisitorCountError(f"Unexpected JSON payload type: {type(payload).__name__}")
    return payload


def fetch_visitor_count(token: str) -> tuple[int, str]:
    """Return (count, source), preferring authenticated API when available."""
    if token:
        try:
            payload = request_json(
                AUTH_API_URL,
                params={"start": "1970-01-01T00:00:00Z"},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "nba-analytics-github-actions/2.0",
                },
            )
            if "total" not in payload:
                raise VisitorCountError(
                    f"Authenticated GoatCounter response is missing 'total': "
                    f"keys={sorted(payload.keys())}"
                )
            return parse_count(payload["total"]), "goatcounter-api"
        except Exception as exc:
            print(
                "Authenticated GoatCounter request failed; "
                f"falling back to public TOTAL counter: {exc}"
            )

    try:
        payload = request_json(
            PUBLIC_COUNTER_URL,
            headers={
                "Accept": "application/json",
                "User-Agent": "nba-analytics-github-actions/2.0",
            },
        )
        if "count" not in payload:
            raise VisitorCountError(
                f"Public GoatCounter response is missing 'count': "
                f"keys={sorted(payload.keys())}"
            )
        return parse_count(payload["count"]), "goatcounter-public"
    except Exception as exc:
        raise VisitorCountError(
            "Unable to retrieve visitor count from both authenticated/public paths."
        ) from exc


def load_snapshot(path: Path = OUTPUT) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def parse_timestamp(raw: Any) -> datetime | None:
    if not raw:
        return None
    try:
        value = str(raw).replace("Z", "+00:00")
        stamp = datetime.fromisoformat(value)
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp.astimezone(timezone.utc)


def snapshot_due(
    existing: dict[str, Any],
    count: int,
    now: datetime,
    heartbeat_days: int,
) -> bool:
    try:
        previous_count = parse_count(existing.get("count"))
    except VisitorCountError:
        return True

    if previous_count != count:
        return True

    updated_at = parse_timestamp(existing.get("updated_at_utc"))
    if updated_at is None:
        return True

    return now - updated_at >= timedelta(days=heartbeat_days)


def write_snapshot(path: Path, count: int, source: str, now: datetime) -> None:
    snapshot = {
        "count": count,
        "updated_at_utc": now.isoformat(),
        "source": source,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temp_path.replace(path)


def main() -> int:
    heartbeat_days = int(
        os.getenv("VISITOR_SNAPSHOT_HEARTBEAT_DAYS", str(DEFAULT_HEARTBEAT_DAYS))
    )
    if not 1 <= heartbeat_days <= 45:
        raise VisitorCountError(
            "VISITOR_SNAPSHOT_HEARTBEAT_DAYS must be between 1 and 45."
        )

    token = os.getenv("GOATCOUNTER_API_KEY", "").strip()
    count, source = fetch_visitor_count(token)
    now = datetime.now(timezone.utc)
    existing = load_snapshot()

    if not snapshot_due(existing, count, now, heartbeat_days):
        print(
            f"Visitor count unchanged ({count}); snapshot is fresh enough. "
            f"source={source}"
        )
        return 0

    write_snapshot(OUTPUT, count, source, now)
    print(
        f"Visitor snapshot updated: count={count}; source={source}; "
        f"heartbeat_days={heartbeat_days}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
