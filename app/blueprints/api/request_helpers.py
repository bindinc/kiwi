"""Request-scoped helper functions for API handlers."""

from __future__ import annotations

from flask import g, request, session


def get_correlation_id() -> str:
    correlation_id = getattr(g, "correlation_id", None)
    if correlation_id:
        return str(correlation_id)

    header_value = request.headers.get("X-Correlation-Id")
    return header_value or "unknown-correlation-id"


def get_actor_id() -> str | None:
    profile = session.get("oidc_auth_profile", {})
    if not isinstance(profile, dict):
        return None

    return profile.get("email") or profile.get("preferred_username")
