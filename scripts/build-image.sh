#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${ENV_FILE:-infra/k8s/base/deploy.env}
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

environment=${ENVIRONMENT:-local}

app_image=""
if [[ -n "${APP_IMAGE:-}" ]]; then
  app_image="${APP_IMAGE}"
elif [[ -n "${IMAGE_NAME:-}" ]]; then
  image_tag="${IMAGE_TAG:-}"
  if [[ -z "${image_tag}" ]]; then
    echo "IMAGE_TAG is required when using IMAGE_NAME."
    exit 1
  fi
  app_image="${IMAGE_NAME}:${image_tag}"
else
  if [[ "${environment}" == "prod" ]]; then
    app_image="${APP_IMAGE_PROD:-}"
  else
    app_image="${APP_IMAGE_LOCAL:-}"
  fi
fi

if [[ -z "${app_image}" ]]; then
  echo "App image is not set. Define APP_IMAGE or APP_IMAGE_LOCAL/APP_IMAGE_PROD (infra/k8s/base/deploy.env)."
  exit 1
fi

base_image="${BASE_IMAGE:-}"
if [[ -z "${base_image}" ]]; then
  echo "BASE_IMAGE is not set. Define BASE_IMAGE in infra/k8s/base/deploy.env."
  exit 1
fi

docker build \
  --build-arg BASE_IMAGE="${base_image}" \
  -f infra/docker/app/Dockerfile \
  -t "${app_image}" \
  .
