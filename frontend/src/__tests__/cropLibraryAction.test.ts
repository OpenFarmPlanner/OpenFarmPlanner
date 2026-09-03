import { describe, expect, it } from 'vitest';
import type { Crop } from '../api/types';
import { resolveCropLibraryAction } from '../crops/cropLibraryAction';

const diverged = { isDiverged: true };
const inSync = { isDiverged: false };

const crop = (over: Partial<Crop> = {}): Crop => ({
  name: 'Tomate',
  variety: 'Roma',
  is_modified_from_source: false,
  ...over,
});

describe('resolveCropLibraryAction', () => {
  it('state 1: not linked to any public entry -> publish', () => {
    const action = resolveCropLibraryAction(crop({ crop_species: 3 }), inSync);
    expect(action).toMatchObject({
      kind: 'publish',
      labelKey: 'libraryAction.publish',
      color: 'primary',
      disabled: false,
      tooltipKey: 'libraryAction.publishTooltip',
      trigger: 'publish',
    });
  });

  it('state 2: library is ahead -> pull, blue, opens the diff', () => {
    const action = resolveCropLibraryAction(
      crop({ source_public_crop: 9, public_update_available: true }),
      diverged,
    );
    expect(action).toMatchObject({
      kind: 'pullUpdate',
      labelKey: 'libraryAction.pullUpdate',
      color: 'info',
      disabled: false,
      tooltipKey: 'libraryAction.pullUpdateTooltip',
      trigger: 'diff',
    });
  });

  it('state 2 also covers a declined newer version (isDiverged via rejection)', () => {
    const action = resolveCropLibraryAction(
      crop({
        source_public_crop: 9,
        owned_public_crop_id: 9,
        owned_public_crop_role: 'contributor',
        public_update_available: false,
        public_update_rejected: true,
        public_publish_blocked_reason: 'update_rejected',
      }),
      diverged,
    );
    expect(action.kind).toBe('pullUpdate');
    expect(action.trigger).toBe('diff');
  });

  it('state 2 wins over a push offer: local changes AND library ahead -> pull', () => {
    const action = resolveCropLibraryAction(
      crop({
        owned_public_crop_id: 9,
        owned_public_crop_role: 'contributor',
        public_update_available: true,
        public_publish_blocked_reason: null,
        is_modified_from_source: true,
      }),
      diverged,
    );
    expect(action.kind).toBe('pullUpdate');
  });

  it('state 3: own entry with local changes -> push, green', () => {
    const action = resolveCropLibraryAction(
      crop({
        owned_public_crop_id: 9,
        owned_public_crop_role: 'contributor',
        public_publish_blocked_reason: null,
      }),
      inSync,
    );
    expect(action).toMatchObject({
      kind: 'pushUpdate',
      labelKey: 'libraryAction.pushUpdate',
      color: 'primary',
      disabled: false,
      tooltipKey: 'libraryAction.pushUpdateTooltip',
      trigger: 'publish',
    });
  });

  it('state 4: imported (not owned) with local changes -> same push', () => {
    const action = resolveCropLibraryAction(
      crop({
        source_public_crop: 9,
        owned_public_crop_role: null,
        is_modified_from_source: true,
        public_publish_blocked_reason: null,
      }),
      inSync,
    );
    expect(action).toMatchObject({ kind: 'pushUpdate', trigger: 'publish', color: 'primary' });
  });

  it('state 5: linked, nothing pending, nothing to contribute -> "Aktuell" status', () => {
    const action = resolveCropLibraryAction(
      crop({
        source_public_crop: 9,
        public_publish_blocked_reason: 'no_local_changes',
      }),
      inSync,
    );
    expect(action).toMatchObject({
      kind: 'upToDate',
      labelKey: 'publicUpdate.markerUpToDateLabel',
      tooltipKey: 'publicUpdate.markerUpToDateTooltip',
      trigger: null,
    });
  });

  it('state 5: an imported copy that matches its source (version-only bump) -> "Aktuell"', () => {
    // The backend reports no_local_changes for an imported, not-owned copy
    // whose content equals its public source, and does not flag an update for
    // a bump with no compared-field change.
    const action = resolveCropLibraryAction(
      crop({
        source_public_crop: 9,
        is_modified_from_source: true,
        public_update_available: false,
        public_publish_blocked_reason: 'no_local_changes',
      }),
      inSync,
    );
    expect(action.kind).toBe('upToDate');
    expect(action.trigger).toBeNull();
  });

  it('freezes the button while the crop species is still under moderation', () => {
    const pull = resolveCropLibraryAction(
      crop({ source_public_crop: 9, public_update_available: true, public_crop_species_pending: true }),
      diverged,
    );
    expect(pull).toMatchObject({
      kind: 'pullUpdate',
      disabled: true,
      tooltipKey: 'badges.speciesPendingTooltip',
      trigger: null,
    });

    const push = resolveCropLibraryAction(
      crop({
        owned_public_crop_id: 9,
        owned_public_crop_role: 'contributor',
        public_publish_blocked_reason: null,
        public_crop_species_pending: true,
      }),
      inSync,
    );
    expect(push).toMatchObject({ kind: 'pushUpdate', disabled: true, trigger: null });
  });
});
