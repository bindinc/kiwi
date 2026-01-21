SHELL := /usr/bin/env bash

.DEFAULT_GOAL := help

ENV ?= local
ifneq (,$(filter local,$(MAKECMDGOALS)))
  ENV := local
endif
ifneq (,$(filter prod,$(MAKECMDGOALS)))
  ENV := prod
endif

REGISTRY_HOST ?= registry.kiwi.svc.cluster.local
REGISTRY_NAMESPACE ?= kiwi
APP_IMAGE_REPO ?= $(REGISTRY_HOST)/$(REGISTRY_NAMESPACE)/portal
BASE_IMAGE_REPO ?= $(REGISTRY_HOST)/$(REGISTRY_NAMESPACE)/alpine-slim

BASE_IMAGE_TAG ?= 3.11
ALPINE_VERSION ?= $(BASE_IMAGE_TAG)
LOCAL_IMAGE_TAG ?= local
PROD_IMAGE_TAG ?= prod
IMAGE_TAG ?= $(if $(filter prod,$(ENV)),$(PROD_IMAGE_TAG),$(LOCAL_IMAGE_TAG))

LOCAL_IMAGE_STRATEGY ?= kind
KIND_CLUSTER_NAME ?= kind
KUBE_CONTEXT ?=

LOAD_TARGET :=
ifneq (,$(filter local,$(ENV)))
  LOAD_TARGET := load-local
endif

.PHONY: help build build-base build-app load-local deploy addons print-config local prod

help:
	@echo "Usage: make build local|prod"
	@echo "       make deploy local|prod"
	@echo "       make addons local|prod"
	@echo ""
	@echo "Common vars:"
	@echo "  KUBE_CONTEXT=<context> LOCAL_IMAGE_STRATEGY=kind|registry KIND_CLUSTER_NAME=kind"
	@echo "  REGISTRY_HOST=... REGISTRY_NAMESPACE=..."

print-config:
	@echo "ENV=$(ENV)"
	@echo "APP_IMAGE_REPO=$(APP_IMAGE_REPO)"
	@echo "BASE_IMAGE_REPO=$(BASE_IMAGE_REPO)"
	@echo "BASE_IMAGE_TAG=$(BASE_IMAGE_TAG)"
	@echo "IMAGE_TAG=$(IMAGE_TAG)"
	@echo "LOCAL_IMAGE_STRATEGY=$(LOCAL_IMAGE_STRATEGY)"
	@echo "KIND_CLUSTER_NAME=$(KIND_CLUSTER_NAME)"
	@echo "KUBE_CONTEXT=$(KUBE_CONTEXT)"

build: build-base build-app $(LOAD_TARGET)

build-base:
	IMAGE_NAME="$(BASE_IMAGE_REPO)" IMAGE_TAG="$(BASE_IMAGE_TAG)" \
	ALPINE_VERSION="$(ALPINE_VERSION)" \
	scripts/build-base-image.sh

build-app:
	IMAGE_NAME="$(APP_IMAGE_REPO)" IMAGE_TAG="$(IMAGE_TAG)" \
	BASE_IMAGE="$(BASE_IMAGE_REPO):$(BASE_IMAGE_TAG)" \
	scripts/build-image.sh

load-local:
	@if [ "$(LOCAL_IMAGE_STRATEGY)" = "kind" ]; then \
		kind load docker-image "$(APP_IMAGE_REPO):$(IMAGE_TAG)" --name "$(KIND_CLUSTER_NAME)"; \
	elif [ "$(LOCAL_IMAGE_STRATEGY)" = "registry" ]; then \
		echo "LOCAL_IMAGE_STRATEGY=registry; skipping kind load."; \
	else \
		echo "LOCAL_IMAGE_STRATEGY must be 'kind' or 'registry'."; \
		exit 1; \
	fi

deploy:
	KUBE_CONTEXT="$(KUBE_CONTEXT)" scripts/deploy-app.sh "$(ENV)"

addons:
	KUBE_CONTEXT="$(KUBE_CONTEXT)" scripts/deploy-addons.sh "$(ENV)"

local prod:
	@:
