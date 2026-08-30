import { useState } from 'react';
import {
  Badge,
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
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckIcon from '@mui/icons-material/Check';
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

interface SeasonSwitcherProps {
  controller: UseActiveSeasonReturn;
  onOpenProjectSettings: () => void;
  isPhone?: boolean;
  buttonPx?: number;
}

export function SeasonSwitcher({
  controller,
  onOpenProjectSettings,
  isPhone = false,
  buttonPx,
}: SeasonSwitcherProps) {
  const { t, i18n } = useTranslation(['navigation', 'common']);
  const locale = resolveSeasonDateLocale(i18n);
  const {
    seasons, activeSeason, dueSuggestion, pendingDeletions,
    switchSeason, createSeason, renameSeason, copyDataInto, deleteSeason,
    undoPendingDeletion, closePendingDeletionSnackbar,
  } = controller;

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuSeasonId, setRowMenuSeasonId] = useState<number | null>(null);
  const [renameSeasonTarget, setRenameSeasonTarget] = useState<Season | null>(null);
  const [copyDialogTarget, setCopyDialogTarget] = useState<Season | null>(null);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [copyFromCurrent, setCopyFromCurrent] = useState(true);
  const [creatingSuggested, setCreatingSuggested] = useState(false);

  const rowMenuSeason = seasons.find((season) => season.id === rowMenuSeasonId) ?? null;
  const showSuggestion = Boolean(dueSuggestion?.due && dueSuggestion?.start_date && dueSuggestion?.end_date);
  const suggestedLabel = showSuggestion ? computeSeasonLabel(dueSuggestion!.start_date!, dueSuggestion!.end_date!) : '';
  const suggestedPeriod = showSuggestion
    ? formatSeasonPeriod(dueSuggestion!.start_date!, dueSuggestion!.end_date!, locale)
    : '';

  const closeMenu = () => setMenuAnchor(null);

  const handleOpenSuggestionDialog = () => {
    setCopyFromCurrent(true);
    closeMenu();
    setSuggestionDialogOpen(true);
  };

  const handleCloseSuggestionDialog = () => {
    if (!creatingSuggested) {
      setSuggestionDialogOpen(false);
      setCopyFromCurrent(true);
    }
  };

  const handleCreateSuggested = async () => {
    if (!dueSuggestion?.start_date || !dueSuggestion.end_date) {
      return;
    }
    setCreatingSuggested(true);
    try {
      const created = await createSeason(
        dueSuggestion.start_date,
        dueSuggestion.end_date,
        copyFromCurrent && activeSeason ? activeSeason.id : undefined,
      );
      switchSeason(created.id);
      setSuggestionDialogOpen(false);
      setCopyFromCurrent(true);
    } finally {
      setCreatingSuggested(false);
    }
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
        startIcon={!isPhone ? (
          <Badge variant="dot" color="warning" invisible={!dueSuggestion?.due}>
            <NavEmojiIcon emoji={SEASON_SWITCHER_EMOJI} />
          </Badge>
        ) : undefined}
        endIcon={!isPhone ? <KeyboardArrowDownIcon fontSize="small" /> : undefined}
      >
        {/* Phone: no room for the icon or the dropdown arrow — the due-season
            dot rides on the label itself instead of the (now absent) icon. */}
        <Badge variant="dot" color="warning" invisible={!isPhone || !dueSuggestion?.due}>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeSeason?.label ?? '–'}
          </Box>
        </Badge>
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
                disabled={creatingSuggested}
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

      <Dialog open={suggestionDialogOpen && showSuggestion} onClose={handleCloseSuggestionDialog} fullWidth maxWidth="xs">
        <DialogTitle>{t('navigation:seasonSwitcher.suggestion.confirmTitle', { label: suggestedLabel })}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {suggestedPeriod}
            </Typography>
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSuggestionDialog} disabled={creatingSuggested}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="contained" onClick={() => void handleCreateSuggested()} disabled={creatingSuggested}>
            {t('navigation:seasonSwitcher.suggestion.create')}
          </Button>
        </DialogActions>
      </Dialog>

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
