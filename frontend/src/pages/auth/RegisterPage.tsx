import { Alert, Box, Button, Checkbox, FormControlLabel, InputAdornment, Link, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { projectAPI, type InvitationPublicStatus } from '../../api/api';
import { useAuth } from '../../auth/useAuth';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import PasswordVisibilityToggle from '../../components/inputs/PasswordVisibilityToggle';
import { useTranslation } from '../../i18n';
import { getNextFromSearch, getTokenFromNextPath, storeInvitationRedirect } from '../invitationAcceptance';
import AuthPageShell from './AuthPageShell';
import { authFormSx, authLegalLinkSx, authPrimaryButtonSx, authSecondaryButtonSx, authTextButtonSx, authTextFieldSx } from './authPageStyles';

export default function RegisterPage() {
  const { user, register, resendActivation, logout } = useAuth();
  const { t } = useTranslation(['auth', 'projectInvitations']);
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [registrationSucceeded, setRegistrationSucceeded] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<InvitationPublicStatus | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const nextPath = getNextFromSearch(location.search);
  const isLoggedIn = user !== null;
  const currentUserLabel = user?.display_label || user?.email || '–';

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError(t('auth:error.messages.required'));
      return;
    }
    if (!password) {
      setError(t('auth:error.messages.required'));
      return;
    }
    if (password !== passwordConfirm) {
      setError(t('auth:register.passwordMismatch'));
      return;
    }
    if (!acceptTerms) {
      setError(t('auth:register.termsRequired'));
      return;
    }

    setSubmitting(true);
    try {
      if (nextPath) {
        storeInvitationRedirect(nextPath, getTokenFromNextPath(nextPath));
      }
      const message = await register(email.trim().toLowerCase(), password, passwordConfirm, displayName.trim(), acceptTerms);
      setSuccess(pendingInvitation ? t('projectInvitations:registerSuccessWithInvitation', { detail: message }) : message);
      setRegistrationSucceeded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:register.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setError(null);
    setSuccess(null);
    try {
      setSuccess(await resendActivation(email.trim().toLowerCase()));
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : t('auth:register.failed'));
    }
  };

  const handleLogoutAndCreate = async (): Promise<void> => {
    setError(null);
    setSuccess(null);
    try {
      await logout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : t('auth:register.logoutToCreateFailed'));
    }
  };

  return (
    <AuthPageShell title={t('auth:register.title')} subtitle={t('auth:register.subtitle')} legalLinksDense>
      {isLoggedIn ? null : <SocialLoginButtons />}
      <Box component="form" onSubmit={handleSubmit} noValidate sx={authFormSx}>
        <Stack spacing={2.25}>
          {isLoggedIn ? (
            <Alert severity="info">
              <Stack spacing={1.5}>
                <Typography variant="body2">
                  {t('auth:register.loggedInHint', { user: currentUserLabel })}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button type="button" variant="contained" size="large" onClick={() => void handleLogoutAndCreate()} sx={authPrimaryButtonSx}>
                    {t('auth:register.logoutAndCreate')}
                  </Button>
                  <Button type="button" variant="outlined" size="large" onClick={() => navigate('/app')} sx={authSecondaryButtonSx}>
                    {t('auth:register.backToApp')}
                  </Button>
                </Stack>
              </Stack>
            </Alert>
          ) : null}
          {pendingInvitation ? (
            <Alert severity="info">
              {t('projectInvitations:registerHint', {
                project: pendingInvitation.project_name ?? '–',
                email: pendingInvitation.email_masked ?? '–',
              })}
            </Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}
          <TextField
            label={t('auth:register.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoggedIn}
            fullWidth
            sx={authTextFieldSx}
          />
          <TextField
            label={t('auth:register.displayName')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLoggedIn}
            fullWidth
            sx={authTextFieldSx}
          />
          <TextField
            label={t('auth:register.password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoggedIn}
            fullWidth
            sx={authTextFieldSx}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <PasswordVisibilityToggle
                      isVisible={showPassword}
                      showLabel={t('auth:register.showPassword')}
                      hideLabel={t('auth:register.hidePassword')}
                      onToggle={() => setShowPassword((current) => !current)}
                      disabled={isLoggedIn}
                    />
                  </InputAdornment>
                ),
              },
              htmlInput: { autoComplete: 'new-password' },
            }}
          />
          <TextField
            label={t('auth:register.passwordConfirm')}
            type={showPasswordConfirm ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            disabled={isLoggedIn}
            fullWidth
            sx={authTextFieldSx}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <PasswordVisibilityToggle
                      isVisible={showPasswordConfirm}
                      showLabel={t('auth:register.showPassword')}
                      hideLabel={t('auth:register.hidePassword')}
                      onToggle={() => setShowPasswordConfirm((current) => !current)}
                      disabled={isLoggedIn}
                    />
                  </InputAdornment>
                ),
              },
              htmlInput: { autoComplete: 'new-password' },
            }}
          />
          <FormControlLabel
            sx={{
              alignItems: 'flex-start',
              gap: 1,
              m: 0,
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'rgba(46, 125, 50, 0.04)',
              '& .MuiFormControlLabel-label': {
                mt: 0.2,
              },
            }}
            control={(
              <Checkbox
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                disabled={isLoggedIn}
                sx={{ mt: -0.55 }}
              />
            )}
            label={(
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                {t('auth:register.termsNoticePrefix')}
                <Link component={RouterLink} to="/nutzungsbedingungen" target="_blank" rel="noopener" sx={authLegalLinkSx}>
                  {t('auth:register.termsNoticeTermsLinkLabel')}
                </Link>
                {t('auth:register.termsNoticeMiddle')}
                <Link component={RouterLink} to="/datenschutz" target="_blank" rel="noopener" sx={authLegalLinkSx}>
                  {t('auth:register.termsNoticePrivacyLinkLabel')}
                </Link>
                {t('auth:register.termsNoticeSuffix')}
              </Typography>
            )}
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting || isLoggedIn || !acceptTerms} fullWidth sx={authPrimaryButtonSx}>
            {submitting ? t('auth:register.submitting') : t('auth:register.submit')}
          </Button>
          {registrationSucceeded && !isLoggedIn ? (
            <Button type="button" onClick={() => void handleResend()} sx={authTextButtonSx}>{t('auth:register.resendActivation')}</Button>
          ) : null}
          <Button type="button" component={RouterLink} to={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'} state={location.state} sx={authTextButtonSx}>
            {t('auth:register.hasAccount')}
          </Button>
        </Stack>
      </Box>
    </AuthPageShell>
  );
}
