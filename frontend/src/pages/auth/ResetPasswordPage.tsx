import { Alert, Box, Button, InputAdornment, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import PasswordVisibilityToggle from '../../components/inputs/PasswordVisibilityToggle';
import { useTranslation } from '../../i18n';
import AuthPageShell from './AuthPageShell';
import { authFormSx, authPrimaryButtonSx, authTextButtonSx, authTextFieldSx } from './authPageStyles';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const { confirmPasswordReset } = useAuth();
  const { t } = useTranslation('auth');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const uid = searchParams.get('uid') ?? '';
    const token = searchParams.get('token') ?? '';

    try {
      setMessage(await confirmPasswordReset(uid, token, password, passwordConfirm));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetPassword.failed'));
    }
  };

  return (
    <AuthPageShell title={t('resetPassword.title')} subtitle={t('resetPassword.subtitle')}>
      <Box component="form" onSubmit={handleSubmit} sx={authFormSx}>
        <Stack spacing={2.25}>
          {message ? <Alert severity="success">{message}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label={t('resetPassword.password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            sx={authTextFieldSx}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <PasswordVisibilityToggle
                      isVisible={showPassword}
                      showLabel={t('resetPassword.showPassword')}
                      hideLabel={t('resetPassword.hidePassword')}
                      onToggle={() => setShowPassword((current) => !current)}
                    />
                  </InputAdornment>
                ),
              },
              htmlInput: { autoComplete: 'new-password' },
            }}
          />
          <TextField
            label={t('resetPassword.passwordConfirm')}
            type={showPasswordConfirm ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            fullWidth
            sx={authTextFieldSx}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <PasswordVisibilityToggle
                      isVisible={showPasswordConfirm}
                      showLabel={t('resetPassword.showPassword')}
                      hideLabel={t('resetPassword.hidePassword')}
                      onToggle={() => setShowPasswordConfirm((current) => !current)}
                    />
                  </InputAdornment>
                ),
              },
              htmlInput: { autoComplete: 'new-password' },
            }}
          />
          <Button type="submit" variant="contained" size="large" fullWidth sx={authPrimaryButtonSx}>
            {t('resetPassword.submit')}
          </Button>
          <Button component={RouterLink} to="/login" sx={authTextButtonSx}>
            {t('resetPassword.backToLogin')}
          </Button>
        </Stack>
      </Box>
    </AuthPageShell>
  );
}
