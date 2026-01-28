#!/usr/bin/env bash
set -euo pipefail

DOMAIN=${DOMAIN:-bdc.rtvmedia.org.local}
CERT_DIR=${CERT_DIR:-infra/docker/nginx/certs}
KEY_PATH="${CERT_DIR}/${DOMAIN}.key"
CRT_PATH="${CERT_DIR}/${DOMAIN}.crt"

mkdir -p "${CERT_DIR}"

if [[ -f "${KEY_PATH}" || -f "${CRT_PATH}" ]]; then
  echo "Certs already exist at ${CERT_DIR}."
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate local TLS certs."
  exit 1
fi

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "${KEY_PATH}" \
  -out "${CRT_PATH}" \
  -subj "/CN=${DOMAIN}" \
  -addext "subjectAltName=DNS:${DOMAIN}"

echo "Generated ${CRT_PATH} and ${KEY_PATH}."
