from __future__ import annotations

from datetime import datetime

from flask import Blueprint, request, session

from blueprints.api.common import api_error
from services import poc_state

BLUEPRINT_NAME = "subscriptions_api"
URL_PREFIX = "/customers"

subscriptions_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


def _find_subscription(customer: dict, subscription_id: int) -> dict | None:
    for subscription in customer.get("subscriptions", []):
        if int(subscription.get("id", -1)) == int(subscription_id):
            return subscription
    return None


@subscriptions_bp.patch("/<int:customer_id>/subscriptions/<int:subscription_id>")
def update_subscription(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    subscription = _find_subscription(customer, subscription_id)
    if subscription is None:
        return api_error(404, "subscription_not_found", "Subscription not found")

    for key, value in payload.items():
        subscription[key] = value

    session.modified = True
    return {"subscription": subscription}, 200


@subscriptions_bp.post("/<int:customer_id>/subscriptions/<int:subscription_id>/resend")
def resend_subscription(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    reason = payload.get("reason", "other")

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    subscription = _find_subscription(customer, subscription_id)
    if subscription is None:
        return api_error(404, "subscription_not_found", "Subscription not found")

    reason_text = {
        "not_received": "niet ontvangen",
        "damaged": "beschadigd",
        "lost": "kwijt",
        "other": "anders",
    }.get(reason, "anders")

    entry = poc_state.append_contact_history(
        state,
        customer_id,
        {
            "type": "Editie verzonden",
            "description": f"Laatste editie van {subscription.get('magazine')} opnieuw verzonden. Reden: {reason_text}.",
        },
    )

    session.modified = True
    return {"subscription": subscription, "entry": entry}, 200


@subscriptions_bp.post("/<int:customer_id>/subscriptions/<int:subscription_id>/winback")
def complete_winback(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    result = payload.get("result")
    offer = payload.get("offer") if isinstance(payload.get("offer"), dict) else {}

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    subscription = _find_subscription(customer, subscription_id)
    if subscription is None:
        return api_error(404, "subscription_not_found", "Subscription not found")

    if result == "accepted":
        entry = poc_state.append_contact_history(
            state,
            customer_id,
            {
                "type": "Winback succesvol",
                "description": f"Klant accepteerde winback aanbod: {offer.get('title', 'Aanbod')}. Abonnement {subscription.get('magazine')} blijft actief.",
            },
        )
        response = {"status": "retained", "subscription": subscription, "entry": entry}
    else:
        customer["subscriptions"] = [
            candidate for candidate in customer.get("subscriptions", []) if int(candidate.get("id", -1)) != int(subscription_id)
        ]
        entry = poc_state.append_contact_history(
            state,
            customer_id,
            {
                "type": "Abonnement opgezegd",
                "description": f"Klant heeft abonnement {subscription.get('magazine')} opgezegd na winback poging.",
            },
        )
        response = {"status": "cancelled", "subscriptionId": subscription_id, "entry": entry}

    session.modified = True
    return response, 200


@subscriptions_bp.post("/<int:customer_id>/subscriptions/deceased-actions")
def process_deceased_actions(customer_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    actions = payload.get("actions") if isinstance(payload.get("actions"), list) else []

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    processed: list[dict] = []
    for action in actions:
        if not isinstance(action, dict):
            continue

        subscription_id = action.get("subscriptionId")
        operation = action.get("action")
        if subscription_id is None:
            continue

        subscription = _find_subscription(customer, int(subscription_id))
        if subscription is None:
            continue

        if operation == "transfer":
            transfer_data = action.get("transferData") if isinstance(action.get("transferData"), dict) else {}
            subscription["status"] = "transferred"
            subscription["transferredTo"] = {
                **transfer_data,
                "transferDate": datetime.utcnow().isoformat(),
            }
            subscription.pop("refundInfo", None)
            processed.append({"subscriptionId": subscription_id, "status": "transferred"})
        else:
            refund_data = action.get("refundData") if isinstance(action.get("refundData"), dict) else {}
            subscription["status"] = "restituted"
            subscription["endDate"] = datetime.utcnow().isoformat()
            subscription["refundInfo"] = {
                "email": refund_data.get("email"),
                "notes": refund_data.get("notes", ""),
                "refundDate": datetime.utcnow().isoformat(),
            }
            processed.append({"subscriptionId": subscription_id, "status": "restituted"})

    poc_state.append_contact_history(
        state,
        customer_id,
        {
            "type": "Overlijden - Meerdere Abonnementen",
            "description": "Abonnementen verwerkt i.v.m. overlijden.",
        },
    )

    session.modified = True
    return {"processed": processed}, 200


@subscriptions_bp.post("/<int:customer_id>/subscriptions/<int:subscription_id>/restitution-transfer")
def complete_restitution_transfer(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    subscription = _find_subscription(customer, subscription_id)
    if subscription is None:
        return api_error(404, "subscription_not_found", "Subscription not found")

    transfer_data = payload.get("transferData") if isinstance(payload.get("transferData"), dict) else {}

    subscription["status"] = "transferred"
    subscription["transferredTo"] = {
        **transfer_data,
        "transferDate": datetime.utcnow().isoformat(),
    }
    subscription.pop("refundInfo", None)

    poc_state.append_contact_history(
        state,
        customer_id,
        {
            "type": "Restitutie Ongedaan - Abonnement Overgezet",
            "description": f"Restitutie van {subscription.get('magazine')} ongedaan gemaakt en abonnement overgezet.",
        },
    )

    session.modified = True
    return {"subscription": subscription}, 200
