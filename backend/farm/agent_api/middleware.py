"""Outermost gate for API-token requests: refuse views that never opted in.

:class:`~farm.agent_api.permissions.ApiTokenAccessPermission` already denies
non-allowlisted views, but it only runs for views that actually use the default
permission classes. A view setting its own ``permission_classes`` — several
account endpoints do — would silently drop out of that check, and so would any
non-DRF view such as the Django admin.

This middleware closes that hole one layer up, where no view configuration can
influence it: if a request carries an API-token bearer credential and the
resolved view does not declare ``api_token_actions``, it is refused before the
view runs. Requests without such a credential are untouched.
"""

from __future__ import annotations

import json

from django.http import HttpResponse

from .authentication import header_carries_api_token

_DENIED_BODY = json.dumps(
    {'detail': 'This endpoint is not available for API tokens.'}
).encode('utf-8')


def _carries_api_token(request) -> bool:
    """Return True when the request presents an OpenFarmPlanner API token.

    Detection is shared with the authenticator rather than reimplemented here:
    if this check were narrower than the one that actually accepts the
    credential, a token could authenticate while staying invisible to the gate
    below.
    """
    return header_carries_api_token(request.META.get('HTTP_AUTHORIZATION', ''))


def _view_opted_in(view_func) -> bool:
    """Return True when the resolved view declares an API-token allowlist."""
    # DRF's as_view() attaches the originating class as `cls`; plain Django
    # views (admin, redirects) have neither, and are therefore never reachable.
    view_class = getattr(view_func, 'cls', None) or getattr(view_func, 'view_class', None)
    return bool(getattr(view_class, 'api_token_actions', None))


class ApiTokenSurfaceMiddleware:
    """Refuse API-token requests to views that have not opted into the agent API."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        """Pass the request through; the decision happens in ``process_view``."""
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Return 403 for token requests aimed at a non-allowlisted view."""
        if not _carries_api_token(request):
            return None
        if _view_opted_in(view_func):
            return None
        return HttpResponse(_DENIED_BODY, content_type='application/json', status=403)
