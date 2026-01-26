#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${ENVIRONMENT:-local}
CONFIRM_PROD=false
KUBE_CONTEXT=${KUBE_CONTEXT:-}
NGINX_GATEWAY_FABRIC_VERSION=${NGINX_GATEWAY_FABRIC_VERSION:-2.3.0}

ENV_FILE=${ENV_FILE:-infra/k8s/base/deploy.env}
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

cert_manager_chart_version="${CERT_MANAGER_CHART_VERSION:-}"
if [[ -z "${cert_manager_chart_version}" ]]; then
  echo "CERT_MANAGER_CHART_VERSION is not set. Define it in infra/k8s/base/deploy.env."
  exit 1
fi

usage() {
  echo "Usage: $0 [local|prod] [--confirm-prod]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    local|prod)
      ENVIRONMENT="$1"
      shift
      ;;
    --confirm-prod)
      CONFIRM_PROD=true
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

is_prod=false
if [[ "${ENVIRONMENT}" == "prod" ]]; then
  is_prod=true
fi

if [[ "${is_prod}" == "true" && "${CONFIRM_PROD}" != "true" ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Type 'prod' to install addons on production: " confirm_input
    if [[ "${confirm_input}" != "prod" ]]; then
      echo "Aborted."
      exit 1
    fi
  else
    echo "Refusing to install addons on production without confirmation."
    echo "Re-run with --confirm-prod to acknowledge."
    exit 1
  fi
fi

KUBECTL_CONTEXT_ARGS=()
if [[ -n "${KUBE_CONTEXT}" ]]; then
  KUBECTL_CONTEXT_ARGS=(--context "${KUBE_CONTEXT}")
fi

HELM_CONTEXT_ARGS=()
if [[ -n "${KUBE_CONTEXT}" ]]; then
  HELM_CONTEXT_ARGS=(--kube-context "${KUBE_CONTEXT}")
fi

helm_release_exists() {
  local release_name="$1"
  local release_namespace="$2"

  if helm status "${release_name}" -n "${release_namespace}" "${HELM_CONTEXT_ARGS[@]}" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

ngf_release_name="ngf"
ngf_release_namespace="nginx-gateway"
gateway_api_crd="gatewayclasses.gateway.networking.k8s.io"
if kubectl "${KUBECTL_CONTEXT_ARGS[@]}" get crd "${gateway_api_crd}" >/dev/null 2>&1; then
  echo "Gateway API CRDs already installed; skipping."
else
  kubectl "${KUBECTL_CONTEXT_ARGS[@]}" apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.1/standard-install.yaml
fi

if helm_release_exists "${ngf_release_name}" "${ngf_release_namespace}"; then
  echo "Helm release '${ngf_release_name}' already exists in namespace '${ngf_release_namespace}'; skipping."
else
  helm install "${ngf_release_name}" oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
    --version "${NGINX_GATEWAY_FABRIC_VERSION}" \
    --create-namespace \
    -n "${ngf_release_namespace}" \
    "${HELM_CONTEXT_ARGS[@]}"
fi

helm repo add jetstack https://charts.jetstack.io
helm repo update

cert_manager_release_name="cert-manager"
cert_manager_namespace="cert-manager"
if helm_release_exists "${cert_manager_release_name}" "${cert_manager_namespace}"; then
  echo "Helm release '${cert_manager_release_name}' already exists in namespace '${cert_manager_namespace}'; skipping."
else
  helm upgrade --install "${cert_manager_release_name}" jetstack/cert-manager \
    -f "infra/helm/cert-manager/values-${ENVIRONMENT}.yaml" \
    --version "${cert_manager_chart_version}" \
    -n "${cert_manager_namespace}" --create-namespace \
    --wait --timeout 120s \
    "${HELM_CONTEXT_ARGS[@]}"
fi

issuer_release_name="certmanager-issuer"
issuer_namespace="cert-manager"
if helm_release_exists "${issuer_release_name}" "${issuer_namespace}"; then
  echo "Helm release '${issuer_release_name}' already exists in namespace '${issuer_namespace}'; skipping."
else
  helm upgrade --install "${issuer_release_name}" ./infra/helm/cert-manager/issuer-chart \
    -n "${issuer_namespace}" \
    "${HELM_CONTEXT_ARGS[@]}"
fi
