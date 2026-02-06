"""Token management for PPA upstream authentication."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import base64
import os

import requests


@dataclass(frozen=True)
class PpaAuthSettings:
    api_token_url: str | None
    client_secret: str | None
    username: str | None
    password: str | None


def load_auth_settings() -> PpaAuthSettings:
    return PpaAuthSettings(
        api_token_url=os.environ.get("PPA_API_TOKEN_URL"),
        client_secret=os.environ.get("PPA_API_CLIENT_SECRET"),
        username=os.environ.get("PPA_API_USERNAME"),
        password=os.environ.get("PPA_API_PASSWORD"),
    )


class PpaTokenManager:
    """Caches and refreshes PPA bearer tokens."""

    def __init__(self, session: requests.Session | None = None) -> None:
        self.session = session or requests.Session()
        self._access_token: str | None = None
        self._expires_at: datetime | None = None

    def get_access_token(self) -> str:
        now_utc = datetime.now(timezone.utc)
        if self._access_token and self._expires_at and now_utc < self._expires_at:
            return self._access_token

        settings = load_auth_settings()
        if (
            not settings.api_token_url
            or not settings.client_secret
            or not settings.username
            or not settings.password
        ):
            raise RuntimeError("Missing one or more required PPA auth environment variables")

        encoded_secret = base64.b64encode(settings.client_secret.encode("utf-8")).decode("utf-8")
        response = self.session.post(
            settings.api_token_url,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {encoded_secret}",
                "Accept": "application/json",
            },
            data={
                "grant_type": "password",
                "username": settings.username,
                "password": settings.password,
            },
            timeout=10,
        )
        response.raise_for_status()

        payload = response.json()
        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 60))

        if not token:
            raise RuntimeError("PPA token endpoint response did not include access_token")

        # Refresh one minute early to avoid edge cases around expiration.
        self._access_token = token
        self._expires_at = now_utc + timedelta(seconds=max(expires_in - 60, 1))
        return token
