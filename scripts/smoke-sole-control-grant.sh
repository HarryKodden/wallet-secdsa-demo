#!/usr/bin/env bash
# G3 smoke: SignGrant path with SOLE_CONTROL_SIGNING=true.
#
# Proves: unlock does not leave a free PIN session; authorize-sign mints a grant;
# receive/present without grant → 403; demo /keys/{id}/sign → 403.
# Optional live receive/present when SMOKE_OFFER_URI / SMOKE_PRESENTATION_URI set.
#
# Prerequisites:
#   SOLE_CONTROL_SIGNING=true docker compose up -d wallet-api2 secdsa postgres …
#   (or restart wallet-api2 after flipping the flag)
#
# Env (defaults match local compose host ports):
#   WALLET_API2   http://127.0.0.1:7006
#   WSCA_BASE_URL http://127.0.0.1:8080
#   WSCA_ACCOUNT_ID / WSCA_PIN
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WALLET_API2="${WALLET_API2:-http://127.0.0.1:7006}"
WSCA_BASE_URL="${WSCA_BASE_URL:-http://127.0.0.1:8080}"
WSCA_ACCOUNT_ID="${WSCA_ACCOUNT_ID:-smoke-sc-$(date +%s)}"
WSCA_PIN="${WSCA_PIN:-424242}"
EMAIL="${SMOKE_EMAIL:-secdsa-sc-$(date +%s)@example.com}"
PASSWORD="${SMOKE_PASSWORD:-password123}"

json_get() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"
}

http_code() {
  # usage: http_code METHOD URL [curl args…]  → prints status code; body in /tmp/smoke-sc-body.json
  local method="$1"; shift
  local url="$1"; shift
  curl -sS -o /tmp/smoke-sc-body.json -w '%{http_code}' -X "$method" "$url" "$@"
}

echo "==> G3 sole-control SignGrant smoke"
echo "    WALLET_API2=$WALLET_API2"
echo "    WSCA account=$WSCA_ACCOUNT_ID"
echo "    docs: $ROOT/docs/sole-control-track-a.md"

echo "→ register / emailpass"
REG_CODE="$(http_code POST "${WALLET_API2}/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"
if [[ "$REG_CODE" != "200" && "$REG_CODE" != "201" && "$REG_CODE" != "409" ]]; then
  echo "register failed HTTP $REG_CODE: $(cat /tmp/smoke-sc-body.json)" >&2
  exit 1
fi
TOKEN="$(curl -sS -X POST "${WALLET_API2}/auth/emailpass" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\}" \
  | json_get 'd.get("token") or d["access_token"]')"
[[ -n "$TOKEN" && "$TOKEN" != "None" ]] || { echo "emailpass: missing token" >&2; exit 1; }
AUTH=(-H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json')

echo "→ wallet"
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
    "${AUTH[@]}" -d '{}' | json_get 'd.get("walletId") or d.get("id")')"
fi
echo "   walletId=$WALLET_ID"

echo "→ SoftHSM activate/verify (lab)"
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
    -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"pin\":\"${WSCA_PIN}\",\"op\":\"ECHO\",\"payload\":\"smoke\"}" >/dev/null
else
  curl -sS -f -X POST "${WSCA_BASE_URL}/api/activate" \
    -H 'Content-Type: application/json' \
    -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"pin\":\"${WSCA_PIN}\"}" >/dev/null
fi

echo "→ keys/generate backend=secdsa"
KEY_RESP="$(curl -sS -X POST "${WALLET_API2}/wallet/${WALLET_ID}/keys/generate" \
  "${AUTH[@]}" \
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
[[ -n "$KEY_ID" ]] || { echo "generate failed: $KEY_RESP" >&2; exit 1; }
echo "   keyId=$KEY_ID"

echo "→ status (expect soleControlSigning=true)"
STATUS_JSON="$(curl -sS "${WALLET_API2}/wallet/${WALLET_ID}/keys/secdsa/status?accountId=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${WSCA_ACCOUNT_ID}'''))")" \
  -H "Authorization: Bearer ${TOKEN}")"
SOLE="$(printf '%s' "$STATUS_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("1" if d.get("soleControlSigning") else "0")')"
if [[ "$SOLE" != "1" ]]; then
  echo "SOLE_CONTROL_SIGNING is not enabled on wallet-api2:" >&2
  echo "$STATUS_JSON" | python3 -m json.tool >&2 || echo "$STATUS_JSON" >&2
  echo "Set SOLE_CONTROL_SIGNING=true and recreate wallet-api2, then re-run." >&2
  exit 1
fi

echo "→ unlock (must NOT leave pinSessionActive)"
curl -sS -f -X POST "${WALLET_API2}/wallet/${WALLET_ID}/keys/secdsa/unlock" \
  "${AUTH[@]}" \
  -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"pin\":\"${WSCA_PIN}\"}" >/dev/null
STATUS_JSON="$(curl -sS "${WALLET_API2}/wallet/${WALLET_ID}/keys/secdsa/status?accountId=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${WSCA_ACCOUNT_ID}'''))")" \
  -H "Authorization: Bearer ${TOKEN}")"
PIN_ACTIVE="$(printf '%s' "$STATUS_JSON" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("1" if d.get("pinSessionActive") else "0")')"
if [[ "$PIN_ACTIVE" == "1" ]]; then
  echo "pinSessionActive still true after unlock — sole-control must clear PIN session" >&2
  exit 1
