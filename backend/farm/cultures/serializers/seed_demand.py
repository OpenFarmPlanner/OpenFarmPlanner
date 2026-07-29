"""DTO serializers for the seed-demand endpoint."""

from rest_framework import serializers


class SeedDemandPackageSelectionSerializer(serializers.Serializer):
    size_value = serializers.FloatField()
    size_unit = serializers.CharField()
    count = serializers.IntegerField()


class SeedDemandPackageSuggestionSerializer(serializers.Serializer):
    selection = SeedDemandPackageSelectionSerializer(many=True)
    total_amount = serializers.FloatField()
    overage = serializers.FloatField()
    pack_count = serializers.IntegerField()
    unit = serializers.CharField(required=False)


class SeedDemandSerializer(serializers.Serializer):
    """Read-only serializer for aggregated seed demand per culture."""
    culture_id = serializers.IntegerField()
    culture_name = serializers.CharField()
    culture_display_name = serializers.CharField(allow_blank=True, allow_null=True)
    culture_display_language_code = serializers.CharField(allow_blank=True)
    variety = serializers.CharField(allow_blank=True, allow_null=True)
    supplier = serializers.CharField(allow_blank=True, allow_null=True)
    selected_supplier_id = serializers.IntegerField(allow_null=True, required=False)
    supplier_options = serializers.ListField(child=serializers.DictField(), required=False)
    required_amount_value = serializers.FloatField(allow_null=True)
    required_amount_unit = serializers.CharField(allow_null=True)
    required_amount_warning = serializers.CharField(allow_null=True, required=False)
    calculation_blockers = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    total_grams = serializers.FloatField(allow_null=True)
    seed_packages = serializers.ListField(child=serializers.DictField(), required=False)
    package_suggestion = SeedDemandPackageSuggestionSerializer(allow_null=True, required=False)
    package_blocker = serializers.CharField(allow_null=True, required=False)
    packages_needed = serializers.IntegerField(allow_null=True, required=False)
    warning = serializers.CharField(allow_null=True)
