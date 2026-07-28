/**
 * Behaviour of the public and account language switchers.
 *
 * Covers what the spec requires of them: switching updates the UI immediately,
 * the choice is persisted and survives a reload, an explicit choice is never
 * silently overwritten by the browser language, and a signed-in user's stored
 * preference is loaded and saved through the account API.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountLanguageSelect, PublicLanguageSwitcher } from '../i18n/LanguageSwitcher';
import { AUTO_LANGUAGE, LANGUAGE_STORAGE_KEY, readStoredLanguagePreference } from '../i18n/languages';
import i18n from '../i18n/config';
import { AuthContext, type AuthContextValue } from '../auth/authContextShared';
import type { AuthUser } from '../auth/types';

const updateUiLanguage = vi.hoisted(() => vi.fn(async () => ({ ui_language: 'en', user: {} as AuthUser })));

vi.mock('../auth/authApi', () => ({ updateUiLanguage }));

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 7,
    email: 'grower@example.com',
    display_name: 'Grower',
    display_label: 'Grower',
    public_display_name: '',
    is_active: true,
    default_project_id: null,
    last_project_id: null,
    resolved_project_id: null,
    needs_project_selection: false,
    memberships: [],
    account_pending_deletion: false,
    scheduled_deletion_at: null,
    pending_consents: [],
    public_library_terms_accepted: true,
    is_guest_demo: false,
    guest_demo_session_id: null,
    has_password: true,
    ...overrides,
  };
}

function renderWithAuth(ui: React.ReactElement, user: AuthUser | null, refreshUser = vi.fn(async () => user)) {
  const value = { user, refreshUser } as unknown as AuthContextValue;
  return render(<AuthContext.Provider value={value}>{ui}</AuthContext.Provider>);
}

beforeEach(() => {
  updateUiLanguage.mockClear();
});

afterEach(async () => {
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  await i18n.changeLanguage('de');
});

describe('PublicLanguageSwitcher', () => {
  it('shows the active language and switches the UI immediately', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PublicLanguageSwitcher />, null);

    const trigger = screen.getByRole('button', { name: /Deutsch/ });
    expect(trigger).toHaveTextContent('Deutsch');

    await user.click(trigger);
    await user.click(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: 'English' }));

    await waitFor(() => expect(i18n.resolvedLanguage).toBe('en'));
    expect(screen.getByRole('button')).toHaveTextContent('English');
  });

  it('persists a guest choice so it survives a reload', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PublicLanguageSwitcher />, null);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));

    await waitFor(() => expect(readStoredLanguagePreference()).toBe('en'));
    // Guests are not asked to sign in just to keep a language.
    expect(updateUiLanguage).not.toHaveBeenCalled();
  });

  it('keeps a stored choice instead of following the browser language', async () => {
    // The suite reports de-DE as the browser language (see setupTests).
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderWithAuth(<PublicLanguageSwitcher />, null);

    await waitFor(() => expect(i18n.resolvedLanguage).toBe('en'));
    expect(screen.getByRole('button')).toHaveTextContent('English');
  });

  it('marks the active language for assistive technology, not by colour alone', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PublicLanguageSwitcher />, null);

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('menuitemradio', { name: 'Deutsch' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'false');
  });

  it('is reachable and operable by keyboard', async () => {
    const user = userEvent.setup();
    renderWithAuth(<PublicLanguageSwitcher />, null);

    const trigger = screen.getByRole('button');
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('gives the trigger an accessible name that says what it does', () => {
    renderWithAuth(<PublicLanguageSwitcher />, null);

    expect(screen.getByRole('button')).toHaveAccessibleName('Sprache ändern, aktuell: Deutsch');
  });
});

describe('AccountLanguageSelect', () => {
  it("loads the signed-in user's stored preference", () => {
    renderWithAuth(<AccountLanguageSelect />, buildUser({ ui_language: 'en' }));

    expect(screen.getByRole('combobox')).toHaveTextContent('English');
  });

  it('saves a change to the account and applies it right away', async () => {
    const user = userEvent.setup();
    const refreshUser = vi.fn(async () => buildUser({ ui_language: 'en' }));
    renderWithAuth(<AccountLanguageSelect />, buildUser({ ui_language: AUTO_LANGUAGE }), refreshUser);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'English' }));

    await waitFor(() => expect(updateUiLanguage).toHaveBeenCalledWith('en'));
    await waitFor(() => expect(i18n.resolvedLanguage).toBe('en'));
  });

  it('offers the automatic option that follows the browser language', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AccountLanguageSelect />, buildUser({ ui_language: AUTO_LANGUAGE }));

    expect(screen.getByRole('combobox')).toHaveTextContent('Automatisch (Browsersprache)');

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Deutsch' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
  });

  it("lets the account preference win over a stale local value", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    renderWithAuth(<AccountLanguageSelect />, buildUser({ ui_language: 'en' }));

    await waitFor(() => expect(i18n.resolvedLanguage).toBe('en'));
    // ...and the account value is cached locally so the next load starts
    // in the right language instead of flashing the wrong one.
    await waitFor(() => expect(readStoredLanguagePreference()).toBe('en'));
  });

  it('promotes a guest choice to an account that has no explicit preference', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderWithAuth(<AccountLanguageSelect />, buildUser({ ui_language: AUTO_LANGUAGE }));

    await waitFor(() => expect(updateUiLanguage).toHaveBeenCalledWith('en'));
  });

  it('does not overwrite an explicit account preference with the local value', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    renderWithAuth(<AccountLanguageSelect />, buildUser({ ui_language: 'en' }));

    await waitFor(() => expect(i18n.resolvedLanguage).toBe('en'));
    expect(updateUiLanguage).not.toHaveBeenCalled();
  });
});
