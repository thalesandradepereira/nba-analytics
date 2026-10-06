from __future__ import annotations

import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from scripts import update_visitor_count as visitor


class VisitorCountParsingTests(unittest.TestCase):
    def test_parse_formatted_count(self) -> None:
        self.assertEqual(visitor.parse_count("1,234"), 1234)
        self.assertEqual(visitor.parse_count("1.234"), 1234)
        self.assertEqual(visitor.parse_count("1\u202f234"), 1234)
        self.assertEqual(visitor.parse_count(0), 0)

    def test_parse_invalid_count_raises(self) -> None:
        for value in (None, True, -1, "-1", "12.5", "abc", 12.5):
            with self.subTest(value=value):
                with self.assertRaises(visitor.VisitorCountError):
                    visitor.parse_count(value)


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
            visitor.VisitorCountError("401 unauthorized"),
            {"count": "987"},
        ]

        count, source = visitor.fetch_visitor_count("configured-token")

        self.assertEqual(count, 987)
        self.assertEqual(source, "goatcounter-public")
        self.assertEqual(request_json.call_count, 2)

    @patch("scripts.update_visitor_count.request_json")
    def test_public_failure_is_visible(self, request_json) -> None:
        request_json.side_effect = visitor.VisitorCountError("service unavailable")

        with self.assertRaises(visitor.VisitorCountError):
            visitor.fetch_visitor_count("")


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

    def test_future_timestamp_is_repaired(self) -> None:
        now = datetime(2026, 10, 6, tzinfo=timezone.utc)
        existing = {
            "count": 100,
            "updated_at_utc": (now + timedelta(days=1)).isoformat(),
            "source": "goatcounter-public",
        }
        self.assertTrue(visitor.snapshot_due(existing, 100, now, 30))


class VisitorConfigurationTests(unittest.TestCase):
    def test_invalid_heartbeat_value_is_explicit(self) -> None:
        with patch.dict(os.environ, {"VISITOR_SNAPSHOT_HEARTBEAT_DAYS": "invalid"}):
            with self.assertRaises(visitor.VisitorCountError):
                visitor.heartbeat_days_from_env()

    def test_heartbeat_range_is_bounded(self) -> None:
        with patch.dict(os.environ, {"VISITOR_SNAPSHOT_HEARTBEAT_DAYS": "46"}):
            with self.assertRaises(visitor.VisitorCountError):
                visitor.heartbeat_days_from_env()


if __name__ == "__main__":
    unittest.main()
