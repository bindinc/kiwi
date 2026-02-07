from __future__ import annotations

from flask import Blueprint, request

from blueprints.api.common import parse_query_int
from services import poc_catalog

BLUEPRINT_NAME = "offers_api"
URL_PREFIX = "/offers"

offers_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


@offers_bp.get("/werfsleutels")
def read_werfsleutel_offers() -> tuple[dict, int]:
    query = request.args.get("query", "")
    barcode = request.args.get("barcode", "")
    limit, error = parse_query_int("limit", default=20, minimum=1, maximum=250)
    if error:
        return error

    items = poc_catalog.search_werfsleutels(query=query, barcode=barcode, limit=limit)
    return {"items": items, "total": len(items)}, 200


@offers_bp.get("/winback")
def read_winback_offers() -> tuple[dict, int]:
    reason = request.args.get("reason")
    items = poc_catalog.get_winback_offers(reason)
    return {"reason": reason or "other", "items": items}, 200
