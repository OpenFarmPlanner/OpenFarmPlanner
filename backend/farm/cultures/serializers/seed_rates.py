"""Seed-rate unit constants and per-entry validation helpers."""

from rest_framework import serializers

from farm.enum_normalization import normalize_seed_rate_unit
from farm.seed_units import (
    SEED_RATE_UNIT_G_PER_LFM,
    SEED_RATE_UNIT_G_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_LFM,
    SEED_RATE_UNIT_SEEDS_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_PLANT,
    SEED_RATE_UNITS,
)
from farm.services.culture_import.field_specs import seed_rate_value_constraint_error

EMPTY_SEED_RATE_UNIT_VALUES = {None, '', '-'}

PRE_CULTIVATION_SEED_RATE_UNITS = {
    SEED_RATE_UNIT_G_PER_M2,
    SEED_RATE_UNIT_G_PER_LFM,
    SEED_RATE_UNIT_SEEDS_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_LFM,
    SEED_RATE_UNIT_SEEDS_PER_PLANT,
}


def _seed_rate_entry_error(method: str, payload: object) -> str | None:
    """Return the validation error for one seed-rate-by-cultivation entry, if any."""
    if not isinstance(payload, dict):
        return 'Seed rate entries must be objects.'
    try:
        parsed_value = float(payload.get('value'))
    except (TypeError, ValueError):
        return 'Seed rate values must be numeric.'
    if parsed_value <= 0:
        return 'Seed rate values must be positive.'
    unit = payload.get('unit')
    if method == 'pre_cultivation' and unit not in PRE_CULTIVATION_SEED_RATE_UNITS:
        return 'Pre-cultivation seed rate unit is unsupported.'
    if method == 'direct_sowing' and unit not in SEED_RATE_UNITS:
        return 'Direct sowing seed rate unit is unsupported.'
    constraint_error = seed_rate_value_constraint_error(parsed_value, unit)
    if constraint_error == 'whole_number_required':
        return 'Seed rate value must be a whole number for this unit.'
    if constraint_error == 'below_unit_minimum':
        return 'Seed rate value is below the minimum for this unit.'
    return None


def _normalize_seed_rate_unit_value(value: object) -> str | None:
    """Normalize supported seed rate units and legacy empty placeholders."""
    if value in EMPTY_SEED_RATE_UNIT_VALUES:
        return None
    normalized_value = normalize_seed_rate_unit(value)
    if normalized_value:
        return normalized_value
    raise serializers.ValidationError('Unsupported seed rate unit.')
