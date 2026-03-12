#!/usr/bin/env sh
set -eu

script_dir="$(cd "$(dirname "$0")" && pwd)"
app_root="$(cd "$script_dir/.." && pwd)"

if [ -d "/workspace" ] && [ -x "/workspace/scripts/resolve-oidc-mode.sh" ]; then
  resolved="$(COMPOSE_PROJECT_ROOT="/workspace" /workspace/scripts/resolve-oidc-mode.sh)"
else
  resolved="$(COMPOSE_PROJECT_ROOT="$app_root" "$script_dir/resolve-oidc-mode.sh")"
fi

eval "$resolved"

export OIDC_CLIENT_SECRETS="$OIDC_CLIENT_SECRETS_PATH"

if [ -z "${OIDC_SCOPES:-}" ]; then
  if [ "$OIDC_MODE" = "fallback" ]; then
    export OIDC_SCOPES="${OIDC_FALLBACK_SCOPES:-openid email profile}"
  else
    export OIDC_SCOPES="${OIDC_EXTERNAL_SCOPES:-openid email profile User.Read Presence.Read Presence.ReadWrite}"
  fi
fi

if [ "$OIDC_MODE" = "fallback" ]; then
  discovery_url="${OIDC_FALLBACK_DISCOVERY_URL:-http://fallback-oidc:8080/kiwi-oidc/realms/kiwi-local/.well-known/openid-configuration}"
  max_attempts="${OIDC_FALLBACK_WAIT_ATTEMPTS:-60}"
  sleep_seconds="${OIDC_FALLBACK_WAIT_SLEEP_SECONDS:-1}"
  attempt=1

  while [ "$attempt" -le "$max_attempts" ]; do
    if curl --silent --fail --output /dev/null "$discovery_url"; then
      break
    fi

    if [ "$attempt" -eq "$max_attempts" ]; then
      printf '[app-entrypoint] Fallback OIDC discovery is unavailable at %s.\n' "$discovery_url" >&2
      exit 1
    fi

    printf '[app-entrypoint] Waiting for fallback OIDC discovery (%s), attempt %s/%s...\n' "$discovery_url" "$attempt" "$max_attempts"
    attempt=$((attempt + 1))
    sleep "$sleep_seconds"
  done
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

mkdir -p /tmp/kiwi-sessions

exec frankenphp run --config /etc/caddy/Caddyfile
