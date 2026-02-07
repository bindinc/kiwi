from __future__ import annotations

import copy
import time
from datetime import datetime
from typing import Any, MutableMapping

from services import poc_catalog

SESSION_STATE_KEY = "kiwi_poc_state"

DEFAULT_CALL_QUEUE = {
    "enabled": False,
    "queue": [],
    "currentPosition": 0,
    "autoAdvance": True,
}

DEFAULT_CALL_SESSION = {
    "active": False,
    "callerType": "anonymous",
    "customerId": None,
    "customerName": None,
    "serviceNumber": None,
    "waitTime": 0,
    "startTime": None,
    "pendingIdentification": None,
    "recordingActive": False,
    "totalHoldTime": 0,
    "holdStartTime": None,
    "onHold": False,
}

DEFAULT_CUSTOMERS = [
    {
        "id": 1,
        "salutation": "Dhr.",
        "firstName": "J.",
        "middleName": "de",
        "lastName": "Vries",
        "birthday": "1972-03-14",
        "postalCode": "1012AB",
        "houseNumber": "42",
        "address": "Damstraat 42",
        "city": "Amsterdam",
        "email": "jan.devries@email.nl",
        "phone": "06-12345678",
        "optinEmail": "yes",
        "optinPhone": "yes",
        "optinPost": "no",
        "deliveryRemarks": {
            "default": "Bezorgen bij de buren indien niet thuis",
            "lastUpdated": "2024-09-10T10:30:00.000Z",
            "history": [
                {
                    "date": "2024-09-10T10:30:00.000Z",
                    "remark": "Bezorgen bij de buren indien niet thuis",
                    "updatedBy": "Agent Demo",
                }
            ],
        },
        "subscriptions": [
            {
                "id": 1,
                "magazine": "Avrobode",
                "duration": "1-jaar",
                "startDate": "2023-01-15",
                "endDate": "2024-01-15",
                "status": "ended",
                "lastEdition": "2024-01-01",
            },
            {
                "id": 5,
                "magazine": "Mikrogids",
                "duration": "2-jaar",
                "startDate": "2024-03-01",
                "status": "active",
                "lastEdition": "2024-10-01",
            },
        ],
        "articles": [
            {
                "id": 1,
                "articleName": "Jaargang bundel 2023",
                "quantity": 1,
                "price": 29.95,
                "orderDate": "2024-09-15",
                "desiredDeliveryDate": "2024-09-25",
                "deliveryStatus": "delivered",
                "trackingNumber": "3SABCD1234567890NL",
                "paymentStatus": "paid",
                "paymentMethod": "iDEAL",
                "paymentDate": "2024-09-15",
                "actualDeliveryDate": "2024-09-24",
                "returnDeadline": "2024-10-08",
                "notes": "",
            },
            {
                "id": 2,
                "articleName": "Extra TV gids week editie",
                "quantity": 2,
                "price": 7.90,
                "orderDate": "2024-10-01",
                "desiredDeliveryDate": "2024-10-12",
                "deliveryStatus": "in_transit",
                "trackingNumber": "3SABCD9876543210NL",
                "paymentStatus": "paid",
                "paymentMethod": "iDEAL",
                "paymentDate": "2024-10-01",
                "actualDeliveryDate": None,
                "returnDeadline": None,
                "notes": "Bezorgen bij buren indien niet thuis",
            },
        ],
        "contactHistory": [
            {
                "id": 1,
                "type": "Nieuw abonnement",
                "date": "2024-03-01T10:30:00",
                "description": "Abonnement Mikrogids aangemaakt. Start per direct.",
            },
            {
                "id": 2,
                "type": "Abonnement beëindigd",
                "date": "2024-01-15T14:20:00",
                "description": "Abonnement Avrobode beëindigd na reguliere looptijd van 1 jaar.",
            },
            {
                "id": 3,
                "type": "Adreswijziging",
                "date": "2023-09-12T10:15:00",
                "description": "Adres gewijzigd van Kerkstraat 10 naar Damstraat 42.",
            },
            {
                "id": 4,
                "type": "Nieuw abonnement",
                "date": "2023-01-15T09:45:00",
                "description": "Abonnement Avrobode aangemaakt. Start per direct.",
            },
        ],
    },
    {
        "id": 2,
        "salutation": "Mevr.",
        "firstName": "M.",
        "middleName": "",
        "lastName": "Jansen",
        "birthday": "1980-07-22",
        "postalCode": "3011BD",
        "houseNumber": "15",
        "address": "Wijnhaven 15",
        "city": "Rotterdam",
        "email": "maria.jansen@email.nl",
        "phone": "06-87654321",
        "optinEmail": "yes",
        "optinPhone": "no",
        "optinPost": "yes",
        "subscriptions": [
            {
                "id": 2,
                "magazine": "Mikrogids",
                "duration": "2-jaar",
                "startDate": "2022-06-01",
                "endDate": "2024-06-01",
                "status": "ended",
                "lastEdition": "2024-05-28",
            },
            {
                "id": 3,
                "magazine": "Ncrvgids",
                "duration": "1-jaar-maandelijks",
                "startDate": "2023-03-10",
                "status": "active",
                "lastEdition": "2024-09-28",
            },
        ],
        "articles": [],
        "contactHistory": [
            {
                "id": 1,
                "type": "Telefoongesprek",
                "date": "2024-09-20T11:20:00",
                "description": "Vraag over facturatie. Uitleg gegeven over automatische incasso.",
            },
            {
                "id": 2,
                "type": "Abonnement beëindigd",
                "date": "2024-06-01T09:15:00",
                "description": "Abonnement Mikrogids beëindigd na reguliere looptijd van 2 jaar.",
            },
            {
                "id": 3,
                "type": "Extra abonnement",
                "date": "2023-03-10T15:30:00",
                "description": "Tweede abonnement (Ncrvgids) toegevoegd.",
            },
            {
                "id": 4,
                "type": "Nieuw abonnement",
                "date": "2022-06-01T14:45:00",
                "description": "Abonnement Mikrogids aangemaakt voor 2 jaar.",
            },
        ],
    },
    {
        "id": 3,
        "salutation": "Dhr.",
        "firstName": "Pieter",
        "middleName": "",
        "lastName": "Bakker",
        "birthday": "1988-11-05",
        "postalCode": "2511VA",
        "houseNumber": "88",
        "address": "Lange Voorhout 88",
        "city": "Den Haag",
        "email": "p.bakker@email.nl",
        "phone": "06-11223344",
        "subscriptions": [
            {
                "id": 4,
                "magazine": "Avrobode",
                "duration": "3-jaar",
                "startDate": "2024-02-01",
                "status": "active",
                "lastEdition": "2024-10-01",
            }
        ],
        "articles": [],
        "contactHistory": [
            {
                "id": 1,
                "type": "Nieuw abonnement",
                "date": "2024-02-01T13:15:00",
                "description": "Abonnement Avrobode aangemaakt via telefonische bestelling.",
            }
        ],
    },
    {
        "id": 4,
        "salutation": "Dhr.",
        "firstName": "H.",
        "middleName": "van",
        "lastName": "Dijk",
        "birthday": "1975-02-02",
        "postalCode": "3512JE",
        "houseNumber": "23",
        "address": "Oudegracht 23",
        "city": "Utrecht",
        "email": "h.vandijk@email.nl",
        "phone": "06-98765432",
        "optinEmail": "yes",
        "optinPhone": "yes",
        "optinPost": "yes",
        "subscriptions": [
            {
                "id": 6,
                "magazine": "Avrobode",
                "duration": "1-jaar-maandelijks",
                "startDate": "2023-11-01",
                "status": "active",
                "lastEdition": "2024-10-01",
            },
            {
                "id": 7,
                "magazine": "Mikrogids",
                "duration": "2-jaar",
                "startDate": "2023-05-15",
                "status": "active",
                "lastEdition": "2024-10-01",
            },
        ],
        "articles": [],
        "contactHistory": [
            {
                "id": 1,
                "type": "Extra abonnement",
                "date": "2023-11-01T14:45:00",
                "description": "Tweede abonnement (Avrobode) toegevoegd.",
            },
            {
                "id": 2,
                "type": "Nieuw abonnement",
                "date": "2023-05-15T16:20:00",
                "description": "Abonnement Mikrogids aangemaakt voor 2 jaar.",
            },
        ],
    },
]


