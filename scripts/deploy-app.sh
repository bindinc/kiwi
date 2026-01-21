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

KUBECTL=(kubectl)
if [[ -n "${KUBE_CONTEXT}" ]]; then
  KUBECTL+=(--context "${KUBE_CONTEXT}")
fi

"${KUBECTL[@]}" apply -k "infra/k8s/overlays/${ENVIRONMENT}"
"${KUBECTL[@]}" rollout status deployment/kiwi-portal -n kiwi --timeout=5m
