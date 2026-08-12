"""
Defined independently from `farm.cultures.serializers.PublicCultureSerializer` on
purpose, even though the two are currently near-identical: this app must
depend on `farm.models` only, never on farm's domain serializer/view packages
(that would put the dependency arrow backwards — see
docs/crop-library-architecture.md). The small duplication is the
deliberate cost of keeping that direction correct until `PublicCulture`
itself moves into this app.
"""
from django.db.models import Q
from rest_framework import serializers

from config.languages import (
    DEFAULT_LANGUAGE_CODE,
    SUPPORTED_LANGUAGE_CODES,
    normalize_language_tag,
    resolve_request_language,
)
from farm.cultures.serializers.public import get_public_user_label
from farm.models import PublicCulture

from .models import CropSpecies, CropSpeciesTranslation, PublicLibraryModeratorRequest


def get_request_language(context: dict) -> str:
    """Preferred content language for the request behind a serializer context."""
    request = context.get('request')
    if request is None:
        return DEFAULT_LANGUAGE_CODE
    return resolve_request_language(request)


class CropSpeciesTranslationSerializer(serializers.ModelSerializer):
    """One language version of a species name.

    Editorial and moderation views need every translation, so this is exposed
    alongside the single resolved ``display_name`` the app UI uses.
    """

    class Meta:
        model = CropSpeciesTranslation
        fields = ['id', 'language_code', 'common_name']
        read_only_fields = ['id']

    def validate_language_code(self, value: str) -> str:
        normalized = normalize_language_tag(value)
        if not normalized:
            allowed = ', '.join(SUPPORTED_LANGUAGE_CODES)
            raise serializers.ValidationError(
                f'Unsupported language code. Allowed values: {allowed}.',
            )
        return normalized

    def validate_common_name(self, value: str) -> str:
        trimmed = ' '.join((value or '').split())
        if not trimmed:
            raise serializers.ValidationError('A common name is required.')
        return trimmed


