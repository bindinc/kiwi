#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME=${IMAGE_NAME:-registry.kiwi.svc.cluster.local/kiwi/portal}
IMAGE_TAG=${IMAGE_TAG:-local}
BASE_IMAGE=${BASE_IMAGE:-registry.kiwi.svc.cluster.local/kiwi/alpine-slim:3.11}

docker build \
  --build-arg BASE_IMAGE="${BASE_IMAGE}" \
  -f infra/docker/app/Dockerfile \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  .
