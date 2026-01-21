#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${1:-local}
KUBE_CONTEXT=${KUBE_CONTEXT:-}

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
  -n ingress-nginx --create-namespace \
  "${HELM_CONTEXT_ARGS[@]}"

helm upgrade --install cert-manager jetstack/cert-manager \
  -f "infra/helm/cert-manager/values-${ENVIRONMENT}.yaml" \
  -n cert-manager --create-namespace \
  "${HELM_CONTEXT_ARGS[@]}"
