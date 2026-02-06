import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from services.queue.claiming import select_claimable_jobs  # noqa: E402


class QueueClaimingTests(unittest.TestCase):
    def test_per_ordering_key_claim_is_serialized(self):
        now = datetime.now(timezone.utc)

        jobs = [
            {
                "job_id": 1,
                "ordering_key": "person-1",
                "status": "queued",
                "next_attempt_at": now - timedelta(seconds=1),
                "locked_until": None,
                "created_at": now - timedelta(minutes=2),
            },
            {
                "job_id": 2,
                "ordering_key": "person-1",
                "status": "queued",
                "next_attempt_at": now - timedelta(seconds=1),
                "locked_until": None,
                "created_at": now - timedelta(minutes=1),
            },
        ]

        claimable = select_claimable_jobs(jobs, now_utc=now, limit=10)

        self.assertEqual([item["job_id"] for item in claimable], [1])

    def test_jobs_with_different_ordering_keys_can_be_claimed_together(self):
        now = datetime.now(timezone.utc)

        jobs = [
            {
                "job_id": 1,
                "ordering_key": "person-1",
                "status": "queued",
                "next_attempt_at": now - timedelta(seconds=1),
                "locked_until": None,
                "created_at": now - timedelta(minutes=2),
            },
            {
                "job_id": 2,
                "ordering_key": "person-2",
                "status": "queued",
                "next_attempt_at": now - timedelta(seconds=1),
                "locked_until": None,
                "created_at": now - timedelta(minutes=1),
            },
        ]

        claimable = select_claimable_jobs(jobs, now_utc=now, limit=10)

        self.assertEqual([item["job_id"] for item in claimable], [1, 2])

    def test_processing_job_with_expired_lease_is_reclaimable(self):
        now = datetime.now(timezone.utc)

        jobs = [
            {
                "job_id": 10,
                "ordering_key": "person-3",
                "status": "processing",
                "next_attempt_at": now - timedelta(minutes=5),
                "locked_until": now - timedelta(seconds=1),
                "created_at": now - timedelta(minutes=5),
            }
        ]

        claimable = select_claimable_jobs(jobs, now_utc=now, limit=10)

        self.assertEqual([item["job_id"] for item in claimable], [10])


if __name__ == "__main__":
    unittest.main()
