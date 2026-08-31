import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
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
  onRevertBatch: (entry: CultureHistoryEntry) => void;
  /** `navigation` namespace translator (also resolves `common:`/`navigation:`). */
  t: TFunction;
  tCultures: TFunction<'cultures'>;
}

/**
 * Presentational project version-history dialog. A cascading action (season
 * create/delete/undelete/data-copy) arrives from the API as one `is_batch`
 * entry that renders as a single row with a single "rückgängig machen"; every
 * other revision renders flat with "Version wiederherstellen". State, data
 * loading and the action handlers live in RootLayout.tsx. German-only copy is
 * intentional, matching RestoreVersionDialog.
 */
export function ProjectHistoryDialog({
  open,
  items,
  isPhonePortrait,
  fallbackActorLabel,
  formatTimestamp,
  onClose,
  onRestore,
  onRevertBatch,
  t,
  tCultures,
}: ProjectHistoryDialogProps) {
  const actorOf = (entry: CultureHistoryEntry): string => (
    entry.actor_label?.trim()
    || entry.history_user?.trim()
    || fallbackActorLabel?.trim()
    || 'Unbekannter Benutzer'
  );

  const renderBatchMeta = (entry: CultureHistoryEntry) => (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        Von {actorOf(entry)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        · {formatTimestamp(entry.history_date)}
      </Typography>
    </Box>
  );

  const renderBatchGroup = (entry: CultureHistoryEntry) => {
    const summary = getBatchSummary(entry, tCultures);
    const isRevertEntry = entry.batch_operation_type === 'batch_reverted';
    const action = entry.batch_reverted ? (
      <Chip label={tCultures('history.batch.revertedChip')} size="small" color="success" variant="outlined" />
    ) : isRevertEntry ? null : (
      <Button
        onClick={() => onRevertBatch(entry)}
        size={isPhonePortrait ? 'small' : 'medium'}
        variant={isPhonePortrait ? 'outlined' : 'text'}
        sx={{ whiteSpace: 'nowrap', flexShrink: 0, alignSelf: isPhonePortrait ? 'flex-start' : undefined }}
      >
        {tCultures('history.batch.revertButton')}
      </Button>
    );

    if (isPhonePortrait) {
      return (
        <Paper variant="outlined" sx={{ width: '100%', p: 1.25, borderRadius: 1.5 }}>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>{summary}</Typography>
            {renderBatchMeta(entry)}
            {action ? <><Divider />{action}</> : null}
          </Stack>
        </Paper>
      );
    }
    return (
      <Stack direction="row" spacing={2} sx={{ width: '100%', alignItems: 'flex-start' }}>
        <ListItemText
          sx={{ mr: 1 }}
          disableTypography
          primary={<Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>{summary}</Typography>}
          secondary={renderBatchMeta(entry)}
        />
        {action}
      </Stack>
    );
  };

  const renderEntry = (
    entry: CultureHistoryEntry,
    { isCurrentVersion }: { isCurrentVersion: boolean },
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
      <Stack direction="row" spacing={2} sx={{ width: '100%', alignItems: 'flex-start' }}>
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
          {items.map((item, index) => (
            <ListItem
              key={isBatchGroupEntry(item) ? `batch-${item.batch_id}` : item.history_id}
              disableGutters
              sx={{ mb: isPhonePortrait ? 1 : 0 }}
            >
              {isBatchGroupEntry(item)
                ? renderBatchGroup(item)
                : renderEntry(item, { isCurrentVersion: isCurrentHistoryEntry(item, index) })}
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:actions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
