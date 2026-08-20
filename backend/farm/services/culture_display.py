from __future__ import annotations

from crops.models import CropSpecies
from farm.models import Culture


def resolve_culture_display_name(
    culture: Culture,
    language_code: str,
    region: str | None = None,
) -> tuple[str | None, str]:
    """Return the localized display name for a project culture.

    Project culture identity stays stored on ``Culture.name``. When the culture
    is linked to a language-independent crop species, read-only UI surfaces can
    display the species translation that matches the active UI language.
    """
    species: CropSpecies | None = culture.crop_species
    if species is None:
        return culture.name, ''
    return species.localized_name(language_code, region)
