"""In-app user feedback submitted from the feedback dialog."""


from django.conf import settings
from django.db import models

from .base import TimestampedModel
from .projects import Project


class Feedback(TimestampedModel):
    """One feedback message sent from the app, kept for later evaluation.

    The email to the support address is the primary delivery channel; this row
    is the durable history so feedback is not lost when mail delivery fails.
    """

    class Category(models.TextChoices):
        BUG = 'bug', 'Bug'
        IDEA = 'idea', 'Idea'
        QUESTION = 'question', 'Question'
        OTHER = 'other', 'Other'

    category = models.CharField(max_length=20, choices=Category.choices, blank=True)
    message = models.TextField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='feedback_entries',
    )
    project = models.ForeignKey(
        Project,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='feedback_entries',
    )
    # Snapshot of the project name at submission time: the project may be
    # renamed or deleted later, and the feedback still has to be readable.
    project_name = models.CharField(max_length=255, blank=True)
    route = models.CharField(max_length=500, blank=True)
    browser_info = models.CharField(max_length=1000, blank=True)
    contact_consent = models.BooleanField(default=False)
    # Only filled when contact was allowed; otherwise no email is attached to
    # the feedback at all.
    contact_email = models.EmailField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Feedback'
        verbose_name_plural = 'Feedback'

    def __str__(self) -> str:
        category = self.get_category_display() if self.category else 'Feedback'
        return f'{category} – {self.project_name or "no project"} ({self.created_at:%Y-%m-%d})'
