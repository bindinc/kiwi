from __future__ import annotations

import calendar
import copy
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

WERFSLEUTEL_CHANNELS = {
    "OL/IS": {"label": "Online interne sites", "icon": "web"},
    "EM/OU": {"label": "E-mail outbound", "icon": "mail"},
    "TM/IB": {"label": "Telemarketing inbound", "icon": "phone"},
    "PR/ET": {"label": "Print eigen titels", "icon": "print"},
}

SERVICE_NUMBERS = {
    "AVROBODE": {
        "label": "AVROBODE SERVICE",
        "phone": "088-0123456",
        "color": "#2563eb",
        "icon": "book-blue",
    },
    "MIKROGIDS": {
        "label": "MIKROGIDS SERVICE",
        "phone": "088-0123457",
        "color": "#dc2626",
        "icon": "book-red",
    },
    "NCRVGIDS": {
        "label": "NCRVGIDS SERVICE",
        "phone": "088-0123458",
        "color": "#16a34a",
        "icon": "book-green",
    },
    "ALGEMEEN": {
        "label": "ALGEMEEN SERVICE",
        "phone": "088-0123459",
        "color": "#9333ea",
        "icon": "phone",
    },
}

DISPOSITION_CATEGORIES = {
    "subscription": {
        "label": "Abonnement",
        "outcomes": [
            {"code": "new_subscription", "label": "Nieuw abonnement afgesloten"},
            {"code": "subscription_changed", "label": "Abonnement gewijzigd"},
            {"code": "subscription_cancelled", "label": "Abonnement opgezegd"},
            {"code": "subscription_paused", "label": "Abonnement gepauzeerd"},
            {"code": "info_provided", "label": "Informatie verstrekt"},
        ],
    },
    "delivery": {
        "label": "Bezorging",
        "outcomes": [
            {"code": "delivery_issue_resolved", "label": "Bezorgprobleem opgelost"},
            {"code": "magazine_resent", "label": "Editie opnieuw verzonden"},
            {"code": "delivery_prefs_updated", "label": "Bezorgvoorkeuren aangepast"},
            {"code": "escalated_delivery", "label": "Geëscaleerd naar bezorging"},
        ],
    },
    "payment": {
        "label": "Betaling",
        "outcomes": [
            {"code": "payment_resolved", "label": "Betaling afgehandeld"},
            {"code": "payment_plan_arranged", "label": "Betalingsregeling getroffen"},
            {"code": "iban_updated", "label": "IBAN gegevens bijgewerkt"},
            {"code": "escalated_finance", "label": "Geëscaleerd naar financiën"},
        ],
    },
    "article_sale": {
        "label": "Artikel Verkoop",
        "outcomes": [
            {"code": "article_sold", "label": "Artikel verkocht"},
            {"code": "quote_provided", "label": "Offerte verstrekt"},
            {"code": "no_sale", "label": "Geen verkoop"},
        ],
    },
    "complaint": {
        "label": "Klacht",
        "outcomes": [
            {"code": "complaint_resolved", "label": "Klacht opgelost"},
            {"code": "complaint_escalated", "label": "Klacht geëscaleerd"},
            {"code": "callback_scheduled", "label": "Terugbelafspraak gemaakt"},
        ],
    },
    "general": {
        "label": "Algemeen",
        "outcomes": [
            {"code": "info_provided", "label": "Informatie verstrekt"},
            {"code": "transferred", "label": "Doorverbonden"},
            {"code": "customer_hung_up", "label": "Klant opgehangen"},
            {"code": "wrong_number", "label": "Verkeerd verbonden"},
            {"code": "no_answer_needed", "label": "Geen actie vereist"},
        ],
    },
}

