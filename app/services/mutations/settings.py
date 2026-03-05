from __future__ import annotations

import os
from datetime import timedelta

DEFAULT_MAX_ATTEMPTS = 20
DEFAULT_MAX_AGE_HOURS = 24
DEFAULT_BATCH_SIZE = 10
DEFAULT_LOOP_SLEEP_SECONDS = 2
DEFAULT_HTTP_TIMEOUT_SECONDS = 10
DEFAULT_RETENTION_DAYS = 365


def _parse_bool(raw_value: str | None, default: bool) -> bool:
    if raw_value is None:
        return default

    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False

    return default


def _parse_int(raw_value: str | None, default: int, *, minimum: int) -> int:
    if raw_value is None:
        return default

    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return default

    if parsed < minimum:
        return default

    return parsed


def is_mutation_store_enabled() -> bool:
    return _parse_bool(os.environ.get("MUTATION_STORE_ENABLED"), False)


def get_mutation_database_url() -> str | None:
    return os.environ.get("MUTATION_DATABASE_URL")


def get_mutation_target_base_url() -> str | None:
    return os.environ.get("MUTATION_TARGET_BASE_URL")


def is_mutation_dispatch_dry_run_enabled() -> bool:
    return _parse_bool(os.environ.get("MUTATION_DISPATCH_DRY_RUN"), False)


def get_mutation_max_attempts() -> int:
    return _parse_int(os.environ.get("MUTATION_MAX_ATTEMPTS"), DEFAULT_MAX_ATTEMPTS, minimum=1)


def get_mutation_max_age_hours() -> int:
    return _parse_int(os.environ.get("MUTATION_MAX_AGE_HOURS"), DEFAULT_MAX_AGE_HOURS, minimum=1)


def get_mutation_worker_batch_size() -> int:
    return _parse_int(os.environ.get("MUTATION_WORKER_BATCH_SIZE"), DEFAULT_BATCH_SIZE, minimum=1)


def get_mutation_worker_sleep_seconds() -> int:
    return _parse_int(os.environ.get("MUTATION_WORKER_SLEEP_SECONDS"), DEFAULT_LOOP_SLEEP_SECONDS, minimum=1)


def get_mutation_dispatch_timeout_seconds() -> int:
    return _parse_int(os.environ.get("MUTATION_DISPATCH_TIMEOUT_SECONDS"), DEFAULT_HTTP_TIMEOUT_SECONDS, minimum=1)


def get_mutation_retention_days() -> int:
    return _parse_int(os.environ.get("MUTATION_RETENTION_DAYS"), DEFAULT_RETENTION_DAYS, minimum=1)


def get_mutation_retention_delta() -> timedelta:
    return timedelta(days=get_mutation_retention_days())
