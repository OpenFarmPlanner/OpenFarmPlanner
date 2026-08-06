from __future__ import annotations

from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import get_object_or_404
from rest_framework import exceptions
from rest_framework.request import Request

from .models import Project, ProjectMembership

PROJECT_HEADER = 'HTTP_X_PROJECT_ID'


def _cache_user_project_settings(request_user: Any, membership: ProjectMembership) -> None:
    """Reuse the membership query's user settings on the authenticated user object."""
    try:
        settings_obj = membership.user.project_settings
    except ObjectDoesNotExist:
        settings_obj = None
    request_user._state.fields_cache['project_settings'] = settings_obj


def get_user_memberships(user) -> list[ProjectMembership]:
    """Return all project memberships for a user."""
    if not user.is_authenticated:
        return []
    return list(ProjectMembership.objects.select_related('project').filter(
        user=user,
        project__is_active=True,
        project__deleted_at__isnull=True,
    ))


def resolve_project_for_user(user) -> tuple[Project | None, bool]:
    """Resolve active project and selection need for bootstrap output."""
    memberships = get_user_memberships(user)
    if not memberships:
        return None, True
    if len(memberships) == 1:
        return memberships[0].project, False

    settings_obj = getattr(user, 'project_settings', None)
    allowed_ids = {membership.project_id for membership in memberships}

    if settings_obj and settings_obj.last_project_id in allowed_ids:
        return settings_obj.last_project, False
    if settings_obj and settings_obj.default_project_id in allowed_ids:
        return settings_obj.default_project, False
    return None, True


def get_active_project_or_400(request: Request) -> Project:
    """Resolve and validate active project from request header for authenticated users."""
    agent_mode = bool(request.session.get('agent_mode'))
    agent_project_id = request.session.get('agent_project_id')

    # Agent-mode sessions (created via AgentLoginToken, for automation/AI-agent
    # access) are hard-locked to whichever project the token was issued for.
    # The X-Project-Id header is still accepted but must match that binding —
    # this is what stops an agent session from escalating to other projects
    # the underlying user happens to belong to, just by changing a header.
    if agent_mode and agent_project_id is not None:
        try:
            bound_project_id = int(agent_project_id)
        except (TypeError, ValueError) as exc:
            raise exceptions.PermissionDenied('Invalid agent project binding.') from exc

        requested_header = request.META.get(PROJECT_HEADER)
        if requested_header and str(requested_header) != str(bound_project_id):
            raise exceptions.PermissionDenied('Agent session is restricted to a single project.')
        return get_object_or_404(
            Project,
            id=bound_project_id,
            is_active=True,
            deleted_at__isnull=True,
        )

    raw = request.META.get(PROJECT_HEADER)
    if not raw:
        raise exceptions.ValidationError({'project': 'Missing X-Project-Id header.'})
    try:
        project_id = int(raw)
    except (TypeError, ValueError) as exc:
        raise exceptions.ValidationError({'project': 'Invalid X-Project-Id header.'}) from exc

    membership = ProjectMembership.objects.select_related(
        'project',
        'user__project_settings',
    ).filter(
        user=request.user,
        project_id=project_id,
        project__is_active=True,
        project__deleted_at__isnull=True,
    ).first()
    if membership is None:
        raise exceptions.PermissionDenied('You are not a member of this project.')
    _cache_user_project_settings(request.user, membership)
    return membership.project


def get_active_project_optional(request: Request) -> Project | None:
    """Resolve active project from the request header, or None if unset/invalid.

    Same resolution as get_active_project_or_400, for read paths (like
    enriching a response with project-specific context) where a missing or
    invalid header should silently mean "no project context" rather than
    fail the whole request.
    """
    if not request.user.is_authenticated:
        return None
    try:
        return get_active_project_or_400(request)
    except (exceptions.ValidationError, exceptions.PermissionDenied, exceptions.NotFound):
        return None


def require_project_admin(user, project_id: int, request: Request | None = None) -> None:
    """Raise permission denied when user lacks project admin permissions."""
    if request is not None and bool(request.session.get('agent_mode')):
        raise exceptions.PermissionDenied('Agent sessions are restricted to member permissions.')

    is_admin = ProjectMembership.objects.filter(
        user=user,
        project_id=project_id,
        role=ProjectMembership.ROLE_ADMIN,
    ).exists()
    if not is_admin:
        raise exceptions.PermissionDenied('Project admin role required.')


def get_project_for_member(user, project_id: int) -> Project:
    """Return project for user membership or raise permission denied."""
    membership = get_object_or_404(
        ProjectMembership.objects.select_related('project'),
        user=user,
        project_id=project_id,
        project__deleted_at__isnull=True,
    )
    return membership.project
