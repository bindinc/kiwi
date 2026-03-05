from __future__ import annotations

from flask import Blueprint, request, session

from blueprints.api.common import api_error, get_current_user_context, parse_int_value
from services import poc_state
from services.mutations import enqueue_mutation
from services.mutations.settings import is_mutation_store_enabled

BLUEPRINT_NAME = "subscriptions_api"
URL_PREFIX = "/subscriptions"

subscriptions_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


def _extract_actor_context() -> tuple[str | None, list[str]]:
    user_context = get_current_user_context()
    identity = user_context.get("identity") if isinstance(user_context.get("identity"), dict) else {}
    roles = user_context.get("roles") if isinstance(user_context.get("roles"), list) else []

    actor_email = identity.get("email")
    if isinstance(actor_email, str):
        actor_email = actor_email.strip().lower() or None
    else:
        actor_email = None

    actor_roles = [str(role) for role in roles]
    return actor_email, actor_roles


def _extract_client_request_id() -> str | None:
    raw_value = request.headers.get("Idempotency-Key")
    if not isinstance(raw_value, str):
        return None
    value = raw_value.strip()
    return value or None


def _enqueue_subscription_mutation(
    *,
    command_type: str,
    ordering_key: str,
    customer_id: int | None,
    subscription_id: int | None,
    request_payload: dict,
) -> tuple[dict, int]:
    actor_email, actor_roles = _extract_actor_context()
    mutation = enqueue_mutation(
        command_type=command_type,
        ordering_key=ordering_key,
        request_payload=request_payload,
        customer_id=customer_id,
        subscription_id=subscription_id,
        created_by_user=actor_email,
        created_by_roles=actor_roles,
        client_request_id=_extract_client_request_id(),
    )
    return {"mutation": mutation}, 202


def _find_subscription(customer: dict, subscription_id: int) -> dict | None:
    for subscription in customer.get("subscriptions", []):
        if int(subscription.get("id", -1)) == int(subscription_id):
            return subscription
    return None


@subscriptions_bp.patch("/<int:customer_id>/<int:subscription_id>")
def update_subscription(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    subscription = _find_subscription(customer, subscription_id)
    if subscription is None:
        return api_error(404, "subscription_not_found", "Subscription not found")

    if is_mutation_store_enabled():
        return _enqueue_subscription_mutation(
            command_type="subscription.update",
            ordering_key=f"subscription:{subscription_id}",
            customer_id=customer_id,
            subscription_id=subscription_id,
            request_payload=payload,
        )

    for key, value in payload.items():
        subscription[key] = value

    session.modified = True
    return {"subscription": subscription}, 200


@subscriptions_bp.post("/<int:customer_id>/<int:subscription_id>/complaint")
def create_subscription_complaint(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

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


@subscriptions_bp.post("/<int:customer_id>/<int:subscription_id>")
def complete_winback(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    result = payload.get("result")
    offer = payload.get("offer") if isinstance(payload.get("offer"), dict) else {}

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    subscription = _find_subscription(customer, subscription_id)
    if subscription is None:
        return api_error(404, "subscription_not_found", "Subscription not found")

    if is_mutation_store_enabled():
        return _enqueue_subscription_mutation(
            command_type="subscription.cancel",
            ordering_key=f"subscription:{subscription_id}",
            customer_id=customer_id,
            subscription_id=subscription_id,
            request_payload={
                "result": result,
                "offer": offer,
            },
        )

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


@subscriptions_bp.post("/<int:customer_id>/deceased-actions")
def process_deceased_actions(customer_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    actions = payload.get("actions") if isinstance(payload.get("actions"), list) else []

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    if is_mutation_store_enabled():
        return _enqueue_subscription_mutation(
            command_type="subscription.deceased_actions",
            ordering_key=f"customer:{customer_id}",
            customer_id=customer_id,
            subscription_id=None,
            request_payload={"actions": actions},
        )

    processed: list[dict] = []
    for action in actions:
        if not isinstance(action, dict):
            continue

        subscription_id_raw = action.get("subscriptionId")
        operation = action.get("action")
        subscription_id, subscription_id_error = parse_int_value(
            subscription_id_raw,
            field_name="subscriptionId",
            default=None,
            minimum=1,
        )
        if subscription_id_error:
            continue

        subscription = _find_subscription(customer, subscription_id)
        if subscription is None:
            continue

        if operation == "transfer":
            transfer_data = action.get("transferData") if isinstance(action.get("transferData"), dict) else {}
            subscription["status"] = "transferred"
            subscription["transferredTo"] = {
                **transfer_data,
                "transferDate": poc_state.utc_now_iso(),
            }
            subscription.pop("refundInfo", None)
            processed.append({"subscriptionId": subscription_id, "status": "transferred"})
        else:
            refund_data = action.get("refundData") if isinstance(action.get("refundData"), dict) else {}
            subscription["status"] = "restituted"
            subscription["endDate"] = poc_state.utc_now_iso()
            subscription["refundInfo"] = {
                "email": refund_data.get("email"),
                "notes": refund_data.get("notes", ""),
                "refundDate": poc_state.utc_now_iso(),
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


@subscriptions_bp.post("/<int:customer_id>/<int:subscription_id>/restitution-transfer")
def complete_restitution_transfer(customer_id: int, subscription_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

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
        "transferDate": poc_state.utc_now_iso(),
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
