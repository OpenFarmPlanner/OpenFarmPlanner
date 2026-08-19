#!/usr/bin/env bash
#
# Installs Playwright's Chrome channel on a CI runner.
#
# Shared by .github/workflows/e2e.yml and frontend-build.yml, which both need
# the browser before `npm run build` (the frontend's `postbuild` script,
# build/prerender.ts, launches Chrome itself).
#
# The failure this guards against, observed repeatedly in CI: the Ubuntu
# mirror the runner is pinned to (azure.archive.ubuntu.com) goes unreachable,
# apt sits in its own retry loop for minutes, and the `timeout` around the
# attempt kills `npx` — but the apt-get it spawned as root survives as an
# orphan and keeps /var/lib/apt/lists/lock held. That orphan never recovers,
# so every later attempt dies on the lock instead of installing anything.
#
# Three layers deal with that:
#
# 1. Fail fast. A drop-in apt config caps the per-mirror timeout and retries,
#    so apt gives up on a dead mirror in seconds and falls through to the
#    working archive.ubuntu.com entry instead of hanging.
# 2. Clear the way. Before each attempt, briefly wait for any apt lock to be
#    released, then kill whatever still holds it and repair dpkg. Waiting
#    alone is not enough: the wedged orphan is stuck on network I/O and holds
#    the lock until the job dies.
# 3. Fall back. If all attempts fail, install the browser without
#    `--with-deps` and verify it actually launches. `--with-deps` only adds OS
#    libraries that the GitHub runner image already ships (it comes with
#    Chrome preinstalled), so a browser that launches is a genuine success,
#    not a masked failure — the original outages had a working Chrome on disk
#    while the job failed on apt.
#
# The caller's step timeout must exceed this script's worst case
# (max_attempts * (lock_wait + attempt_timeout) + backoff + fallback).
set -euo pipefail

max_attempts=3
attempt_timeout_seconds=240
lock_wait_seconds=30
lock_poll_seconds=5

apt_lock_files=(/var/lib/apt/lists/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock)

configure_apt_to_fail_fast() {
  sudo tee /etc/apt/apt.conf.d/99-ci-fail-fast >/dev/null <<'APTCONF'
Acquire::http::Timeout "15";
Acquire::https::Timeout "15";
Acquire::ftp::Timeout "15";
Acquire::Retries "1";
APTCONF
}

apt_locks_held() {
  command -v fuser >/dev/null 2>&1 || return 1
  sudo fuser "${apt_lock_files[@]}" >/dev/null 2>&1
}

clear_apt_locks() {
  local waited=0
  while apt_locks_held; do
    if [ "$waited" -ge "$lock_wait_seconds" ]; then
      echo "apt locks still held after ${waited}s, terminating the stuck apt process" >&2
      # SIGKILL rather than SIGTERM: the process is blocked on network I/O
      # from a mirror that never answers and does not act on TERM.
      sudo fuser -k -KILL "${apt_lock_files[@]}" >/dev/null 2>&1 || true
      sleep "$lock_poll_seconds"
      # Killing apt mid-transaction can leave dpkg half-configured; repair it
      # so the next attempt starts from a consistent state.
      sudo dpkg --configure -a >/dev/null 2>&1 || true
      return 0
    fi
    if [ "$waited" -eq 0 ]; then
      echo "Waiting for another apt process to release its locks..." >&2
    fi
    sleep "$lock_poll_seconds"
    waited=$((waited + lock_poll_seconds))
  done
}

install_without_deps_and_verify() {
  echo "Falling back to installing the browser without OS dependencies..." >&2
  timeout "$attempt_timeout_seconds" npx playwright install chrome || return 1
  echo "Verifying that the browser launches..." >&2
  node -e "
    const { chromium } = require('playwright-core');
    chromium.launch({ channel: 'chrome' })
      .then((browser) => browser.close())
      .catch((error) => { console.error(error.message); process.exit(1); });
  "
}

configure_apt_to_fail_fast

for attempt in $(seq 1 "$max_attempts"); do
  clear_apt_locks
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
clear_apt_locks
if install_without_deps_and_verify; then
  echo "Browser installed and verified without the apt dependency step." >&2
  exit 0
fi

echo "Could not install a working browser" >&2
exit 1
