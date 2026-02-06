import logging
from typing import Callable, Optional
from urllib.parse import quote

import requests

import auth

GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0"

READ_SCOPES = {
    "Presence.Read",
    "Presence.Read.All",
    "Presence.ReadWrite",
    "Presence.ReadWrite.All",
}
WRITE_SCOPES = {
    "Presence.ReadWrite",
    "Presence.ReadWrite.All",
}

KIWI_TO_TEAMS_PREFERRED_PRESENCE = {
    "ready": {"availability": "Available", "activity": "Available", "expirationDuration": "PT8H"},
    "break": {"availability": "Away", "activity": "Away", "expirationDuration": "PT4H"},
    "away": {"availability": "Away", "activity": "Away", "expirationDuration": "PT4H"},
    "brb": {"availability": "BeRightBack", "activity": "BeRightBack", "expirationDuration": "PT2H"},
    "dnd": {
        "availability": "DoNotDisturb",
        "activity": "DoNotDisturb",
        "expirationDuration": "PT4H",
    },
    "offline": {"availability": "Offline", "activity": "OffWork", "expirationDuration": "PT8H"},
    "busy": {"availability": "Busy", "activity": "Busy", "expirationDuration": "PT4H"},
    "acw": {"availability": "Busy", "activity": "Busy", "expirationDuration": "PT30M"},
}
KIWI_TO_TEAMS_SESSION_PRESENCE = {
    "in_call": {"availability": "Busy", "activity": "InACall", "expirationDuration": "PT4H"},
}

logger = logging.getLogger(__name__)


def is_presence_sync_enabled(app_config: dict) -> bool:
    raw_value = app_config.get("TEAMS_PRESENCE_SYNC_ENABLED", True)

    if isinstance(raw_value, bool):
        return raw_value
    if isinstance(raw_value, str):
        normalized = raw_value.strip().lower()
        return normalized not in {"", "0", "false", "no", "off"}

    return bool(raw_value)


def get_sync_capability(session_data: dict, app_config: dict) -> dict:
    feature_enabled = is_presence_sync_enabled(app_config)
    issuer = auth.get_oidc_issuer(session_data)
    is_microsoft_session = auth.is_microsoft_issuer(issuer)
    access_token = auth.get_access_token(session_data)
    token_scopes = auth.get_token_scopes(session_data)

    has_read_scope = any(scope in token_scopes for scope in READ_SCOPES)
    has_write_scope = any(scope in token_scopes for scope in WRITE_SCOPES)

    reason = None
    if not feature_enabled:
        reason = "feature_disabled"
    elif not is_microsoft_session:
        reason = "unsupported_identity_provider"
    elif not access_token:
        reason = "missing_access_token"
    elif not has_read_scope and not has_write_scope:
        reason = "missing_presence_scope"
    elif not has_read_scope:
        reason = "missing_presence_read_scope"
    elif not has_write_scope:
        reason = "missing_presence_write_scope"

    return {
        "enabled": feature_enabled,
        "issuer": issuer,
        "is_microsoft_session": is_microsoft_session,
        "has_access_token": bool(access_token),
        "can_read": feature_enabled and is_microsoft_session and bool(access_token) and has_read_scope,
        "can_write": feature_enabled and is_microsoft_session and bool(access_token) and has_write_scope,
        "reason": reason,
    }


