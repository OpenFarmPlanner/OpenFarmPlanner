from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower


class PendingActivation(models.Model):
    """Stores activation expiry metadata for users that are not active yet."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pending_activation',
    )
    activation_expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        """
        Return a readable representation for admin/debug output.

        :return: String containing email/username and expiry timestamp.
        """
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'{identifier} (expires: {self.activation_expires_at.isoformat()})'


class UserProjectSettings(models.Model):
    """Stores per-user project preferences for default and last active project."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_settings',
    )
    default_project = models.ForeignKey(
        'farm.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='default_for_users',
    )
    last_project = models.ForeignKey(
        'farm.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='last_for_users',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        """Return a human-readable identifier."""
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'Project settings for {identifier}'


class AccountDeletionRequest(models.Model):
    """Stores deferred account deletion scheduling state for a user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='account_deletion_request',
    )
    deletion_requested_at = models.DateTimeField(null=True, blank=True)
    scheduled_deletion_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_pending(self) -> bool:
        """Return whether the account is currently scheduled for deletion."""
        return self.deletion_requested_at is not None and self.deleted_at is None

    def clear_schedule(self) -> None:
        """Clear pending deletion schedule fields.

        :return: None.
        """
        self.deletion_requested_at = None
        self.scheduled_deletion_at = None
        self.save(update_fields=['deletion_requested_at', 'scheduled_deletion_at', 'updated_at'])

    def __str__(self) -> str:
        """Return human-readable account deletion state text.

        :return: String with account identifier and schedule.
        """
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'Account deletion state for {identifier}'


class DocumentConsent(models.Model):
    """Records that a user accepted a specific version of a consent-requiring document.

    One row per acceptance event (not per user), so a user can have several
    rows for the same document across versions over time — this is the audit
    trail of who accepted which version, when. The current status for a user
    is derived by looking at their most recent row per document; see
    `accounts.consent` for the helpers that do this and the central version
    registry. Kept separate from the (Django built-in) user model, and keyed
    by a generic `document` field rather than one field per document, so
    additional consent-requiring documents (privacy policy, cookie policy,
    ...) can be added later without a schema change.
    """

    DOCUMENT_TERMS = 'terms'
    DOCUMENT_PRIVACY = 'privacy'
    DOCUMENT_PUBLIC_LIBRARY = 'public_library_terms'
    DOCUMENT_CHOICES = [
        (DOCUMENT_TERMS, 'Terms of Service'),
        (DOCUMENT_PRIVACY, 'Privacy Policy'),
        (DOCUMENT_PUBLIC_LIBRARY, 'Public Library Contribution Terms'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='document_consents',
    )
    document = models.CharField(max_length=32, choices=DOCUMENT_CHOICES, default=DOCUMENT_TERMS)
    version = models.CharField(max_length=32)
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-accepted_at']
        indexes = [models.Index(fields=['user', 'document', '-accepted_at'])]

    def __str__(self) -> str:
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'{self.get_document_display()} consent for {identifier} (v{self.version}, {self.accepted_at.isoformat()})'


class PublicProfile(models.Model):
    """Stores the opt-in public display name used to attribute public content.

    Distinct from ``User.first_name`` (the private, project-scoped
    registration name — see ``AccountProfileSerializer``): this name is
    shown to *all* users, including anonymous visitors, as the author of
    published public content (e.g. the public culture library). It is
    never set from the username or the private display name — it must be
    entered explicitly. Publications by a user without a public display
    name are attributed anonymously (see ``PublicCulture.created_by_label``).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='public_profile',
    )
    public_display_name = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower('public_display_name'),
                name='unique_public_display_name_ci',
                condition=~models.Q(public_display_name=''),
            ),
        ]

    def __str__(self) -> str:
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'Public profile for {identifier}'


class AccountEmailChangeRequest(models.Model):
    """Stores pending email-change requests that require token confirmation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_change_requests',
    )
    new_email = models.EmailField()
    expires_at = models.DateTimeField(db_index=True)
    confirmed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_active(self) -> bool:
        return self.confirmed_at is None

    def __str__(self) -> str:
        identifier = getattr(self.user, 'email', '') or getattr(self.user, 'username', '')
        return f'Email change request for {identifier} -> {self.new_email}'


class GuestDemoSession(models.Model):
    """Temporary anonymous workspace created from the reusable demo template."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='guest_demo_session',
    )
    project = models.OneToOneField(
        'farm.Project',
        on_delete=models.CASCADE,
        related_name='guest_demo_session',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)

    def __str__(self) -> str:
        return f'Guest demo session {self.pk}'
