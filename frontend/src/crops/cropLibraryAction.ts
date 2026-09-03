import type { Crop } from '../api/types';
import type { PublicCropUpdateController } from './usePublicCropUpdate';

/**
 * The single public-library action shown in the crop detail badge row. One
 * button whose label, colour, enabled state and target change with context —
 * it replaced the header overflow entry, the "Update verfügbar" banner and the
 * sync marker chip.
 */
export type CropLibraryActionKind = 'publish' | 'pullUpdate' | 'pushUpdate' | 'upToDate';

export interface CropLibraryAction {
  kind: CropLibraryActionKind;
  /** i18n key under the `library` namespace for the button label. */
  labelKey: string;
  /** MUI button colour: `primary` (green) for publish/push, `info` (blue) for a pull. */
  color: 'primary' | 'info';
  disabled: boolean;
  /** i18n key under `library` for the explanatory tooltip, or null when there is none. */
  tooltipKey: string | null;
  /**
   * `publish` opens the publishing wizard (it already routes an owned-entry
   * update through its own flow); `diff` opens the pull diff/apply dialog;
   * `null` when the button is inert.
   */
  trigger: 'publish' | 'diff' | null;
}

/**
 * Resolves the button state. Priority order (first match wins):
 *
 * 1. Not connected to any public entry -> publish.
 * 2. The library is ahead (`public_update_available`, or a version the user
 *    declined — `public_update_rejected`; both surface as
 *    `controller.isDiverged`) -> pull. Wins over any push offer: while the
 *    library is ahead, a push is never offered at the same time.
 * 3./4. Connected (own entry or imported) with local changes to contribute
 *    -> push. `public_publish_blocked_reason` is `null` exactly then; the
 *    `update_pending` / `update_rejected` reasons always coincide with case 2
 *    and are handled there.
 * 5. Connected, nothing pending and nothing to contribute -> a plain "Aktuell"
 *    status chip, not a button (there is no action to offer).
 *
 * A crop species still awaiting moderation freezes library sync, so cases 2-4
 * render disabled with the existing "proposal under review" tooltip instead.
 */
export function resolveCropLibraryAction(
  crop: Crop | null | undefined,
  controller: Pick<PublicCropUpdateController, 'isDiverged'>,
): CropLibraryAction {
  const linked = Boolean(crop?.owned_public_crop_id || crop?.source_public_crop);
  const speciesPending = Boolean(crop?.public_crop_species_pending);
  const frozenTooltipKey = speciesPending ? 'badges.speciesPendingTooltip' : null;

  if (!linked) {
    return {
      kind: 'publish',
      labelKey: 'libraryAction.publish',
      color: 'primary',
      disabled: false,
      tooltipKey: 'libraryAction.publishTooltip',
      trigger: 'publish',
    };
  }

  if (controller.isDiverged) {
    return {
      kind: 'pullUpdate',
      labelKey: 'libraryAction.pullUpdate',
      color: 'info',
      disabled: speciesPending,
      tooltipKey: frozenTooltipKey ?? 'libraryAction.pullUpdateTooltip',
      trigger: speciesPending ? null : 'diff',
    };
  }

  if (crop?.public_publish_blocked_reason == null) {
    return {
      kind: 'pushUpdate',
      labelKey: 'libraryAction.pushUpdate',
      color: 'primary',
      disabled: speciesPending,
      tooltipKey: frozenTooltipKey ?? 'libraryAction.pushUpdateTooltip',
      trigger: speciesPending ? null : 'publish',
    };
  }

  return {
    kind: 'upToDate',
    labelKey: 'publicUpdate.markerUpToDateLabel',
    color: 'info',
    disabled: true,
    tooltipKey: 'publicUpdate.markerUpToDateTooltip',
    trigger: null,
  };
}
