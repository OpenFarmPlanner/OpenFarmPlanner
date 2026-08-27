from __future__ import annotations

# The public culture library (PublicCulture + this module) is a candidate for
# extraction into a separate service consumed by OFP over an API (under
# discussion as of 2026-07). Keep this module's dependency on `farm.models`
# limited to Culture/Project/PublicCulture, and avoid pulling in
# project-history/EntityRevision or other farm-app-internal concerns here.

from dataclasses import dataclass
import json
import re
from typing import Any

from django.contrib.auth import get_user_model
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from config.languages import SUPPORTED_LANGUAGE_CODES, normalize_language_tag
from crops.models import CropSpecies
from crops.services import find_species_by_common_name
from crops.permissions import is_public_library_moderator
from farm.models import (
    Culture,
    Project,
    PublicCulture,
    PublicCultureRevision,
    PublicCultureStatusEvent,
    PublicCultureTranslation,
)
# The local Kultur/Sorte grouping is a farm-app concern this module deliberately
# does not re-implement: it only calls the service that owns it whenever
# publishing links a project culture to a crop species.
from farm.services.culture_inheritance import get_general_culture, sync_crop_species_across_culture_group

User = get_user_model()

CULTURE_COPY_FIELDS = [
    'name',
    'variety',
    'notes',
    'crop_family',
    'nutrient_demand',
    'cultivation_types',
    'cultivation_type',
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'harvest_method',
    'expected_yield',
    'distance_within_row_m',
    'row_spacing_m',
    'sowing_depth_m',
    'seed_rate_value',
    'seed_rate_unit',
    'seed_rate_by_cultivation',
    'sowing_calculation_safety_percent',
    'thousand_kernel_weight_g',
    'seeding_requirement',
    'seeding_requirement_type',
    'display_color',
]

PUBLIC_CULTURE_EDITABLE_FIELDS = [
    'variety',
    'notes',
    'crop_family',
    'nutrient_demand',
    'cultivation_types',
    'cultivation_type',
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'harvest_method',
    'expected_yield',
    'distance_within_row_m',
    'row_spacing_m',
    'sowing_depth_m',
    'seed_rate_value',
    'seed_rate_unit',
    'seed_rate_by_cultivation',
    'sowing_calculation_safety_percent',
    'thousand_kernel_weight_g',
    'seeding_requirement',
    'seeding_requirement_type',
    'display_color',
    'seed_packages',
]

# Kept as a module-level name for existing importers; the supported set
# itself now lives in config.languages so UI and content stay in sync.
PUBLIC_ORIGINAL_LANGUAGE_CODES = set(SUPPORTED_LANGUAGE_CODES)

PUBLIC_REQUIRED_FIELDS = [
    'variety',
    'growth_duration_days',
    'harvest_duration_days',
]


@dataclass(frozen=True)
class MissingRequiredField:
    field: str
    label_key: str


@dataclass(frozen=True)
class PublishingCheckResult:
    crop_species: CropSpecies | None
    original_language_code: str
    available_language_codes: list[str]
    missing_required_fields: list[MissingRequiredField]
    duplicates: list[DuplicateCandidate]
    can_publish: bool
    general_crop_notice: GeneralCropNotice | None = None


@dataclass(frozen=True)
class DuplicateCandidate:
    id: int
    name: str
    variety: str
    version: int
    published_at: Any
    created_by_label: str
    is_mine: bool


@dataclass(frozen=True)
class GeneralCropNotice:
    public_culture_id: int
    updated_at: Any
    is_stale: bool
    is_incomplete: bool


class DuplicatePublicCultureError(Exception):
    """Raised when attempting to publish a culture that already exists publicly."""

    def __init__(self, *, duplicates: list[DuplicateCandidate], normalized_identity: dict[str, str]) -> None:
        super().__init__('A similar public culture already exists.')
        self.duplicates = duplicates
        self.normalized_identity = normalized_identity


class PublicCulturePublishingValidationError(Exception):
    """Raised when the public-library quality gate rejects publication."""

    def __init__(self, *, check_result: PublishingCheckResult) -> None:
        super().__init__('Public culture publishing checks failed.')
        self.check_result = check_result


class PublicCultureUpdateBlockedError(Exception):
    """Raised when a copy may not overwrite its public entry yet.

    Guards the case the diff dialog's "Ablehnen" makes reachable: a user who
    declined a public version must not be able to push their older local values
    over exactly that change from the publish/update flow.
    """

    def __init__(self, *, reason: str) -> None:
        super().__init__('Publishing this culture would overwrite an unreviewed public version.')
        self.reason = reason


class PublicCultureStatusTransitionError(Exception):
    """Raised when a public culture status transition is not allowed."""

    def __init__(self, message: str, *, code: str = 'invalid_status_transition') -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class PublicCulturePermissionError(Exception):
    """Raised when the user may not change a public culture status."""

    def __init__(self, message: str, *, code: str = 'permission_denied') -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class PublicCultureEditConflictError(Exception):
    """Raised when a public culture edit is based on a stale version."""

    def __init__(self, message: str, *, current_version: int) -> None:
        super().__init__(message)
        self.message = message
        self.current_version = current_version
        self.code = 'stale_public_culture_version'


class PublicCultureIdentityConflictError(Exception):
    """Raised when renaming a public culture's variety would collide with another published entry.

    ``name`` (the crop) stays fixed after publication, but ``variety`` can be
    corrected to fix typos. Doing so must still respect the same
    crop+variety uniqueness invariant enforced at publish time, or two
    published entries could end up sharing one identity.
    """

    def __init__(self, *, conflicting_public_culture: PublicCulture) -> None:
        super().__init__('A published entry with this crop and variety already exists.')
        self.conflicting_public_culture = conflicting_public_culture
        self.code = 'public_culture_variety_conflict'


class PublicCultureRevisionNotFoundError(Exception):
    """Raised when a requested public culture version snapshot is missing."""

    def __init__(self, message: str = 'The requested public culture version was not found.') -> None:
        super().__init__(message)
        self.message = message
        self.code = 'public_culture_revision_not_found'


