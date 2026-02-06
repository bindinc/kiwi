"""Customer search and update service using direct PPA API calls."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from services.hup.ppa.client import PpaClient
from services.hup.ppa.mapper import normalize_person, normalize_search_response


@dataclass(frozen=True)
class CustomerUpdateResult:
    before: dict[str, Any]
    after: dict[str, Any]
    updated_fields: list[str]


class PpaCustomerService:
    """Encapsulates PPA search/detail/update behavior."""

    def __init__(self, client: PpaClient | None = None) -> None:
        self.client = client or PpaClient()

    def search(self, filters: dict[str, Any]) -> dict[str, Any]:
        response = self.client.search_persons(filters)
        return normalize_search_response(response)

    def get_customer(self, person_id: str) -> dict[str, Any]:
        person = self.client.get_person(person_id)
        return normalize_person(person)

    def update_customer(self, person_id: str, patch_payload: dict[str, Any]) -> CustomerUpdateResult:
        before_raw = self.client.get_person(person_id)
        updated_fields: list[str] = []

        person_patch = {
            key: patch_payload[key]
            for key in [
                "firstName",
                "lastName",
                "surName",
                "initials",
                "salutation",
                "birthDay",
                "title",
            ]
            if key in patch_payload
        }

        if person_patch:
            self.client.patch_person(person_id, person_patch)
            updated_fields.extend(sorted(person_patch.keys()))

        contacts = (before_raw.get("contacts") or {})
        emails = contacts.get("emails") or []
        phones = contacts.get("phones") or []
        addresses = contacts.get("addresses") or []

        email_value = patch_payload.get("email")
        if email_value:
            payload = {"emailAddress": email_value, "type": "STANDARD"}
            if emails:
                rid = emails[0].get("getrId") or emails[0].get("rId")
                self.client.patch_email(person_id, str(rid), payload)
            else:
                self.client.create_email(person_id, payload)
            updated_fields.append("email")

        phone_value = patch_payload.get("phone")
        if phone_value:
            payload = {"number": phone_value}
            if phones:
                rid = phones[0].get("getrId") or phones[0].get("rId")
                self.client.patch_phone(person_id, str(rid), payload)
            else:
                self.client.create_phone(person_id, payload)
            updated_fields.append("phone")

        address_fields = {
            "street": patch_payload.get("street"),
            "houseNo": patch_payload.get("houseNo"),
            "postCode": patch_payload.get("postCode"),
            "city": patch_payload.get("city"),
            "countryCode": patch_payload.get("countryCode"),
            "extension": patch_payload.get("extension"),
        }
        has_address_change = any(value is not None for value in address_fields.values())

        if has_address_change:
            address_rid = "0"
            if addresses:
                address_rid = str(addresses[0].get("rId") or "0")

            current_address_payload = addresses[0] if addresses else {}
            current_address = current_address_payload.get("address") or {}
            current_house = current_address.get("housenumber") or {}

            self.client.patch_address(
                person_id,
                address_rid,
                {
                    "extension": address_fields["extension"]
                    if address_fields["extension"] is not None
                    else current_address_payload.get("extension"),
                    "address": {
                        "street": address_fields["street"]
                        if address_fields["street"] is not None
                        else current_address.get("street"),
                        "postCode": address_fields["postCode"]
                        if address_fields["postCode"] is not None
                        else current_address.get("postCode"),
                        "city": address_fields["city"]
                        if address_fields["city"] is not None
                        else current_address.get("city"),
                        "isoCountryCode": address_fields["countryCode"]
                        if address_fields["countryCode"] is not None
                        else current_address.get("isoCountryCode"),
                        "housenumber": {
                            "housenumber": address_fields["houseNo"]
                            if address_fields["houseNo"] is not None
                            else current_house.get("housenumber")
                        },
                    },
                },
            )
            updated_fields.extend(["street", "houseNo", "postCode", "city", "countryCode"])

        after_raw = self.client.get_person(person_id)

        return CustomerUpdateResult(
            before=normalize_person(before_raw),
            after=normalize_person(after_raw),
            updated_fields=sorted(set(updated_fields)),
        )
