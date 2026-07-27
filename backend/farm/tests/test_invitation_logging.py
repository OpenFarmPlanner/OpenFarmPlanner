"""Tests ensuring invitation tokens are not written verbatim to logs (CWE-532)."""

from django.test import SimpleTestCase, TestCase

from farm.services.project_invitations import (
    InvitationFlowError,
    _mask_token,
    get_invitation_by_token,
)


class MaskTokenTest(SimpleTestCase):
    def test_masks_long_token_to_short_prefix(self):
        token = 'abcdef0123456789verylongtoken'
        masked = _mask_token(token)
        self.assertNotEqual(masked, token)
        self.assertNotIn('0123456789', masked)
        self.assertTrue(masked.startswith('abcdef'))

    def test_short_or_empty_tokens_are_fully_hidden(self):
        self.assertEqual(_mask_token(''), '***')
        self.assertEqual(_mask_token(None), '***')
        self.assertEqual(_mask_token('short'), '***')


class InvitationTokenLoggingTest(TestCase):
    def test_failed_lookup_does_not_log_raw_token(self):
        raw_token = 'super-secret-invitation-token-value-1234567890'
        with self.assertLogs('farm.services.project_invitations', level='WARNING') as captured:
            with self.assertRaises(InvitationFlowError):
                get_invitation_by_token(raw_token)

        joined = '\n'.join(captured.output)
        # The full bearer token must never appear in log output.
        self.assertNotIn(raw_token, joined)
