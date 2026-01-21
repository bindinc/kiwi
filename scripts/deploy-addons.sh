#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${1:-local}
KUBE_CONTEXT=${KUBE_CONTEXT:-}

ENV_FILE=${ENV_FILE:-infra/k8s/base/deploy.env}
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

ingress_chart_version="${INGRESS_NGINX_CHART_VERSION:-}"
if [[ -z "${ingress_chart_version}" ]]; then
  echo "INGRESS_NGINX_CHART_VERSION is not set. Define it in infra/k8s/base/deploy.env."
  exit 1
fi

cert_manager_chart_version="${CERT_MANAGER_CHART_VERSION:-}"
if [[ -z "${cert_manager_chart_version}" ]]; then
  echo "CERT_MANAGER_CHART_VERSION is not set. Define it in infra/k8s/base/deploy.env."
  exit 1
fi

case "${ENVIRONMENT}" in
  local|prod) ;;
  *)
    echo "Usage: $0 [local|prod]"
    exit 1
    ;;
esac

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo update

HELM_CONTEXT_ARGS=()
if [[ -n "${KUBE_CONTEXT}" ]]; then
  HELM_CONTEXT_ARGS=(--kube-context "${KUBE_CONTEXT}")
fi

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  -f "infra/helm/ingress-nginx/values-${ENVIRONMENT}.yaml" \
  --version "${ingress_chart_version}" \
  -n ingress-nginx --create-namespace \
  "${HELM_CONTEXT_ARGS[@]}"

helm upgrade --install cert-manager jetstack/cert-manager \
  -f "infra/helm/cert-manager/values-${ENVIRONMENT}.yaml" \
  --version "${cert_manager_chart_version}" \
  -n cert-manager --create-namespace \
  "${HELM_CONTEXT_ARGS[@]}"
