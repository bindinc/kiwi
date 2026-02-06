"""Retention cleanup for audit and queue data."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from db.repositories.audit_events import AuditEventsRepository
from db.repositories.outbound_job_attempts import OutboundJobAttemptsRepository
from db.repositories.outbound_jobs import OutboundJobsRepository


def cleanup_old_records(
    *,
    retention_days: int,
    audit_events_repo: AuditEventsRepository,
    outbound_jobs_repo: OutboundJobsRepository,
    outbound_attempts_repo: OutboundJobAttemptsRepository,
    now_utc: datetime | None = None,
) -> dict[str, int]:
    """Delete records older than retention for timeline and terminal queue data."""

    timestamp = now_utc or datetime.now(timezone.utc)
    cutoff = timestamp - timedelta(days=retention_days)

    deleted_attempts = outbound_attempts_repo.delete_for_old_terminal_jobs(cutoff)
    deleted_jobs = outbound_jobs_repo.delete_terminal_older_than(cutoff)
    deleted_audit_events = audit_events_repo.delete_older_than(cutoff)

    return {
        "deleted_attempts": deleted_attempts,
        "deleted_jobs": deleted_jobs,
        "deleted_audit_events": deleted_audit_events,
    }
