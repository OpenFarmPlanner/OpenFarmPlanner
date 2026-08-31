"""DRF serializers for the seasons domain (Season, SeasonPattern)."""

from rest_framework import serializers

from farm.models import PlantingPlan, Season, SeasonPattern


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
        start_date = attrs.get('start_date') or (
            self.instance.start_date if self.instance else None
        )
        end_date = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start_date is not None and end_date is not None and end_date <= start_date:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        request = self.context.get('request')
        project = getattr(request, 'active_project', None)
        if project is not None and start_date is not None and end_date is not None:
            overlapping_seasons = Season.objects.filter(
                project=project,
                start_date__lte=end_date,
                end_date__gte=start_date,
            )
            if self.instance is not None:
                overlapping_seasons = overlapping_seasons.exclude(pk=self.instance.pk)
            if overlapping_seasons.exists():
                raise serializers.ValidationError(
                    'Season dates must not overlap an existing season.',
                )
            if self.instance is None:
                self._validate_unassigned_planting_plans_fit(project, start_date, end_date)
        return attrs

    def _validate_unassigned_planting_plans_fit(self, project, start_date, end_date) -> None:
        """Reject a new season if legacy unassigned plans would fall outside it."""
        conflicts = []
        conflict_count = 0
        plans = (
            PlantingPlan.objects
            .filter(project=project, season__isnull=True)
            .select_related('culture', 'bed')
            .order_by('planting_date', 'pk')
        )
        for plan in plans:
            active_period = plan._get_active_period()
            if active_period is None:
                continue
            active_start, active_end = active_period
            if start_date <= active_start and active_end <= end_date:
                continue
            conflict_count += 1
            if len(conflicts) < 3:
                conflicts.append({
                    'id': plan.pk,
                    'label': str(plan),
                    'active_start_date': active_start.isoformat(),
                    'active_end_date': active_end.isoformat(),
                })

        if conflict_count == 0:
            return

        raise serializers.ValidationError({
            'code': 'season_unassigned_data_outside_period',
            'detail': (
                'Season cannot be created because existing unassigned planting '
                'plans fall outside the selected period.'
            ),
            'conflict_count': conflict_count,
            'conflicts': conflicts,
        })


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
