#!/usr/bin/env bash
# Build waltid-wallet-api2 with SECDSA backend into ./wallet-api2/dist
# Thin wrapper around scripts/build-api2.sh (wallet target).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/build-api2.sh" wallet
