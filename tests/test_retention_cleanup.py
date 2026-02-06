import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from services.queue.retention import cleanup_old_records  # noqa: E402


class _FakeAuditEventsRepo:
    def __init__(self):
        self.cutoff = None

    def delete_older_than(self, cutoff):
        self.cutoff = cutoff
        return 11


class _FakeOutboundJobsRepo:
    def __init__(self):
        self.cutoff = None

    def delete_terminal_older_than(self, cutoff):
        self.cutoff = cutoff
        return 7


class _FakeOutboundAttemptsRepo:
    def __init__(self):
        self.cutoff = None

    def delete_for_old_terminal_jobs(self, cutoff):
        self.cutoff = cutoff
        return 13


class RetentionCleanupTests(unittest.TestCase):
    def test_cleanup_calls_each_repository(self):
        now = datetime(2026, 2, 6, 12, 0, tzinfo=timezone.utc)
        audit_repo = _FakeAuditEventsRepo()
        jobs_repo = _FakeOutboundJobsRepo()
        attempts_repo = _FakeOutboundAttemptsRepo()

        summary = cleanup_old_records(
            retention_days=365,
            audit_events_repo=audit_repo,
            outbound_jobs_repo=jobs_repo,
            outbound_attempts_repo=attempts_repo,
            now_utc=now,
        )

        expected_cutoff = datetime(2025, 2, 6, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(audit_repo.cutoff, expected_cutoff)
        self.assertEqual(jobs_repo.cutoff, expected_cutoff)
        self.assertEqual(attempts_repo.cutoff, expected_cutoff)

        self.assertEqual(
            summary,
            {
                "deleted_attempts": 13,
                "deleted_jobs": 7,
                "deleted_audit_events": 11,
            },
        )


if __name__ == "__main__":
    unittest.main()
