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
    'allow_deviation_delivery_weeks',
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
    'allow_deviation_delivery_weeks',
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
    duplicates: list['DuplicateCandidate']
    can_publish: bool


@dataclass(frozen=True)
class DuplicateCandidate:
    id: int
    name: str
    variety: str
    version: int
    published_at: Any
    created_by_label: str


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

        locked.version = max(locked.version, 1) + 1
        locked.save(update_fields=[*changed_field_names, 'version', 'updated_at'])
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


def build_public_culture_payload(culture: Culture, *, public_variety: str | None = None) -> dict[str, Any]:
    payload = _copy_fields(culture)
    if public_variety is not None:
        payload['variety'] = public_variety
    payload['seed_packages'] = _seed_packages_payload_from_culture(culture)
    payload['source_project_culture'] = culture
    payload['source_project'] = culture.project
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


def resolve_publishing_crop_species(*, culture: Culture, crop_species_id: int | None) -> CropSpecies | None:
    if crop_species_id:
        return CropSpecies.objects.filter(id=crop_species_id, status=CropSpecies.STATUS_PUBLISHED).first()
    return culture.crop_species if culture.crop_species and culture.crop_species.status == CropSpecies.STATUS_PUBLISHED else None


def build_project_culture_payload(public_culture: PublicCulture) -> dict[str, Any]:
    payload = _copy_fields(public_culture)
    payload['crop_species'] = public_culture.crop_species
    payload['source_public_culture'] = public_culture
    payload['source_public_version'] = public_culture.version
    payload['origin_type'] = Culture.ORIGIN_IMPORTED
    payload['is_modified_from_source'] = False
    return payload


def link_project_culture_to_public_reference(*, culture: Culture, public_culture: PublicCulture) -> Culture:
    """Link a private culture to a published public culture without publishing a duplicate."""
    source_payload = build_project_culture_payload(public_culture)
    tracked_fields = Culture._SOURCE_DIVERGENCE_TRACKED_FIELDS
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
    return culture


def detect_public_culture_duplicates(
    culture: Culture,
    *,
    crop_species: CropSpecies | None = None,
    public_variety: str | None = None,
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
        ))
        if len(candidates) >= 5:
            break
    return candidates


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
    public_variety = '' if publish_as_general else None
    duplicates = detect_public_culture_duplicates(
        culture,
        crop_species=crop_species,
        public_variety=public_variety,
    ) if crop_species else []
    update_target = find_owned_public_culture_for_update(culture=culture, user=user)
    if update_target:
        duplicates = [item for item in duplicates if item.id != update_target.id]
    missing_required_fields = get_public_required_field_gaps(culture, require_variety=not publish_as_general)
    can_publish = bool(crop_species and language_code and not missing_required_fields and not duplicates)
    return PublishingCheckResult(
        crop_species=crop_species,
        original_language_code=language_code,
        available_language_codes=available_language_codes,
        missing_required_fields=missing_required_fields,
        duplicates=duplicates,
        can_publish=can_publish,
    )


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
        if source_public and source_public.created_by_id != user.id:
            return None

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


def _update_public_culture_from_project_culture(*, public_culture: PublicCulture, culture: Culture) -> PublicCulture:
    ensure_public_culture_revision(public_culture)
    previous_snapshot = build_public_culture_snapshot(public_culture)
    payload = build_public_culture_payload(culture)
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


def publish_culture_to_public_library(
    *,
    culture: Culture,
    user: User | None,
    crop_species_id: int | None = None,
    original_language_code: str | None = None,
    publish_as_general: bool = False,
) -> tuple[PublicCulture, list[DuplicateCandidate], str]:
    check_result = build_publishing_check_result(
        culture=culture,
        crop_species_id=crop_species_id,
        original_language_code=original_language_code,
        user=user,
        publish_as_general=publish_as_general,
    )
    if not check_result.crop_species or not check_result.original_language_code or check_result.missing_required_fields:
        raise PublicCulturePublishingValidationError(check_result=check_result)

    update_target = find_owned_public_culture_for_update(culture=culture, user=user)
    duplicates = check_result.duplicates
    if update_target:
        previous_status = update_target.status
        culture.crop_species = check_result.crop_species
        culture.save(update_fields=['crop_species', 'updated_at'])
        updated_public_culture = _update_public_culture_from_project_culture(public_culture=update_target, culture=culture)
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
    culture.crop_species = check_result.crop_species
    culture.save(update_fields=['crop_species', 'updated_at'])
    public_culture = PublicCulture.objects.create(
        created_by=user,
        status=PublicCulture.STATUS_PUBLISHED,
        version=1,
        crop_species=check_result.crop_species,
        original_language_code=check_result.original_language_code,
        **build_public_culture_payload(culture, public_variety='' if publish_as_general else None),
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
) -> PublicCulture:
    """Remove a public culture from the public library.

    This is the single entry point for both removal paths, so the UI only has
    to offer one "remove from library" action:

    - the contributor withdraws their own entry (`withdrawn`), which stays
      reversible: publishing the project culture again republishes it;
    - a moderator removes somebody else's entry (`removed`) and must supply a
      structured moderation reason.
    """
    if is_public_culture_contributor(public_culture=public_culture, user=user):
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


def import_public_culture_into_project(*, public_culture: PublicCulture, project: Project) -> Culture:
    culture = Culture.objects.create(
        project=project,
        **build_project_culture_payload(public_culture),
    )
    for package in public_culture.seed_packages or []:
        culture.seed_packages.create(
            project=project,
            size_value=package.get('size_value'),
            size_unit=package.get('size_unit') or 'g',
            evidence_text=package.get('evidence_text') or '',
            last_seen_at=package.get('last_seen_at') or None,
        )
    return culture
