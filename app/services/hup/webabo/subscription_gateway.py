"""WebAbo subscription gateway with retry-aware error mapping."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

from services.hup.webabo.service_factory import subscription_service


class RetryableUpstreamError(RuntimeError):
    """Temporary error category that should be retried."""


@dataclass(frozen=True)
class ValidationUpstreamError(RuntimeError):
    """Validation/business error category that should not be retried."""

    message: str
    status_code: int
    details: dict[str, Any] | None


class WebAboSubscriptionGateway:
    """Executes direct subscription create requests against WebAbo."""

    def create_subscription(self, payload: dict[str, Any], *, timeout_ms: int) -> dict[str, Any]:
        service = subscription_service()
        service.update_auth_header()

        try:
            response = service.session.post(
                f"{service.base_url}/subscriptions",
                json=payload,
                timeout=max(timeout_ms / 1000, 0.1),
            )
        except requests.Timeout as exc:
            raise RetryableUpstreamError("WebAbo subscription request timed out") from exc
        except requests.RequestException as exc:
            raise RetryableUpstreamError("WebAbo subscription request failed") from exc

        response_payload: dict[str, Any] | None = None
        if response.content:
            try:
                response_payload = response.json()
            except ValueError:
                response_payload = None

        if response.status_code >= 500 or response.status_code in {408, 429}:
            raise RetryableUpstreamError(
                f"WebAbo returned retryable status code {response.status_code}"
            )

        if response.status_code >= 400:
            message = "WebAbo rejected subscription payload"
            if isinstance(response_payload, dict) and response_payload.get("message"):
                message = str(response_payload.get("message"))

            raise ValidationUpstreamError(
                message=message,
                status_code=response.status_code,
                details=response_payload,
            )

        return response_payload or {}
