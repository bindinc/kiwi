import os
import sys
import unittest

from flask import Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from blueprints.api.status import status_bp  # noqa: E402


class ApiStatusTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(status_bp, url_prefix="/api/v1")
        self.client = app.test_client()

    def test_status_returns_snapshot(self):
        response = self.client.get("/api/v1/status")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("rate_limit", payload)


if __name__ == "__main__":
    unittest.main()
