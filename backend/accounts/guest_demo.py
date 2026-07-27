from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import get_random_string

from farm.models import Project, ProjectMembership
from farm.services.demo_project import DEMO_PROJECT_DESCRIPTION, DEMO_PROJECT_NAME, populate_demo_project

from .models import GuestDemoSession, UserProjectSettings

User = get_user_model()
GUEST_DEMO_RETENTION = timedelta(hours=8)


def create_guest_demo_session() -> GuestDemoSession:
    """Create an isolated, short-lived guest workspace from the demo template."""
    suffix = get_random_string(16).lower()
    with transaction.atomic():
        user = User.objects.create_user(
            username=f'demo_{suffix}',
            email=f'demo-{suffix}@example.invalid',
            password=None,
            is_active=True,
        )
        project = Project.objects.create(
            name=DEMO_PROJECT_NAME,
            slug=f'guest-demo-{suffix}',
            description=DEMO_PROJECT_DESCRIPTION,
        )
        ProjectMembership.objects.create(user=user, project=project, role=ProjectMembership.ROLE_ADMIN)
        UserProjectSettings.objects.create(user=user, default_project=project, last_project=project)
        populate_demo_project(project, owner=user)
        return GuestDemoSession.objects.create(
            user=user,
            project=project,
            expires_at=timezone.now() + GUEST_DEMO_RETENTION,
        )


def delete_guest_demo_session(session: GuestDemoSession) -> None:
    """Delete a guest workspace and its user, including all project data."""
    project = session.project
    user = session.user
    project.delete()
    user.delete()


def is_active_guest_demo_user(user: Any) -> bool:
    """Return whether a user belongs to an unexpired guest demo session."""
    try:
        return user.guest_demo_session.expires_at > timezone.now()
    except GuestDemoSession.DoesNotExist:
        return False
