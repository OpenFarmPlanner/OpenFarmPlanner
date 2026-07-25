"""django-allauth integration for Google/Microsoft login.

This module is the only place where allauth is wired into OpenFarmPlanner. It
keeps three responsibilities together because they all describe the same
boundary:

* the OAuth2 adapters, so redirect URIs are built from a configured public
  base URL instead of the request host (the SPA reaches the API through a
  dev-server proxy, so the request host is not the browser-visible origin);
* the allauth adapters, which apply the account-linking policy from
  :mod:`accounts.social_linking` and keep allauth's own account UI out of the
  request cycle; and
* the redirects back into the SPA, which carry a stable status/error code.

Account state itself (activation, deletion, consent) stays owned by
``accounts`` — allauth only contributes the provider handshake and the
``SocialAccount``/``EmailAddress`` records.
"""
from __future__ import annotations

from urllib.parse import urlencode

from allauth.account.adapter import DefaultAccountAdapter
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from allauth.socialaccount.providers.base.constants import AuthError, AuthProcess
from allauth.socialaccount.providers.google.provider import GoogleProvider
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.microsoft.provider import MicrosoftGraphProvider
from allauth.socialaccount.providers.microsoft.views import MicrosoftGraphOAuth2Adapter
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpRequest, HttpResponseRedirect
from django.urls import reverse

from config.frontend_urls import build_public_frontend_url

from .consent import record_acceptance
from .models import DocumentConsent, GuestDemoSession
from .serializers import build_username_from_email
from .social_linking import (
    ERROR_CANCELLED,
    ERROR_EMAIL_CONFLICT,
    ERROR_IDENTITY_ALREADY_LINKED,
    ERROR_INVALID_RESPONSE,
    ERROR_INVALID_STATE,
    ERROR_LOGIN_REQUIRED,
    ERROR_MISSING_EMAIL,
    ERROR_PROVIDER_ERROR,
    ERROR_UNVERIFIED_EMAIL,
    SocialLoginRejected,
    assert_account_can_be_used,
    find_user_by_email,
    may_auto_link,
    normalize_email,
)

User = get_user_model()

LOGIN_PATH = '/login'
ACCOUNT_SETTINGS_PATH = '/app/account-settings'
AUTHENTICATED_PATH = '/app'


def _frontend_url(path: str, params: dict[str, str] | None = None) -> str:
    """Build an absolute frontend URL with optional query parameters."""
    query = f'?{urlencode(params)}' if params else ''
    return build_public_frontend_url(f'{path}{query}')


def social_error_redirect(code: str, *, connecting: bool = False) -> HttpResponseRedirect:
    """Redirect back into the SPA with a stable social-login error code.

    :param code: Error code from :mod:`accounts.social_linking`.
    :param connecting: Whether the failure happened while connecting a
        provider to an already authenticated account.
    """
    path = ACCOUNT_SETTINGS_PATH if connecting else LOGIN_PATH
    return HttpResponseRedirect(_frontend_url(path, {'social_error': code}))


def social_callback_base_url() -> str:
    """Return the browser-visible origin the OAuth redirect URIs are built from."""
    return str(getattr(settings, 'SOCIAL_AUTH_CALLBACK_BASE_URL', '')).rstrip('/')


def build_provider_callback_url(provider_id: str) -> str:
    """Return the absolute redirect URI registered for ``provider_id``."""
    return f'{social_callback_base_url()}{reverse(f"{provider_id}_callback")}'


class _ConfiguredCallbackMixin:
    """Builds the OAuth redirect URI from the configured public base URL."""

    provider_id: str

    def get_callback_url(self, request: HttpRequest, app) -> str:  # noqa: ANN001 - allauth signature
        """Return the redirect URI sent to the provider."""
        return build_provider_callback_url(self.provider_id)


class OpenFarmPlannerGoogleOAuth2Adapter(_ConfiguredCallbackMixin, GoogleOAuth2Adapter):
    """Google adapter with a deployment-configured redirect URI."""


