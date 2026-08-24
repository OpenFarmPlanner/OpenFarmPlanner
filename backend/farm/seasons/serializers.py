"""DRF serializers for the seasons domain (Season, SeasonPattern)."""

from rest_framework import serializers

from farm.models import Season, SeasonPattern


class SeasonSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    computed_label = serializers.CharField(read_only=True)
    planting_plan_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Season
        fields = [
            'id',
            'project',
            'start_date',
            'end_date',
            'custom_label',
            'label',
            'computed_label',
            'planting_plan_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['project', 'created_at', 'updated_at']

    def validate(self, attrs):
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start_date is not None and end_date is not None and end_date <= start_date:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return attrs


class SeasonPatternSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeasonPattern
        fields = ['id', 'project', 'start_day', 'start_month', 'created_at', 'updated_at']
        read_only_fields = ['project', 'created_at', 'updated_at']

    def validate_start_day(self, value):
        if not 1 <= value <= 31:
            raise serializers.ValidationError('Start day must be between 1 and 31.')
        return value

    def validate_start_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError('Start month must be between 1 and 12.')
        return value


class SeasonCopyFromSerializer(serializers.Serializer):
    source_season_id = serializers.IntegerField()
