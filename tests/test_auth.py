import base64
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

import auth  # noqa: E402


def make_jwt(payload):
    header = {"alg": "none", "typ": "JWT"}

    def encode(value):
        raw = json.dumps(value).encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")

    return f"{encode(header)}.{encode(payload)}."


class AuthHelpersTests(unittest.TestCase):
    def test_normalize_base_path(self):
        self.assertEqual(auth.normalize_base_path(None), "")
        self.assertEqual(auth.normalize_base_path(""), "")
        self.assertEqual(auth.normalize_base_path("/"), "")
        self.assertEqual(auth.normalize_base_path("kiwi"), "/kiwi")
        self.assertEqual(auth.normalize_base_path("/kiwi/"), "/kiwi")

    def test_get_callback_route(self):
        redirect_uri = "https://example.org/kiwi/auth/callback"
        self.assertEqual(auth.get_callback_route(redirect_uri), "/auth/callback")
        self.assertEqual(
            auth.get_callback_route("https://example.org/oidc/callback"), "/oidc/callback"
        )
        self.assertIsNone(auth.get_callback_route(None))

    def test_build_oidc_redirect_uri(self):
        self.assertEqual(
            auth.build_oidc_redirect_uri("https://example.org/", "/kiwi"),
            "https://example.org/kiwi/auth/callback",
        )
        self.assertEqual(
            auth.build_oidc_redirect_uri("https://example.org/", "kiwi-preview"),
            "https://example.org/kiwi-preview/auth/callback",
        )
        self.assertEqual(
            auth.build_oidc_redirect_uri("https://example.org/", ""),
            "https://example.org/auth/callback",
        )
        self.assertIsNone(auth.build_oidc_redirect_uri("", "/kiwi"))

    def test_get_user_roles_from_id_token(self):
        token = make_jwt({"roles": ["bink8s.app.kiwi.user"]})
        session_data = {"oidc_auth_token": {"id_token": token}}
        self.assertEqual(auth.get_user_roles(session_data), ["bink8s.app.kiwi.user"])

    def test_get_user_roles_from_profile(self):
        session_data = {"oidc_auth_profile": {"roles": ["bink8s.app.kiwi.view"]}}
        self.assertEqual(auth.get_user_roles(session_data), ["bink8s.app.kiwi.view"])

    def test_get_token_scopes_reads_scope_string_and_access_claims(self):
        access_token = make_jwt({"scp": "Presence.ReadWrite Presence.Read"})
        session_data = {
            "oidc_auth_token": {
                "access_token": access_token,
                "scope": "openid email profile User.Read",
            }
        }

        scopes = auth.get_token_scopes(session_data)
        self.assertIn("User.Read", scopes)
        self.assertIn("Presence.Read", scopes)
        self.assertIn("Presence.ReadWrite", scopes)

    def test_get_oidc_issuer_prefers_id_token_issuer(self):
        id_token = make_jwt({"iss": "https://login.microsoftonline.com/example/v2.0"})
        session_data = {"oidc_auth_token": {"id_token": id_token}}
        self.assertEqual(
            auth.get_oidc_issuer(session_data),
            "https://login.microsoftonline.com/example/v2.0",
        )

    def test_is_microsoft_issuer(self):
        self.assertTrue(auth.is_microsoft_issuer("https://login.microsoftonline.com/example/v2.0"))
        self.assertFalse(auth.is_microsoft_issuer("https://bdc.rtvmedia.org.local/kiwi-oidc/realms/kiwi-local"))

    def test_user_has_access(self):
        self.assertTrue(auth.user_has_access(["bink8s.app.kiwi.admin"]))
        self.assertFalse(auth.user_has_access(["some.other.role"]))
        self.assertFalse(auth.user_has_access([]))

    def test_build_user_identity(self):
        profile = {"given_name": "Jan", "family_name": "Vos", "email": "jan@example.org"}
        identity = auth.build_user_identity(profile)
        self.assertEqual(identity["first_name"], "Jan")
        self.assertEqual(identity["last_name"], "Vos")
        self.assertEqual(identity["full_name"], "Jan Vos")
        self.assertEqual(identity["initials"], "JV")
        self.assertEqual(identity["email"], "jan@example.org")

    def test_get_oidc_end_session_endpoint(self):
        metadata_response = mock.Mock()
        metadata_response.status_code = 200
        metadata_response.json.return_value = {
            "issuer": "https://issuer.example",
            "end_session_endpoint": "https://issuer.example/logout",
        }

        endpoint = auth.get_oidc_end_session_endpoint(
            "https://issuer.example/.well-known/openid-configuration",
            http_get=mock.Mock(return_value=metadata_response),
        )
        self.assertEqual(endpoint, "https://issuer.example/logout")

    def test_get_redirect_uris_from_secrets(self):
        with tempfile.NamedTemporaryFile("w+", delete=False, encoding="utf-8") as handle:
            json.dump(
                {
                    "web": {
                        "redirect_uris": [
                            "https://app.example/auth/callback",
                            "https://app.example/logged-out",
                        ]
                    }
                },
                handle,
            )
            temp_path = handle.name

        self.assertEqual(
            auth.get_redirect_uris_from_secrets(temp_path),
            ["https://app.example/auth/callback", "https://app.example/logged-out"],
        )
        os.unlink(temp_path)

    def test_build_end_session_logout_url(self):
        logout_url = auth.build_end_session_logout_url(
            end_session_endpoint="https://issuer.example/logout",
            post_logout_redirect_uri="https://app.example/logged-out",
            id_token_hint="id-token",
            client_id="kiwi-client",
        )

        self.assertIn("post_logout_redirect_uri=https%3A%2F%2Fapp.example%2Flogged-out", logout_url)
        self.assertIn("id_token_hint=id-token", logout_url)
        self.assertIn("client_id=kiwi-client", logout_url)

    def test_build_end_session_logout_url_without_post_redirect(self):
        logout_url = auth.build_end_session_logout_url(
            end_session_endpoint="https://issuer.example/logout",
            post_logout_redirect_uri=None,
            id_token_hint="id-token",
            client_id="kiwi-client",
        )

        self.assertNotIn("post_logout_redirect_uri=", logout_url)
        self.assertIn("id_token_hint=id-token", logout_url)


if __name__ == "__main__":
    unittest.main()