WINBACK_OFFERS = {
    "price": [
        {
            "id": 1,
            "title": "3 Maanden 50% Korting",
            "description": "Profiteer van 50% korting op de komende 3 maanden",
            "discount": "50% korting",
        },
        {
            "id": 2,
            "title": "6 Maanden 25% Korting",
            "description": "Krijg 25% korting gedurende 6 maanden",
            "discount": "25% korting",
        },
    ],
    "content": [
        {
            "id": 3,
            "title": "Gratis Upgrade",
            "description": "Upgrade naar premium editie zonder extra kosten",
            "discount": "Gratis upgrade",
        },
        {
            "id": 4,
            "title": "Extra Content Pakket",
            "description": "Ontvang toegang tot online extra content",
            "discount": "Gratis extra's",
        },
    ],
    "delivery": [
        {
            "id": 5,
            "title": "Prioriteit Levering",
            "description": "Gegarandeerde levering voor 12:00 op vrijdag",
            "discount": "Premium service",
        },
        {
            "id": 6,
            "title": "1 Maand Gratis",
            "description": "Als excuus: volgende maand gratis",
            "discount": "1 maand gratis",
        },
    ],
    "other": [
        {
            "id": 7,
            "title": "2 Maanden Gratis",
            "description": "Blijf nog 1 jaar en krijg 2 maanden cadeau",
            "discount": "2 maanden gratis",
        },
        {
            "id": 8,
            "title": "Flexibel Abonnement",
            "description": "Pas op ieder moment zonder kosten aan of stop",
            "discount": "Flexibele voorwaarden",
        },
    ],
}

COUPONS = {
    "WELKOM10": {"type": "fixed", "amount": 10.0, "description": "Welkomstkorting"},
    "KORTING10": {"type": "fixed", "amount": 10.0, "description": "EUR10 korting"},
    "ZOMER15": {"type": "fixed", "amount": 15.0, "description": "Zomeractie"},
    "VOORJAAR20": {"type": "fixed", "amount": 20.0, "description": "Voorjaarskorting"},
    "LOYAL25": {"type": "fixed", "amount": 25.0, "description": "Loyaliteitskorting"},
    "VIP10": {"type": "percentage", "amount": 10, "description": "VIP korting 10%"},
    "SAVE15": {"type": "percentage", "amount": 15, "description": "Bespaar 15%"},
}

FALLBACK_WERFSLEUTELS = [
    {
        "salesCode": "AVRV525",
        "title": "Ja, ik blijf bij Avrobode",
        "price": 49.0,
        "barcode": "8712345000012",
        "magazine": "Avrobode",
        "isActive": True,
        "allowedChannels": ["OL/IS", "EM/OU", "TM/IB", "PR/ET"],
    },
    {
        "salesCode": "AVRV526",
        "title": "Ja, ik blijf bij Avrobode (maandelijks)",
        "price": 4.08,
        "barcode": "8712345000029",
        "magazine": "Avrobode",
        "isActive": True,
        "allowedChannels": ["OL/IS", "EM/OU", "TM/IB"],
    },
    {
        "salesCode": "AVRV519",
        "title": "1 jaar Avrobode voor EUR52",
        "price": 52.0,
        "barcode": "8712345000036",
        "magazine": "Avrobode",
        "isActive": True,
        "allowedChannels": ["OL/IS", "PR/ET"],
    },
    {
        "salesCode": "MIKV310",
        "title": "Mikrogids proef 12 nummers",
        "price": 24.0,
        "barcode": "8712345000043",
        "magazine": "Mikrogids",
        "isActive": True,
        "allowedChannels": ["EM/OU", "TM/IB"],
    },
    {
        "salesCode": "NCRV410",
        "title": "NCRV-gids jaarabonnement",
        "price": 54.5,
        "barcode": "8712345000050",
        "magazine": "Ncrvgids",
        "isActive": True,
        "allowedChannels": ["OL/IS", "PR/ET"],
    },
    {
        "salesCode": "AVRSTOP",
        "title": "Campagne gestopt - enkel naservice",
        "price": 0,
        "barcode": "8712345000067",
        "magazine": "Avrobode",
        "isActive": False,
        "allowedChannels": ["TM/IB"],
    },
]

