"""Utility helpers for offer-related logic."""

from __future__ import annotations

from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

OfferData = Any


def extract_bedankt_url(offers: OfferData) -> str | None:
    """Return a validated bedankt URL extracted from the offer selection."""
    if not offers:
        return None

    primary_offer: OfferData
    if isinstance(offers, Sequence) and not isinstance(offers, (str, bytes)):
        primary_offer = offers[0] if offers else None
    else:
        primary_offer = offers

    if primary_offer is None:
        return None

    if isinstance(primary_offer, Mapping):
        price_summary = primary_offer.get('priceCalculationSummary')
    else:
        price_summary = getattr(primary_offer, 'priceCalculationSummary', None)

    if not isinstance(price_summary, Mapping):
        return None

    raw_url = price_summary.get('bedankt_url')
    if not isinstance(raw_url, str):
        return None

    bedankt_url = raw_url.strip()
    if not bedankt_url:
        return None

    parsed_url = urlparse(bedankt_url)
    if parsed_url.scheme not in ('http', 'https'):
        return None
    if not parsed_url.netloc:
        return None

    return bedankt_url
