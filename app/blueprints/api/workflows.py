from __future__ import annotations

from flask import Blueprint, request, session

from blueprints.api.common import api_error, parse_int_value
from services import poc_catalog, poc_state

BLUEPRINT_NAME = "workflows_api"
URL_PREFIX = "/workflows"

workflows_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


def _build_subscription(state: dict, payload: dict) -> dict:
    return {
        "id": payload.get("id") or poc_state.next_subscription_id(state),
        "magazine": payload.get("magazine"),
        "duration": payload.get("duration"),
        "durationLabel": payload.get("durationLabel"),
        "startDate": payload.get("startDate"),
        "status": payload.get("status", "active"),
        "lastEdition": payload.get("lastEdition") or poc_state.utc_today_iso(),
    }


@workflows_bp.post("/subscription-signup")
def create_subscription_signup() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    customer_id_raw = payload.get("customerId")
    customer_payload = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    subscription_payload = payload.get("subscription") if isinstance(payload.get("subscription"), dict) else {}
    contact_entry = payload.get("contactEntry") if isinstance(payload.get("contactEntry"), dict) else None

    if not subscription_payload:
        return api_error(400, "invalid_payload", "subscription payload is required")

    state = poc_state.get_state(session)
    customer = None
    created_customer = False

    customer_id, customer_id_error = parse_int_value(
        customer_id_raw,
        field_name="customerId",
        required=False,
        minimum=1,
    )
    if customer_id_error:
        return customer_id_error

    if customer_id is not None:
        customer = poc_state.find_customer(state, customer_id)
        if customer is None:
            return api_error(404, "customer_not_found", "Customer not found")
    else:
        if not customer_payload:
            return api_error(400, "invalid_payload", "customer payload is required when customerId is not provided")
        customer = poc_state.create_customer(state, customer_payload)
        created_customer = True

    subscription = _build_subscription(state, subscription_payload)
    customer.setdefault("subscriptions", []).append(subscription)

    if contact_entry:
        poc_state.append_contact_history(state, int(customer["id"]), contact_entry)

    session.modified = True
    return {
        "customer": customer,
        "subscription": subscription,
        "createdCustomer": created_customer,
    }, 201


@workflows_bp.post("/article-order")
def create_article_order() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    customer_id_raw = payload.get("customerId")
    customer_payload = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    order_payload = payload.get("order") if isinstance(payload.get("order"), dict) else {}

    if not order_payload:
        return api_error(400, "invalid_payload", "order payload is required")

    items = order_payload.get("items") if isinstance(order_payload.get("items"), list) else []
    quote = poc_catalog.quote_article_order(items, order_payload.get("couponCode"))

    state = poc_state.get_state(session)
    customer = None
    created_customer = False

    customer_id, customer_id_error = parse_int_value(
        customer_id_raw,
        field_name="customerId",
        required=False,
        minimum=1,
    )
    if customer_id_error:
        return customer_id_error

    if customer_id is not None:
        customer = poc_state.find_customer(state, customer_id)
        if customer is None:
            return api_error(404, "customer_not_found", "Customer not found")
    else:
        if not customer_payload:
            return api_error(400, "invalid_payload", "customer payload is required when customerId is not provided")
        customer = poc_state.create_customer(state, customer_payload)
        created_customer = True

    order_id = order_payload.get("id") or poc_state.next_article_order_id(state)
    order = {
        "id": order_id,
        "orderDate": order_payload.get("orderDate") or poc_state.utc_today_iso(),
        "desiredDeliveryDate": order_payload.get("desiredDeliveryDate"),
        "deliveryStatus": order_payload.get("deliveryStatus", "ordered"),
        "trackingNumber": order_payload.get("trackingNumber"),
        "paymentStatus": order_payload.get("paymentStatus", "paid"),
        "paymentMethod": order_payload.get("paymentMethod", "iDEAL"),
        "paymentDate": order_payload.get("paymentDate") or poc_state.utc_today_iso(),
        "actualDeliveryDate": order_payload.get("actualDeliveryDate"),
        "returnDeadline": order_payload.get("returnDeadline"),
        "notes": order_payload.get("notes", ""),
        "items": quote["items"],
        "subtotal": quote["subtotal"],
        "discounts": quote["discounts"],
        "totalDiscount": quote["totalDiscount"],
        "total": quote["total"],
        "couponCode": quote.get("couponCode"),
    }

    customer.setdefault("articles", []).append(order)

    contact_entry = payload.get("contactEntry") if isinstance(payload.get("contactEntry"), dict) else None
    if contact_entry:
        poc_state.append_contact_history(state, int(customer["id"]), contact_entry)

    session.modified = True
    return {
        "customer": customer,
        "order": order,
        "createdCustomer": created_customer,
    }, 201
