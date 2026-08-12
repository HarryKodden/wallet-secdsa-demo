#!/usr/bin/env bash
# Smoke: generate a SECDSA-backed key via walt.id Wallet API.
# Requires a Wallet API build that calls WaltCryptoSecdsa.init() (see docs/WALTID_WALLET_API.md).
#
# Usage:
#   export WALLET_ID=... TOKEN=...   # from walt.id login / tutorial
#   export WSCA_BASE_URL=http://host.docker.internal:8080   # lab from walt.id container's view
#   ./scripts/smoke-wallet-secdsa.sh
set -euo pipefail

WALLET_API="${WALLET_API:-http://localhost:7001/wallet-api}"
WSCA_BASE_URL="${WSCA_BASE_URL:-http://host.docker.internal:8080}"
WSCA_ACCOUNT_ID="${WSCA_ACCOUNT_ID:-citizen-42}"
WSCA_PIN="${WSCA_PIN:-424242}"

: "${WALLET_ID:?Set WALLET_ID (walt.id wallet uuid)}"
: "${TOKEN:?Set TOKEN (Bearer access token from walt.id auth)}"

echo "→ POST ${WALLET_API}/wallet/${WALLET_ID}/keys/generate (backend=secdsa)"
resp="$(curl -sS -w "\n%{http_code}" -X POST \
  "${WALLET_API}/wallet/${WALLET_ID}/keys/generate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "backend": "secdsa",
  "keyType": "secp256r1",
  "config": {
    "baseUrl": "${WSCA_BASE_URL}",
    "accountId": "${WSCA_ACCOUNT_ID}",
    "pin": "${WSCA_PIN}"
  }
}
EOF
)")"

body="$(echo "$resp" | sed '$d')"
code="$(echo "$resp" | tail -n1)"
echo "HTTP ${code}"
echo "$body"
if [[ "$code" != "201" ]]; then
  echo "Expected 201 Created. Stock walt.id images reject backend=secdsa until WaltCryptoSecdsa.init() is wired." >&2
  exit 1
fi

key_id="$(echo "$body" | tr -d '"')"
echo "→ export public JWK for key ${key_id}"
curl -sS \
  "${WALLET_API}/wallet/${WALLET_ID}/keys/${key_id}/export?format=JWK&loadPrivateKey=false" \
  -H "Authorization: Bearer ${TOKEN}"
echo
echo "Check SECDSA lab UI timeline for GENKEY: http://localhost:8080"
