"""API endpoint for in-app user feedback."""

from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from farm.models import Project
from farm.project_context import get_active_project_optional

from .emails import send_feedback_email
from .serializers import FeedbackSerializer


class FeedbackView(APIView):
    """Store one feedback message and forward it to the support inbox."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'feedback_submit'

    def post(self, request: Request) -> Response:
        serializer = FeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        project: Project | None = get_active_project_optional(request)
        contact_consent: bool = data['contact_consent']
        contact_email = (request.user.email or '') if contact_consent else ''

        feedback = serializer.save(
            user=request.user,
            project=project,
            project_name=data['project_name'] or (project.name if project else ''),
            contact_email=contact_email,
        )

        email_delivered = send_feedback_email(feedback)
        return Response(
            {'id': feedback.id, 'email_delivered': email_delivered},
            status=status.HTTP_201_CREATED,
        )
