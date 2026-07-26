import { describe, expect, it } from 'vitest';
import { contextMenuActionsOverlaySx } from '../components/contextMenu/contextMenuIndicatorStyles';

describe('contextMenuActionsOverlaySx', () => {
  it('stays hidden by default (base state, before any hover/focus selector matches)', () => {
    const sx = contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &');
    expect(sx.opacity).toBe(0);
    expect(sx.pointerEvents).toBe('none');
  });

  it('reveals on the given hover and focus-within selectors', () => {
    const sx = contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &') as Record<string, unknown>;
    expect(sx['tr:hover &']).toMatchObject({ opacity: 1, pointerEvents: 'auto' });
    expect(sx['tr:focus-within &']).toMatchObject({ opacity: 1, pointerEvents: 'auto' });
  });

  it('does not force the overlay visible on touch/coarse-pointer devices', () => {
    // Regression guard: a stray `@media (pointer: coarse)` override here
    // previously force-showed the edit/delete/context-menu icons on every
    // touch device, permanently overlapping and truncating row text even
    // though a long press already opens the same context menu directly.
    const sx = contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &') as Record<string, unknown>;
    expect(sx['@media (pointer: coarse)']).toBeUndefined();
  });
});
