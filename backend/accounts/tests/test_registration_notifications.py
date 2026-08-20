from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings

from accounts.guest_demo import create_guest_demo_session

User = get_user_model()


@override_settings(
    ADMIN_NOTIFICATION_EMAIL='staging-admin@example.com',
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class RegistrationNotificationTests(TestCase):
    def test_new_user_sends_informational_email_to_configured_admin(self) -> None:
        user = User.objects.create_user(
            username='new-grower',
            email='grower@example.com',
            password='safe-password-123',
        )

        self.assertEqual(len(mail.outbox), 1)
        notification = mail.outbox[0]
        self.assertEqual(notification.subject, 'New OpenFarmPlanner user registered: new-grower')
        self.assertEqual(notification.to, ['staging-admin@example.com'])
        self.assertIn('Username: new-grower', notification.body)
        self.assertIn('Email: grower@example.com', notification.body)
        self.assertIn(f'Registration timestamp: {user.date_joined.isoformat()}', notification.body)

    @patch('accounts.signals.send_mail', side_effect=RuntimeError('SMTP unavailable'))
    def test_email_failure_does_not_prevent_user_creation(self, mocked_send_mail) -> None:
        with self.assertLogs('accounts.signals', level='ERROR'):
            user = User.objects.create_user(
                username='still-created',
                email='',
                password='safe-password-123',
            )

        self.assertTrue(User.objects.filter(pk=user.pk).exists())
        mocked_send_mail.assert_called_once()

    @override_settings(ADMIN_NOTIFICATION_EMAIL='')
    def test_empty_admin_email_disables_notification(self) -> None:
        User.objects.create_user(
            username='notifications-disabled',
            email='disabled@example.com',
            password='safe-password-123',
        )

        self.assertEqual(mail.outbox, [])

    @patch('accounts.guest_demo.populate_demo_project')
    def test_guest_demo_user_does_not_send_notification(self, mocked_populate_demo_project) -> None:
        create_guest_demo_session()

        self.assertEqual(mail.outbox, [])
        mocked_populate_demo_project.assert_called_once()
