import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { useTranslation } from '../i18n';

interface SeasonStartDateFieldsProps {
  startDay: number;
  startMonth: number;
  onChange: (startDay: number, startMonth: number) => void;
  idPrefix: string;
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Two selects (day + month) backing `SeasonPattern.start_day`/`start_month` — duration is always fixed at 12 months. */
export function SeasonStartDateFields({ startDay, startMonth, onChange, idPrefix }: SeasonStartDateFieldsProps) {
  const { t } = useTranslation('navigation');

  return (
    <Stack direction="row" spacing={2}>
      <FormControl sx={{ minWidth: 100 }}>
        <InputLabel id={`${idPrefix}-day-label`}>{t('seasonPattern.dayLabel')}</InputLabel>
        <Select
          labelId={`${idPrefix}-day-label`}
          label={t('seasonPattern.dayLabel')}
          value={startDay}
          onChange={(event) => onChange(Number(event.target.value), startMonth)}
        >
          {DAYS.map((day) => <MenuItem key={day} value={day}>{day}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl sx={{ minWidth: 160 }}>
        <InputLabel id={`${idPrefix}-month-label`}>{t('seasonPattern.monthLabel')}</InputLabel>
        <Select
          labelId={`${idPrefix}-month-label`}
          label={t('seasonPattern.monthLabel')}
          value={startMonth}
          onChange={(event) => onChange(startDay, Number(event.target.value))}
        >
          {MONTH_KEYS.map((key, index) => (
            <MenuItem key={key} value={index + 1}>{t(`seasonPattern.months.${key}`)}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
