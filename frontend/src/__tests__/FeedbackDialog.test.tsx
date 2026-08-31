import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackDialog } from '../components/feedback/FeedbackDialog';

const submitMock = vi.fn();

vi.mock('../api/api', () => ({
  feedbackAPI: {
    submit: (payload: unknown) => submitMock(payload),
  },
}));

const baseProps = {
  open: true,
  projectName: 'Gemüsebetrieb Kraienhemke',
  route: '/app/planting-plans',
  userEmail: 'bauer@example.com',
  onClose: vi.fn(),
};

describe('FeedbackDialog', () => {
  beforeEach(() => {
    submitMock.mockReset();
    submitMock.mockResolvedValue({ data: { id: 1, email_delivered: true } });
  });

  it('shows the automatically transmitted context with the real project and route', () => {
    render(<FeedbackDialog {...baseProps} />);

    expect(screen.getByText(/Projekt „Gemüsebetrieb Kraienhemke“/)).toBeInTheDocument();
    expect(screen.getByText(/Ansicht „\/app\/planting-plans“/)).toBeInTheDocument();
  });

  it('keeps the submit button disabled while the message is empty', async () => {
    render(<FeedbackDialog {...baseProps} />);

    const submit = screen.getByRole('button', { name: 'Absenden' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), 'Hallo');
    expect(submit).toBeEnabled();
  });

  it('only reveals and sends the account email when contact is allowed', async () => {
    render(<FeedbackDialog {...baseProps} />);

    expect(screen.queryByText(/bauer@example.com/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('bauer@example.com (aus deinem Konto)')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'Bitte melden');
    await userEvent.click(screen.getByRole('button', { name: 'Absenden' }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock.mock.calls[0][0]).toMatchObject({
      contact_consent: true,
      message: 'Bitte melden',
      project_name: 'Gemüsebetrieb Kraienhemke',
      route: '/app/planting-plans',
      category: '',
    });
  });

  it('sends the selected category and shows the success state', async () => {
    render(<FeedbackDialog {...baseProps} />);

    await userEvent.click(screen.getByRole('button', { name: 'Fehler' }));
    await userEvent.type(screen.getByRole('textbox'), 'Etwas klemmt');
    await userEvent.click(screen.getByRole('button', { name: 'Absenden' }));

    await waitFor(() => expect(screen.getByText('Danke für dein Feedback!')).toBeInTheDocument());
    expect(submitMock.mock.calls[0][0]).toMatchObject({ category: 'bug', contact_consent: false });
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
  });

  it('clears the category when the selected chip is clicked again', async () => {
    render(<FeedbackDialog {...baseProps} />);

    const bugChip = screen.getByRole('button', { name: 'Fehler' });
    await userEvent.click(bugChip);
    expect(bugChip).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(bugChip);
    expect(bugChip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.type(screen.getByRole('textbox'), 'Etwas klemmt');
    await userEvent.click(screen.getByRole('button', { name: 'Absenden' }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock.mock.calls[0][0]).toMatchObject({ category: '' });
  });

  it('keeps the entered message and allows retrying when sending fails', async () => {
    submitMock.mockRejectedValueOnce(new Error('network'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<FeedbackDialog {...baseProps} />);

    await userEvent.type(screen.getByRole('textbox'), 'Zweiter Versuch');
    await userEvent.click(screen.getByRole('button', { name: 'Absenden' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Dein Feedback konnte nicht gesendet werden. Bitte versuche es noch einmal.',
    ));
    expect(screen.getByRole('textbox')).toHaveValue('Zweiter Versuch');

    await userEvent.click(screen.getByRole('button', { name: 'Absenden' }));
    await waitFor(() => expect(screen.getByText('Danke für dein Feedback!')).toBeInTheDocument());
  });
});
