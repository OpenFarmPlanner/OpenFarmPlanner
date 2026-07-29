"""Bearer-token authentication for project-bound API tokens.

Deliberately *not* a replacement for :class:`SessionAuthentication`: both are
registered, session-authenticated browser requests keep behaving exactly as
before, and only requests carrying an ``Authorization: Bearer ofp_pat_…``
header take this path.

CSRF: DRF's ``APIView.as_view()`` is CSRF-exempt, and only
``SessionAuthentication`` re-introduces the check via ``enforce_csrf``. This
class does not, so token clients need no CSRF token — which is correct, because
a bearer token is not ambiently attached by the browser and therefore not
subject to cross-site request forgery in the first place.
"""

from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from rest_framework import authentication, exceptions

from farm.models import API_TOKEN_PREFIX, ProjectApiToken, ProjectMembership

AUTH_HEADER_KEYWORD = 'bearer'


def header_carries_api_token(raw_header: str) -> bool:
    """Return True when an Authorization header value presents one of our API tokens.

    This is the *detection* counterpart to :meth:`ProjectApiTokenAuthentication.
    _extract_bearer_token`, used by the surface middleware and the exception
    handler, which see the header before DRF has parsed it.

    It must never be narrower than what the authenticator accepts: a request
    this returns False for skips the middleware's deny-by-default gate, so a
    mismatch between the two is an authorization bypass, not a cosmetic bug.
    HTTP auth schemes are case-insensitive (RFC 7235) and DRF splits on
    arbitrary whitespace, so ``bearer``, ``BEARER``, and ``Bearer  <token>``
    all authenticate and all have to be detected here. Matching is therefore
    deliberately broader than the authenticator: any bearer-scheme header
    carrying a value with our prefix counts.

    :param raw_header: Raw ``Authorization`` header value.
    :return: True when the header presents an OpenFarmPlanner API token.
    """
    parts = (raw_header or '').split()
    if not parts or parts[0].lower() != AUTH_HEADER_KEYWORD:
        return False
    return any(part.startswith(API_TOKEN_PREFIX) for part in parts[1:])


class ProjectApiTokenAuthentication(authentication.BaseAuthentication):
    """Authenticate ``Authorization: Bearer <token>`` against ``ProjectApiToken``."""

    keyword = AUTH_HEADER_KEYWORD

    def authenticate(self, request):
        """Resolve the bearer token, or return None to fall through to session auth.

        :param request: Incoming DRF request.
        :return: ``(user, token)`` tuple, or None when no bearer token is present.
        """
        raw_token = self._extract_bearer_token(request)
        if raw_token is None:
            return None

        token = (
            ProjectApiToken.objects
            .select_related('user', 'project')
            .filter(token_hash=ProjectApiToken.hash_token(raw_token))
            .first()
        )
        # Every rejection below uses the same generic message on purpose: a
        # caller holding an invalid token learns only that it does not work,
        # not whether it ever existed, who owns it, or why it stopped working.
        if token is None:
            raise exceptions.AuthenticationFailed(_('Invalid API token.'))
        if token.is_revoked:
            raise exceptions.AuthenticationFailed(_('This API token has been revoked.'))
        if token.is_expired:
            raise exceptions.AuthenticationFailed(_('This API token has expired.'))
        if not token.user.is_active:
            raise exceptions.AuthenticationFailed(_('Invalid API token.'))
        if not self._project_is_usable(token):
            raise exceptions.AuthenticationFailed(_('Invalid API token.'))
        # Membership is re-checked on every request rather than trusted from
        # issue time: removing someone from a project must immediately kill the
        # tokens they created for it, without a separate revocation step.
        if not self._membership_is_current(token):
            raise exceptions.AuthenticationFailed(
                _('The token owner is no longer a member of the bound project.')
            )

        token.touch_last_used()
        return token.user, token

    def authenticate_header(self, request):
        """Return the WWW-Authenticate header value for 401 responses."""
        return 'Bearer realm="api"'

    def _extract_bearer_token(self, request) -> str | None:
        """Return the raw token from the Authorization header, if this scheme applies."""
        header = authentication.get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword.encode():
            return None
        if len(header) != 2:
            raise exceptions.AuthenticationFailed(
                _('Invalid Authorization header. Expected "Bearer <token>".')
            )
        try:
            raw_token = header[1].decode('utf-8')
        except UnicodeError as exc:
            raise exceptions.AuthenticationFailed(_('Invalid API token.')) from exc

        # A bearer credential without our prefix belongs to some other scheme.
        # Returning None lets the remaining authenticators try instead of
        # failing the request outright.
        if not raw_token.startswith(API_TOKEN_PREFIX):
            return None
        return raw_token

    @staticmethod
    def _project_is_usable(token: ProjectApiToken) -> bool:
        """Return True when the bound project is still active and not soft-deleted."""
        project = token.project
        return bool(project.is_active and project.deleted_at is None)

    @staticmethod
    def _membership_is_current(token: ProjectApiToken) -> bool:
        """Return True when the owner still belongs to the bound project."""
        return ProjectMembership.objects.filter(
            user_id=token.user_id,
            project_id=token.project_id,
        ).exists()
