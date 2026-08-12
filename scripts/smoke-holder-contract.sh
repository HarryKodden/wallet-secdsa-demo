#!/usr/bin/env bash
# Phase 0 smoke: frozen holder contract against a running stack.
#
# Covers: register/emailpass → wallet → SoftHSM unlock → SECDSA key → did:jwk
# Receive/present need live offers/requests; those steps print SKIP unless
# SMOKE_OFFER_URI / SMOKE_PRESENTATION_URI are set.
#
# Prerequisites:
#   docker compose up  (wallet-api2, secdsa/SoftHSM, optional web-wallet)
#
# Env (defaults match local compose host ports):
#   WALLET_API2   http://127.0.0.1:7006
#   WSCA_BASE_URL http://127.0.0.1:8080   # SoftHSM lab; use host port from compose
#   WSCA_ACCOUNT_ID / WSCA_PIN
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WALLET_API2="${WALLET_API2:-http://127.0.0.1:7006}"
WSCA_BASE_URL="${WSCA_BASE_URL:-http://127.0.0.1:8080}"
WSCA_ACCOUNT_ID="${WSCA_ACCOUNT_ID:-smoke-$(date +%s)}"
WSCA_PIN="${WSCA_PIN:-424242}"
EMAIL="${SMOKE_EMAIL:-secdsa-smoke-$(date +%s)@example.com}"
PASSWORD="${SMOKE_PASSWORD:-password123}"

json_get() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"
}

echo "==> Phase 0 holder contract smoke"
echo "    WALLET_API2=$WALLET_API2"
echo "    WSCA_BASE_URL=$WSCA_BASE_URL account=$WSCA_ACCOUNT_ID"
echo "    contract: $ROOT/docs/http-contract.md"

echo "→ register"
REG_CODE="$(curl -sS -o /tmp/smoke-reg.json -w '%{http_code}' -X POST "${WALLET_API2}/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"
if [[ "$REG_CODE" != "200" && "$REG_CODE" != "201" && "$REG_CODE" != "409" ]]; then
  echo "register failed HTTP $REG_CODE: $(cat /tmp/smoke-reg.json)" >&2
  exit 1
fi

echo "→ emailpass"
TOKEN="$(curl -sS -X POST "${WALLET_API2}/auth/emailpass" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\}" \
  | json_get 'd.get("token") or d["access_token"]')"
if [[ -z "$TOKEN" || "$TOKEN" == "None" ]]; then
  echo "emailpass: missing token" >&2
  exit 1
fi

echo "→ list/create wallet"
WALLETS_RAW="$(curl -sS "${WALLET_API2}/wallet" -H "Authorization: Bearer ${TOKEN}")"
WALLET_ID="$(printf '%s' "$WALLETS_RAW" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if isinstance(d, list) and d:
    print(d[0] if isinstance(d[0], str) else d[0].get("id") or d[0].get("walletId") or "")
elif isinstance(d, dict):
    ids = d.get("walletIds") or []
    print(ids[0] if ids else "")
')"
if [[ -z "$WALLET_ID" ]]; then
  WALLET_ID="$(curl -sS -X POST "${WALLET_API2}/wallet" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{}' | json_get 'd.get("walletId") or d.get("id")')"
fi
echo "   walletId=$WALLET_ID"

# SoftHSM unlock via public WSCA API (same semantics as Nitro unlock route).
# Not activated → /api/activate; activated → /api/instruct ECHO.
echo "→ SoftHSM PIN (activate or instruct)"
STATUS="$(curl -sS "${WSCA_BASE_URL}/api/status?accountId=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${WSCA_ACCOUNT_ID}'''))")" || true)"
ACTIVATED="$(printf '%s' "$STATUS" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print("1" if d.get("activated") or d.get("active") else "0")
except Exception:
  print("0")' 2>/dev/null || echo 0)"
if [[ "$ACTIVATED" == "1" ]]; then
  curl -sS -f -X POST "${WSCA_BASE_URL}/api/instruct" \
    -H 'Content-Type: application/json' \
    -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"pin\":\"${WSCA_PIN}\",\"op\":\"ECHO\",\"payload\":\"smoke\"}" >/dev/null \
    || { echo "instruct (PIN verify) failed" >&2; exit 1; }
else
  curl -sS -f -X POST "${WSCA_BASE_URL}/api/activate" \
    -H 'Content-Type: application/json' \
    -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"pin\":\"${WSCA_PIN}\"}" >/dev/null \
    || { echo "activate failed" >&2; exit 1; }
fi

echo "→ keys/generate backend=secdsa"
KEY_RESP="$(curl -sS -X POST "${WALLET_API2}/wallet/${WALLET_ID}/keys/generate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"backend\":\"secdsa\",\"keyType\":\"secp256r1\",\"name\":\"SECDSA\",\"config\":{\"baseUrl\":\"${WSCA_BASE_URL}\",\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"pin\":\"${WSCA_PIN}\"}}")"
KEY_ID="$(printf '%s' "$KEY_RESP" | python3 -c '
import sys, json
raw = sys.stdin.read().strip()
try:
  d = json.loads(raw)
  print(d.get("keyId") or d.get("id") or "")
except Exception:
  print(raw.strip("\"") if raw else "")
')"
if [[ -z "$KEY_ID" ]]; then
  echo "generate failed: $KEY_RESP" >&2
  exit 1
fi
echo "   keyId=$KEY_ID"

echo "→ dids/create method=jwk"
curl -sS -f -X POST "${WALLET_API2}/wallet/${WALLET_ID}/dids/create" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"method\":\"jwk\",\"keyId\":\"${KEY_ID}\"}" >/dev/null
echo "   did:jwk created"

if [[ -n "${SMOKE_OFFER_URI:-}" ]]; then
  echo "→ credentials/receive/resolve-offer"
  curl -sS -f -X POST "${WALLET_API2}/wallet/${WALLET_ID}/credentials/receive/resolve-offer" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"offerUri\":$(python3 -c "import json; print(json.dumps('''${SMOKE_OFFER_URI}'''))")}" | python3 -m json.tool >/dev/null
  echo "→ credentials/receive"
  curl -sS -f -X POST "${WALLET_API2}/wallet/${WALLET_ID}/credentials/receive" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"offerUri\":$(python3 -c "import json; print(json.dumps('''${SMOKE_OFFER_URI}'''))")}" >/dev/null
else
  echo "↷ SKIP receive (set SMOKE_OFFER_URI to exercise)"
fi

if [[ -n "${SMOKE_PRESENTATION_URI:-}" ]]; then
  echo "→ credentials/present/resolve-request"
  curl -sS -f -X POST "${WALLET_API2}/wallet/${WALLET_ID}/credentials/present/resolve-request" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"requestUri\":$(python3 -c "import json; print(json.dumps('''${SMOKE_PRESENTATION_URI}'''))")}" | python3 -m json.tool >/dev/null
else
  echo "↷ SKIP present (set SMOKE_PRESENTATION_URI to exercise)"
fi

echo "OK — Phase 0 core path green (login → PIN → key → DID)"
echo "    See docs/http-contract.md for the frozen surface."
