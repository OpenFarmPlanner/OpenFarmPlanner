export const AUTHENTICATION_EXPIRED_EVENT = 'openfarmplanner:authentication-expired';

export interface AuthenticationExpiredEventDetail {
  requestStartedAt: number;
}

export function createAuthenticationExpiredEvent(
  requestStartedAt: number,
): CustomEvent<AuthenticationExpiredEventDetail> {
  return new CustomEvent<AuthenticationExpiredEventDetail>(
    AUTHENTICATION_EXPIRED_EVENT,
    { detail: { requestStartedAt } },
  );
}