fi
echo "   pinSessionActive=false (good)"

echo "→ demo /keys/{id}/sign must 403"
SIGN_CODE="$(http_code POST "${WALLET_API2}/wallet/${WALLET_ID}/keys/${KEY_ID}/sign" \
  "${AUTH[@]}" -d '{"hello":"world"}')"
if [[ "$SIGN_CODE" != "403" ]]; then
  echo "expected 403 from demo sign, got $SIGN_CODE: $(cat /tmp/smoke-sc-body.json)" >&2
  exit 1
fi
echo "   demo sign → 403 (good)"

echo "→ receive without grant must 403 (when offer provided) or skip"
if [[ -n "${SMOKE_OFFER_URI:-}" ]]; then
  RECV_CODE="$(http_code POST "${WALLET_API2}/wallet/${WALLET_ID}/credentials/receive" \
    "${AUTH[@]}" \
    -d "{\"offerUri\":$(python3 -c "import json; print(json.dumps('''${SMOKE_OFFER_URI}'''))")}")"
  if [[ "$RECV_CODE" != "403" ]]; then
    echo "expected 403 receive without grant, got $RECV_CODE: $(cat /tmp/smoke-sc-body.json)" >&2
    exit 1
  fi
  echo "   receive without grant → 403 (good)"

  echo "→ authorize-sign (issuance)"
  GRANT_JSON="$(curl -sS -X POST "${WALLET_API2}/wallet/${WALLET_ID}/keys/secdsa/authorize-sign" \
    "${AUTH[@]}" \
    -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"keyId\":\"${KEY_ID}\",\"purpose\":\"issuance\",\"pin\":\"${WSCA_PIN}\",\"binding\":{\"clientId\":\"wallet-secdsa-demo\"}}")"
  GRANT="$(printf '%s' "$GRANT_JSON" | json_get 'd["signGrant"]')"
  [[ -n "$GRANT" && "$GRANT" != "None" ]] || { echo "authorize-sign failed: $GRANT_JSON" >&2; exit 1; }

  echo "→ receive with grant"
  curl -sS -f -X POST "${WALLET_API2}/wallet/${WALLET_ID}/credentials/receive" \
    "${AUTH[@]}" \
    -d "{\"offerUri\":$(python3 -c "import json; print(json.dumps('''${SMOKE_OFFER_URI}'''))"),\"clientId\":\"wallet-secdsa-demo\",\"signGrant\":\"${GRANT}\"}" >/dev/null
  echo "   receive with grant OK"
else
  echo "↷ SKIP live receive (set SMOKE_OFFER_URI)"
  echo "→ authorize-sign mint/consume check (issuance grant, no receive)"
  GRANT_JSON="$(curl -sS -X POST "${WALLET_API2}/wallet/${WALLET_ID}/keys/secdsa/authorize-sign" \
    "${AUTH[@]}" \
    -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"keyId\":\"${KEY_ID}\",\"purpose\":\"issuance\",\"pin\":\"${WSCA_PIN}\"}")"
  GRANT_CODE="$(printf '%s' "$GRANT_JSON" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print("ok" if d.get("signGrant") else "fail")
except Exception:
  print("fail")')"
  if [[ "$GRANT_CODE" != "ok" ]]; then
    echo "authorize-sign failed: $GRANT_JSON" >&2
    exit 1
  fi
  echo "   authorize-sign minted grant (good)"
fi

if [[ -n "${SMOKE_PRESENTATION_URI:-}" ]]; then
  echo "→ present without grant must 403"
  PRES_CODE="$(http_code POST "${WALLET_API2}/wallet/${WALLET_ID}/credentials/present" \
    "${AUTH[@]}" \
    -d "{\"requestUrl\":$(python3 -c "import json; print(json.dumps('''${SMOKE_PRESENTATION_URI}'''))")}")"
  if [[ "$PRES_CODE" != "403" ]]; then
    echo "expected 403 present without grant, got $PRES_CODE: $(cat /tmp/smoke-sc-body.json)" >&2
    exit 1
  fi
  echo "→ authorize-sign (presentation) + present"
  GRANT_JSON="$(curl -sS -X POST "${WALLET_API2}/wallet/${WALLET_ID}/keys/secdsa/authorize-sign" \
    "${AUTH[@]}" \
    -d "{\"accountId\":\"${WSCA_ACCOUNT_ID}\",\"keyId\":\"${KEY_ID}\",\"purpose\":\"presentation\",\"pin\":\"${WSCA_PIN}\"}")"
  GRANT="$(printf '%s' "$GRANT_JSON" | json_get 'd["signGrant"]')"
  curl -sS -f -X POST "${WALLET_API2}/wallet/${WALLET_ID}/credentials/present" \
    "${AUTH[@]}" \
    -d "{\"requestUrl\":$(python3 -c "import json; print(json.dumps('''${SMOKE_PRESENTATION_URI}'''))"),\"keyId\":\"${KEY_ID}\",\"signGrant\":\"${GRANT}\"}" >/dev/null
  echo "   present with grant OK"
else
  echo "↷ SKIP live present (set SMOKE_PRESENTATION_URI)"
fi

echo "OK — G3 sole-control grant path green"
echo "    Rollback: SOLE_CONTROL_SIGNING=false (or unset) and recreate wallet-api2."
