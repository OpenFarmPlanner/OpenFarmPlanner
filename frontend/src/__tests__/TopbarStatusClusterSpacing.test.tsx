import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';
import { createAuthStateMock, createTestUser, stubCompactTopbarViewport } from '../test-utils/appHarness';

// The topbar's trailing items (season switcher, project switcher, notification
// bell, "Mehr" overflow menu) used to sit in gaps that differed by so little
// that the intended grouping was invisible: the cluster's buttons carry ~5px of
// horizontal padding per side, so ~10px of the perceived distance between two
// of them comes from padding rather than the gap, which swallowed the 4px vs
// 10px difference. These tests pin the full spacing hierarchy — cluster gap,
// the separation from the overflow menu, and the deliberately unchanged
// boundary towards the primary action button — plus the compact topbar, which
// has its own, tighter sub-group and must not inherit the desktop values.
const authState = createAuthStateMock();

vi.mock('../auth/useAuth', () => ({ useAuth: () => authState }));

function gapOf(element: Element): number {
  return Number.parseFloat(window.getComputedStyle(element).gap || '0');
}

function pixelsOf(element: Element, property: 'marginLeft' | 'paddingRight'): number {
  return Number.parseFloat(window.getComputedStyle(element)[property] || '0');
}

describe('topbar trailing status cluster spacing', () => {
  beforeEach(() => {
    authState.user = createTestUser();
    authState.activeProjectId = 1;
    window.localStorage.clear();
  });

  it('groups season switcher, project switcher and bell tighter than the overflow menu, without moving the primary action boundary', async () => {
    window.history.pushState({}, '', '/app/cultures');
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    const projectButton = await screen.findByRole('button', { name: 'Aktives Projekt wechseln' }, { timeout: 10000 });
    const cluster = projectButton.parentElement!;
    const overflowGroup = cluster.parentElement!;
    const actionGroup = overflowGroup.previousElementSibling!;

    expect(cluster).toContainElement(screen.getByRole('button', { name: 'Aktive Saison wechseln' }));
    expect(cluster).toContainElement(screen.getByRole('button', { name: /Benachrichtigungen/ }));
    expect(cluster).not.toContainElement(screen.getByRole('button', { name: 'Mehr' }));
    expect(overflowGroup).toContainElement(screen.getByRole('button', { name: 'Mehr' }));

    expect(gapOf(cluster)).toBe(4);
    expect(gapOf(overflowGroup)).toBe(16);
    expect(gapOf(cluster)).toBeLessThan(gapOf(overflowGroup));

    // The boundary towards the primary action button is the sum of these two
    // (the shared parent is a plain flex row without its own gap), and stays
    // wider than the cluster's inner gap so the cluster keeps reading as one
    // group from both sides.
    expect(gapOf(overflowGroup.parentElement!)).toBe(0);
    expect(pixelsOf(overflowGroup, 'marginLeft')).toBe(10);
    expect(pixelsOf(actionGroup, 'paddingRight')).toBe(4);
    expect(pixelsOf(overflowGroup, 'marginLeft') + pixelsOf(actionGroup, 'paddingRight'))
      .toBeGreaterThan(gapOf(cluster));
  });

  it('leaves the compact topbar spacing untouched', async () => {
    // Deliberately not the cultures page: its trailing group uses a
    // page-specific 0.25 gap, which would hide a regression of the shared
    // action-group gap this assertion is meant to catch.
    window.history.pushState({}, '', '/app/dashboard');
    stubCompactTopbarViewport();
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    // The compact topbar folds the notifications into its overflow menu, so
    // that button carries the notification label as soon as anything is unread.
    const menuButton = await screen.findByRole('button', { name: /Mehr|Benachrichtigung/ }, { timeout: 10000 });
    const compactGroup = menuButton.parentElement!;

    expect(compactGroup).toContainElement(screen.getByRole('button', { name: 'Aktive Saison wechseln' }));
    expect(screen.queryByRole('button', { name: 'Aktives Projekt wechseln' })).not.toBeInTheDocument();
    expect(gapOf(compactGroup)).toBe(2);
    expect(gapOf(compactGroup.parentElement!)).toBe(10);
  });
});
