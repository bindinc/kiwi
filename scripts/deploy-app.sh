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

kubectl apply -k "infra/k8s/overlays/${ENVIRONMENT}"
kubectl rollout status deployment/kiwi-portal -n kiwi --timeout=5m
