#!/usr/bin/env bash
# Verifier-api2 is no longer built from waltid-identity.
# Use stock: waltid/verifier-api2:stable (see docker-compose.yml VERIFIER_API2_IMAGE).
echo "verifier-api2: use Docker Hub waltid/verifier-api2 (no local build)." >&2
exit 0
