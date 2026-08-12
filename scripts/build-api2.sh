#!/usr/bin/env bash
# Build wallet-api2 installDist into ./wallet-api2/dist (SECDSA-enabled).
#
# Uses published walt.id Maven artifacts + in-repo secdsa-waltid-adapter.
# Does **not** require waltid-identity / waltid-identity-secdsa.
#
# Usage:
#   ./scripts/build-api2.sh                 # wallet only (issuer/verifier = stock Hub images)
#   ./scripts/build-api2.sh wallet
#
# Env:
#   JAVA_HOME  — JDK 21+ (defaults to Homebrew OpenJDK if present)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAVA_HOME="${JAVA_HOME:-${HOME}/homebrew/opt/openjdk}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

targets=("$@")
if [[ ${#targets[@]} -eq 0 || "${targets[0]}" == "all" ]]; then
  targets=(wallet)
fi

for t in "${targets[@]}"; do
  case "$t" in
    wallet) ;;
    issuer|verifier)
      echo "Skipping '$t' — use stock Docker Hub images (waltid/issuer-api2, waltid/verifier-api2)." >&2
      echo "Override locally with ISSUER_API2_IMAGE / VERIFIER_API2_IMAGE if needed." >&2
      ;;
    *)
      echo "Unknown target '$t' (expected: wallet)" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$ROOT/secdsa-waltid-adapter/src/main/kotlin" ]]; then
  echo "Missing in-repo adapter at $ROOT/secdsa-waltid-adapter" >&2
  exit 1
fi

echo "==> wallet-api2 installDist (Maven walt.id + ./secdsa-waltid-adapter)"
cd "$ROOT/wallet-api2"
./gradlew installDistToDist --no-daemon --no-configuration-cache

dist_dst="$ROOT/wallet-api2/dist"
if [[ ! -x "$dist_dst/bin/waltid-wallet-api2" ]]; then
  echo "Missing $dist_dst/bin/waltid-wallet-api2" >&2
  exit 1
fi

# SoftHSM path: strip BC jars that conflict with the lab stack
rm -f "$dist_dst"/lib/bcprov-jdk18on-*.jar \
      "$dist_dst"/lib/bcpkix-jdk18on-*.jar \
      "$dist_dst"/lib/bcutil-jdk18on-*.jar

echo "==> built $dist_dst ($(du -sh "$dist_dst" | awk '{print $1}'))"
echo "Next: docker compose build wallet-api2"
echo "Smoke (stack up): ./scripts/smoke-holder-contract.sh"
