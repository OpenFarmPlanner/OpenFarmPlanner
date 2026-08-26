#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

detect_lan_ip() {
  ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}'
}

LAN_IP="${LAN_IP:-$(detect_lan_ip)}"
if [[ -z "${LAN_IP}" ]]; then
  echo "Could not detect a LAN IP. Set LAN_IP manually, for example: LAN_IP=192.168.178.125 scripts/dev-lan.sh" >&2
  exit 1
fi

case "${DEBUG:-}" in
  ""|True|true|1|yes|Yes)
    export DEBUG=True
    ;;
  False|false|0|no|No)
    export DEBUG=False
    ;;
  *)
    echo "Ignoring unsupported ambient DEBUG=${DEBUG}; using DEBUG=True for LAN development." >&2
    export DEBUG=True
    ;;
esac
export DJANGO_ENV="${DJANGO_ENV:-development}"
export DEV_LAN_HOSTS="${DEV_LAN_HOSTS:-${LAN_IP}}"
export ALLOWED_HOSTS="${ALLOWED_HOSTS:-localhost,127.0.0.1,${LAN_IP}}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://${LAN_IP}:${FRONTEND_PORT}}"
export CSRF_TRUSTED_ORIGINS="${CSRF_TRUSTED_ORIGINS:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://${LAN_IP}:${FRONTEND_PORT}}"
export FRONTEND_URL="${FRONTEND_URL:-http://${LAN_IP}:${FRONTEND_PORT}}"
export PUBLIC_FRONTEND_URL="${PUBLIC_FRONTEND_URL:-${FRONTEND_URL}}"

echo "Starting OpenFarmPlanner for LAN development"
echo "Frontend: http://${LAN_IP}:${FRONTEND_PORT}"
echo "Backend:  http://${LAN_IP}:${BACKEND_PORT}"
echo "Local:    http://localhost:${FRONTEND_PORT}"
echo

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  cd "${ROOT_DIR}/backend"
  pdm run python manage.py runserver "0.0.0.0:${BACKEND_PORT}"
) &

(
  cd "${ROOT_DIR}/frontend"
  npm run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT}"
) &

wait
