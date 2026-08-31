"""API tests for the in-app feedback endpoint."""

from email.header import decode_header, make_header
from unittest.mock import patch

from django.core import mail
from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from farm.models import Feedback
from farm.tests.api_base import ProjectApiTestCase

FEEDBACK_URL = '/openfarmplanner/api/feedback/'


class FeedbackApiTest(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        mail.outbox = []

    def test_feedback_is_stored_and_emailed_with_context(self):
        response = self.client.post(FEEDBACK_URL, {
            'category': 'bug',
            'message': 'Der Anbauplan lässt sich nicht speichern.',
            'project_name': 'Test Project',
            'route': '/app/planting-plans',
            'browser_info': 'Mozilla/5.0 – 1440x900',
            'contact_consent': False,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = Feedback.objects.get(id=response.data['id'])
        self.assertEqual(feedback.category, 'bug')
        self.assertEqual(feedback.user, self.user)
        self.assertEqual(feedback.project, self.project)
        self.assertEqual(feedback.project_name, 'Test Project')
        self.assertEqual(feedback.route, '/app/planting-plans')
        self.assertFalse(feedback.contact_consent)
        self.assertEqual(feedback.contact_email, '')

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, '[Feedback] Fehler - Test Project')
        self.assertEqual(message.to, ['info@openfarmplanner.org'])
        self.assertFalse(message.reply_to)
        self.assertIn('Der Anbauplan lässt sich nicht speichern.', message.body)
        self.assertIn('/app/planting-plans', message.body)
        self.assertIn('Mozilla/5.0 – 1440x900', message.body)

    def test_contact_consent_attaches_account_email_as_reply_to(self):
        response = self.client.post(FEEDBACK_URL, {
            'category': 'idea',
            'message': 'Ein Wochenplan wäre hilfreich.',
            'project_name': 'Test Project',
            'contact_consent': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = Feedback.objects.get(id=response.data['id'])
        self.assertTrue(feedback.contact_consent)
        self.assertEqual(feedback.contact_email, self.user.email)
        self.assertEqual(mail.outbox[0].reply_to, [self.user.email])
        self.assertEqual(mail.outbox[0].subject, '[Feedback] Idee - Test Project')

    def test_feedback_without_category_uses_generic_subject(self):
        response = self.client.post(FEEDBACK_URL, {
            'message': 'Danke für die App!',
            'project_name': 'Test Project',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mail.outbox[0].subject, '[Feedback] Allgemein - Test Project')

    def test_subject_with_umlauts_uses_quoted_printable_encoding(self):
        response = self.client.post(FEEDBACK_URL, {
            'category': 'idea',
            'message': 'Feedback mit Umlauten im Projektnamen.',
            'project_name': 'Öko Gärtnerei Größenwahn',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        raw_subject = str(mail.outbox[0].message()['Subject'])
        # Quoted-printable word, not a Base64 blob, so the raw source stays
        # readable while debugging.
        self.assertTrue(raw_subject.startswith('=?utf-8?q?'))
        self.assertEqual(
            str(make_header(decode_header(raw_subject))),
            '[Feedback] Idee - Öko Gärtnerei Größenwahn',
        )

    def test_project_name_falls_back_to_active_project(self):
        response = self.client.post(FEEDBACK_URL, {
            'message': 'Kontextloses Feedback.',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = Feedback.objects.get(id=response.data['id'])
        self.assertEqual(feedback.project_name, self.project.name)

    def test_blank_message_is_rejected(self):
        response = self.client.post(FEEDBACK_URL, {'message': '   '}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Feedback.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_unknown_category_is_rejected(self):
        response = self.client.post(FEEDBACK_URL, {
            'category': 'complaint',
            'message': 'Test',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_feedback_is_kept_when_email_delivery_fails(self):
        with patch('farm.feedback.views.send_feedback_email', return_value=False):
            response = self.client.post(FEEDBACK_URL, {
                'message': 'Bitte trotzdem speichern.',
            }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['email_delivered'])
        self.assertEqual(Feedback.objects.count(), 1)

    def test_email_backend_error_does_not_fail_the_request(self):
        with patch('farm.feedback.emails.EmailMessage.send', side_effect=OSError('smtp down')):
            response = self.client.post(FEEDBACK_URL, {
                'message': 'Mailserver ist offline.',
            }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['email_delivered'])
        self.assertEqual(Feedback.objects.count(), 1)


class FeedbackApiAuthTest(DRFAPITestCase):
    def test_anonymous_users_cannot_submit_feedback(self):
        response = self.client.post(FEEDBACK_URL, {'message': 'Hallo'}, format='json')

        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertEqual(Feedback.objects.count(), 0)
