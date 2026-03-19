#!/usr/bin/env sh
set -eu

script_dir="$(cd "$(dirname "$0")" && pwd)"
app_root="$(cd "$script_dir/.." && pwd)"
resolved="$(COMPOSE_PROJECT_ROOT="$app_root" "$script_dir/resolve-oidc-mode.sh")"

eval "$resolved"

export OIDC_CLIENT_SECRETS="$OIDC_CLIENT_SECRETS_PATH"

if [ -z "${OIDC_SCOPES:-}" ]; then
  if [ "$OIDC_MODE" = "fallback" ]; then
    export OIDC_SCOPES="${OIDC_FALLBACK_SCOPES:-openid email profile}"
  else
    case "${TEAMS_PRESENCE_SYNC_ENABLED:-false}" in
      1|true|TRUE|yes|YES|on|ON)
        export OIDC_SCOPES="${OIDC_EXTERNAL_SCOPES:-openid email profile User.Read Presence.Read Presence.ReadWrite}"
        ;;
      *)
        export OIDC_SCOPES="${OIDC_EXTERNAL_SCOPES:-openid email profile User.Read}"
        ;;
    esac
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

mkdir -p "$app_root/var/cache" "$app_root/var/log"

vendor_autoload="$app_root/vendor/autoload.php"
composer_lock="$app_root/composer.lock"
vendor_missing=0

if [ ! -f "$vendor_autoload" ]; then
  vendor_missing=1
elif [ -f "$composer_lock" ] && [ "$composer_lock" -nt "$vendor_autoload" ]; then
  vendor_missing=1
fi

if [ "${APP_ENV:-dev}" = "dev" ] && [ "$vendor_missing" -eq 1 ]; then
  printf '[app-entrypoint] Installing Composer dependencies for the mounted dev workspace.\n'
  composer install --prefer-dist --no-interaction
fi

should_bootstrap_sessions="${SESSION_BOOTSTRAP_ON_START:-0}"
if [ "$should_bootstrap_sessions" = "1" ]; then
  printf '[app-entrypoint] Bootstrapping the PostgreSQL session table.\n'
  php bin/console app:sessions:bootstrap --no-interaction
fi

exec frankenphp run --config /etc/caddy/Caddyfile
