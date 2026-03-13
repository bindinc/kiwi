#!/usr/bin/env sh
set -eu

mounted_secrets="/etc/kiwi/oidc-client-secrets/client_secrets.json"
mounted_legacy_secrets="/etc/kiwi/oidc-client-secrets"

if [ -f "$mounted_secrets" ] && [ -s "$mounted_secrets" ]; then
  printf 'OIDC_MODE=external\n'
  printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$mounted_secrets"
  exit 0
fi

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

resolve_existing_secrets_file() {
  candidate="$1"

  if [ -z "$candidate" ]; then
    return 1
  fi

  if [ -d "$candidate" ]; then
    fail "Expected a file but found a directory at $candidate."
  fi

  if [ ! -e "$candidate" ]; then
    return 1
  fi

  if [ ! -f "$candidate" ]; then
    fail "Expected a regular file: $candidate."
  fi

  if [ ! -s "$candidate" ]; then
    fail "File is empty: $candidate."
  fi

  printf '%s\n' "$candidate"
}

explicit_secrets="$(resolve_existing_secrets_file "${OIDC_CLIENT_SECRETS:-}" || true)"
if [ -n "$explicit_secrets" ]; then
  printf 'OIDC_MODE=external\n'
  printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$explicit_secrets"
  exit 0
fi

mounted_file="$(resolve_existing_secrets_file "$mounted_secrets" || true)"
if [ -n "$mounted_file" ]; then
  printf 'OIDC_MODE=external\n'
  printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$mounted_file"
  exit 0
fi

mounted_legacy_file="$(resolve_existing_secrets_file "$mounted_legacy_secrets" || true)"
if [ -n "$mounted_legacy_file" ]; then
  printf 'OIDC_MODE=external\n'
  printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$mounted_legacy_file"
  exit 0
fi

external_file="$(resolve_existing_secrets_file "$external_secrets" || true)"
if [ -n "$external_file" ]; then
  printf 'OIDC_MODE=external\n'
  printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$external_file"
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
