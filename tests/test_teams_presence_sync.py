import base64
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from services import teams_presence_sync  # noqa: E402


def make_jwt(payload):
    header = {"alg": "none", "typ": "JWT"}

    def encode(value):
        raw = json.dumps(value).encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")

    return f"{encode(header)}.{encode(payload)}."


class MockResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class TeamsPresenceSyncTests(unittest.TestCase):
    def test_capability_rejects_non_microsoft_issuer(self):
        session_data = {
            "oidc_auth_token": {
                "id_token": make_jwt({"iss": "https://bdc.rtvmedia.org.local/kiwi-oidc/realms/kiwi-local"}),
                "access_token": make_jwt({"scp": "Presence.ReadWrite"}),
            }
        }
        capability = teams_presence_sync.get_sync_capability(
            session_data, {"TEAMS_PRESENCE_SYNC_ENABLED": True}
        )

        self.assertFalse(capability["can_read"])
        self.assertFalse(capability["can_write"])
        self.assertEqual(capability["reason"], "unsupported_identity_provider")

    def test_capability_requires_presence_scope(self):
        session_data = {
            "oidc_auth_token": {
                "id_token": make_jwt({"iss": "https://login.microsoftonline.com/example/v2.0"}),
                "access_token": make_jwt({"scp": "User.Read"}),
            }
        }
        capability = teams_presence_sync.get_sync_capability(
            session_data, {"TEAMS_PRESENCE_SYNC_ENABLED": True}
        )

        self.assertFalse(capability["can_read"])
        self.assertFalse(capability["can_write"])
        self.assertEqual(capability["reason"], "missing_presence_scope")

    def test_capability_allows_read_and_write_with_scope(self):
        session_data = {
            "oidc_auth_token": {
                "id_token": make_jwt({"iss": "https://login.microsoftonline.com/example/v2.0"}),
                "access_token": make_jwt({"scp": "Presence.ReadWrite"}),
            }
        }
        capability = teams_presence_sync.get_sync_capability(
            session_data, {"TEAMS_PRESENCE_SYNC_ENABLED": True}
        )

        self.assertTrue(capability["can_read"])
        self.assertTrue(capability["can_write"])
        self.assertIsNone(capability["reason"])

    def test_sync_skips_when_write_is_unavailable(self):
        session_data = {
            "oidc_auth_token": {
                "id_token": make_jwt({"iss": "https://login.microsoftonline.com/example/v2.0"}),
                "access_token": make_jwt({"scp": "User.Read"}),
            }
        }

        result = teams_presence_sync.sync_kiwi_status_to_teams(
            "ready",
            session_data,
            {"TEAMS_PRESENCE_SYNC_ENABLED": True},
        )

        self.assertFalse(result["attempted"])
        self.assertFalse(result["synced"])
        self.assertEqual(result["reason"], "missing_presence_scope")

    def test_sync_updates_graph_when_session_can_write(self):
        calls = {}

        def mock_post(url, headers, json, timeout):
            calls["url"] = url
            calls["headers"] = headers
            calls["json"] = json
            calls["timeout"] = timeout
            return MockResponse(status_code=200)

        session_data = {
            "oidc_auth_token": {
                "id_token": make_jwt(
                    {
                        "iss": "https://login.microsoftonline.com/example/v2.0",
                        "oid": "11111111-1111-1111-1111-111111111111",
                    }
                ),
                "access_token": make_jwt({"scp": "Presence.ReadWrite"}),
            }
        }

        result = teams_presence_sync.sync_kiwi_status_to_teams(
            "ready",
            session_data,
            {"TEAMS_PRESENCE_SYNC_ENABLED": True},
            http_post=mock_post,
        )

        self.assertTrue(result["attempted"])
        self.assertTrue(result["synced"])
        self.assertIn("/presence/setUserPreferredPresence", calls["url"])
        self.assertEqual(calls["json"]["availability"], "Available")
        self.assertEqual(calls["timeout"], 5)

    def test_fetch_presence_maps_to_ready_status(self):
        def mock_get(url, headers, timeout):
            self.assertIn("/me/presence", url)
            return MockResponse(
                status_code=200,
                payload={"availability": "Available", "activity": "Available"},
            )

        session_data = {
            "oidc_auth_token": {
                "id_token": make_jwt({"iss": "https://login.microsoftonline.com/example/v2.0"}),
                "access_token": make_jwt({"scp": "Presence.Read"}),
            }
        }

        result = teams_presence_sync.fetch_teams_presence_status(
            session_data,
            {"TEAMS_PRESENCE_SYNC_ENABLED": True},
            http_get=mock_get,
        )

        self.assertTrue(result["attempted"])
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["reason"], None)


if __name__ == "__main__":
    unittest.main()
