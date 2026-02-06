"""PostgreSQL pool and transaction helpers."""

from __future__ import annotations

from contextlib import contextmanager
import logging
from threading import Lock
from typing import Iterator

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from db.config import DatabaseSettings, load_database_settings


LOGGER = logging.getLogger(__name__)
_POOL: ConnectionPool | None = None
_POOL_LOCK = Lock()


def initialize_pool(settings: DatabaseSettings | None = None) -> ConnectionPool | None:
    """Initialize a global connection pool once."""

    global _POOL

    config = settings or load_database_settings()
    if not config.db_url:
        LOGGER.info("Database pool disabled: KIWI_DB_URL is not configured")
        return None

    with _POOL_LOCK:
        if _POOL is not None:
            return _POOL

        _POOL = ConnectionPool(
            conninfo=config.db_url,
            min_size=config.pool_min,
            max_size=config.pool_max,
            kwargs={"row_factory": dict_row},
            open=True,
        )

    return _POOL


def get_pool() -> ConnectionPool | None:
    """Return the initialized pool."""

    return _POOL


def close_pool() -> None:
    """Close and remove the global pool."""

    global _POOL

    with _POOL_LOCK:
        if _POOL is None:
            return

        _POOL.close()
        _POOL = None


@contextmanager
def pooled_connection() -> Iterator:
    """Borrow a connection from the pool in a context manager."""

    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool has not been initialized")

    with pool.connection() as connection:
        yield connection


def ping_database() -> bool:
    """Return True when a simple query can be executed."""

    pool = get_pool()
    if pool is None:
        return False

    try:
        with pool.connection() as connection:
            connection.execute("SELECT 1")
    except Exception:  # pragma: no cover - defensive catch for health checks
        LOGGER.exception("Database ping failed")
        return False

    return True
