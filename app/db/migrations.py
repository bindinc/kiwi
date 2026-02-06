"""Handwritten SQL migration runner with checksum validation."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import logging
from pathlib import Path
import re
from typing import Iterable

import psycopg

from db.config import load_database_settings
from db.errors import MigrationChecksumError


LOGGER = logging.getLogger(__name__)
MIGRATION_FILE_PATTERN = re.compile(r"^(?P<version>\d+)_.*\.sql$")
DEFAULT_MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


@dataclass(frozen=True)
class MigrationScript:
    """Single migration script discovered from disk."""

    version: str
    filename: str
    checksum: str
    sql: str


@dataclass(frozen=True)
class MigrationPlan:
    """What to apply and what is already present."""

    to_apply: tuple[MigrationScript, ...]
    already_applied: tuple[str, ...]


def compute_checksum(sql: str) -> str:
    """Create a deterministic checksum for a migration body."""

    return sha256(sql.encode("utf-8")).hexdigest()


def discover_migration_scripts(migrations_dir: Path | None = None) -> tuple[MigrationScript, ...]:
    """Read and parse migration scripts from disk."""

    directory = migrations_dir or DEFAULT_MIGRATIONS_DIR
    scripts: list[MigrationScript] = []

    for path in sorted(directory.glob("*.sql")):
        match = MIGRATION_FILE_PATTERN.match(path.name)
        if not match:
            continue

        version = match.group("version")
        sql = path.read_text(encoding="utf-8")
        scripts.append(
            MigrationScript(
                version=version,
                filename=path.name,
                checksum=compute_checksum(sql),
                sql=sql,
            )
        )

    return tuple(scripts)


def build_migration_plan(
    scripts: Iterable[MigrationScript],
    applied_checksums: dict[str, str],
) -> MigrationPlan:
    """Determine which scripts must run and validate existing checksums."""

    to_apply: list[MigrationScript] = []
    already_applied: list[str] = []

    for script in scripts:
        applied_checksum = applied_checksums.get(script.version)
        if applied_checksum is None:
            to_apply.append(script)
            continue

        if applied_checksum != script.checksum:
            raise MigrationChecksumError(
                "Applied migration checksum mismatch for "
                f"{script.filename}. Expected {applied_checksum}, got {script.checksum}."
            )

        already_applied.append(script.version)

    return MigrationPlan(to_apply=tuple(to_apply), already_applied=tuple(already_applied))


def _ensure_schema_migrations_table(connection: psycopg.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def _load_applied_checksums(connection: psycopg.Connection) -> dict[str, str]:
    rows = connection.execute("SELECT version, checksum FROM schema_migrations").fetchall()
    return {row[0]: row[1] for row in rows}


def _record_applied_migration(connection: psycopg.Connection, script: MigrationScript) -> None:
    connection.execute(
        "INSERT INTO schema_migrations (version, checksum) VALUES (%s, %s)",
        (script.version, script.checksum),
    )


def run_migrations(db_url: str | None = None, migrations_dir: Path | None = None) -> MigrationPlan:
    """Run pending migrations and validate checksums for already applied scripts."""

    target_db_url = db_url or load_database_settings().db_url
    if not target_db_url:
        raise RuntimeError("Cannot run migrations without KIWI_DB_URL")

    scripts = discover_migration_scripts(migrations_dir=migrations_dir)

    with psycopg.connect(target_db_url) as connection:
        _ensure_schema_migrations_table(connection)
        applied_checksums = _load_applied_checksums(connection)
        plan = build_migration_plan(scripts, applied_checksums)

        for script in plan.to_apply:
            LOGGER.info("Applying migration %s", script.filename)
            connection.execute(script.sql)
            _record_applied_migration(connection, script)

    return plan
