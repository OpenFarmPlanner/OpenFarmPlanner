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
from django.utils import timezone

from crops.models import CropSpecies
from farm.models import Culture, Project, PublicCulture, PublicCultureRevision, PublicCultureStatusEvent

User = get_user_model()

CULTURE_COPY_FIELDS = [
    'name',
    'variety',
    'notes',
    'seed_supplier',
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
    'name',
    'variety',
    'notes',
    'seed_supplier',
    'supplier_name',
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

PUBLIC_ORIGINAL_LANGUAGE_CODES = {'de', 'en'}

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


def get_culture_supplier_label(culture: Culture) -> str:
    if culture.supplier:
        return culture.supplier.name or ''
    return culture.seed_supplier or ''


def get_public_supplier_label(public_culture: PublicCulture) -> str:
    return public_culture.supplier_name or public_culture.seed_supplier or ''


def build_public_culture_payload(culture: Culture) -> dict[str, Any]:
    payload = _copy_fields(culture)
    payload['supplier_name'] = culture.supplier.name if culture.supplier else (culture.seed_supplier or '')
    payload['seed_packages'] = _seed_packages_payload_from_culture(culture)
    payload['source_project_culture'] = culture
    payload['source_project'] = culture.project
    payload['published_at'] = timezone.now()
    return payload


def normalize_language_code(value: str | None) -> str:
    normalized = (value or '').strip().lower()
    if normalized in PUBLIC_ORIGINAL_LANGUAGE_CODES:
        return normalized
    return ''


def detect_available_language_codes(culture: Culture) -> list[str]:
    # Legacy public cultures are single-language records. Until translated
    # content rows exist, non-empty project text represents the source language
    # the user selects in the wizard.
    return []


def get_public_required_field_gaps(culture: Culture) -> list[MissingRequiredField]:
    gaps: list[MissingRequiredField] = []
    for field in PUBLIC_REQUIRED_FIELDS:
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
    payload['seed_supplier'] = public_culture.supplier_name or public_culture.seed_supplier or ''
    payload['source_public_culture'] = public_culture
    payload['source_public_version'] = public_culture.version
    payload['origin_type'] = Culture.ORIGIN_IMPORTED
    payload['is_modified_from_source'] = False
    return payload


def detect_public_culture_duplicates(culture: Culture, *, crop_species: CropSpecies | None = None) -> list[DuplicateCandidate]:
    normalized_supplier = normalize_identity_value(get_culture_supplier_label(culture))
    queryset = PublicCulture.objects.filter(
        variety_normalized=culture.variety_normalized,
        status=PublicCulture.STATUS_PUBLISHED,
    )
    if crop_species is not None:
        queryset = queryset.filter(crop_species=crop_species)
    else:
        queryset = queryset.filter(name_normalized=culture.name_normalized)
    queryset = queryset.select_related('created_by').order_by('-published_at', '-id')

    candidates: list[DuplicateCandidate] = []
    for item in queryset:
        if normalize_identity_value(get_public_supplier_label(item)) != normalized_supplier:
            continue
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
) -> PublishingCheckResult:
    crop_species = resolve_publishing_crop_species(culture=culture, crop_species_id=crop_species_id)
    language_code = normalize_language_code(original_language_code)
    available_language_codes = detect_available_language_codes(culture)
    if language_code and language_code not in available_language_codes:
        available_language_codes = [language_code, *available_language_codes]
    duplicates = detect_public_culture_duplicates(culture, crop_species=crop_species) if crop_species else []
    missing_required_fields = get_public_required_field_gaps(culture)
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
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


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
) -> tuple[PublicCulture, list[DuplicateCandidate], str]:
    check_result = build_publishing_check_result(
        culture=culture,
        crop_species_id=crop_species_id,
        original_language_code=original_language_code,
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
        non_target_duplicates = [item for item in duplicates if item.id != update_target.id]
        return updated_public_culture, non_target_duplicates, 'updated'

    if duplicates:
        raise DuplicatePublicCultureError(
            duplicates=duplicates,
            normalized_identity={
                'name': culture.name_normalized,
                'variety': culture.variety_normalized,
                'seed_supplier': normalize_identity_value(get_culture_supplier_label(culture)),
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
        **build_public_culture_payload(culture),
    )
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


def withdraw_public_culture(*, public_culture: PublicCulture, user: User | None) -> PublicCulture:
    if not user or not user.is_authenticated or public_culture.created_by_id != user.id:
        raise PublicCulturePermissionError('Only the contributor may withdraw this public culture.')
    if public_culture.status != PublicCulture.STATUS_PUBLISHED:
        raise PublicCultureStatusTransitionError('Only published public cultures can be withdrawn.')
    return _set_public_culture_status(
        public_culture=public_culture,
        status=PublicCulture.STATUS_WITHDRAWN,
        user=user,
    )


def remove_public_culture(*, public_culture: PublicCulture, user: User | None, reason: str) -> PublicCulture:
    if not _is_public_library_moderator(user):
        raise PublicCulturePermissionError('Only moderators may remove public cultures.')
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
