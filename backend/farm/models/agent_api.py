"""Project-bound API tokens and stored crop-import drafts for external agents.

These two models back the agent API surface documented in
``docs/agent-api.md``:

* :class:`ProjectApiToken` — a personal, project-bound bearer credential. The
  plaintext value exists only in the HTTP response that created it; the
  database stores a SHA-256 digest plus a short, non-secret prefix used to
  recognize the token in listings.
* :class:`CropImportDraft` — a server-side, immutable snapshot of a
  validated crop import. Applying an import references a draft id rather
  than resending the payload, which is what makes the two-step preview/apply
  flow safe against payload drift between the two calls.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone

from .base import TimestampedModel
from .projects import Project

# Prefix on every issued token. Makes leaked credentials recognizable in logs
# and secret scanners, and lets the authenticator reject obviously foreign
# bearer values before touching the database.
API_TOKEN_PREFIX = 'ofp_pat_'

# Bytes of entropy behind each token. 32 bytes (256 bit) is far beyond what a
# plain (unsalted, un-stretched) SHA-256 digest needs to be safe against
# brute-force or rainbow-table attacks — unlike a password, the input is
# uniformly random and has no low-entropy candidate space to enumerate.
API_TOKEN_ENTROPY_BYTES = 32

# Number of leading characters of the random part kept in clear text so users
# can tell their tokens apart in the UI without revealing anything usable.
API_TOKEN_DISPLAY_PREFIX_LENGTH = 8


class ProjectApiToken(TimestampedModel):
    """A personal API token bound to exactly one project and one user.

    The (user, project) pair is frozen at creation time. Request handling never
    reads a project from the client for token-authenticated requests, so no
    header or query parameter can widen a token's reach — see
    ``farm.project_context.get_active_project_or_400``.
    """

    SCOPE_READ = 'read'
    SCOPE_WRITE = 'write'
    SCOPE_DELETE = 'delete'
    SCOPE_CHOICES = [
        (SCOPE_READ, 'Read only'),
        (SCOPE_WRITE, 'Read and write'),
        (SCOPE_DELETE, 'Read, write, and delete'),
    ]
    SCOPE_VALUES = {SCOPE_READ, SCOPE_WRITE, SCOPE_DELETE}

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_api_tokens',
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='api_tokens')
    name = models.CharField(max_length=120, help_text='Human-readable label chosen by the owner')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default=SCOPE_READ)
    token_hash = models.CharField(max_length=64, unique=True, db_index=True, editable=False)
    token_prefix = models.CharField(
        max_length=16,
        editable=False,
        help_text='Non-secret leading characters used to identify the token in listings',
    )
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'project']),
        ]

    def __str__(self) -> str:
        """Return a label safe to print in admin and logs."""
        return f'{self.name} ({self.token_prefix}…)'

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """Return the SHA-256 digest used as the stored token representation.

        :param raw_token: Full plaintext token including the ``ofp_pat_`` prefix.
        :return: Hex-encoded SHA-256 digest.
        """
        return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    @classmethod
    def generate_raw_token(cls) -> str:
        """Return a fresh, prefixed, high-entropy plaintext token."""
        return f'{API_TOKEN_PREFIX}{secrets.token_urlsafe(API_TOKEN_ENTROPY_BYTES)}'

    @classmethod
    def create_token(
        cls,
        *,
        user,
        project: Project,
        name: str,
        scope: str = SCOPE_READ,
        expires_at=None,
    ) -> tuple[ProjectApiToken, str]:
        """Create a token and return it together with its one-time plaintext.

        The caller is responsible for having verified that ``user`` is a member
        of ``project``; this method only enforces the value-level invariants.

        :param user: Owner of the token.
        :param project: Project the token is permanently bound to.
        :param name: Human-readable label.
        :param scope: Either ``read``, ``write``, or ``delete``.
        :param expires_at: Optional expiry timestamp.
        :return: Tuple of persisted token and its plaintext value.
        """
        if scope not in cls.SCOPE_VALUES:
            raise ValueError(f'Unsupported API token scope: {scope!r}')

        raw_token = cls.generate_raw_token()
        random_part = raw_token[len(API_TOKEN_PREFIX):]
        token = cls.objects.create(
            user=user,
            project=project,
            name=name,
            scope=scope,
            token_hash=cls.hash_token(raw_token),
            token_prefix=random_part[:API_TOKEN_DISPLAY_PREFIX_LENGTH],
            expires_at=expires_at,
        )
        return token, raw_token

    @property
    def is_expired(self) -> bool:
        """Return True when an expiry is set and has passed."""
        return self.expires_at is not None and timezone.now() >= self.expires_at

    @property
    def is_revoked(self) -> bool:
        """Return True when the token has been revoked."""
        return self.revoked_at is not None

    @property
    def is_active(self) -> bool:
        """Return True when the token may still authenticate a request."""
        return not self.is_revoked and not self.is_expired

    @property
    def status(self) -> str:
        """Return the resolved lifecycle status for API output."""
        if self.is_revoked:
            return 'revoked'
        if self.is_expired:
            return 'expired'
        return 'active'

    def can_write(self) -> bool:
        """Return True when the token's scope permits mutating requests."""
        return self.scope in {self.SCOPE_WRITE, self.SCOPE_DELETE}

    def can_delete(self) -> bool:
        """Return True when the token's scope permits destructive requests."""
        return self.scope == self.SCOPE_DELETE

    def revoke(self) -> None:
        """Mark the token as revoked; a revoked token is never reactivated."""
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=['revoked_at', 'updated_at'])

    def touch_last_used(self, *, now=None, min_interval_seconds: int = 60) -> None:
        """Record usage, skipping writes that would only shift the value slightly.

        Agents poll frequently; updating a row on every single request would
        turn every read into a write. Coalescing to at most one update per
        ``min_interval_seconds`` keeps ``last_used_at`` useful for auditing
        without that cost.

        :param now: Timestamp to record; defaults to the current time.
        :param min_interval_seconds: Minimum spacing between two writes.
        :return: None.
        """
        moment = now or timezone.now()
        if (
            self.last_used_at is not None
            and (moment - self.last_used_at).total_seconds() < min_interval_seconds
        ):
            return
        self.last_used_at = moment
        # Bypass save() so this bookkeeping never touches updated_at, which
        # would otherwise make every read look like a token modification.
        type(self).objects.filter(pk=self.pk).update(last_used_at=moment)