_BASE_ARTICLES = [
    {"id": 1, "code": "AVR-JB-2023", "name": "Jaargang bundel 2023", "magazine": "Avrobode", "price": 29.95, "category": "Jaargang bundels", "popular": True, "frequency": 145},
    {"id": 2, "code": "AVR-JB-2022", "name": "Jaargang bundel 2022", "magazine": "Avrobode", "price": 29.95, "category": "Jaargang bundels", "popular": True, "frequency": 98},
    {"id": 3, "code": "AVR-SE-KERST", "name": "Kersteditie special", "magazine": "Avrobode", "price": 14.95, "category": "Speciale edities", "popular": True, "frequency": 156},
    {"id": 4, "code": "AVR-TB-KOKEN", "name": "Kookboek recepten", "magazine": "Avrobode", "price": 24.95, "category": "Themaboeken", "popular": True, "frequency": 112},
    {"id": 5, "code": "MIK-JB-2023", "name": "Jaargang bundel 2023", "magazine": "Mikrogids", "price": 49.95, "category": "Jaargang bundels", "popular": True, "frequency": 234},
    {"id": 6, "code": "MIK-JB-2022", "name": "Jaargang bundel 2022", "magazine": "Mikrogids", "price": 49.95, "category": "Jaargang bundels", "popular": True, "frequency": 167},
    {"id": 7, "code": "MIK-EX-WEEK", "name": "Extra TV gids week editie", "magazine": "Mikrogids", "price": 3.95, "category": "Extra edities", "popular": True, "frequency": 445},
    {"id": 8, "code": "MIK-EX-PREMIUM", "name": "TV Gids Premium bundel", "magazine": "Mikrogids", "price": 49.95, "category": "Extra edities", "popular": True, "frequency": 178},
    {"id": 9, "code": "NCR-JB-2023", "name": "Jaargang bundel 2023", "magazine": "Ncrvgids", "price": 49.95, "category": "Jaargang bundels", "popular": True, "frequency": 198},
    {"id": 10, "code": "NCR-JB-2022", "name": "Jaargang bundel 2022", "magazine": "Ncrvgids", "price": 49.95, "category": "Jaargang bundels", "popular": True, "frequency": 143},
    {"id": 11, "code": "NCR-EX-WEEK", "name": "Extra editie week", "magazine": "Ncrvgids", "price": 3.95, "category": "Extra edities", "popular": True, "frequency": 367},
    {"id": 12, "code": "NCR-EX-MAAND", "name": "Extra editie maand", "magazine": "Ncrvgids", "price": 9.95, "category": "Extra edities", "popular": True, "frequency": 156},
    {"id": 13, "code": "AVR-ACC-MAP", "name": "Avrobode opbergmap", "magazine": "Avrobode", "price": 8.95, "category": "Accessoires", "popular": False, "frequency": 23},
    {"id": 14, "code": "MIK-ACC-MAP", "name": "Mikrogids opbergmap", "magazine": "Mikrogids", "price": 8.95, "category": "Accessoires", "popular": False, "frequency": 34},
    {"id": 15, "code": "NCR-ACC-MAP", "name": "Ncrvgids opbergmap", "magazine": "Ncrvgids", "price": 8.95, "category": "Accessoires", "popular": False, "frequency": 31},
    {"id": 16, "code": "AVR-TB-PUZZEL", "name": "Puzzelboek special", "magazine": "Avrobode", "price": 16.95, "category": "Themaboeken", "popular": True, "frequency": 94},
    {"id": 17, "code": "MIK-TB-NETFLIX", "name": "Netflix series gids", "magazine": "Mikrogids", "price": 15.95, "category": "Themaboeken", "popular": True, "frequency": 201},
    {"id": 18, "code": "MIK-TB-CRIME", "name": "Crime series special", "magazine": "Mikrogids", "price": 17.95, "category": "Themaboeken", "popular": True, "frequency": 189},
    {"id": 19, "code": "NCR-TB-DOCUS", "name": "Documentaire top 100", "magazine": "Ncrvgids", "price": 19.95, "category": "Themaboeken", "popular": False, "frequency": 67},
    {"id": 20, "code": "NCR-TB-KINDER", "name": "Kinderprogrammas overzicht", "magazine": "Ncrvgids", "price": 15.95, "category": "Themaboeken", "popular": False, "frequency": 61},
]

_ARTICLES_CACHE: list[dict[str, Any]] | None = None
_WERFSLEUTELS_CACHE: list[dict[str, Any]] | None = None


