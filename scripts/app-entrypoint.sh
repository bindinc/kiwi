#!/usr/bin/env sh
set -eu

script_dir="$(cd "$(dirname "$0")" && pwd)"
app_root="$(cd "$script_dir/.." && pwd)"
resolved="$(COMPOSE_PROJECT_ROOT="$app_root" "$script_dir/resolve-oidc-mode.sh")"

eval "$resolved"

export OIDC_CLIENT_SECRETS="$OIDC_CLIENT_SECRETS_PATH"

is_truthy_flag() {
  case "$1" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

uses_microsoft_entra_oidc() {
  php -r '
    $path = $argv[1] ?? "";
    if ("" === $path || !is_file($path)) {
        exit(1);
    }

    $raw = file_get_contents($path);
    if (false === $raw) {
        exit(1);
    }

    $decoded = json_decode($raw, true);
    $web = is_array($decoded["web"] ?? null) ? $decoded["web"] : [];
    $hosts = [
        "graph.microsoft.com",
        "login.microsoftonline.com",
        "login.windows.net",
        "sts.windows.net",
    ];

    foreach (["issuer", "auth_uri", "token_uri", "userinfo_uri"] as $key) {
        $value = $web[$key] ?? null;
        if (!is_string($value) || "" === trim($value)) {
            continue;
        }

        $host = strtolower((string) parse_url($value, PHP_URL_HOST));
        if ("" === $host) {
            continue;
        }

        if (in_array($host, $hosts, true) || str_ends_with($host, ".microsoftonline.com")) {
            exit(0);
        }
    }

    exit(1);
  ' -- "$OIDC_CLIENT_SECRETS_PATH"
}

should_enable_presence_sync() {
  if [ "$OIDC_MODE" = "fallback" ]; then
    return 1
  fi

  if [ "${TEAMS_PRESENCE_SYNC_ENABLED+x}" = "x" ]; then
    is_truthy_flag "${TEAMS_PRESENCE_SYNC_ENABLED}"
    return $?
  fi

  uses_microsoft_entra_oidc
}

if should_enable_presence_sync; then
  export TEAMS_PRESENCE_SYNC_ENABLED="${TEAMS_PRESENCE_SYNC_ENABLED:-true}"
else
  export TEAMS_PRESENCE_SYNC_ENABLED="${TEAMS_PRESENCE_SYNC_ENABLED:-false}"
fi

if [ -z "${OIDC_SCOPES:-}" ]; then
  if [ "$OIDC_MODE" = "fallback" ]; then
    export OIDC_SCOPES="${OIDC_FALLBACK_SCOPES:-openid email profile}"
  else
    if should_enable_presence_sync; then
      export OIDC_SCOPES="${OIDC_EXTERNAL_SCOPES:-openid email profile User.Read Presence.Read Presence.ReadWrite}"
    else
      export OIDC_SCOPES="${OIDC_EXTERNAL_SCOPES:-openid email profile User.Read}"
    fi
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

should_sync_webabo_offers="${WEBABO_OFFER_SYNC_ON_START:-${WERFSLEUTEL_SYNC_ON_START:-0}}"
if [ "$should_sync_webabo_offers" = "1" ]; then
  if [ "$OIDC_MODE" = "fallback" ]; then
    printf '[app-entrypoint] Skipping Webabo offer sync on start because fallback OIDC mode does not provide live Webabo credentials.\n'
  else
    printf '[app-entrypoint] Synchronizing Webabo offers into webabo_offers_cache.\n'
    if ! php bin/console app:webabo:sync-offers --no-interaction; then
      printf '[app-entrypoint] Webabo offer sync failed. The app will continue to start, but the Nieuw Abonnement search may stay empty until the sync succeeds.\n' >&2
    fi
  fi
fi

exec frankenphp run --config /etc/caddy/Caddyfile
