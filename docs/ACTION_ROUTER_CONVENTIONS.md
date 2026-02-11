# Action Router Conventions

This document defines the frontend event-wiring rules for the modular `app/static/assets/js/app/` surface.

## Core Rules

- Use delegated events through `data-action` attributes.
- Use `data-action-event` only when an action should not react to all default router events.
- Use `data-action-prevent-default="true"` when the handler is responsible for form/button default behavior.
- Use `data-action-stop-propagation="true"` only when bubbling causes duplicate/unwanted parent handlers.
- Avoid inline handlers (`onclick=`, `onchange=`, and similar) in module files.

## Action Handler Style

- Keep handlers thin: map payload + context to existing domain functions.
- Parse values through `data-arg-*` and let the router coerce primitives/JSON.
- Prefer explicit payload keys (`data-arg-sub-id`, `data-arg-role`) over positional argument parsing.

## Guardrails

Run:

```bash
script/check
```

The guardrails enforce:

- `no-inline-handler`: no inline handler attributes inside `app/static/assets/js/app/`.
- `no-duplicate-top-level-function`: no duplicate top-level `function` declarations in `app/static/assets/js/**/*.js`.

The no-inline guardrail is intentionally scoped to the module surface while legacy migration remains in progress outside this folder.
