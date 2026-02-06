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
    def test_redirects_to_login_when_user_is_not_logged_in(self):
        app = Flask(__name__)
        app.secret_key = "test-secret"

        register_oidc_routes(app)
        app.register_blueprint(create_main_blueprint(DummyOIDC(user_loggedin=False)))

        with app.test_client() as client:
            response = client.get("/")

        self.assertEqual(response.status_code, 302)
        self.assertIn("/oidc/login?next=", response.location)

    def test_index_template_receives_logout_url(self):
        app = Flask(__name__)
        app.secret_key = "test-secret"

        register_oidc_routes(app)
        app.register_blueprint(create_main_blueprint(DummyOIDC(user_loggedin=True)))

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
        self.assertTrue(render_template_mock.call_args.kwargs["logout_url"].startswith("/oidc/logout?next="))


if __name__ == "__main__":
    unittest.main()
