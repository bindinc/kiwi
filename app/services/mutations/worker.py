from __future__ import annotations

import argparse
import logging
import random
import signal
import time
from datetime import UTC, datetime, timedelta

from . import dispatcher, store
from .settings import (
    get_mutation_worker_batch_size,
    get_mutation_worker_sleep_seconds,
    is_mutation_store_enabled,
)

LOGGER = logging.getLogger(__name__)


class WorkerController:
    def __init__(self) -> None:
        self.running = True

    def stop(self, signum, frame) -> None:  # noqa: ANN001
        LOGGER.info("Mutation worker shutting down (signal=%s)", signum)
        self.running = False



def _compute_backoff_seconds(attempt_count: int) -> int:
    capped_attempt = max(1, min(attempt_count, 12))
    base_delay = 2 ** capped_attempt
    jitter = random.randint(0, 7)
    return min(3600, base_delay + jitter)



def _next_attempt_at(attempt_count: int) -> datetime:
    return datetime.now(UTC) + timedelta(seconds=_compute_backoff_seconds(attempt_count))



def process_batch(batch_size: int) -> int:
    claimed_jobs = store.claim_due_mutations(batch_size=batch_size)

    if not claimed_jobs:
        return 0

    for job in claimed_jobs:
        mutation_id = job["id"]
        outcome = dispatcher.dispatch_mutation(job)

        if outcome.success:
            store.mark_delivered(mutation_id=mutation_id, http_status=outcome.http_status)
            continue

        should_escalate = store.should_escalate(job)
        should_retry = outcome.retryable and not should_escalate

        if should_retry:
            store.mark_retry_scheduled(
                mutation_id=mutation_id,
                next_attempt_at=_next_attempt_at(int(job.get("attempt_count") or 0)),
                failure_class=outcome.failure_class or "transient",
                error_code=outcome.error_code,
                error_message=outcome.error_message,
                http_status=outcome.http_status,
            )
            continue

        store.mark_failed(
            mutation_id=mutation_id,
            failure_class=outcome.failure_class or "manual_review_required",
            error_code=outcome.error_code,
            error_message=outcome.error_message,
            http_status=outcome.http_status,
        )

    return len(claimed_jobs)



def run_worker_loop(*, once: bool = False) -> None:
    if not is_mutation_store_enabled():
        LOGGER.warning("Mutation worker started while MUTATION_STORE_ENABLED is false")
        return

    batch_size = get_mutation_worker_batch_size()
    sleep_seconds = get_mutation_worker_sleep_seconds()

    controller = WorkerController()
    signal.signal(signal.SIGINT, controller.stop)
    signal.signal(signal.SIGTERM, controller.stop)

    LOGGER.info("Mutation worker started (batch_size=%s, sleep=%ss)", batch_size, sleep_seconds)

    while controller.running:
        processed = process_batch(batch_size)

        if once:
            LOGGER.info("Mutation worker one-shot processed %s jobs", processed)
            break

        if processed == 0:
            time.sleep(sleep_seconds)



def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Kiwi mutation outbox worker")
    parser.add_argument("--once", action="store_true", help="Process one batch and exit")
    return parser



def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    args = _build_argument_parser().parse_args()
    run_worker_loop(once=args.once)


if __name__ == "__main__":
    main()
