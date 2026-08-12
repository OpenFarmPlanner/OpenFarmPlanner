import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HelpDialog } from '../components/help/HelpDialog';
import helpDE from '../i18n/locales/de/help.json';

describe('HelpDialog', () => {
  it('renders every configured section and the workflow line from the current translations', async () => {
    render(<HelpDialog open onClose={vi.fn()} />);

    expect(await screen.findByText(helpDE.globalTitle)).toBeInTheDocument();

    for (const section of helpDE.sections) {
      expect(screen.getByText(section.title)).toBeInTheDocument();
    }

    expect(screen.getByText(helpDE.workflow)).toBeInTheDocument();
  });
});
