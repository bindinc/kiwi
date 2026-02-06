import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from services.hup.webabo.subscription_gateway import (  # noqa: E402
    RetryableUpstreamError,
    ValidationUpstreamError,
)
from services.orchestration.subscription_orchestrator import SubscriptionOrchestrator  # noqa: E402


class _FakeOperationRepo:
    def __init__(self):
        self.rows = {}

    def create_request(self, request_id, operation_type, payload_hash, status, correlation_id=None):
        self.rows[request_id] = {
            "request_id": request_id,
            "operation_type": operation_type,
            "payload_hash": payload_hash,
            "status": status,
            "correlation_id": correlation_id,
            "result_json": None,
            "error_json": None,
        }

    def get_by_request_id(self, request_id):
        return self.rows.get(request_id)

    def update_status(self, request_id, status, result_json=None, error_json=None, completed=False):
        row = self.rows[request_id]
        row["status"] = status
        row["result_json"] = result_json
        row["error_json"] = error_json
        row["completed"] = completed


class _FakeJobsRepo:
    def __init__(self):
        self.jobs = []

    def enqueue_job(self, request_id, job_type, ordering_key, payload_json, max_attempts):
        job_id = len(self.jobs) + 1
        self.jobs.append(
            {
                "job_id": job_id,
                "request_id": request_id,
                "job_type": job_type,
                "ordering_key": ordering_key,
                "payload_json": payload_json,
                "max_attempts": max_attempts,
            }
        )
        return job_id


class _FakeAuditRepo:
    def __init__(self):
        self.events = []

    def append_event(self, **kwargs):
        self.events.append(kwargs)
        return len(self.events)


class _SuccessGateway:
    def create_subscription(self, payload, *, timeout_ms):
        return {"subscriptionId": "sub-123", "echo": payload, "timeout": timeout_ms}


class _RetryableGateway:
    def create_subscription(self, payload, *, timeout_ms):
        raise RetryableUpstreamError("temporary upstream outage")


class _ValidationGateway:
    def create_subscription(self, payload, *, timeout_ms):
        raise ValidationUpstreamError(
            message="invalid payload",
            status_code=400,
            details={"field": "userId"},
        )


class SubscriptionOrchestratorTests(unittest.TestCase):
    def test_idempotency_conflict_returns_409(self):
        operation_repo = _FakeOperationRepo()
        jobs_repo = _FakeJobsRepo()
        audit_repo = _FakeAuditRepo()

        orchestrator = SubscriptionOrchestrator(
            operation_repo=operation_repo,
            jobs_repo=jobs_repo,
            audit_repo=audit_repo,
            gateway=_SuccessGateway(),
        )

        operation_repo.rows["req-1"] = {
            "request_id": "req-1",
            "payload_hash": "other-hash",
            "status": "pending",
            "result_json": None,
            "error_json": None,
        }

        response = orchestrator.submit(
            request_id="req-1",
            payload={"userId": 1, "variantCode": "A"},
            actor_id="agent@example.org",
            correlation_id="corr-1",
        )

        self.assertEqual(response.http_status, 409)
        self.assertEqual(response.payload["status"], "conflict")

    def test_sync_success_returns_201(self):
        operation_repo = _FakeOperationRepo()
        jobs_repo = _FakeJobsRepo()
        audit_repo = _FakeAuditRepo()

        orchestrator = SubscriptionOrchestrator(
            operation_repo=operation_repo,
            jobs_repo=jobs_repo,
            audit_repo=audit_repo,
            gateway=_SuccessGateway(),
        )

        response = orchestrator.submit(
            request_id="req-success",
            payload={"userId": 12, "variantCode": "A"},
            actor_id="agent@example.org",
            correlation_id="corr-success",
        )

        self.assertEqual(response.http_status, 201)
        self.assertEqual(response.payload["status"], "succeeded")
        self.assertEqual(operation_repo.rows["req-success"]["status"], "succeeded")
        self.assertEqual(len(jobs_repo.jobs), 0)
        self.assertEqual([event["event_type"] for event in audit_repo.events], [
            "subscription.requested",
            "subscription.succeeded",
        ])

    def test_retryable_error_queues_job_and_returns_202(self):
        operation_repo = _FakeOperationRepo()
        jobs_repo = _FakeJobsRepo()
        audit_repo = _FakeAuditRepo()

        orchestrator = SubscriptionOrchestrator(
            operation_repo=operation_repo,
            jobs_repo=jobs_repo,
            audit_repo=audit_repo,
            gateway=_RetryableGateway(),
        )

        response = orchestrator.submit(
            request_id="req-queued",
            payload={"userId": 77, "variantCode": "B"},
            actor_id="agent@example.org",
            correlation_id="corr-queued",
        )

        self.assertEqual(response.http_status, 202)
        self.assertEqual(response.payload["status"], "pending")
        self.assertEqual(operation_repo.rows["req-queued"]["status"], "queued")
        self.assertEqual(len(jobs_repo.jobs), 1)
        self.assertEqual(jobs_repo.jobs[0]["ordering_key"], "77")

    def test_validation_error_returns_4xx(self):
        operation_repo = _FakeOperationRepo()
        jobs_repo = _FakeJobsRepo()
        audit_repo = _FakeAuditRepo()

        orchestrator = SubscriptionOrchestrator(
            operation_repo=operation_repo,
            jobs_repo=jobs_repo,
            audit_repo=audit_repo,
            gateway=_ValidationGateway(),
        )

        response = orchestrator.submit(
            request_id="req-invalid",
            payload={"variantCode": "B"},
            actor_id="agent@example.org",
            correlation_id="corr-invalid",
        )

        self.assertEqual(response.http_status, 400)
        self.assertEqual(response.payload["status"], "failed")
        self.assertEqual(operation_repo.rows["req-invalid"]["status"], "failed")
        self.assertEqual(len(jobs_repo.jobs), 0)


if __name__ == "__main__":
    unittest.main()
