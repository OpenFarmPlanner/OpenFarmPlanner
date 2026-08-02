import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useTranslation } from '../../i18n';
import { AppTooltip } from '../AppTooltip';

/**
 * Shared expand/collapse-one-level buttons for hierarchical Standort/Parzelle/
 * Beet tree views (Anbauflächen, Anbaukalender). Steps relative to the tree's
 * current expansion state (see useHierarchyLevelToggle) instead of exposing
 * one button per absolute depth, so it works the same way whether a
 * project's hierarchy has 2 levels (single-location projects) or 3+.
 *
 * Deliberately styled as a secondary, low-emphasis tool (muted "−"/"+"
 * icon-only buttons) rather than as a primary action button like "Standort
 * hinzufügen". Embedded directly into an existing table/list header (the
 * "Name" column header in FieldsBedsHierarchy, the task-list header in
 * GanttChart) instead of occupying its own row.
 */
export interface HierarchyLevelButtonsProps {
  canExpand: boolean;
  canCollapse: boolean;
  onExpandOneLevel: () => void;
  onCollapseOneLevel: () => void;
}

const levelButtonSx = {
  minWidth: 0,
  px: 0.75,
  py: 0.25,
  color: 'text.secondary',
  borderColor: 'divider',
  '&:hover': {
    borderColor: 'text.secondary',
    backgroundColor: 'action.hover',
  },
};

export function HierarchyLevelButtons({
  canExpand,
  canCollapse,
  onExpandOneLevel,
  onCollapseOneLevel,
}: HierarchyLevelButtonsProps) {
  const { t } = useTranslation('common');
  const expandTooltip = t('hierarchyLevelToggle.expandTooltip');
  const collapseTooltip = t('hierarchyLevelToggle.collapseTooltip');

  return (
    <Box
      sx={{ display: 'inline-flex', gap: 0.5, flexShrink: 0 }}
      // Keeps clicks on these buttons from also triggering the "Name"
      // column's own sort-toggle click handler when embedded in its header.
      onClick={(event) => event.stopPropagation()}
    >
      <AppTooltip title={collapseTooltip}>
        <span>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={onCollapseOneLevel}
            disabled={!canCollapse}
            aria-label={collapseTooltip}
            sx={levelButtonSx}
          >
            <RemoveIcon fontSize="small" />
          </Button>
        </span>
      </AppTooltip>
      <AppTooltip title={expandTooltip}>
        <span>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={onExpandOneLevel}
            disabled={!canExpand}
            aria-label={expandTooltip}
            sx={levelButtonSx}
          >
            <AddIcon fontSize="small" />
          </Button>
        </span>
      </AppTooltip>
    </Box>
  );
}
