"""
Crop Library service layer — the single place `crops.views` (and, in the
future, any other consumer) reads published crop data from.

This module must never import anything project-scoped (`Project`,
`PlantingPlan`, `Bed`, ...) or anything from farm's domain view/serializer packages
— see docs/crop-library-architecture.md for the dependency rule this
enforces ("the crop library knows nothing about projects; farm planning
uses the crop library, never the other way round").

Publishing a project's `Culture` into the library, and importing a
published crop back into a project, are intentionally NOT in this module:
those are bridge operations that need `Culture`/`Project`, and stay in
`farm.services.public_cultures` until a future step decides how that
bridge should work once the crop library is a genuinely separate service
(e.g. an HTTP call instead of a direct ORM write). See the architecture
doc's "deliberately deferred" section.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Q, QuerySet

from farm.models import PublicCulture
from farm.utils import normalize_text

if TYPE_CHECKING:
    from .models import CropSpecies

SEARCH_ALIASES = {
    'paradeis': 'tomate',
    'paradeiser': 'tomate',
    'paradeisern': 'tomate',
    'paradeisers': 'tomate',
}


def build_crop_search_terms(value: str) -> set[str]:
    """Return normalized search variants for user-facing crop lookup."""
    normalized = normalize_text(value)
    if not normalized:
        return set()

    terms = {normalized}
    for token in normalized.split():
        terms.add(token)
        alias = SEARCH_ALIASES.get(token)
        if alias:
            terms.add(alias)
        # Naive plural stripping: German "-e" + "-n" plurals (Tomate ->
        # Tomaten) and English/German "-s" plurals both drop exactly one
        # trailing letter, so every matched suffix strips 1 char, not
        # len(suffix) - stripping "-en" as 2 chars would turn "Tomaten" into
        # the invalid "Tomat" instead of "Tomate". Guarded to a minimum
        # length so the truncated term stays specific enough for `icontains`.
        if any(token.endswith(suffix) for suffix in ('en', 'n', 's')) and len(token) > 4:
            terms.add(token[:-1])

    alias = SEARCH_ALIASES.get(normalized)
    if alias:
        terms.add(alias)
    return {term for term in terms if term}


def build_public_crop_search_query(value: str, *, include_variety: bool = True) -> Q:
    """Build a search query spanning crop names, species names, and translations."""
    query = Q()
    stripped_value = value.strip()
    if stripped_value and include_variety:
        query |= Q(variety__icontains=stripped_value)
    for term in build_crop_search_terms(value):
        query |= (
            Q(name_normalized__icontains=term)
            | Q(crop_species__name_normalized__icontains=term)
            | Q(crop_species__translations__common_name_normalized__icontains=term)
        )
    return query


def build_species_search_query(value: str) -> Q:
    """Build a search query for official crop species and translations."""
    query = Q()
    stripped_value = value.strip()
    if stripped_value:
        query |= Q(name__icontains=stripped_value) | Q(translations__common_name__icontains=stripped_value)
    for term in build_crop_search_terms(value):
        query |= Q(name_normalized__icontains=term) | Q(translations__common_name_normalized__icontains=term)
    return query


def list_published_crops(*, query: str = '', name: str = '', variety: str = '') -> QuerySet[PublicCulture]:
    """Published crops, optionally filtered by a free-text query and/or exact-field substrings.

    Free-text and name search deliberately span **every** stored species
    translation, not just the caller's UI language: searching "Tomato" in a
    German UI must find the "Tomate / Tomato" species. The species
    translations are prefetched in the same round trip that the localized
    display name needs, so the wider search does not turn into an N+1.
    """
    queryset = (
        PublicCulture.objects
        .filter(status=PublicCulture.STATUS_PUBLISHED)
        # `created_by__public_profile` is joined because every serialized row
        # reads `created_by_label`; without it the attribution alone costs two
        # queries per result.
        .select_related('crop_species', 'created_by__public_profile')
        .prefetch_related('crop_species__translations', 'translations')
        .order_by('name', 'variety')
    )

    query = query.strip()
    name = name.strip()
    variety = variety.strip()

    if query:
        queryset = queryset.filter(build_public_crop_search_query(query)).distinct()
    if name:
        queryset = queryset.filter(build_public_crop_search_query(name, include_variety=False)).distinct()
    if variety:
        # Variety names are proper names: never translated, matched verbatim.
        queryset = queryset.filter(variety__icontains=variety)
    return queryset


def get_published_crop(pk: int) -> PublicCulture:
    """A single published crop by id. Raises `PublicCulture.DoesNotExist` if not found or unpublished."""
    return PublicCulture.objects.get(pk=pk, status=PublicCulture.STATUS_PUBLISHED)


def find_species_by_common_name(name: str | None) -> CropSpecies | None:
    """The species whose canonical name or *any* translation matches ``name``.

    This is what makes "Tomate" and "Tomato" resolve to one species, so
    matching and duplicate detection can work on the language-independent
    record instead of on whichever name the user happened to type.
    """
    from .models import CropSpecies

    normalized = normalize_text(name)
    if not normalized:
        return None
    return CropSpecies.objects.filter(
        Q(name_normalized=normalized) | Q(translations__common_name_normalized=normalized),
    ).distinct().first()


def find_exact_crop_match(*, name: str | None, variety: str | None) -> PublicCulture | None:
    """The most recently published crop matching this crop identity, if any.

    Identity is (species, normalized variety) whenever the name resolves to a
    species, so a German and an English spelling of the same species find the
    same entry. Entries published before species links existed are still
    matched on their own normalized name.
    """
    normalized_name = normalize_text(name)
    normalized_variety = normalize_text(variety)
    if not normalized_name or not normalized_variety:
        return None

    queryset = PublicCulture.objects.filter(
        status=PublicCulture.STATUS_PUBLISHED,
        variety_normalized=normalized_variety,
    )
    species = find_species_by_common_name(name)
    if species is not None:
        queryset = queryset.filter(Q(crop_species=species) | Q(name_normalized=normalized_name))
    else:
        queryset = queryset.filter(name_normalized=normalized_name)

    return (
        queryset
        .only('id', 'name', 'variety', 'published_at')
        .order_by('-published_at', '-id')
        .first()
    )
