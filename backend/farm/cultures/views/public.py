"""Public culture library endpoints."""


from typing import Any

from django.db import transaction
from django.db.models import Count, Max, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from crops.permissions import is_public_library_moderator
from farm.models import (
    PublicCulture,
    PublicCultureChangeProposal,
    PublicCultureDiscussionComment,
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
    PublicCultureDiscussionTopicSerializer,
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

    def get_permissions(self):
        if self.action in {'discussion_topics', 'topic_comments'} and self.request.method == 'GET':
            return [permissions.AllowAny()]
        return super().get_permissions()

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

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        public_culture = self._get_public_culture_for_status_action()
        try:
            hard_delete_public_culture(public_culture=public_culture, user=request.user)
        except PublicCulturePermissionError as error:
            return self._transition_error_response(error, status.HTTP_403_FORBIDDEN)
        except PublicCultureStatusTransitionError as error:
            return self._transition_error_response(error, status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)

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

    @action(detail=True, methods=['get', 'post'], url_path='discussion-topics')
    def discussion_topics(self, request: Request, pk: int | None = None) -> Response:
        public_culture = self.get_object()
        if request.method == 'GET':
            latest_comment_body = PublicCultureDiscussionComment.objects.filter(
                topic=OuterRef('pk'),
            ).order_by('-created_at', '-pk').values('body')[:1]
            topics = public_culture.discussion_topics.select_related(
                'created_by__public_profile', 'revision'
            ).annotate(
                comment_count=Count('comments'),
                last_activity_at=Max('comments__created_at'),
                last_comment_preview=Subquery(latest_comment_body),
            ).order_by('-last_activity_at', '-created_at', '-pk')
            serializer = PublicCultureDiscussionTopicSerializer(topics, many=True, context={'request': request})
            return Response(serializer.data)

        topic_serializer = PublicCultureDiscussionTopicSerializer(data=request.data)
        topic_serializer.is_valid(raise_exception=True)
        comment_serializer = PublicCultureDiscussionCommentSerializer(data={'body': request.data.get('body', '')})
        comment_serializer.is_valid(raise_exception=True)
        revision = topic_serializer.validated_data.get('revision')
        if revision and revision.public_culture_id != public_culture.id:
            return Response({'revision': ['The version does not belong to this public culture.']}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            topic = topic_serializer.save(public_culture=public_culture, created_by=request.user)
            comment_serializer.save(topic=topic, created_by=request.user)
        latest_comment_body = PublicCultureDiscussionComment.objects.filter(
            topic=OuterRef('pk'),
        ).order_by('-created_at', '-pk').values('body')[:1]
        topic = public_culture.discussion_topics.select_related('created_by__public_profile', 'revision').annotate(
            comment_count=Count('comments'),
            last_activity_at=Max('comments__created_at'),
            last_comment_preview=Subquery(latest_comment_body),
        ).get(pk=topic.pk)
        return Response(PublicCultureDiscussionTopicSerializer(topic, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path=r'discussion-topics/(?P<topic_id>[^/.]+)/comments')
    def topic_comments(self, request: Request, pk: int | None = None, topic_id: str | None = None) -> Response:
        public_culture = self.get_object()
        topic = get_object_or_404(public_culture.discussion_topics, pk=topic_id)
        if request.method == 'GET':
            comments = topic.comments.select_related('created_by__public_profile')
            root_comment_id = comments.order_by('created_at', 'id').values_list('id', flat=True).first()
            return Response(PublicCultureDiscussionCommentSerializer(
                comments,
                many=True,
                context={'request': request, 'root_comment_id': root_comment_id},
            ).data)
        serializer = PublicCultureDiscussionCommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get('parent')
        if parent and parent.topic_id != topic.id:
            return Response({'parent': ['The parent comment does not belong to this topic.']}, status=status.HTTP_400_BAD_REQUEST)
        comment = serializer.save(topic=topic, created_by=request.user)
        return Response(PublicCultureDiscussionCommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'discussion-comments/(?P<comment_id>[^/.]+)')
    def discussion_comment(self, request: Request, pk: int | None = None, comment_id: str | None = None) -> Response:
        public_culture = self.get_object()
        comment = get_object_or_404(PublicCultureDiscussionComment.objects.select_related('topic'), pk=comment_id, topic__public_culture=public_culture)
        may_moderate = self._is_moderator(request.user)
        if comment.created_by_id != request.user.id and not may_moderate:
            return Response({'detail': 'You may only change your own comments.'}, status=status.HTTP_403_FORBIDDEN)
        if request.method == 'DELETE':
            root_comment_id = comment.topic.comments.order_by('created_at', 'id').values_list('id', flat=True).first()
            if comment.id == root_comment_id and not may_moderate:
                return Response({'detail': 'Only moderators may delete the root discussion post.'}, status=status.HTTP_403_FORBIDDEN)
            if not comment.deleted_at:
                comment.body = ''
                comment.deleted_at = timezone.now()
                comment.deleted_by = request.user
                comment.save(update_fields=['body', 'deleted_at', 'deleted_by', 'updated_at'])
            return Response(status=status.HTTP_204_NO_CONTENT)
        if comment.deleted_at:
            return Response({'detail': 'Deleted comments cannot be edited.'}, status=status.HTTP_409_CONFLICT)
        serializer = PublicCultureDiscussionCommentSerializer(comment, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(edited_at=timezone.now())
        return Response(serializer.data)

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
