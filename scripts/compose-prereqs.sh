#!/usr/bin/env sh
set -eu

script_dir="$(cd "$(dirname "$0")" && pwd)"

if [ -n "${COMPOSE_PROJECT_ROOT:-}" ]; then
  project_root="$COMPOSE_PROJECT_ROOT"
else
  project_root="$(cd "$script_dir/.." && pwd)"
fi

example_file="$project_root/client_secrets.example.json"
secrets_file="$project_root/client_secrets.json"
resolve_script="$script_dir/resolve-oidc-mode.sh"

print_setup_hint() {
  printf 'Setup options:\n'
  printf '  1. Use external OIDC:\n'
  printf '  cp %s %s\n' "$example_file" "$secrets_file"
  printf '  Then update the copied file with your local OIDC values.\n'
  printf '  2. Use fallback OIDC:\n'
  printf '  remove %s and run compose again.\n' "$secrets_file"
}

fail() {
  printf '[compose-preflight] %s\n' "$1" >&2
  print_setup_hint >&2
  exit 1
}

if [ ! -x "$resolve_script" ]; then
  fail "Missing executable resolver script: $resolve_script."
fi

if ! resolved="$("$resolve_script" 2>&1)"; then
  fail "$resolved"
fi

eval "$resolved"

if [ "$OIDC_MODE" = "external" ]; then
  printf '[compose-preflight] Compose prerequisites OK. Using external OIDC secrets at %s.\n' "$OIDC_CLIENT_SECRETS_PATH"
  exit 0
fi

printf '[compose-preflight] Compose prerequisites OK. client_secrets.json is missing, using fallback OIDC.\n'
