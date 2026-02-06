"""Durable outbound queue worker."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging
import os
import time
from typing import Callable, Any

from db.repositories import (
    AuditEventsRepository,
    OperationRequestsRepository,
    OutboundJobAttemptsRepository,
    OutboundJobsRepository,
)
from services.queue.errors import NonRetryableJobError, RetryableJobError
from services.queue.retention import cleanup_old_records
from services.queue.retry_policy import RetryPolicy


LOGGER = logging.getLogger(__name__)
JobHandler = Callable[[dict[str, Any]], None]


@dataclass(frozen=True)
class WorkerSettings:
    """Queue worker runtime settings."""

    worker_id: str
    poll_interval_ms: int
    max_claim_batch: int
    lock_seconds: int
    retention_days: int


def load_worker_settings() -> WorkerSettings:
    """Load worker settings from environment variables."""

    def parse_int(name: str, default_value: int) -> int:
        value = os.environ.get(name)
        if value is None:
            return default_value

        try:
            parsed = int(value)
        except ValueError:
            return default_value

        if parsed < 1:
            return default_value

        return parsed

    worker_id = os.environ.get("KIWI_WORKER_ID", "kiwi-worker-1")
    return WorkerSettings(
        worker_id=worker_id,
        poll_interval_ms=parse_int("KIWI_QUEUE_POLL_INTERVAL_MS", 1000),
        max_claim_batch=parse_int("KIWI_QUEUE_CLAIM_BATCH", 10),
        lock_seconds=parse_int("KIWI_QUEUE_LOCK_SECONDS", 60),
        retention_days=parse_int("KIWI_AUDIT_RETENTION_DAYS", 365),
    )


class OutboundJobWorker:
    """Queue worker with claim/lease/retry semantics."""

    def __init__(
        self,
        *,
        settings: WorkerSettings,
        handlers: dict[str, JobHandler] | None = None,
        retry_policy: RetryPolicy | None = None,
        jobs_repo: OutboundJobsRepository | None = None,
        attempts_repo: OutboundJobAttemptsRepository | None = None,
        operation_requests_repo: OperationRequestsRepository | None = None,
        audit_events_repo: AuditEventsRepository | None = None,
    ) -> None:
        self.settings = settings
        self.handlers = handlers or {}
        self.retry_policy = retry_policy or RetryPolicy()
        self.jobs_repo = jobs_repo or OutboundJobsRepository()
        self.attempts_repo = attempts_repo or OutboundJobAttemptsRepository()
        self.operation_requests_repo = operation_requests_repo or OperationRequestsRepository()
        self.audit_events_repo = audit_events_repo or AuditEventsRepository()
        self._last_retention_run: datetime | None = None

    def run_forever(self) -> None:
        """Run worker loop continuously."""

        LOGGER.info("Starting outbound queue worker with id %s", self.settings.worker_id)
        sleep_seconds = self.settings.poll_interval_ms / 1000

        while True:
            self.run_once()
            time.sleep(sleep_seconds)

    def run_once(self) -> int:
        """Process one claim/execute cycle and return number of claimed jobs."""

        now_utc = datetime.now(timezone.utc)
        self._run_retention_if_due(now_utc)

        claimed_jobs = self.jobs_repo.claim_jobs(
            worker_id=self.settings.worker_id,
            limit=self.settings.max_claim_batch,
            lock_seconds=self.settings.lock_seconds,
            now_utc=now_utc,
        )

        for job in claimed_jobs:
            self._process_job(job, now_utc)

        return len(claimed_jobs)

    def _run_retention_if_due(self, now_utc: datetime) -> None:
        if self._last_retention_run is not None:
            elapsed = now_utc - self._last_retention_run
            if elapsed < timedelta(hours=24):
                return

        summary = cleanup_old_records(
            retention_days=self.settings.retention_days,
            audit_events_repo=self.audit_events_repo,
            outbound_jobs_repo=self.jobs_repo,
            outbound_attempts_repo=self.attempts_repo,
            now_utc=now_utc,
        )
        LOGGER.info("Retention cleanup completed: %s", summary)
        self._last_retention_run = now_utc

    def _process_job(self, job: dict[str, Any], now_utc: datetime) -> None:
        job_id = int(job["job_id"])
        request_id = str(job["request_id"])

        attempt_no = self.jobs_repo.increment_attempt_count(job_id)
        attempt_id = self.attempts_repo.start_attempt(job_id, attempt_no)

        handler = self.handlers.get(job["job_type"])
        if handler is None:
            self._mark_job_dead_letter(
                job_id=job_id,
                request_id=request_id,
                attempt_id=attempt_id,
                error_code="handler_missing",
                error_message="No handler registered for job type",
            )
            return

        try:
            handler(job)
        except RetryableJobError as exc:
            self._retry_or_dead_letter(job, now_utc, attempt_id, request_id, str(exc))
            return
        except NonRetryableJobError as exc:
            self._mark_job_dead_letter(
                job_id=job_id,
                request_id=request_id,
                attempt_id=attempt_id,
                error_code="non_retryable",
                error_message=str(exc),
            )
            return
        except Exception as exc:  # pragma: no cover - defensive protection
            self._retry_or_dead_letter(job, now_utc, attempt_id, request_id, str(exc))
            return

        self.jobs_repo.mark_succeeded(job_id)
        self.attempts_repo.finish_attempt(attempt_id, outcome="succeeded")
        self.operation_requests_repo.update_status(
            request_id=request_id,
            status="succeeded",
            result_json={"jobId": job_id},
            completed=True,
        )
        self.audit_events_repo.append_event(
            event_type="outbound_job.succeeded",
            actor_id=self.settings.worker_id,
            entity_type="job",
            entity_id=str(job_id),
            request_id=request_id,
            correlation_id=job.get("correlation_id"),
            before_redacted=None,
            after_redacted={"status": "succeeded"},
            metadata_json={"attemptNo": attempt_no},
        )

    def _retry_or_dead_letter(
        self,
        job: dict[str, Any],
        now_utc: datetime,
        attempt_id: int,
        request_id: str,
        message: str,
    ) -> None:
        job_id = int(job["job_id"])
        attempt_no = int(job["attempt_count"]) + 1

        next_delay = self.retry_policy.next_delay_seconds(attempt_no)
        if next_delay is None:
            self._mark_job_dead_letter(
                job_id=job_id,
                request_id=request_id,
                attempt_id=attempt_id,
                error_code="retry_exhausted",
                error_message=message,
            )
            return

        next_attempt_at = now_utc + timedelta(seconds=next_delay)
        self.jobs_repo.schedule_retry(
            job_id=job_id,
            next_attempt_at=next_attempt_at,
            error_code="retryable_error",
            error_message_redacted=message,
        )
        self.attempts_repo.finish_attempt(
            attempt_id,
            outcome="retry_scheduled",
            error_code="retryable_error",
            error_message_redacted=message,
        )

    def _mark_job_dead_letter(
        self,
        *,
        job_id: int,
        request_id: str,
        attempt_id: int,
        error_code: str,
        error_message: str,
    ) -> None:
        self.jobs_repo.mark_dead_letter(job_id, error_code, error_message)
        self.attempts_repo.finish_attempt(
            attempt_id,
            outcome="dead_letter",
            error_code=error_code,
            error_message_redacted=error_message,
        )
        self.operation_requests_repo.update_status(
            request_id=request_id,
            status="failed",
            error_json={"code": error_code, "message": error_message},
            completed=True,
        )
        self.audit_events_repo.append_event(
            event_type="outbound_job.dead_letter",
            actor_id=self.settings.worker_id,
            entity_type="job",
            entity_id=str(job_id),
            request_id=request_id,
            correlation_id=None,
            before_redacted=None,
            after_redacted={"status": "dead_letter", "errorCode": error_code},
            metadata_json=None,
        )
