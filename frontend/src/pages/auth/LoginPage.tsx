import { Alert, Box, Button, InputAdornment, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { projectAPI, type InvitationPublicStatus } from '../../api/api';
import { useAuth } from '../../auth/useAuth';
import { AuthApiError } from '../../auth/authApi';
import { getAuthenticatedAppDestination } from '../../auth/authDestination';
import { useTranslation } from '../../i18n';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import PasswordVisibilityToggle from '../../components/inputs/PasswordVisibilityToggle';
import { getNextFromSearch } from '../invitationAcceptance';
import AuthPageShell from './AuthPageShell';
import { authFormSx, authPrimaryButtonSx, authSecondaryButtonSx, authTextButtonSx, authTextFieldSx } from './authPageStyles';

export default function LoginPage() {
  const { user, login, restoreAccount } = useAuth();
  const { t } = useTranslation(['auth', 'projectInvitations']);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingDeletionAt, setPendingDeletionAt] = useState<string | null>(null);
  const [pendingInvitation, setPendingInvitation] = useState<InvitationPublicStatus | null>(null);
  const nextPath = getNextFromSearch(location.search);
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const authenticatedDestination =
    nextPath ?? (from?.pathname ? `${from.pathname}${from.search ?? ''}` : (user ? getAuthenticatedAppDestination(user) : '/app'));

  useEffect(() => {
    const loadPendingInvitation = async (): Promise<void> => {
      try {
        const response = await projectAPI.getPendingInvitation();
        if (response.data.code !== 'no_pending_invitation') {
          setPendingInvitation(response.data);
        }
      } catch {
        setPendingInvitation(null);
      }
    };

    void loadPendingInvitation();
  }, []);

  if (user) return <Navigate to={authenticatedDestination} replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const me = await login(email.trim().toLowerCase(), password);
      const target = getAuthenticatedAppDestination(me);
      const destination = nextPath ?? (from?.pathname ? `${from.pathname}${from.search ?? ''}` : target);
      navigate(destination, { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'account_pending_deletion') {
        setPendingDeletionAt(err.scheduledDeletionAt ?? null);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : t('auth:login.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const me = await restoreAccount(email.trim().toLowerCase(), password);
      navigate(nextPath ?? getAuthenticatedAppDestination(me), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:login.restoreFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell title={t('auth:login.title')} subtitle={t('auth:login.subtitle')}>
      <SocialLoginButtons />
      <Box component="form" onSubmit={handleSubmit} sx={authFormSx}>
        <Stack spacing={2.25}>
          {pendingInvitation ? (
            <Alert severity="info">
              {t('projectInvitations:authHint', {
                project: pendingInvitation.project_name ?? '–',
                email: pendingInvitation.email_masked ?? '–',
              })}
            </Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {pendingDeletionAt ? (
            <Alert severity="warning">
              {t('auth:login.pendingDeletion', { date: new Date(pendingDeletionAt).toLocaleString('de-DE') })}
            </Alert>
          ) : null}
          <TextField
            label={t('auth:login.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            sx={authTextFieldSx}
          />
          <TextField
            label={t('auth:login.password')}
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
                      showLabel={t('auth:login.showPassword')}
                      hideLabel={t('auth:login.hidePassword')}
                      onToggle={() => setShowPassword((current) => !current)}
                    />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth sx={authPrimaryButtonSx}>
            {submitting ? t('auth:login.submitting') : t('auth:login.submit')}
          </Button>
          {pendingDeletionAt ? (
            <Button variant="outlined" size="large" disabled={submitting} onClick={() => void handleRestore()} fullWidth sx={authSecondaryButtonSx}>
              {t('auth:login.restoreAccount')}
            </Button>
          ) : null}
          <Button component={RouterLink} to={nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : '/register'} state={location.state} sx={authTextButtonSx}>
            {t('auth:login.noAccount')}
          </Button>
          <Button component={RouterLink} to="/forgot-password" state={{ email }} sx={authTextButtonSx}>
            {t('auth:login.forgotPassword')}
          </Button>
        </Stack>
      </Box>
    </AuthPageShell>
  );
}
