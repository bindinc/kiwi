# Configure Entra role authorization

KIWI authorizes every API operation on the server. Admin, supervisor and user can read and write business data. View can only read. Dev alone has no business access; the existing development-feedback feature remains separate. Multiple assigned roles are additive.

## Entra configuration

Assign the existing app-role values `bink8s.app.kiwi.admin`, `.supervisor`, `.user` or `.view` on the KIWI Enterprise Application. KIWI reads roles only from the validated ID token. Directory group names and browser-provided roles are never permissions. This iteration does not require mandant roles and does not restrict visibility by mandant.

The configured issuer must identify the explicit tenant and match the validated token. Common/organizations issuers cannot authorize a session. Non-Microsoft issuers require the explicit local-only `KIWI_LOCAL_OIDC=1` setting; Compose sets this for fallback Keycloak. Do not set it in production.

Existing sessions without the new authorization context must sign in again. Permissions expire at ID-token expiration; extending the HTTP session or refreshing an unrelated access token cannot extend them. Revocation is not immediate: existing claims remain effective until expiration.

## Deployment prerequisites

Configure `TRUSTED_PROXIES` with the actual ingress proxy addresses/CIDRs before deploying. The default trusts loopback only; arbitrary request senders are never implicitly trusted. Validate HTTPS and `/kiwi-preview` forwarded-prefix handling through the configured ingress.

Every browser mutation requires a session CSRF token in `X-CSRF-Token`. The app and Swagger attach this automatically. Cross-origin mutations are rejected. Signed, expiring feedback screenshot URLs retain their existing capability-token validation.

Debug and bulk state-replacement routes require a write role and are unavailable outside dev/test. Legacy upstream-customer edits cannot be routed through the session-state customer PATCH. New customer and bank editing is delivered separately and remains subject to upstream concurrency guarantees.

## Verification

Run PHP tests with an isolated PostgreSQL database, `make js-test`, `make guardrail`, and `make compose-smoke-oidc`. Verify admin/supervisor/user writes, viewer denial, dev-only business denial, direct HTTP requests, CSRF, expired/invalid tokens, and fresh login after rollout. Validate three-node Flux/kind behavior before production approval. No production rollout is implicit in this PR.
