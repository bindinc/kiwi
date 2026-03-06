import os
import sys
import importlib
import unittest
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))


class DummyOIDC:
    def __init__(self, app, prefix=None):
        self.app = app
        self.prefix = prefix


def load_main_module():
    sys.modules.pop("main", None)

    with mock.patch("flask_oidc.OpenIDConnect", DummyOIDC):
        return importlib.import_module("main")


class BlueprintRegistryTests(unittest.TestCase):
    def test_create_app_registers_core_blueprints(self):
        main = load_main_module()

        with mock.patch.object(main, "OpenIDConnect", DummyOIDC):
            app = main.create_app()

        self.assertIn("main", app.blueprints)
        self.assertIn("api_v1", app.blueprints)

    def test_create_app_uses_postgresql_session_backend(self):
        main = load_main_module()
        session_interface = object()
        session_env = {
            "FLASK_SECRET_KEY": "test-secret",
            "SESSION_TYPE": "postgresql",
            "SESSION_DB_HOST": "kiwi-postgres-rw.kiwi.svc",
            "SESSION_DB_PORT": "5432",
            "SESSION_DB_NAME": "kiwi",
            "SESSION_DB_USER": "kiwi_rw",
            "SESSION_DB_PASSWORD": "test-password",
            "SESSION_DB_SSLMODE": "require",
        }

        with mock.patch.dict(os.environ, session_env, clear=False):
            with mock.patch.object(main, "OpenIDConnect", DummyOIDC):
                with mock.patch.object(
                    main,
                    "PostgreSQLSessionInterface",
                    return_value=session_interface,
                ) as session_mock:
                    app = main.create_app()

        self.assertIs(app.session_interface, session_interface)
        session_mock.assert_called_once()

    def test_create_app_requires_flask_secret_key_for_postgresql_sessions(self):
        main = load_main_module()

        with mock.patch.dict(os.environ, {"SESSION_TYPE": "postgresql"}, clear=True):
            with mock.patch.object(main, "OpenIDConnect", DummyOIDC):
                with self.assertRaises(RuntimeError):
                    main.create_app()


if __name__ == "__main__":
    unittest.main()
