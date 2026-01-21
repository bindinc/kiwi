#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=local
CONFIRM_PROD=false
NGINX_GATEWAY_FABRIC_VERSION=${NGINX_GATEWAY_FABRIC_VERSION:-2.3.0}

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

kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.1/standard-install.yaml

helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --version "${NGINX_GATEWAY_FABRIC_VERSION}" \
  --create-namespace \
  -n nginx-gateway

helm repo add jetstack https://charts.jetstack.io
helm repo update

helm upgrade --install cert-manager jetstack/cert-manager \
  -f "infra/helm/cert-manager/values-${ENVIRONMENT}.yaml" \
  -n cert-manager --create-namespace \
  --set installCRDs=true
