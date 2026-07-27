import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { confirmEmailChange } from '../../auth/authApi';
import { useTranslation } from '../../i18n';

export default function ConfirmEmailChangePage() {
  const { t } = useTranslation('account');
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');
  const requestId = searchParams.get('request_id');
  const hasRequiredParams = Boolean(uid && token && requestId);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!uid || !token || !requestId) {
      return;
    }

    void (async () => {
      try {
        const response = await confirmEmailChange(uid, token, requestId);
        setStatus('success');
        setMessage(response.detail);
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : t('emailConfirm.invalid'));
      }
    })();
  }, [requestId, t, token, uid]);

  const effectiveStatus = hasRequiredParams ? status : 'error';
  const effectiveMessage = hasRequiredParams ? message : t('emailConfirm.invalid');

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 8, p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        {t('emailConfirm.title')}
      </Typography>
      {effectiveStatus === 'loading' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={20} />
          <Typography>{t('emailConfirm.loading')}</Typography>
        </Box>
      ) : null}
      {effectiveStatus === 'success' ? <Alert severity="success">{effectiveMessage}</Alert> : null}
      {effectiveStatus === 'error' ? <Alert severity="error">{effectiveMessage}</Alert> : null}
    </Box>
  );
}
