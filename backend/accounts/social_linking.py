"""Account-linking policy for social (Google/Microsoft) logins.

The rules implemented here answer one question: when a provider hands us a
verified provider identity, which OpenFarmPlanner account may it be attached
to? The provider identity (``provider`` + stable ``uid``) is the only key used
to recognise a returning user; email addresses are used exclusively to decide
whether an *existing* local account may be linked automatically, and only
under the conditions in :func:`may_auto_link`.
"""
from __future__ import annotations

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import AccountDeletionRequest

User = get_user_model()

# Error codes handed to the frontend as `?social_error=<code>`. The frontend
# maps them to localized messages (auth:socialLogin.errors.*).
ERROR_CANCELLED = 'cancelled'
ERROR_PROVIDER_ERROR = 'provider_error'
ERROR_INVALID_STATE = 'invalid_state'
ERROR_INVALID_RESPONSE = 'invalid_response'
ERROR_MISSING_EMAIL = 'missing_email'
ERROR_UNVERIFIED_EMAIL = 'unverified_email'
ERROR_EMAIL_CONFLICT = 'email_conflict'
ERROR_ACCOUNT_INACTIVE = 'account_inactive'
ERROR_ACCOUNT_PENDING_DELETION = 'account_pending_deletion'
ERROR_IDENTITY_ALREADY_LINKED = 'identity_already_linked'
ERROR_LOGIN_REQUIRED = 'login_required'


class SocialLoginRejected(Exception):
    """Raised when a social login must not be completed."""

    def __init__(self, code: str) -> None:
        """
        :param code: Stable error code forwarded to the frontend.
        """
        super().__init__(code)
        self.code = code


def normalize_email(email: str | None) -> str:
    """Return a comparable, normalized email address (empty when unusable)."""
    if not email:
        return ''
    normalized = User.objects.normalize_email(email).strip().lower()
    if '@' not in normalized.strip('@'):
        return ''
    return normalized


def find_user_by_email(email: str) -> User | None:
    """Return the account owning ``email``, if any."""
    if not email:
        return None
    return User.objects.filter(email__iexact=email).first()


def is_local_email_verified(user: User, email: str) -> bool:
    """Return whether ``user`` provably controls ``email``.

    Two sources count as proof:

    * an ``allauth`` ``EmailAddress`` record flagged verified — this is how
      social signups with a provider-verified address are recorded, and how
      confirmed email changes are kept in sync; and
    * a usable password on an active account: every password account went
      through the emailed activation link (``ActivateView``), and both the
      password reset and the email change flow only ever hand control over
      through a link sent to that very address.

    An account created from a provider that does not assert a verified email
    (Microsoft) therefore stays unverified until its owner proves ownership.
    """
    if not email:
        return False
    if EmailAddress.objects.filter(user=user, email__iexact=email, verified=True).exists():
        return True
    return user.is_active and user.has_usable_password()


def may_auto_link(*, user: User, email: str, provider_verified_email: bool) -> bool:
    """Return whether a provider identity may be linked to ``user`` silently.

    Both sides must have proven control over the same mailbox: the provider
    must assert that it verified the address, and OpenFarmPlanner must have
    verified it as well. A bare address match is never enough — a provider
    that lets its users pick arbitrary addresses (Entra ID work accounts) would
    otherwise be able to take over accounts ("nOAuth").
    """
    return bool(provider_verified_email) and is_local_email_verified(user, email)


def assert_account_can_be_used(user: User) -> None:
    """Reject social logins for accounts that must not be signed in to.

    :raises SocialLoginRejected: when the account is scheduled for deletion or
        has not been activated.
    """
    deletion = AccountDeletionRequest.objects.filter(user=user).first()
    if (
        deletion is not None
        and deletion.is_pending
        and deletion.scheduled_deletion_at is not None
        and deletion.scheduled_deletion_at > timezone.now()
    ):
        raise SocialLoginRejected(ERROR_ACCOUNT_PENDING_DELETION)
    if not user.is_active:
        raise SocialLoginRejected(ERROR_ACCOUNT_INACTIVE)


def has_other_login_method(*, user: User, excluded_social_account_id: int) -> bool:
    """Return whether the account keeps a way to sign in without one identity."""
    if user.has_usable_password():
        return True
    return user.socialaccount_set.exclude(pk=excluded_social_account_id).exists()
