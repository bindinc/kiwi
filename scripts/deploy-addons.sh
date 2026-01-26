#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${ENVIRONMENT:-local}
CONFIRM_PROD=false
KUBE_CONTEXT=${KUBE_CONTEXT:-}
NGINX_GATEWAY_FABRIC_VERSION=${NGINX_GATEWAY_FABRIC_VERSION:-2.3.0}
GATEWAY_API_VERSION=${GATEWAY_API_VERSION:-v1.4.1}
GATEWAY_API_INSTALL_URL=${GATEWAY_API_INSTALL_URL:-https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml}

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

kube_resource_exists() {
  local resource_type="$1"
  local resource_name="$2"
  local resource_namespace="$3"

  if kubectl "${KUBECTL_CONTEXT_ARGS[@]}" -n "${resource_namespace}" get "${resource_type}" "${resource_name}" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

ngf_release_name="ngf"
ngf_release_namespace="nginx-gateway"
gateway_api_crd="gatewayclasses.gateway.networking.k8s.io"
gateway_api_backend_tls_crd="backendtlspolicies.gateway.networking.k8s.io"
gateway_api_required_backend_tls_version="v1"
gateway_api_action="skip"

gateway_api_backend_tls_versions=""
if kubectl "${KUBECTL_CONTEXT_ARGS[@]}" get crd "${gateway_api_backend_tls_crd}" >/dev/null 2>&1; then
  gateway_api_backend_tls_versions=$(kubectl "${KUBECTL_CONTEXT_ARGS[@]}" get crd "${gateway_api_backend_tls_crd}" -o jsonpath='{.spec.versions[*].name}')
fi

gateway_api_has_required_backend_tls_version=false
if [[ -n "${gateway_api_backend_tls_versions}" ]]; then
  for version in ${gateway_api_backend_tls_versions}; do
    if [[ "${version}" == "${gateway_api_required_backend_tls_version}" ]]; then
      gateway_api_has_required_backend_tls_version=true
      break
    fi
  done
fi

if kubectl "${KUBECTL_CONTEXT_ARGS[@]}" get crd "${gateway_api_crd}" >/dev/null 2>&1; then
  if [[ "${gateway_api_has_required_backend_tls_version}" != "true" ]]; then
    gateway_api_action="upgrade"
  fi
else
  gateway_api_action="install"
fi

if [[ "${gateway_api_action}" == "skip" ]]; then
  echo "Gateway API CRDs already installed; skipping."
else
  if [[ "${gateway_api_action}" == "upgrade" ]]; then
    echo "Gateway API CRDs are installed but BackendTLSPolicy ${gateway_api_required_backend_tls_version} is missing; upgrading."
  else
    echo "Gateway API CRDs missing; installing."
  fi
  kubectl "${KUBECTL_CONTEXT_ARGS[@]}" apply -f "${GATEWAY_API_INSTALL_URL}"
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
  cert_manager_expected_deployments=(cert-manager cert-manager-cainjector cert-manager-webhook)
  cert_manager_expected_serviceaccounts=(cert-manager cert-manager-cainjector cert-manager-webhook)
  cert_manager_existing_resources=()
  cert_manager_missing_deployments=()

  for deployment in "${cert_manager_expected_deployments[@]}"; do
    if kube_resource_exists "deployment" "${deployment}" "${cert_manager_namespace}"; then
      cert_manager_existing_resources+=("deployment/${deployment}")
    else
      cert_manager_missing_deployments+=("${deployment}")
    fi
  done

  for service_account in "${cert_manager_expected_serviceaccounts[@]}"; do
    if kube_resource_exists "serviceaccount" "${service_account}" "${cert_manager_namespace}"; then
      cert_manager_existing_resources+=("serviceaccount/${service_account}")
    fi
  done

  if (( ${#cert_manager_missing_deployments[@]} == 0 )); then
    echo "cert-manager deployments already exist in namespace '${cert_manager_namespace}', but Helm release '${cert_manager_release_name}' is missing; skipping install."
  elif (( ${#cert_manager_existing_resources[@]} > 0 )); then
    echo "cert-manager resources already exist in namespace '${cert_manager_namespace}', but deployments are incomplete."
    echo "Existing resources: ${cert_manager_existing_resources[*]}"
    echo "Missing deployments: ${cert_manager_missing_deployments[*]}"
    echo "Clean up or migrate the existing cert-manager install, then re-run."
    exit 1
  else
    helm upgrade --install "${cert_manager_release_name}" jetstack/cert-manager \
      -f "infra/helm/cert-manager/values-${ENVIRONMENT}.yaml" \
      --version "${cert_manager_chart_version}" \
      -n "${cert_manager_namespace}" --create-namespace \
      --wait --timeout 120s \
      "${HELM_CONTEXT_ARGS[@]}"
  fi
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
