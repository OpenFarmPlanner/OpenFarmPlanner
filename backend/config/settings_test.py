"""Test settings for running tests with SQLite database."""

import os

os.environ['DEBUG'] = 'True'
os.environ['DJANGO_ENV'] = 'test'
os.environ.setdefault('PUBLIC_FRONTEND_URL', 'http://localhost:5173')

from .settings import *  # noqa: F403, F401

ADMIN_NOTIFICATION_EMAIL = ''

# Override database to use SQLite for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
        'ATOMIC_REQUESTS': True,
    }
}

# Keep existing test suite behavior focused on domain logic.
# Authentication behavior is validated separately in accounts tests.
#
# The API-token permission stays enabled: relaxing IsAuthenticated must not
# also relax the deny-by-default rule for API tokens, otherwise the token
# isolation tests would pass against a configuration production never runs.
REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] = [  # type: ignore[name-defined]
    'rest_framework.permissions.AllowAny',
    'farm.agent_api.permissions.ApiTokenAccessPermission',
]
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []  # type: ignore[name-defined]
