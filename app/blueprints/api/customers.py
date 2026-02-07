from __future__ import annotations

from flask import Blueprint, request, session

from blueprints.api.common import api_error, parse_query_int
from services import poc_state

BLUEPRINT_NAME = "persons_api"
URL_PREFIX = "/persons"

customers_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


def _paginate(items: list[dict], page: int, page_size: int) -> dict:
    safe_page = max(1, page)
    safe_size = max(1, min(page_size, 200))
    total = len(items)

    start = (safe_page - 1) * safe_size
    end = start + safe_size

    return {
        "items": items[start:end],
        "page": safe_page,
        "pageSize": safe_size,
        "total": total,
    }


@customers_bp.get("")
def read_customers() -> tuple[dict, int]:
    state = poc_state.get_state(session)
    customers = state.get("customers", [])

    postal_code = request.args.get("postalCode", "")
    house_number = request.args.get("houseNumber", "")
    name = request.args.get("name", "")
    phone = request.args.get("phone", "")
    email = request.args.get("email", "")
    sort_by = request.args.get("sortBy", "name")

    filtered = poc_state.sort_and_filter_customers(
        customers=customers,
        postal_code=postal_code,
        house_number=house_number,
        name=name,
        phone=phone,
        email=email,
        sort_by=sort_by,
    )

    page, page_error = parse_query_int("page", default=1, minimum=1)
    if page_error:
        return page_error

    page_size, size_error = parse_query_int("pageSize", default=20, minimum=1, maximum=200)
    if size_error:
        return size_error

    payload = _paginate(filtered, page=page, page_size=page_size)
    return payload, 200


@customers_bp.post("")
def create_customer() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    state = poc_state.get_state(session)
    customer = poc_state.create_customer(state, payload)
    session.modified = True
    return customer, 201


@customers_bp.get("/state")
def read_customer_state() -> tuple[dict, int]:
    state = poc_state.get_state_copy(session)
    return {"customers": state.get("customers", [])}, 200


@customers_bp.put("/state")
def write_customer_state() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    customers = payload.get("customers")

    if not isinstance(customers, list):
        return api_error(400, "invalid_payload", "customers must be an array")

    poc_state.set_customers(session, customers)
    return {"status": "ok", "count": len(customers)}, 200


@customers_bp.get("/<int:customer_id>")
def read_customer(customer_id: int) -> tuple[dict, int]:
    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    return customer, 200


@customers_bp.patch("/<int:customer_id>")
def update_customer(customer_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    updated = poc_state.update_customer(customer, payload)
    session.modified = True
    return updated, 200


@customers_bp.get("/<int:customer_id>/contact-history")
def read_contact_history(customer_id: int) -> tuple[dict, int]:
    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    history = customer.get("contactHistory", [])
    sorted_history = sorted(history, key=lambda item: str(item.get("date", "")), reverse=True)

    page, page_error = parse_query_int("page", default=1, minimum=1)
    if page_error:
        return page_error

    page_size, size_error = parse_query_int("pageSize", default=20, minimum=1, maximum=200)
    if size_error:
        return size_error

    payload = _paginate(sorted_history, page=page, page_size=page_size)
    return payload, 200


@customers_bp.post("/<int:customer_id>/contact-history")
def create_contact_history_entry(customer_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    state = poc_state.get_state(session)
    entry = poc_state.append_contact_history(state, customer_id, payload)
    if entry is None:
        return api_error(404, "customer_not_found", "Customer not found")

    session.modified = True
    return entry, 201


@customers_bp.put("/<int:customer_id>/delivery-remarks")
def update_delivery_remarks(customer_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    default_remark = str(payload.get("default", "")).strip()
    updated_by = str(payload.get("updatedBy", "Agent"))

    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    now = poc_state.utc_now_iso()
    remarks = customer.setdefault(
        "deliveryRemarks",
        {
            "default": "",
            "lastUpdated": None,
            "history": [],
        },
    )

    previous = remarks.get("default", "")
    if previous != default_remark:
        remarks.setdefault("history", []).insert(
            0,
            {
                "date": now,
                "remark": default_remark,
                "updatedBy": updated_by,
            },
        )

        poc_state.append_contact_history(
            state,
            customer_id,
            {
                "type": "Bezorgvoorkeuren gewijzigd",
                "date": now,
                "description": f'Bezorgvoorkeuren bijgewerkt: "{default_remark or "(leeg)"}"',
            },
        )

    remarks["default"] = default_remark
    remarks["lastUpdated"] = now
    session.modified = True

    return {
        "deliveryRemarks": remarks,
    }, 200


@customers_bp.post("/<int:customer_id>/editorial-complaints")
def create_editorial_complaint(customer_id: int) -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    magazine = str(payload.get("magazine", "")).strip()
    complaint_type = str(payload.get("type", "klacht")).strip().lower()
    category = str(payload.get("category", "overig")).strip().lower()
    description = str(payload.get("description", "")).strip()
    edition = str(payload.get("edition", "")).strip()
    followup = bool(payload.get("followup", False))

    if not magazine:
        return api_error(400, "invalid_payload", "magazine is required")
    if not description:
        return api_error(400, "invalid_payload", "description is required")

    type_labels = {
        "klacht": "Klacht",
        "opmerking": "Opmerking",
        "suggestie": "Suggestie",
        "compliment": "Compliment",
    }
    category_labels = {
        "inhoud": "Inhoud artikel",
        "foto": "Foto/afbeelding",
        "fout": "Fout in tekst",
        "programma": "TV/Radio programma",
        "puzzel": "Puzzel",
        "advertentie": "Advertentie",
        "overig": "Overig",
    }

    history_description = (
        f"{type_labels.get(complaint_type, 'Melding')} voor redactie {magazine}"
        f" - {category_labels.get(category, 'Overig')}. {description}"
    )

    if edition:
        history_description += f" Editie: {edition}."
    if followup:
        history_description += " Klant verwacht terugkoppeling."

    state = poc_state.get_state(session)
    entry = poc_state.append_contact_history(
        state,
        customer_id,
        {
            "type": f"Redactie {type_labels.get(complaint_type, 'Melding')}",
            "description": history_description,
        },
    )

    if entry is None:
        return api_error(404, "customer_not_found", "Customer not found")

    session.modified = True
    return {"entry": entry}, 201


@customers_bp.get("/<int:customer_id>/article-orders")
def read_article_orders(customer_id: int) -> tuple[dict, int]:
    state = poc_state.get_state(session)
    customer = poc_state.find_customer(state, customer_id)
    if customer is None:
        return api_error(404, "customer_not_found", "Customer not found")

    orders = customer.get("articles", [])
    sorted_orders = sorted(orders, key=lambda order: str(order.get("orderDate", "")), reverse=True)
    return {"items": sorted_orders, "total": len(sorted_orders)}, 200
