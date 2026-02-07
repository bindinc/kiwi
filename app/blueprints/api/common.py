from __future__ import annotations

from typing import Any

from flask import request, session

import auth

PUBLIC_PATHS = {
    "/api/v1/status",
}


def api_error(status: int, code: str, message: str, details: dict[str, Any] | None = None) -> tuple[dict[str, Any], int]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details:
        payload["error"]["details"] = details
    return payload, status


def is_api_authenticated() -> bool:
    profile = session.get("oidc_auth_profile")
    token = session.get("oidc_auth_token")
    return bool(profile or token)


def require_api_access() -> tuple[dict[str, Any], int] | None:
    if request.path.rstrip("/") in PUBLIC_PATHS:
        return None

    if not is_api_authenticated():
        return api_error(401, "unauthorized", "Authentication required")

    roles = auth.get_user_roles(session)
    if not auth.user_has_access(roles):
        return api_error(
            403,
            "forbidden",
            "Authenticated user does not have access to this API",
            details={"roles": roles},
        )

    return None


def get_current_user_context() -> dict[str, Any]:
    profile = session.get("oidc_auth_profile")
    if not isinstance(profile, dict):
        profile = {}

    identity = auth.build_user_identity(profile)
    roles = auth.get_user_roles(session)

    return {
        "identity": identity,
        "roles": roles,
    }
