from __future__ import annotations

from flask import Blueprint, request

from blueprints.api.common import api_error, get_current_user_context, parse_query_int
from services.mutations import (
    MutationConflictError,
    MutationNotFoundError,
    MutationStoreDisabledError,
    get_mutation,
    list_mutations,
    request_cancel,
    request_retry,
    summarize_mutations,
)

BLUEPRINT_NAME = "mutations_api"
URL_PREFIX = "/mutations"

mutations_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)

SUPERVISOR_ROLES = {
    "bink8s.app.kiwi.supervisor",
    "bink8s.app.kiwi.admin",
    "bink8s.app.kiwi.dev",
}


def _can_manage_all_mutations(roles: list[str]) -> bool:
    role_set = set(roles)
    return any(role in role_set for role in SUPERVISOR_ROLES)



def _resolve_requester_user() -> str | None:
    user_context = get_current_user_context()
    identity = user_context.get("identity") if isinstance(user_context.get("identity"), dict) else {}
    user_email = identity.get("email")
    if isinstance(user_email, str) and user_email.strip():
        return user_email.strip().lower()
    return None



def _resolve_roles() -> list[str]:
    user_context = get_current_user_context()
    roles = user_context.get("roles")
    if not isinstance(roles, list):
        return []
    return [str(role) for role in roles]


@mutations_bp.get("")
def read_mutations() -> tuple[dict, int]:
    status_filter = request.args.get("status")
    customer_id_raw = request.args.get("customerId")
    cursor = request.args.get("cursor")

    limit, limit_error = parse_query_int("limit", default=25, minimum=1, maximum=200)
    if limit_error:
        return limit_error

    customer_id = None
    if customer_id_raw not in (None, ""):
        try:
            customer_id = int(customer_id_raw)
        except (TypeError, ValueError):
            return api_error(400, "invalid_query_parameter", "customerId must be an integer")

    requester_roles = _resolve_roles()
    requester_user = _resolve_requester_user()
    manage_all = _can_manage_all_mutations(requester_roles)

    created_by_user = None if manage_all else requester_user

    try:
        payload = list_mutations(
            status_filter=status_filter,
            customer_id=customer_id,
            created_by_user=created_by_user,
            limit=limit,
            cursor=cursor,
        )
    except MutationStoreDisabledError:
        return api_error(503, "mutation_store_disabled", "Mutation store is disabled")

    return payload, 200


@mutations_bp.get("/summary")
def read_mutation_summary() -> tuple[dict, int]:
    customer_id_raw = request.args.get("customerId")
    customer_id = None
    if customer_id_raw not in (None, ""):
        try:
            customer_id = int(customer_id_raw)
        except (TypeError, ValueError):
            return api_error(400, "invalid_query_parameter", "customerId must be an integer")

    requester_roles = _resolve_roles()
    requester_user = _resolve_requester_user()
    manage_all = _can_manage_all_mutations(requester_roles)

    created_by_user = None if manage_all else requester_user

    try:
        summary = summarize_mutations(customer_id=customer_id, created_by_user=created_by_user)
    except MutationStoreDisabledError:
        return api_error(503, "mutation_store_disabled", "Mutation store is disabled")

    return {"summary": summary}, 200


@mutations_bp.get("/<uuid:mutation_id>")
def read_mutation(mutation_id) -> tuple[dict, int]:
    requester_roles = _resolve_roles()
    requester_user = _resolve_requester_user()
    manage_all = _can_manage_all_mutations(requester_roles)

    try:
        payload = get_mutation(str(mutation_id))
    except MutationStoreDisabledError:
        return api_error(503, "mutation_store_disabled", "Mutation store is disabled")
    except MutationNotFoundError:
        return api_error(404, "mutation_not_found", "Mutation not found")

    if not manage_all and payload.get("createdByUser") not in (None, requester_user):
        return api_error(403, "forbidden", "Mutation not accessible for this user")

    return payload, 200


@mutations_bp.post("/<uuid:mutation_id>/retry")
def retry_mutation(mutation_id) -> tuple[dict, int]:
    requester_roles = _resolve_roles()
    requester_user = _resolve_requester_user()

    if not _can_manage_all_mutations(requester_roles):
        return api_error(403, "forbidden", "Retry requires supervisor role")

    try:
        updated = request_retry(mutation_id=str(mutation_id), requested_by=requester_user)
    except MutationStoreDisabledError:
        return api_error(503, "mutation_store_disabled", "Mutation store is disabled")
    except MutationNotFoundError:
        return api_error(404, "mutation_not_found", "Mutation not found")
    except MutationConflictError as error:
        return api_error(409, "mutation_conflict", str(error))

    return {"mutation": updated}, 200


@mutations_bp.post("/<uuid:mutation_id>/cancel")
def cancel_mutation(mutation_id) -> tuple[dict, int]:
    requester_roles = _resolve_roles()
    requester_user = _resolve_requester_user()

    if not _can_manage_all_mutations(requester_roles):
        return api_error(403, "forbidden", "Cancel requires supervisor role")

    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    reason = str(payload.get("reason", "")).strip() or None

    try:
        updated = request_cancel(
            mutation_id=str(mutation_id),
            requested_by=requester_user,
            reason=reason,
        )
    except MutationStoreDisabledError:
        return api_error(503, "mutation_store_disabled", "Mutation store is disabled")
    except MutationNotFoundError:
        return api_error(404, "mutation_not_found", "Mutation not found")
    except MutationConflictError as error:
        return api_error(409, "mutation_conflict", str(error))

    return {"mutation": updated}, 200
