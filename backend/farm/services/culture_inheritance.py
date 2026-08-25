"""Effective culture values for Sorten that inherit from their general Kultur.

A project holds one general Kultur per crop species (a ``Culture`` row with
``crop_species`` set and an empty ``variety``) plus any number of Sorten (rows
with the same ``crop_species`` and a variety). A Sorte only stores the values it
actually overrides; every field it leaves unset falls back to the general
Kultur's value. This module owns that fallback so the API, the planning
calculations and the crop-library UI all resolve it the same way.

Free-text Sorten (no ``crop_species``) have no general Kultur to fall back to
and therefore always resolve to their own values.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Q
from django.utils import timezone

from farm.models import Culture
from farm.models.cultures import compute_plants_per_m2

# Culture fields a Sorte inherits from its general Kultur. Kept in sync with the
# frontend's `VARIETY_INHERITABLE_FIELDS` (frontend/src/cultures/varietyValueSource.ts),
# which prefills a new Sorte from the same set, with two deliberate differences:
#
# - `allow_deviation_delivery_weeks` is a non-null boolean with a default, so it
#   has no "unset" state to fall back from and could never inherit.
# - The legacy `seed_rate_value`/`seed_rate_unit` pair and the derived
#   `seed_rate_by_cultivation` map are left out: the latter is validated as a
#   subset of the row's own `cultivation_types`, so inheriting it independently
#   could produce a combination the model itself rejects.
#
# Names are model field names; distances are the SI (meter) fields.
CULTURE_INHERITABLE_FIELDS: tuple[str, ...] = (
    'crop_family',
    'nutrient_demand',
    'rotation_break_years',
    'cultivation_type',
    'cultivation_types',
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'harvest_method',
    'expected_yield',
    'distance_within_row_m',
    'row_spacing_m',
    'sowing_depth_m',
    'sowing_calculation_safety_percent',
    'sowing_calculation_safety_percent_direct',
    'sowing_calculation_safety_percent_pre_cultivation',
    'thousand_kernel_weight_g',
    'seeding_requirement',
    'seeding_requirement_type',
    'seed_rate_direct_value',
    'seed_rate_direct_unit',
    'seed_rate_pre_cultivation_value',
    'seed_rate_pre_cultivation_unit',
)

CULTURE_SPECIES_INVARIANT_FIELDS: tuple[str, ...] = (
    'crop_family',
    'nutrient_demand',
    'rotation_break_years',
)

CULTURE_OPTIONAL_GENERAL_COPY_FIELDS: tuple[str, ...] = (
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'harvest_method',
    'expected_yield',
    'distance_within_row_m',
    'row_spacing_m',
    'sowing_depth_m',
    'sowing_calculation_safety_percent',
    'sowing_calculation_safety_percent_direct',
    'sowing_calculation_safety_percent_pre_cultivation',
    'thousand_kernel_weight_g',
    'seeding_requirement',
    'seeding_requirement_type',
    'seed_rate_direct_value',
    'seed_rate_direct_unit',
    'seed_rate_pre_cultivation_value',
    'seed_rate_pre_cultivation_unit',
)

# Legacy placeholder some seed-rate unit columns still carry; treated as unset.
_EMPTY_UNIT_PLACEHOLDER = '-'

_UNRESOLVED = object()

GeneralCultureIndex = dict[int, Culture]


def ensure_general_culture_for_variety(
    variety: Culture,
    *,
    copy_values: bool = False,
) -> Culture | None:
    """Ensure a linked Sorte has a general Kultur and seed eligible gaps.

    Species-invariant fields are promoted to empty general Kultur fields
    automatically. Variety-variable defaults are promoted only through the
    explicit create-time choice. Neither path replaces existing project
    defaults.
    """
    if not inherits_from_general_culture(variety):
        return None

    fields_to_copy = (
        CULTURE_SPECIES_INVARIANT_FIELDS
        + (CULTURE_OPTIONAL_GENERAL_COPY_FIELDS if copy_values else ())
    )
    general_row_q = Q(variety_normalized__isnull=True) | Q(variety_normalized='')
    general = (
        Culture.objects
        .filter(
            general_row_q,
            project_id=variety.project_id,
            crop_species_id=variety.crop_species_id,
        )
        .order_by('pk')
        .first()
    )
    if general is None:
        # unique_general_culture_name_per_project scopes by name alone, not by
        # crop_species, so a general Kultur for an unrelated species can already
        # own this name. Creating one here would collide with that constraint;
        # skip auto-creation instead of failing the variety save over a name
        # that isn't this variety's to claim.
        name_taken_by_other_species = (
            Culture.objects
            .filter(
                general_row_q,
                project_id=variety.project_id,
                name_normalized=variety.name_normalized,
            )
            .exclude(crop_species_id=variety.crop_species_id)
            .exists()
        )
        if name_taken_by_other_species:
            return None
        defaults: dict[str, Any] = {
            field: getattr(variety, field)
            for field in fields_to_copy
            if not is_unset_culture_value(getattr(variety, field))
        }
        return Culture.objects.create(
            project_id=variety.project_id,
            crop_species_id=variety.crop_species_id,
            name=variety.name,
            variety='',
            **defaults,
        )

    changed_fields: list[str] = []
    for field in fields_to_copy:
        general_value = getattr(general, field)
        variety_value = getattr(variety, field)
        if is_unset_culture_value(general_value) and not is_unset_culture_value(variety_value):
            setattr(general, field, variety_value)
            changed_fields.append(field)
    if changed_fields:
        general.save(update_fields=changed_fields)
    return general


def sync_crop_species_across_culture_group(culture: Culture) -> int:
    """Hand a culture's crop species to the species-less rows of its Kultur group.

    A Kultur group has no table of its own: its rows belong together through
    their ``crop_species`` as soon as one of them is linked to a species, and
    through their name while none is — the same grouping the frontend's
    ``getCropSpeciesKey`` and ``CultureViewSet._rename_sibling_cultures`` use.
    Linking a single Sorte to a species therefore splits its group in two: the
    linked Sorte on one side, the general Kultur and the remaining Sorten on
    the other, which shows up as two Kulturen of the same name in the culture
    tree and stops the Sorte from inheriting its general Kultur's values. Rows
    that already carry a *different* species are a deliberately separate group
    and stay untouched.

    Returns the number of rows that adopted the species. They are written
    through the queryset instead of ``save()`` on purpose: adopting the species
    keeps the group's existing identity intact rather than editing those rows,
    so it should neither record a history revision nor flag them as diverged
    from their public source.
    """
    if not culture.crop_species_id or not culture.name_normalized:
        return 0
    return (
        Culture.objects
        .filter(
            project_id=culture.project_id,
            name_normalized=culture.name_normalized,
            crop_species__isnull=True,
        )
        .exclude(pk=culture.pk)
        .update(crop_species_id=culture.crop_species_id, updated_at=timezone.now())
    )


def is_unset_culture_value(value: Any) -> bool:
    """Whether a culture field holds no value and may fall back to the Kultur.

    ``False`` and ``0`` are real values, not gaps — only ``None``, blank text and
    empty collections count as unset.
    """
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip() or value.strip() == _EMPTY_UNIT_PLACEHOLDER
    if isinstance(value, (list, tuple, dict, set)):
        return not value
    return False


def is_variety_culture(culture: Culture | None) -> bool:
    """Whether the row is a Sorte, i.e. carries a non-empty variety."""
    return bool(culture is not None and (culture.variety or '').strip())


def inherits_from_general_culture(culture: Culture | None) -> bool:
    """Whether the row is a Sorte that is linked to a crop species at all."""
    return is_variety_culture(culture) and bool(culture.crop_species_id)


def build_general_culture_index(project_id: int | None) -> GeneralCultureIndex:
    """Map ``crop_species_id`` to the project's general Kultur for that species.

    One query for a whole page of cultures, so serializers can resolve the
    fallback per row without an N+1. Ties (more than one varietyless row for the
    same species, which the UI does not create but the data model allows) are
    broken by the lowest primary key so the result stays stable.
    """
    if project_id is None:
        return {}
    general_cultures = (
        Culture.objects
        .filter(project_id=project_id, crop_species__isnull=False, variety_normalized__isnull=True)
        # Descending, so the lowest primary key is the one left standing below.
        .order_by('-pk')
    )
    return {general.crop_species_id: general for general in general_cultures}


def get_general_culture(
    culture: Culture | None,
    index: GeneralCultureIndex | None = None,
) -> Culture | None:
    """The general Kultur a Sorte inherits from, or ``None``.

    Pass ``index`` (see :func:`build_general_culture_index`) when resolving many
    cultures at once. Without it the lookup is a single query per culture, cached
    on the instance so repeated field resolution stays cheap.
    """
    if not inherits_from_general_culture(culture):
        return None
    if index is not None:
        # The index only holds varietyless rows, so a Sorte can never find itself.
        return index.get(culture.crop_species_id)

    cached = getattr(culture, '_resolved_general_culture', _UNRESOLVED)
    if cached is not _UNRESOLVED:
        return cached
    resolved = (
        Culture.objects
        .filter(
            project_id=culture.project_id,
            crop_species_id=culture.crop_species_id,
            variety_normalized__isnull=True,
        )
        .exclude(pk=culture.pk)
        .order_by('pk')
        .first()
    )
    culture._resolved_general_culture = resolved
    return resolved


def resolve_culture_field(
    culture: Culture | None,
    field: str,
    index: GeneralCultureIndex | None = None,
) -> Any:
    """The effective value of ``field``: the Sorte's own value, else the Kultur's."""
    if culture is None:
        return None
    own_value = getattr(culture, field)
    if field not in CULTURE_INHERITABLE_FIELDS or not is_unset_culture_value(own_value):
        return own_value
    general_culture = get_general_culture(culture, index)
    if general_culture is None:
        return own_value
    general_value = getattr(general_culture, field)
    return own_value if is_unset_culture_value(general_value) else general_value


def build_inherited_culture_values(
    culture: Culture | None,
    index: GeneralCultureIndex | None = None,
) -> dict[str, Any]:
    """Only the fields whose effective value comes from the general Kultur.

    Fields the Sorte sets itself are absent, so the caller can tell an inherited
    value from an own one per field.
    """
    general_culture = get_general_culture(culture, index)
    if general_culture is None:
        return {}
    inherited: dict[str, Any] = {}
    for field in CULTURE_INHERITABLE_FIELDS:
        if not is_unset_culture_value(getattr(culture, field)):
            continue
        general_value = getattr(general_culture, field)
        if is_unset_culture_value(general_value):
            continue
        inherited[field] = general_value
    return inherited


def build_effective_culture_values(
    culture: Culture | None,
    index: GeneralCultureIndex | None = None,
) -> dict[str, Any]:
    """The effective value of every inheritable field, own values included."""
    if culture is None:
        return {}
    inherited = build_inherited_culture_values(culture, index)
    return {
        field: inherited.get(field, getattr(culture, field))
        for field in CULTURE_INHERITABLE_FIELDS
    }


def resolve_plants_per_m2(
    culture: Culture | None,
    index: GeneralCultureIndex | None = None,
) -> Decimal | None:
    """Plants per m² from the culture's effective spacing, not only its own."""
    if culture is None:
        return None
    return compute_plants_per_m2(
        resolve_culture_field(culture, 'row_spacing_m', index),
        resolve_culture_field(culture, 'distance_within_row_m', index),
    )
