from flask import Blueprint, redirect, render_template, request, session, url_for
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
        return_url = url_for(".index", _external=True)
        logout_url = url_for("oidc_auth.logout", next=return_url)

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
            user_initials=identity["initials"],
            user_profile_image=profile_image,
            logout_url=logout_url,
        )

    return bp