def _copy_fields(instance: Any) -> dict[str, Any]:
    payload = {field: getattr(instance, field) for field in CULTURE_COPY_FIELDS}
    payload['cultivation_types'] = list(payload.get('cultivation_types') or [])
    payload['seed_rate_by_cultivation'] = payload.get('seed_rate_by_cultivation') or None
    return payload


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def build_public_culture_snapshot(public_culture: PublicCulture) -> dict[str, Any]:
    snapshot = {
        field: _json_safe(getattr(public_culture, field))
        for field in PUBLIC_CULTURE_EDITABLE_FIELDS
    }
    snapshot['crop_species'] = public_culture.crop_species_id
    snapshot['original_language_code'] = public_culture.original_language_code
    return snapshot


def build_public_culture_changed_fields(
    *,
    previous_snapshot: dict[str, Any],
    current_snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    for field in sorted(current_snapshot):
        old_value = previous_snapshot.get(field)
        new_value = current_snapshot.get(field)
        if old_value == new_value:
            continue
        changes.append({
            'field': field,
            'old_value': old_value,
            'new_value': new_value,
        })
    return changes


def create_public_culture_revision(
    *,
    public_culture: PublicCulture,
    user: User | None,
    action: str,
    previous_snapshot: dict[str, Any] | None = None,
    restored_from_version: int | None = None,
) -> PublicCultureRevision:
    current_snapshot = build_public_culture_snapshot(public_culture)
    changed_fields = build_public_culture_changed_fields(
        previous_snapshot=previous_snapshot or {},
        current_snapshot=current_snapshot,
    ) if previous_snapshot is not None else []
    return PublicCultureRevision.objects.create(
        public_culture=public_culture,
        version=public_culture.version,
        action=action,
        snapshot=current_snapshot,
        changed_fields=changed_fields,
        restored_from_version=restored_from_version,
        created_by=user,
    )


def ensure_public_culture_revision(public_culture: PublicCulture) -> PublicCultureRevision:
    revision = public_culture.revisions.filter(version=public_culture.version).first()
    if revision is not None:
        return revision
    return create_public_culture_revision(
        public_culture=public_culture,
        user=public_culture.created_by,
        action=PublicCultureRevision.ACTION_CREATED,
    )


def _validate_public_culture_edit_user(user: User | None) -> None:
    if not user or not user.is_authenticated:
        raise PublicCulturePermissionError('Authentication is required to edit public cultures.')


def _validate_base_version(public_culture: PublicCulture, base_version: int | None) -> None:
    if base_version is None:
        return
    if public_culture.version != base_version:
        raise PublicCultureEditConflictError(
            'The public culture has changed since it was loaded.',
            current_version=public_culture.version,
        )


def find_public_culture_identity_conflict(
    public_culture: PublicCulture,
    *,
    variety: str,
) -> PublicCulture | None:
    """Another published entry that a variety rename would collide with, if any.

    Mirrors the identity rule in :func:`detect_public_culture_duplicates`
    (species, or legacy name, plus normalized variety) but starts from an
    existing ``PublicCulture`` being renamed rather than a project ``Culture``
    being published, and excludes the entry itself.
    """
    normalized_variety = normalize_identity_value(variety)
    queryset = PublicCulture.objects.filter(
        status=PublicCulture.STATUS_PUBLISHED,
        variety_normalized=normalized_variety,
    ).exclude(pk=public_culture.pk)
    if public_culture.crop_species_id:
        queryset = queryset.filter(
            Q(crop_species_id=public_culture.crop_species_id)
            | Q(crop_species__isnull=True, name_normalized=public_culture.name_normalized),
        )
    else:
        queryset = queryset.filter(name_normalized=public_culture.name_normalized)
    return queryset.first()


def update_public_culture_directly(
    *,
    public_culture: PublicCulture,
    user: User | None,
    data: dict[str, Any],
    base_version: int | None = None,
) -> PublicCulture:
    _validate_public_culture_edit_user(user)
    unknown_fields = sorted(set(data) - set(PUBLIC_CULTURE_EDITABLE_FIELDS))
    if unknown_fields:
        raise ValueError(f"Unsupported public culture fields: {', '.join(unknown_fields)}")

    with transaction.atomic():
        locked = PublicCulture.objects.select_for_update().get(pk=public_culture.pk)
        _validate_base_version(locked, base_version)
        ensure_public_culture_revision(locked)
        previous_snapshot = build_public_culture_snapshot(locked)
        changed_field_names = []
        for field, value in data.items():
            if previous_snapshot.get(field) == _json_safe(value):
                continue
            setattr(locked, field, value)
            changed_field_names.append(field)
        if not changed_field_names:
            return locked

        if 'variety' in changed_field_names:
            conflict = find_public_culture_identity_conflict(locked, variety=locked.variety)
            if conflict is not None:
                raise PublicCultureIdentityConflictError(conflicting_public_culture=conflict)

        update_fields = [*changed_field_names, 'version', 'updated_at']
        if 'variety' in changed_field_names:
            update_fields.append('variety_normalized')
        locked.version = max(locked.version, 1) + 1
        locked.save(update_fields=update_fields)
        if 'notes' in changed_field_names:
            sync_original_language_translation(locked)
        create_public_culture_revision(
            public_culture=locked,
            user=user,
            action=PublicCultureRevision.ACTION_UPDATED,
            previous_snapshot=previous_snapshot,
        )
        return locked


def restore_public_culture_version(
    *,
    public_culture: PublicCulture,
    user: User | None,
    version: int,
    base_version: int | None = None,
) -> PublicCulture:
    _validate_public_culture_edit_user(user)

    with transaction.atomic():
        locked = PublicCulture.objects.select_for_update().get(pk=public_culture.pk)
        _validate_base_version(locked, base_version)
        ensure_public_culture_revision(locked)
        revision = locked.revisions.filter(version=version).first()
        if revision is None:
            raise PublicCultureRevisionNotFoundError()
        previous_snapshot = build_public_culture_snapshot(locked)
        update_fields = []
        for field in PUBLIC_CULTURE_EDITABLE_FIELDS:
            value = revision.snapshot.get(field)
            if previous_snapshot.get(field) == value:
                continue
            setattr(locked, field, value)
            update_fields.append(field)
        if not update_fields:
            return locked

        locked.version = max(locked.version, 1) + 1
        locked.save(update_fields=[*update_fields, 'version', 'updated_at'])
        if 'notes' in update_fields:
            # Restoring an old version rewrites `notes`; the original-language
            # translation has to follow, or the entry would keep rendering the
            # description of the version that was just rolled back.
            sync_original_language_translation(locked)
        create_public_culture_revision(
            public_culture=locked,
            user=user,
            action=PublicCultureRevision.ACTION_RESTORED,
            previous_snapshot=previous_snapshot,
            restored_from_version=version,
        )
        return locked


def _seed_packages_payload_from_culture(culture: Culture) -> list[dict[str, Any]]:
    return [
        {
            'size_value': float(package.size_value),
            'size_unit': package.size_unit,
            'evidence_text': package.evidence_text,
            'last_seen_at': package.last_seen_at.isoformat() if package.last_seen_at else None,
        }
        for package in culture.seed_packages.order_by('size_unit', 'size_value')
    ]


def normalize_identity_value(value: str | None) -> str:
    """Normalize values used for duplicate identity comparisons."""
    compacted = re.sub(r'\s+', ' ', (value or '').strip())
    return compacted.lower()


def build_public_culture_payload(
    culture: Culture,
    *,
    public_variety: str | None = None,
    source_culture: Culture | None = None,
) -> dict[str, Any]:
    """The public-entry fields taken from ``culture``.

    ``source_culture`` overrides which project culture the entry records as its
    origin. It differs from ``culture`` only when a Sorte's publish creates the
    species-level entry alongside it: the values come from the Sorte, but the
    entry belongs to the project's general Kultur, which is the row that later
    updates it (see :func:`ensure_general_public_culture`).
    """
    payload = _copy_fields(culture)
    if public_variety is not None:
        payload['variety'] = public_variety
    payload['seed_packages'] = _seed_packages_payload_from_culture(culture)
    origin_culture = source_culture or culture
    payload['source_project_culture'] = origin_culture
    payload['source_project'] = origin_culture.project
    payload['published_at'] = timezone.now()
    return payload


def normalize_language_code(value: str | None) -> str:
    """A supported content language code, or '' when unsupported/missing."""
    return normalize_language_tag(value)


def sync_original_language_translation(public_culture: PublicCulture) -> None:
    """Mirror ``notes`` into the entry's original-language translation row.

    ``notes`` stays the original-language copy (imports into projects and
    older consumers read it directly); the translation rows are the
    multi-language source of truth. Writing both keeps the two consistent
    without a second free-text field in the publishing UI.

    Translations in *other* languages are never touched here — they are
    editorial content that belongs to the library entry, not to the
    publisher's project culture.
    """
    language_code = normalize_language_code(public_culture.original_language_code)
    if not language_code:
        return
    description = (public_culture.notes or '').strip()
    if description:
        PublicCultureTranslation.objects.update_or_create(
            public_culture=public_culture,
            language_code=language_code,
            defaults={'description': description},
        )
    else:
        PublicCultureTranslation.objects.filter(
            public_culture=public_culture,
            language_code=language_code,
        ).delete()


def replace_public_culture_translations(
    *,
    public_culture: PublicCulture,
    user: User | None,
    descriptions: dict[str, str],
) -> PublicCulture:
    """Upsert the public description for the supplied languages.

    Languages present with blank text are removed; languages not mentioned at
    all are left untouched, because "I did not fill in English yet" must not
    mean "delete the English version". At least one non-empty language has to
    remain — an entry with no description in any language would render as an
    empty card.

    ``notes`` is kept in step with the original language so the import-into-a-
    project path keeps copying real text.
    """
    _validate_public_culture_edit_user(user)

    cleaned: dict[str, str] = {}
    for language_code, description in descriptions.items():
        normalized_code = normalize_language_code(language_code)
        if not normalized_code:
            continue
        cleaned[normalized_code] = (description or '').strip()

    with transaction.atomic():
        locked = PublicCulture.objects.select_for_update().get(pk=public_culture.pk)
        existing = {
            row.language_code: row.description
            for row in PublicCultureTranslation.objects.filter(public_culture=locked)
        }
        merged = {**existing, **cleaned}
        if not any(text.strip() for text in merged.values()):
            raise PublicCultureStatusTransitionError(
                'At least one language version must have a description.',
                code='translation_required',
            )

        for language_code, description in cleaned.items():
            if description:
                PublicCultureTranslation.objects.update_or_create(
                    public_culture=locked,
                    language_code=language_code,
                    defaults={'description': description},
                )
            else:
                PublicCultureTranslation.objects.filter(
                    public_culture=locked,
                    language_code=language_code,
                ).delete()

        original_code = normalize_language_code(locked.original_language_code)
        if original_code and original_code in cleaned:
            locked.notes = cleaned[original_code]
            locked.save(update_fields=['notes', 'updated_at'])
        return locked


def detect_available_language_codes(culture: Culture) -> list[str]:
    """Languages a *project* culture already has public content for.

    Project cultures are single-language by design (their text is the user's
    own input, never duplicated per UI language), so this reports the
    languages of the public entry that was already published from it, if any.
    """
    public_culture = (
        PublicCulture.objects
        .filter(source_project_culture=culture)
        .prefetch_related('translations')
        .order_by('-published_at', '-id')
        .first()
    )
    if public_culture is None:
        return []
    return sorted(public_culture.descriptions_by_language())


def get_public_required_field_gaps(culture: Culture, *, require_variety: bool = True) -> list[MissingRequiredField]:
    gaps: list[MissingRequiredField] = []
    for field in PUBLIC_REQUIRED_FIELDS:
        if field == 'variety' and not require_variety:
            continue
        value = getattr(culture, field)
        if value is None or (isinstance(value, str) and not value.strip()):
            gaps.append(MissingRequiredField(field=field, label_key=f'library.publishWizard.fields.{field}'))
    return gaps


PUBLISHABLE_CROP_SPECIES_STATUSES = (CropSpecies.STATUS_PUBLISHED, CropSpecies.STATUS_PROPOSED)


def resolve_publishing_crop_species(*, culture: Culture, crop_species_id: int | None) -> CropSpecies | None:
    """A species usable as the publish target: published, or still pending moderation.

    A `proposed` species is intentionally allowed here so a user who just
    suggested a missing species inline doesn't have to wait for moderator
    approval before publishing their variety under it — the variety publishes
    right away and becomes fully official once the species is approved (the
    `CropSpecies` row is updated in place, so nothing needs to be relinked).
    `rejected` species are excluded.
    """
    if crop_species_id:
        return CropSpecies.objects.filter(
            id=crop_species_id, status__in=PUBLISHABLE_CROP_SPECIES_STATUSES,
        ).first()
    return (
        culture.crop_species
        if culture.crop_species and culture.crop_species.status in PUBLISHABLE_CROP_SPECIES_STATUSES
        else None
    )


def build_project_culture_payload(public_culture: PublicCulture) -> dict[str, Any]:
    payload = _copy_fields(public_culture)
    payload['crop_species'] = public_culture.crop_species
    payload['source_public_culture'] = public_culture
    payload['source_public_version'] = public_culture.version
    payload['origin_type'] = Culture.ORIGIN_IMPORTED
    payload['is_modified_from_source'] = False
    # Taking a version over ends any earlier rejection: the copy is aligned again.
    payload['rejected_public_version'] = None
    return payload


def link_project_culture_to_public_reference(*, culture: Culture, public_culture: PublicCulture) -> Culture:
    """Link a private culture to a published public culture without publishing a duplicate.

    This is a one-time baseline comparison (culture-as-linked vs. public
    source), not the same check as ``Culture._flag_source_divergence``, which
    compares a culture's *own* previous vs. current row on every save to
    detect edits made after an import. There is no "previous row" yet here.
    """
    source_payload = build_project_culture_payload(public_culture)
    tracked_fields = Culture._SOURCE_DIVERGENCE_TRACKED_FIELDS
    if not (public_culture.variety or '').strip():
        # A general (species-level) public entry has no variety of its own, so
        # the private culture naming a specific cultivar is an inherent
        # granularity difference between the two, not a sign the user edited
        # anything relative to the source it's being linked to.
        tracked_fields = tracked_fields - {'variety'}
    is_modified = any(getattr(culture, field) != source_payload.get(field) for field in tracked_fields)

    culture.crop_species = public_culture.crop_species
    culture.source_public_culture = public_culture
    culture.source_public_version = public_culture.version
    culture.origin_type = Culture.ORIGIN_IMPORTED
    culture.is_modified_from_source = is_modified
    culture.save(update_fields=[
        'crop_species',
        'source_public_culture',
        'source_public_version',
        'origin_type',
        'is_modified_from_source',
        'updated_at',
    ])
    sync_crop_species_across_culture_group(culture)
    return culture


def detect_public_culture_duplicates(
    culture: Culture,
    *,
    crop_species: CropSpecies | None = None,
    public_variety: str | None = None,
    user: User | None = None,
) -> list[DuplicateCandidate]:
    """Published entries that would be duplicates of this culture.

    Identity is the *language-independent* species plus a normalized variety
    name — never a localized name plus variety. Otherwise "Tomate +
    Moneymaker" and "Tomato + Moneymaker" would look like two different crops
    when they are one.

    When the caller did not pass a species, the culture's own name is resolved
    against every species translation first, so publishing an English-named
    culture still finds the German-named entry (and vice versa). Only if no
    species can be determined at all does this fall back to name matching, for
    legacy entries that predate species links.

    Normalization is intentionally shallow — trim, collapse whitespace,
    case-fold — and never touches the stored or displayed original name.
    """
    normalized_variety = (
        normalize_identity_value(public_variety)
        if public_variety is not None
        else culture.variety_normalized
    )
    queryset = PublicCulture.objects.filter(
        variety_normalized=normalized_variety,
        status=PublicCulture.STATUS_PUBLISHED,
    )
    species = crop_species or culture.crop_species or find_species_by_common_name(culture.name)
    if species is not None:
        # Match the species either directly or through a legacy entry that
        # carries the same localized name but no species link yet.
        queryset = queryset.filter(
            Q(crop_species=species) | Q(crop_species__isnull=True, name_normalized=culture.name_normalized),
        )
    else:
        queryset = queryset.filter(name_normalized=culture.name_normalized)
    queryset = queryset.select_related('created_by').order_by('-published_at', '-id')

    candidates: list[DuplicateCandidate] = []
    for item in queryset:
        candidates.append(DuplicateCandidate(
            id=item.id,
            name=item.name,
            variety=item.variety,
            version=item.version,
            published_at=item.published_at,
            created_by_label=item.created_by_label,
            is_mine=bool(user and user.is_authenticated and item.created_by_id == user.id),
        ))
        if len(candidates) >= 5:
            break
    return candidates


def _resolve_public_variety(publish_as_general: bool) -> str | None:
    """The ``public_variety`` sentinel for :func:`build_public_culture_payload`.

    ``''`` forces a species-level (variety-less) entry; ``None`` means "keep
    the culture's own variety verbatim". Every publish/update call site needs
    this same mapping, so it lives in one place instead of being re-derived
    (and risking one call site falling out of sync with the others).
    """
    return '' if publish_as_general else None


def build_publishing_check_result(
    *,
    culture: Culture,
    crop_species_id: int | None,
    original_language_code: str | None,
    user: User | None = None,
    publish_as_general: bool = False,
) -> PublishingCheckResult:
    crop_species = resolve_publishing_crop_species(culture=culture, crop_species_id=crop_species_id)
    language_code = normalize_language_code(original_language_code)
    available_language_codes = detect_available_language_codes(culture)
    if language_code and language_code not in available_language_codes:
        available_language_codes = [language_code, *available_language_codes]
    public_variety = _resolve_public_variety(publish_as_general)
    duplicates = detect_public_culture_duplicates(
        culture,
        crop_species=crop_species,
        public_variety=public_variety,
        user=user,
    ) if crop_species else []
    update_target = find_owned_public_culture_for_update(culture=culture, user=user)
    if update_target:
        duplicates = [item for item in duplicates if item.id != update_target.id]
    missing_required_fields = get_public_required_field_gaps(culture, require_variety=not publish_as_general)
    can_publish = bool(crop_species and language_code and not missing_required_fields and not duplicates)
    general_crop_notice = (
        build_general_crop_notice(crop_species) if crop_species and not publish_as_general else None
    )
    return PublishingCheckResult(
        crop_species=crop_species,
        original_language_code=language_code,
        available_language_codes=available_language_codes,
        missing_required_fields=missing_required_fields,
        duplicates=duplicates,
        can_publish=can_publish,
        general_crop_notice=general_crop_notice,
    )


GENERAL_CROP_STALE_THRESHOLD_DAYS = 730  # ~24 months


def find_general_public_culture(crop_species: CropSpecies) -> PublicCulture | None:
    """The species-level (variety-less) published entry for `crop_species`, if any."""
    return PublicCulture.objects.filter(
        crop_species=crop_species,
        variety_normalized='',
        status=PublicCulture.STATUS_PUBLISHED,
    ).order_by('-updated_at', '-id').first()


def build_general_crop_notice(crop_species: CropSpecies) -> GeneralCropNotice | None:
    """Surface a dismissible hint when the species-level public data looks neglected.

    Only reports on an *existing* general entry — a missing one is handled by
    `ensure_general_public_culture` creating it automatically on publish, not
    by warning about it here.
    """
    general = find_general_public_culture(crop_species)
    if general is None:
        return None
    is_stale = (timezone.now() - general.updated_at).days > GENERAL_CROP_STALE_THRESHOLD_DAYS
    is_incomplete = bool(get_public_required_field_gaps(general, require_variety=False))
    if not is_stale and not is_incomplete:
        return None
    return GeneralCropNotice(
        public_culture_id=general.id,
        updated_at=general.updated_at,
        is_stale=is_stale,
        is_incomplete=is_incomplete,
    )


def ensure_general_public_culture(
    *,
    crop_species: CropSpecies,
    culture: Culture,
    original_language_code: str,
    user: User | None,
) -> PublicCulture | None:
    """Create the species-level public entry from `culture`'s values if it doesn't exist yet.

    Publishing a variety must never touch an *existing* general entry — other
    contributors may already have curated it — so this is a no-op whenever one
    is found, regardless of how different `culture`'s own values are.

    The entry's values come from the Sorte, but it is recorded as originating
    from the project's general Kultur when there is one: that row is what the
    user sees as the published Kultur afterwards, so it must be the row that
    owns and updates the entry.
    """
    if find_general_public_culture(crop_species) is not None:
        return None

    public_culture = PublicCulture.objects.create(
        created_by=user,
        status=PublicCulture.STATUS_PUBLISHED,
        version=1,
        crop_species=crop_species,
        original_language_code=original_language_code,
        **build_public_culture_payload(
            culture,
            public_variety='',
            source_culture=get_general_culture(culture),
        ),
    )
    sync_original_language_translation(public_culture)
    _record_public_culture_status_event(
        public_culture=public_culture,
        from_status='',
        to_status=PublicCulture.STATUS_PUBLISHED,
        user=user,
    )
    create_public_culture_revision(
        public_culture=public_culture,
        user=user,
        action=PublicCultureRevision.ACTION_CREATED,
    )
    return public_culture


def find_owned_public_culture_for_update(*, culture: Culture, user: User | None) -> PublicCulture | None:
    """Return the public culture that this user is allowed to update for the given culture."""
    if user is None:
        return None

    if culture.source_public_culture_id:
        source_public = PublicCulture.objects.filter(
            id=culture.source_public_culture_id,
            status__in=[PublicCulture.STATUS_PUBLISHED, PublicCulture.STATUS_WITHDRAWN],
        ).first()
        if source_public and source_public.created_by_id == user.id:
            return source_public
        # source_public_culture points at an entry owned by someone else (e.g. a
        # collaborator imported/linked it): that doesn't rule out the user having
        # already published their own copy of this same project culture, so fall
        # through to the source_project_culture lookup below instead of bailing.

    return PublicCulture.objects.filter(
        source_project_culture=culture,
        created_by=user,
        status__in=[PublicCulture.STATUS_PUBLISHED, PublicCulture.STATUS_WITHDRAWN],
    ).order_by('-updated_at', '-id').first()


def _record_public_culture_status_event(
    *,
    public_culture: PublicCulture,
    from_status: str,
    to_status: str,
    user: User | None,
    reason: str = '',
    note: str = '',
) -> None:
    PublicCultureStatusEvent.objects.create(
        public_culture=public_culture,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
        note=note,
        created_by=user,
    )


def _set_public_culture_status(
    *,
    public_culture: PublicCulture,
    status: str,
    user: User | None,
    reason: str = '',
    note: str = '',
) -> PublicCulture:
    previous_status = public_culture.status
    public_culture.status = status
    public_culture.status_changed_at = timezone.now()
    public_culture.status_changed_by = user
    public_culture.removal_reason = reason if status == PublicCulture.STATUS_REMOVED else ''
    public_culture.status_note = note
    if status == PublicCulture.STATUS_PUBLISHED:
        public_culture.published_at = timezone.now()
    public_culture.save(update_fields=[
        'status',
        'status_changed_at',
        'status_changed_by',
        'removal_reason',
        'status_note',
        'published_at',
        'updated_at',
    ])
    _record_public_culture_status_event(
        public_culture=public_culture,
        from_status=previous_status,
        to_status=status,
        user=user,
        reason=reason,
        note=note,
    )
    return public_culture


def _is_public_library_moderator(user: User | None) -> bool:
    return is_public_library_moderator(user)


def _update_public_culture_from_project_culture(
    *,
    public_culture: PublicCulture,
    culture: Culture,
    public_variety: str | None = None,
) -> PublicCulture:
    ensure_public_culture_revision(public_culture)
    previous_snapshot = build_public_culture_snapshot(public_culture)
    payload = build_public_culture_payload(culture, public_variety=public_variety)
    payload.pop('published_at', None)
    for field, value in payload.items():
        setattr(public_culture, field, value)
    public_culture.version = max(public_culture.version, 1) + 1
    if public_culture.status == PublicCulture.STATUS_WITHDRAWN:
        public_culture.status = PublicCulture.STATUS_PUBLISHED
        public_culture.published_at = timezone.now()
        public_culture.status_changed_at = timezone.now()
    public_culture.save()
    create_public_culture_revision(
        public_culture=public_culture,
        user=public_culture.created_by,
        action=PublicCultureRevision.ACTION_UPDATED,
        previous_snapshot=previous_snapshot,
    )
    return public_culture


def _link_culture_to_crop_species(*, culture: Culture, crop_species: CropSpecies) -> None:
    """Record the species the culture was published under, group and all.

    Publishing must leave the project's own Kulturen exactly as they were apart
    from this link, so the rest of the culture's Kultur group adopts the species
    with it — otherwise publishing one Sorte would leave a second Kultur of the
    same name behind for the Sorten that stayed unpublished.
    """
    culture.crop_species = crop_species
    culture.save(update_fields=['crop_species', 'updated_at'])
    sync_crop_species_across_culture_group(culture)


def publish_culture_to_public_library(
    *,
    culture: Culture,
    user: User | None,
    crop_species_id: int | None = None,
    original_language_code: str | None = None,
    publish_as_general: bool = False,
) -> tuple[PublicCulture, list[DuplicateCandidate], str]:
    # Checked before the quality gate: a copy that has not taken over the current
    # public version must not overwrite it, however complete its own fields are.
    update_target_for_guard = find_owned_public_culture_for_update(culture=culture, user=user)
    if update_target_for_guard and has_pending_public_culture_update(culture):
        rejected = is_public_culture_update_rejected(culture)
        raise PublicCultureUpdateBlockedError(
            reason='update_rejected' if rejected else 'update_pending',
        )

    check_result = build_publishing_check_result(
        culture=culture,
        crop_species_id=crop_species_id,
        original_language_code=original_language_code,
        user=user,
        publish_as_general=publish_as_general,
    )
    if not check_result.crop_species or not check_result.original_language_code or check_result.missing_required_fields:
        raise PublicCulturePublishingValidationError(check_result=check_result)

    public_variety = _resolve_public_variety(publish_as_general)
    update_target = find_owned_public_culture_for_update(culture=culture, user=user)
    duplicates = check_result.duplicates
    if update_target:
        previous_status = update_target.status
        _link_culture_to_crop_species(culture=culture, crop_species=check_result.crop_species)
        updated_public_culture = _update_public_culture_from_project_culture(
            public_culture=update_target,
            culture=culture,
            public_variety=public_variety,
        )
        updated_public_culture.crop_species = check_result.crop_species
        updated_public_culture.original_language_code = check_result.original_language_code
        updated_public_culture.status_changed_by = user if previous_status != PublicCulture.STATUS_PUBLISHED else updated_public_culture.status_changed_by
        updated_public_culture.save(update_fields=['crop_species', 'original_language_code', 'status_changed_by', 'updated_at'])
        if previous_status != PublicCulture.STATUS_PUBLISHED and updated_public_culture.status == PublicCulture.STATUS_PUBLISHED:
            _record_public_culture_status_event(
                public_culture=updated_public_culture,
                from_status=previous_status,
                to_status=PublicCulture.STATUS_PUBLISHED,
                user=user,
            )
        sync_original_language_translation(updated_public_culture)
        non_target_duplicates = [item for item in duplicates if item.id != update_target.id]
        return updated_public_culture, non_target_duplicates, 'updated'

    if duplicates:
        raise DuplicatePublicCultureError(
            duplicates=duplicates,
            normalized_identity={
                'name': culture.name_normalized,
                'variety': '' if publish_as_general else culture.variety_normalized,
                'crop_species': str(check_result.crop_species.id),
            },
        )
    _link_culture_to_crop_species(culture=culture, crop_species=check_result.crop_species)
    if not publish_as_general:
        # Publishing a variety always needs a species-level entry for the crop
        # to hang off; create it from this culture's own values if the
        # species doesn't have one yet. An existing general entry is never
        # touched here (see ensure_general_public_culture's docstring).
        ensure_general_public_culture(
            crop_species=check_result.crop_species,
            culture=culture,
            original_language_code=check_result.original_language_code,
            user=user,
        )
    public_culture = PublicCulture.objects.create(
        created_by=user,
        status=PublicCulture.STATUS_PUBLISHED,
        version=1,
        crop_species=check_result.crop_species,
        original_language_code=check_result.original_language_code,
        **build_public_culture_payload(culture, public_variety=public_variety),
    )
    sync_original_language_translation(public_culture)
    _record_public_culture_status_event(
        public_culture=public_culture,
        from_status='',
        to_status=PublicCulture.STATUS_PUBLISHED,
        user=user,
    )
    create_public_culture_revision(
        public_culture=public_culture,
        user=user,
        action=PublicCultureRevision.ACTION_CREATED,
    )
    return public_culture, duplicates, 'created'


def is_public_culture_contributor(*, public_culture: PublicCulture, user: User | None) -> bool:
    """Whether `user` is the contributor who published this public culture."""
    return bool(user and user.is_authenticated and public_culture.created_by_id == user.id)


def remove_public_culture(
    *,
    public_culture: PublicCulture,
    user: User | None,
    reason: str = '',
    force_moderator_reason: bool = False,
) -> PublicCulture:
    """Remove a public culture from the public library.

    This is the single entry point for both removal paths, so the UI only has
    to offer one "remove from library" action:

    - the contributor withdraws their own entry (`withdrawn`), which stays
      reversible: publishing the project culture again republishes it;
    - a moderator removes somebody else's entry (`removed`) and must supply a
      structured moderation reason.

    ``force_moderator_reason`` skips the contributor auto-detection and always
    takes the moderator/``removed`` path. Needed for system-driven cascades
    (e.g. withdrawing every entry under a just-rejected species) that must
    record the real reason even when the acting moderator happens to also be
    the entry's own contributor — otherwise the contributor branch would
    silently downgrade it to a self-reversible `withdrawn` with no reason.
    """
    if not force_moderator_reason and is_public_culture_contributor(public_culture=public_culture, user=user):
        if public_culture.status != PublicCulture.STATUS_PUBLISHED:
            raise PublicCultureStatusTransitionError(
                'Only published public cultures can be removed from the library.',
            )
        return _set_public_culture_status(
            public_culture=public_culture,
            status=PublicCulture.STATUS_WITHDRAWN,
            user=user,
        )

    if not _is_public_library_moderator(user):
        raise PublicCulturePermissionError(
            'Only the contributor or a moderator may remove this public culture.',
        )
    if reason not in {item[0] for item in PublicCulture.REMOVAL_REASON_CHOICES}:
        raise PublicCultureStatusTransitionError('A valid removal reason is required.', code='removal_reason_required')
    if public_culture.status == PublicCulture.STATUS_REMOVED:
        return public_culture
    return _set_public_culture_status(
        public_culture=public_culture,
        status=PublicCulture.STATUS_REMOVED,
        user=user,
        reason=reason,
    )


def reinstate_removed_public_culture(*, public_culture: PublicCulture, user: User | None) -> PublicCulture:
    """Moderator-only undo for `remove_public_culture`'s moderator path.

    Unlike a contributor's own withdrawal (self-service, reversible by simply
    publishing again), a moderator-removed entry has no self-service way
    back — `find_owned_public_culture_for_update` deliberately excludes
    `removed` so a moderation decision can't be bypassed by republishing.
    This is the moderator-side counterpart: no time limit, moderator-only.
    """
    if not _is_public_library_moderator(user):
        raise PublicCulturePermissionError('Only a moderator may restore a removed public culture.')
    if public_culture.status not in {PublicCulture.STATUS_REMOVED, PublicCulture.STATUS_WITHDRAWN}:
        raise PublicCultureStatusTransitionError(
            'Only a removed or withdrawn public culture can be restored.',
        )
    return _set_public_culture_status(
        public_culture=public_culture,
        status=PublicCulture.STATUS_PUBLISHED,
        user=user,
    )


def hard_delete_public_culture(*, public_culture: PublicCulture, user: User | None) -> None:
    if not _is_public_library_moderator(user):
        raise PublicCulturePermissionError('Only administrators may permanently delete public cultures.')
    if public_culture.imported_cultures.exists():
        raise PublicCultureStatusTransitionError(
            'This public culture has already been imported into projects and must remain auditable.',
            code='public_culture_has_imports',
        )
    if public_culture.source_project_culture_id or public_culture.source_project_id:
        raise PublicCultureStatusTransitionError(
            'This public culture still has project provenance and should be removed instead of deleted.',
            code='public_culture_has_provenance',
        )
    public_culture.delete()


class PublicCultureImportConfirmationRequiredError(Exception):
    """Raised when re-importing would silently overwrite local changes.

    The caller already has a culture in this project imported from this same
    public culture, and that culture has been edited since import
    (``is_modified_from_source``) — resolving this automatically either way
    would be a guess, so the API surfaces it as a 409 for the frontend to ask
    the user instead.
    """

    def __init__(self, *, existing_culture: Culture) -> None:
        super().__init__('This public culture was already imported and has local changes.')
        self.existing_culture = existing_culture
        self.code = 'import_requires_confirmation'


def _unique_project_culture_name(*, name: str, variety: str, project: Project) -> str:
    """Append " (2)", " (3)", ... to `name` until name+variety no longer collides
    with an existing culture in this project."""
    from farm.utils import normalize_text

    variety_normalized = normalize_text(variety)
    candidate_name = name
    suffix = 2
    while Culture.objects.filter(
        project=project,
        name_normalized=normalize_text(candidate_name) or '',
        variety_normalized=variety_normalized,
    ).exists():
        candidate_name = f'{name} ({suffix})'
        suffix += 1
    return candidate_name


def _create_culture_from_public(*, public_culture: PublicCulture, project: Project, unique_name: bool = False) -> Culture:
    payload = build_project_culture_payload(public_culture)
    if unique_name:
        payload['name'] = _unique_project_culture_name(
            name=payload['name'],
            variety=payload.get('variety') or '',
            project=project,
        )
    culture = Culture.objects.create(project=project, **payload)
    for package in public_culture.seed_packages or []:
        culture.seed_packages.create(
            project=project,
            size_value=package.get('size_value'),
            size_unit=package.get('size_unit') or 'g',
            evidence_text=package.get('evidence_text') or '',
            last_seen_at=package.get('last_seen_at') or None,
        )
    return culture


def _ensure_local_general_culture(*, public_culture: PublicCulture, project: Project) -> None:
    """Companion to importing a variety: also import the species' general entry if missing.

    Importing a variety-specific public culture directly (rather than via the
    Add Crop dialog's Sorte field, which already does this) used to leave the
    species with no variety-less local Culture at all — clicking the species
    group in the culture tree would then silently fall back to its first
    variety instead of showing real species-level data. Only acts when this
    import is genuinely introducing the species locally for the first time;
    an existing general culture (however it got there) is left untouched.
    """
    if not public_culture.variety_normalized or public_culture.crop_species_id is None:
        return
    # Culture.variety_normalized is left NULL (not '') for an empty variety
    # (see Culture.save()), unlike PublicCulture's - filter on the raw field.
    already_local = Culture.objects.filter(
        project=project,
        crop_species_id=public_culture.crop_species_id,
        variety='',
    ).exists()
    if already_local:
        return
    general_public = find_general_public_culture(public_culture.crop_species)
    if general_public is None:
        return
    _create_culture_from_public(public_culture=general_public, project=project)


def _apply_public_culture_update(*, culture: Culture, public_culture: PublicCulture) -> Culture:
    """Overwrite `culture`'s library-sourced fields with the current public culture."""
    payload = build_project_culture_payload(public_culture)
    for field, value in payload.items():
        setattr(culture, field, value)
    culture.save()
    # Culture._flag_source_divergence() runs inside save() and, seeing the tracked
    # fields differ from the pre-update row, may have just flipped this back to True —
    # wrong here, since syncing to a newer library version isn't a local edit. A
    # queryset .update() (not .save()) bypasses Culture.save() entirely, so this
    # doesn't trigger another divergence pass or a second EntityRevision.
    Culture.objects.filter(pk=culture.pk).update(is_modified_from_source=False)
    culture.is_modified_from_source = False
    return culture


@dataclass(frozen=True)
class PublicCultureFieldChange:
    field: str
    local_value: Any
    public_value: Any


@dataclass(frozen=True)
class PublicCultureUpdateStatus:
    """A pending library update for one imported project culture.

    ``changes`` is derived from ``CULTURE_COPY_FIELDS`` — the exact set
    :func:`_apply_public_culture_update` overwrites — so the preview can never
    show a field the update leaves alone, nor hide one it rewrites (which is
    what let a public variety rename reach a project copy unannounced).
    """

    public_culture: PublicCulture
    public_version: int
    local_version: int | None
    has_local_changes: bool
    is_rejected: bool
    changes: list[PublicCultureFieldChange]


def has_pending_public_culture_update(culture: Culture) -> bool:
    """Whether the linked library entry has a version this copy has not taken yet.

    Version-based, exactly like the 'unchanged' branch of
    :func:`import_public_culture_into_project`, so the badge the user sees and
    the decision the import takes can never disagree.
    """
    public_culture = culture.source_public_culture
    if public_culture is None or public_culture.status != PublicCulture.STATUS_PUBLISHED:
        return False
    return culture.source_public_version != public_culture.version


def is_public_culture_update_rejected(culture: Culture) -> bool:
    """Whether the user explicitly declined exactly the version that is pending.

    The rejection is stored as a version number rather than a flag, so a later
    public edit produces a new version the user never decided on and the notice
    comes back on its own.
    """
    if not has_pending_public_culture_update(culture):
        return False
    return culture.rejected_public_version == culture.source_public_culture.version


def has_open_public_culture_update(culture: Culture) -> bool:
    """A pending library update the user has not decided on yet (drives the notice)."""
    if not has_pending_public_culture_update(culture):
        return False
    return not is_public_culture_update_rejected(culture)


def resolve_public_publish_block(
    culture: Culture,
    owned_public_culture: PublicCulture | None,
) -> str | None:
    """Why pushing this culture into the public library is currently blocked, if it is.

    ``owned_public_culture`` is the entry an actual publish would target —
    callers resolve it themselves (respecting per-request ownership/moderator
    rules, and any prefetching they already did for it), so this stays a pure
    comparison and never issues its own query. The reasons are ordered by how
    the versions relate, so the UI can explain the exact situation instead of a
    generic hint:

    - ``update_pending``: this copy also tracks the entry as its import source
      and the library moved on without a decision yet; pushing now would
      overwrite an unreviewed public change.
    - ``update_rejected``: the user deliberately declined that public version;
      pushing would silently undo the very change they declined.
    - ``no_local_changes``: the copy's published fields already match the
      public entry, so there is nothing to contribute.
    """
    if owned_public_culture is None:
        return None

    if culture.source_public_culture_id == owned_public_culture.id:
        if has_pending_public_culture_update(culture):
            return 'update_rejected' if is_public_culture_update_rejected(culture) else 'update_pending'
        if not culture.is_modified_from_source:
            return 'no_local_changes'
        return None

    if _copy_fields(culture) == _copy_fields(owned_public_culture):
        return 'no_local_changes'
    return None


def reject_public_culture_update(culture: Culture) -> Culture:
    """Record that the user declined the pending public version for this copy.

    Deliberately does not touch a single library-sourced field: rejecting is a
    decision about the *notice*, not an edit of the local copy. The write uses a
    queryset update so it never runs :meth:`Culture.save`'s divergence pass or
    records a revision for what is not a content change.
    """
    public_culture = culture.source_public_culture
    if public_culture is None:
        return culture
    Culture.objects.filter(pk=culture.pk).update(rejected_public_version=public_culture.version)
    culture.rejected_public_version = public_culture.version
    return culture


def build_public_culture_update_status(culture: Culture) -> PublicCultureUpdateStatus | None:
    """The field-level preview of the pending library update, or None if there is none.

    Still built after a rejection: the user must be able to reopen the diff and
    change their mind without waiting for another public edit.
    """
    if not has_pending_public_culture_update(culture):
        return None
    public_culture = culture.source_public_culture
    local_payload = _copy_fields(culture)
    public_payload = _copy_fields(public_culture)
    changes = [
        PublicCultureFieldChange(
            field=field,
            local_value=_json_safe(local_payload[field]),
            public_value=_json_safe(public_payload[field]),
        )
        for field in CULTURE_COPY_FIELDS
        if local_payload[field] != public_payload[field]
    ]
    return PublicCultureUpdateStatus(
        public_culture=public_culture,
        public_version=public_culture.version,
        local_version=culture.source_public_version,
        has_local_changes=bool(culture.is_modified_from_source),
        is_rejected=is_public_culture_update_rejected(culture),
        changes=changes,
    )


def import_public_culture_into_project(
    *,
    public_culture: PublicCulture,
    project: Project,
    mode: str = 'auto',
) -> tuple[Culture, str]:
    """Import a public culture into a project, or resolve a re-import.

    `mode`:
    - 'auto' (default): look for an existing culture in this project imported
      from this same public culture. None found -> create. Found and
      unmodified -> sync if the library version changed, or no-op if already
      identical. Found and locally modified -> raise
      PublicCultureImportConfirmationRequiredError instead of guessing.
    - 'update': overwrite the existing linked culture with the current
      library version regardless of local changes (the confirmed "yes,
      overwrite" choice from the conflict dialog).
    - 'new': always create a fresh culture, uniquifying the name if it
      collides with an existing one in the project.

    Returns (culture, operation) where operation is one of
    'created' | 'unchanged' | 'updated'.
    """
    if mode == 'new':
        culture = _create_culture_from_public(public_culture=public_culture, project=project, unique_name=True)
        _ensure_local_general_culture(public_culture=public_culture, project=project)
        return culture, 'created'

    # Duplicates can already exist from before this check existed; picking the
    # most recent is a defensive choice, not a guarantee only one exists.
    existing = Culture.objects.filter(
        project=project,
        source_public_culture=public_culture,
    ).order_by('-id').first()

    if existing is None:
        culture = _create_culture_from_public(public_culture=public_culture, project=project)
        _ensure_local_general_culture(public_culture=public_culture, project=project)
        return culture, 'created'

    if mode == 'update':
        culture = _apply_public_culture_update(culture=existing, public_culture=public_culture)
        return culture, 'updated'

    if existing.is_modified_from_source:
        raise PublicCultureImportConfirmationRequiredError(existing_culture=existing)

    if existing.source_public_version == public_culture.version:
        return existing, 'unchanged'

    culture = _apply_public_culture_update(culture=existing, public_culture=public_culture)
    return culture, 'updated'
