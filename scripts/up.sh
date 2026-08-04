#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    echo "==> No .env found — copying .env.example (edit secrets before production use)"
    cp .env.example .env
  else
    echo "Missing .env (and no .env.example). Create .env before continuing." >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ ! -x "$ROOT/wallet-api2/dist/bin/waltid-wallet-api2" ]]; then
  echo "==> wallet-api2 dist missing — building…"
  "$ROOT/scripts/build-wallet-api2.sh"
fi

echo "==> docker compose up --build -d"
docker compose up --build -d

echo
echo "Stack is starting. URLs:"
echo "  Web wallet (SECDSA PIN):  http://localhost:${WEB_WALLET_HOST_PORT:-7115}"
echo "  Wallet API2 / swagger:    http://localhost:${WALLET_API2_HOST_PORT:-7006}/swagger"
echo "  Issuer API2 / swagger:    http://localhost:${ISSUER_API2_HOST_PORT:-7005}/swagger"
echo "  Verifier API2 / swagger:  http://localhost:${VERIFIER_API2_HOST_PORT:-7004}/swagger"
echo "  SECDSA lab UI:            http://localhost:${SECDSA_HOST_PORT:-18080}"
echo
echo "Lab account: ${WSCA_ACCOUNT_ID:-citizen-42}  PIN: ${WSCA_PIN:-424242}"
echo
echo "If ports are busy, change *_HOST_PORT in .env and re-run."
