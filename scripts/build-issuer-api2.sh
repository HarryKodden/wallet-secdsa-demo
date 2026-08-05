#!/usr/bin/env bash
# Build waltid-issuer-api2 into ./issuer-api2/dist
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/build-api2.sh" issuer
