import os
import sys
import unittest
from datetime import timedelta
from unittest import mock

from flask import Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from postgresql_session import (  # noqa: E402
    CREATE_SESSION_EXPIRY_INDEX_SQL,
    CREATE_SESSION_TABLE_SQL,
    DELETE_EXPIRED_SESSIONS_SQL,
    DELETE_SESSION_SQL,
    SELECT_SESSION_SQL,
    UPSERT_SESSION_SQL,
    PostgreSQLSessionInterface,
    build_session_db_conninfo,
)


def normalize_sql(value):
    return " ".join(value.split())


class FakeCursor:
    def __init__(self, fetchone_result=None):
        self.fetchone_result = fetchone_result
        self.executed = []

    def execute(self, query, params=None):
        self.executed.append((normalize_sql(query), params))

    def fetchone(self):
        return self.fetchone_result

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self, cursor):
        self.cursor_instance = cursor

    def cursor(self):
        return self.cursor_instance

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class PostgreSQLSessionInterfaceTests(unittest.TestCase):
    def make_app(self):
        app = Flask(__name__)
        app.secret_key = "test-secret"
        app.config["SESSION_COOKIE_NAME"] = "session"
        return app

    def make_interface(self, connect_mock):
        app = self.make_app()
        with mock.patch("postgresql_session.psycopg.connect", connect_mock):
            return PostgreSQLSessionInterface(
                app,
                conninfo="dbname=kiwi",
                use_signer=False,
                permanent=False,
            )

    def test_build_session_db_conninfo_requires_all_settings(self):
        with self.assertRaises(RuntimeError):
            build_session_db_conninfo({})

    def test_build_session_db_conninfo_uses_env_mapping(self):
        conninfo = build_session_db_conninfo(
            {
                "SESSION_DB_HOST": "db.example",
                "SESSION_DB_PORT": "5432",
                "SESSION_DB_NAME": "kiwi",
                "SESSION_DB_USER": "kiwi_rw",
                "SESSION_DB_PASSWORD": "secret",
                "SESSION_DB_SSLMODE": "require",
            }
        )

        self.assertIn("host=db.example", conninfo)
        self.assertIn("port=5432", conninfo)
        self.assertIn("dbname=kiwi", conninfo)
        self.assertIn("user=kiwi_rw", conninfo)
        self.assertIn("password=secret", conninfo)
        self.assertIn("sslmode=require", conninfo)

    def test_initialization_creates_schema(self):
        cursor = FakeCursor()
        connect_mock = mock.Mock(return_value=FakeConnection(cursor))

        self.make_interface(connect_mock)

        self.assertEqual(
            cursor.executed,
            [
                (normalize_sql(CREATE_SESSION_TABLE_SQL), None),
                (normalize_sql(CREATE_SESSION_EXPIRY_INDEX_SQL), None),
            ],
        )

    def test_retrieve_session_data_returns_none_when_row_is_missing(self):
        init_cursor = FakeCursor()
        connect_mock = mock.Mock(side_effect=[FakeConnection(init_cursor)])
        interface = self.make_interface(connect_mock)
        query_cursor = FakeCursor(fetchone_result=None)

        with mock.patch(
            "postgresql_session.psycopg.connect",
            return_value=FakeConnection(query_cursor),
        ):
            session_data = interface._retrieve_session_data("session:test")

        self.assertIsNone(session_data)
        self.assertEqual(
            query_cursor.executed,
            [(normalize_sql(SELECT_SESSION_SQL), ("session:test",))],
        )

    def test_retrieve_session_data_decodes_serialized_bytes(self):
        init_cursor = FakeCursor()
        connect_mock = mock.Mock(side_effect=[FakeConnection(init_cursor)])
        interface = self.make_interface(connect_mock)

        encoded_session = interface.serializer.encode(
            interface.session_class({"oidc_auth_profile": {"email": "kiwi@example.org"}}, sid="test")
        )
        query_cursor = FakeCursor(fetchone_result=(encoded_session,))

        with mock.patch(
            "postgresql_session.psycopg.connect",
            return_value=FakeConnection(query_cursor),
        ):
            session_data = interface._retrieve_session_data("session:test")

        self.assertEqual(
            session_data,
            {"oidc_auth_profile": {"email": "kiwi@example.org"}},
        )

    def test_upsert_session_writes_session_row(self):
        init_cursor = FakeCursor()
        upsert_cursor = FakeCursor()
        connect_mock = mock.Mock(side_effect=[FakeConnection(init_cursor)])
        interface = self.make_interface(connect_mock)
        session_data = interface.session_class({"oidc_auth_token": {"id_token": "abc"}}, sid="test")

        with mock.patch(
            "postgresql_session.psycopg.connect",
            return_value=FakeConnection(upsert_cursor),
        ):
            interface._upsert_session(timedelta(days=1), session_data, "session:test")

        self.assertEqual(len(upsert_cursor.executed), 1)
        statement, params = upsert_cursor.executed[0]
        self.assertEqual(statement, normalize_sql(UPSERT_SESSION_SQL))
        self.assertEqual(params[0], "session:test")
        self.assertIsInstance(params[1], bytes)

    def test_delete_session_uses_expected_query(self):
        init_cursor = FakeCursor()
        delete_cursor = FakeCursor()
        connect_mock = mock.Mock(side_effect=[FakeConnection(init_cursor)])
        interface = self.make_interface(connect_mock)

        with mock.patch(
            "postgresql_session.psycopg.connect",
            return_value=FakeConnection(delete_cursor),
        ):
            interface._delete_session("session:test")

        self.assertEqual(
            delete_cursor.executed,
            [(normalize_sql(DELETE_SESSION_SQL), ("session:test",))],
        )

    def test_delete_expired_sessions_uses_expected_query(self):
        init_cursor = FakeCursor()
        cleanup_cursor = FakeCursor()
        connect_mock = mock.Mock(side_effect=[FakeConnection(init_cursor)])
        interface = self.make_interface(connect_mock)

        with mock.patch(
            "postgresql_session.psycopg.connect",
            return_value=FakeConnection(cleanup_cursor),
        ):
            interface._delete_expired_sessions()

        self.assertEqual(
            cleanup_cursor.executed,
            [(normalize_sql(DELETE_EXPIRED_SESSIONS_SQL), None)],
        )


if __name__ == "__main__":
    unittest.main()
