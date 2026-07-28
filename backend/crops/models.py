from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import models
from django.db.models import Q


class CropSpecies(models.Model):
    """Official language-independent species used at the publishing boundary."""

    STATUS_PUBLISHED = 'published'
    STATUS_PROPOSED = 'proposed'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PUBLISHED, 'Published'),
        (STATUS_PROPOSED, 'Proposed'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    name = models.CharField(max_length=200)
    name_normalized = models.CharField(max_length=200, db_index=True, editable=False, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PUBLISHED)
    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crop_species_proposals',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_crop_species_proposals',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Crop species'
        verbose_name_plural = 'Crop species'
        permissions = [
            ('moderate_crop_species', 'Can moderate crop species proposals'),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        from farm.utils import normalize_text

        self.name_normalized = normalize_text(self.name) or ''
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class PublicLibraryModeratorRequest(models.Model):
    """Request from a user who wants to help moderate the public crop library."""

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='public_library_moderator_requests',
    )
    motivation = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_public_library_moderator_requests',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=Q(status='pending'),
                name='unique_pending_public_library_moderator_request_per_user',
            ),
        ]
        verbose_name = 'Public library moderator request'
        verbose_name_plural = 'Public library moderator requests'

    def __str__(self) -> str:
        return f'{self.user_id}: {self.status}'
