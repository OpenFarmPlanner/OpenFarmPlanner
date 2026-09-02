from __future__ import annotations

from crops.models import CropSpecies
from farm.models import Crop


def resolve_crop_display_name(
    crop: Crop,
    language_code: str,
    region: str | None = None,
) -> tuple[str | None, str]:
    """Return the localized display name for a project crop.

    Project crop identity stays stored on ``Crop.name``. When the crop
    is linked to a language-independent crop species, read-only UI surfaces can
    display the species translation that matches the active UI language.
    """
    species: CropSpecies | None = crop.crop_species
    if species is None:
        return crop.name, ''
    return species.localized_name(language_code, region)
