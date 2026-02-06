import os
import sys
import unittest
from unittest import mock

from flask import Blueprint, Flask

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from blueprints.home.pages import create_main_blueprint  # noqa: E402


class DummyOIDC:
    def __init__(self, user_loggedin):
        self.user_loggedin = user_loggedin


def register_oidc_routes(app):
    oidc_auth_bp = Blueprint("oidc_auth", __name__)

    @oidc_auth_bp.route("/oidc/login")
    def login():
        return "login"

    @oidc_auth_bp.route("/oidc/logout")
    def logout():
        return "logout"

    app.register_blueprint(oidc_auth_bp)


class HomePagesTests(unittest.TestCase):
    def make_app(self, user_loggedin):
        app = Flask(__name__)
        app.secret_key = "test-secret"
        app.config["OIDC_SERVER_METADATA_URL"] = "https://issuer.example/.well-known/openid-configuration"
        app.config["OIDC_CLIENT_ID"] = "kiwi-local-dev"

        register_oidc_routes(app)
        app.register_blueprint(create_main_blueprint(DummyOIDC(user_loggedin=user_loggedin)))
        return app

    def test_redirects_to_login_when_user_is_not_logged_in(self):
        app = self.make_app(user_loggedin=False)

        with app.test_client() as client:
            response = client.get("/")

        self.assertEqual(response.status_code, 302)
        self.assertIn("/oidc/login?next=", response.location)

    def test_index_template_receives_logout_url(self):
        app = self.make_app(user_loggedin=True)

        with app.test_client() as client:
            with client.session_transaction() as session_data:
                session_data["oidc_auth_profile"] = {
                    "given_name": "Kiwi",
                    "family_name": "User",
                    "email": "kiwi-user@example.org",
                    "roles": ["bink8s.app.kiwi.user"],
                }

            with mock.patch("blueprints.home.pages.render_template", return_value="ok") as render_template_mock:
                response = client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(render_template_mock.call_args.args[0], "base/index.html")
        self.assertIn("logout_url", render_template_mock.call_args.kwargs)
        self.assertEqual(render_template_mock.call_args.kwargs["logout_url"], "/app-logout")

    def test_logout_redirects_to_provider_end_session_and_clears_session(self):
        app = self.make_app(user_loggedin=True)

        with app.test_client() as client:
            with client.session_transaction() as session_data:
                session_data["oidc_auth_token"] = {"id_token": "id-token-value"}
                session_data["oidc_auth_profile"] = {"name": "Kiwi User"}
                session_data["oidc_profile_photo"] = "cached-photo"
                session_data["next"] = "https://example.org/next"

            with mock.patch(
                "blueprints.home.pages.auth.get_oidc_end_session_endpoint",
                return_value="https://issuer.example/logout",
            ) as end_session_mock:
                with mock.patch(
                    "blueprints.home.pages.auth.get_redirect_uris_from_secrets",
                    return_value=["http://localhost/logged-out"],
                ):
                    with mock.patch(
                        "blueprints.home.pages.auth.build_end_session_logout_url",
                        return_value="https://issuer.example/logout?post_logout_redirect_uri=http://localhost/logged-out",
                    ) as build_logout_mock:
                        response = client.get("/app-logout")

            self.assertEqual(response.status_code, 302)
            self.assertTrue(response.location.startswith("https://issuer.example/logout"))
            end_session_mock.assert_called_once_with(
                "https://issuer.example/.well-known/openid-configuration"
            )
            build_logout_mock.assert_called_once()
            called_kwargs = build_logout_mock.call_args.kwargs
            self.assertEqual(called_kwargs["end_session_endpoint"], "https://issuer.example/logout")
            self.assertEqual(called_kwargs["id_token_hint"], "id-token-value")
            self.assertEqual(called_kwargs["client_id"], "kiwi-local-dev")
            self.assertEqual(called_kwargs["post_logout_redirect_uri"], "http://localhost/logged-out")

            with client.session_transaction() as session_data:
                self.assertNotIn("oidc_auth_token", session_data)
                self.assertNotIn("oidc_auth_profile", session_data)
                self.assertNotIn("oidc_profile_photo", session_data)
                self.assertNotIn("next", session_data)

    def test_logout_falls_back_to_logged_out_page_when_end_session_missing(self):
        app = self.make_app(user_loggedin=True)

        with app.test_client() as client:
            with mock.patch(
                "blueprints.home.pages.auth.get_oidc_end_session_endpoint",
                return_value=None,
            ):
                response = client.get("/app-logout")

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.location.endswith("/logged-out"))

    def test_logout_omits_post_logout_redirect_when_not_whitelisted(self):
        app = self.make_app(user_loggedin=True)

        with app.test_client() as client:
            with mock.patch(
                "blueprints.home.pages.auth.get_oidc_end_session_endpoint",
                return_value="https://issuer.example/logout",
            ):
                with mock.patch(
                    "blueprints.home.pages.auth.get_redirect_uris_from_secrets",
                    return_value=["https://other.example/callback"],
                ):
                    with mock.patch(
                        "blueprints.home.pages.auth.build_end_session_logout_url",
                        return_value="https://issuer.example/logout?id_token_hint=test",
                    ) as build_logout_mock:
                        response = client.get("/app-logout")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, "https://issuer.example/logout?id_token_hint=test")
        called_kwargs = build_logout_mock.call_args.kwargs
        self.assertIsNone(called_kwargs["post_logout_redirect_uri"])


if __name__ == "__main__":
    unittest.main()
