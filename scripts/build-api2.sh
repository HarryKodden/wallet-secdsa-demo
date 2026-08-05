#!/usr/bin/env bash
# Build waltid *-api2 installDist trees into ./<service>/dist
#
# Usage:
#   ./scripts/build-api2.sh                 # wallet + issuer + verifier
#   ./scripts/build-api2.sh wallet          # wallet-api2 only
#   ./scripts/build-api2.sh issuer verifier
#
# Requires sibling checkouts (override with env):
#   WALTID_IDENTITY_PATH  — private SECDSA mirror of waltid-identity
#                           (https://github.com/HarryKodden/waltid-identity-secdsa)
#   SECDSA_ADAPTER_PATH   — secdsa-waltid-adapter sources
#                           (needed for Gradle config even when not building wallet)
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

targets=("$@")
if [[ ${#targets[@]} -eq 0 || "${targets[0]}" == "all" ]]; then
  targets=(wallet issuer verifier)
fi

gradle_tasks=()
for t in "${targets[@]}"; do
  case "$t" in
    wallet)
      gradle_tasks+=(":waltid-services:waltid-wallet-api2:installDist")
      ;;
    issuer)
      gradle_tasks+=(":waltid-services:waltid-issuer-api2:installDist")
      ;;
    verifier)
      gradle_tasks+=(":waltid-services:waltid-verifier-api2:installDist")
      ;;
    *)
      echo "Unknown target '$t' (expected: wallet, issuer, verifier, all)" >&2
      exit 1
      ;;
  esac
done

echo "==> installDist (${targets[*]}) from $WALTID_IDENTITY_PATH"
cd "$WALTID_IDENTITY_PATH"
./gradlew "${gradle_tasks[@]}" \
  -PsecdsaAdapterPath="$SECDSA_ADAPTER_PATH" \
  -PenableIosBuild=false \
  --no-daemon --no-configuration-cache

copy_dist() {
  local dist_name="$1"
  local out_dir="$2"
  local strip_bc="${3:-0}"
  local dist_src="$WALTID_IDENTITY_PATH/waltid-services/${dist_name}/build/install/${dist_name}"
  local dist_dst="$ROOT/${out_dir}/dist"
  if [[ ! -d "$dist_src" ]]; then
    echo "Missing installDist output at $dist_src" >&2
    exit 1
  fi
  rm -rf "$dist_dst"
  cp -a "$dist_src" "$dist_dst"
  if [[ "$strip_bc" == "1" ]]; then
    # wallet SECDSA SoftHSM path: strip BC jars that conflict with the lab stack
    rm -f "$dist_dst"/lib/bcprov-jdk18on-*.jar \
          "$dist_dst"/lib/bcpkix-jdk18on-*.jar \
          "$dist_dst"/lib/bcutil-jdk18on-*.jar
  fi
  echo "==> built $dist_dst ($(du -sh "$dist_dst" | awk '{print $1}'))"
}

for t in "${targets[@]}"; do
  case "$t" in
    wallet) copy_dist waltid-wallet-api2 wallet-api2 1 ;;
    issuer) copy_dist waltid-issuer-api2 issuer-api2 0 ;;
    verifier) copy_dist waltid-verifier-api2 verifier-api2 0 ;;
  esac
done

echo "Next: docker compose build <service>  (or rely on CI GHCR images)"
