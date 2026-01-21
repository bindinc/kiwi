#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${1:-local}

case "${ENVIRONMENT}" in
  local|prod) ;;
  *)
    echo "Usage: $0 [local|prod]"
    exit 1
    ;;
esac

kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.1/standard-install.yaml

helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --create-namespace \
  -n nginx-gateway

helm repo add jetstack https://charts.jetstack.io
helm repo update

helm upgrade --install cert-manager jetstack/cert-manager \
  -f "infra/helm/cert-manager/values-${ENVIRONMENT}.yaml" \
  -n cert-manager --create-namespace \
  --set installCRDs=true
