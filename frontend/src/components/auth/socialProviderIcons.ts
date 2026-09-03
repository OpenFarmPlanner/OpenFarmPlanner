import { GoogleIcon, MicrosoftIcon } from './providerIcons';

/**
 * The icon each social login provider is rendered with, keyed by provider id.
 * Lives apart from `providerIcons.tsx` because that file exports components.
 */
export const PROVIDER_ICONS = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
} as const;
