from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from accounts.guest_demo import create_guest_demo_session
from accounts.models import GuestDemoSession
from accounts.views import GuestDemoStartView, LoginView
from farm.models import Culture, Project

User = get_user_model()


def throttled_rest_framework_settings(
    *,
    auth_login: str,
    guest_demo_start: str,
) -> dict[str, object]:
    """Build DRF settings for scoped-throttle tests without dropping pagination."""
    return {
        **settings.REST_FRAMEWORK,
        'DEFAULT_PERMISSION_CLASSES': [
            'rest_framework.permissions.AllowAny',
        ],
        'DEFAULT_THROTTLE_CLASSES': [
            'rest_framework.throttling.ScopedRateThrottle',
        ],
        'DEFAULT_THROTTLE_RATES': {
            **settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'],
            'auth_login': auth_login,
            'guest_demo_start': guest_demo_start,
        },
        'EXCEPTION_HANDLER': 'config.exceptions.api_exception_handler',
    }


@contextmanager
def enabled_scoped_throttling() -> Iterator[None]:
    """Temporarily restore DRF scoped throttling disabled by test settings."""
    rates = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
    with (
        patch.object(ScopedRateThrottle, 'THROTTLE_RATES', rates),
        patch.object(GuestDemoStartView, 'throttle_classes', [ScopedRateThrottle]),
        patch.object(LoginView, 'throttle_classes', [ScopedRateThrottle]),
    ):
        yield


class GuestDemoApiTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient()

    def test_start_creates_an_isolated_authenticated_demo(self) -> None:
        response = self.client.post(
            '/openfarmplanner/api/auth/guest-demo/start/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_guest_demo'])
        self.assertIsNotNone(response.data['guest_demo_session_id'])
        self.assertTrue(response.data['memberships'][0]['is_demo_project'])
        project = Project.objects.get(id=response.data['resolved_project_id'])
        self.assertEqual(project.name, 'Solawi Sonnenacker')
        self.assertGreater(Culture.objects.filter(project=project).count(), 0)
        self.assertEqual(response.data['pending_consents'], [])

    def test_each_start_receives_its_own_workspace(self) -> None:
        first = self.client.post(
            '/openfarmplanner/api/auth/guest-demo/start/',
            {},
            format='json',
        )
        second_client = APIClient()
        second = second_client.post(
            '/openfarmplanner/api/auth/guest-demo/start/',
            {},
            format='json',
        )

        self.assertNotEqual(first.data['resolved_project_id'], second.data['resolved_project_id'])

    def test_end_deletes_current_guest_workspace(self) -> None:
        started = self.client.post(
            '/openfarmplanner/api/auth/guest-demo/start/',
            {},
            format='json',
        )
        project_id = started.data['resolved_project_id']

        response = self.client.post('/openfarmplanner/api/auth/guest-demo/end/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Project.objects.filter(id=project_id).exists())

    def test_expired_session_is_removed_by_cleanup_command(self) -> None:
        demo_session = create_guest_demo_session()
        demo_session.expires_at = timezone.now() - timedelta(seconds=1)
        demo_session.save(update_fields=['expires_at'])

        from django.core.management import call_command

        call_command('cleanup_guest_demo_sessions')
        self.assertFalse(GuestDemoSession.objects.filter(id=demo_session.id).exists())

    @override_settings(
        REST_FRAMEWORK=throttled_rest_framework_settings(
            auth_login='10/minute',
            guest_demo_start='1/minute',
        ),
    )
    def test_restrictive_guest_demo_throttle_limits_repeated_starts(self) -> None:
        with enabled_scoped_throttling():
            first_client = APIClient(REMOTE_ADDR='203.0.113.10')
            second_client = APIClient(REMOTE_ADDR='203.0.113.10')
            first = first_client.post(
                '/openfarmplanner/api/auth/guest-demo/start/',
                {},
                format='json',
            )
            second = second_client.post(
                '/openfarmplanner/api/auth/guest-demo/start/',
                {},
                format='json',
            )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('Retry-After', second.headers)
        self.assertGreaterEqual(int(second.headers['Retry-After']), 1)
        self.assertGreaterEqual(second.data['retry_after'], 1)

    @override_settings(
        REST_FRAMEWORK=throttled_rest_framework_settings(
            auth_login='10/minute',
            guest_demo_start='1/minute',
        ),
    )
    def test_guest_demo_throttle_is_scoped_by_client_ip(self) -> None:
        with enabled_scoped_throttling():
            first = APIClient(REMOTE_ADDR='203.0.113.20').post(
                '/openfarmplanner/api/auth/guest-demo/start/',
                {},
                format='json',
            )
            second = APIClient(REMOTE_ADDR='203.0.113.21').post(
                '/openfarmplanner/api/auth/guest-demo/start/',
                {},
                format='json',
            )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

    @override_settings(
        REST_FRAMEWORK=throttled_rest_framework_settings(
            auth_login='1/minute',
            guest_demo_start='1000/minute',
        ),
    )
    def test_development_guest_demo_throttle_allows_repeated_starts(self) -> None:
        with enabled_scoped_throttling():
            responses = [
                APIClient(REMOTE_ADDR='203.0.113.11').post(
                    '/openfarmplanner/api/auth/guest-demo/start/',
                    {},
                    format='json',
                )
                for _ in range(3)
            ]

        self.assertTrue(
            all(response.status_code == status.HTTP_201_CREATED for response in responses)
        )

    @override_settings(
        REST_FRAMEWORK=throttled_rest_framework_settings(
            auth_login='1/minute',
            guest_demo_start='1000/minute',
        ),
    )
    def test_guest_demo_throttle_does_not_change_other_scopes(self) -> None:
        with enabled_scoped_throttling():
            first = APIClient(REMOTE_ADDR='203.0.113.12').post(
                '/openfarmplanner/api/auth/login/',
                {},
                format='json',
            )
            second = APIClient(REMOTE_ADDR='203.0.113.12').post(
                '/openfarmplanner/api/auth/login/',
                {},
                format='json',
            )

        self.assertNotEqual(first.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
