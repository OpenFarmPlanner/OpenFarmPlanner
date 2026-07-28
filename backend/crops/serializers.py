"""
Defined independently from `farm.cultures.serializers.PublicCultureSerializer` on
purpose, even though the two are currently near-identical: this app must
depend on `farm.models` only, never on farm's domain serializer/view packages
(that would put the dependency arrow backwards — see
docs/crop-library-architecture.md). The small duplication is the
deliberate cost of keeping that direction correct until `PublicCulture`
itself moves into this app.
"""
from rest_framework import serializers

from farm.cultures.serializers.public import get_public_user_label
from farm.models import PublicCulture

from .models import CropSpecies, PublicLibraryModeratorRequest


class CropSpeciesSerializer(serializers.ModelSerializer):
    """Official species that project cultures may link to before publication."""

    proposed_by_label = serializers.SerializerMethodField()
    reviewed_by_label = serializers.SerializerMethodField()
    similar_species = serializers.SerializerMethodField()

    class Meta:
        model = CropSpecies
        fields = [
            'id',
            'name',
            'status',
            'proposed_by_label',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'similar_species',
        ]
        read_only_fields = [
            'id',
            'status',
            'proposed_by_label',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'similar_species',
        ]

    def get_proposed_by_label(self, obj: CropSpecies) -> str:
        return get_public_user_label(obj.proposed_by)

    def get_reviewed_by_label(self, obj: CropSpecies) -> str:
        return get_public_user_label(obj.reviewed_by)

    def get_similar_species(self, obj: CropSpecies) -> list[dict[str, str | int]]:
        if obj.status != CropSpecies.STATUS_PROPOSED:
            return []
        query = CropSpecies.objects.filter(status=CropSpecies.STATUS_PUBLISHED).exclude(pk=obj.pk)
        exact = query.filter(name_normalized=obj.name_normalized).first()
        if exact is not None:
            return [{'id': exact.id, 'name': exact.name, 'match_type': 'exact'}]
        if not obj.name:
            return []
        return [
            {'id': item.id, 'name': item.name, 'match_type': 'similar'}
            for item in query.filter(name__icontains=obj.name[:24]).order_by('name')[:5]
        ]

    def validate_name(self, value: str) -> str:
        from farm.utils import normalize_text

        trimmed = ' '.join(value.split())
        if not trimmed:
            raise serializers.ValidationError('A crop species name is required.')
        normalized = normalize_text(trimmed)
        if CropSpecies.objects.filter(name_normalized=normalized).exists():
            raise serializers.ValidationError(
                'This crop species already exists or has already been proposed.',
            )
        return trimmed


class PublicLibraryModeratorRequestSerializer(serializers.ModelSerializer):
    user_label = serializers.SerializerMethodField()
    reviewed_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicLibraryModeratorRequest
        fields = [
            'id',
            'user',
            'user_label',
            'motivation',
            'status',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'user_label',
            'status',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'motivation': {'required': True, 'allow_blank': False, 'max_length': 2000},
        }

    def get_user_label(self, obj: PublicLibraryModeratorRequest) -> str:
        return (
            get_public_user_label(obj.user)
            or getattr(obj.user, 'email', '')
            or getattr(obj.user, 'username', '')
        )

    def get_reviewed_by_label(self, obj: PublicLibraryModeratorRequest) -> str:
        return get_public_user_label(obj.reviewed_by)


class CropSerializer(serializers.ModelSerializer):
    """Read-only representation of a published crop, for the /api/crops/ surface."""

    created_by_label = serializers.SerializerMethodField()

    class Meta:
        model = PublicCulture
        fields = [
            'id',
            'status',
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
        ]
        read_only_fields = fields

    crop_species_name = serializers.CharField(
        source='crop_species.name',
        read_only=True,
        default='',
    )

    def get_created_by_label(self, obj: PublicCulture) -> str:
        return obj.created_by_label
