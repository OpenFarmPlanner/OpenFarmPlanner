"""DTO serializers for the public-crop import preview/apply endpoints."""

from rest_framework import serializers


class CropImportPreviewItemSerializer(serializers.Serializer):
    """Preview result for a single crop import item."""
    status = serializers.ChoiceField(
        choices=['create', 'update_candidate'],
        help_text='Whether this crop would be created or matches an existing one'
    )
    matched_crop_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='ID of matched crop (only for update_candidate status)'
    )
    diff = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text='List of fields that would change (only for update_candidate)'
    )
    import_data = serializers.DictField(
        help_text='The crop data that would be imported'
    )


class CropImportApplySummarySerializer(serializers.Serializer):
    """Summary of a crop import apply operation."""
    created_count = serializers.IntegerField(help_text='Number of crops created')
    updated_count = serializers.IntegerField(help_text='Number of crops updated')
    skipped_count = serializers.IntegerField(help_text='Number of crops skipped')
    errors = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of errors encountered during import'
    )
