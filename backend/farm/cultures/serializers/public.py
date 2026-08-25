"""Serializer for the public culture library."""

from typing import Any

from rest_framework import serializers

from config.languages import (
    DEFAULT_LANGUAGE_CODE,
    SUPPORTED_LANGUAGE_CODES,
    normalize_language_tag,
    resolve_request_language,
)
from crops.permissions import is_public_library_moderator
from farm.common.serializer_fields import LocalizedDecimalField
from farm.models import (
    PublicCulture,
    PublicCultureChangeProposal,
    PublicCultureDiscussionComment,
    PublicCultureDiscussionTopic,
    PublicCultureRevision,
    format_culture_display_name,
)
from farm.project_context import get_active_project_optional
from farm.services.public_cultures import PUBLIC_CULTURE_EDITABLE_FIELDS

PUBLIC_CULTURE_PROPOSABLE_FIELDS = {
    'notes',
    'crop_family',
    'nutrient_demand',
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
    'seed_rate_value',
    'seed_rate_unit',
    'seed_rate_by_cultivation',
    'sowing_calculation_safety_percent',
    'thousand_kernel_weight_g',
    'seeding_requirement',
    'seeding_requirement_type',
    'seed_packages',
}


def get_public_user_label(user: Any) -> str:
    if user is None:
        return ''
    public_profile = getattr(user, 'public_profile', None)
    if public_profile and public_profile.public_display_name:
        return public_profile.public_display_name
    return ''


class PublicCultureSerializer(serializers.ModelSerializer):
    """Public library entry, with both the resolved and the raw translations.

    ``display_name``/``description`` are what the app renders in the caller's
    language (after the standard fallback chain), while ``translations`` and
    ``crop_species_translations`` carry every stored language so editorial and
    moderation screens can edit any of them. ``variety``, supplier, spacings
    and every numeric field are language-independent and served verbatim.
    """

    created_by_label = serializers.SerializerMethodField()
    crop_species_name = serializers.SerializerMethodField()
    crop_species_canonical_name = serializers.CharField(
        source='crop_species.name',
        read_only=True,
        default='',
    )
    crop_species_translations = serializers.SerializerMethodField()
    crop_species_search_names = serializers.SerializerMethodField()
    # A `proposed` species is one a user suggested and no moderator has
    # reviewed yet. Entries published under it are usable but provisional, so
    # the UI marks them and blocks import/update/discussion until it is
    # reviewed — see docs/crop-library-architecture.md.
    crop_species_status = serializers.CharField(
        source='crop_species.status',
        read_only=True,
        default='',
    )
    display_name = serializers.SerializerMethodField()
    display_language_code = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    description_language_code = serializers.SerializerMethodField()
    translations = serializers.SerializerMethodField()
    project_import_status = serializers.SerializerMethodField()
    imported_cultures_count = serializers.SerializerMethodField()
    thousand_kernel_weight_g = LocalizedDecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = PublicCulture
        fields = [
            'id',
            'status',
            'removal_reason',
            'name',
            'variety',
            'notes',
            'crop_species',
            'crop_species_name',
            'crop_species_canonical_name',
            'crop_species_translations',
            'crop_species_search_names',
            'crop_species_status',
            'display_name',
            'display_language_code',
            'description',
            'description_language_code',
            'translations',
            'original_language_code',
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
            'version',
            'published_at',
            'created_at',
            'updated_at',
            'created_by_label',
            'source_project_culture',
            'source_project',
            'project_import_status',
            'imported_cultures_count',
        ]
        read_only_fields = fields

    def get_created_by_label(self, obj: PublicCulture) -> str:
        return obj.created_by_label

    def get_project_import_status(self, obj: PublicCulture) -> dict[str, Any] | None:
        """Whether the active project already imported this entry, for the import button state.

        Relies on the view prefetching ``prefetched_project_cultures`` (the
        active project's Cultures linked to this public entry via
        ``source_public_culture``) so this stays a single extra query for
        the whole list rather than one per row.
        """
        cultures = getattr(obj, 'prefetched_project_cultures', None)
        if not cultures:
            return None
        culture = cultures[0]
        return {
            'culture_id': culture.id,
            'culture_name': format_culture_display_name(culture.name, culture.variety),
            'is_modified_from_source': culture.is_modified_from_source,
        }

    def _language(self) -> str:
        request = self.context.get('request')
        return resolve_request_language(request) if request is not None else DEFAULT_LANGUAGE_CODE

    def _region(self) -> str:
        request = self.context.get('request')
        if request is None:
            return ''
        active_project = getattr(request, 'active_project', None)
        if active_project is None:
            active_project = get_active_project_optional(request)
        return getattr(active_project, 'region', '') if active_project is not None else ''

    def get_crop_species_name(self, obj: PublicCulture) -> str:
        """Species name in the caller's language; never empty, never an id."""
        return obj.display_name(self._language(), self._region())[0]

    def get_display_name(self, obj: PublicCulture) -> str:
        return obj.display_name(self._language(), self._region())[0]

    def get_display_language_code(self, obj: PublicCulture) -> str:
        """Language the name came from — '' means "no real translation exists"."""
        return obj.display_name(self._language(), self._region())[1]

    def get_description(self, obj: PublicCulture) -> str:
        return obj.localized_description(self._language())[0]

    def get_description_language_code(self, obj: PublicCulture) -> str:
        return obj.localized_description(self._language())[1]

    def get_translations(self, obj: PublicCulture) -> dict[str, str]:
        return obj.descriptions_by_language()

    def get_crop_species_translations(self, obj: PublicCulture) -> dict[str, str]:
        if obj.crop_species is None:
            return {}
        return obj.crop_species.translations_by_language()

    def get_crop_species_search_names(self, obj: PublicCulture) -> list[str]:
        if obj.crop_species is None:
            return []
        return obj.crop_species.search_names()

    def get_imported_cultures_count(self, obj: PublicCulture) -> int:
        """How many project cultures (across all projects) are linked to this entry.

        Shown to admins editing a public entry so a rename's blast radius is
        visible before saving. The list/retrieve queryset annotates this
        directly (a single JOIN, no per-row query); the fallback count only
        runs for objects built outside that queryset, such as the instance
        returned right after a direct edit.
        """
        annotated = getattr(obj, 'imported_cultures_count', None)
        if annotated is not None:
            return annotated
        return obj.imported_cultures.filter(deleted_at__isnull=True).count()


