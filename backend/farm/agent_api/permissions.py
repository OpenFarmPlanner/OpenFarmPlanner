"""Scope and surface enforcement for project-bound API tokens.

The rule set is deliberately deny-by-default: a view is unreachable with an API
token unless it explicitly declares ``api_token_actions``. New endpoints are
therefore invisible to agents until someone consciously opts them in, rather
than being exposed by the mere act of existing.

Three independent checks apply to every token-authenticated request:

1. **Surface** — the view/action must be on the allowlist.
2. **Verb** — ``DELETE`` is refused everywhere in this version, regardless of
   scope, so a compromised token can never destroy data.
3. **Scope** — ``read`` tokens may only use safe (non-mutating) HTTP methods.
"""

from __future__ import annotations

from rest_framework import permissions

from farm.models import ProjectApiToken

# Verbs that never change data. Anything outside this set requires a `write`
# token; DELETE is additionally blocked by `BLOCKED_METHODS` below.
SAFE_METHODS = frozenset(permissions.SAFE_METHODS)

# Destructive verbs withheld from API tokens in this first version. Deleting
# project data stays a deliberate, session-authenticated action in the UI.
BLOCKED_METHODS = frozenset({'DELETE'})


def get_request_api_token(request) -> ProjectApiToken | None:
    """Return the API token backing this request, or None for other auth types.

    :param request: DRF request.
    :return: The authenticating :class:`ProjectApiToken`, or None.
    """
    auth = getattr(request, 'auth', None)
    return auth if isinstance(auth, ProjectApiToken) else None


def _resolve_action(request, view) -> str:
    """Return the allowlist key for this request.

    ViewSets are keyed by their action name (``list``, ``partial_update``, a
    custom ``@action`` method name, …); plain ``APIView`` subclasses have no
    action, so their lowercase HTTP method is used instead.
    """
    action = getattr(view, 'action', None)
    if action:
        return action
    return request.method.lower()


class ApiTokenAccessPermission(permissions.BasePermission):
    """Restrict token-authenticated requests to explicitly allowlisted surfaces.

    Session-authenticated requests pass through untouched — this class only
    ever narrows what an API token can reach, never what a signed-in user can.
    """

    def has_permission(self, request, view) -> bool:
        """Apply the surface, verb, and scope rules to token-authenticated requests."""
        token = get_request_api_token(request)
        if token is None:
            return True

        if request.method in BLOCKED_METHODS:
            self.message = (
                'API tokens cannot delete data. Use the web application for deletions.'
            )
            return False

        allowed_actions = getattr(view, 'api_token_actions', None)
        if not allowed_actions:
            self.message = 'This endpoint is not available for API tokens.'
            return False

        action = _resolve_action(request, view)
        if action not in allowed_actions:
            self.message = f"The action '{action}' is not available for API tokens."
            return False

        if request.method not in SAFE_METHODS and not token.can_write():
            self.message = "This API token has read-only scope; 'write' is required."
            return False

        return True
