#!/usr/bin/env sh
set -eu

mounted_secrets="/etc/kiwi/oidc-client-secrets/client_secrets.json"
mounted_legacy_secrets="/etc/kiwi/oidc-client-secrets"

if [ -n "${COMPOSE_PROJECT_ROOT:-}" ]; then
  project_root="$COMPOSE_PROJECT_ROOT"
else
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  project_root="$(cd "$script_dir/.." && pwd)"
fi

external_secrets="$project_root/client_secrets.json"
fallback_secrets="$project_root/infra/docker/oidc/client_secrets.fallback.json"
resolved_secrets_file=""

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

has_oidc_web_config() {
  candidate="$1"

  grep -Eq '"web"[[:space:]]*:[[:space:]]*\{' "$candidate" || return 1
  grep -Eq '"client_id"[[:space:]]*:[[:space:]]*"[^"]+"' "$candidate" || return 1
  grep -Eq '"auth_uri"[[:space:]]*:[[:space:]]*"[^"]+"' "$candidate" || return 1
  grep -Eq '"token_uri"[[:space:]]*:[[:space:]]*"[^"]+"' "$candidate" || return 1
  grep -Eq '"userinfo_uri"[[:space:]]*:[[:space:]]*"[^"]+"' "$candidate" || return 1

  return 0
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

  resolved_secrets_file="$candidate"
  return 0
}

use_external_oidc_if_present() {
  resolved_secrets_file=""
  if ! resolve_existing_secrets_file "$1"; then
    return 1
  fi

  if ! has_oidc_web_config "$resolved_secrets_file"; then
    return 1
  fi

  printf 'OIDC_MODE=external\n'
  printf 'OIDC_CLIENT_SECRETS_PATH=%s\n' "$resolved_secrets_file"
  exit 0
}

if use_external_oidc_if_present "${OIDC_CLIENT_SECRETS:-}"; then
  exit 0
fi

if use_external_oidc_if_present "$mounted_secrets"; then
  exit 0
fi

if use_external_oidc_if_present "$mounted_legacy_secrets"; then
  exit 0
fi

if use_external_oidc_if_present "$external_secrets"; then
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
