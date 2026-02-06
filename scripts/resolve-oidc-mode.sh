#!/usr/bin/env sh
set -eu

if [ -n "${COMPOSE_PROJECT_ROOT:-}" ]; then
  project_root="$COMPOSE_PROJECT_ROOT"
else
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  project_root="$(cd "$script_dir/.." && pwd)"
fi

external_secrets="$project_root/client_secrets.json"
fallback_secrets="$project_root/infra/docker/oidc/client_secrets.fallback.json"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [ -d "$external_secrets" ]; then
  fail "Expected a file but found a directory at $external_secrets."
fi

if [ -e "$external_secrets" ]; then
  if [ ! -f "$external_secrets" ]; then
    fail "Expected a regular file: $external_secrets."
  fi
  if [ ! -s "$external_secrets" ]; then
    fail "File is empty: $external_secrets."
  fi

  printf 'OIDC_MODE=external\n'
  printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$external_secrets"
  exit 0
fi

if [ ! -f "$fallback_secrets" ]; then
  fail "Fallback OIDC client secrets file is missing: $fallback_secrets."
fi

if [ ! -s "$fallback_secrets" ]; then
  fail "Fallback OIDC client secrets file is empty: $fallback_secrets."
fi

printf 'OIDC_MODE=fallback\n'
printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$fallback_secrets"
