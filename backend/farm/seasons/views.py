"""API endpoints for the seasons domain: seasons, the season pattern, and
the first-run setup that migrates a project's unassigned planting plans."""

from datetime import date, timedelta

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from farm.common.mixins import ProjectRevisionMixin, ProjectScopedMixin
from farm.history import (
    _current_actor_label,
    _entity_display_name,
    _serialize_instance,
    start_batch_operation,
)
from farm.history.restore import _record_cascade_deletions
from farm.models import BatchOperation, EntityRevision, PlantingPlan, Season, SeasonPattern, Task
from farm.project_context import get_active_project_or_400
from farm.services.seasons import (
    analyze_period_transition,
    compute_custom_season_period,
    compute_first_future_pattern_period,
    compute_manual_season_period,
    compute_preview_periods,
    compute_setup_target_period,
    copy_planting_plans,
    distribute_planting_plans,
    find_due_but_missing_season,
    get_or_create_season_for_period,
    get_or_create_season_pattern,
    latest_existing_season,
    preview_bridged_copy_counts,
    preview_copy_counts,
)

from .serializers import SeasonCopyFromSerializer, SeasonPatternSerializer, SeasonSerializer


def _serialize_transition(raw_transition: dict) -> dict:
    """Convert an ``analyze_period_transition`` result to JSON-safe ISO strings."""
    return {
        'kind': raw_transition['kind'],
        'start_date': raw_transition['start_date'].isoformat(),
        'end_date': raw_transition['end_date'].isoformat(),
    }


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
        project = self.request.active_project

        # A soft-deleted season still occupies its (project, start_date) slot via
        # the unique constraint, and the active-only overlap check in the
        # serializer cannot see it. Resurrect it instead of hitting an
        # IntegrityError when the same period is created again.
        resurrected = (
            Season.all_objects
            .filter(project=project, start_date=serializer.validated_data['start_date'], deleted_at__isnull=False)
            .first()
        )
        if resurrected is not None:
            resurrected.deleted_at = None
            resurrected.end_date = serializer.validated_data['end_date']
            resurrected.created_by = current_user
            resurrected.save(update_fields=['deleted_at', 'end_date', 'created_by', 'updated_at'])
            batch = start_batch_operation(
                project=project, operation_type=BatchOperation.TYPE_SEASON_CREATE,
                context={'season_label': resurrected.label},
                user_name=_current_actor_label(request=self.request),
            )
            self.record_revision(
                resurrected, EntityRevision.ACTION_UPDATED,
                changed_fields=['deleted_at', 'end_date'], batch_operation=batch,
            )
            # Re-creating a season's period is an undelete — bring its planting
            # plans back too, same as the `undelete` action does.
            self._restore_season_planting_plans(resurrected, batch)
            serializer.instance = (
                Season.objects
                .annotate(planting_plan_count=Count('planting_plans'))
                .get(pk=resurrected.pk)
            )
            return

        instance = serializer.save(project=project, created_by=current_user)
        batch = start_batch_operation(
            project=project, operation_type=BatchOperation.TYPE_SEASON_CREATE,
            context={'season_label': instance.label},
            user_name=_current_actor_label(request=self.request),
        )
        self.record_revision(instance, EntityRevision.ACTION_CREATED, batch_operation=batch)

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
        with transaction.atomic():
            # A season "contains" its planting plans, so deleting it deletes
            # them too. They are hard-deleted (PlantingPlan has no soft-delete),
            # but each deletion is recorded so version history / point-in-time
            # restore and this season's own undelete can bring them back. All
            # those revisions are grouped under one BatchOperation so the
            # cascade shows up as a single collapsible history entry.
            batch = start_batch_operation(
                project=self.request.active_project,
                operation_type=BatchOperation.TYPE_SEASON_DELETE,
                context={'season_label': season.label},
                user_name=_current_actor_label(request),
            )
            season.deleted_at = timezone.now()
            season.save(update_fields=['deleted_at', 'updated_at'])
            self.record_revision(
                season, EntityRevision.ACTION_DELETED,
                snapshot=snapshot, display_name=display_name, changed_fields=[],
                batch_operation=batch,
            )
            self._delete_planting_plans_with_season(season, batch)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _delete_planting_plans_with_season(self, season: Season, batch: BatchOperation) -> None:
        plans = list(
            PlantingPlan.objects.filter(season=season).select_related('culture', 'bed')
        )
        for plan in plans:
            self.record_revision(
                plan, EntityRevision.ACTION_DELETED,
                object_id=plan.pk, snapshot=_serialize_instance(plan),
                display_name=_entity_display_name(plan), changed_fields=[],
                batch_operation=batch,
            )
        # Tasks linked to these plans DB-cascade away — record them too so
        # undelete can bring them back.
        _record_cascade_deletions(
            self.request.active_project, plans, batch, _current_actor_label(self.request),
        )
        PlantingPlan.objects.filter(season=season).delete()

    @action(detail=True, methods=['post'], url_path='undelete')
    def undelete(self, request, pk=None):
        season = Season.all_objects.filter(project=self.request.active_project).filter(pk=pk).first()
        if season is None:
            return Response({'detail': 'Season not found.'}, status=status.HTTP_404_NOT_FOUND)
        if season.deleted_at is not None:
            with transaction.atomic():
                batch = start_batch_operation(
                    project=self.request.active_project,
                    operation_type=BatchOperation.TYPE_SEASON_UNDELETE,
                    context={'season_label': season.label},
                    user_name=_current_actor_label(request),
                )
                season.deleted_at = None
                season.save(update_fields=['deleted_at', 'updated_at'])
                self.record_revision(
                    season, EntityRevision.ACTION_UPDATED,
                    changed_fields=['deleted_at'], batch_operation=batch,
                )
                self._restore_season_planting_plans(season, batch)
        return Response(SeasonSerializer(season).data)

    def _restore_season_planting_plans(self, season: Season, batch: BatchOperation) -> None:
        """Recreate the planting plans hard-deleted when `season` was deleted,
        from the revisions recorded at that time."""
        deleted_revision = (
            EntityRevision.objects
            .filter(
                project=self.request.active_project,
                entity_type='season',
                object_id=season.pk,
                action=EntityRevision.ACTION_DELETED,
            )
            .order_by('-created_at')
            .first()
        )
        if deleted_revision is not None:
            self._restore_planting_plans_deleted_with_season(
                season, deleted_revision.created_at, batch,
            )

    def _restore_planting_plans_deleted_with_season(
        self, season: Season, deleted_since, batch: BatchOperation,
    ) -> None:
        allowed_fields = {field.attname for field in PlantingPlan._meta.concrete_fields}
        revisions = (
            EntityRevision.objects
            .filter(
                project=self.request.active_project,
                entity_type='planting_plan',
                created_at__gte=deleted_since,
            )
            .order_by('object_id', '-created_at')
        )
        recreated: list[PlantingPlan] = []
        seen: set[int] = set()
        for revision in revisions:
            if revision.object_id in seen:
                continue
            seen.add(revision.object_id)
            snapshot = revision.snapshot
            if (
                revision.action != EntityRevision.ACTION_DELETED
                or not isinstance(snapshot, dict)
                or snapshot.get('season_id') != season.pk
                or PlantingPlan.objects.filter(pk=revision.object_id).exists()
            ):
                continue
            row_data = {key: value for key, value in snapshot.items() if key in allowed_fields}
            row_data['project_id'] = season.project_id
            row_data['season_id'] = season.pk
            # A FK target (bed/culture/user) may have been hard-deleted since
            # the snapshot — null the nullable ones rather than 500 on insert,
            # matching the other restore paths.
            for field in PlantingPlan._meta.concrete_fields:
                related_id = row_data.get(field.attname)
                if (
                    field.remote_field is None
                    or related_id is None
                    or field.attname in ('project_id', 'season_id')
                    or not field.null
                ):
                    continue
                target_manager = (
                    getattr(field.remote_field.model, 'all_objects', None)
                    or field.remote_field.model._base_manager
                )
                if not target_manager.filter(pk=related_id).exists():
                    row_data[field.attname] = None
            recreated.append(PlantingPlan(**row_data))
        if not recreated:
            return
        PlantingPlan.objects.bulk_create(recreated)
        recreated_plan_ids = [plan.pk for plan in recreated]
        for plan in (
            PlantingPlan.objects
            .filter(pk__in=recreated_plan_ids)
            .select_related('culture', 'bed')
        ):
            self.record_revision(
                plan, EntityRevision.ACTION_RESTORED,
                snapshot=_serialize_instance(plan),
                display_name=_entity_display_name(plan), changed_fields=[],
                batch_operation=batch,
            )
        self._restore_tasks_deleted_with_plans(recreated_plan_ids, deleted_since, batch)

    def _restore_tasks_deleted_with_plans(
        self, plan_ids: list[int], deleted_since, batch: BatchOperation,
    ) -> None:
        """Recreate tasks that DB-cascaded away when their planting plans were
        deleted with the season."""
        allowed_fields = {field.attname for field in Task._meta.concrete_fields}
        revisions = (
            EntityRevision.objects
            .filter(
                project=self.request.active_project,
                entity_type='task',
                created_at__gte=deleted_since,
            )
            .order_by('object_id', '-created_at')
        )
        recreated: list[Task] = []
        seen: set[int] = set()
        for revision in revisions:
            if revision.object_id in seen:
                continue
            seen.add(revision.object_id)
            snapshot = revision.snapshot
            if (
                revision.action != EntityRevision.ACTION_DELETED
                or not isinstance(snapshot, dict)
                or snapshot.get('planting_plan_id') not in plan_ids
                or Task.objects.filter(pk=revision.object_id).exists()
            ):
                continue
            row_data = {key: value for key, value in snapshot.items() if key in allowed_fields}
            row_data['project_id'] = self.request.active_project.id
            recreated.append(Task(**row_data))
        if not recreated:
            return
        Task.objects.bulk_create(recreated)
        for task in Task.objects.filter(pk__in=[task.pk for task in recreated]):
            self.record_revision(
                task, EntityRevision.ACTION_RESTORED,
                snapshot=_serialize_instance(task),
                display_name=_entity_display_name(task), changed_fields=[],
                batch_operation=batch,
            )

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

        with transaction.atomic():
            created_plans, skipped_count = copy_planting_plans(
                source_season=source_season, target_season=target_season,
            )
            if created_plans:
                # Copied plans are new rows — record a `created` revision per
                # plan (so each is individually restorable) and group them
                # under one BatchOperation.
                batch = start_batch_operation(
                    project=self.request.active_project,
                    operation_type=BatchOperation.TYPE_SEASON_COPY_DATA,
                    context={
                        'source_season_label': source_season.label,
                        'target_season_label': target_season.label,
                    },
                    user_name=_current_actor_label(request),
                )
                for plan in (
                    PlantingPlan.objects
                    .filter(pk__in=[plan.pk for plan in created_plans])
                    .select_related('culture', 'bed')
                ):
                    self.record_revision(
                        plan, EntityRevision.ACTION_CREATED, batch_operation=batch,
                    )
        total_count = PlantingPlan.objects.filter(season=target_season).count()
        return Response({
            'copied_count': len(created_plans),
            'skipped_count': skipped_count,
            'target_planting_plan_count': total_count,
        })

    @action(detail=False, methods=['get'], url_path='creation-options')
    def creation_options(self, request):
        """Describe the gap/overlap decision for the next season the user would create.

        The season switcher's "create season" flow calls this before creating a
        season based on the current pattern. When the pattern period following
        the latest existing season leaves a gap (or overlaps it), the flow shows
        an intermediate step so the user decides explicitly instead of silently
        adopting whatever the pattern computes.
        """
        project = self.request.active_project
        pattern = get_or_create_season_pattern(project)
        latest_season = latest_existing_season(project)
        due_period = find_due_but_missing_season(project)

        payload: dict = {
            'start_day': pattern.start_day,
            'start_month': pattern.start_month,
            'last_season': None,
            'due_period': None,
            'transition': None,
            'seamless_period': None,
            'manual_period': None,
            'manual_residual': None,
        }

        if due_period is not None:
            due_start, due_end = due_period
            payload['due_period'] = {
                'start_date': due_start.isoformat(),
                'end_date': due_end.isoformat(),
            }

        payload['copy_source_label'] = latest_season.label if latest_season is not None else None
        payload['copy_preview'] = {'adopt': None, 'transition': None, 'transition_followup': None, 'manual': None}

        last_planting_dates: list = []
        if latest_season is not None:
            last_planting_dates = list(
                PlantingPlan.objects
                .filter(season=latest_season)
                .values_list('planting_date', flat=True)
            )
            payload['last_season'] = {
                'start_date': latest_season.start_date.isoformat(),
                'end_date': latest_season.end_date.isoformat(),
                'label': latest_season.label,
            }
            if due_period is not None:
                due_start, due_end = due_period
                payload['copy_preview']['adopt'] = preview_copy_counts(
                    source_planting_dates=last_planting_dates,
                    source_start_year=latest_season.start_date.year,
                    target_start=due_start, target_end=due_end,
                )
                raw_transition = analyze_period_transition(latest_season.end_date, due_start)
                if raw_transition is not None:
                    payload['transition'] = _serialize_transition(raw_transition)
                    seamless_start = latest_season.end_date + timedelta(days=1)
                    seamless_start, seamless_end = compute_custom_season_period(pattern, seamless_start)
                    payload['seamless_period'] = {
                        'start_date': seamless_start.isoformat(),
                        'end_date': seamless_end.isoformat(),
                    }
                    # Choosing "transition season" creates the transition season
                    # AND the regular follow-up season; every source plan is
                    # shifted once and routed to whichever of the two it lands in.
                    bridged = preview_bridged_copy_counts(
                        source_planting_dates=last_planting_dates,
                        source_start_year=latest_season.start_date.year,
                        transition_start=seamless_start, transition_end=seamless_end,
                        followup_start=due_start, followup_end=due_end,
                    )
                    payload['copy_preview']['transition'] = {
                        'total': bridged['total'],
                        'copied': bridged['transition'],
                        'skipped': bridged['skipped'],
                    }
                    payload['copy_preview']['transition_followup'] = {
                        'total': bridged['total'],
                        'copied': bridged['followup'],
                        'skipped': bridged['skipped'],
                    }

        manual_start_param = request.query_params.get('manual_start_date')
        if manual_start_param:
            try:
                manual_start = date.fromisoformat(manual_start_param)
            except ValueError:
                return Response(
                    {'detail': 'manual_start_date must be an ISO date (YYYY-MM-DD).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            manual_start, manual_end = compute_manual_season_period(pattern, manual_start)
            payload['manual_period'] = {
                'start_date': manual_start.isoformat(),
                'end_date': manual_end.isoformat(),
            }
            if latest_season is not None:
                raw_residual = analyze_period_transition(latest_season.end_date, manual_start)
                payload['manual_residual'] = (
                    _serialize_transition(raw_residual) if raw_residual is not None else None
                )
                payload['copy_preview']['manual'] = preview_copy_counts(
                    source_planting_dates=last_planting_dates,
                    source_start_year=latest_season.start_date.year,
                    target_start=manual_start, target_end=manual_end,
                )

        return Response(payload)

    def _create_or_resurrect_season(self, project, start_date, end_date, user, batch):
        """Create a season for `[start_date, end_date]`, or resurrect a
        soft-deleted one occupying the same (project, start_date) slot."""
        resurrected = (
            Season.all_objects
            .filter(project=project, start_date=start_date, deleted_at__isnull=False)
            .first()
        )
        if resurrected is not None:
            resurrected.deleted_at = None
            resurrected.end_date = end_date
            resurrected.created_by = user
            resurrected.save(update_fields=['deleted_at', 'end_date', 'created_by', 'updated_at'])
            self.record_revision(
                resurrected, EntityRevision.ACTION_UPDATED,
                changed_fields=['deleted_at', 'end_date'], batch_operation=batch,
            )
            return resurrected
        season = Season.objects.create(
            project=project, start_date=start_date, end_date=end_date, created_by=user,
        )
        self.record_revision(season, EntityRevision.ACTION_CREATED, batch_operation=batch)
        return season

    @action(detail=False, methods=['post'], url_path='create-transition')
    def create_transition(self, request):
        """Create the gap-filling transition season AND the regular follow-up
        season in one transaction, distributing the last season's plans across
        both (each plan shifted once and routed to the season it lands in).
        """
        project = self.request.active_project
        pattern = get_or_create_season_pattern(project)
        latest_season = latest_existing_season(project)
        due_period = find_due_but_missing_season(project)
        if latest_season is None or due_period is None:
            return Response(
                {'detail': 'No transition season is applicable.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        due_start, due_end = due_period
        if analyze_period_transition(latest_season.end_date, due_start) is None:
            return Response(
                {'detail': 'There is no gap between the last season and the next pattern period.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        seamless_start, seamless_end = compute_custom_season_period(
            pattern, latest_season.end_date + timedelta(days=1),
        )
        copy_requested = bool(request.data.get('copy'))
        user = request.user if request.user.is_authenticated else None

        transition_label = Season(start_date=seamless_start, end_date=seamless_end).computed_label
        with transaction.atomic():
            batch = start_batch_operation(
                project=project, operation_type=BatchOperation.TYPE_SEASON_CREATE,
                context={'season_label': transition_label},
                user_name=_current_actor_label(request=request),
            )
            transition_season = self._create_or_resurrect_season(
                project, seamless_start, seamless_end, user, batch,
            )
            followup_season = self._create_or_resurrect_season(
                project, due_start, due_end, user, batch,
            )
            distribution = {'transition': [], 'followup': [], 'skipped': 0}
            if copy_requested:
                distribution = distribute_planting_plans(
                    source_season=latest_season,
                    transition_season=transition_season,
                    followup_season=followup_season,
                )
                created_ids = [
                    plan.pk
                    for plan in (*distribution['transition'], *distribution['followup'])
                ]
                for plan in (
                    PlantingPlan.objects
                    .filter(pk__in=created_ids)
                    .select_related('culture', 'bed')
                ):
                    self.record_revision(plan, EntityRevision.ACTION_CREATED, batch_operation=batch)

        annotated = (
            Season.objects
            .annotate(planting_plan_count=Count('planting_plans'))
            .in_bulk([transition_season.pk, followup_season.pk])
        )
        return Response({
            'transition_season': SeasonSerializer(annotated[transition_season.pk]).data,
            'followup_season': SeasonSerializer(annotated[followup_season.pk]).data,
            'transition_copied_count': len(distribution['transition']),
            'followup_copied_count': len(distribution['followup']),
            'skipped_count': distribution['skipped'],
        }, status=status.HTTP_201_CREATED)

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
        latest_season = latest_existing_season(active_project)
        reference_season = None
        transition = None
        if latest_season is not None:
            reference_season = {
                'start_date': latest_season.start_date.isoformat(),
                'end_date': latest_season.end_date.isoformat(),
                'label': latest_season.label,
            }
            future_start, _ = compute_first_future_pattern_period(pattern, latest_season)
            raw_transition = analyze_period_transition(latest_season.end_date, future_start)
            if raw_transition is not None:
                transition = _serialize_transition(raw_transition)
        return Response({
            'periods': [
                {
                    'start_date': period['start_date'].isoformat(),
                    'end_date': period['end_date'].isoformat(),
                    'is_current': period['is_current'],
                }
                for period in periods
            ],
            'reference_season': reference_season,
            'transition': transition,
        })


class SeasonSetupStatusView(APIView):
    """Report whether the project still needs the first-run season setup."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        unassigned_count = PlantingPlan.objects.filter(project=active_project, season__isnull=True).count()
        pattern = get_or_create_season_pattern(active_project)
        preview_pattern = pattern
        start_day_param = request.query_params.get('start_day')
        start_month_param = request.query_params.get('start_month')
        if start_day_param is not None or start_month_param is not None:
            try:
                preview_pattern = SeasonPattern(
                    start_day=int(start_day_param) if start_day_param is not None else pattern.start_day,
                    start_month=int(start_month_param) if start_month_param is not None else pattern.start_month,
                )
            except ValueError:
                return Response({'detail': 'start_day and start_month must be integers.'}, status=status.HTTP_400_BAD_REQUEST)
        target_start, target_end = compute_setup_target_period(active_project, preview_pattern)
        return Response({
            'needs_setup': unassigned_count > 0,
            'unassigned_planting_plan_count': unassigned_count,
            'start_day': pattern.start_day,
            'start_month': pattern.start_month,
            'computed_start_date': target_start.isoformat(),
            'computed_end_date': target_end.isoformat(),
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

        start_date, end_date = compute_setup_target_period(active_project, pattern)
        season = get_or_create_season_for_period(
            active_project,
            start_date,
            end_date,
            created_by=request.user if request.user.is_authenticated else None,
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
