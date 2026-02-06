#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${COMPOSE_PROJECT_ROOT:-}" ]]; then
  project_root="${COMPOSE_PROJECT_ROOT}"
else
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  project_root="$(cd "${script_dir}/.." && pwd)"
fi

compose_file="${project_root}/docker-compose.yaml"
secrets_file="${project_root}/client_secrets.json"
gateway_port="${KIWI_SMOKE_GATEWAY_PORT:-8443}"
backup_file=""
stack_started=0

restore_state() {
  set +e
  if [[ "${stack_started}" == "1" ]]; then
    GATEWAY_HTTPS_PORT="${gateway_port}" docker compose -f "${compose_file}" down -v --remove-orphans >/dev/null 2>&1
  fi
  if [[ -n "${backup_file}" && -f "${backup_file}" ]]; then
    mv "${backup_file}" "${secrets_file}"
  fi
}

trap restore_state EXIT

if [[ -d "${secrets_file}" ]]; then
  echo "[compose-smoke-oidc] ${secrets_file} is a directory; expected a file or no path."
  exit 1
fi

if [[ -f "${secrets_file}" ]]; then
  backup_file="${secrets_file}.compose-smoke-backup.$$"
  mv "${secrets_file}" "${backup_file}"
fi

echo "[compose-smoke-oidc] Starting stack in fallback OIDC mode..."
GATEWAY_HTTPS_PORT="${gateway_port}" docker compose -f "${compose_file}" up -d --build
stack_started=1

gateway_base_url="https://bdc.rtvmedia.org.local:${gateway_port}"
discovery_url="${gateway_base_url}/kiwi-oidc/realms/kiwi-local/.well-known/openid-configuration"
token_url="${gateway_base_url}/kiwi-oidc/realms/kiwi-local/protocol/openid-connect/token"
client_id="kiwi-local-dev"
client_secret="kiwi-local-dev-secret"
shared_password="kiwi-local-dev-password"

for attempt in $(seq 1 60); do
  if curl -kfsS "${discovery_url}" >/dev/null; then
    echo "[compose-smoke-oidc] Discovery endpoint is available."
    break
  fi

  if [[ "${attempt}" == "60" ]]; then
    echo "[compose-smoke-oidc] Discovery endpoint did not become ready: ${discovery_url}"
    exit 1
  fi

  sleep 1
done

assert_role() {
  local username="$1"
  local expected_role="$2"
  local token_response

  token_response="$(curl -kfsS \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=password" \
    --data-urlencode "client_id=${client_id}" \
    --data-urlencode "client_secret=${client_secret}" \
    --data-urlencode "username=${username}" \
    --data-urlencode "password=${shared_password}" \
    --data-urlencode "scope=openid profile email" \
    "${token_url}")"

  TOKEN_RESPONSE="${token_response}" python - "${expected_role}" "${username}" <<'PY'
import base64
import json
import os
import sys

expected_role = sys.argv[1]
username = sys.argv[2]
response = json.loads(os.environ["TOKEN_RESPONSE"])
id_token = response.get("id_token")

if not id_token:
    print(f"[compose-smoke-oidc] Missing id_token for user {username}.")
    sys.exit(1)

parts = id_token.split(".")
if len(parts) != 3:
    print(f"[compose-smoke-oidc] Invalid id_token format for user {username}.")
    sys.exit(1)

payload = parts[1]
payload += "=" * (-len(payload) % 4)
claims = json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))
roles = claims.get("roles") or []
if isinstance(roles, str):
    roles = [roles]

if expected_role not in roles:
    print(
        f"[compose-smoke-oidc] User {username} is missing role {expected_role}. "
        f"Token roles: {roles}"
    )
    sys.exit(1)

print(f"[compose-smoke-oidc] User {username} includes role {expected_role}.")
PY
}

assert_role "kiwi-admin" "bink8s.app.kiwi.admin"
assert_role "kiwi-dev" "bink8s.app.kiwi.dev"
assert_role "kiwi-supervisor" "bink8s.app.kiwi.supervisor"
assert_role "kiwi-user" "bink8s.app.kiwi.user"
assert_role "kiwi-view" "bink8s.app.kiwi.view"

echo "[compose-smoke-oidc] Fallback OIDC smoke checks passed."
