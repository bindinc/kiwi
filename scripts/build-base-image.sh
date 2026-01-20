#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME=${IMAGE_NAME:-registry.kiwi.svc.cluster.local/kiwi/alpine-slim}
IMAGE_TAG=${IMAGE_TAG:-3.11}
ALPINE_VERSION=${ALPINE_VERSION:-3.11}

docker build \
  --build-arg ALPINE_VERSION="${ALPINE_VERSION}" \
  -f infra/docker/base/Dockerfile \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  .
