from __future__ import annotations

from typing import Any

import requests
from flask import Blueprint, request

from blueprints.api.request_helpers import get_actor_id, get_correlation_id
from db.repositories.audit_events import AuditEventsRepository
from services.hup.ppa.customer_service import PpaCustomerService
from utils.logging_config import redact_sensitive_data


BLUEPRINT_NAME = "customers_api"
URL_PREFIX = "/customers"

customers_api_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)
_customer_service = PpaCustomerService()
_audit_repo = AuditEventsRepository()


def _parse_bool(value: str | None, default_value: bool = False) -> bool:
    if value is None:
        return default_value
    return value.lower() in {"true", "1", "yes", "y"}


def _build_search_filters() -> dict[str, Any]:
    filters: dict[str, Any] = {}

    string_keys = [
        "name",
        "firstname",
        "postcode",
        "houseno",
        "phone",
        "email",
        "city",
    ]

    for key in string_keys:
        value = request.args.get(key)
        if value:
            filters[key] = value

    for key in ["page", "pagesize"]:
        value = request.args.get(key)
        if value:
            try:
                filters[key] = int(value)
            except ValueError:
                continue

    if "exactmatch" in request.args:
        filters["exactmatch"] = _parse_bool(request.args.get("exactmatch"))

    return filters


def _error_response(exc: Exception) -> tuple[dict, int]:
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        status_code = exc.response.status_code
        if exc.response.content:
            try:
                payload = exc.response.json()
            except ValueError:
                payload = {"message": str(exc)}
        else:
            payload = {"message": str(exc)}

        return {"error": payload}, status_code

    return {"error": {"message": str(exc)}}, 500


@customers_api_bp.get("/search")
def search_customers() -> tuple[dict, int]:
    filters = _build_search_filters()

    try:
        payload = _customer_service.search(filters)
    except Exception as exc:  # pragma: no cover - exercised by integration tests
        return _error_response(exc)

    return payload, 200


@customers_api_bp.get("/<person_id>")
def get_customer(person_id: str) -> tuple[dict, int]:
    try:
        customer = _customer_service.get_customer(person_id)
    except Exception as exc:  # pragma: no cover - exercised by integration tests
        return _error_response(exc)

    return {"customer": customer}, 200


@customers_api_bp.patch("/<person_id>")
def patch_customer(person_id: str) -> tuple[dict, int]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return {"error": {"message": "Expected JSON object body"}}, 400

    correlation_id = get_correlation_id()
    actor_id = get_actor_id()

    try:
        result = _customer_service.update_customer(person_id, payload)
    except Exception as exc:  # pragma: no cover - exercised by integration tests
        return _error_response(exc)

    _audit_repo.append_event(
        event_type="customer.updated",
        actor_id=actor_id,
        entity_type="person",
        entity_id=person_id,
        request_id=None,
        correlation_id=correlation_id,
        before_redacted=redact_sensitive_data(result.before),
        after_redacted=redact_sensitive_data(result.after),
        metadata_json={"updatedFields": result.updated_fields},
    )

    return {
        "customer": result.after,
        "updatedFields": result.updated_fields,
    }, 200
