import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from services.queue.errors import RetryableJobError  # noqa: E402
from services.queue.worker import OutboundJobWorker, WorkerSettings  # noqa: E402


class _FakeJobsRepo:
    def __init__(self, job):
        self.job = job

    def claim_jobs(self, worker_id, limit, lock_seconds, now_utc):
        is_due = self.job["next_attempt_at"] <= now_utc
        if self.job["status"] == "queued" and is_due:
            self.job["status"] = "processing"
            self.job["locked_by"] = worker_id
            self.job["locked_until"] = now_utc + timedelta(seconds=lock_seconds)
            return [self.job]
        return []

    def increment_attempt_count(self, job_id):
        self.job["attempt_count"] += 1
        return self.job["attempt_count"]

    def mark_succeeded(self, job_id):
        self.job["status"] = "succeeded"

    def schedule_retry(self, job_id, next_attempt_at, error_code, error_message_redacted):
        self.job["status"] = "queued"
        self.job["next_attempt_at"] = next_attempt_at

    def mark_dead_letter(self, job_id, error_code, error_message_redacted):
        self.job["status"] = "dead_letter"

    def delete_terminal_older_than(self, cutoff):
        return 0


class _FakeAttemptsRepo:
    def __init__(self):
        self.finished = []
        self._counter = 0

    def start_attempt(self, job_id, attempt_no):
        self._counter += 1
        return self._counter

    def finish_attempt(self, attempt_id, outcome, error_code=None, error_message_redacted=None):
        self.finished.append(
            {
                "attemptId": attempt_id,
                "outcome": outcome,
                "errorCode": error_code,
            }
        )

    def delete_for_old_terminal_jobs(self, cutoff):
        return 0


class _FakeOperationRepo:
    def __init__(self):
        self.statuses = []

    def update_status(self, request_id, status, result_json=None, error_json=None, completed=False):
        self.statuses.append(
            {
                "request_id": request_id,
                "status": status,
                "result_json": result_json,
                "error_json": error_json,
            }
        )


class _FakeAuditRepo:
    def __init__(self):
        self.events = []

    def append_event(self, **kwargs):
        self.events.append(kwargs)
        return len(self.events)

    def delete_older_than(self, cutoff):
        return 0


class QueueWorkerOutcomeTests(unittest.TestCase):
    def _build_worker(self, job, handler):
        settings = WorkerSettings(
            worker_id="worker-test",
            poll_interval_ms=1000,
            max_claim_batch=10,
            lock_seconds=60,
            retention_days=365,
        )

        worker = OutboundJobWorker(
            settings=settings,
            handlers={"subscription_create": handler},
            jobs_repo=_FakeJobsRepo(job),
            attempts_repo=_FakeAttemptsRepo(),
            operation_requests_repo=_FakeOperationRepo(),
            audit_events_repo=_FakeAuditRepo(),
        )
        return worker

    def test_retry_then_success_path(self):
        now = datetime.now(timezone.utc)
        job = {
            "job_id": 1,
            "request_id": "req-1",
            "job_type": "subscription_create",
            "payload_json": {"correlationId": "corr-1", "subscriptionPayload": {"userId": 1}},
            "status": "queued",
            "attempt_count": 0,
            "max_attempts": 8,
            "next_attempt_at": now - timedelta(seconds=1),
        }

        call_counter = {"count": 0}

        def handler(_job):
            call_counter["count"] += 1
            if call_counter["count"] == 1:
                raise RetryableJobError("temporary issue")
            return {"subscriptionId": "sub-1"}

        worker = self._build_worker(job, handler)

        first_claimed = worker.run_once()
        self.assertEqual(first_claimed, 1)
        self.assertEqual(job["status"], "queued")

        job["next_attempt_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        second_claimed = worker.run_once()

        self.assertEqual(second_claimed, 1)
        self.assertEqual(job["status"], "succeeded")

        latest_status = worker.operation_requests_repo.statuses[-1]
        self.assertEqual(latest_status["status"], "succeeded")

    def test_retry_exhausted_moves_to_dead_letter(self):
        now = datetime.now(timezone.utc)
        job = {
            "job_id": 99,
            "request_id": "req-99",
            "job_type": "subscription_create",
            "payload_json": {"correlationId": "corr-99", "subscriptionPayload": {"userId": 99}},
            "status": "queued",
            "attempt_count": 0,
            "max_attempts": 1,
            "next_attempt_at": now - timedelta(seconds=1),
        }

        def handler(_job):
            raise RetryableJobError("still failing")

        worker = self._build_worker(job, handler)
        claimed = worker.run_once()

        self.assertEqual(claimed, 1)
        self.assertEqual(job["status"], "dead_letter")

        latest_status = worker.operation_requests_repo.statuses[-1]
        self.assertEqual(latest_status["status"], "failed")


if __name__ == "__main__":
    unittest.main()
