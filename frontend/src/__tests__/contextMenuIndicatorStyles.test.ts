import { describe, expect, it } from 'vitest';
import { contextMenuActionsOverlaySx, contextMenuIndicatorHostSx } from '../components/contextMenu/contextMenuIndicatorStyles';

describe('contextMenuActionsOverlaySx', () => {
  it('stays hidden by default (base state, before any hover/focus selector matches)', () => {
    const sx = contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &');
    expect(sx.opacity).toBe(0);
    expect(sx.pointerEvents).toBe('none');
  });

  it('reveals on the given hover and focus-within selectors, but only for devices that can actually hover', () => {
    const sx = contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &') as Record<string, unknown>;
    const hoverMedia = sx['@media (hover: hover)'] as Record<string, unknown>;
    expect(hoverMedia).toBeDefined();
    expect(hoverMedia['tr:hover &']).toMatchObject({ opacity: 1, pointerEvents: 'auto' });
    expect(hoverMedia['tr:focus-within &']).toMatchObject({ opacity: 1, pointerEvents: 'auto' });
    // The bare (unguarded) selectors must not exist outside the media
    // query, or they'd reveal on touch too.
    expect(sx['tr:hover &']).toBeUndefined();
    expect(sx['tr:focus-within &']).toBeUndefined();
  });

  it('does not force the overlay visible on touch/coarse-pointer devices', () => {
    // Regression guard: a stray `@media (pointer: coarse)` override here
    // previously force-showed the edit/delete/context-menu icons on every
    // touch device, permanently overlapping and truncating row text even
    // though a long press already opens the same context menu directly.
    const sx = contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &') as Record<string, unknown>;
    expect(sx['@media (pointer: coarse)']).toBeUndefined();
  });

  it('supports a :has(:focus-visible) reveal selector for rows containing a link', () => {
    // Regression guard (Suppliers homepage links): a plain `tr:focus-within &`
    // selector keeps the edit/delete overlay latched open after a mouse click
    // moves focus into an in-row link, until the user clicks elsewhere.
    // Callers whose row holds such a control pass `tr:has(:focus-visible) &`
    // instead, so the overlay still reveals for keyboard navigation only.
    const focusVisibleSelector = 'tr:has(:focus-visible) &';
    const sx = contextMenuActionsOverlaySx('tr:hover &', focusVisibleSelector) as Record<string, unknown>;
    const hoverMedia = sx['@media (hover: hover)'] as Record<string, unknown>;
    expect(hoverMedia[focusVisibleSelector]).toMatchObject({ opacity: 1, pointerEvents: 'auto' });
    expect(Object.keys(sx)).not.toContain(focusVisibleSelector);
  });

  it('does not reveal from a tap-triggered focus on a touch device (only true hover-capable devices)', () => {
    // Regression guard: every row here also sets tabIndex, so a plain tap
    // on a touchscreen still satisfies bare `:focus-within` — without
    // wrapping the reveal in `@media (hover: hover)`, one tap would reveal
    // the icons exactly like a real desktop hover would.
    const sx = contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &') as Record<string, unknown>;
    const hoverMedia = sx['@media (hover: hover)'] as Record<string, unknown>;
    expect(Object.keys(sx)).not.toContain('tr:focus-within &');
    expect(hoverMedia['tr:focus-within &']).toBeDefined();
  });
});

describe('contextMenuIndicatorHostSx', () => {
  it('only reveals on hover/focus-within for devices that can actually hover (not a touch tap)', () => {
    const sx = contextMenuIndicatorHostSx as Record<string, unknown>;
    const hoverMedia = sx['@media (hover: hover)'] as Record<string, unknown> | undefined;
    expect(hoverMedia).toBeDefined();
    const revealKey = Object.keys(hoverMedia as Record<string, unknown>).find((key) => key.includes(':focus-within'));
    expect(revealKey).toBeDefined();
    expect((hoverMedia as Record<string, unknown>)[revealKey as string]).toMatchObject({ opacity: 1, pointerEvents: 'auto' });
  });
});