SALES_CHANNEL_MAP = {
    "OL|IS": "OL/IS",
    "EM|OU": "EM/OU",
    "TM|IN": "TM/IB",
    "TM|IB": "TM/IB",
    "PR|ET": "PR/ET",
}


MONTH_NAMES = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
]

DAY_NAMES = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
DAY_NAMES_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]

FALLBACK_HOLIDAYS = [
    {"name": "Nieuwjaarsdag", "date": "01-01"},
    {"name": "Koningsdag", "date": "04-27"},
    {"name": "Bevrijdingsdag", "date": "05-05", "everyFiveYears": True},
    {"name": "Eerste Kerstdag", "date": "12-25"},
    {"name": "Tweede Kerstdag", "date": "12-26"},
]


def _deterministic_frequency(item_id: int) -> int:
    return ((item_id * 37) % 100) + 1


def _deterministic_price(item_id: int) -> float:
    value = 10 + ((item_id * 17) % 3000) / 100
    return round(value, 2)


def _build_articles() -> list[dict[str, Any]]:
    articles = copy.deepcopy(_BASE_ARTICLES)
    magazines = ["Avrobode", "Mikrogids", "Ncrvgids"]
    categories = ["Speciale edities", "Themaboeken", "Extra edities", "Accessoires"]
    themes = [
        "Vakantie",
        "Winter",
        "Lente",
        "Herfst",
        "Familie",
        "Lifestyle",
        "Technologie",
        "Gezondheid",
        "Mode",
        "Wonen",
    ]

    for item_id in range(21, 121):
        magazine = magazines[item_id % len(magazines)]
        category = categories[item_id % len(categories)]
        theme = themes[item_id % len(themes)]
        frequency = _deterministic_frequency(item_id)
        code_prefix = magazine[:3].upper()
        category_prefix = "".join([part[0] for part in category.split()])[:2].upper()

        articles.append(
            {
                "id": item_id,
                "code": f"{code_prefix}-{category_prefix}-{item_id}",
                "name": f"{theme} {category.lower()}",
                "magazine": magazine,
                "price": _deterministic_price(item_id),
                "category": category,
                "popular": frequency > 70,
                "frequency": frequency,
            }
        )

    articles.sort(key=lambda article: article["frequency"], reverse=True)
    return articles


def get_articles() -> list[dict[str, Any]]:
    global _ARTICLES_CACHE
    if _ARTICLES_CACHE is None:
        _ARTICLES_CACHE = _build_articles()
    return copy.deepcopy(_ARTICLES_CACHE)


def find_article(article_id: int) -> dict[str, Any] | None:
    for article in get_articles():
        if int(article.get("id", -1)) == int(article_id):
            return article
    return None


