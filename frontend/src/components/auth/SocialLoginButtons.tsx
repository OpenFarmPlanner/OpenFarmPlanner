// "Sign in with Google/Microsoft" block shown above the email/password form on
// the login and registration pages. Renders nothing when the deployment has no
// provider configured, so the pages stay unchanged without OAuth credentials.

import { Alert, Box, Button, Divider, Link, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  SOCIAL_ERROR_PARAM,
  getSocialProviders,
  startSocialLogin,
  type SocialProvider,
} from '../../auth/socialAuth';
import { useTranslation } from '../../i18n';
import { authLegalLinkSx, authSecondaryButtonSx } from '../../pages/auth/authPageStyles';
import { GoogleIcon, MicrosoftIcon } from './providerIcons';
import { socialLoginErrorKey } from './socialLoginErrors';

const providerIcons = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
} as const;

const socialButtonSx = {
  ...authSecondaryButtonSx,
  justifyContent: 'flex-start',
  gap: 1.5,
  color: 'text.primary',
  borderColor: 'rgba(46, 125, 50, 0.24)',
  boxShadow: 0,
  '&:hover': {
    ...authSecondaryButtonSx['&:hover'],
    color: 'text.primary',
    borderColor: 'rgba(46, 125, 50, 0.42)',
    transform: 'none',
    boxShadow: 1,
  },
};

export default function SocialLoginButtons() {
  const { t, i18n } = useTranslation('auth');
  const location = useLocation();
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectErrorCode = new URLSearchParams(location.search).get(SOCIAL_ERROR_PARAM);

  useEffect(() => {
    let cancelled = false;
    const loadProviders = async (): Promise<void> => {
      try {
        const available = await getSocialProviders();
        if (!cancelled) {
          setProviders(available);
        }
      } catch {
        if (!cancelled) {
          setProviders([]);
        }
      }
    };

    void loadProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  if (providers.length === 0 && !redirectErrorCode) {
    return null;
  }

  // Names the legal notice below the buttons by whichever providers this
  // deployment actually has configured (just "Google", or "Google oder
  // Microsoft" once both are set up), instead of hardcoding both names.
  const providerNamesText = new Intl.ListFormat(i18n.language, {
    style: 'long',
    type: 'disjunction',
  }).format(providers.map((provider) => provider.name));

  const handleStart = async (provider: SocialProvider): Promise<void> => {
    setError(null);
    setPendingProvider(provider.id);
    try {
      await startSocialLogin(provider);
    } catch {
      setPendingProvider(null);
      setError(t('socialLogin.errors.startFailed'));
    }
  };

  return (
    <Stack spacing={2.25} sx={{ mb: providers.length > 0 ? 2.5 : 0 }}>
      {redirectErrorCode ? (
        <Alert severity="error">{t(socialLoginErrorKey(redirectErrorCode))}</Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      {providers.map((provider) => {
        const ProviderIcon = providerIcons[provider.id];
        const isPending = pendingProvider === provider.id;
        return (
          <Button
            key={provider.id}
            type="button"
            variant="outlined"
            size="large"
            fullWidth
            disabled={pendingProvider !== null}
            onClick={() => void handleStart(provider)}
            startIcon={ProviderIcon ? <ProviderIcon /> : undefined}
            sx={socialButtonSx}
          >
            {isPending
              ? t('socialLogin.starting', { provider: provider.name })
              : t('socialLogin.loginWith', { provider: provider.name })}
          </Button>
        );
      })}

      {providers.length > 0 ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {t('socialLogin.legalNoticePrefix', { providers: providerNamesText })}
            <Link component={RouterLink} to="/nutzungsbedingungen" target="_blank" rel="noopener" sx={authLegalLinkSx}>
              {t('socialLogin.legalNoticeTermsLinkLabel')}
            </Link>
            {t('socialLogin.legalNoticeMiddle')}
            <Link component={RouterLink} to="/datenschutz" target="_blank" rel="noopener" sx={authLegalLinkSx}>
              {t('socialLogin.legalNoticePrivacyLinkLabel')}
            </Link>
            {t('socialLogin.legalNoticeSuffix')}
          </Typography>
          <Divider>
            <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.85rem', px: 0.5 }}>
              {t('socialLogin.dividerLabel')}
            </Box>
          </Divider>
        </>
      ) : null}
    </Stack>
  );
}
