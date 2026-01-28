SHELL := /usr/bin/env bash

.DEFAULT_GOAL := help

.PHONY: help dev-certs compose-up compose-down compose-logs compose-build

help:
	@echo "Usage: make compose-up"
	@echo "       make compose-down"
	@echo "       make compose-logs"
	@echo "       make compose-build"
	@echo "       make dev-certs"

dev-certs:
	scripts/dev-certs.sh

compose-build:
	docker compose build

compose-up:
	docker compose up --build

compose-down:
	docker compose down

compose-logs:
	docker compose logs -f
