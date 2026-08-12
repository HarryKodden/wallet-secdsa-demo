#!/bin/sh
set -eu

base="${WSCA_BASE_URL:-http://lab:8080}"
wait_secs="${WSCA_WAIT_SECONDS:-60}"
i=0

echo "Waiting for WSCA at ${base}/api/state (up to ${wait_secs}s)…"
while [ "$i" -lt "$wait_secs" ]; do
	if curl -sf "${base}/api/state" >/dev/null; then
		echo "WSCA is up."
		exec /app/bin/secdsa-waltid-adapter "$@"
	fi
	i=$((i + 1))
	sleep 1
done

echo "Trust layer not reachable at ${base} — is the lab service running?" >&2
exit 1
