import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import { Link as RouterLink } from 'react-router';
import type { TFunction } from 'i18next';

import type { CultureHistoryEntry } from '../api/types';
import {
  getBatchSummary,
  getHistoryEntryTarget,
  getHistoryEntryTitle,
  isBatchGroupEntry,
  isCurrentHistoryEntry,
} from '../pages/culturesHistoryUtils';

interface ProjectHistoryDialogProps {
  open: boolean;
  items: CultureHistoryEntry[];
  isPhonePortrait: boolean;
  fallbackActorLabel: string | undefined;
  formatTimestamp: (value: string) => string;
  onClose: () => void;
  onRestore: (entry: CultureHistoryEntry) => void;
  /** `navigation` namespace translator (also resolves `common:`/`navigation:`). */
  t: TFunction;
  tCultures: TFunction<'cultures'>;
}

/**
 * Presentational project version-history dialog. Cascading actions (season
 * delete/undelete, season data copy) arrive from the API pre-grouped into
 * `is_batch` entries carrying their individual revisions in `children`; those
 * render as one collapsible row whose expanded children keep their own
 * "restore" actions. Everything else renders flat, unchanged. State, data
 * loading and the restore handler live in RootLayout.tsx. German-only copy for
 * the non-batch parts is intentional, matching RestoreVersionDialog.
 */
export function ProjectHistoryDialog({
  open,
  items,
  isPhonePortrait,
  fallbackActorLabel,
  formatTimestamp,
  onClose,
  onRestore,
  t,
  tCultures,
}: ProjectHistoryDialogProps) {
  const [expandedBatchIds, setExpandedBatchIds] = useState<Record<number, boolean>>({});

  const toggleBatch = (batchId: number) => {
    setExpandedBatchIds((current) => ({ ...current, [batchId]: !current[batchId] }));
  };

  const actorOf = (entry: CultureHistoryEntry): string => (
    entry.actor_label?.trim()
    || entry.history_user?.trim()
    || fallbackActorLabel?.trim()
    || 'Unbekannter Benutzer'
  );

  const renderEntry = (
    entry: CultureHistoryEntry,
    { isCurrentVersion, nested }: { isCurrentVersion: boolean; nested: boolean },
  ) => {
    const historyTarget = getHistoryEntryTarget(entry);
    const title = getHistoryEntryTitle(entry, tCultures);
    const actorLabel = actorOf(entry);
    const timestampLabel = formatTimestamp(entry.history_date);
    const targetLink = historyTarget ? (
      <Link
        component={RouterLink}
        to={historyTarget}
        underline="hover"
        onClick={onClose}
        sx={isPhonePortrait ? { fontSize: '0.78rem', color: 'text.secondary', flexShrink: 0 } : undefined}
      >
        {entry.object_type === 'culture' ? tCultures('culture') : t('navigation:plantingPlans')}
      </Link>
    ) : null;

    if (isPhonePortrait) {
      return (
        <Paper variant="outlined" sx={{ width: '100%', p: 1.25, borderRadius: 1.5 }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              {isCurrentVersion
                ? <Chip label={t('versionHistory.currentChip')} size="small" color="success" variant="outlined" />
                : <Chip label={t('versionHistory.versionChip')} size="small" variant="outlined" />}
              {targetLink}
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                wordBreak: 'normal',
                overflowWrap: 'break-word',
              }}
            >
              {title}
            </Typography>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Von {actorLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                · {timestampLabel}
              </Typography>
            </Box>
            {isCurrentVersion && entry.action === 'restored' ? (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                Originalversion vom {formatTimestamp(entry.history_date)}
              </Typography>
            ) : null}
            {!isCurrentVersion ? (
              <>
                <Divider />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onRestore(entry)}
                  sx={{ alignSelf: 'flex-start', minHeight: 34 }}
                >
                  Version wiederherstellen
                </Button>
              </>
            ) : null}
          </Stack>
        </Paper>
      );
    }

    return (
      <Stack direction="row" spacing={2} sx={{ width: '100%', alignItems: 'flex-start', pl: nested ? 2 : 0 }}>
        <ListItemText
          sx={{ mr: 1 }}
          primary={(
            <>
              {title}
              {targetLink ? (
                <>
                  {' · '}
                  {targetLink}
                </>
              ) : null}
            </>
          )}
          secondary={(
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
              <Typography component="span" variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Von {actorLabel}
              </Typography>
              <Typography component="span" variant="caption" color="text.secondary">
                · {timestampLabel}
              </Typography>
            </Box>
          )}
        />
        {isCurrentVersion
          ? <Chip label={t('commandPalette.currentVersion')} size="small" color="success" variant="outlined" />
          : (
            <Button onClick={() => onRestore(entry)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              Version wiederherstellen
            </Button>
          )}
      </Stack>
    );
  };

  const renderBatchGroup = (entry: CultureHistoryEntry) => {
    const batchId = entry.batch_id ?? 0;
    const expanded = Boolean(expandedBatchIds[batchId]);
    const children = entry.children ?? [];
    return (
      <Stack spacing={1} sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
              {getBatchSummary(entry, tCultures)}
            </Typography>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Von {actorOf(entry)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                · {formatTimestamp(entry.history_date)}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={() => toggleBatch(batchId)}
            aria-expanded={expanded}
            aria-label={expanded
              ? tCultures('history.batch.collapseAria')
              : tCultures('history.batch.expandAria')}
          >
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transition: 'transform 160ms ease-in-out', transform: expanded ? 'rotate(180deg)' : 'none' }}
            />
          </IconButton>
        </Box>
        <Collapse in={expanded} unmountOnExit>
          <Stack
            spacing={1.5}
            sx={{ mt: 0.5, pl: isPhonePortrait ? 0 : 1, borderLeft: isPhonePortrait ? 0 : 2, borderColor: 'divider' }}
          >
            {children.map((child, childIndex) => (
              <Box key={child.history_id ?? childIndex}>
                {renderEntry(child, { isCurrentVersion: false, nested: true })}
              </Box>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('commandPalette.versionHistoryTitle')}</DialogTitle>
      <DialogContent sx={{ py: isPhonePortrait ? 1 : 2 }}>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {t('commandPalette.versionHistoryEmpty')}
          </Typography>
        ) : null}
        <List>
          {items.map((item, index) => {
            if (isBatchGroupEntry(item)) {
              return (
                <ListItem key={`batch-${item.batch_id}`} disableGutters sx={{ mb: isPhonePortrait ? 1 : 0.5 }}>
                  {renderBatchGroup(item)}
                </ListItem>
              );
            }
            const entry = item.is_batch && item.children?.length ? item.children[0] : item;
            return (
              <ListItem
                key={item.is_batch ? `batch-${item.batch_id}` : item.history_id}
                disableGutters
                sx={{ mb: isPhonePortrait ? 1 : 0 }}
              >
                {renderEntry(entry, { isCurrentVersion: isCurrentHistoryEntry(item, index), nested: false })}
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:actions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
