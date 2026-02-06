import base64
import json
from typing import Iterable, List, Optional, Set
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests

ALLOWED_ROLES = {
    "bink8s.app.kiwi.supervisor",
    "bink8s.app.kiwi.user",
    "bink8s.app.kiwi.dev",
    "bink8s.app.kiwi.admin",
    "bink8s.app.kiwi.view",
}

MICROSOFT_ISSUER_HOSTS = {
    "login.microsoftonline.com",
    "sts.windows.net",
    "login.windows.net",
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
    redirect_uris = get_redirect_uris_from_secrets(path)
    if not redirect_uris:
        return None
    return redirect_uris[0]


def get_redirect_uris_from_secrets(path: str) -> List[str]:
    if not path:
        return []

    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []

    redirect_uris = data.get("web", {}).get("redirect_uris", [])
    if not isinstance(redirect_uris, list):
        return []

    return [uri for uri in redirect_uris if isinstance(uri, str) and uri.strip()]


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


def get_id_token(session_data: dict) -> Optional[str]:
    token_data = session_data.get("oidc_auth_token")
    if isinstance(token_data, dict):
        return token_data.get("id_token")
    return None


def get_id_token_claims(session_data: dict) -> Optional[dict]:
    id_token = get_id_token(session_data)
    if not id_token:
        return None
    return decode_jwt_payload(id_token)


def get_access_token_claims(session_data: dict) -> Optional[dict]:
    access_token = get_access_token(session_data)
    if not access_token:
        return None
    return decode_jwt_payload(access_token)


def get_oidc_issuer(session_data: dict) -> Optional[str]:
    id_token_claims = get_id_token_claims(session_data)
    if id_token_claims and isinstance(id_token_claims.get("iss"), str):
        issuer = id_token_claims["iss"].strip()
        if issuer:
            return issuer

    access_token_claims = get_access_token_claims(session_data)
    if access_token_claims and isinstance(access_token_claims.get("iss"), str):
        issuer = access_token_claims["iss"].strip()
        if issuer:
            return issuer

    profile = session_data.get("oidc_auth_profile")
    if isinstance(profile, dict):
        issuer = profile.get("iss")
        if isinstance(issuer, str) and issuer.strip():
            return issuer.strip()

    return None


def is_microsoft_issuer(issuer: Optional[str]) -> bool:
    if not issuer:
        return False

    parsed_issuer = urlparse(issuer)
    issuer_host = (parsed_issuer.hostname or "").lower()
    if not issuer_host:
        return False

    if issuer_host in MICROSOFT_ISSUER_HOSTS:
        return True

    return issuer_host.endswith(".microsoftonline.com")


def get_token_scopes(session_data: dict) -> Set[str]:
    scopes: Set[str] = set()

    token_data = session_data.get("oidc_auth_token")
    if isinstance(token_data, dict):
        raw_scope = token_data.get("scope")
        if isinstance(raw_scope, str):
            scopes.update(scope for scope in raw_scope.split() if scope)
        elif isinstance(raw_scope, list):
            scopes.update(scope for scope in raw_scope if isinstance(scope, str) and scope)

    access_token_claims = get_access_token_claims(session_data)
    if access_token_claims:
        access_scope = access_token_claims.get("scp")
        if isinstance(access_scope, str):
            scopes.update(scope for scope in access_scope.split() if scope)

    return scopes


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


def get_oidc_end_session_endpoint(
    server_metadata_url: Optional[str], http_get=requests.get
) -> Optional[str]:
    if not server_metadata_url:
        return None

    try:
        response = http_get(server_metadata_url, timeout=5)
    except requests.RequestException:
        return None

    if response.status_code != 200:
        return None

    try:
        metadata = response.json()
    except ValueError:
        return None

    endpoint = metadata.get("end_session_endpoint")
    if isinstance(endpoint, str) and endpoint.strip():
        return endpoint

    return None


def build_end_session_logout_url(
    end_session_endpoint: Optional[str],
    post_logout_redirect_uri: Optional[str] = None,
    id_token_hint: Optional[str] = None,
    client_id: Optional[str] = None,
) -> Optional[str]:
    if not end_session_endpoint:
        return None

    parsed_endpoint = urlparse(end_session_endpoint)
    if not parsed_endpoint.scheme or not parsed_endpoint.netloc:
        return None

    query = dict(parse_qsl(parsed_endpoint.query, keep_blank_values=True))
    if post_logout_redirect_uri:
        query["post_logout_redirect_uri"] = post_logout_redirect_uri

    if id_token_hint:
        query["id_token_hint"] = id_token_hint
    if client_id:
        query["client_id"] = client_id

    return urlunparse(parsed_endpoint._replace(query=urlencode(query)))
