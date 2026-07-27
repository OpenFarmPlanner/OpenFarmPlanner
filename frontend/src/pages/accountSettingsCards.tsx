// Presentational building blocks for the account settings page: success/error
// alerts, the inline editor wrapper, and the settings card shell.

import { Alert, Button, Card, CardContent, Collapse, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from '../i18n';
import { actionButtonSx, type SectionSubmit } from './accountSettingsForm';

export function SectionAlerts({ message, error }: Pick<SectionSubmit, 'message' | 'error'>) {
  return (
    <>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </>
  );
}

interface InlineEditorProps {
  open: boolean;
  saveLabel: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  submitting: boolean;
  saveDisabled?: boolean;
  sx?: SxProps<Theme>;
  children: ReactNode;
}

export function InlineEditor({ open, saveLabel, onSave, onCancel, submitting, saveDisabled = false, sx, children }: InlineEditorProps) {
  const { t } = useTranslation('account');
  return (
    <Collapse in={open} unmountOnExit>
      <Stack spacing={2} sx={sx}>
        {children}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" onClick={onSave} disabled={submitting || saveDisabled} sx={actionButtonSx}>
            {saveLabel}
          </Button>
          <Button variant="text" onClick={onCancel} disabled={submitting} sx={actionButtonSx}>
            {t('cancel')}
          </Button>
        </Stack>
      </Stack>
    </Collapse>
  );
}

interface SettingsCardProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: description ? 0.5 : 2 }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}
