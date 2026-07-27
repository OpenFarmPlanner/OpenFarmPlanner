// "Login methods" card on the account settings page: connect or disconnect
// Google/Microsoft for the signed-in account. This is also the explicit,
// secure linking path for users whose provider email cannot be matched to
// their account automatically (see docs/social-login.md).

import { Alert, Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import {
  SOCIAL_ERROR_PARAM,
  SOCIAL_STATUS_PARAM,
  disconnectSocialConnection,
  getSocialConnections,
  getSocialProviders,
  startSocialLogin,
  type SocialConnection,
  type SocialProvider,
} from '../auth/socialAuth';
import { useAuth } from '../auth/useAuth';
import { GoogleIcon, MicrosoftIcon } from '../components/auth/providerIcons';
import { socialLoginErrorKey } from '../components/auth/socialLoginErrors';
import { useTranslation } from '../i18n';
import { actionButtonSx, useSectionSubmit } from './accountSettingsForm';
import { SectionAlerts, SettingsCard } from './accountSettingsCards';

const providerIcons = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
} as const;

export default function AccountSettingsSocialCard() {
  const { t } = useTranslation(['account', 'auth']);
  const { user } = useAuth();
  const location = useLocation();
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const disconnectSection = useSectionSubmit(t('errors.generic'));

  const searchParams = new URLSearchParams(location.search);
  const redirectErrorCode = searchParams.get(SOCIAL_ERROR_PARAM);
  const connectSucceeded = searchParams.get(SOCIAL_STATUS_PARAM) === 'connected';

  const reload = useCallback(async (): Promise<void> => {
    const [availableProviders, linkedConnections] = await Promise.all([
      getSocialProviders(),
      getSocialConnections(),
    ]);
    setProviders(availableProviders);
    setConnections(linkedConnections);
  }, []);

  useEffect(() => {
    const loadLoginMethods = async (): Promise<void> => {
      try {
        await reload();
      } catch {
        setProviders([]);
        setConnections([]);
      }
    };

    void loadLoginMethods();
  }, [reload]);

  // A guest demo workspace is temporary, so it must not collect permanent
  // login methods.
  if (user?.is_guest_demo || (providers.length === 0 && connections.length === 0)) {
    return null;
  }

  const connectedProviderIds = new Set(connections.map((connection) => connection.provider));

  const handleConnect = async (provider: SocialProvider): Promise<void> => {
    setPendingProvider(provider.id);
    try {
      await startSocialLogin(provider, { process: 'connect' });
    } catch {
      setPendingProvider(null);
    }
  };

  const handleDisconnect = (connection: SocialConnection): Promise<void> =>
    disconnectSection.submit(() => disconnectSocialConnection(connection.id), reload);

  return (
    <SettingsCard title={t('loginMethods.title')} description={t('loginMethods.description')}>
      <Stack spacing={2}>
        {redirectErrorCode ? (
          <Alert severity="error">{t(socialLoginErrorKey(redirectErrorCode))}</Alert>
        ) : null}
        {connectSucceeded ? <Alert severity="success">{t('loginMethods.connected')}</Alert> : null}
        <SectionAlerts message={disconnectSection.message} error={disconnectSection.error} />

        {connections.map((connection) => {
          const ProviderIcon = providerIcons[connection.provider];
          return (
            <Stack
              key={connection.id}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                {ProviderIcon ? <ProviderIcon fontSize="small" /> : null}
                <Typography>
                  {t('loginMethods.connectedSince', {
                    provider: connection.provider_name,
                    date: new Date(connection.connected_at).toLocaleDateString('de-DE'),
                  })}
                </Typography>
              </Stack>
              <Button
                variant="outlined"
                color="error"
                disabled={!connection.can_disconnect || disconnectSection.submitting}
                onClick={() => void handleDisconnect(connection)}
                sx={actionButtonSx}
              >
                {t('loginMethods.disconnect')}
              </Button>
            </Stack>
          );
        })}

        {connections.some((connection) => !connection.can_disconnect) ? (
          <Typography variant="body2" color="text.secondary">
            {t('loginMethods.lastMethodHint')}
          </Typography>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {providers
            .filter((provider) => !connectedProviderIds.has(provider.id))
            .map((provider) => {
              const ProviderIcon = providerIcons[provider.id];
              return (
                <Button
                  key={provider.id}
                  variant="outlined"
                  disabled={pendingProvider !== null}
                  startIcon={ProviderIcon ? <ProviderIcon /> : undefined}
                  onClick={() => void handleConnect(provider)}
                  sx={actionButtonSx}
                >
                  {t('loginMethods.connect', { provider: provider.name })}
                </Button>
              );
            })}
        </Stack>
      </Stack>
    </SettingsCard>
  );
}
