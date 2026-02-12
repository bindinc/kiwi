from flask import Blueprint, current_app, redirect, render_template, request, session, url_for
from flask_oidc import OpenIDConnect

import auth


BLUEPRINT_NAME = "main"
URL_PREFIX = "/"


def create_main_blueprint(oidc: OpenIDConnect) -> Blueprint:
    bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)

    @bp.route("/")
    def index() -> str:
        if not oidc.user_loggedin:
            login_url = url_for("oidc_auth.login", next=request.url)
            return redirect(login_url)

        profile = session.get("oidc_auth_profile", {})
        roles = auth.get_user_roles(session)
        identity = auth.build_user_identity(profile)
        logout_url = url_for(".app_logout")

        if not auth.user_has_access(roles):
            return (
                render_template(
                    "base/access_denied.html",
                    user_full_name=identity["full_name"],
                    user_email=identity["email"],
                    user_roles=roles,
                    allowed_roles=sorted(auth.ALLOWED_ROLES),
                    logout_url=logout_url,
                ),
                403,
            )

        profile_image = auth.get_profile_image(session)
        return render_template(
            "base/index.html",
            user_full_name=identity["full_name"],
            user_first_name=identity["first_name"],
            user_last_name=identity["last_name"],
            user_email=identity["email"],
            user_initials=identity["initials"],
            user_profile_image=profile_image,
            logout_url=logout_url,
        )

    @bp.route("/app-logout")
    def app_logout():
        logged_out_url = url_for(".logged_out", _external=True)
        token_data = session.get("oidc_auth_token")
        id_token_hint = token_data.get("id_token") if isinstance(token_data, dict) else None

        # Clear local app session first so browser back does not revive app state.
        for key in ("oidc_auth_token", "oidc_auth_profile", "oidc_profile_photo", "next"):
            session.pop(key, None)

        metadata_url = current_app.config.get("OIDC_SERVER_METADATA_URL")
        client_secrets_path = current_app.config.get("OIDC_CLIENT_SECRETS")
        configured_post_logout_redirect_uri = (
            current_app.config.get("OIDC_POST_LOGOUT_REDIRECT_URI") or logged_out_url
        )

        known_redirect_uris = auth.get_redirect_uris_from_secrets(client_secrets_path)
        post_logout_redirect_uri = (
            configured_post_logout_redirect_uri
            if configured_post_logout_redirect_uri in known_redirect_uris
            else None
        )

        end_session_endpoint = auth.get_oidc_end_session_endpoint(metadata_url)
        client_id = current_app.config.get("OIDC_CLIENT_ID")
        provider_logout_url = auth.build_end_session_logout_url(
            end_session_endpoint=end_session_endpoint,
            post_logout_redirect_uri=post_logout_redirect_uri,
            id_token_hint=id_token_hint,
            client_id=client_id,
        )

        if provider_logout_url:
            return redirect(provider_logout_url)

        return redirect(logged_out_url)

    @bp.route("/logged-out")
    def logged_out() -> str:
        login_target = url_for(".index", _external=True)
        login_url = url_for("oidc_auth.login", next=login_target)
        return render_template("base/logged_out.html", login_url=login_url)

    return bp
