from __future__ import annotations

import copy
import time

from flask import Blueprint, request, session

from blueprints.api.common import api_error, parse_int_value
from services import poc_state

BLUEPRINT_NAME = "call_session_api"
URL_PREFIX = "/call-session"

call_session_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


@call_session_bp.get("")
def read_call_session() -> tuple[dict, int]:
    state = poc_state.get_state(session)
    return {
        "call_session": copy.deepcopy(poc_state.get_call_session(state)),
        "last_call_session": poc_state.get_last_call_session(state),
    }, 200


@call_session_bp.put("")
def write_call_session() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    state = poc_state.get_state(session)
    call_session = poc_state.set_call_session(state, payload)
    session.modified = True
    return call_session, 200


@call_session_bp.post("/start-debug")
def start_debug_call() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    state = poc_state.get_state(session)
    call_session = poc_state.get_call_session(state)

    wait_time, wait_time_error = parse_int_value(
        payload.get("waitTime"),
        field_name="waitTime",
        default=0,
        minimum=0,
    )
    if wait_time_error:
        return wait_time_error

    customer_id, customer_id_error = parse_int_value(
        payload.get("customerId"),
        field_name="customerId",
        required=False,
        minimum=1,
    )
    if customer_id_error:
        return customer_id_error

    caller_type = payload.get("callerType", "anonymous")
    if customer_id and caller_type in {"known", "identified"}:
        caller_type = "identified"

    call_session.update(
        {
            "active": True,
            "callerType": caller_type,
            "customerId": customer_id,
            "customerName": payload.get("customerName"),
            "serviceNumber": payload.get("serviceNumber"),
            "waitTime": wait_time,
            "startTime": int(time.time() * 1000),
            "pendingIdentification": None,
            "recordingActive": False,
            "totalHoldTime": 0,
            "holdStartTime": None,
            "onHold": False,
        }
    )

    session.modified = True
    return call_session, 200


@call_session_bp.post("/identify-caller")
def identify_caller() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")
    customer_id, customer_id_error = parse_int_value(
        payload.get("customerId"),
        field_name="customerId",
        minimum=1,
    )

    if customer_id_error:
        return customer_id_error

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    call_session = poc_state.get_call_session(state)
    if not call_session.get("active"):
        return api_error(400, "no_active_call", "No active call session")

    full_name = f"{customer.get('firstName', '')} {customer.get('middleName', '')} {customer.get('lastName', '')}".strip()
    call_session["callerType"] = "identified"
    call_session["customerId"] = customer_id
    call_session["customerName"] = full_name

    poc_state.append_contact_history(
        state,
        customer_id,
        {
            "type": "call_identified",
            "description": f"Beller geïdentificeerd tijdens {call_session.get('serviceNumber') or 'service'} call",
        },
    )

    session.modified = True
    return call_session, 200


@call_session_bp.post("/hold")
def hold_call() -> tuple[dict, int]:
    state = poc_state.get_state(session)
    call_session = poc_state.get_call_session(state)
    if not call_session.get("active"):
        return api_error(400, "no_active_call", "No active call session")

    call_session["onHold"] = True
    call_session["holdStartTime"] = int(time.time() * 1000)
    session.modified = True
    return call_session, 200


@call_session_bp.post("/resume")
def resume_call() -> tuple[dict, int]:
    state = poc_state.get_state(session)
    call_session = poc_state.get_call_session(state)
    if not call_session.get("active"):
        return api_error(400, "no_active_call", "No active call session")

    hold_start = call_session.get("holdStartTime")
    if hold_start:
        hold_duration = max(0, int((int(time.time() * 1000) - int(hold_start)) / 1000))
        call_session["totalHoldTime"] = int(call_session.get("totalHoldTime", 0)) + hold_duration

    call_session["onHold"] = False
    call_session["holdStartTime"] = None
    session.modified = True
    return call_session, 200


@call_session_bp.post("/end")
def end_call() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")
    forced_by_customer = bool(payload.get("forcedByCustomer", False))

    state = poc_state.get_state(session)
    call_session_before = copy.deepcopy(poc_state.get_call_session(state))

    if not call_session_before.get("active"):
        return api_error(400, "no_active_call", "No active call session")

    if call_session_before.get("customerId"):
        start_time = call_session_before.get("startTime")
        call_duration = 0
        if start_time:
            call_duration = max(0, int((int(time.time() * 1000) - int(start_time)) / 1000))

        reason = "call_ended_by_customer" if forced_by_customer else "call_ended_by_agent"

        poc_state.append_contact_history(
            state,
            int(call_session_before["customerId"]),
            {
                "type": reason,
                "description": (
                    f"{call_session_before.get('serviceNumber')} call beëindigd "
                    f"(duur: {call_duration}s, wacht: {call_session_before.get('waitTime', 0)}s)"
                ),
            },
        )

    new_session = poc_state.end_call_session(state)
    session.modified = True
    return {
        "call_session": new_session,
        "last_call_session": poc_state.get_last_call_session(state),
    }, 200


@call_session_bp.post("/disposition")
def save_disposition() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")
    category = payload.get("category")
    outcome = payload.get("outcome")
    notes = payload.get("notes", "")
    follow_up_required = bool(payload.get("followUpRequired", False))
    follow_up_date = payload.get("followUpDate")
    follow_up_notes = payload.get("followUpNotes", "")

    if not category or not outcome:
        return api_error(400, "invalid_payload", "category and outcome are required")

    state = poc_state.get_state(session)
    last_call = poc_state.get_last_call_session(state)
    if not isinstance(last_call, dict):
        return api_error(400, "missing_call_session", "No completed call is available")

    customer_id = last_call.get("customerId")
    if customer_id:
        description = f"{category}: {outcome}{' - ' + notes if notes else ''}"
        poc_state.append_contact_history(
            state,
            int(customer_id),
            {
                "type": "call_disposition",
                "date": poc_state.utc_now_iso(),
                "description": description,
            },
        )

        if follow_up_required and follow_up_date:
            poc_state.append_contact_history(
                state,
                int(customer_id),
                {
                    "type": "follow_up_scheduled",
                    "date": poc_state.utc_now_iso(),
                    "description": f"Follow-up gepland voor {follow_up_date}: {follow_up_notes or 'Geen notities'}",
                },
            )

    session.modified = True
    return {
        "status": "saved",
        "category": category,
        "outcome": outcome,
    }, 200
