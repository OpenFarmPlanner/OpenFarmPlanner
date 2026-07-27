"""Public culture library endpoints."""


from typing import Any

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from crops.permissions import is_public_library_moderator
from farm.models import (
    PublicCulture,
    PublicCultureChangeProposal,
)
from farm.project_context import get_active_project_or_400
from farm.services.public_cultures import (
    PublicCultureEditConflictError,
    PublicCulturePermissionError,
    PublicCultureRevisionNotFoundError,
    PublicCultureStatusTransitionError,
    hard_delete_public_culture,
    import_public_culture_into_project,
    remove_public_culture,
    restore_public_culture_version,
    update_public_culture_directly,
    withdraw_public_culture,
)

from ..serializers import (
    CultureSerializer,
    PublicCultureSerializer,
)
from ..serializers.public import (
    PublicCultureChangeProposalSerializer,
    PublicCultureDiscussionCommentSerializer,
    PublicCultureRevertSerializer,
    PublicCultureRevisionSerializer,
    PublicCultureUpdateSerializer,
)


class PublicCultureViewSet(viewsets.ModelViewSet):
    """Public library for published cultures with project import and direct edit actions.

    Candidate for extraction into a separate service consumed by OFP over an
    API (under discussion as of 2026-07). Keep edits on the public row and do
    not couple this API to project-scoped history.
    """

    queryset = PublicCulture.objects.filter(status=PublicCulture.STATUS_PUBLISHED).order_by('name', 'variety')
    serializer_class = PublicCultureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().select_related('created_by__public_profile')
        query = (self.request.query_params.get('q') or '').strip()
        name = (self.request.query_params.get('name') or '').strip()
        variety = (self.request.query_params.get('variety') or '').strip()

        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(variety__icontains=query))
        if name:
            queryset = queryset.filter(name__icontains=name)
        if variety:
            queryset = queryset.filter(variety__icontains=variety)
        return queryset

    def get_serializer_class(self):
        if self.action in {'update', 'partial_update'}:
            return PublicCultureUpdateSerializer
        return super().get_serializer_class()

    def _get_public_culture_for_status_action(self) -> PublicCulture:
        return get_object_or_404(
            PublicCulture.objects.select_related('created_by'),
            pk=self.kwargs.get(self.lookup_url_kwarg or self.lookup_field),
        )

    @staticmethod
    def _transition_error_response(error: Exception, response_status: int) -> Response:
        code = getattr(error, 'code', 'invalid_status_transition')
        return Response({'detail': str(error), 'code': code}, status=response_status)

    @staticmethod
    def _is_moderator(user: Any) -> bool:
        return is_public_library_moderator(user)

    @staticmethod
    def _proposal_status_error() -> Response:
        return Response(
            {'detail': 'Only pending change proposals can be reviewed.', 'code': 'proposal_not_pending'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @staticmethod
    def _edit_conflict_response(error: PublicCultureEditConflictError) -> Response:
        return Response(
            {
                'detail': str(error),
                'code': error.code,
                'current_version': error.current_version,
            },
            status=status.HTTP_409_CONFLICT,
        )

    def update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        partial = kwargs.pop('partial', False)
        public_culture = self.get_object()
        serializer = PublicCultureUpdateSerializer(public_culture, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        validated_data = dict(serializer.validated_data)
        base_version = validated_data.pop('base_version', None)
        try:
            updated = update_public_culture_directly(
                public_culture=public_culture,
                user=request.user,
                data=validated_data,
                base_version=base_version,
            )
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureEditConflictError as error:
            return self._edit_conflict_response(error)
        except ValueError as error:
            return Response({'detail': str(error), 'code': 'unsupported_public_culture_fields'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PublicCultureSerializer(updated).data)

    def partial_update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='match')
    def match(self, request):
        """Check whether an exact normalized public culture match exists."""
        from farm.utils import normalize_text

        normalized_name = normalize_text(request.query_params.get('name'))
        normalized_variety = normalize_text(request.query_params.get('variety'))
        if not normalized_name or not normalized_variety:
            return Response({'exists': False, 'culture': None})

        culture = self.queryset.filter(
            name_normalized=normalized_name,
            variety_normalized=normalized_variety,
        ).only('id', 'name', 'variety', 'published_at').order_by('-published_at', '-id').first()
        if culture is None:
            return Response({'exists': False, 'culture': None})

        return Response({
            'exists': True,
            'culture': {
                'id': culture.id,
                'name': culture.name,
                'variety': culture.variety,
            },
        })

    @action(detail=True, methods=['post'], url_path='import')
    def import_to_project(self, request, pk=None):
        public_culture = self.get_object()
        request.active_project = get_active_project_or_400(request)
        imported = import_public_culture_into_project(public_culture=public_culture, project=request.active_project)
        serializer = CultureSerializer(imported)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request: Request, pk: int | None = None) -> Response:
        public_culture = self.get_object()
        if request.method == 'GET':
            comments = public_culture.discussion_comments.select_related('created_by__public_profile')
            serializer = PublicCultureDiscussionCommentSerializer(comments, many=True)
            return Response(serializer.data)

        serializer = PublicCultureDiscussionCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(public_culture=public_culture, created_by=request.user)
        return Response(PublicCultureDiscussionCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='versions')
    def versions(self, request: Request, pk: int | None = None) -> Response:
        public_culture = self.get_object()
        revisions = public_culture.revisions.select_related('created_by__public_profile')
        serializer = PublicCultureRevisionSerializer(revisions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='revert')
    def revert(self, request: Request, pk: int | None = None) -> Response:
        public_culture = self.get_object()
        serializer = PublicCultureRevertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = restore_public_culture_version(
                public_culture=public_culture,
                user=request.user,
                version=serializer.validated_data['version'],
                base_version=serializer.validated_data.get('base_version'),
            )
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureEditConflictError as error:
            return self._edit_conflict_response(error)
        except PublicCultureRevisionNotFoundError as error:
            return Response({'detail': str(error), 'code': error.code}, status=status.HTTP_404_NOT_FOUND)
        return Response(PublicCultureSerializer(updated).data)

    @action(detail=True, methods=['get', 'post'], url_path='change-proposals')
    def change_proposals(self, request: Request, pk: int | None = None) -> Response:
        public_culture = self.get_object()
        if request.method == 'GET':
            proposals = public_culture.change_proposals.select_related('proposed_by__public_profile', 'reviewed_by__public_profile')
            serializer = PublicCultureChangeProposalSerializer(proposals, many=True)
            return Response(serializer.data)

        serializer = PublicCultureChangeProposalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proposal = serializer.save(public_culture=public_culture, proposed_by=request.user)
        return Response(PublicCultureChangeProposalSerializer(proposal).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path=r'change-proposals/(?P<proposal_id>[^/.]+)/approve')
    def approve_change_proposal(self, request: Request, pk: int | None = None, proposal_id: str | None = None) -> Response:
        if not self._is_moderator(request.user):
            return Response({'detail': 'Moderator privileges are required.', 'code': 'moderator_required'}, status=status.HTTP_403_FORBIDDEN)

        public_culture = self.get_object()
        proposal = get_object_or_404(
            public_culture.change_proposals.select_related('proposed_by__public_profile', 'reviewed_by__public_profile'),
            pk=proposal_id,
        )
        if proposal.status != PublicCultureChangeProposal.STATUS_PENDING:
            return self._proposal_status_error()

        review_note = (request.data.get('review_note') or '').strip()
        with transaction.atomic():
            update_public_culture_directly(
                public_culture=public_culture,
                user=request.user,
                data=proposal.proposed_data,
            )
            proposal.status = PublicCultureChangeProposal.STATUS_APPROVED
            proposal.reviewed_by = request.user
            proposal.reviewed_at = timezone.now()
            proposal.review_note = review_note
            proposal.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at'])

        return Response(PublicCultureChangeProposalSerializer(proposal).data)

    @action(detail=True, methods=['post'], url_path=r'change-proposals/(?P<proposal_id>[^/.]+)/reject')
    def reject_change_proposal(self, request: Request, pk: int | None = None, proposal_id: str | None = None) -> Response:
        if not self._is_moderator(request.user):
            return Response({'detail': 'Moderator privileges are required.', 'code': 'moderator_required'}, status=status.HTTP_403_FORBIDDEN)

        public_culture = self.get_object()
        proposal = get_object_or_404(
            public_culture.change_proposals.select_related('proposed_by__public_profile', 'reviewed_by__public_profile'),
            pk=proposal_id,
        )
        if proposal.status != PublicCultureChangeProposal.STATUS_PENDING:
            return self._proposal_status_error()

        proposal.status = PublicCultureChangeProposal.STATUS_REJECTED
        proposal.reviewed_by = request.user
        proposal.reviewed_at = timezone.now()
        proposal.review_note = (request.data.get('review_note') or '').strip()
        proposal.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at'])
        return Response(PublicCultureChangeProposalSerializer(proposal).data)

    @action(detail=True, methods=['post'], url_path='withdraw')
    def withdraw(self, request, pk=None):
        public_culture = self._get_public_culture_for_status_action()
        try:
            updated = withdraw_public_culture(public_culture=public_culture, user=request.user)
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureStatusTransitionError as error:
            return self._transition_error_response(error, status.HTTP_400_BAD_REQUEST)
        return Response(PublicCultureSerializer(updated).data)

    @action(detail=True, methods=['post'], url_path='remove')
    def remove(self, request, pk=None):
        public_culture = self._get_public_culture_for_status_action()
        try:
            updated = remove_public_culture(
                public_culture=public_culture,
                user=request.user,
                reason=(request.data.get('reason') or '').strip(),
            )
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureStatusTransitionError as error:
            return self._transition_error_response(error, status.HTTP_400_BAD_REQUEST)
        return Response(PublicCultureSerializer(updated).data)

    @action(detail=True, methods=['post'], url_path='hard-delete')
    def hard_delete(self, request, pk=None):
        public_culture = self._get_public_culture_for_status_action()
        try:
            hard_delete_public_culture(public_culture=public_culture, user=request.user)
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureStatusTransitionError as error:
            return self._transition_error_response(error, status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)
