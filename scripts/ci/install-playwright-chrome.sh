#!/usr/bin/env bash
#
# Installs Playwright's Chrome channel on a CI runner.
#
# Shared by .github/workflows/e2e.yml and frontend-build.yml, which both need
# the browser before `npm run build` (the frontend's `postbuild` script,
# build/prerender.ts, launches Chrome itself).
#
# Two failure modes this guards against, both observed in CI:
#
# 1. The Playwright CDN download (especially the bundled FFmpeg) can stall
#    indefinitely after reaching 100% instead of erroring out, silently burning
#    the whole job timeout. PLAYWRIGHT_DOWNLOAD_HOST (set by the caller) forces
#    the direct storage-bucket mirror, and each attempt is bounded by `timeout`.
#
# 2. `--with-deps` shells out to apt-get as root. When `timeout` kills an
#    attempt mid-apt, that apt-get survives as an orphan and keeps holding
#    /var/lib/apt/lists/lock and /var/lib/dpkg/lock-frontend. A retry fired
#    immediately dies on that lock in under a second, so all remaining attempts
#    are burnt within seconds of the first one — which is exactly how a single
#    slow apt mirror took out a whole run. Hence: wait for the locks to clear
#    before each attempt, and back off between attempts. The orphan often
#    completes the install on its own, in which case the next attempt is a
#    fast no-op.
#
# The caller's step timeout must exceed the worst case here
# (max_attempts * (lock_wait_seconds + attempt_timeout_seconds) + backoff),
# or a stuck last attempt gets killed by the step timeout before this script
# can report the failure itself.
set -euo pipefail

max_attempts=3
attempt_timeout_seconds=240
lock_wait_seconds=90
lock_poll_seconds=5

apt_locks_held() {
  command -v fuser >/dev/null 2>&1 || return 1
  sudo fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock >/dev/null 2>&1
}

wait_for_apt_locks() {
  local waited=0
  while apt_locks_held; do
    if [ "$waited" -ge "$lock_wait_seconds" ]; then
      echo "apt locks still held after ${waited}s, attempting the install anyway" >&2
      return 0
    fi
    if [ "$waited" -eq 0 ]; then
      echo "Waiting for another apt process to release its locks..." >&2
    fi
    sleep "$lock_poll_seconds"
    waited=$((waited + lock_poll_seconds))
  done
  if [ "$waited" -gt 0 ]; then
    echo "apt locks released after ${waited}s" >&2
  fi
}

for attempt in $(seq 1 "$max_attempts"); do
  wait_for_apt_locks
  if timeout "$attempt_timeout_seconds" npx playwright install --with-deps chrome; then
    exit 0
  fi
  echo "Playwright browser install attempt $attempt/$max_attempts failed or timed out" >&2
  if [ "$attempt" -lt "$max_attempts" ]; then
    backoff=$((attempt * 10))
    echo "Retrying in ${backoff}s..." >&2
    sleep "$backoff"
  fi
done

echo "Playwright browser install failed after $max_attempts attempts" >&2
exit 1
