import base64
import json
import os
import sys
import unittest

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


if __name__ == "__main__":
    unittest.main()
