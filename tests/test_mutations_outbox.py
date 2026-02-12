import os
import sys
import unittest
from unittest import mock

from flask import Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from blueprints.api import api_v1_bp, register_api_blueprint  # noqa: E402
from blueprints.api.mutations import mutations_bp  # noqa: E402
from blueprints.api.status import status_bp  # noqa: E402
from blueprints.api.subscriptions import subscriptions_bp  # noqa: E402
from blueprints.api.workflows import workflows_bp  # noqa: E402


register_api_blueprint(status_bp)
register_api_blueprint(mutations_bp)
register_api_blueprint(subscriptions_bp)
register_api_blueprint(workflows_bp)


class MutationOutboxApiTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.secret_key = "test-secret"
        app.register_blueprint(api_v1_bp)
        self.client = app.test_client()

    def _authenticate(self, roles=None):
        allowed_roles = roles or ["bink8s.app.kiwi.user"]
        with self.client.session_transaction() as session_data:
            session_data["oidc_auth_profile"] = {
                "name": "Test User",
                "email": "test@example.org",
                "roles": allowed_roles,
            }

    def test_mutations_workbox_returns_503_when_store_disabled(self):
        self._authenticate(["bink8s.app.kiwi.supervisor"])

        response = self.client.get("/api/v1/mutations")
        self.assertEqual(response.status_code, 503)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "mutation_store_disabled")

    def test_subscription_update_enqueues_when_feature_enabled(self):
        self._authenticate()

        fake_mutation = {
            "id": "11111111-1111-1111-1111-111111111111",
            "status": "queued",
            "commandType": "subscription.update",
        }

        with mock.patch("blueprints.api.subscriptions.is_mutation_store_enabled", return_value=True), mock.patch(
            "blueprints.api.subscriptions.enqueue_mutation", return_value=fake_mutation
        ):
            response = self.client.patch(
                "/api/v1/subscriptions/1/5",
                json={"status": "cancelled"},
            )

        self.assertEqual(response.status_code, 202)
        payload = response.get_json()
        self.assertEqual(payload["mutation"]["id"], fake_mutation["id"])

    def test_workflow_signup_enqueues_when_feature_enabled(self):
        self._authenticate()

        fake_mutation = {
            "id": "22222222-2222-2222-2222-222222222222",
            "status": "queued",
            "commandType": "subscription.signup",
        }

        payload = {
            "recipient": {"personId": 1},
            "requester": {"sameAsRecipient": True},
            "subscription": {
                "magazine": "Avrobode",
                "duration": "1-jaar",
                "durationLabel": "1 jaar",
                "startDate": "2026-01-10",
                "status": "active",
            },
            "contactEntry": {
                "type": "Nieuw abonnement",
                "description": "Test",
            },
        }

        with mock.patch("blueprints.api.workflows.is_mutation_store_enabled", return_value=True), mock.patch(
            "blueprints.api.workflows.enqueue_mutation", return_value=fake_mutation
        ):
            response = self.client.post("/api/v1/workflows/subscription-signup", json=payload)

        self.assertEqual(response.status_code, 202)
        response_payload = response.get_json()
        self.assertEqual(response_payload["mutation"]["id"], fake_mutation["id"])


if __name__ == "__main__":
    unittest.main()