def get_graph_user_identifier(session_data: dict) -> Optional[str]:
    access_claims = auth.get_access_token_claims(session_data) or {}
    id_claims = auth.get_id_token_claims(session_data) or {}
    profile = session_data.get("oidc_auth_profile") if isinstance(session_data.get("oidc_auth_profile"), dict) else {}

    candidates = [
        access_claims.get("oid"),
        id_claims.get("oid"),
        profile.get("oid"),
        access_claims.get("preferred_username"),
        id_claims.get("preferred_username"),
        profile.get("preferred_username"),
        profile.get("email"),
    ]

    for value in candidates:
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def get_presence_session_id(session_data: dict, app_config: dict) -> Optional[str]:
    configured_session_id = app_config.get("TEAMS_PRESENCE_SESSION_ID")
    if isinstance(configured_session_id, str) and configured_session_id.strip():
        return configured_session_id.strip()

    oidc_client_id = app_config.get("OIDC_CLIENT_ID")
    if isinstance(oidc_client_id, str) and oidc_client_id.strip():
        return oidc_client_id.strip()

    access_claims = auth.get_access_token_claims(session_data) or {}
    id_claims = auth.get_id_token_claims(session_data) or {}

    candidate_values = [
        access_claims.get("azp"),
        access_claims.get("appid"),
        id_claims.get("azp"),
        id_claims.get("appid"),
    ]
    for value in candidate_values:
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def map_kiwi_status_to_teams_preferred_presence(status: str) -> Optional[dict]:
    mapping = KIWI_TO_TEAMS_PREFERRED_PRESENCE.get(status)
    if not mapping:
        return None
    return dict(mapping)


def map_kiwi_status_to_teams_session_presence(status: str) -> Optional[dict]:
    mapping = KIWI_TO_TEAMS_SESSION_PRESENCE.get(status)
    if not mapping:
        return None
    return dict(mapping)


def map_teams_presence_to_kiwi_status(availability: Optional[str], activity: Optional[str]) -> Optional[str]:
    normalized_availability = (availability or "").strip().lower()
    normalized_activity = (activity or "").strip().lower()

    if normalized_availability == "donotdisturb":
        return "dnd"

    if normalized_availability == "berightback":
        return "brb"

    if normalized_availability in {"away", "outofoffice"}:
        return "away"

    if normalized_availability == "offline":
        return "offline"

    if normalized_activity in {"offwork"}:
        return "offline"

    if normalized_activity in {"outofoffice"}:
        return "away"

    if normalized_activity in {"inacall", "inaconferencecall"}:
        return "in_call"

    if normalized_activity in {"inameeting", "presenting", "urgentinterruptionsonly"}:
        return "busy"

    availability_mapping = {
        "available": "ready",
        "busy": "busy",
    }

    mapped_status = availability_mapping.get(normalized_availability)
    if mapped_status:
        return mapped_status

    return None


