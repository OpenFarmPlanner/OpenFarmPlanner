import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
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
}

export function SeasonSwitcher({ controller, onOpenProjectSettings, isPhone = false }: SeasonSwitcherProps) {
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
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [copyFromCurrent, setCopyFromCurrent] = useState(true);
  const [creatingSuggested, setCreatingSuggested] = useState(false);

  const rowMenuSeason = seasons.find((season) => season.id === rowMenuSeasonId) ?? null;
  const showSuggestion = Boolean(dueSuggestion?.due) && !suggestionDismissed && dueSuggestion?.start_date && dueSuggestion?.end_date;
  const suggestedLabel = showSuggestion ? computeSeasonLabel(dueSuggestion!.start_date!, dueSuggestion!.end_date!) : '';

  const closeMenu = () => setMenuAnchor(null);

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
          px: isPhone ? 0.75 : 1,
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
          <Box sx={{ p: 2, maxWidth: 340 }}>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="subtitle2">
              {t('navigation:seasonSwitcher.suggestion.title', { label: suggestedLabel })}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
              {t('navigation:seasonSwitcher.suggestion.subtitle', {
                start: formatSeasonPeriod(dueSuggestion!.start_date!, dueSuggestion!.end_date!, locale).split(' – ')[0],
                end: formatSeasonPeriod(dueSuggestion!.start_date!, dueSuggestion!.end_date!, locale).split(' – ')[1],
              })}
            </Typography>
            {activeSeason ? (
              <FormControlLabel
                sx={{ mb: 1 }}
                control={(
                  <Checkbox
                    size="small"
                    checked={copyFromCurrent}
                    onChange={(event) => setCopyFromCurrent(event.target.checked)}
                  />
                )}
                label={(
                  <Typography variant="body2">
                    {t('navigation:seasonSwitcher.suggestion.copyCheckbox', { label: activeSeason.label })}
                  </Typography>
                )}
              />
            ) : null}
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setSuggestionDismissed(true)}>
                {t('navigation:seasonSwitcher.suggestion.later')}
              </Button>
              <Button size="small" variant="contained" disabled={creatingSuggested} onClick={() => void handleCreateSuggested()}>
                {t('navigation:seasonSwitcher.suggestion.create')}
              </Button>
            </Stack>
          </Box>
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
