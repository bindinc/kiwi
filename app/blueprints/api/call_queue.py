from __future__ import annotations

import copy
import time

from flask import Blueprint, request, session

from blueprints.api.common import api_error, parse_int_value
from services import poc_state

BLUEPRINT_NAME = "call_queue_api"
URL_PREFIX = "/call-queue"

call_queue_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


@call_queue_bp.get("")
def read_call_queue() -> tuple[dict, int]:
    state = poc_state.get_state(session)
    queue = poc_state.get_call_queue(state)
    return queue, 200


@call_queue_bp.put("")
def write_call_queue() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    state = poc_state.get_state(session)
    queue = poc_state.set_call_queue(state, payload)
    session.modified = True
    return queue, 200


@call_queue_bp.delete("")
def clear_call_queue() -> tuple[dict, int]:
    state = poc_state.get_state(session)
    queue = poc_state.clear_call_queue(state)
    session.modified = True
    return queue, 200


@call_queue_bp.post("/debug-generate")
def debug_generate_queue() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    queue_size, queue_size_error = parse_int_value(
        payload.get("queueSize"),
        field_name="queueSize",
        default=5,
        minimum=0,
        maximum=100,
    )
    if queue_size_error:
        return queue_size_error

    queue_mix = str(payload.get("queueMix", "balanced"))

    state = poc_state.get_state(session)
    queue = poc_state.generate_debug_queue(state, queue_size=queue_size, queue_mix=queue_mix)
    session.modified = True
    return queue, 200


@call_queue_bp.post("/accept-next")
def accept_next_call() -> tuple[dict, int]:
    state = poc_state.get_state(session)
    queue = poc_state.get_call_queue(state)
    items = queue.get("queue", [])

    if not items:
        return api_error(400, "queue_empty", "No callers in queue")

    next_entry = items.pop(0)

    call_session = poc_state.get_call_session(state)
    call_session.update(
        {
            "active": True,
            "callerType": next_entry.get("callerType", "anonymous"),
            "serviceNumber": next_entry.get("serviceNumber"),
            "waitTime": next_entry.get("waitTime", 0),
            "startTime": int(time.time() * 1000),
            "customerId": next_entry.get("customerId"),
            "customerName": next_entry.get("customerName"),
            "pendingIdentification": None,
            "recordingActive": False,
            "totalHoldTime": 0,
            "holdStartTime": None,
            "onHold": False,
        }
    )

    queue["enabled"] = bool(items)
    queue["queue"] = items

    session.modified = True
    return {
        "accepted": next_entry,
        "call_session": copy.deepcopy(call_session),
        "call_queue": copy.deepcopy(queue),
    }, 200