def search_articles(
    query: str = "",
    magazine: str | None = None,
    popular: bool = False,
    tab: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    query_normalized = query.strip().lower()
    articles = get_articles()

    if tab:
        tab_normalized = tab.strip().lower()
        if tab_normalized == "popular":
            articles = [article for article in articles if article.get("popular")]
        elif tab_normalized not in {"all", ""}:
            articles = [article for article in articles if article.get("magazine", "").lower() == tab_normalized]

    if magazine:
        magazine_normalized = magazine.strip().lower()
        articles = [article for article in articles if article.get("magazine", "").lower() == magazine_normalized]

    if popular:
        articles = [article for article in articles if article.get("popular")]

    if query_normalized:
        articles = [
            article
            for article in articles
            if query_normalized in article.get("name", "").lower()
            or query_normalized in article.get("code", "").lower()
            or query_normalized in article.get("magazine", "").lower()
            or query_normalized in article.get("category", "").lower()
        ]

    safe_limit = max(1, min(limit, 250))
    return articles[:safe_limit]


def _build_werfsleutel_barcode(offer_id: str, sales_code: str) -> str:
    offer_digits = re.sub(r"[^0-9]", "", str(offer_id or ""))[-10:]
    if offer_digits:
        return f"872{offer_digits.zfill(10)}"

    numbers = re.sub(r"[^0-9]", "", sales_code)
    if len(numbers) >= 13:
        return numbers[:13]

    hashed = 0
    for char in sales_code:
        hashed = (hashed * 31 + ord(char)) & 0xFFFFFFFF
    base = str(hashed % 1_000_000_000).zfill(9)
    return f"87{base}".ljust(13, "0")


def _infer_magazine_from_title(title: str) -> str:
    normalized = title.lower()
    if "avrobode" in normalized:
        return "Avrobode"
    if "mikrogids" in normalized:
        return "Mikrogids"
    if "ncrv" in normalized:
        return "Ncrvgids"
    return "Onbekend"


def _parse_werfsleutels_from_markdown(markdown: str) -> list[dict[str, Any]]:
    entries: dict[str, dict[str, Any]] = {}
    for line in markdown.splitlines():
        if not line.strip().startswith("|"):
            continue
        if re.match(r"^\|\s*-+", line):
            continue

        cells = [cell.strip() for cell in line.split("|")[1:-1]]
        if len(cells) < 8:
            continue

        sales_code, offer_id, title, offer_price, _offer_url, channel1, channel2, _channel3 = cells[:8]
        if not sales_code or sales_code.lower() == "salescode":
            continue

        canonical_channel = SALES_CHANNEL_MAP.get(f"{channel1}|{channel2}".upper())
        price = float(str(offer_price).replace(",", ".") or 0)
        normalized_code = sales_code.strip()

        if normalized_code not in entries:
            entries[normalized_code] = {
                "salesCode": normalized_code,
                "title": title,
                "price": price,
                "offerId": offer_id,
                "barcode": _build_werfsleutel_barcode(offer_id, normalized_code),
                "magazine": _infer_magazine_from_title(title),
                "isActive": "STOP" not in normalized_code.upper(),
                "allowedChannels": set([canonical_channel]) if canonical_channel else set(),
            }
        elif canonical_channel:
            entries[normalized_code]["allowedChannels"].add(canonical_channel)

    parsed: list[dict[str, Any]] = []
    all_channels = sorted(WERFSLEUTEL_CHANNELS.keys())
    for entry in entries.values():
        channels = sorted(entry["allowedChannels"]) if entry["allowedChannels"] else all_channels
        parsed.append(
            {
                "salesCode": entry["salesCode"],
                "title": entry["title"] or "Onbekende werfsleutel",
                "price": entry["price"] or 0,
                "barcode": entry["barcode"],
                "magazine": entry["magazine"],
                "isActive": entry["isActive"],
                "allowedChannels": channels,
            }
        )

    return parsed


def get_werfsleutels() -> list[dict[str, Any]]:
    global _WERFSLEUTELS_CACHE
    if _WERFSLEUTELS_CACHE is not None:
        return copy.deepcopy(_WERFSLEUTELS_CACHE)

    markdown_path = Path(__file__).resolve().parent.parent / "static" / "assets" / "onepager_werfsleutels.md"
    parsed: list[dict[str, Any]] = []

    if markdown_path.exists():
        try:
            parsed = _parse_werfsleutels_from_markdown(markdown_path.read_text(encoding="utf-8"))
        except OSError:
            parsed = []

    _WERFSLEUTELS_CACHE = parsed if parsed else copy.deepcopy(FALLBACK_WERFSLEUTELS)
    return copy.deepcopy(_WERFSLEUTELS_CACHE)


def search_werfsleutels(query: str = "", barcode: str = "", limit: int = 20) -> list[dict[str, Any]]:
    query_normalized = query.strip().lower()
    barcode_normalized = re.sub(r"[^0-9]", "", barcode or "")
    items = get_werfsleutels()

    if barcode_normalized:
        items = [item for item in items if re.sub(r"[^0-9]", "", item.get("barcode", "")) == barcode_normalized]

    if query_normalized:
        items = [
            item
            for item in items
            if query_normalized in item.get("salesCode", "").lower()
            or query_normalized in item.get("title", "").lower()
            or query_normalized in str(item.get("price", "")).lower()
            or query_normalized in item.get("magazine", "").lower()
        ]

    safe_limit = max(1, min(limit, 250))
    return items[:safe_limit]


def _calculate_easter(year: int) -> date:
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _holidays_for_year(year: int) -> set[date]:
    holidays: set[date] = set()

    for holiday in FALLBACK_HOLIDAYS:
        if holiday.get("name") == "Bevrijdingsdag" and holiday.get("everyFiveYears"):
            if year % 5 != 0:
                continue
        month_str, day_str = holiday["date"].split("-")
        holidays.add(date(year, int(month_str), int(day_str)))

    easter = _calculate_easter(year)
    holidays.add(easter - timedelta(days=2))
    holidays.add(easter)
    holidays.add(easter + timedelta(days=1))
    holidays.add(easter + timedelta(days=39))
    holidays.add(easter + timedelta(days=49))
    holidays.add(easter + timedelta(days=50))

    return holidays


def _is_delivery_day(candidate: date) -> bool:
    if candidate.weekday() == 6:
        return False
    return candidate not in _holidays_for_year(candidate.year)


def get_minimum_delivery_date(today: date | None = None) -> date:
    current = today or date.today()
    business_days = 0
    scan = current

    while business_days < 2:
        scan = scan + timedelta(days=1)
        if _is_delivery_day(scan):
            business_days += 1

    return scan


def get_delivery_calendar(year: int, month: int) -> dict[str, Any]:
    today = date.today()
    min_delivery_date = get_minimum_delivery_date(today)
    recommended_date = min_delivery_date

    days_in_month = calendar.monthrange(year, month)[1]
    day_items: list[dict[str, Any]] = []

    for day in range(1, days_in_month + 1):
        current = date(year, month, day)
        available = _is_delivery_day(current) and current >= min_delivery_date

        day_items.append(
            {
                "date": current.isoformat(),
                "day": day,
                "weekday": DAY_NAMES[current.weekday()],
                "weekdayShort": DAY_NAMES_SHORT[current.weekday()],
                "available": available,
                "past": current < today,
                "recommended": current == recommended_date,
                "title": f"{DAY_NAMES[current.weekday()]} {day} {MONTH_NAMES[month - 1]}",
            }
        )

    return {
        "year": year,
        "month": month,
        "monthLabel": f"{MONTH_NAMES[month - 1]} {year}",
        "today": today.isoformat(),
        "minimumDate": min_delivery_date.isoformat(),
        "recommendedDate": recommended_date.isoformat(),
        "days": day_items,
    }


def _safe_int(raw_value: Any, default: int) -> int:
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return default


def _safe_float(raw_value: Any, default: float) -> float:
    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return default


def _normalize_order_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []

    for raw_item in items:
        if not isinstance(raw_item, dict):
            continue

        article_id_raw = raw_item.get("articleId")
        article_id = _safe_int(article_id_raw, default=-1)
        has_article_id = article_id != -1
        catalog_article = find_article(article_id) if has_article_id else None

        quantity = _safe_int(raw_item.get("quantity"), default=1)
        quantity = max(quantity, 1)

        unit_price = raw_item.get("unitPrice")
        if unit_price is None and catalog_article:
            unit_price = catalog_article.get("price")

        name = raw_item.get("name") or (catalog_article.get("name") if catalog_article else "Artikel")
        code = raw_item.get("code") or (catalog_article.get("code") if catalog_article else "")
        magazine = raw_item.get("magazine") or (catalog_article.get("magazine") if catalog_article else "Onbekend")

        normalized.append(
            {
                "articleId": article_id if has_article_id else article_id_raw,
                "code": code,
                "name": name,
                "unitPrice": round(_safe_float(unit_price, default=0.0), 2),
                "quantity": quantity,
                "magazine": magazine,
            }
        )

    return normalized


def _calculate_discounts(items: list[dict[str, Any]], coupon_code: str | None) -> tuple[list[dict[str, Any]], float, dict[str, Any] | None]:
    discounts: list[dict[str, Any]] = []
    subtotal = sum(item["unitPrice"] * item["quantity"] for item in items)
    total_discount = 0.0

    volume_discounts: list[dict[str, Any]] = []
    volume_total = 0.0
    for item in items:
        if item["quantity"] >= 5:
            item_total = item["unitPrice"] * item["quantity"]
            amount = round(item_total * 0.10, 2)
            volume_discounts.append(
                {
                    "type": "Stapelkorting",
                    "icon": "stack",
                    "description": f"10% korting op {item['name']} ({item['quantity']}x)",
                    "amount": amount,
                    "itemName": item["name"],
                }
            )
            volume_total += amount

    magazines = {item["magazine"] for item in items}
    if len(magazines) == 3 and len(items) >= 3:
        bundle_discount = round(subtotal * 0.15, 2)
        if bundle_discount > volume_total:
            discounts = [
                {
                    "type": "Bundelkorting",
                    "icon": "bundle",
                    "description": "Artikelen van alle 3 magazines",
                    "amount": bundle_discount,
                }
            ]
            total_discount = bundle_discount
        else:
            discounts = volume_discounts
            total_discount = round(volume_total, 2)
    else:
        discounts = volume_discounts
        total_discount = round(volume_total, 2)

    if subtotal >= 100 and total_discount == 0:
        amount = round(subtotal * 0.05, 2)
        discounts.append(
            {
                "type": "Actiekorting",
                "icon": "target",
                "description": "Bij bestellingen vanaf EUR100",
                "amount": amount,
            }
        )
        total_discount = round(total_discount + amount, 2)

    coupon_result: dict[str, Any] | None = None
    if coupon_code:
        normalized_coupon = coupon_code.strip().upper()
        coupon = COUPONS.get(normalized_coupon)

        if coupon:
            coupon_discount = 0.0
            if coupon["type"] == "fixed":
                coupon_discount = min(float(coupon["amount"]), max(0.0, subtotal - total_discount))
            else:
                coupon_discount = (subtotal - total_discount) * (float(coupon["amount"]) / 100)

            coupon_discount = round(max(coupon_discount, 0.0), 2)
            if coupon_discount > 0:
                discounts.append(
                    {
                        "type": "Kortingscode",
                        "icon": "coupon",
                        "description": f"{coupon['description']} ({normalized_coupon})",
                        "amount": coupon_discount,
                        "isCoupon": True,
                    }
                )
                total_discount = round(total_discount + coupon_discount, 2)

            coupon_result = {
                "valid": True,
                "code": normalized_coupon,
                "type": coupon["type"],
                "amount": coupon["amount"],
                "description": coupon["description"],
            }
        else:
            coupon_result = {
                "valid": False,
                "code": normalized_coupon,
                "message": f'Kortingscode "{normalized_coupon}" is ongeldig',
            }

    return discounts, total_discount, coupon_result


def quote_article_order(items: list[dict[str, Any]], coupon_code: str | None = None) -> dict[str, Any]:
    normalized_items = _normalize_order_items(items)
    subtotal = round(sum(item["unitPrice"] * item["quantity"] for item in normalized_items), 2)
    discounts, total_discount, coupon = _calculate_discounts(normalized_items, coupon_code)
    total = round(subtotal - total_discount, 2)

    return {
        "items": normalized_items,
        "subtotal": subtotal,
        "discounts": discounts,
        "totalDiscount": round(total_discount, 2),
        "total": total,
        "couponCode": coupon.get("code") if coupon and coupon.get("valid") else None,
        "coupon": coupon,
    }


def get_winback_offers(reason: str | None) -> list[dict[str, Any]]:
    normalized_reason = (reason or "other").strip().lower()
    if normalized_reason not in WINBACK_OFFERS:
        normalized_reason = "other"
    return copy.deepcopy(WINBACK_OFFERS[normalized_reason])


def get_service_numbers() -> dict[str, Any]:
    return copy.deepcopy(SERVICE_NUMBERS)


def get_disposition_categories() -> dict[str, Any]:
    return copy.deepcopy(DISPOSITION_CATEGORIES)


def get_werfsleutel_channels() -> dict[str, Any]:
    return copy.deepcopy(WERFSLEUTEL_CHANNELS)


def get_coupons() -> dict[str, Any]:
    return copy.deepcopy(COUPONS)


def get_catalog_bootstrap() -> dict[str, Any]:
    today = datetime.now().date()
    return {
        "serviceNumbers": get_service_numbers(),
        "dispositionCategories": get_disposition_categories(),
        "werfsleutelChannels": get_werfsleutel_channels(),
        "delivery": {
            "recommendedDate": get_minimum_delivery_date(today).isoformat(),
            "today": today.isoformat(),
        },
    }
