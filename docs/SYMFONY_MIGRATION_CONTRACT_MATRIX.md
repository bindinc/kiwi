# Symfony Migration Contract Matrix

This matrix records the HTTP and runtime contract that the Symfony runtime must keep compatible with the legacy Flask app during the big-bang migration.

## Runtime contract

| Contract | Requirement |
| --- | --- |
| Image path | `ghcr.io/bindinc/kiwi:v*` |
| Container shape | Single container |
| Listener | Plain HTTP on port `8000` |
| Reverse proxy prefixes | `/kiwi` and `/kiwi-preview` |
| OIDC callback | `/auth/callback` under both prefixes |
| OIDC secret mount | `/etc/kiwi/oidc-client-secrets/client_secrets.json` |
| Local fallback OIDC | `/kiwi-oidc` |
| Session model | PostgreSQL-backed PHP sessions in `public.kiwi_http_sessions` |

## Page routes

| Route | Auth | Expected behavior |
| --- | --- | --- |
| `/` | Required | Redirect to `/login?next=<current-url>` when unauthenticated. Render access denied page with `403` for authenticated users without an allowed Kiwi role. Render the app shell for allowed users. |
| `/login` | Public | Start OIDC login, preserve `next`, and build the redirect URI dynamically from host + forwarded prefix. |
| `/auth/callback` | Public | Complete OIDC authorization-code flow and establish the application session. |
| `/app-logout` | Authenticated session | Clear the local session first, then attempt provider logout with `post_logout_redirect_uri` only when whitelisted in `client_secrets.json`. Fallback target is `/logged-out`. |
| `/logged-out` | Public | Render a logged-out page with a link back to `/login`. |

## API routes

| Route family | Auth | Notes |
| --- | --- | --- |
| `/api/v1/status` | Public | Returns `status`, `timestamp`, and `rate_limit`. |
| `/api/v1/*` except status | Required | Returns structured `401` or `403` JSON errors instead of redirects. |
| `/api/v1/me` | Required | Returns `identity` and `roles`. |
| `/api/v1/bootstrap` | Required | Returns `customers`, `call_queue`, `call_session`, `last_call_session`, and `catalog`. |
| `/api/v1/agent-status` | Required | Persists Kiwi agent status in session and optionally synchronizes to Microsoft Teams when issuer/scope checks allow it. |
| `/api/v1/persons*` | Required | Keeps existing customer read/write, contact history, delivery remarks, complaint, and article-order payload shapes. |
| `/api/v1/workflows*` | Required | Keeps subscription-signup and article-order flow payload shapes and status codes. |
| `/api/v1/catalog*` | Required | Keeps offer, article, quote, delivery-calendar, disposition, and service-number payload shapes. |
| `/api/v1/call-queue*` and `/api/v1/call-session*` | Required | Keeps queue/session workflow semantics and status codes. |
| `/api/v1/subscriptions*` | Required | Keeps subscription mutation, complaint, winback, deceased-actions, and restitution-transfer behavior. |
| `/api/v1/swagger.json` and `/api/v1/swagger` | Required | Keep authenticated OpenAPI/Swagger endpoints under the same paths. |

## Auth and authorization rules

| Rule | Requirement |
| --- | --- |
| Allowed roles | `bink8s.app.kiwi.admin`, `bink8s.app.kiwi.dev`, `bink8s.app.kiwi.supervisor`, `bink8s.app.kiwi.user`, `bink8s.app.kiwi.view` |
| Access denied | Authenticated users without an allowed role get HTML `403` on `/` and JSON `403` on protected API routes |
| External scopes | Default to `openid email profile User.Read Presence.Read Presence.ReadWrite` |
| Fallback scopes | Default to `openid email profile` |
| Redirect URI contract | Exact callback URLs remain `/kiwi/auth/callback` and `/kiwi-preview/auth/callback` |

## Reverse-proxy behavior

| Input | Expected output |
| --- | --- |
| `X-Forwarded-Prefix: /kiwi` | Generated assets, login URLs, logout URLs, and callback URLs stay under `/kiwi` |
| `X-Forwarded-Prefix: /kiwi-preview` | Generated assets, login URLs, logout URLs, and callback URLs stay under `/kiwi-preview` |
| `X-Forwarded-Proto/Host` | Absolute OIDC redirect and logout URLs use the forwarded scheme and host |
