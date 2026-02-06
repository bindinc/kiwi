#!/usr/bin/env bash
set -euo pipefail

resolved="$('/workspace/scripts/resolve-oidc-mode.sh')"
eval "$resolved"

if [[ "$OIDC_MODE" != "fallback" ]]; then
  exit 0
fi

exec 3<>/dev/tcp/127.0.0.1/8080
printf 'GET /kiwi-oidc/realms/kiwi-local/.well-known/openid-configuration HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n' >&3
IFS= read -r status_line <&3

if [[ "$status_line" != *" 200 "* ]]; then
  printf '[fallback-oidc-healthcheck] Unexpected status line: %s\n' "$status_line" >&2
  exit 1
fi
