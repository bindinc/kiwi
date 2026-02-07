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


def parse_int_value(
    raw_value: Any,
    *,
    field_name: str,
    default: int | None = None,
    required: bool = True,
    minimum: int | None = None,
    maximum: int | None = None,
    error_code: str = "invalid_payload",
) -> tuple[int | None, tuple[dict[str, Any], int] | None]:
    is_missing = raw_value is None or raw_value == ""
    if is_missing:
        if default is not None:
            return default, None
        if not required:
            return None, None
        return None, api_error(400, error_code, f"{field_name} is required")

    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return None, api_error(400, error_code, f"{field_name} must be an integer")

    if minimum is not None and parsed < minimum:
        return None, api_error(400, error_code, f"{field_name} must be >= {minimum}")
    if maximum is not None and parsed > maximum:
        return None, api_error(400, error_code, f"{field_name} must be <= {maximum}")

    return parsed, None


def parse_query_int(
    name: str,
    *,
    default: int | None = None,
    minimum: int | None = None,
    maximum: int | None = None,
) -> tuple[int | None, tuple[dict[str, Any], int] | None]:
    return parse_int_value(
        request.args.get(name),
        field_name=name,
        default=default,
        minimum=minimum,
        maximum=maximum,
        error_code="invalid_query_parameter",
    )


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
