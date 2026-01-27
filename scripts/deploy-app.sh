#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=local
PREFLIGHT_ONLY=false
KUBE_CONTEXT=${KUBE_CONTEXT:-}
ENV_FILE=${ENV_FILE:-infra/k8s/base/deploy.env}

usage() {
  echo "Usage: $0 [local|prod] [--preflight-only]"
}

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

environment_set=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    local|prod)
      if [[ "${environment_set}" == "true" ]]; then
        echo "Specify only one environment: local or prod."
        exit 1
      fi
      ENVIRONMENT="$1"
      environment_set=true
      shift
      ;;
    --preflight-only)
      PREFLIGHT_ONLY=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found in PATH."
  exit 1
fi

KUBECTL=(kubectl)
if [[ -n "${KUBE_CONTEXT}" ]]; then
  KUBECTL+=(--context "${KUBE_CONTEXT}")
fi

ADDON_WAIT_TIMEOUT=${ADDON_WAIT_TIMEOUT:-120s}
problems=()

add_problem() {
  problems+=("$1")
}

namespace_exists() {
  local namespace="$1"

  if "${KUBECTL[@]}" get namespace "${namespace}" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

deployments_exist() {
  local namespace="$1"
  local selector="$2"
  local deployment_names

  deployment_names="$("${KUBECTL[@]}" get deployment \
    -n "${namespace}" \
    -l "${selector}" \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)"

  if [[ -n "${deployment_names}" ]]; then
    return 0
  fi

  return 1
}

wait_for_deployments() {
  local namespace="$1"
  local selector="$2"

  if "${KUBECTL[@]}" wait \
    --for=condition=Available \
    deployment \
    -n "${namespace}" \
    -l "${selector}" \
    --timeout="${ADDON_WAIT_TIMEOUT}"; then
    return 0
  fi

  return 1
}

check_gateway_api_crds() {
  local -a required_crds=(
    gatewayclasses.gateway.networking.k8s.io
    gateways.gateway.networking.k8s.io
    httproutes.gateway.networking.k8s.io
  )
  local crd

  for crd in "${required_crds[@]}"; do
    if ! "${KUBECTL[@]}" get crd "${crd}" >/dev/null 2>&1; then
      add_problem "Gateway API CRD '${crd}' is missing"
    fi
  done
}

check_deployments_ready() {
  local addon_name="$1"
  local namespace="$2"
  local selector="$3"

  if ! namespace_exists "${namespace}"; then
    add_problem "Namespace '${namespace}' for ${addon_name} is missing"
    return
  fi

  if ! deployments_exist "${namespace}" "${selector}"; then
    add_problem "${addon_name} deployments not found in namespace '${namespace}'"
    return
  fi

  if ! wait_for_deployments "${namespace}" "${selector}"; then
    add_problem "${addon_name} deployments not ready in namespace '${namespace}'"
  fi
}

check_cluster_issuers() {
  local -a issuers=(letsencrypt-staging letsencrypt-prod)
  local issuer

  for issuer in "${issuers[@]}"; do
    if ! "${KUBECTL[@]}" get clusterissuer "${issuer}" >/dev/null 2>&1; then
      add_problem "ClusterIssuer '${issuer}' is missing"
    fi
  done
}

preflight_addons() {
  problems=()

  check_gateway_api_crds
  check_deployments_ready "NGINX Gateway Fabric" "nginx-gateway" "app.kubernetes.io/instance=nginx-gateway-fabric"
  check_deployments_ready "cert-manager" "cert-manager" "app.kubernetes.io/instance=cert-manager"
  check_cluster_issuers

  if (( ${#problems[@]} == 0 )); then
    return 0
  fi

  echo "Add-on preflight failed:"
  for problem in "${problems[@]}"; do
    echo " - ${problem}"
  done
  echo "Run: make addons ${ENVIRONMENT}"
  exit 1
}

preflight_addons

if [[ "${PREFLIGHT_ONLY}" == "true" ]]; then
  echo "Add-on preflight passed."
  exit 0
fi

namespace="${NAMESPACE:-}"
if [[ -z "${namespace}" ]]; then
  echo "NAMESPACE is not set. Define NAMESPACE in infra/k8s/base/deploy.env."
  exit 1
fi

"${KUBECTL[@]}" apply -k "infra/k8s/overlays/${ENVIRONMENT}"

deployments=()
deployment_names="$("${KUBECTL[@]}" get deployment \
  -n "${namespace}" \
  -l "app.kubernetes.io/name=kiwi" \
  -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)"

if [[ -n "${deployment_names}" ]]; then
  read -r -a deployments <<< "${deployment_names}"
fi

if (( ${#deployments[@]} == 0 )); then
  echo "No kiwi deployments found in namespace '${namespace}'."
  exit 1
fi

for deployment in "${deployments[@]}"; do
  "${KUBECTL[@]}" rollout status "deployment/${deployment}" -n "${namespace}" --timeout=5m
done
