import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { confirmEmailChange } from '../../auth/authApi';
import { useTranslation } from '../../i18n';

export default function ConfirmEmailChangePage() {
  const { t } = useTranslation('account');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const uid = searchParams.get('uid');
    const token = searchParams.get('token');
    const requestId = searchParams.get('request_id');

    if (!uid || !token || !requestId) {
      setStatus('error');
      setMessage(t('emailConfirm.invalid'));
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
  }, [searchParams, t]);

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 8, p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        {t('emailConfirm.title')}
      </Typography>
      {status === 'loading' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={20} />
          <Typography>{t('emailConfirm.loading')}</Typography>
        </Box>
      ) : null}
      {status === 'success' ? <Alert severity="success">{message}</Alert> : null}
      {status === 'error' ? <Alert severity="error">{message}</Alert> : null}
    </Box>
  );
}
