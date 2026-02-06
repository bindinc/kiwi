"""Shared database repository helpers."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from db.pool import pooled_connection


class RepositoryBase:
    """Base class that provides connection handling and UTC timestamps."""

    @contextmanager
    def connection(self) -> Iterator:
        with pooled_connection() as connection:
            yield connection

    @staticmethod
    def utcnow() -> datetime:
        return datetime.now(timezone.utc)
