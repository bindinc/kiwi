from __future__ import annotations

import copy

from flask import Blueprint, request, session

from blueprints.api.common import api_error, parse_int_value
from services import poc_catalog, poc_state

BLUEPRINT_NAME = "workflows_api"
URL_PREFIX = "/workflows"

workflows_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


def _build_subscription(state: dict, payload: dict, recipient_person_id: int, requester_person_id: int) -> dict:
    return {
        "id": payload.get("id") or poc_state.next_subscription_id(state),
        "magazine": payload.get("magazine"),
        "duration": payload.get("duration"),
        "durationLabel": payload.get("durationLabel"),
        "startDate": payload.get("startDate"),
        "status": payload.get("status", "active"),
        "lastEdition": payload.get("lastEdition") or poc_state.utc_today_iso(),
        "recipientPersonId": recipient_person_id,
        "requesterPersonId": requester_person_id,
    }


def _parse_role_payload(role_payload: object, *, role_name: str, allow_same_as_recipient: bool) -> tuple[dict | None, tuple[dict, int] | None]:
    if not isinstance(role_payload, dict):
        return None, api_error(400, "invalid_payload", f"{role_name} must be an object")

    has_person_id = role_payload.get("personId") not in (None, "")
    has_person_payload = isinstance(role_payload.get("person"), dict)
    has_same_as_recipient = bool(role_payload.get("sameAsRecipient")) if allow_same_as_recipient else False

    selected_modes = int(has_person_id) + int(has_person_payload) + int(has_same_as_recipient)
    if selected_modes != 1:
        allowed = "personId or person"
        if allow_same_as_recipient:
            allowed = "personId, person, or sameAsRecipient=true"
        return None, api_error(400, "invalid_payload", f"{role_name} must contain exactly one of {allowed}")

    if has_same_as_recipient:
        return {"mode": "same_as_recipient"}, None

    if has_person_id:
        person_id, person_id_error = parse_int_value(
            role_payload.get("personId"),
            field_name=f"{role_name}.personId",
            required=True,
            minimum=1,
        )
        if person_id_error:
            return None, person_id_error
        return {"mode": "existing", "person_id": person_id}, None

    person_payload = role_payload.get("person")
    if not isinstance(person_payload, dict) or not person_payload:
        return None, api_error(400, "invalid_payload", f"{role_name}.person must be a non-empty object")
    return {"mode": "new", "person_payload": person_payload}, None


def _resolve_existing_role_person(state: dict, role_spec: dict, *, role_name: str) -> tuple[dict | None, tuple[dict, int] | None]:
    if role_spec["mode"] != "existing":
        return None, None

    person = poc_state.find_customer(state, int(role_spec["person_id"]))
    if person is None:
        return None, api_error(404, "customer_not_found", f"{role_name} person not found")
    return person, None


def _build_signup_history_entries(
    *,
    subscription_payload: dict,
    recipient_id: int,
    requester_id: int,
    contact_entry: dict | None,
) -> tuple[dict, dict | None]:
    magazine = subscription_payload.get("magazine") or "Onbekend magazine"
    duration = subscription_payload.get("durationLabel") or subscription_payload.get("duration") or "onbekende looptijd"

    if contact_entry:
        recipient_entry = copy.deepcopy(contact_entry)
        recipient_entry.setdefault("type", "Nieuw abonnement")
        base_description = str(recipient_entry.get("description", "")).strip()
    else:
        recipient_entry = {"type": "Nieuw abonnement"}
        base_description = f"Abonnement {magazine} ({duration}) aangemaakt."

    if requester_id != recipient_id:
        if base_description:
            recipient_entry["description"] = f"{base_description} Aangevraagd/betaald door persoon #{requester_id}."
        else:
            recipient_entry["description"] = f"Aangevraagd/betaald door persoon #{requester_id}."
        requester_entry = {
            "type": "Abonnement aangevraagd",
            "description": f"Abonnement {magazine} ({duration}) aangevraagd/betaald voor persoon #{recipient_id}.",
        }
        return recipient_entry, requester_entry

    recipient_entry["description"] = base_description
    return recipient_entry, None


@workflows_bp.post("/subscription-signup")
def create_subscription_signup() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    if "customerId" in payload or "customer" in payload:
        return api_error(
            400,
            "invalid_payload",
            "Legacy customerId/customer payload is not supported; use recipient/requester instead",
        )

    recipient_raw = payload.get("recipient")
    requester_raw = payload.get("requester")
    subscription_payload = payload.get("subscription") if isinstance(payload.get("subscription"), dict) else {}
    contact_entry = payload.get("contactEntry") if isinstance(payload.get("contactEntry"), dict) else None

    if not subscription_payload:
        return api_error(400, "invalid_payload", "subscription payload is required")

    recipient_spec, recipient_spec_error = _parse_role_payload(
        recipient_raw,
        role_name="recipient",
        allow_same_as_recipient=False,
    )
    if recipient_spec_error:
        return recipient_spec_error

    requester_spec, requester_spec_error = _parse_role_payload(
        requester_raw,
        role_name="requester",
        allow_same_as_recipient=True,
    )
    if requester_spec_error:
        return requester_spec_error

    state = poc_state.get_state(session)

    # Validate references first so error responses never persist partially-created customers.
    recipient, recipient_error = _resolve_existing_role_person(state, recipient_spec, role_name="recipient")
    if recipient_error:
        return recipient_error

    requester = None
    requester_error = None
    if requester_spec["mode"] == "same_as_recipient":
        requester_error = None
    else:
        requester, requester_error = _resolve_existing_role_person(state, requester_spec, role_name="requester")
    if requester_error:
        return requester_error

    created_recipient = False
    if recipient is None:
        recipient = poc_state.create_customer(state, dict(recipient_spec["person_payload"]))
        created_recipient = True

    created_requester = False
    if requester_spec["mode"] == "same_as_recipient":
        requester = recipient
    elif requester is None:
        requester = poc_state.create_customer(state, dict(requester_spec["person_payload"]))
        created_requester = True

    subscription = _build_subscription(
        state,
        subscription_payload,
        recipient_person_id=int(recipient["id"]),
        requester_person_id=int(requester["id"]),
    )
    recipient.setdefault("subscriptions", []).append(subscription)

    recipient_entry, requester_entry = _build_signup_history_entries(
        subscription_payload=subscription_payload,
        recipient_id=int(recipient["id"]),
        requester_id=int(requester["id"]),
        contact_entry=contact_entry,
    )
    poc_state.append_contact_history(state, int(recipient["id"]), recipient_entry)
    if requester_entry:
        poc_state.append_contact_history(state, int(requester["id"]), requester_entry)

    session.modified = True
    return {
        "recipient": recipient,
        "requester": requester,
        "subscription": subscription,
        "createdRecipient": created_recipient,
        "createdRequester": created_requester,
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