class OpenFarmPlannerMicrosoftOAuth2Adapter(_ConfiguredCallbackMixin, MicrosoftGraphOAuth2Adapter):
    """Microsoft adapter with a deployment-configured redirect URI."""


class OpenFarmPlannerGoogleProvider(GoogleProvider):
    """Google provider bound to the adapter above.

    The provider builds the authorization redirect while the callback view
    builds the token request, and both must send the identical
    ``redirect_uri``. Registered through
    ``SOCIALACCOUNT_PROVIDERS['google']['provider_class']``.
    """

    oauth2_adapter_class = OpenFarmPlannerGoogleOAuth2Adapter


class OpenFarmPlannerMicrosoftProvider(MicrosoftGraphProvider):
    """Microsoft provider bound to the adapter above."""

    oauth2_adapter_class = OpenFarmPlannerMicrosoftOAuth2Adapter


class OpenFarmPlannerAccountAdapter(DefaultAccountAdapter):
    """Keeps allauth's own account surface out of the application.

    allauth ships a complete account UI (signup, login, email management).
    OpenFarmPlanner already has those flows in ``accounts``, so none of the
    allauth views are routed and every redirect target is a frontend route.
    """

    def is_open_for_signup(self, request: HttpRequest) -> bool:
        """Allow signups; the social adapter decides per login."""
        return True

    def get_login_redirect_url(self, request: HttpRequest) -> str:
        """Send freshly authenticated users into the SPA."""
        return _frontend_url(AUTHENTICATED_PATH)

    def get_signup_redirect_url(self, request: HttpRequest) -> str:
        """Send freshly signed-up users into the SPA."""
        return _frontend_url(AUTHENTICATED_PATH)

    def get_logout_redirect_url(self, request: HttpRequest) -> str:
        """Send logged-out users to the SPA login page."""
        return _frontend_url(LOGIN_PATH)

    def populate_username(self, request: HttpRequest, user: User) -> None:
        """Use the project's username scheme instead of allauth's."""
        user.username = build_username_from_email(user.email or '')


class OpenFarmPlannerSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Applies the OpenFarmPlanner account-linking policy to social logins."""

    def pre_social_login(self, request: HttpRequest, sociallogin: SocialLogin) -> None:
        """Decide whether the login may proceed, and to which account.

        :raises ImmediateHttpResponse: to abort the login with a redirect back
            into the SPA carrying an error code.
        """
        connecting = sociallogin.state.get('process') == AuthProcess.CONNECT
        try:
            if connecting:
                self._validate_connect(request, sociallogin)
            else:
                self._resolve_login(request, sociallogin)
        except SocialLoginRejected as rejection:
            raise ImmediateHttpResponse(
                social_error_redirect(rejection.code, connecting=connecting)
            ) from rejection

    def on_authentication_error(
        self,
        request: HttpRequest,
        provider,  # noqa: ANN001 - allauth signature
        error=None,  # noqa: ANN001 - allauth signature
        exception=None,  # noqa: ANN001 - allauth signature
        extra_context=None,  # noqa: ANN001 - allauth signature
    ) -> None:
        """Turn provider/protocol errors into a redirect back into the SPA.

        :raises ImmediateHttpResponse: always — allauth's error template is
            never rendered.
        """
        raise ImmediateHttpResponse(
            social_error_redirect(_authentication_error_code(error, exception, extra_context))
        )

    def get_connect_redirect_url(self, request: HttpRequest, socialaccount) -> str:  # noqa: ANN001 - allauth signature
        """Return to the account settings page after connecting a provider."""
        return _frontend_url(ACCOUNT_SETTINGS_PATH, {'social_status': 'connected'})

    def is_auto_signup_allowed(self, request: HttpRequest, sociallogin: SocialLogin) -> bool:
        """Always sign up automatically; :meth:`pre_social_login` guards it."""
        return True

    def save_user(self, request: HttpRequest, sociallogin: SocialLogin, form=None) -> User:  # noqa: ANN001 - allauth signature
        """Create the account and record the Terms acceptance shown at sign-in."""
        user = super().save_user(request, sociallogin, form)
        record_acceptance(user, DocumentConsent.DOCUMENT_TERMS)
        return user

    def populate_user(self, request: HttpRequest, sociallogin: SocialLogin, data: dict) -> User:
        """Copy only the profile data OpenFarmPlanner actually uses."""
        user = sociallogin.user
        user.email = normalize_email(data.get('email'))
        user.first_name = (data.get('first_name') or data.get('name') or '').strip()[:150]
        user.last_name = ''
        user.username = build_username_from_email(user.email)
        return user

    def _resolve_login(self, request: HttpRequest, sociallogin: SocialLogin) -> None:
        """Attach the provider identity to the right account, or reject it."""
        if sociallogin.is_existing:
            assert_account_can_be_used(sociallogin.user)
            return

        email = normalize_email(sociallogin.user.email if sociallogin.user else '')
        if not email:
            raise SocialLoginRejected(ERROR_MISSING_EMAIL)

        verified = provider_verified_email(sociallogin, email)
        existing_user = find_user_by_email(email)
        if existing_user is None:
            # A provider that does not verify its email claim (Microsoft) must
            # not be trusted to create a brand-new account for that address
            # either — the same "nOAuth" concern that already blocks it from
            # auto-linking to an *existing* account below. Without this check,
            # anyone who can set an arbitrary `mail` attribute on a
            # self-service Entra tenant (no mailbox proof required) could
            # sign in as, and permanently pre-empt, someone else's address.
            if not verified:
                raise SocialLoginRejected(ERROR_UNVERIFIED_EMAIL)
            return

        assert_account_can_be_used(existing_user)
        if not may_auto_link(user=existing_user, email=email, provider_verified_email=verified):
            raise SocialLoginRejected(ERROR_EMAIL_CONFLICT)

        sociallogin.connect(request, existing_user)

    def _validate_connect(self, request: HttpRequest, sociallogin: SocialLogin) -> None:
        """Reject connecting an identity that belongs to a different account."""
        if not request.user.is_authenticated:
            raise SocialLoginRejected(ERROR_LOGIN_REQUIRED)
        # A guest demo workspace is temporary and gets deleted with its data;
        # attaching a permanent identity to it would strand that identity.
        if GuestDemoSession.objects.filter(user=request.user).exists():
            raise SocialLoginRejected(ERROR_LOGIN_REQUIRED)
        if sociallogin.is_existing and sociallogin.user.pk != request.user.pk:
            raise SocialLoginRejected(ERROR_IDENTITY_ALREADY_LINKED)


def provider_verified_email(sociallogin: SocialLogin, email: str) -> bool:
    """Return whether the provider asserts that it verified ``email``.

    Google signs an ``email_verified`` claim into the ID token. Microsoft
    reports no verification state at all — neither for personal accounts nor
    for Entra ID work accounts, where the address is administrator-controlled
    — so Microsoft logins never satisfy this check.
    """
    return any(
        address.verified and normalize_email(address.email) == email
        for address in sociallogin.email_addresses
    )


def _authentication_error_code(error, exception, extra_context) -> str:  # noqa: ANN001 - allauth signature
    """Map an allauth authentication error onto a frontend error code."""
    if error == AuthError.CANCELLED:
        return ERROR_CANCELLED
    if exception is not None:
        return ERROR_INVALID_RESPONSE
    # allauth only passes `state_id` when the state could not be recovered,
    # i.e. the callback carried an unknown, replayed or expired state.
    if extra_context and 'state_id' in extra_context:
        return ERROR_INVALID_STATE
    return ERROR_PROVIDER_ERROR
