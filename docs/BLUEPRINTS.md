# Blueprints

This document describes the blueprint layout and registration rules for Kiwi.

## Layout

```
app/blueprints/
  api/
  address_search/
  home/
  settings/
  registry.py
```

- `app/blueprints/registry.py` is the only registration entrypoint used by `create_app()`.
- `app/blueprints/api/` owns the API base blueprint and versioned URL prefix (`/api/v1`).
- `app/blueprints/home/` owns public pages, including the root route `/`.
- `app/blueprints/settings/` owns settings-related pages and API modules.
- `app/blueprints/address_search/` owns address-search pages and API modules.

## Conventions

- Keep route definitions out of `__init__.py`. Use `api.py`, `pages.py`, or feature modules instead.
- Blueprint names are unique and include both domain and interface when needed.
- API blueprints register under `api_v1_bp` so URLs consistently prefix with `/api/v1`.
- Page blueprints register directly with the Flask app unless nested under a parent domain.

## Adding a New Domain

- Create `app/blueprints/<domain>/api.py` and `app/blueprints/<domain>/pages.py`.
- Define blueprint objects in those modules without side-effectful imports.
- Register the API blueprint via `register_api_blueprint(...)` in `app/blueprints/registry.py`.
- Register the pages blueprint directly in `app/blueprints/registry.py`.
