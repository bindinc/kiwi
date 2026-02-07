import os
import sys
import unittest
from unittest import mock

from flask import Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from blueprints.api.agent_status import agent_status_bp  # noqa: E402


class AgentStatusApiTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.secret_key = "test-secret"
        app.config["TEAMS_PRESENCE_SYNC_ENABLED"] = True
        app.register_blueprint(agent_status_bp, url_prefix="/api/v1/agent-status")
        self.client = app.test_client()

        self._set_authentication(["bink8s.app.kiwi.user"])

    def _set_authentication(self, roles):
        with self.client.session_transaction() as session_data:
            session_data["oidc_auth_profile"] = {
                "name": "Test Agent",
                "roles": roles,
            }

    def _clear_authentication(self):
        with self.client.session_transaction() as session_data:
            session_data.pop("oidc_auth_profile", None)
            session_data.pop("oidc_auth_token", None)

    def test_endpoints_require_authentication(self):
        self._clear_authentication()

        get_response = self.client.get("/api/v1/agent-status")
        self.assertEqual(get_response.status_code, 401)
        self.assertEqual(get_response.get_json()["error"]["code"], "unauthorized")

        post_response = self.client.post("/api/v1/agent-status", json={"status": "ready"})
        self.assertEqual(post_response.status_code, 401)
        self.assertEqual(post_response.get_json()["error"]["code"], "unauthorized")

    def test_endpoints_require_allowed_roles(self):
        self._set_authentication(["no.access.role"])

        get_response = self.client.get("/api/v1/agent-status")
        self.assertEqual(get_response.status_code, 403)
        self.assertEqual(get_response.get_json()["error"]["code"], "forbidden")

        post_response = self.client.post("/api/v1/agent-status", json={"status": "ready"})
        self.assertEqual(post_response.status_code, 403)
        self.assertEqual(post_response.get_json()["error"]["code"], "forbidden")

    def test_get_returns_local_default_when_teams_status_is_unavailable(self):
        with mock.patch(
            "blueprints.api.agent_status.teams_presence_sync.fetch_teams_presence_status",
            return_value={
                "attempted": False,
                "status": None,
                "reason": "unsupported_identity_provider",
                "capability": {},
            },
        ):
            response = self.client.get("/api/v1/agent-status")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["source"], "local")

    def test_get_prefers_teams_status_when_it_is_mapped(self):
        with mock.patch(
            "blueprints.api.agent_status.teams_presence_sync.fetch_teams_presence_status",
            return_value={
                "attempted": True,
                "status": "away",
                "reason": None,
                "capability": {},
            },
        ):
            response = self.client.get("/api/v1/agent-status")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "away")
        self.assertEqual(payload["source"], "teams")

        with self.client.session_transaction() as session_data:
            self.assertEqual(session_data.get("kiwi_agent_status"), "away")

    def test_post_rejects_unknown_status(self):
        response = self.client.post("/api/v1/agent-status", json={"status": "unknown"})
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "invalid_payload")
        self.assertIn("allowed_statuses", payload["error"]["details"])

    def test_post_rejects_non_object_payload(self):
        response = self.client.post("/api/v1/agent-status", json=["ready"])
        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertEqual(payload["error"]["code"], "invalid_payload")

    def test_post_updates_local_status_and_returns_sync_result(self):
        with mock.patch(
            "blueprints.api.agent_status.teams_presence_sync.sync_kiwi_status_to_teams",
            return_value={
                "attempted": False,
                "synced": False,
                "reason": "unsupported_identity_provider",
                "capability": {},
            },
        ) as sync_mock:
            response = self.client.post("/api/v1/agent-status", json={"status": "offline"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "offline")
        self.assertEqual(payload["previous_status"], "ready")
        self.assertEqual(payload["teams_sync"]["reason"], "unsupported_identity_provider")
        sync_mock.assert_called_once()

        with self.client.session_transaction() as session_data:
            self.assertEqual(session_data.get("kiwi_agent_status"), "offline")

    def test_post_accepts_break_alias_and_normalizes_to_away(self):
        with mock.patch(
            "blueprints.api.agent_status.teams_presence_sync.sync_kiwi_status_to_teams",
            return_value={
                "attempted": False,
                "synced": False,
                "reason": "missing_presence_write_scope",
                "capability": {},
            },
        ):
            response = self.client.post("/api/v1/agent-status", json={"status": "break"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "away")
        self.assertEqual(payload["previous_status"], "ready")

    def test_post_accepts_in_call_status(self):
        with mock.patch(
            "blueprints.api.agent_status.teams_presence_sync.sync_kiwi_status_to_teams",
            return_value={
                "attempted": True,
                "synced": True,
                "reason": None,
                "mode": "session",
                "capability": {},
            },
        ):
            response = self.client.post("/api/v1/agent-status", json={"status": "in_call"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["status"], "in_call")


if __name__ == "__main__":
    unittest.main()
