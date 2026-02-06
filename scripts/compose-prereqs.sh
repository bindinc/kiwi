#!/usr/bin/env sh
set -eu

if [ -n "${COMPOSE_PROJECT_ROOT:-}" ]; then
  project_root="$COMPOSE_PROJECT_ROOT"
else
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  project_root="$(cd "$script_dir/.." && pwd)"
fi

secrets_file="$project_root/client_secrets.json"
example_file="$project_root/client_secrets.example.json"

print_setup_hint() {
  printf 'Fix:\n'
  printf '  cp %s %s\n' "$example_file" "$secrets_file"
  printf '  Then update the copied file with your local OIDC values.\n'
}

fail() {
  printf '[compose-preflight] %s\n' "$1" >&2
  print_setup_hint >&2
  exit 1
}

if [ -d "$secrets_file" ]; then
  fail "Expected a file but found a directory at $secrets_file."
fi

if [ ! -e "$secrets_file" ]; then
  fail "Missing required file: $secrets_file."
fi

if [ ! -f "$secrets_file" ]; then
  fail "Expected a regular file: $secrets_file."
fi

if [ ! -s "$secrets_file" ]; then
  fail "File is empty: $secrets_file."
fi

printf '[compose-preflight] Compose prerequisites OK.\n'
