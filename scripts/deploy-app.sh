#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${1:-local}
KUBE_CONTEXT=${KUBE_CONTEXT:-}
ENV_FILE=${ENV_FILE:-infra/k8s/base/deploy.env}

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

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

namespace="${NAMESPACE:-}"
if [[ -z "${namespace}" ]]; then
  echo "NAMESPACE is not set. Define NAMESPACE in infra/k8s/base/deploy.env."
  exit 1
fi

"${KUBECTL[@]}" apply -k "infra/k8s/overlays/${ENVIRONMENT}"
"${KUBECTL[@]}" rollout status deployment/kiwi-portal -n "${namespace}" --timeout=5m
