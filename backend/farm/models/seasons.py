"""Seasons: per-project season pattern and season-scoped planning periods."""

from django.conf import settings
from django.db import models

from .base import TimestampedModel
from .projects import Project


class SeasonPattern(TimestampedModel):
    """Per-project configuration for when a new season begins.

    A season always spans exactly 12 months from its start date — duration
    is not configurable, only the start day/month is (see the Saisonen
    feature spec: "Dauer ist IMMER fix 12 Monate").
    """

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='season_pattern')
    start_day = models.PositiveSmallIntegerField(default=1, help_text="Day of month a season starts on (1-31).")
    start_month = models.PositiveSmallIntegerField(default=1, help_text="Month a season starts on (1-12).")

    def __str__(self) -> str:
        """Return a short description of the configured start date."""
        return f"SeasonPattern({self.start_day:02d}.{self.start_month:02d}) for project {self.project_id}"


class ActiveSeasonManager(models.Manager):
    """Default manager hiding soft-deleted seasons."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Season(TimestampedModel):
    """A project-scoped planning period that planting plans are scheduled in."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='seasons')
    start_date = models.DateField(help_text="Season start date.")
    end_date = models.DateField(help_text="Season end date (inclusive).")
    custom_label = models.CharField(
        max_length=100,
        blank=True,
        help_text="Optional user-chosen override for the computed label (set via 'Umbenennen').",
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_seasons',
    )

    objects = ActiveSeasonManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ['-start_date']
        constraints = [
            models.UniqueConstraint(fields=['project', 'start_date'], name='unique_season_start_per_project'),
        ]

    @property
    def computed_label(self) -> str:
        """Return the label computed from the season's date range.

        A four-digit year (e.g. "2026") when the season runs exactly from
        Jan 1 to Dec 31 of the same year; otherwise a "YY/YY" span (e.g.
        "25/26"), hemisphere-agnostic.
        """
        is_calendar_year = (
            self.start_date.month == 1
            and self.start_date.day == 1
            and self.end_date.month == 12
            and self.end_date.day == 31
            and self.start_date.year == self.end_date.year
        )
        if is_calendar_year:
            return str(self.start_date.year)
        return f"{self.start_date.year % 100:02d}/{self.end_date.year % 100:02d}"

    @property
    def label(self) -> str:
        """Return the custom label if set, otherwise the computed one."""
        return self.custom_label or self.computed_label

    def __str__(self) -> str:
        """Return the season's label for admin and debug output."""
        return self.label
