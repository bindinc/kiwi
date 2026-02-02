"""Utilities to normalize and format address related values."""
import re

HOUSE_NUMBER_PATTERN = r'^[1-9][0-9]{0,5}[A-Z]?$'
_HOUSE_NUMBER_REGEX = re.compile(HOUSE_NUMBER_PATTERN)


def normalize_houseno(value):
    """Return a compact house number with optional uppercase suffix."""
    if not isinstance(value, str):
        return ''

    stripped_value = value.strip()
    if not stripped_value:
        return ''

    compact_value = re.sub(r'\s+', '', stripped_value)
    return compact_value.upper()


def is_valid_houseno(value):
    """Check if the provided value matches the required house number pattern."""
    if not isinstance(value, str):
        return False
    return bool(_HOUSE_NUMBER_REGEX.fullmatch(value))


def format_street_name(value):
    """Ensure a street name starts with a capital followed by lowercase letters."""
    if not isinstance(value, str):
        return ''

    cleaned_value = value.strip()
    if not cleaned_value:
        return ''

    first_character = cleaned_value[0].upper()
    remaining_text = cleaned_value[1:].lower()
    return f'{first_character}{remaining_text}'