DEFAULT_STATE = {
    "customers": DEFAULT_CUSTOMERS,
    "call_queue": DEFAULT_CALL_QUEUE,
    "call_session": DEFAULT_CALL_SESSION,
    "last_call_session": None,
    "counters": {
        "customer_id": 5,
        "subscription_id": 100,
        "article_order_id": 1000,
        "contact_history_id": 10000,
        "queue_id": 10000,
    },
}


def _deepcopy_default_state() -> dict[str, Any]:
    return copy.deepcopy(DEFAULT_STATE)


def ensure_state(session_data: MutableMapping[str, Any]) -> dict[str, Any]:
    if SESSION_STATE_KEY not in session_data or not isinstance(session_data.get(SESSION_STATE_KEY), dict):
        session_data[SESSION_STATE_KEY] = _deepcopy_default_state()
        _mark_modified(session_data)
    return session_data[SESSION_STATE_KEY]


def get_state(session_data: MutableMapping[str, Any]) -> dict[str, Any]:
    return ensure_state(session_data)


def get_state_copy(session_data: MutableMapping[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(ensure_state(session_data))


def reset_state(session_data: MutableMapping[str, Any]) -> dict[str, Any]:
    session_data[SESSION_STATE_KEY] = _deepcopy_default_state()
    _mark_modified(session_data)
    return session_data[SESSION_STATE_KEY]


def _mark_modified(session_data: MutableMapping[str, Any]) -> None:
    if hasattr(session_data, "modified"):
        session_data.modified = True


def _next_counter(state: dict[str, Any], key: str) -> int:
    counters = state.setdefault("counters", {})
    current = int(counters.get(key, 1))
    counters[key] = current + 1
    return current


def get_customers(session_data: MutableMapping[str, Any]) -> list[dict[str, Any]]:
    return get_state(session_data).setdefault("customers", [])


def set_customers(session_data: MutableMapping[str, Any], customers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    state = get_state(session_data)
    state["customers"] = customers
    _mark_modified(session_data)
    return state["customers"]


def find_customer(state: dict[str, Any], customer_id: int) -> dict[str, Any] | None:
    for customer in state.get("customers", []):
        if int(customer.get("id", -1)) == int(customer_id):
            return customer
    return None


def create_customer(state: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    customer = copy.deepcopy(payload)
    customer["id"] = _next_counter(state, "customer_id")
    customer.setdefault("subscriptions", [])
    customer.setdefault("articles", [])
    customer.setdefault("contactHistory", [])
    state.setdefault("customers", []).append(customer)
    return customer


def update_customer(customer: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    for key, value in updates.items():
        customer[key] = value
    return customer


def append_contact_history(state: dict[str, Any], customer_id: int, entry: dict[str, Any]) -> dict[str, Any] | None:
    customer = find_customer(state, customer_id)
    if customer is None:
        return None

    normalized = {
        "id": entry.get("id") or _next_counter(state, "contact_history_id"),
        "type": entry.get("type", "default"),
        "date": entry.get("date") or datetime.utcnow().isoformat(),
        "description": entry.get("description", ""),
    }

    history = customer.setdefault("contactHistory", [])
    history.insert(0, normalized)
    return normalized


def get_call_queue(state: dict[str, Any]) -> dict[str, Any]:
    return state.setdefault("call_queue", copy.deepcopy(DEFAULT_CALL_QUEUE))


def set_call_queue(state: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    queue = get_call_queue(state)
    queue.update(payload)
    return queue


def clear_call_queue(state: dict[str, Any]) -> dict[str, Any]:
    state["call_queue"] = copy.deepcopy(DEFAULT_CALL_QUEUE)
    return state["call_queue"]


def _build_queue_entry(state: dict[str, Any], customer_id: int | None, caller_type: str, service_number: str, wait_time: int) -> dict[str, Any]:
    customer_name = "Anonieme Beller"
    if customer_id is not None:
        customer = find_customer(state, customer_id)
        if customer:
            middle = customer.get("middleName")
            full_name = f"{customer.get('firstName', '')} {middle + ' ' if middle else ''}{customer.get('lastName', '')}".strip()
            customer_name = full_name or f"Klant {customer_id}"

    return {
        "id": f"queue_{_next_counter(state, 'queue_id')}",
        "callerType": caller_type,
        "customerId": customer_id,
        "customerName": customer_name,
        "serviceNumber": service_number,
        "waitTime": wait_time,
        "queuedAt": int(time.time() * 1000),
        "priority": 1,
    }


def generate_debug_queue(state: dict[str, Any], queue_size: int, queue_mix: str) -> dict[str, Any]:
    queue_size = max(0, min(queue_size, 100))
    mix = (queue_mix or "balanced").strip().lower()

    known_percentage = {
        "mostly_known": 0.8,
        "mostly_anonymous": 0.2,
        "all_known": 1.0,
        "all_anonymous": 0.0,
        "balanced": 0.5,
    }.get(mix, 0.5)

    services = list(poc_catalog.get_service_numbers().keys())
    customers = state.get("customers", [])

    queue_entries: list[dict[str, Any]] = []
    for index in range(queue_size):
        service_number = services[index % len(services)]
        wait_time = 30 + ((index * 41) % 271)

        is_known = bool(customers) and ((index % 10) / 10) < known_percentage
        if is_known:
            customer = customers[index % len(customers)]
            queue_entries.append(
                _build_queue_entry(state, int(customer["id"]), "known", service_number, wait_time)
            )
        else:
            queue_entries.append(_build_queue_entry(state, None, "anonymous", service_number, wait_time))

    state["call_queue"] = {
        "enabled": bool(queue_entries),
        "queue": queue_entries,
        "currentPosition": 0,
        "autoAdvance": True,
    }
    return state["call_queue"]


def get_call_session(state: dict[str, Any]) -> dict[str, Any]:
    return state.setdefault("call_session", copy.deepcopy(DEFAULT_CALL_SESSION))


def set_call_session(state: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    call_session = get_call_session(state)
    call_session.update(payload)
    return call_session


def end_call_session(state: dict[str, Any]) -> dict[str, Any]:
    call_session = get_call_session(state)
    if call_session.get("active") and call_session.get("startTime"):
        duration_seconds = max(0, int((int(time.time() * 1000) - int(call_session["startTime"])) / 1000))
        state["last_call_session"] = {
            "customerId": call_session.get("customerId"),
            "customerName": call_session.get("customerName"),
            "serviceNumber": call_session.get("serviceNumber"),
            "waitTime": call_session.get("waitTime", 0),
            "startTime": call_session.get("startTime"),
            "callDuration": duration_seconds,
            "totalHoldTime": call_session.get("totalHoldTime", 0),
        }

    state["call_session"] = copy.deepcopy(DEFAULT_CALL_SESSION)
    return state["call_session"]


def set_last_call_session(state: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    state["last_call_session"] = copy.deepcopy(payload)
    return state["last_call_session"]


def get_last_call_session(state: dict[str, Any]) -> dict[str, Any] | None:
    value = state.get("last_call_session")
    return copy.deepcopy(value) if isinstance(value, dict) else value


def sort_and_filter_customers(
    customers: list[dict[str, Any]],
    postal_code: str = "",
    house_number: str = "",
    name: str = "",
    phone: str = "",
    email: str = "",
    sort_by: str = "name",
) -> list[dict[str, Any]]:
    normalized_postal = postal_code.strip().upper()
    normalized_house = house_number.strip()
    normalized_name = name.strip().lower()
    normalized_phone = "".join(ch for ch in phone if ch.isdigit())
    normalized_email = email.strip().lower()

    def matches(customer: dict[str, Any]) -> bool:
        if normalized_postal and customer.get("postalCode", "").upper() != normalized_postal:
            return False
        if normalized_house and str(customer.get("houseNumber", "")) != normalized_house:
            return False

        if normalized_name:
            candidates = [
                str(customer.get("firstName", "")),
                str(customer.get("lastName", "")),
                f"{customer.get('firstName', '')} {customer.get('lastName', '')}",
                f"{customer.get('firstName', '')} {customer.get('middleName', '')} {customer.get('lastName', '')}",
            ]
            if not any(normalized_name in candidate.lower() for candidate in candidates):
                return False

        if normalized_phone:
            customer_phone = "".join(ch for ch in str(customer.get("phone", "")) if ch.isdigit())
            if normalized_phone not in customer_phone:
                return False

        if normalized_email:
            if normalized_email not in str(customer.get("email", "")).lower():
                return False

        return True

    filtered = [customer for customer in customers if matches(customer)]

    if sort_by == "postal":
        filtered.sort(key=lambda customer: str(customer.get("postalCode", "")))
    elif sort_by == "subscriptions":
        filtered.sort(
            key=lambda customer: sum(1 for sub in customer.get("subscriptions", []) if sub.get("status") == "active"),
            reverse=True,
        )
    else:
        filtered.sort(
            key=lambda customer: (
                str(customer.get("lastName", "")).lower(),
                str(customer.get("firstName", "")).lower(),
            )
        )

    return filtered
