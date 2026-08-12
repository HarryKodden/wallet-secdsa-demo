#!/usr/bin/env bash
# Issuer-api2 is no longer built from waltid-identity.
# Use stock: waltid/issuer-api2:stable (see docker-compose.yml ISSUER_API2_IMAGE).
echo "issuer-api2: use Docker Hub waltid/issuer-api2 (no local build)." >&2
exit 0
