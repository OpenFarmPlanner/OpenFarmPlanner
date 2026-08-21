"""Aggregated, privacy-minimal project engagement metrics for the admin."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q
from django.utils import timezone

from farm.models import (
    Bed,
    BedLayout,
    Culture,
    CultureSupplierData,
    Field,
    FieldLayout,
    Location,
    NoteAttachment,
    PlantingPlan,
    Project,
    ProjectMembership,
    SeedPackage,
    Supplier,
    Task,
)

ENGAGEMENT_MODELS = (
    Supplier,
    Culture,
    CultureSupplierData,
    SeedPackage,
    Location,
    Field,
    Bed,
    BedLayout,
    FieldLayout,
    PlantingPlan,
    Task,
    NoteAttachment,
)


@dataclass
class ProjectEngagement:
    """Aggregated engagement values for one project."""

    project: Project
    last_active: datetime | None = None
    created_last_7_days: int = 0
    created_last_30_days: int = 0
    active_users_last_30_days: int = 0

    @property
    def status(self) -> str:
        """Return the German activity label for this project."""
        if self.last_active is None:
            return 'Nur registriert'
        now = timezone.now()
        if self.last_active >= now - timedelta(days=7):
            return 'Aktiv'
        if self.last_active >= now - timedelta(days=30):
            return 'Ruhig'
        return 'Inaktiv'


@dataclass(frozen=True)
class EngagementDashboard:
    """Complete dashboard result and its overall totals."""

    projects: list[ProjectEngagement]
    total_projects: int
    active_projects_7_days: int
    active_projects_30_days: int
    total_users: int
    users_logged_in_30_days: int


def build_engagement_dashboard(now: datetime | None = None) -> EngagementDashboard:
    """Build the dashboard with a fixed number of aggregate queries, never per project."""
    current_time = now or timezone.now()
    cutoff_7_days = current_time - timedelta(days=7)
    cutoff_30_days = current_time - timedelta(days=30)
    rows = {
        project.pk: ProjectEngagement(project=project)
        for project in Project.objects.all()
    }

    for model in ENGAGEMENT_MODELS:
        aggregates = model.objects.values('project_id').annotate(
            latest_created=Max('created_at'),
            latest_updated=Max('updated_at'),
            created_7_days=Count('pk', filter=Q(created_at__gte=cutoff_7_days)),
            created_30_days=Count('pk', filter=Q(created_at__gte=cutoff_30_days)),
        )
        for aggregate in aggregates:
            row = rows.get(aggregate['project_id'])
            if row is None:
                continue
            timestamps = [
                value
                for value in (aggregate['latest_created'], aggregate['latest_updated'])
                if value is not None
            ]
            if timestamps:
                latest = max(timestamps)
                if row.last_active is None or latest > row.last_active:
                    row.last_active = latest
            row.created_last_7_days += aggregate['created_7_days']
            row.created_last_30_days += aggregate['created_30_days']

    active_members = ProjectMembership.objects.filter(
        user__last_login__gte=cutoff_30_days,
    ).values('project_id').annotate(user_count=Count('user_id', distinct=True))
    for membership in active_members:
        row = rows.get(membership['project_id'])
        if row is not None:
            row.active_users_last_30_days = membership['user_count']

    projects = sorted(
        rows.values(),
        key=lambda row: row.last_active or datetime.min.replace(tzinfo=current_time.tzinfo),
        reverse=True,
    )
    user_model = get_user_model()
    return EngagementDashboard(
        projects=projects,
        total_projects=len(projects),
        active_projects_7_days=sum(
            row.last_active is not None and row.last_active >= cutoff_7_days for row in projects
        ),
        active_projects_30_days=sum(
            row.last_active is not None and row.last_active >= cutoff_30_days for row in projects
        ),
        total_users=user_model.objects.count(),
        users_logged_in_30_days=user_model.objects.filter(last_login__gte=cutoff_30_days).count(),
    )
