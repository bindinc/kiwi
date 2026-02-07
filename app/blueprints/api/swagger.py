from __future__ import annotations

import re
from typing import Any

from flask import Blueprint, Response, current_app, request

from blueprints.api import API_V1_PREFIX
from blueprints.api.common import PUBLIC_PATHS

BLUEPRINT_NAME = "swagger_api"

swagger_bp = Blueprint(BLUEPRINT_NAME, __name__)

_IGNORED_METHODS = {"HEAD", "OPTIONS"}
_PATH_VARIABLE_PATTERN = re.compile(r"<(?:(?P<converter>[^:<>]+):)?(?P<name>[^<>]+)>")


def _normalize_rule_path(path: str) -> str:
    normalized = path.rstrip("/")
    if not normalized:
        return "/"
    return normalized


def _to_openapi_path(path: str) -> str:
    return _PATH_VARIABLE_PATTERN.sub(lambda match: f"{{{match.group('name')}}}", path)


def _converter_to_schema(converter: str | None) -> dict[str, str]:
    if converter == "int":
        return {"type": "integer"}
    if converter == "float":
        return {"type": "number"}
    if converter == "uuid":
        return {"type": "string", "format": "uuid"}
    return {"type": "string"}


def _build_path_parameters(path: str) -> list[dict[str, Any]]:
    parameters: list[dict[str, Any]] = []
    for match in _PATH_VARIABLE_PATTERN.finditer(path):
        converter = match.group("converter")
        name = match.group("name")
        parameters.append(
            {
                "name": name,
                "in": "path",
                "required": True,
                "schema": _converter_to_schema(converter),
            }
        )
    return parameters


def _operation_id(endpoint: str, method: str) -> str:
    endpoint_name = endpoint.replace(".", "_").replace("-", "_")
    return f"{method.lower()}_{endpoint_name}"


def _operation_summary(endpoint: str, method: str) -> str:
    function_name = endpoint.rsplit(".", 1)[-1]
    summary = function_name.replace("_", " ").strip().capitalize()
    return f"{method} {summary}"


def _operation_tag(openapi_path: str) -> str:
    parts = [part for part in openapi_path.split("/") if part]
    if len(parts) >= 3:
        return parts[2]
    return "api"


def _operation_responses(is_public: bool) -> dict[str, dict[str, str]]:
    responses = {
        "200": {"description": "Successful response"},
    }
    if not is_public:
        responses["401"] = {"description": "Authentication required"}
        responses["403"] = {"description": "Insufficient permissions"}
    return responses


def _security_for_rule(is_public: bool) -> list[dict[str, list[str]]]:
    if is_public:
        return []
    return [{"cookieAuth": []}]


def build_openapi_document() -> dict[str, Any]:
    script_root = (request.script_root or "").rstrip("/")
    server_url = f"{script_root}{API_V1_PREFIX}" if script_root else API_V1_PREFIX
    session_cookie_name = str(current_app.config.get("SESSION_COOKIE_NAME", "session"))

    paths: dict[str, dict[str, Any]] = {}
    api_rules = [
        rule
        for rule in current_app.url_map.iter_rules()
        if rule.rule.startswith(API_V1_PREFIX) and not rule.endpoint.endswith(".static")
    ]
    api_rules.sort(key=lambda candidate: (candidate.rule, candidate.endpoint))

    for rule in api_rules:
        openapi_path = _to_openapi_path(rule.rule)
        normalized_path = _normalize_rule_path(rule.rule)
        is_public = normalized_path in PUBLIC_PATHS

        path_item = paths.setdefault(openapi_path, {})
        path_parameters = _build_path_parameters(rule.rule)

        methods = sorted(method for method in rule.methods if method not in _IGNORED_METHODS)
        for method in methods:
            operation: dict[str, Any] = {
                "operationId": _operation_id(rule.endpoint, method),
                "summary": _operation_summary(rule.endpoint, method),
                "tags": [_operation_tag(openapi_path)],
                "responses": _operation_responses(is_public),
            }
            if path_parameters:
                operation["parameters"] = path_parameters
            security = _security_for_rule(is_public)
            if security:
                operation["security"] = security
            path_item[method.lower()] = operation

    return {
        "openapi": "3.0.3",
        "info": {
            "title": "Kiwi API",
            "version": "v1",
            "description": "Dynamically generated API overview for registered /api/v1 endpoints.",
        },
        "servers": [{"url": server_url}],
        "components": {
            "securitySchemes": {
                "cookieAuth": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": session_cookie_name,
                }
            }
        },
        "paths": paths,
    }


@swagger_bp.get("/swagger.json")
def read_swagger_document() -> tuple[dict[str, Any], int]:
    return build_openapi_document(), 200


@swagger_bp.get("/swagger")
def read_swagger_ui() -> Response:
    html = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kiwi API Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f8fafc; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "./swagger.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
      });
    </script>
  </body>
</html>
""".strip()
    return Response(html, mimetype="text/html")
