SHELL := /usr/bin/env bash

.DEFAULT_GOAL := help

.PHONY: help dev-certs compose-preflight compose-up compose-down compose-logs compose-build shell console composer phpunit js-test guardrail compose-smoke-oidc image-build

help:
	@echo "Usage: make compose-up"
	@echo "       make compose-down"
	@echo "       make compose-logs"
	@echo "       make compose-build"
	@echo "       make shell"
	@echo "       make console ARGS='about'"
	@echo "       make composer ARGS='install'"
	@echo "       make phpunit"
	@echo "       make js-test"
	@echo "       make guardrail"
	@echo "       make compose-smoke-oidc"
	@echo "       make image-build"
	@echo "       make dev-certs"

dev-certs:
	scripts/dev-certs.sh

compose-build:
	docker compose build app

compose-preflight:
	scripts/compose-prereqs.sh

compose-up: compose-preflight
	docker compose up -d --wait

compose-down:
	docker compose down --remove-orphans

compose-logs:
	docker compose logs -f

shell:
	docker compose exec app sh

console:
	docker compose exec app php bin/console $(ARGS)

composer:
	docker compose exec app composer $(ARGS)

phpunit:
	docker compose exec app php bin/phpunit $(ARGS)

js-test:
	node --test $$(find tests/frontend -name '*.test.mjs' -print | sort)

guardrail:
	node script/check

compose-smoke-oidc:
	scripts/compose-smoke-oidc.sh

image-build:
	docker build --target prod -t kiwi:dev -f infra/docker/app/Dockerfile .
