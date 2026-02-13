from __future__ import annotations

import json
from urllib.parse import urljoin

import requests

from .classifier import DispatchOutcome, classify_http_status, classify_request_exception, delivered
from .settings import (
    get_mutation_dispatch_timeout_seconds,
    get_mutation_target_base_url,
    is_mutation_dispatch_dry_run_enabled,
)


def _build_request(command_type: str, payload: dict) -> tuple[str, str, dict] | None:
    customer_id = payload.get("customerId")
    subscription_id = payload.get("subscriptionId")
    request_payload = payload.get("request") if isinstance(payload.get("request"), dict) else {}

    if command_type == "subscription.signup":
        return "POST", "/api/v1/workflows/subscription-signup", request_payload

    if command_type == "subscription.update":
        if customer_id is None or subscription_id is None:
            return None
        return "PATCH", f"/api/v1/subscriptions/{int(customer_id)}/{int(subscription_id)}", request_payload

    if command_type == "subscription.cancel":
        if customer_id is None or subscription_id is None:
            return None
        return "POST", f"/api/v1/subscriptions/{int(customer_id)}/{int(subscription_id)}", request_payload

    if command_type == "subscription.deceased_actions":
        if customer_id is None:
            return None
        return "POST", f"/api/v1/subscriptions/{int(customer_id)}/deceased-actions", request_payload

    return None


def dispatch_mutation(job: dict) -> DispatchOutcome:
    command_type = str(job.get("command_type") or "")
    payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}

    if is_mutation_dispatch_dry_run_enabled():
        return delivered(200)

    request_definition = _build_request(command_type, payload)
    if request_definition is None:
        return DispatchOutcome(
            success=False,
            retryable=False,
            failure_class="manual_review_required",
            error_code="invalid_command_payload",
            error_message=f"Unsupported command payload for {command_type}",
        )

    target_base_url = get_mutation_target_base_url()
    if not target_base_url:
        return DispatchOutcome(
            success=False,
            retryable=False,
            failure_class="manual_review_required",
            error_code="target_unconfigured",
            error_message="MUTATION_TARGET_BASE_URL is not configured",
        )

    method, path, request_payload = request_definition
    request_url = urljoin(target_base_url.rstrip("/") + "/", path.lstrip("/"))

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Mutation-Id": str(job.get("id") or ""),
    }

    client_request_id = job.get("client_request_id")
    if client_request_id:
        headers["Idempotency-Key"] = str(client_request_id)

    timeout_seconds = get_mutation_dispatch_timeout_seconds()

    try:
        response = requests.request(
            method=method,
            url=request_url,
            headers=headers,
            json=request_payload,
            timeout=timeout_seconds,
        )
    except Exception as error:  # noqa: BLE001
        return classify_request_exception(error)

    response_text = response.text
    if response_text:
        response_text = response_text[:1000]

    parsed_message = response_text
    if response.headers.get("content-type", "").startswith("application/json") and response_text:
        try:
            parsed_json = json.loads(response_text)
            if isinstance(parsed_json, dict):
                error_payload = parsed_json.get("error")
                if isinstance(error_payload, dict) and error_payload.get("message"):
                    parsed_message = str(error_payload.get("message"))
                elif parsed_json.get("message"):
                    parsed_message = str(parsed_json.get("message"))
        except ValueError:
            pass

    return classify_http_status(response.status_code, parsed_message)
