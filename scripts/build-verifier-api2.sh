#!/usr/bin/env bash
# Build waltid-verifier-api2 into ./verifier-api2/dist
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/build-api2.sh" verifier
