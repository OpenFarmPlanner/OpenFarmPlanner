import type { ReactElement } from 'react';
import { Divider } from '@mui/material';

interface GroupedContextMenuAction {
  id: string;
  /** Actions with different group names are separated by a divider. */
  group?: string;
}

/**
 * Render context-menu actions with a divider wherever the group changes.
 * Callers keep their own item markup — the menus differ in what an item looks
 * like (plain `MenuItem`, `ContextMenuActionItem` with icons and shortcut
 * hints), not in where the separators go.
 */
export function renderGroupedContextMenuActions<Action extends GroupedContextMenuAction>(
  actions: readonly Action[],
  renderAction: (action: Action) => ReactElement,
): ReactElement[] {
  return actions.flatMap((action, index) => {
    const previousAction = actions[index - 1];
    const startsNewGroup = previousAction !== undefined && previousAction.group !== action.group;
    const item = renderAction(action);

    return startsNewGroup
      ? [<Divider key={`${action.id}-divider`} role="separator" />, item]
      : [item];
  });
}
