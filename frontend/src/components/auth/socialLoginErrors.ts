// Maps the backend's social login error codes (?social_error=...) to i18n keys.
// Unknown codes fall back to a generic message, so a future backend code can
// never surface a raw technical value in the UI.

const KNOWN_ERROR_CODES = [
  'cancelled',
  'provider_error',
  'invalid_state',
  'invalid_response',
  'missing_email',
  'unverified_email',
  'email_conflict',
  'account_inactive',
  'account_pending_deletion',
  'identity_already_linked',
  'login_required',
] as const;

export type SocialLoginErrorCode = (typeof KNOWN_ERROR_CODES)[number];

export function isSocialLoginErrorCode(code: string): code is SocialLoginErrorCode {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(code);
}

/** Fully qualified i18n key for a social login error code. */
export function socialLoginErrorKey(code: string): string {
  return `auth:socialLogin.errors.${isSocialLoginErrorCode(code) ? code : 'unknown'}`;
}
