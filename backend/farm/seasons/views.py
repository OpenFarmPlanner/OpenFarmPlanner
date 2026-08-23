"""API endpoints for the seasons domain: seasons, the season pattern, and
the first-run setup that migrates a project's unassigned planting plans."""

from datetime import date

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from farm.common.mixins import ProjectRevisionMixin, ProjectScopedMixin
from farm.history import _entity_display_name, _serialize_instance
from farm.models import EntityRevision, PlantingPlan, Season
from farm.project_context import get_active_project_or_400
from farm.services.seasons import (
    compute_due_season_period,
    compute_preview_periods,
    copy_planting_plans,
    find_due_but_missing_season,
    get_or_create_season_pattern,
)

from .serializers import SeasonCopyFromSerializer, SeasonPatternSerializer, SeasonSerializer


class SeasonViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):
    """CRUD for project-scoped seasons, plus copy-data and due-suggestion actions."""

    queryset = (
        Season.objects
        .annotate(planting_plan_count=Count('planting_plans'))
        .order_by('-start_date')
    )
    serializer_class = SeasonSerializer

    def perform_create(self, serializer):
        current_user = self.request.user if self.request.user.is_authenticated else None
        instance = serializer.save(project=self.request.active_project, created_by=current_user)
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_update(self, serializer):
        previous_snapshot = _serialize_instance(serializer.instance)
        instance = serializer.save()
        self.record_revision(instance, EntityRevision.ACTION_UPDATED, previous_snapshot=previous_snapshot)

    def destroy(self, request, *args, **kwargs):
        season = self.get_object()
        if season.deleted_at is not None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        snapshot = _serialize_instance(season)
        display_name = _entity_display_name(season)
        season.deleted_at = timezone.now()
        season.save(update_fields=['deleted_at', 'updated_at'])
        self.record_revision(
            season, EntityRevision.ACTION_DELETED,
            snapshot=snapshot, display_name=display_name, changed_fields=[],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='undelete')
    def undelete(self, request, pk=None):
        season = Season.all_objects.filter(project=self.request.active_project).filter(pk=pk).first()
        if season is None:
            return Response({'detail': 'Season not found.'}, status=status.HTTP_404_NOT_FOUND)
        if season.deleted_at is not None:
            season.deleted_at = None
            season.save(update_fields=['deleted_at', 'updated_at'])
            self.record_revision(season, EntityRevision.ACTION_UPDATED, changed_fields=['deleted_at'])
        return Response(SeasonSerializer(season).data)

    @action(detail=True, methods=['post'], url_path='copy-from')
    def copy_from(self, request, pk=None):
        target_season = self.get_object()
        serializer = SeasonCopyFromSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        source_season = Season.objects.filter(
            project=self.request.active_project,
            pk=serializer.validated_data['source_season_id'],
        ).first()
        if source_season is None:
            return Response({'detail': 'Source season not found.'}, status=status.HTTP_404_NOT_FOUND)
        if source_season.pk == target_season.pk:
            return Response({'detail': 'Source and target season must be different.'}, status=status.HTTP_400_BAD_REQUEST)

        copied_count = copy_planting_plans(source_season=source_season, target_season=target_season)
        total_count = PlantingPlan.objects.filter(season=target_season).count()
        return Response({'copied_count': copied_count, 'target_planting_plan_count': total_count})

    @action(detail=False, methods=['get'], url_path='due-suggestion')
    def due_suggestion(self, request):
        due_period = find_due_but_missing_season(self.request.active_project)
        if due_period is None:
            return Response({'due': False})
        start_date, end_date = due_period
        return Response({
            'due': True,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        })


class SeasonPatternView(APIView):
    """Get/update the project's season pattern, and preview computed periods."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        pattern = get_or_create_season_pattern(active_project)
        return Response(SeasonPatternSerializer(pattern).data)

    def patch(self, request):
        active_project = get_active_project_or_400(request)
        pattern = get_or_create_season_pattern(active_project)
        serializer = SeasonPatternSerializer(pattern, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SeasonPatternPreviewView(APIView):
    """Preview the previous/current/next computed periods for a (possibly unsaved) pattern."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        pattern = get_or_create_season_pattern(active_project)
        start_day = request.query_params.get('start_day')
        start_month = request.query_params.get('start_month')
        if start_day is not None:
            try:
                pattern.start_day = int(start_day)
            except ValueError:
                return Response({'detail': 'start_day must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)
        if start_month is not None:
            try:
                pattern.start_month = int(start_month)
            except ValueError:
                return Response({'detail': 'start_month must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        periods = compute_preview_periods(pattern, date.today())
        return Response([
            {
                'start_date': period['start_date'].isoformat(),
                'end_date': period['end_date'].isoformat(),
                'is_current': period['is_current'],
            }
            for period in periods
        ])


class SeasonSetupStatusView(APIView):
    """Report whether the project still needs the first-run season setup."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        unassigned_count = PlantingPlan.objects.filter(project=active_project, season__isnull=True).count()
        pattern = get_or_create_season_pattern(active_project)
        due_start, due_end = compute_due_season_period(active_project)
        return Response({
            'needs_setup': unassigned_count > 0,
            'unassigned_planting_plan_count': unassigned_count,
            'start_day': pattern.start_day,
            'start_month': pattern.start_month,
            'computed_start_date': due_start.isoformat(),
            'computed_end_date': due_end.isoformat(),
        })


class SeasonSetupApplyView(APIView):
    """Apply the first-run season setup: save the pattern and assign existing plans."""

    def post(self, request):
        active_project = get_active_project_or_400(request)
        try:
            start_day = int(request.data.get('start_day'))
            start_month = int(request.data.get('start_month'))
        except (TypeError, ValueError):
            return Response({'detail': 'start_day and start_month are required integers.'}, status=status.HTTP_400_BAD_REQUEST)

        pattern_serializer = SeasonPatternSerializer(
            get_or_create_season_pattern(active_project),
            data={'start_day': start_day, 'start_month': start_month},
            partial=True,
        )
        pattern_serializer.is_valid(raise_exception=True)
        pattern = pattern_serializer.save()

        start_date, end_date = compute_due_season_period(active_project)
        season, _ = Season.objects.get_or_create(
            project=active_project,
            start_date=start_date,
            defaults={
                'end_date': end_date,
                'created_by': request.user if request.user.is_authenticated else None,
            },
        )
        assigned_count = PlantingPlan.objects.filter(
            project=active_project, season__isnull=True,
        ).update(season=season)

        return Response({
            'season': SeasonSerializer(Season.objects.annotate(planting_plan_count=Count('planting_plans')).get(pk=season.pk)).data,
            'assigned_planting_plan_count': assigned_count,
            'start_day': pattern.start_day,
            'start_month': pattern.start_month,
        })
