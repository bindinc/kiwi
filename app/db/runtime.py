"""Database startup orchestration for Flask and worker processes."""

from __future__ import annotations

import logging
from threading import Lock

from db.config import load_database_settings
from db.migrations import run_migrations
from db.pool import initialize_pool


LOGGER = logging.getLogger(__name__)
_INITIALIZED = False
_INITIALIZE_LOCK = Lock()


def initialize_database() -> bool:
    """Run migrations and initialize the pool when a database URL is available."""

    global _INITIALIZED

    with _INITIALIZE_LOCK:
        if _INITIALIZED:
            return True

        settings = load_database_settings()
        if not settings.db_url:
            LOGGER.info("Database initialization skipped: KIWI_DB_URL is not configured")
            return False

        plan = run_migrations(db_url=settings.db_url)
        LOGGER.info(
            "Database migrations complete: %s applied, %s already present",
            len(plan.to_apply),
            len(plan.already_applied),
        )

        initialize_pool(settings)
        _INITIALIZED = True
        return True
