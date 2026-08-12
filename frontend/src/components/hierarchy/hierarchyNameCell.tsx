import { Box, IconButton } from '@mui/material';
import type { GridRenderCellParams } from '@mui/x-data-grid';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { TFunction } from 'i18next';
import type { HierarchyRow } from './utils/types';
import { contextMenuActionsOverlaySx } from '../contextMenu/contextMenuIndicatorStyles';
import { renderInlineActions } from './hierarchyRowActions';
import {
  NON_BLOCKING_TOOLTIP_PROPS,
  type HierarchyColumnOptions,
  type NameCellCallbacks,
} from './hierarchyColumnShared';
import { AppTooltip } from '../AppTooltip';

const EXPAND_ICON_SLOT_SIZE = 32;

export function renderNameCell(
  params: GridRenderCellParams<HierarchyRow>,
  callbacks: NameCellCallbacks,
  t: TFunction,
  options: HierarchyColumnOptions,
) {
  const row = params.row;
  const baseIndent = row.level * 24;
  const hasChildren = row.hasChildren === true;
  const hasExpandToggle = (row.type === 'location' || row.type === 'field') && hasChildren;
  const isStandaloneRender = params.api === undefined;
  const inlineActions = renderInlineActions(row, callbacks, t, options, isStandaloneRender);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: `${baseIndent}px`, width: '100%', gap: 0.5 }}>
      <Box
        sx={{
          width: EXPAND_ICON_SLOT_SIZE,
          minWidth: EXPAND_ICON_SLOT_SIZE,
          height: EXPAND_ICON_SLOT_SIZE,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 1,
          pointerEvents: hasExpandToggle ? 'auto' : 'none',
        }}
        data-testid="expand-icon-slot"
      >
        {hasExpandToggle ? (
          <AppTooltip title={row.expanded ? t('tooltips.collapse') : t('tooltips.expand')} {...NON_BLOCKING_TOOLTIP_PROPS}>
            <IconButton
              size="small"
              aria-label={row.expanded ? t('tooltips.collapse') : t('tooltips.expand')}
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                callbacks.onToggleExpand(row.id);
              }}
            >
              {row.expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
            </IconButton>
          </AppTooltip>
        ) : (
          <Box
            aria-hidden="true"
            sx={{ width: EXPAND_ICON_SLOT_SIZE, height: EXPAND_ICON_SLOT_SIZE, visibility: 'hidden' }}
          >
            <ChevronRightIcon />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
        }}
        onContextMenu={(event) => {
          callbacks.onOpenContextMenu(event, row);
        }}
      >
        <Box
          component="span"
          data-testid="hierarchy-name-text"
          sx={{
            display: 'block',
            flex: '1 1 auto',
            minWidth: 0,
            width: '100%',
            maxWidth: 'none',
            boxSizing: 'border-box',
            fontWeight: row.type === 'location' ? 600 : 400,
            fontSize: row.type === 'location' ? '1.02rem' : row.type === 'bed' ? '0.95rem' : '1rem',
            color: 'text.primary',
            bgcolor: 'transparent',
            borderRadius: 0.5,
            px: row.type === 'bed' ? 0.5 : 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {params.value}
        </Box>

        {inlineActions ? (
          <Box
            data-testid="hierarchy-name-actions-overlay"
            sx={{
              ...contextMenuActionsOverlaySx('.MuiDataGrid-row:hover &'),
              ...(isStandaloneRender ? { opacity: 1, pointerEvents: 'auto' } : {}),
              '.MuiDataGrid-row--editing:hover &': { opacity: 0, pointerEvents: 'none' },
            }}
          >
            {inlineActions}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