class CropSpeciesSerializer(serializers.ModelSerializer):
    """Official species that project cultures may link to before publication.

    Exposes both shapes on purpose: ``display_name`` is the single resolved
    name the app renders, ``translations`` is the full set that editorial and
    moderation screens need in order to edit any language.
    """

    proposed_by_label = serializers.SerializerMethodField()
    reviewed_by_label = serializers.SerializerMethodField()
    similar_species = serializers.SerializerMethodField()
    translations = CropSpeciesTranslationSerializer(many=True, required=False)
    display_name = serializers.SerializerMethodField()
    display_language_code = serializers.SerializerMethodField()

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
            'translations',
            'display_name',
            'display_language_code',
        ]
        read_only_fields = [
            'id',
            'status',
            'proposed_by_label',
            'reviewed_by_label',
            'review_note',
            'reviewed_at',
            'similar_species',
            'display_name',
            'display_language_code',
        ]

    def get_display_name(self, obj: CropSpecies) -> str:
        return obj.localized_name(get_request_language(self.context))[0]

    def get_display_language_code(self, obj: CropSpecies) -> str:
        """The language actually rendered — '' when only the canonical name existed.

        The UI uses this to note "only available in another language" instead
        of passing a German name off as an English one.
        """
        return obj.localized_name(get_request_language(self.context))[1]

    def create(self, validated_data: dict) -> CropSpecies:
        translations = validated_data.pop('translations', [])
        species = super().create(validated_data)
        self._write_translations(species, translations)
        return species

    def update(self, instance: CropSpecies, validated_data: dict) -> CropSpecies:
        translations = validated_data.pop('translations', None)
        species = super().update(instance, validated_data)
        if translations is not None:
            self._write_translations(species, translations)
        return species

    @staticmethod
    def _write_translations(species: CropSpecies, translations: list[dict]) -> None:
        """Upsert the supplied languages; languages left out stay untouched.

        Not filling in every supported language is a normal state — one
        language version is enough to publish — so omitted languages must not
        be interpreted as "delete this translation".
        """
        for entry in translations:
            language_code = entry.get('language_code')
            common_name = entry.get('common_name')
            if not language_code or not common_name:
                continue
            CropSpeciesTranslation.objects.update_or_create(
                species=species,
                language_code=language_code,
                defaults={'common_name': common_name},
            )

    def validate_translations(self, value: list[dict]) -> list[dict]:
        seen: set[str] = set()
        for entry in value:
            language_code = entry.get('language_code')
            if language_code in seen:
                raise serializers.ValidationError(
                    f'Duplicate translation for language "{language_code}".',
                )
            seen.add(language_code)
        return value

    def get_proposed_by_label(self, obj: CropSpecies) -> str:
        return get_public_user_label(obj.proposed_by)

    def get_reviewed_by_label(self, obj: CropSpecies) -> str:
        return get_public_user_label(obj.reviewed_by)

    def get_similar_species(self, obj: CropSpecies) -> list[dict[str, str | int]]:
        """Published species that a pending proposal probably duplicates.

        Matches across *all* languages: proposing "Tomato" when "Tomate"
        already exists is a duplicate of the same species, not a new one.
        """
        if obj.status != CropSpecies.STATUS_PROPOSED:
            return []
        language = get_request_language(self.context)
        query = (
            CropSpecies.objects
            .filter(status=CropSpecies.STATUS_PUBLISHED)
            .exclude(pk=obj.pk)
            .prefetch_related('translations')
        )
        exact = query.filter(
            Q(name_normalized=obj.name_normalized)
            | Q(translations__common_name_normalized=obj.name_normalized),
        ).distinct().first()
        if exact is not None:
            return [{
                'id': exact.id,
                'name': exact.name,
                'display_name': exact.localized_name(language)[0],
                'match_type': 'exact',
            }]
        if not obj.name:
            return []
        needle = obj.name[:24]
        similar = query.filter(
            Q(name__icontains=needle) | Q(translations__common_name__icontains=needle),
        ).distinct().order_by('name')[:5]
        return [
            {
                'id': item.id,
                'name': item.name,
                'display_name': item.localized_name(language)[0],
                'match_type': 'similar',
            }
            for item in similar
        ]

    def validate_name(self, value: str) -> str:
        from farm.utils import normalize_text

        trimmed = ' '.join(value.split())
        if not trimmed:
            raise serializers.ValidationError('A crop species name is required.')
        normalized = normalize_text(trimmed)
        # A name that already exists as *any* language's common name is the
        # same species — reject it rather than creating a parallel record.
        clashes = CropSpecies.objects.filter(
            Q(name_normalized=normalized)
            | Q(translations__common_name_normalized=normalized),
        )
        if self.instance is not None:
            clashes = clashes.exclude(pk=self.instance.pk)
        if clashes.exists():
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
    """Read-only representation of a published crop, for the /api/crops/ surface.

    ``variety`` is served verbatim in every language — variety names are
    proper names. Only the species common name and the public description are
    resolved per language.
    """

    created_by_label = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    display_language_code = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    description_language_code = serializers.SerializerMethodField()
    crop_species_translations = serializers.SerializerMethodField()

    class Meta:
        model = PublicCulture
        fields = [
            'id',
            'status',
            'name',
            'variety',
            'notes',
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
            'display_name',
            'display_language_code',
            'description',
            'description_language_code',
            'crop_species_translations',
        ]
        read_only_fields = fields

    crop_species_name = serializers.CharField(
        source='crop_species.name',
        read_only=True,
        default='',
    )

    def get_created_by_label(self, obj: PublicCulture) -> str:
        return obj.created_by_label

    def get_display_name(self, obj: PublicCulture) -> str:
        return obj.display_name(get_request_language(self.context))[0]

    def get_display_language_code(self, obj: PublicCulture) -> str:
        return obj.display_name(get_request_language(self.context))[1]

    def get_description(self, obj: PublicCulture) -> str:
        return obj.localized_description(get_request_language(self.context))[0]

    def get_description_language_code(self, obj: PublicCulture) -> str:
        return obj.localized_description(get_request_language(self.context))[1]

    def get_crop_species_translations(self, obj: PublicCulture) -> dict[str, str]:
        """All species names, so editorial screens can show every language."""
        if obj.crop_species is None:
            return {}
        return obj.crop_species.translations_by_language()
