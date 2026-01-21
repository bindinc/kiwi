#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${ENV_FILE:-infra/deploy.env}
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

image=""
if [[ -n "${IMAGE:-}" ]]; then
  image="${IMAGE}"
elif [[ -n "${IMAGE_NAME:-}" ]]; then
  image_tag="${IMAGE_TAG:-${ALPINE_VERSION:-}}"
  if [[ -z "${image_tag}" ]]; then
    echo "IMAGE_TAG or ALPINE_VERSION is required when using IMAGE_NAME."
    exit 1
  fi
  image="${IMAGE_NAME}:${image_tag}"
elif [[ -n "${BASE_IMAGE:-}" ]]; then
  image="${BASE_IMAGE}"
fi

if [[ -z "${image}" ]]; then
  echo "Base image is not set. Define BASE_IMAGE or IMAGE/IMAGE_NAME+IMAGE_TAG (infra/deploy.env)."
  exit 1
fi

alpine_version="${ALPINE_VERSION:-}"
if [[ -z "${alpine_version}" ]]; then
  echo "ALPINE_VERSION is not set. Define ALPINE_VERSION in infra/deploy.env."
  exit 1
fi

docker build \
  --build-arg ALPINE_VERSION="${alpine_version}" \
  -f infra/docker/base/Dockerfile \
  -t "${image}" \
  .
