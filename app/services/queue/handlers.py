"""Default queue job handlers."""

from __future__ import annotations

import os
from typing import Any

from services.hup.webabo.subscription_gateway import (
    RetryableUpstreamError,
    ValidationUpstreamError,
    WebAboSubscriptionGateway,
)
from services.queue.errors import NonRetryableJobError, RetryableJobError


def build_default_handlers() -> dict[str, Any]:
    """Build production handlers for known queue job types."""

    gateway = WebAboSubscriptionGateway()
    timeout_ms = int(os.environ.get("KIWI_SYNC_SUBSCRIPTION_TIMEOUT_MS", "2500"))

    def handle_subscription_create(job: dict[str, Any]) -> dict[str, Any]:
        payload_json = job.get("payload_json") or {}
        subscription_payload = payload_json.get("subscriptionPayload") or payload_json

        try:
            response = gateway.create_subscription(subscription_payload, timeout_ms=timeout_ms)
        except RetryableUpstreamError as exc:
            raise RetryableJobError(str(exc)) from exc
        except ValidationUpstreamError as exc:
            raise NonRetryableJobError(exc.message) from exc

        return response

    return {
        "subscription_create": handle_subscription_create,
    }
