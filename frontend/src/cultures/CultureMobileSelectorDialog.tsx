import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import type { TFunction } from 'i18next';

import type { Culture } from '../api/api';
import { useOverlayHistory } from '../hooks/useOverlayHistory';

interface CultureMobileSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  /** The shared search/filter control rendered above the list. */
  selectorControl: ReactNode;
  cultures: Culture[];
  selectedCultureId: number | undefined;
  onSelect: (culture: Culture) => void;
  t: TFunction<'cultures'>;
}

/**
 * Presentational full-screen culture picker for the unified mobile layout.
 * State (open flag, filtered cultures, selected culture) and the select
 * handler live in CultureDetail.tsx; this component only renders.
 */
export function CultureMobileSelectorDialog({
  open,
  onClose,
  selectorControl,
  cultures,
  selectedCultureId,
  onSelect,
  t,
}: CultureMobileSelectorDialogProps) {
  useOverlayHistory({
    open,
    onClose,
    historyKey: 'openFarmPlannerCultureSelector',
  });

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle>{t('selectCulture')}</DialogTitle>
      <DialogContent sx={{ px: 1.5, pb: 2 }}>
        {selectorControl}
        <List dense sx={{ py: 0.5, px: 0.25, overflowY: 'auto' }}>
          {cultures.map((culture) => {
            const secondary = [culture.variety].filter(Boolean).join(' • ');
            return (
              <ListItemButton
                key={`mobile-${culture.id}`}
                selected={selectedCultureId === culture.id}
                onClick={() => onSelect(culture)}
                sx={{ borderRadius: 1.25, mb: 0.375 }}
              >
                <ListItemText
                  primary={culture.name}
                  secondary={secondary || culture.crop_family || undefined}
                  primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: 600 }}
                  secondaryTypographyProps={{ fontSize: '0.8rem', color: 'text.secondary' }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
