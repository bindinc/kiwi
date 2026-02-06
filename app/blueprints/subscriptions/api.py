from __future__ import annotations

from flask import Blueprint, request

from blueprints.api.request_helpers import get_actor_id, get_correlation_id
from services.orchestration.subscription_orchestrator import SubscriptionOrchestrator


BLUEPRINT_NAME = "subscriptions_api"
URL_PREFIX = "/subscriptions"

subscriptions_api_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
_orchestrator = SubscriptionOrchestrator()


def _extract_request_id(payload: dict) -> str | None:
    body_request_id = payload.get("requestId")
    if body_request_id:
        return str(body_request_id)

    idempotency_key = request.headers.get("Idempotency-Key")
    if idempotency_key:
        return idempotency_key

    return None


@subscriptions_api_bp.post("")
def create_subscription() -> tuple[dict, int]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return {"error": {"message": "Expected JSON object body"}}, 400

    request_id = _extract_request_id(payload)
    if not request_id:
        return {
            "error": {
                "message": "Missing requestId in body or Idempotency-Key header",
            }
        }, 400

    normalized_payload = dict(payload)
    normalized_payload.pop("requestId", None)

    response = _orchestrator.submit(
        request_id=request_id,
        payload=normalized_payload,
        actor_id=get_actor_id(),
        correlation_id=get_correlation_id(),
    )

    return response.payload, response.http_status


@subscriptions_api_bp.get("/requests/<request_id>")
def get_subscription_request_status(request_id: str) -> tuple[dict, int]:
    response = _orchestrator.get_request_status(request_id)
    return response.payload, response.http_status
