"""Parsing of raw import values into a canonical value plus unit.

The guiding rule is that this module never guesses. A number whose unit is not
stated somewhere — in the key, in the value, or in an explicit ``unit`` member
— is reported as needing clarification rather than being interpreted as the
canonical unit. Silently reading ``30`` as ``30 m`` is exactly the class of
mistake the import flow exists to prevent.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from farm.enum_normalization import normalize_seed_rate_unit

from .field_specs import DIMENSION_LENGTH, SEED_RATE_UNIT_VALUES

# Confidence levels reported per field in the preview.
CONFIDENCE_EXACT = 'exact'
CONFIDENCE_CONVERTED = 'converted'
CONFIDENCE_NEEDS_CLARIFICATION = 'needs_clarification'
CONFIDENCE_INVALID = 'invalid'

# Length units accepted on input, with their factor to the canonical metre.
# Anything outside this table is an unknown unit and is rejected — an import
# must not invent a conversion it was never taught.
LENGTH_UNITS_TO_METRE: dict[str, Decimal] = {
    'm': Decimal('1'),
    'meter': Decimal('1'),
    'metre': Decimal('1'),
    'meters': Decimal('1'),
    'cm': Decimal('0.01'),
    'centimeter': Decimal('0.01'),
    'centimetre': Decimal('0.01'),
    'zentimeter': Decimal('0.01'),
    'mm': Decimal('0.001'),
    'millimeter': Decimal('0.001'),
    'millimetre': Decimal('0.001'),
}

CANONICAL_UNIT_BY_DIMENSION = {DIMENSION_LENGTH: 'm'}

# "12,5 cm", "12.5cm", "0,4 m" — a number followed by an optional unit word.
_NUMBER_WITH_UNIT = re.compile(
    r'^\s*(?P<number>[+-]?\d+(?:[.,]\d+)?)\s*(?P<unit>[a-zA-Z_²/µ]*)\s*$'
)


@dataclass(frozen=True)
class ParsedAmount:
    """A raw value decomposed into its number and the unit it was stated in."""

    number: Decimal | None
    unit: str | None
    # True when the source explicitly named a unit, as opposed to the unit
    # being implied by the key alone.
    unit_was_explicit: bool
    error: str | None = None


def parse_raw_amount(raw_value: object, implied_unit: str | None) -> ParsedAmount:
    """Split a raw import value into number and unit.

    Recognizes three shapes: a bare number, a string such as ``"50 cm"``, and a
    mapping such as ``{"value": 50, "unit": "cm"}``. A unit stated in the value
    always wins over the one implied by the key.

    :param raw_value: Value exactly as it appeared in the payload.
    :param implied_unit: Unit implied by the input key, or None.
    :return: The parsed amount, or one carrying an ``error`` code.
    """
    if isinstance(raw_value, dict):
        return _parse_mapping_amount(raw_value, implied_unit)
    if isinstance(raw_value, bool):
        return ParsedAmount(None, None, False, error='not_a_number')
    if isinstance(raw_value, int | float | Decimal):
        return ParsedAmount(_to_decimal(raw_value), implied_unit, False)
    if isinstance(raw_value, str):
        return _parse_string_amount(raw_value, implied_unit)
    return ParsedAmount(None, None, False, error='not_a_number')


def _parse_mapping_amount(raw_value: dict, implied_unit: str | None) -> ParsedAmount:
    """Parse the ``{"value": …, "unit": …}`` shape."""
    inner_value = raw_value.get('value')
    inner_unit = raw_value.get('unit')
    parsed = parse_raw_amount(inner_value, implied_unit)
    if parsed.error:
        return parsed
    if inner_unit is None or str(inner_unit).strip() == '':
        return parsed
    return ParsedAmount(parsed.number, str(inner_unit).strip(), True)


def _parse_string_amount(raw_value: str, implied_unit: str | None) -> ParsedAmount:
    """Parse a string that may carry an inline unit, e.g. ``"50 cm"``."""
    match = _NUMBER_WITH_UNIT.match(raw_value)
    if match is None:
        return ParsedAmount(None, None, False, error='not_a_number')
    number = _to_decimal(match.group('number').replace(',', '.'))
    if number is None:
        return ParsedAmount(None, None, False, error='not_a_number')
    unit_text = (match.group('unit') or '').strip()
    if unit_text:
        return ParsedAmount(number, unit_text, True)
    return ParsedAmount(number, implied_unit, False)


def _to_decimal(value: object) -> Decimal | None:
    """Convert a numeric-ish value to Decimal, or None when it is not numeric."""
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


@dataclass(frozen=True)
class ConvertedValue:
    """Outcome of converting a parsed amount into the canonical unit."""

    value: Decimal | None
    canonical_unit: str | None
    source_unit: str | None
    confidence: str
    error: str | None = None


def convert_to_canonical_length(parsed: ParsedAmount) -> ConvertedValue:
    """Convert a parsed length into metres.

    :param parsed: Amount produced by :func:`parse_raw_amount`.
    :return: The converted value, or one carrying an error / clarification code.
    """
    if parsed.error or parsed.number is None:
        return ConvertedValue(
            None, 'm', parsed.unit, CONFIDENCE_INVALID, parsed.error or 'not_a_number'
        )
    if not parsed.unit:
        # No unit anywhere: the only honest answer is to ask.
        return ConvertedValue(None, 'm', None, CONFIDENCE_NEEDS_CLARIFICATION, 'unit_missing')

    normalized_unit = parsed.unit.strip().lower()
    factor = LENGTH_UNITS_TO_METRE.get(normalized_unit)
    if factor is None:
        return ConvertedValue(None, 'm', parsed.unit, CONFIDENCE_INVALID, 'unit_unknown')

    converted = parsed.number * factor
    confidence = CONFIDENCE_EXACT if factor == Decimal('1') else CONFIDENCE_CONVERTED
    return ConvertedValue(converted, 'm', normalized_unit, confidence)


def convert_plain_number(parsed: ParsedAmount, expected_unit: str | None) -> ConvertedValue:
    """Validate a number whose unit is fixed by the field (days, percent, grams).

    These fields have exactly one legal unit, so a stated unit is only checked
    for agreement rather than converted.

    :param parsed: Amount produced by :func:`parse_raw_amount`.
    :param expected_unit: The field's canonical unit, or None for unitless values.
    :return: The validated value, or one carrying an error code.
    """
    if parsed.error or parsed.number is None:
        return ConvertedValue(
            None, expected_unit, parsed.unit, CONFIDENCE_INVALID, parsed.error or 'not_a_number'
        )
    if parsed.unit_was_explicit and expected_unit:
        if parsed.unit.strip().lower() not in _accepted_spellings(expected_unit):
            return ConvertedValue(
                None, expected_unit, parsed.unit, CONFIDENCE_INVALID, 'unit_unknown'
            )
    return ConvertedValue(
        parsed.number, expected_unit, parsed.unit or expected_unit, CONFIDENCE_EXACT
    )


def _accepted_spellings(canonical_unit: str) -> set[str]:
    """Return the spellings accepted for a fixed-unit field."""
    spellings = {
        'days': {'days', 'day', 'tage', 'tag', 'd'},
        'percent': {'percent', '%', 'prozent', 'pct'},
        'g': {'g', 'gram', 'grams', 'gramm'},
        'kg': {'kg', 'kilogram', 'kilograms', 'kilogramm'},
    }
    return spellings.get(canonical_unit, {canonical_unit})


def normalize_seed_rate_unit_input(raw_unit: object) -> tuple[str | None, str | None]:
    """Map a seed-rate unit spelling to the project's canonical vocabulary.

    Only the five units already defined in :mod:`farm.seed_units` can result
    from this; synonyms are translated, and anything unrecognized is rejected
    rather than passed through.

    :param raw_unit: Unit value from the payload.
    :return: Tuple of canonical unit (or None) and error code (or None).
    """
    if raw_unit is None:
        return None, 'unit_missing'
    text = str(raw_unit).strip()
    if not text or text == '-':
        return None, 'unit_missing'
    canonical = normalize_seed_rate_unit(text)
    if canonical is None or canonical not in SEED_RATE_UNIT_VALUES:
        return None, 'unit_unknown'
    return canonical, None
