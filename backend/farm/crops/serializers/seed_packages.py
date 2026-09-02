"""Serializer for seed packages."""


from rest_framework import serializers

from farm.common.serializer_fields import (
    _resolve_active_project_from_serializer,
)
from farm.models import (
    SeedPackage,
)


class SeedPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeedPackage
        fields = [
            'id',
            'crop',
            'size_value',
            'size_unit',
            'evidence_text',
            'last_seen_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        validators = []
        extra_kwargs = {'crop': {'required': False}, 'size_unit': {'default': SeedPackage.UNIT_GRAMS}}






    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = _resolve_active_project_from_serializer(self)

        crop = attrs.get('crop')
        if crop is None and self.instance is not None:
            crop = self.instance.crop
        size_value = attrs.get('size_value')
        size_unit = attrs.get('size_unit')

        if project is not None and crop is not None and crop.project_id != project.id:
            raise serializers.ValidationError({'crop': 'Crop does not belong to the active project.'})

        if crop is None or size_value is None or size_unit is None:
            return attrs

        existing = SeedPackage.objects.filter(
            crop=crop,
            size_value=size_value,
            size_unit=size_unit,
        )

        raw_initial_data = getattr(self, 'initial_data', None)
        incoming_id = raw_initial_data.get('id') if isinstance(raw_initial_data, dict) else None
        if incoming_id is not None:
            try:
                incoming_id = int(incoming_id)
            except (TypeError, ValueError):
                incoming_id = None

        if incoming_id is not None:
            existing = existing.exclude(pk=incoming_id)
        elif self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        elif raw_initial_data is None:
            # Nested serializer items in Crop updates do not reliably include initial_data.
            # CropSerializer handles de-duplication before replacing packages, so skip here.
            return attrs

        if existing.exists():
            raise serializers.ValidationError('The fields crop, size_value, size_unit must make a unique set.')

        return attrs
