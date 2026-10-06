from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import requests

from scripts import update_visitor_count as visitor


class VisitorCountParsingTests(unittest.TestCase):
    def test_parse_formatted_count(self) -> None:
        self.assertEqual(visitor.parse_count("1,234"), 1234)
        self.assertEqual(visitor.parse_count("1 234"), 1234)
        self.assertEqual(visitor.parse_count(0), 0)

    def test_parse_invalid_count_raises(self) -> None:
        with self.assertRaises(visitor.VisitorCountError):
            visitor.parse_count(None)


class VisitorCountFetchTests(unittest.TestCase):
    @patch("scripts.update_visitor_count.request_json")
    def test_public_counter_used_without_secret(self, request_json) -> None:
        request_json.return_value = {"count": "12,345"}
        count, source = visitor.fetch_visitor_count("")

        self.assertEqual(count, 12345)
        self.assertEqual(source, "goatcounter-public")
        self.assertEqual(request_json.call_args.args[0], visitor.PUBLIC_COUNTER_URL)

    @patch("scripts.update_visitor_count.request_json")
    def test_authenticated_failure_falls_back_to_public(self, request_json) -> None:
        request_json.side_effect = [
            requests.HTTPError("401 unauthorized"),
            {"count": "987"},
        ]

        count, source = visitor.fetch_visitor_count("configured-token")

        self.assertEqual(count, 987)
        self.assertEqual(source, "goatcounter-public")
        self.assertEqual(request_json.call_count, 2)


class VisitorSnapshotPolicyTests(unittest.TestCase):
    def test_fresh_unchanged_snapshot_does_not_commit(self) -> None:
        now = datetime(2026, 10, 6, tzinfo=timezone.utc)
        existing = {
            "count": 100,
            "updated_at_utc": (now - timedelta(days=10)).isoformat(),
            "source": "goatcounter-public",
        }
        self.assertFalse(visitor.snapshot_due(existing, 100, now, 30))

    def test_heartbeat_forces_periodic_repository_activity(self) -> None:
        now = datetime(2026, 10, 6, tzinfo=timezone.utc)
        existing = {
            "count": 100,
            "updated_at_utc": (now - timedelta(days=31)).isoformat(),
            "source": "goatcounter-public",
        }
        self.assertTrue(visitor.snapshot_due(existing, 100, now, 30))

    def test_changed_count_updates_immediately(self) -> None:
        now = datetime(2026, 10, 6, tzinfo=timezone.utc)
        existing = {
            "count": 100,
            "updated_at_utc": now.isoformat(),
            "source": "goatcounter-public",
        }
        self.assertTrue(visitor.snapshot_due(existing, 101, now, 30))


if __name__ == "__main__":
    unittest.main()
