"""API endpoints for project-wide and crop history listing and restore."""

from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from farm.models import BatchOperation, Crop, EntityRevision
from farm.project_context import get_active_project_or_400, require_project_admin
from farm.crops.serializers import CropSerializer

from .records import _build_entity_revision_changes, _current_actor_label, record_entity_revision
from .restore import BatchRevertError, _restore_project_state_at, revert_batch_operation
from .serializers import CropHistoryEntrySerializer, CropRestoreSerializer


class ProjectHistoryListView(APIView):
    """List recent per-entity revisions across the whole project.

    Revisions produced by the same cascading action (see `BatchOperation`) are
    folded into one `is_batch` entry with a single revert action; ungrouped
    revisions are listed flat.
    """

    def get(self, request):
        active_project = get_active_project_or_400(request)
        since = timezone.now() - timedelta(days=30)
        rows = (
            EntityRevision.objects
            .filter(project=active_project, created_at__gte=since)
            .select_related('batch_operation')
            .order_by('-created_at')
        )

        def revision_payload(row):
            return {
                'history_id': row.id,
                'history_date': row.created_at,
                'history_type': 'project_snapshot',
                'history_user': row.user_name or None,
                'summary': f'{row.entity_type} {row.action} #{row.object_id}',
                'object_type': row.entity_type,
                'object_display_name': row.display_name or None,
                'action': row.action,
                'actor_label': row.user_name or None,
            }

        payload = []
        groups_by_batch = {}
        for row in rows:
            batch = row.batch_operation
            if batch is None:
                payload.append(revision_payload(row))
                continue
            group = groups_by_batch.get(batch.id)
            if group is None:
                group = {
                    'is_batch': True,
                    'batch_id': batch.id,
                    'batch_operation_type': batch.operation_type,
                    'batch_context': batch.context or {},
                    'history_date': batch.created_at,
                    'history_type': 'batch',
                    'history_user': batch.user_name or None,
                    'actor_label': batch.user_name or None,
                    'summary': f'{batch.operation_type} #{batch.id}',
                    'children': [],
                }
                groups_by_batch[batch.id] = group
                payload.append(group)
            group['children'].append(revision_payload(row))

        for group in groups_by_batch.values():
            group['children'] = CropHistoryEntrySerializer(group['children'], many=True).data

        return Response(CropHistoryEntrySerializer(payload, many=True).data)


class ProjectHistoryRestoreView(APIView):
    """Restore whole project state to a past point in time."""

    def post(self, request):
        active_project = get_active_project_or_400(request)
        require_project_admin(request.user, active_project.id, request=request)
        serializer = CropRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(EntityRevision.objects.filter(project=active_project), id=revision_id)
        _restore_project_state_at(active_project, revision.created_at)
        record_entity_revision(
            project=active_project,
            entity_type='project',
            object_id=active_project.id,
            action=EntityRevision.ACTION_RESTORED,
            snapshot={},
            display_name=active_project.name,
            changed_fields=[],
            user_name=_current_actor_label(request),
        )

        return Response({'detail': 'Project restored successfully.'}, status=status.HTTP_200_OK)


class BatchOperationRevertView(APIView):
    """Undo a whole `BatchOperation` — the single revert action behind a
    grouped history entry."""

    def post(self, request, batch_id):
        active_project = get_active_project_or_400(request)
        require_project_admin(request.user, active_project.id, request=request)
        batch = get_object_or_404(
            BatchOperation.objects.filter(project=active_project), id=batch_id,
        )
        try:
            revert_batch_operation(active_project, batch, user_name=_current_actor_label(request))
        except BatchRevertError:
            return Response(
                {'detail': 'This action cannot be reverted.', 'code': 'batch_not_revertible'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response({'detail': 'Reverted.'}, status=status.HTTP_200_OK)


class GlobalHistoryListView(APIView):
    """List recent history entries across all crops."""

    def get(self, request):
        active_project = get_active_project_or_400(request)
        since = timezone.now() - timedelta(days=30)
        rows = list(
            EntityRevision.objects
            .filter(project=active_project, entity_type='crop', created_at__gte=since)
            .order_by('-created_at')
        )
        current_revision_id = rows[0].id if rows else None
        payload = [
            {
                'history_id': row.id,
                'crop_id': row.object_id,
                'history_date': row.created_at,
                'history_type': 'snapshot',
                'history_user': row.user_name or None,
                'summary': f"Crop #{row.object_id}: " + (', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot'),
                'object_type': 'crop',
                'object_display_name': row.display_name or None,
                'action': row.action,
                'actor_label': row.user_name or None,
                'is_current_version': row.id == current_revision_id,
                'changes': _build_entity_revision_changes(
                    row.snapshot,
                    next(
                        (candidate.snapshot for candidate in rows[index + 1:] if candidate.object_id == row.object_id),
                        None,
                    ),
                    row.changed_fields,
                ),
            }
            for index, row in enumerate(rows)
        ]
        return Response(CropHistoryEntrySerializer(payload, many=True).data)


class GlobalHistoryRestoreView(APIView):
    """Restore a crop from a global history entry (supports soft-deleted crops)."""

    def post(self, request):
        active_project = get_active_project_or_400(request)
        require_project_admin(request.user, active_project.id, request=request)
        serializer = CropRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(
            EntityRevision.objects.filter(project=active_project, entity_type='crop'),
            id=revision_id,
        )
        crop = get_object_or_404(Crop.all_objects.filter(project=active_project), pk=revision.object_id)
        snapshot = revision.snapshot
        allowed_fields = {f.name for f in Crop._meta.fields if f.name not in {'id', 'created_at', 'updated_at'}}

        with transaction.atomic():
            for key, value in snapshot.items():
                if key in allowed_fields:
                    setattr(crop, key, value)
            crop.deleted_at = None
            crop._history_action = EntityRevision.ACTION_RESTORED
            crop.save()

        return Response(CropSerializer(crop).data, status=status.HTTP_200_OK)
