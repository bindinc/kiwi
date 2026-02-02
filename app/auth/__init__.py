import base64
import json
from typing import Iterable, List, Optional
from urllib.parse import urlparse

import requests

ALLOWED_ROLES = {
    "bink8s.app.kiwi.supervisor",
    "bink8s.app.kiwi.user",
    "bink8s.app.kiwi.dev",
    "bink8s.app.kiwi.admin",
    "bink8s.app.kiwi.view",
}


def normalize_base_path(value: Optional[str]) -> str:
    if not value or value == "/":
        return ""
    value = value.strip()
    if not value:
        return ""
    if not value.startswith("/"):
        value = "/" + value
    return value.rstrip("/")


def get_redirect_uri_from_secrets(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

    redirect_uris = data.get("web", {}).get("redirect_uris", [])
    if not isinstance(redirect_uris, list) or not redirect_uris:
        return None
    return redirect_uris[0]


def get_callback_route(redirect_uri: Optional[str]) -> Optional[str]:
    if not redirect_uri:
        return None
    parsed = urlparse(redirect_uri)
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = "/" + path
    segments = [segment for segment in path.split("/") if segment]
    if len(segments) > 2:
        return "/" + "/".join(segments[-2:])
    return path


def build_oidc_redirect_uri(host_url: Optional[str], script_root: Optional[str]) -> Optional[str]:
    if not host_url:
        return None
    base_url = host_url.rstrip("/")
    if not base_url:
        return None

    prefix = normalize_base_path(script_root)
    if prefix:
        return f"{base_url}{prefix}/auth/callback"
    return f"{base_url}/auth/callback"


def decode_jwt_payload(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding

        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except (ValueError, json.JSONDecodeError):
        return None


def get_user_roles(session_data: dict) -> List[str]:
    roles: List[str] = []

    token_data = session_data.get("oidc_auth_token")
    if isinstance(token_data, dict):
        id_token = token_data.get("id_token")
        if id_token:
            id_token_claims = decode_jwt_payload(id_token)
            if id_token_claims:
                roles = id_token_claims.get("roles", []) or []
        if not roles:
            roles = token_data.get("roles", []) or []

    if not roles:
        profile = session_data.get("oidc_auth_profile")
        if isinstance(profile, dict):
            roles = profile.get("roles", []) or []

    if isinstance(roles, str):
        roles = [roles]
    return list(roles)


def user_has_access(roles: Iterable[str]) -> bool:
    role_set = set(roles)
    return any(role in role_set for role in ALLOWED_ROLES)


def build_user_identity(profile: Optional[dict]) -> dict:
    profile = profile or {}

    first_name = (profile.get("given_name") or profile.get("first_name") or "").strip()
    last_name = (profile.get("family_name") or profile.get("last_name") or "").strip()

    display_name = " ".join(part for part in [first_name, last_name] if part).strip()
    fallback_name = (profile.get("name") or "").strip()

    if not display_name and fallback_name:
        display_name = fallback_name

    if display_name and (not first_name or not last_name):
        parts = display_name.split()
        if parts:
            first_name = first_name or parts[0]
            if len(parts) > 1:
                last_name = last_name or parts[-1]

    display_name = " ".join(part for part in [first_name, last_name] if part).strip() or display_name
    if not display_name:
        display_name = profile.get("preferred_username") or profile.get("email") or "Onbekende gebruiker"

    initials = "".join(part[0] for part in [first_name, last_name] if part).upper()
    if not initials and display_name:
        initials = display_name[0].upper()

    return {
        "first_name": first_name,
        "last_name": last_name,
        "full_name": display_name,
        "initials": initials,
        "email": profile.get("email") or profile.get("preferred_username"),
    }


def get_access_token(session_data: dict) -> Optional[str]:
    token_data = session_data.get("oidc_auth_token")
    if isinstance(token_data, dict):
        return token_data.get("access_token")
    return None


def fetch_profile_image(access_token: str, http_get=requests.get) -> Optional[str]:
    try:
        response = http_get(
            "https://graph.microsoft.com/v1.0/me/photo/$value",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5,
        )
    except requests.RequestException:
        return None

    if response.status_code != 200:
        return None

    content_type = response.headers.get("Content-Type", "image/jpeg")
    photo_base64 = base64.b64encode(response.content).decode("utf-8")
    return f"data:{content_type};base64,{photo_base64}"


def get_profile_image(session_data: dict, http_get=requests.get) -> Optional[str]:
    cached = session_data.get("oidc_profile_photo")
    if cached:
        return cached

    access_token = get_access_token(session_data)
    if not access_token:
        return None

    data_url = fetch_profile_image(access_token, http_get=http_get)
    if data_url:
        session_data["oidc_profile_photo"] = data_url
    return data_url
