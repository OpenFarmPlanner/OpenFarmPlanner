"""Serializers for the in-app feedback endpoint."""

from rest_framework import serializers

from farm.models import Feedback


class FeedbackSerializer(serializers.ModelSerializer):
    """Validate a feedback submission coming from the feedback dialog.

    Everything except the message is optional context collected by the client
    (active project, current route, browser information).
    """

    category = serializers.ChoiceField(
        choices=Feedback.Category.choices,
        required=False,
        allow_blank=True,
        default='',
    )
    message = serializers.CharField(max_length=5000, trim_whitespace=True)
    project_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default='',
    )
    route = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    browser_info = serializers.CharField(
        max_length=1000, required=False, allow_blank=True, default='',
    )
    contact_consent = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = Feedback
        fields = [
            'id',
            'category',
            'message',
            'project_name',
            'route',
            'browser_info',
            'contact_consent',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_message(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError('A feedback message is required.')
        return value
