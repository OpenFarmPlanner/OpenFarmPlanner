import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import { getSocialProviders, type SocialProvider } from './socialAuth';

interface UseSocialProvidersResult {
  providers: SocialProvider[];
  /** e.g. "Google" or "Google oder Microsoft", localized and grammatically joined. */
  providerNamesText: string;
}

/**
 * Fetches the deployment's configured social login providers once and
 * derives the localized, human-readable list of their names. Shared by
 * `SocialLoginButtons` (renders the buttons) and `SocialLoginLegalNotice`
 * (renders the "signing in creates an account" text) so the same provider
 * list backs both without prop-drilling between them — they may render in
 * different places in the page (see LoginPage, which moves the notice to
 * the bottom of the card).
 */
export function useSocialProviders(): UseSocialProvidersResult {
  const { i18n } = useTranslation('auth');
  const [providers, setProviders] = useState<SocialProvider[]>([]);

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

  const providerNamesText = useMemo(() => {
    if (providers.length === 0) {
      return '';
    }
    return new Intl.ListFormat(i18n?.language ?? 'de', { style: 'long', type: 'disjunction' }).format(
      providers.map((provider) => provider.name),
    );
  }, [i18n?.language, providers]);

  return { providers, providerNamesText };
}
