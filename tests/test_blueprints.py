import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

import main  # noqa: E402


class DummyOIDC:
    def __init__(self, app, prefix=None):
        self.app = app
        self.prefix = prefix


class BlueprintRegistryTests(unittest.TestCase):
    def test_create_app_registers_core_blueprints(self):
        with mock.patch.object(main, "OpenIDConnect", DummyOIDC):
            app = main.create_app()

        self.assertIn("main", app.blueprints)
        self.assertIn("api_v1", app.blueprints)


if __name__ == "__main__":
    unittest.main()
