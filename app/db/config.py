"""Database configuration helpers."""

from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class DatabaseSettings:
    """Configuration values required by the PostgreSQL integration."""

    db_url: str | None
    pool_min: int
    pool_max: int


def _parse_int(value: str | None, default_value: int) -> int:
    if value is None:
        return default_value

    try:
        parsed = int(value)
    except ValueError:
        return default_value

    if parsed < 1:
        return default_value

    return parsed


def load_database_settings() -> DatabaseSettings:
    """Read database settings from environment variables."""

    pool_min = _parse_int(os.environ.get("KIWI_DB_POOL_MIN"), 1)
    pool_max = _parse_int(os.environ.get("KIWI_DB_POOL_MAX"), 5)

    if pool_max < pool_min:
        pool_max = pool_min

    return DatabaseSettings(
        db_url=os.environ.get("KIWI_DB_URL"),
        pool_min=pool_min,
        pool_max=pool_max,
    )
