"""Serializers for API-token self-service and crop-import drafts."""

from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from farm.models import ProjectApiToken, ProjectMembership

# Upper bound on how far into the future a token may be valid. An unbounded
# credential is a credential nobody ever rotates.
MAX_TOKEN_LIFETIME_DAYS = 365


class ProjectApiTokenSerializer(serializers.ModelSerializer):
    """Read representation of a token. Never contains the secret."""

    project_name = serializers.CharField(source='project.name', read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = ProjectApiToken
        fields = [
            'id',
            'name',
            'project',
            'project_name',
            'scope',
            'token_prefix',
            'status',
            'created_at',
            'expires_at',
            'last_used_at',
            'revoked_at',
        ]
        read_only_fields = fields


class ProjectApiTokenCreateSerializer(serializers.Serializer):
    """Validate a token-creation request against the caller's memberships."""

    name = serializers.CharField(max_length=120)
    project = serializers.IntegerField()
    scope = serializers.ChoiceField(
        choices=ProjectApiToken.SCOPE_CHOICES,
        default=ProjectApiToken.SCOPE_READ,
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_name(self, value: str) -> str:
        """Require a non-empty label so tokens stay distinguishable in the UI."""
        name = value.strip()
        if not name:
            raise serializers.ValidationError('A token name is required.')
        return name

    def validate_project(self, value: int) -> int:
        """Confirm the caller is a member of the project the token would bind to."""
        user = self.context['request'].user
        membership_exists = ProjectMembership.objects.filter(
            user=user,
            project_id=value,
            project__is_active=True,
            project__deleted_at__isnull=True,
        ).exists()
        if not membership_exists:
            # Deliberately identical to a nonexistent project: token creation
            # must not double as a probe for which project ids exist.
            raise serializers.ValidationError('You are not a member of this project.')
        return value

    def validate_expires_at(self, value):
        """Keep expiry in the future and within the maximum lifetime."""
        if value is None:
            return None
        now = timezone.now()
        if value <= now:
            raise serializers.ValidationError('The expiry date must be in the future.')
        if (value - now).days > MAX_TOKEN_LIFETIME_DAYS:
            raise serializers.ValidationError(
                f'The expiry date must be within {MAX_TOKEN_LIFETIME_DAYS} days.'
            )
        return value


class CropImportPreviewRequestSerializer(serializers.Serializer):
    """Input for the preview step."""

    items = serializers.ListField(child=serializers.JSONField(), allow_empty=False)
    source_label = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=''
    )


class CropImportApplyRequestSerializer(serializers.Serializer):
    """Input for the apply step.

    ``checksum`` binds the confirmation to a specific preview, and ``confirm``
    makes the write an explicit act rather than a side effect of calling the
    endpoint.
    """

    confirm = serializers.BooleanField(default=False)
    checksum = serializers.CharField(max_length=64)
    acknowledge_warnings = serializers.BooleanField(default=False)
