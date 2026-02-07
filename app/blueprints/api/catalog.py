from __future__ import annotations

from datetime import date

from flask import Blueprint, request

from blueprints.api.common import api_error, parse_query_int
from services import poc_catalog

BLUEPRINT_NAME = "catalog_api"
URL_PREFIX = "/catalog"

catalog_bp = Blueprint(BLUEPRINT_NAME, __name__, url_prefix=URL_PREFIX)


@catalog_bp.get("/articles")
def read_articles() -> tuple[dict, int]:
    query = request.args.get("query", "")
    magazine = request.args.get("magazine")
    tab = request.args.get("tab")
    limit, error = parse_query_int("limit", default=20, minimum=1, maximum=250)
    if error:
        return error

    popular_arg = (request.args.get("popular") or "").strip().lower()
    popular = popular_arg in {"1", "true", "yes", "on"}

    items = poc_catalog.search_articles(
        query=query,
        magazine=magazine,
        popular=popular,
        tab=tab,
        limit=limit,
    )
    return {"items": items, "total": len(items)}, 200


@catalog_bp.get("/articles/<int:article_id>")
def read_article(article_id: int) -> tuple[dict, int]:
    article = poc_catalog.find_article(article_id)
    if article is None:
        return api_error(404, "article_not_found", "Article was not found")

    return article, 200


@catalog_bp.post("/article-order-quote")
def quote_article_order() -> tuple[dict, int]:
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return api_error(400, "invalid_payload", "JSON object expected")

    items = payload.get("items") if isinstance(payload.get("items"), list) else []
    coupon_code = payload.get("couponCode")

    quote = poc_catalog.quote_article_order(items=items, coupon_code=coupon_code)
    return quote, 200


@catalog_bp.get("/delivery-calendar")
def read_delivery_calendar() -> tuple[dict, int]:
    today = date.today()
    year, year_error = parse_query_int("year", default=today.year, minimum=1900, maximum=2200)
    if year_error:
        return year_error

    month, month_error = parse_query_int("month", default=today.month, minimum=1, maximum=12)
    if month_error:
        return month_error

    if month < 1 or month > 12:
        return api_error(400, "invalid_month", "Month must be between 1 and 12")

    data = poc_catalog.get_delivery_calendar(year, month)
    return data, 200


@catalog_bp.get("/disposition-options")
def read_disposition_options() -> tuple[dict, int]:
    return {"categories": poc_catalog.get_disposition_categories()}, 200


@catalog_bp.get("/service-numbers")
def read_service_numbers() -> tuple[dict, int]:
    return {"serviceNumbers": poc_catalog.get_service_numbers()}, 200
