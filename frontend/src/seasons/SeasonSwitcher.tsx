import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import axios from 'axios';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { Season } from '../api/types';
import { useTranslation } from '../i18n';
import type { UseActiveSeasonReturn } from './useActiveSeason';
import { SeasonRowActionsMenu } from './SeasonRowActionsMenu';
import { SeasonRenameDialog } from './SeasonRenameDialog';
import { SeasonCopyDataDialog } from './SeasonCopyDataDialog';
import { computeSeasonLabel, formatSeasonPeriod, resolveSeasonDateLocale } from './formatSeasonDate';
import { SEASON_SWITCHER_EMOJI } from '../navigation/navigationIconEmoji';
import { NavEmojiIcon } from '../navigation/NavEmojiIcon';
import { DeleteUndoSnackbar } from '../components/data-grid';
import { extractApiErrorMessage } from '../api/errors';

interface SeasonSwitcherProps {
  controller: UseActiveSeasonReturn;
  onOpenProjectSettings: () => void;
  onOpenCreateSuggestion: () => void;
  isPhone?: boolean;
  buttonPx?: number;
}

interface SeasonConflictPayload {
  code?: string | string[];
  conflict_count?: number | string | Array<number | string>;
  conflicts?: Array<{ label?: string }>;
}

interface SeasonCreateSuggestionDialogProps {
  controller: UseActiveSeasonReturn;
  open: boolean;
  onClose: () => void;
  /**
   * Close the dialog (no season is created) and open the project settings page
   * scrolled to the season-pattern section.
   */
  onEditSeasonPattern: () => void;
}

function getSeasonCreateErrorMessage(
  error: unknown,
  fallbackMessage: string,
  suggestedPeriod: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as SeasonConflictPayload | undefined;
    const code = data ? (Array.isArray(data.code) ? data.code[0] : data.code) : undefined;
    if (data && code === 'season_unassigned_data_outside_period') {
      const examples = data.conflicts
        ?.map((conflict) => conflict.label)
        .filter((label): label is string => Boolean(label))
        .join(', ');
      const conflictCount = Array.isArray(data.conflict_count)
        ? data.conflict_count[0]
        : data.conflict_count;
      return t('navigation:seasonSwitcher.suggestion.outOfRangeError', {
        count: Number(conflictCount ?? data.conflicts?.length ?? 0),
        period: suggestedPeriod,
        examples: examples || t('navigation:seasonSwitcher.suggestion.outOfRangeFallbackExamples'),
      });
    }
  }
  return extractApiErrorMessage(error, t, fallbackMessage);
}

