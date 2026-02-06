"""Pure job-claiming helpers for deterministic testing."""

from __future__ import annotations

from datetime import datetime
from typing import Any


def _is_claim_candidate(job: dict[str, Any], now_utc: datetime) -> bool:
    status = job.get("status")
    next_attempt_at = job.get("next_attempt_at")
    locked_until = job.get("locked_until")

    is_queued_due = status == "queued" and next_attempt_at is not None and next_attempt_at <= now_utc
    is_expired_processing = (
        status == "processing" and locked_until is not None and locked_until < now_utc
    )

    if not (is_queued_due or is_expired_processing):
        return False

    if locked_until is None:
        return True

    return locked_until < now_utc


def select_claimable_jobs(
    jobs: list[dict[str, Any]],
    now_utc: datetime,
    limit: int,
) -> list[dict[str, Any]]:
    """Select claimable jobs with per-ordering-key serialization."""

    sorted_jobs = sorted(
        jobs,
        key=lambda item: (item.get("next_attempt_at"), item.get("created_at"), item.get("job_id")),
    )

    selected: list[dict[str, Any]] = []

    for job in sorted_jobs:
        if len(selected) >= limit:
            break

        if not _is_claim_candidate(job, now_utc):
            continue

        ordering_key = job.get("ordering_key")
        created_at = job.get("created_at")

        has_earlier_in_progress = False
        for other in jobs:
            is_same_key = other.get("ordering_key") == ordering_key
            is_earlier = other.get("created_at") is not None and created_at is not None and other.get(
                "created_at"
            ) < created_at
            blocks_flow = other.get("status") in {"queued", "processing"}

            if is_same_key and is_earlier and blocks_flow:
                has_earlier_in_progress = True
                break

        if has_earlier_in_progress:
            continue

        selected.append(job)

    return selected
