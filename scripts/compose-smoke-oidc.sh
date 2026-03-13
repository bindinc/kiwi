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

login_redirect_ready=0
for attempt in $(seq 1 60); do
  login_redirect="$(curl -kis "${gateway_base_url}/kiwi/login" | awk 'BEGIN{IGNORECASE=1} /^location:/{print $2; exit}' | tr -d '\r')"
  if [[ -z "${login_redirect}" ]]; then
    sleep 1
    continue
  fi

  if [[ "${login_redirect}" != https://bdc.rtvmedia.org.local/kiwi-oidc/* ]]; then
    echo "[compose-smoke-oidc] Unexpected fallback login redirect target: ${login_redirect}"
    exit 1
  fi

  if [[ "${login_redirect}" == *"User.Read"* ]]; then
    echo "[compose-smoke-oidc] Fallback login redirect includes unsupported scope User.Read."
    exit 1
  fi

  echo "[compose-smoke-oidc] Login redirect targets public fallback OIDC URL with fallback scopes."
  login_redirect_ready=1
  break
done

if [[ "${login_redirect_ready}" != "1" ]]; then
  echo "[compose-smoke-oidc] Fallback login redirect did not become available."
  exit 1
fi

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

  TOKEN_RESPONSE="${token_response}" node - "${expected_role}" "${username}" <<'NODE'
const expectedRole = process.argv[2];
const username = process.argv[3];
const response = JSON.parse(process.env.TOKEN_RESPONSE ?? '{}');
const idToken = response.id_token;

if (!idToken) {
  console.log(`[compose-smoke-oidc] Missing id_token for user ${username}.`);
  process.exit(1);
}

const parts = idToken.split('.');
if (parts.length !== 3) {
  console.log(`[compose-smoke-oidc] Invalid id_token format for user ${username}.`);
  process.exit(1);
}

const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
const roles = Array.isArray(claims.roles)
  ? claims.roles
  : (claims.roles ? [claims.roles] : []);

if (!roles.includes(expectedRole)) {
  console.log(
    `[compose-smoke-oidc] User ${username} is missing role ${expectedRole}. Token roles: ${JSON.stringify(roles)}`
  );
  process.exit(1);
}

console.log(`[compose-smoke-oidc] User ${username} includes role ${expectedRole}.`);
NODE
}

assert_role "kiwi-admin" "bink8s.app.kiwi.admin"
assert_role "kiwi-dev" "bink8s.app.kiwi.dev"
assert_role "kiwi-supervisor" "bink8s.app.kiwi.supervisor"
assert_role "kiwi-user" "bink8s.app.kiwi.user"
assert_role "kiwi-view" "bink8s.app.kiwi.view"

echo "[compose-smoke-oidc] Fallback OIDC smoke checks passed."
