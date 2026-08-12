#!/usr/bin/env bash
# End-to-end smoke against a *running* Wallet API + SECDSA lab.
# Prerequisites:
#   - lab on WSCA_BASE_URL (default http://127.0.0.1:8080), account activated
#   - Wallet API on WALLET_API (default http://127.0.0.1:7001) with WaltCryptoSecdsa.init()
set -euo pipefail

WALLET_API="${WALLET_API:-http://127.0.0.1:7001/wallet-api}"
WSCA_BASE_URL="${WSCA_BASE_URL:-http://127.0.0.1:8080}"
WSCA_ACCOUNT_ID="${WSCA_ACCOUNT_ID:-citizen-42}"
WSCA_PIN="${WSCA_PIN:-424242}"
EMAIL="${SMOKE_EMAIL:-secdsa-smoke-$(date +%s)@example.com}"
PASSWORD="${SMOKE_PASSWORD:-password123}"

echo "→ register $EMAIL"
curl -sS -X POST "${WALLET_API}/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"email\",\"name\":\"SECDSA Smoke\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" >/dev/null

echo "→ login"
TOKEN="$(curl -sS -X POST "${WALLET_API}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"email\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')"

echo "→ wallets"
WALLET_ID="$(curl -sS "${WALLET_API}/wallet/accounts/wallets" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["wallets"][0]["id"])')"
echo "   wallet=$WALLET_ID"

echo "→ generate backend=secdsa"
KEY_ID="$(curl -sS -X POST "${WALLET_API}/wallet/${WALLET_ID}/keys/generate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"backend\":\"secdsa\",\"keyType\":\"secp256r1\",\"config\":{\"baseUrl\":\"${WSCA_BASE_URL}\",\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"pin\":\"${WSCA_PIN}\"}}")"
echo "   keyId=$KEY_ID"

echo "→ export JWK"
curl -sS "${WALLET_API}/wallet/${WALLET_ID}/keys/${KEY_ID}/export?format=JWK&loadPrivateKey=false" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool

echo "→ sign"
curl -sS -X POST "${WALLET_API}/wallet/${WALLET_ID}/keys/${KEY_ID}/sign" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '"smoke-from-wallet-api"'
echo
echo "OK — check lab UI ${WSCA_BASE_URL%/}/ for SIGN"
