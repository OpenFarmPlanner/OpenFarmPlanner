"""Outbound email for in-app feedback."""

import logging

from django.conf import settings
from django.core.mail import EmailMessage

from farm.models import Feedback

logger = logging.getLogger(__name__)

CATEGORY_SUBJECT_LABELS: dict[str, str] = {
    Feedback.Category.BUG: 'Fehler',
    Feedback.Category.IDEA: 'Idee',
    Feedback.Category.QUESTION: 'Frage',
    Feedback.Category.OTHER: 'Sonstiges',
}


def build_feedback_subject(feedback: Feedback) -> str:
    """Build the `[Feedback] <category> – <project>` subject line.

    The subject is German on purpose: it is read by the OpenFarmPlanner team in
    the shared support inbox, mirroring the project invitation emails.
    """
    parts = [CATEGORY_SUBJECT_LABELS.get(feedback.category, 'Allgemein')]
    if feedback.project_name:
        parts.append(feedback.project_name)
    return f'[Feedback] {" – ".join(parts)}'


def build_feedback_body(feedback: Feedback) -> str:
    """Render the plain-text body of the feedback notification email."""
    user_label = getattr(feedback.user, 'email', '') or 'unbekannt'
    lines = [
        feedback.message,
        '',
        '---',
        f'Kategorie: {CATEGORY_SUBJECT_LABELS.get(feedback.category, "Allgemein")}',
        f'Projekt: {feedback.project_name or "-"}',
        f'Ansicht: {feedback.route or "-"}',
        f'Browser: {feedback.browser_info or "-"}',
        f'Zeitpunkt: {feedback.created_at:%d.%m.%Y %H:%M}',
        f'Konto: {user_label}',
    ]
    if feedback.contact_consent and feedback.contact_email:
        lines.append(f'Rückmeldung erlaubt an: {feedback.contact_email}')
    else:
        lines.append('Rückmeldung erlaubt: nein')
    return '\n'.join(lines)


def send_feedback_email(feedback: Feedback) -> bool:
    """Send the feedback to the support inbox; return whether it was delivered.

    A failed delivery is logged and reported to the caller, but never raises:
    the feedback row is already stored and must not be lost.
    """
    message = EmailMessage(
        subject=build_feedback_subject(feedback),
        body=build_feedback_body(feedback),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.SUPPORT_CONTACT_EMAIL],
        # Only when the user allowed contact, so replying in the inbox reaches
        # them directly instead of the support address.
        reply_to=(
            [feedback.contact_email]
            if feedback.contact_consent and feedback.contact_email
            else None
        ),
    )
    try:
        sent_count = message.send(fail_silently=False)
    except Exception:  # noqa: BLE001
        logger.exception('Feedback email could not be sent', extra={'feedback_id': feedback.id})
        return False
    if sent_count == 0:
        logger.error(
            'Feedback email backend returned zero deliveries',
            extra={'feedback_id': feedback.id},
        )
        return False
    return True