class CropImportDraft(models.Model):
    """A validated, immutable crop-import proposal awaiting confirmation.

    The draft holds the analysis produced by the preview step. Apply re-reads
    it from the database instead of trusting a resent payload, so the rows the
    user confirmed are exactly the rows that get written.
    """

    STATUS_PENDING = 'pending'
    STATUS_APPLIED = 'applied'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending confirmation'),
        (STATUS_APPLIED, 'Applied'),
    ]

    # Drafts are short-lived by design: they pin a snapshot of project data
    # (which crops matched) that goes stale as the project changes.
    DEFAULT_TTL_SECONDS = 2 * 60 * 60

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name='crop_import_drafts'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='crop_import_drafts',
    )
    source_label = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    # SHA-256 over the canonicalized preview payload. The apply call must echo
    # it back, which turns "the preview I confirmed" into something the server
    # can verify rather than assume.
    checksum = models.CharField(max_length=64, editable=False)
    preview = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    has_errors = models.BooleanField(default=False)
    has_warnings = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        """Return a short identifier for admin and debug output."""
        return f'CropImportDraft {self.id} ({self.status})'

    @property
    def is_expired(self) -> bool:
        """Return True when the draft may no longer be applied."""
        return timezone.now() >= self.expires_at

    @staticmethod
    def compute_checksum(payload: Any) -> str:
        """Return a stable SHA-256 checksum over a JSON-serializable payload.

        :param payload: Any JSON-serializable structure.
        :return: Hex-encoded SHA-256 digest of the canonical JSON encoding.
        """
        import json

        canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str)
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()
