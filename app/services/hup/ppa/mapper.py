"""Mapping helpers between PPA payloads and Kiwi API responses."""

from __future__ import annotations

from typing import Any


def _first_list_value(values: list[str] | None) -> str | None:
    if not values:
        return None
    return values[0]


def normalize_search_result(item: dict[str, Any]) -> dict[str, Any]:
    """Normalize PPA person search result into the Kiwi DTO shape."""

    return {
        "personId": item.get("personId"),
        "firstName": item.get("firstName"),
        "lastName": item.get("name"),
        "street": item.get("street"),
        "houseNo": item.get("houseNo"),
        "city": item.get("city"),
        "postCode": item.get("postCode"),
        "phone": _first_list_value(item.get("phone")),
        "email": _first_list_value(item.get("geteMail")),
    }


def normalize_search_response(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize a paged personsearch response."""

    items = [normalize_search_result(item) for item in payload.get("content", [])]
    page = {
        "number": payload.get("pageNumber", 0),
        "size": payload.get("pageSize", len(items)),
        "totalElements": payload.get("totalElements", len(items)),
        "totalPages": payload.get("totalPages", 1),
    }
    return {"items": items, "page": page}


def normalize_person(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize a single PPA person resource."""

    contacts = payload.get("contacts") or {}
    addresses = contacts.get("addresses") or []
    first_address = addresses[0] if addresses else {}
    address_payload = first_address.get("address") or {}
    house_payload = address_payload.get("housenumber") or {}

    emails = contacts.get("emails") or []
    phones = contacts.get("phones") or []

    primary_email = emails[0] if emails else {}
    primary_phone = phones[0] if phones else {}

    return {
        "personId": payload.get("personNumber") or payload.get("rId"),
        "resourceId": payload.get("rId"),
        "firstName": payload.get("firstName"),
        "surName": payload.get("surName"),
        "lastName": payload.get("lastName"),
        "initials": payload.get("initials"),
        "salutation": payload.get("salutation"),
        "birthDay": payload.get("birthDay"),
        "email": primary_email.get("emailAddress"),
        "phone": primary_phone.get("number"),
        "address": {
            "street": address_payload.get("street"),
            "houseNo": house_payload.get("housenumber"),
            "postCode": address_payload.get("postCode"),
            "city": address_payload.get("city"),
            "countryCode": address_payload.get("isoCountryCode"),
            "extension": first_address.get("extension"),
        },
        "raw": payload,
    }
