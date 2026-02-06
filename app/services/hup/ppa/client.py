"""PPA HTTP client with authenticated request helpers."""

from __future__ import annotations

import os
from typing import Any

import requests

from services.hup.ppa.token_manager import PpaTokenManager


class PpaClient:
    """Thin wrapper around PPA person endpoints."""

    def __init__(
        self,
        *,
        token_manager: PpaTokenManager | None = None,
        session: requests.Session | None = None,
    ) -> None:
        self.token_manager = token_manager or PpaTokenManager()
        self.session = session or requests.Session()
        self.base_url = (os.environ.get("PPA_API_URL") or "").rstrip("/")
        self.verify_ssl = os.environ.get("PPA_API_VERIFY_SSL", "true").lower() == "true"

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        timeout_seconds: float = 10.0,
    ) -> dict[str, Any]:
        if not self.base_url:
            raise RuntimeError("PPA_API_URL is not configured")

        token = self.token_manager.get_access_token()
        url = f"{self.base_url}{path}"

        response = self.session.request(
            method=method,
            url=url,
            params=params,
            json=json_body,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            timeout=timeout_seconds,
            verify=self.verify_ssl,
        )
        response.raise_for_status()

        if not response.content:
            return {}

        return response.json()

    def search_persons(self, filters: dict[str, Any]) -> dict[str, Any]:
        return self._request("GET", "/public/personsearch", params=filters)

    def get_person(self, person_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/public/persons/{person_id}",
            params={"usenumberasid": "true"},
        )

    def patch_person(self, person_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/public/persons/{person_id}",
            params={"usenumberasid": "true"},
            json_body=payload,
        )

    def create_email(self, person_id: str, email_payload: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/public/persons/{person_id}/contacts/emails",
            params={"usenumberasid": "true"},
            json_body=email_payload,
        )

    def patch_email(self, person_id: str, resource_id: str, email_payload: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/public/persons/{person_id}/contacts/emails/{resource_id}",
            params={"usenumberasid": "true"},
            json_body=email_payload,
        )

    def create_phone(self, person_id: str, phone_payload: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/public/persons/{person_id}/contacts/phones",
            params={"usenumberasid": "true"},
            json_body=phone_payload,
        )

    def patch_phone(self, person_id: str, resource_id: str, phone_payload: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/public/persons/{person_id}/contacts/phones/{resource_id}",
            params={"usenumberasid": "true"},
            json_body=phone_payload,
        )

    def patch_address(self, person_id: str, resource_id: str, address_payload: dict[str, Any]) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/public/persons/{person_id}/contacts/addresses/{resource_id}",
            params={"usenumberasid": "true"},
            json_body=address_payload,
        )
