from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, QuerySet

from accounts.guest_demo import delete_guest_demo_session
from accounts.models import GuestDemoSession
from farm.models import Project, PublicCulture
from farm.services.demo_project import DEMO_PROJECT_DESCRIPTIONS, DEMO_PROJECT_SLUG, DEMO_USER_EMAIL
from farm.services.hint_test_project import (
    HINT_TEST_MEMBER_EMAIL,
    HINT_TEST_PROJECT_SLUG,
    HINT_TEST_USER_EMAIL,
)

User = get_user_model()

LOCAL_FIXTURE_EMAILS = frozenset({
    DEMO_USER_EMAIL,
    HINT_TEST_USER_EMAIL,
    HINT_TEST_MEMBER_EMAIL,
})
LOCAL_FIXTURE_PROJECT_SLUGS = frozenset({
    DEMO_PROJECT_SLUG,
    HINT_TEST_PROJECT_SLUG,
})
E2E_PUBLIC_CULTURE_VARIETY_PREFIXES = ('E2E Kollaboration ', 'Visual Empty ')


@dataclass(frozen=True)
class LocalTestDataCleanupPlan:
    """Preview of local-only fixture rows selected for cleanup."""

    project_count: int
    user_count: int
    guest_demo_session_count: int
    public_culture_count: int


def assert_local_cleanup_allowed() -> None:
    """Block accidental use outside development settings."""
    if not getattr(settings, 'DEBUG', False) or getattr(settings, 'DJANGO_ENV', '') != 'development':
        raise RuntimeError('Local test data cleanup is only allowed with DEBUG=True and DJANGO_ENV=development.')


def build_local_test_data_cleanup_plan() -> LocalTestDataCleanupPlan:
    """Return row counts that would be deleted by the local fixture cleanup."""
    return LocalTestDataCleanupPlan(
        project_count=_local_test_projects().count(),
        user_count=_local_test_users().count(),
        guest_demo_session_count=GuestDemoSession.objects.count(),
        public_culture_count=_local_e2e_public_cultures().count(),
    )


def cleanup_local_test_data() -> LocalTestDataCleanupPlan:
    """Delete known local E2E/demo fixture data and return the planned counts."""
    plan = build_local_test_data_cleanup_plan()
    with transaction.atomic():
        _local_e2e_public_cultures().delete()
        # Materialized up front: delete_guest_demo_session() cascades through
        # `user`/`project` (both OneToOneField(on_delete=CASCADE)), which deletes
        # the very GuestDemoSession row an open .iterator() cursor would still be
        # reading, risking skipped rows.
        for demo_session in list(GuestDemoSession.objects.select_related('user', 'project')):
            delete_guest_demo_session(demo_session)
        _local_test_projects().delete()
        _local_test_users().delete()
    return plan


def _local_test_projects() -> QuerySet[Project]:
    return Project.objects.filter(
        Q(name__startswith='E2E Project ')
        | Q(slug__in=LOCAL_FIXTURE_PROJECT_SLUGS)
        | Q(description__in=DEMO_PROJECT_DESCRIPTIONS)
        | Q(memberships__user__email__iendswith='@e2e.local')
        | Q(memberships__user__email__in=LOCAL_FIXTURE_EMAILS)
    ).distinct()


def _local_test_users() -> QuerySet:
    return User.objects.filter(
        Q(email__iendswith='@e2e.local')
        | Q(email__iendswith='@example.invalid', username__startswith='demo_')
        | Q(email__in=LOCAL_FIXTURE_EMAILS)
    ).distinct()


def _local_e2e_public_cultures() -> QuerySet[PublicCulture]:
    return PublicCulture.objects.filter(
        Q(source_project__memberships__user__email__iendswith='@e2e.local')
        | Q(source_project_culture__project__memberships__user__email__iendswith='@e2e.local')
        | (
            Q(created_by__email__iendswith='@e2e.local')
            & (
                Q(variety__startswith=E2E_PUBLIC_CULTURE_VARIETY_PREFIXES[0])
                | Q(variety__startswith=E2E_PUBLIC_CULTURE_VARIETY_PREFIXES[1])
            )
        )
    ).distinct()
