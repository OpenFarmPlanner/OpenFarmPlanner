"""Serializer for the public culture library."""

from typing import Any

from rest_framework import serializers

from crops.permissions import is_public_library_moderator
from farm.models import (
    PublicCulture,
    PublicCultureChangeProposal,
    PublicCultureDiscussionComment,
    PublicCultureDiscussionTopic,
    PublicCultureRevision,
)
from farm.services.public_cultures import PUBLIC_CULTURE_EDITABLE_FIELDS

PUBLIC_CULTURE_PROPOSABLE_FIELDS = {
    'notes',
    'seed_supplier',
    'supplier_name',
    'crop_family',
    'nutrient_demand',
    'cultivation_type',
    'cultivation_types',
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
    created_by_label = serializers.SerializerMethodField()
    crop_species_name = serializers.CharField(source='crop_species.name', read_only=True, default='')

    class Meta:
        model = PublicCulture
        fields = [
            'id',
            'status',
            'removal_reason',
            'name',
            'variety',
            'notes',
            'seed_supplier',
            'supplier_name',
            'crop_species',
            'crop_species_name',
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
            'version',
            'published_at',
            'created_at',
            'updated_at',
            'created_by_label',
            'source_project_culture',
            'source_project',
        ]
        read_only_fields = fields

    def get_created_by_label(self, obj: PublicCulture) -> str:
        return obj.created_by_label


class PublicCultureUpdateSerializer(serializers.ModelSerializer):
    base_version = serializers.IntegerField(required=False, min_value=1, write_only=True)

    class Meta:
        model = PublicCulture
        fields = [*PUBLIC_CULTURE_EDITABLE_FIELDS, 'base_version']
        extra_kwargs = {
            'notes': {'required': False, 'allow_blank': True},
            'seed_supplier': {'required': False, 'allow_blank': True},
            'supplier_name': {'required': False, 'allow_blank': True},
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
    is_edited = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

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
            'is_edited',
            'can_edit',
        ]
        read_only_fields = [
            'id',
            'topic',
            'created_by_label',
            'created_at',
            'updated_at',
            'deleted_at',
            'is_edited',
            'can_edit',
        ]

    def get_created_by_label(self, obj: PublicCultureDiscussionComment) -> str:
        return get_public_user_label(obj.created_by)

    def get_is_edited(self, obj: PublicCultureDiscussionComment) -> bool:
        return bool(obj.edited_at and not obj.deleted_at)

    def get_can_edit(self, obj: PublicCultureDiscussionComment) -> bool:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and (obj.created_by_id == user.id or is_public_library_moderator(user)))

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

    class Meta:
        model = PublicCultureDiscussionTopic
        fields = ['id', 'public_culture', 'title', 'created_by_label', 'created_at', 'revision', 'version', 'comment_count', 'last_activity_at']
        read_only_fields = ['id', 'public_culture', 'created_by_label', 'created_at', 'version', 'comment_count', 'last_activity_at']

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