class PublicCultureUpdateSerializer(serializers.ModelSerializer):
    base_version = serializers.IntegerField(required=False, min_value=1, write_only=True)

    class Meta:
        model = PublicCulture
        fields = [*PUBLIC_CULTURE_EDITABLE_FIELDS, 'base_version']
        extra_kwargs = {
            'notes': {'required': False, 'allow_blank': True},
            'crop_family': {'required': False, 'allow_blank': True},
            'nutrient_demand': {'required': False, 'allow_blank': True},
            'cultivation_type': {'required': False, 'allow_blank': True},
            'harvest_method': {'required': False, 'allow_blank': True},
            'seed_rate_unit': {'required': False, 'allow_null': True, 'allow_blank': True},
            'seeding_requirement_type': {'required': False, 'allow_blank': True},
            'display_color': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        incoming_fields = set(getattr(self, 'initial_data', {}) or {})
        allowed_fields = set(PUBLIC_CULTURE_EDITABLE_FIELDS) | {'base_version'}
        unknown_fields = sorted(incoming_fields - allowed_fields)
        if unknown_fields:
            raise serializers.ValidationError({
                'non_field_errors': [f"Unsupported public culture fields: {', '.join(unknown_fields)}"],
            })
        return attrs


class PublicCultureTranslationsUpdateSerializer(serializers.Serializer):
    """Validates a ``{language_code: description}`` map before it is stored."""

    translations = serializers.DictField(child=serializers.CharField(allow_blank=True, trim_whitespace=False))

    def validate_translations(self, value: dict[str, str]) -> dict[str, str]:
        cleaned: dict[str, str] = {}
        for language_code, description in value.items():
            normalized = normalize_language_tag(language_code)
            if not normalized:
                allowed = ', '.join(SUPPORTED_LANGUAGE_CODES)
                raise serializers.ValidationError(
                    f'Unsupported language code "{language_code}". Allowed values: {allowed}.',
                )
            cleaned[normalized] = description
        if not cleaned:
            raise serializers.ValidationError('At least one language version is required.')
        return cleaned


class PublicCultureRevertSerializer(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    base_version = serializers.IntegerField(required=False, min_value=1)


class PublicCultureRevisionSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCultureRevision
        fields = [
            'id',
            'public_culture',
            'version',
            'action',
            'snapshot',
            'changed_fields',
            'restored_from_version',
            'created_by_label',
            'created_at',
        ]
        read_only_fields = fields

    def get_created_by_label(self, obj: PublicCultureRevision) -> str:
        return get_public_user_label(obj.created_by)


class PublicCultureDiscussionCommentSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField()
    deletion_kind = serializers.SerializerMethodField()
    delete_blocked_reason = serializers.SerializerMethodField()
    is_edited = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = PublicCultureDiscussionComment
        fields = [
            'id',
            'topic',
            'parent',
            'body',
            'created_by_label',
            'created_at',
            'updated_at',
            'deleted_at',
            'deletion_kind',
            'delete_blocked_reason',
            'is_edited',
            'can_edit',
            'can_delete',
        ]
        read_only_fields = [
            'id',
            'topic',
            'created_by_label',
            'created_at',
            'updated_at',
            'deleted_at',
            'deletion_kind',
            'delete_blocked_reason',
            'is_edited',
            'can_edit',
            'can_delete',
        ]

    def get_created_by_label(self, obj: PublicCultureDiscussionComment) -> str:
        return get_public_user_label(obj.created_by)

    def get_deletion_kind(self, obj: PublicCultureDiscussionComment) -> str | None:
        if not obj.deleted_at:
            return None
        if obj.deleted_by_id is not None and obj.deleted_by_id == obj.created_by_id:
            return 'author'
        if obj.deleted_by_id is not None:
            return 'moderator'
        return 'unknown'

    def get_delete_blocked_reason(self, obj: PublicCultureDiscussionComment) -> str | None:
        if obj.deleted_at:
            return None
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated or is_public_library_moderator(user):
            return None
        if obj.created_by_id != user.id:
            return None
        root_comment_id = self.context.get('root_comment_id')
        visible_reply_exists = bool(self.context.get('visible_reply_exists'))
        if root_comment_id == obj.id and visible_reply_exists:
            return 'visible_replies'
        return None

    def get_is_edited(self, obj: PublicCultureDiscussionComment) -> bool:
        return bool(obj.edited_at and not obj.deleted_at)

    def get_can_edit(self, obj: PublicCultureDiscussionComment) -> bool:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and (obj.created_by_id == user.id or is_public_library_moderator(user)))

    def get_can_delete(self, obj: PublicCultureDiscussionComment) -> bool:
        if obj.deleted_at:
            return False
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        may_moderate = is_public_library_moderator(user)
        if obj.created_by_id != user.id and not may_moderate:
            return False
        root_comment_id = self.context.get('root_comment_id')
        if root_comment_id is None:
            root_comment_id = obj.topic.comments.order_by('created_at', 'id').values_list('id', flat=True).first()
        if may_moderate or obj.id != root_comment_id:
            return True
        return not bool(self.context.get('visible_reply_exists'))

    def validate_body(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Comment must not be empty.')
        return value


class PublicCultureDiscussionTopicSerializer(serializers.ModelSerializer):
    created_by_label = serializers.SerializerMethodField()
    version = serializers.IntegerField(source='revision.version', read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    last_activity_at = serializers.DateTimeField(read_only=True)
    last_comment_preview = serializers.CharField(read_only=True, allow_blank=True, allow_null=True)

    class Meta:
        model = PublicCultureDiscussionTopic
        fields = [
            'id',
            'public_culture',
            'title',
            'created_by_label',
            'created_at',
            'revision',
            'version',
            'comment_count',
            'last_activity_at',
            'last_comment_preview',
        ]
        read_only_fields = [
            'id',
            'public_culture',
            'created_by_label',
            'created_at',
            'version',
            'comment_count',
            'last_activity_at',
            'last_comment_preview',
        ]

    def get_created_by_label(self, obj: PublicCultureDiscussionTopic) -> str:
        return get_public_user_label(obj.created_by)


class PublicCultureChangeProposalSerializer(serializers.ModelSerializer):
    proposed_by_label = serializers.SerializerMethodField()
    reviewed_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCultureChangeProposal
        fields = [
            'id',
            'public_culture',
            'summary',
            'proposed_data',
            'status',
            'proposed_by_label',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'public_culture',
            'status',
            'proposed_by_label',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]

    def validate_proposed_data(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError('Proposed data must be an object.')
        unknown_fields = sorted(set(value) - PUBLIC_CULTURE_PROPOSABLE_FIELDS)
        if unknown_fields:
            raise serializers.ValidationError(f"Unsupported proposal fields: {', '.join(unknown_fields)}")
        if not value:
            raise serializers.ValidationError('At least one changed field is required.')
        return value

    def get_proposed_by_label(self, obj: PublicCultureChangeProposal) -> str:
        return get_public_user_label(obj.proposed_by)

    def get_reviewed_by_label(self, obj: PublicCultureChangeProposal) -> str:
        return get_public_user_label(obj.reviewed_by)