def sync_kiwi_status_to_teams(
    kiwi_status: str,
    session_data: dict,
    app_config: dict,
    http_post: Callable = requests.post,
) -> dict:
    capability = get_sync_capability(session_data, app_config)
    if not capability["can_write"]:
        return {
            "attempted": False,
            "synced": False,
            "reason": capability["reason"] or "write_scope_unavailable",
            "capability": capability,
        }

    user_identifier = get_graph_user_identifier(session_data)
    if not user_identifier:
        return {
            "attempted": False,
            "synced": False,
            "reason": "missing_user_identifier",
            "capability": capability,
        }

    access_token = auth.get_access_token(session_data)
    encoded_identifier = quote(user_identifier, safe="")
    request_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    if kiwi_status == "in_call":
        session_presence_payload = map_kiwi_status_to_teams_session_presence(kiwi_status)
        if not session_presence_payload:
            return {
                "attempted": False,
                "synced": False,
                "reason": "unsupported_kiwi_status",
                "capability": capability,
            }

        session_id = get_presence_session_id(session_data, app_config)
        if not session_id:
            return {
                "attempted": False,
                "synced": False,
                "reason": "missing_presence_session_id",
                "capability": capability,
            }

        clear_preferred_endpoint = (
            f"{GRAPH_API_BASE_URL}/users/{encoded_identifier}/presence/clearUserPreferredPresence"
        )
        clear_preferred_status = None

        try:
            clear_preferred_response = http_post(
                clear_preferred_endpoint,
                headers=request_headers,
                json={},
                timeout=5,
            )
            clear_preferred_status = clear_preferred_response.status_code
        except requests.RequestException as exc:
            logger.warning("Failed to clear user preferred presence before in-call sync: %s", exc)

        session_endpoint = f"{GRAPH_API_BASE_URL}/users/{encoded_identifier}/presence/setPresence"
        session_payload = dict(session_presence_payload)
        session_payload["sessionId"] = session_id

        try:
            response = http_post(
                session_endpoint,
                headers=request_headers,
                json=session_payload,
                timeout=5,
            )
        except requests.RequestException as exc:
            logger.warning("Failed to sync in-call Teams presence: %s", exc)
            return {
                "attempted": True,
                "synced": False,
                "reason": "request_failed",
                "capability": capability,
                "mode": "session",
                "clear_preferred_status": clear_preferred_status,
            }

        is_success = response.status_code in {200, 204}
        if not is_success:
            logger.warning(
                "Teams in-call presence update failed (status=%s, reason=%s)",
                response.status_code,
                response.text[:200],
            )

        return {
            "attempted": True,
            "synced": is_success,
            "reason": None if is_success else "graph_update_failed",
            "http_status": response.status_code,
            "capability": capability,
            "mode": "session",
            "clear_preferred_status": clear_preferred_status,
        }

    presence_payload = map_kiwi_status_to_teams_preferred_presence(kiwi_status)
    if not presence_payload:
        return {
            "attempted": False,
            "synced": False,
            "reason": "unsupported_kiwi_status",
            "capability": capability,
        }

    clear_presence_status = None
    session_id = get_presence_session_id(session_data, app_config)
    if session_id:
        clear_presence_endpoint = f"{GRAPH_API_BASE_URL}/users/{encoded_identifier}/presence/clearPresence"
        try:
            clear_presence_response = http_post(
                clear_presence_endpoint,
                headers=request_headers,
                json={"sessionId": session_id},
                timeout=5,
            )
            clear_presence_status = clear_presence_response.status_code
        except requests.RequestException as exc:
            logger.warning("Failed to clear session presence before preferred update: %s", exc)

    endpoint = f"{GRAPH_API_BASE_URL}/users/{encoded_identifier}/presence/setUserPreferredPresence"

    try:
        response = http_post(
            endpoint,
            headers=request_headers,
            json=presence_payload,
            timeout=5,
        )
    except requests.RequestException as exc:
        logger.warning("Failed to sync Teams presence for Kiwi status %s: %s", kiwi_status, exc)
        return {
            "attempted": True,
            "synced": False,
            "reason": "request_failed",
            "capability": capability,
            "mode": "preferred",
            "clear_presence_status": clear_presence_status,
        }

    is_success = response.status_code in {200, 204}
    if not is_success:
        logger.warning(
            "Teams presence update failed (status=%s, reason=%s)",
            response.status_code,
            response.text[:200],
        )

    return {
        "attempted": True,
        "synced": is_success,
        "reason": None if is_success else "graph_update_failed",
        "http_status": response.status_code,
        "capability": capability,
        "mode": "preferred",
        "clear_presence_status": clear_presence_status,
    }


def fetch_teams_presence_status(
    session_data: dict,
    app_config: dict,
    http_get: Callable = requests.get,
) -> dict:
    capability = get_sync_capability(session_data, app_config)
    if not capability["can_read"]:
        return {
            "attempted": False,
            "status": None,
            "reason": capability["reason"] or "read_scope_unavailable",
            "capability": capability,
        }

    access_token = auth.get_access_token(session_data)
    endpoint = f"{GRAPH_API_BASE_URL}/me/presence"

    try:
        response = http_get(
            endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5,
        )
    except requests.RequestException as exc:
        logger.warning("Failed to fetch Teams presence: %s", exc)
        return {
            "attempted": True,
            "status": None,
            "reason": "request_failed",
            "capability": capability,
        }

    if response.status_code != 200:
        return {
            "attempted": True,
            "status": None,
            "reason": "graph_read_failed",
            "http_status": response.status_code,
            "capability": capability,
        }

    try:
        payload = response.json()
    except ValueError:
        return {
            "attempted": True,
            "status": None,
            "reason": "invalid_graph_response",
            "capability": capability,
        }

    availability = payload.get("availability")
    activity = payload.get("activity")
    mapped_status = map_teams_presence_to_kiwi_status(availability, activity)

    return {
        "attempted": True,
        "status": mapped_status,
        "availability": availability,
        "activity": activity,
        "reason": None if mapped_status else "unmapped_presence",
        "capability": capability,
    }
