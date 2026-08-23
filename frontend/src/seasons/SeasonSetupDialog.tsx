import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { seasonSetupAPI } from '../api/api';
import type { SeasonSetupStatus } from '../api/types';
import { useTranslation } from '../i18n';
import { extractApiErrorMessage } from '../api/errors';
import { computeSeasonLabel, formatSeasonPeriod, resolveSeasonDateLocale } from './formatSeasonDate';
import { SeasonStartDateFields } from './SeasonStartDateFields';

interface SeasonSetupDialogProps {
  open: boolean;
  status: SeasonSetupStatus;
  onApplied: (seasonId: number) => void;
  onCancel: () => void;
}

/** First-run migration modal (see Saisonen spec §4): sets the season pattern and
 * assigns all of a project's still-unassigned planting plans to the resulting season. */
export function SeasonSetupDialog({ open, status, onApplied, onCancel }: SeasonSetupDialogProps) {
  const { t, i18n } = useTranslation(['navigation', 'common']);
  const locale = resolveSeasonDateLocale(i18n);
  const [startDay, setStartDay] = useState(status.start_day);
  const [startMonth, setStartMonth] = useState(status.start_month);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = computeSeasonLabel(status.computed_start_date, status.computed_end_date);
  const period = formatSeasonPeriod(status.computed_start_date, status.computed_end_date, locale);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await seasonSetupAPI.apply({ start_day: startDay, start_month: startMonth });
      onApplied(response.data.season.id);
    } catch (submitError) {
      setError(extractApiErrorMessage(submitError, t, t('navigation:seasonSetup.error')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>{t('navigation:seasonSetup.title')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {t('navigation:seasonSetup.description', { count: status.unassigned_planting_plan_count })}
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('navigation:seasonSetup.startLabel')}</Typography>
        <SeasonStartDateFields
          idPrefix="season-setup"
          startDay={startDay}
          startMonth={startMonth}
          onChange={(day, month) => { setStartDay(day); setStartMonth(month); }}
        />

        <Alert severity="info" sx={{ mt: 2.5, mb: 2 }}>
          {t('navigation:seasonSetup.infoBox', { label })}
        </Alert>

        <Typography variant="body2" color="text.secondary">
          {t('navigation:seasonSetup.summary', { count: status.unassigned_planting_plan_count, label, period })}
        </Typography>

        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting}>{t('common:actions.cancel')}</Button>
        <Button onClick={() => void handleSubmit()} variant="contained" disabled={submitting}>
          {t('navigation:seasonSetup.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
