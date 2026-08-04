#!/usr/bin/env bash
# Build waltid-wallet-api2 with SECDSA backend into ./wallet-api2/dist
# Requires sibling checkouts (override with env):
#   WALTID_IDENTITY_PATH  — waltid-identity monorepo
#   SECDSA_ADAPTER_PATH   — secdsa-waltid-adapter sources
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WALTID_IDENTITY_PATH="${WALTID_IDENTITY_PATH:-$HOME/Projects/waltid-identity}"
SECDSA_ADAPTER_PATH="${SECDSA_ADAPTER_PATH:-$HOME/Projects/secdsa-waltid-adapter}"
JAVA_HOME="${JAVA_HOME:-${HOME}/homebrew/opt/openjdk}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

if [[ ! -d "$WALTID_IDENTITY_PATH" ]]; then
  echo "Missing waltid-identity at $WALTID_IDENTITY_PATH" >&2
  exit 1
fi
if [[ ! -d "$SECDSA_ADAPTER_PATH" ]]; then
  echo "Missing secdsa-waltid-adapter at $SECDSA_ADAPTER_PATH" >&2
  exit 1
fi

echo "==> installDist (SECDSA) from $WALTID_IDENTITY_PATH"
cd "$WALTID_IDENTITY_PATH"
./gradlew :waltid-services:waltid-wallet-api2:installDist \
  -PsecdsaAdapterPath="$SECDSA_ADAPTER_PATH" \
  -PenableIosBuild=false \
  --no-daemon --no-configuration-cache

DIST_SRC="$WALTID_IDENTITY_PATH/waltid-services/waltid-wallet-api2/build/install/waltid-wallet-api2"
DIST_DST="$ROOT/wallet-api2/dist"
rm -rf "$DIST_DST"
cp -a "$DIST_SRC" "$DIST_DST"
rm -f "$DIST_DST"/lib/bcprov-jdk18on-*.jar \
      "$DIST_DST"/lib/bcpkix-jdk18on-*.jar \
      "$DIST_DST"/lib/bcutil-jdk18on-*.jar

echo "==> built $DIST_DST ($(du -sh "$DIST_DST" | awk '{print $1}'))"
echo "Next: docker compose build wallet-api2"
