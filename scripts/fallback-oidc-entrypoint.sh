#!/usr/bin/env sh
set -eu

resolved="$("/workspace/scripts/resolve-oidc-mode.sh")"
eval "$resolved"

if [ "$OIDC_MODE" != "fallback" ]; then
  printf '[fallback-oidc] External OIDC config detected at %s. Skipping fallback Keycloak startup.\n' "$OIDC_CLIENT_SECRETS_PATH"
  # Keep this container alive so gateway DNS resolution for fallback-oidc remains valid.
  exec sh -c 'while :; do sleep 3600; done'
fi

printf '[fallback-oidc] Starting Keycloak fallback OIDC server with realm import.\n'
exec /opt/keycloak/bin/kc.sh start-dev --import-realm
