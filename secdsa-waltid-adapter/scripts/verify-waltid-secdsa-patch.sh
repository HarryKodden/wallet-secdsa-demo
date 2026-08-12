#!/usr/bin/env bash
# Re-apply / verify the waltid-identity SECDSA Wallet API PoC patch.
# Expects: ~/Projects/waltid-identity next to this adapter (override WALTID_IDENTITY).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WALTID_IDENTITY="${WALTID_IDENTITY:-$ROOT/../waltid-identity}"
ADAPTER_ROOT="$ROOT"

if [[ ! -f "$WALTID_IDENTITY/settings.gradle.kts" ]]; then
  echo "waltid-identity not found at $WALTID_IDENTITY" >&2
  echo "Clone: git clone --depth 1 https://github.com/walt-id/waltid-identity.git $WALTID_IDENTITY" >&2
  exit 1
fi

echo "Adapter:  $ADAPTER_ROOT"
echo "Identity: $WALTID_IDENTITY"

MODULE="$WALTID_IDENTITY/waltid-libraries/crypto/waltid-crypto-secdsa"
if [[ ! -f "$MODULE/build.gradle.kts" ]]; then
  echo "Missing $MODULE — copy from this repo's patches or re-run the Cursor PoC setup." >&2
  exit 1
fi

if ! grep -q 'waltid-crypto-secdsa' "$WALTID_IDENTITY/settings.gradle.kts"; then
  echo "settings.gradle.kts missing waltid-crypto-secdsa include" >&2
  exit 1
fi
if ! grep -q 'WaltCryptoSecdsa' "$WALTID_IDENTITY/waltid-services/waltid-wallet-api/src/main/kotlin/id/walt/webwallet/Main.kt"; then
  echo "Main.kt missing WaltCryptoSecdsa.init()" >&2
  exit 1
fi
if ! grep -q 'waltid-crypto-secdsa' "$WALTID_IDENTITY/waltid-services/waltid-wallet-api/build.gradle.kts"; then
  echo "wallet-api build.gradle.kts missing secdsa dependency" >&2
  exit 1
fi

echo "✓ Patch markers present"
echo
if [[ "${SKIP_COMPILE:-}" == "1" ]]; then
  echo "SKIP_COMPILE=1 — skipping Gradle compile"
  exit 0
fi

echo "Compile check:"
cd "$WALTID_IDENTITY"
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home 2>/dev/null || true)}"
./gradlew :waltid-libraries:crypto:waltid-crypto-secdsa:compileKotlin \
  :waltid-services:waltid-wallet-api:compileKotlin \
  -PsecdsaAdapterPath="$ADAPTER_ROOT"
echo
echo "Next: build image and run compose — see docs/WALTID_WALLET_API.md §B"
echo "  cd $WALTID_IDENTITY"
echo "  # set docker-compose/.env VERSION_TAG=1.0.0-SNAPSHOT"
echo "  ./gradlew :waltid-services:waltid-wallet-api:jibDockerBuild"
