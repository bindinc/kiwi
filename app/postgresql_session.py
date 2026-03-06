from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Mapping

import psycopg
from flask import Flask
from flask_session.base import ServerSideSession, ServerSideSessionInterface
from psycopg.conninfo import make_conninfo

SESSION_TABLE_NAME = "kiwi_http_sessions"
SESSION_TABLE_REFERENCE = f"public.{SESSION_TABLE_NAME}"

CREATE_SESSION_TABLE_SQL = f"""
CREATE TABLE IF NOT EXISTS {SESSION_TABLE_REFERENCE} (
    session_id TEXT PRIMARY KEY,
    data BYTEA NOT NULL,
    expiry TIMESTAMPTZ NOT NULL
)
"""

CREATE_SESSION_EXPIRY_INDEX_SQL = f"""
CREATE INDEX IF NOT EXISTS {SESSION_TABLE_NAME}_expiry_idx
ON {SESSION_TABLE_REFERENCE} (expiry)
"""

SELECT_SESSION_SQL = f"""
SELECT data
FROM {SESSION_TABLE_REFERENCE}
WHERE session_id = %s
  AND expiry > NOW()
"""

UPSERT_SESSION_SQL = f"""
INSERT INTO {SESSION_TABLE_REFERENCE} (session_id, data, expiry)
VALUES (%s, %s, %s)
ON CONFLICT (session_id) DO UPDATE
SET data = EXCLUDED.data,
    expiry = EXCLUDED.expiry
"""

DELETE_SESSION_SQL = f"DELETE FROM {SESSION_TABLE_REFERENCE} WHERE session_id = %s"
DELETE_EXPIRED_SESSIONS_SQL = f"DELETE FROM {SESSION_TABLE_REFERENCE} WHERE expiry <= NOW()"

SESSION_DB_ENV_KEYS = {
    "SESSION_DB_HOST": "host",
    "SESSION_DB_PORT": "port",
    "SESSION_DB_NAME": "dbname",
    "SESSION_DB_USER": "user",
    "SESSION_DB_PASSWORD": "password",
    "SESSION_DB_SSLMODE": "sslmode",
}


def build_session_db_conninfo(environ: Mapping[str, str] | None = None) -> str:
    if environ is None:
        environ = os.environ
    missing_keys = [key for key in SESSION_DB_ENV_KEYS if not environ.get(key)]
    if missing_keys:
        missing_list = ", ".join(sorted(missing_keys))
        raise RuntimeError(
            f"Missing required PostgreSQL session settings: {missing_list}"
        )

    return make_conninfo(
        host=environ["SESSION_DB_HOST"],
        port=environ["SESSION_DB_PORT"],
        dbname=environ["SESSION_DB_NAME"],
        user=environ["SESSION_DB_USER"],
        password=environ["SESSION_DB_PASSWORD"],
        sslmode=environ["SESSION_DB_SSLMODE"],
    )


class PostgreSQLSessionInterface(ServerSideSessionInterface):
    ttl = False
    session_class = ServerSideSession

    def __init__(
        self,
        app: Flask,
        conninfo: str,
        *,
        key_prefix: str = "session:",
        use_signer: bool = False,
        permanent: bool = True,
        sid_length: int = 32,
        serialization_format: str = "msgpack",
        cleanup_n_requests: int | None = None,
    ) -> None:
        self.conninfo = conninfo
        self._ensure_schema()
        super().__init__(
            app,
            key_prefix=key_prefix,
            use_signer=use_signer,
            permanent=permanent,
            sid_length=sid_length,
            serialization_format=serialization_format,
            cleanup_n_requests=cleanup_n_requests,
        )

    def _connect(self):
        return psycopg.connect(self.conninfo)

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(CREATE_SESSION_TABLE_SQL)
                cursor.execute(CREATE_SESSION_EXPIRY_INDEX_SQL)

    def _retrieve_session_data(self, store_id: str):
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(SELECT_SESSION_SQL, (store_id,))
                row = cursor.fetchone()

        if row is None:
            return None

        return self.serializer.decode(bytes(row[0]))

    def _delete_session(self, store_id: str) -> None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(DELETE_SESSION_SQL, (store_id,))

    def _upsert_session(
        self,
        session_lifetime: timedelta,
        session: ServerSideSession,
        store_id: str,
    ) -> None:
        expiry = datetime.now(timezone.utc) + session_lifetime
        serialized_session = self.serializer.encode(session)

        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    UPSERT_SESSION_SQL,
                    (store_id, serialized_session, expiry),
                )

    def _delete_expired_sessions(self) -> None:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(DELETE_EXPIRED_SESSIONS_SQL)