export function SeasonCreateSuggestionDialog({
  controller,
  open,
  onClose,
  onEditSeasonPattern,
}: SeasonCreateSuggestionDialogProps) {
  const { t, i18n } = useTranslation(['navigation', 'common']);
  const locale = resolveSeasonDateLocale(i18n);
  const { activeSeason, dueSuggestion, switchSeason, createSeason } = controller;
  const [copyFromCurrent, setCopyFromCurrent] = useState(true);
  const [creatingSuggested, setCreatingSuggested] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const showSuggestion = Boolean(dueSuggestion?.start_date && dueSuggestion?.end_date);
  const suggestedLabel = showSuggestion ? computeSeasonLabel(dueSuggestion!.start_date!, dueSuggestion!.end_date!) : '';
  const suggestedPeriod = showSuggestion
    ? formatSeasonPeriod(dueSuggestion!.start_date!, dueSuggestion!.end_date!, locale)
    : '';

  const handleClose = () => {
    if (!creatingSuggested) {
      setCreateError(null);
      setCopyFromCurrent(true);
      onClose();
    }
  };

  const handleEditSeasonPattern = () => {
    if (!creatingSuggested) {
      setCreateError(null);
      setCopyFromCurrent(true);
      onEditSeasonPattern();
    }
  };

  const handleCreateSuggested = async () => {
    if (!dueSuggestion?.start_date || !dueSuggestion.end_date) {
      return;
    }
    setCreatingSuggested(true);
    setCreateError(null);
    try {
      const created = await createSeason(
        dueSuggestion.start_date,
        dueSuggestion.end_date,
        copyFromCurrent && activeSeason ? activeSeason.id : undefined,
      );
      setCopyFromCurrent(true);
      onClose();
      switchSeason(created.id);
    } catch (error) {
      setCreateError(getSeasonCreateErrorMessage(
        error,
        t('navigation:seasonSwitcher.suggestion.createError'),
        suggestedPeriod,
        t,
      ));
    } finally {
      setCreatingSuggested(false);
    }
  };

  return (
    <Dialog open={open && showSuggestion} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('navigation:seasonSwitcher.suggestion.confirmTitle', { label: suggestedLabel })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {suggestedPeriod}
          </Typography>
          {createError ? <Alert severity="error">{createError}</Alert> : null}
          {activeSeason ? (
            <Box
              sx={{
                borderRadius: 1,
                bgcolor: 'success.50',
                p: 1.5,
              }}
            >
              <FormControlLabel
                sx={{ alignItems: 'flex-start', m: 0 }}
                control={(
                  <Checkbox
                    checked={copyFromCurrent}
                    onChange={(event) => setCopyFromCurrent(event.target.checked)}
                    sx={{ pt: 0 }}
                  />
                )}
                label={(
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      {t('navigation:seasonSwitcher.suggestion.copyCheckbox', { label: activeSeason.label })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('navigation:seasonSwitcher.suggestion.copyDescription')}
                    </Typography>
                  </Stack>
                )}
              />
            </Box>
          ) : null}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              p: 1.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', mt: '3px', flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              {t('navigation:seasonSwitcher.suggestion.patternHint.prefix')}
              {' '}
              <Link
                component="button"
                type="button"
                onClick={handleEditSeasonPattern}
                sx={{
                  fontWeight: 700,
                  fontSize: 'inherit',
                  color: 'primary.main',
                  textDecoration: 'none',
                  verticalAlign: 'baseline',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {t('navigation:seasonSwitcher.suggestion.patternHint.link')}
              </Link>
              {' '}
              {t('navigation:seasonSwitcher.suggestion.patternHint.suffix')}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={creatingSuggested}>
          {t('common:actions.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void handleCreateSuggested()} disabled={creatingSuggested}>
          {t('navigation:seasonSwitcher.suggestion.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function SeasonSwitcher({
  controller,
  onOpenProjectSettings,
  onOpenCreateSuggestion,
  isPhone = false,
  buttonPx,
}: SeasonSwitcherProps) {
  const { t, i18n } = useTranslation(['navigation', 'common']);
  const locale = resolveSeasonDateLocale(i18n);
  const {
    seasons, activeSeason, dueSuggestion, pendingDeletions,
    switchSeason, renameSeason, copyDataInto, deleteSeason,
    undoPendingDeletion, closePendingDeletionSnackbar,
  } = controller;

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuSeasonId, setRowMenuSeasonId] = useState<number | null>(null);
  const [renameSeasonTarget, setRenameSeasonTarget] = useState<Season | null>(null);
  const [copyDialogTarget, setCopyDialogTarget] = useState<Season | null>(null);

  const rowMenuSeason = seasons.find((season) => season.id === rowMenuSeasonId) ?? null;
  const showSuggestion = Boolean(dueSuggestion?.due && dueSuggestion?.start_date && dueSuggestion?.end_date);
  const suggestedLabel = showSuggestion ? computeSeasonLabel(dueSuggestion!.start_date!, dueSuggestion!.end_date!) : '';
  const suggestedPeriod = showSuggestion
    ? formatSeasonPeriod(dueSuggestion!.start_date!, dueSuggestion!.end_date!, locale)
    : '';

  const closeMenu = () => setMenuAnchor(null);

  const handleOpenSuggestionDialog = () => {
    closeMenu();
    onOpenCreateSuggestion();
  };

  return (
    <>
      <Button
        aria-label={t('navigation:seasonSwitcher.ariaLabel')}
        aria-controls={menuAnchor ? 'season-switcher-menu' : undefined}
        aria-haspopup="true"
        onClick={(event) => setMenuAnchor(event.currentTarget)}
        size="small"
        sx={{
          color: 'text.primary',
          textTransform: 'none',
          maxWidth: { xs: 76, sm: 180 },
          minWidth: 0,
          px: buttonPx ?? (isPhone ? 0.75 : 1),
        }}
        startIcon={!isPhone ? <NavEmojiIcon emoji={SEASON_SWITCHER_EMOJI} /> : undefined}
        endIcon={!isPhone ? <KeyboardArrowDownIcon fontSize="small" /> : undefined}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeSeason?.label ?? '–'}
        </Box>
      </Button>

      <Menu
        id="season-switcher-menu"
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        slotProps={{ paper: { sx: { width: { xs: 'min(320px, calc(100vw - 32px))', sm: 340 }, maxWidth: 'calc(100vw - 32px)' } } }}
      >
        <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
          <Typography variant="overline" color="text.secondary">{t('navigation:seasonSwitcher.sectionTitle')}</Typography>
        </Box>

        {seasons.map((season) => {
          const isActive = season.id === activeSeason?.id;
          return (
            <MenuItem key={season.id} selected={isActive} onClick={() => { closeMenu(); switchSeason(season.id); }}>
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: isActive ? 700 : 500 }}>{season.label}</Typography>
                  {isActive ? <CheckIcon fontSize="small" color="primary" /> : null}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {formatSeasonPeriod(season.start_date, season.end_date, locale)}
                  {' · '}
                  {t('navigation:seasonSwitcher.planCount', { count: season.planting_plan_count })}
                </Typography>
              </Stack>
              <IconButton
                size="small"
                aria-label={t('navigation:seasonSwitcher.menu.openAria')}
                onClick={(event) => {
                  event.stopPropagation();
                  setRowMenuAnchor(event.currentTarget);
                  setRowMenuSeasonId(season.id);
                }}
                sx={{ color: 'text.disabled', ml: 1 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </MenuItem>
          );
        })}

        {showSuggestion ? (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handleOpenSuggestionDialog}>
              <Stack direction="row" spacing={1} sx={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    mt: 0.25,
                    width: 2,
                    height: 2,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    typography: 'caption',
                    fontWeight: 700,
                    flex: '0 0 auto',
                  }}
                >
                  +
                </Box>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 500 }}>
                    {t('navigation:seasonSwitcher.suggestion.title', { label: suggestedLabel })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {suggestedPeriod}
                  </Typography>
                </Stack>
              </Stack>
              <Button
                size="small"
                variant="contained"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenSuggestionDialog();
                }}
                sx={{ ml: 1, flex: '0 0 auto' }}
              >
                {t('navigation:seasonSwitcher.suggestion.create')}
              </Button>
            </MenuItem>
          </>
        ) : null}

        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { closeMenu(); onOpenProjectSettings(); }} sx={{ whiteSpace: 'normal' }}>
          {t('navigation:seasonSwitcher.settingsLink')}
        </MenuItem>
      </Menu>

      <SeasonRowActionsMenu
        anchorEl={rowMenuAnchor}
        onClose={() => { setRowMenuAnchor(null); setRowMenuSeasonId(null); }}
        onCopyDataFrom={() => { if (rowMenuSeason) { setCopyDialogTarget(rowMenuSeason); } }}
        onRename={() => { if (rowMenuSeason) { setRenameSeasonTarget(rowMenuSeason); } }}
        onDelete={() => { if (rowMenuSeason) { void deleteSeason(rowMenuSeason); closeMenu(); } }}
      />

      <SeasonRenameDialog
        open={renameSeasonTarget !== null}
        season={renameSeasonTarget}
        onClose={() => setRenameSeasonTarget(null)}
        onConfirm={renameSeason}
      />

      <SeasonCopyDataDialog
        open={copyDialogTarget !== null}
        targetSeason={copyDialogTarget}
        seasons={seasons}
        onClose={() => setCopyDialogTarget(null)}
        onConfirm={copyDataInto}
      />

      {pendingDeletions.map((deletion, index) => (
        <DeleteUndoSnackbar
          key={deletion.id}
          open={deletion.visible}
          message={deletion.message}
          undoLabel={t('navigation:seasonSwitcher.undo')}
          offsetIndex={index}
          testId={`season-delete-undo-snackbar-${deletion.id}`}
          onClose={() => closePendingDeletionSnackbar(deletion.id)}
          onUndo={() => void undoPendingDeletion(deletion.id)}
        />
      ))}
    </>
  );
}
