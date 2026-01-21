SHELL := /usr/bin/env bash

.DEFAULT_GOAL := help

ENV ?= local
HAS_LOCAL := $(filter local,$(MAKECMDGOALS))
HAS_PROD := $(filter prod,$(MAKECMDGOALS))
ifneq (,$(HAS_LOCAL))
  ifneq (,$(HAS_PROD))
    $(error Specify only one environment: local or prod)
  endif
  ENV := local
endif
ifneq (,$(HAS_PROD))
  ENV := prod
endif

ENV_FILE ?= infra/k8s/base/deploy.env
ifneq ("$(wildcard $(ENV_FILE))","")
  include $(ENV_FILE)
endif

APP_IMAGE ?= $(if $(filter prod,$(ENV)),$(APP_IMAGE_PROD),$(APP_IMAGE_LOCAL))

LOCAL_IMAGE_STRATEGY ?= kind
KIND_CLUSTER_NAME ?= kind
KUBE_CONTEXT ?=
KUBE_CONTEXT_LOCAL ?= docker-desktop
KUBE_CONTEXT_PROD ?= bink8s
EXPECTED_CONTEXT_VAR := $(if $(filter prod,$(ENV)),KUBE_CONTEXT_PROD,KUBE_CONTEXT_LOCAL)

LOAD_TARGET :=
ifneq (,$(filter local,$(ENV)))
  LOAD_TARGET := load-local
endif

.PHONY: help build build-base build-app load-local deploy addons print-config verify-context local prod

help:
	@echo "Usage: make build local|prod"
	@echo "       make deploy local|prod"
	@echo "       make addons local|prod"
	@echo ""
	@echo "Common vars:"
	@echo "  KUBE_CONTEXT=<context> LOCAL_IMAGE_STRATEGY=kind|registry KIND_CLUSTER_NAME=kind"
	@echo "  KUBE_CONTEXT_LOCAL=... KUBE_CONTEXT_PROD=..."
	@echo "  ENV_FILE=infra/k8s/base/deploy.env APP_IMAGE=... BASE_IMAGE=..."

print-config:
	@echo "ENV=$(ENV)"
	@echo "NAMESPACE=$(NAMESPACE)"
	@echo "APP_IMAGE_LOCAL=$(APP_IMAGE_LOCAL)"
	@echo "APP_IMAGE_PROD=$(APP_IMAGE_PROD)"
	@echo "APP_IMAGE=$(APP_IMAGE)"
	@echo "BASE_IMAGE=$(BASE_IMAGE)"
	@echo "ALPINE_VERSION=$(ALPINE_VERSION)"
	@echo "APP_PORT=$(APP_PORT)"
	@echo "SERVICE_PORT=$(SERVICE_PORT)"
	@echo "LOCAL_NODEPORT=$(LOCAL_NODEPORT)"
	@echo "LOCAL_IMAGE_STRATEGY=$(LOCAL_IMAGE_STRATEGY)"
	@echo "KIND_CLUSTER_NAME=$(KIND_CLUSTER_NAME)"
	@echo "KUBE_CONTEXT=$(KUBE_CONTEXT)"
	@echo "KUBE_CONTEXT_LOCAL=$(KUBE_CONTEXT_LOCAL)"
	@echo "KUBE_CONTEXT_PROD=$(KUBE_CONTEXT_PROD)"
	@echo "CERT_MANAGER_CHART_VERSION=$(CERT_MANAGER_CHART_VERSION)"

verify-context:
	@command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found in PATH."; exit 1; }
	@expected="$(if $(filter prod,$(ENV)),$(KUBE_CONTEXT_PROD),$(KUBE_CONTEXT_LOCAL))"; \
	effective="$(KUBE_CONTEXT)"; \
	if [ -z "$$expected" ]; then \
		echo "Expected context is empty. Set $(EXPECTED_CONTEXT_VAR) or KUBE_CONTEXT."; \
		exit 1; \
	fi; \
	if [ -z "$$effective" ]; then \
		effective="$$(kubectl config current-context 2>/dev/null)"; \
	fi; \
	if [ -z "$$effective" ]; then \
		echo "kubectl has no current context. Set KUBE_CONTEXT or switch context."; \
		exit 1; \
	fi; \
	if [ "$$effective" != "$$expected" ]; then \
		echo "Refusing to proceed: context is '$$effective' but expected '$$expected' for ENV=$(ENV)."; \
		echo "Set $(EXPECTED_CONTEXT_VAR) or KUBE_CONTEXT, or switch context."; \
		exit 1; \
	fi

build: verify-context build-base build-app $(LOAD_TARGET)

build-base:
	BASE_IMAGE="$(BASE_IMAGE)" \
	ALPINE_VERSION="$(ALPINE_VERSION)" \
	scripts/build-base-image.sh

build-app:
	ENVIRONMENT="$(ENV)" \
	BASE_IMAGE="$(BASE_IMAGE)" \
	scripts/build-image.sh

load-local:
	@if [ "$(LOCAL_IMAGE_STRATEGY)" = "kind" ]; then \
		kind load docker-image "$(APP_IMAGE)" --name "$(KIND_CLUSTER_NAME)"; \
	elif [ "$(LOCAL_IMAGE_STRATEGY)" = "registry" ]; then \
		echo "LOCAL_IMAGE_STRATEGY=registry; skipping kind load."; \
	else \
		echo "LOCAL_IMAGE_STRATEGY must be 'kind' or 'registry'."; \
		exit 1; \
	fi

deploy: verify-context
	KUBE_CONTEXT="$(KUBE_CONTEXT)" scripts/deploy-app.sh "$(ENV)"

addons: verify-context
	KUBE_CONTEXT="$(KUBE_CONTEXT)" scripts/deploy-addons.sh "$(ENV)"

local prod:
	@:
