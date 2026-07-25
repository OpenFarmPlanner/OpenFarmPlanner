"""URL patterns for the provider handshake (Google/Microsoft).

Only the provider login and callback endpoints are routed. allauth's own
account pages (signup, login, email management, connection overview) stay
unrouted on purpose — OpenFarmPlanner's SPA provides those flows, and the URL
names used here (``<provider>_login`` / ``<provider>_callback``) are the ones
allauth reverses internally.
"""
from __future__ import annotations

from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.providers.oauth2.views import OAuth2CallbackView, OAuth2LoginView
from django.http import HttpRequest, HttpResponse
from django.urls import path
from django.views.decorators.csrf import csrf_protect

from .social_auth import (
    OpenFarmPlannerGoogleOAuth2Adapter,
    OpenFarmPlannerMicrosoftOAuth2Adapter,
    social_error_redirect,
)
from .social_linking import ERROR_PROVIDER_ERROR

PROVIDER_ADAPTERS = {
    'google': OpenFarmPlannerGoogleOAuth2Adapter,
    'microsoft': OpenFarmPlannerMicrosoftOAuth2Adapter,
}


def _login_view(adapter):  # noqa: ANN001 - allauth adapter class
    """Wrap a provider login view so it only ever starts on a POST.

    Starting the handshake on GET would allow login CSRF (a third party could
    silently start a login through an image or link). A stray GET — a
    bookmarked URL, the browser's back button — and a provider that this
    deployment has no credentials for are both sent back to the SPA login
    page instead of rendering allauth's own templates.
    """
    login_view = OAuth2LoginView.adapter_view(adapter)

    @csrf_protect
    def view(request: HttpRequest, *args: object, **kwargs: object) -> HttpResponse:
        if request.method != 'POST':
            return social_error_redirect(ERROR_PROVIDER_ERROR)
        try:
            return login_view(request, *args, **kwargs)
        except SocialApp.DoesNotExist:
            return social_error_redirect(ERROR_PROVIDER_ERROR)

    return view


def _callback_view(adapter):  # noqa: ANN001 - allauth adapter class
    """Wrap a provider callback view so an unconfigured provider cannot 500."""
    callback_view = OAuth2CallbackView.adapter_view(adapter)

    def view(request: HttpRequest, *args: object, **kwargs: object) -> HttpResponse:
        try:
            return callback_view(request, *args, **kwargs)
        except SocialApp.DoesNotExist:
            return social_error_redirect(ERROR_PROVIDER_ERROR)

    return view


urlpatterns = [
    pattern
    for provider_id, adapter in PROVIDER_ADAPTERS.items()
    for pattern in (
        path(
            f'{provider_id}/login/',
            _login_view(adapter),
            name=f'{provider_id}_login',
        ),
        path(
            f'{provider_id}/login/callback/',
            _callback_view(adapter),
            name=f'{provider_id}_callback',
        ),
    )
]
