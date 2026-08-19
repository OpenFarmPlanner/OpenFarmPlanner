from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import models
from django.db.models import Q


class CropSpecies(models.Model):
    """Official language-independent species used at the publishing boundary.

    ``name`` is the canonical *reference* label, not a UI label: it exists so
    the species has one stable, unique, human-readable identity (and so the
    unique ``name_normalized`` constraint keeps working). Everything the user
    sees comes from :class:`CropSpeciesTranslation` via
    :meth:`localized_name`, which falls back to ``name`` only as a last resort
    so the UI can never render an empty species.
    """

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

    @property
    def is_pending(self) -> bool:
        """True while a moderator has not yet decided on this proposal.

        The single source of truth for "pending" callers that gate on this
        status (publish/import/discussion blocks, the frontend chip) so the
        rule can't drift between call sites.
        """
        return self.status == self.STATUS_PROPOSED

    def translations_by_language(self) -> dict[str, str]:
        """language code → common name, for every stored translation.

        Uses ``self.translations.all()`` so a ``prefetch_related`` on the
        queryset is reused instead of triggering one query per species.
        """
        return {
            translation.language_code: translation.common_name
            for translation in self.translations.all()
            if translation.common_name
        }

    def localized_name(self, language_code: str | None) -> tuple[str, str]:
        """Best available common name plus the language it came from.

        Fallback order is the project-wide one (requested → English → any
        other translation → technical replacement); see
        ``config.languages.resolve_translation``. The returned language code
        is ``''`` only when the canonical ``name`` had to stand in, which is
        how callers know not to claim the text is a real translation.
        """
        from config.languages import resolve_translation

        return resolve_translation(
            self.translations_by_language(),
            language_code,
            fallback=self.name,
        )

    def __str__(self) -> str:
        return self.name


class CropSpeciesTranslation(models.Model):
    """The common name of one species in one language.

    "Tomate" and "Tomato" are two rows here pointing at the *same*
    ``CropSpecies`` — never two species. Only genuinely language-dependent
    text belongs here; growing data, spacings and variety names stay on the
    language-independent records.
    """

    species = models.ForeignKey(
        CropSpecies,
        on_delete=models.CASCADE,
        related_name='translations',
    )
    language_code = models.CharField(max_length=10, db_index=True)
    common_name = models.CharField(max_length=200)
    common_name_normalized = models.CharField(max_length=200, db_index=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['language_code']
        constraints = [
            models.UniqueConstraint(
                fields=['species', 'language_code'],
                name='unique_crop_species_translation_per_language',
            ),
        ]
        verbose_name = 'Crop species translation'
        verbose_name_plural = 'Crop species translations'

    def save(self, *args: Any, **kwargs: Any) -> None:
        from farm.utils import normalize_text

        self.language_code = (self.language_code or '').strip().lower()
        self.common_name = ' '.join((self.common_name or '').split())
        self.common_name_normalized = normalize_text(self.common_name) or ''
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'{self.language_code}: {self.common_name}'


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
