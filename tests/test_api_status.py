import os
import sys
import unittest

from flask import Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from blueprints.api import api_v1_bp, register_api_blueprint  # noqa: E402
from blueprints.api.status import status_bp  # noqa: E402


class ApiStatusTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        register_api_blueprint(status_bp)
        app.register_blueprint(api_v1_bp)
        self.client = app.test_client()

    def test_status_returns_snapshot(self):
        response = self.client.get("/api/v1/status")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("db", payload)
        self.assertIn("queue", payload)
        self.assertIn("rate_limit", payload)


if __name__ == "__main__":
    unittest.main()
