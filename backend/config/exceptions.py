from __future__ import annotations

from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    wait = getattr(exc, 'wait', None)
    if response is not None and response.status_code == 429 and wait is not None:
        retry_after = int(wait) if wait == int(wait) else int(wait) + 1
        response.data['retry_after'] = retry_after
    return response
