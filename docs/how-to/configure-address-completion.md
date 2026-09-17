# Configure address completion

Kiwi completes Dutch street and city fields from postcode, house number and optional
house number addition. This applies to recipient/requester creation, article orders,
customer edits and restitution transfers. Screenshot selection is outside sc-200162.

## Configuration

The existing protected client configuration, loaded through `ClientSecretsLoader`,
accepts the following additional section:

```json
{
  "postnl": {
    "api_key": "<api-key>"
  }
}
```

Bart enters the real value using the existing protected configuration/secret workflow.
Do not paste the key into a ticket, commit, browser, command argument or logs. Keep
existing OIDC and `hup` sections intact. All replicas must receive the same protected
configuration. Restart/redeploy after a configuration change through the normal
approved deployment workflow; no secret or deployment change is included in this PR.

With no PostNL key configured, the application still starts and uses Webabo. The
first usable configured HUP credential is used, regardless of person-search support,
mandant or title. Authentication failures permit the next configured credential;
401 refreshes its token once. No additional Webabo credential is needed.

## API and behaviour

- `POST /api/v1/addresses/search`: JSON strings `formSessionId` (UUID), `postalCode`,
  `houseNumber`, optional `houseNumberAddition`. Authentication and a Kiwi role are required.
- Responses: `{"status":"matched","address":{"street":"...","city":"..."}}`,
  or status `not_found`, `ambiguous`, `unavailable` without an address. Responses are not cached.
- `DELETE /api/v1/addresses/sessions/{formSessionId}` ends the form session (204).
  A late search for a closed session is rejected (409). Invalid input is rejected (400).
- All routes use the deployment prefix, including `/kiwi-preview`.

PostNL is tried first. Missing configuration, transport errors, 401/403, 429, 5xx and
malformed responses permit Webabo fallback. Empty or ambiguous valid results do not.
PostNL 400 is an integration error. Each external call, including HUP authentication,
is capped at three seconds within a ten-second total lookup budget.

Only matching postcode/number/addition results can fill a form. Where no addition
was supplied, multiple candidates must agree on street and city. A full Webabo page
(20 results) is not considered proof of an unambiguous match. The internal address
extension is never submitted to either provider. Returned HTML is never rendered.

Each form/tab gets its own local form identifier. The PostNL UUID is requested lazily
and stored in the existing PostgreSQL-backed authenticated session under its advisory
lock. Repeated searches reuse it across replicas. Successful submission, cancellation,
customer switch and page exit close the form session; failed submission keeps it.
UUIDs expire after twelve hours or at the next UTC calendar day. A bounded map of at
most 100 form sessions prevents unbounded session growth. Closed entries retain no
PostNL UUID and expire with the same retention period.

The UI waits 350 ms after typing, suppresses duplicate requests, ignores old results,
and preserves manual edits. Copied/prefilled values trigger no provider request.
An unavailable service offers a retry; manual entry and saving remain available.

## Verification

Run `make js-test`, `make guardrail`, `php bin/phpunit`, and
`php bin/console lint:container --env=test`. Run the full PHP suite in Compose with
its PostgreSQL service, not on a host without the test database.

The browser runner is `node scripts/compose-smoke-address-completion.mjs`.
It expects an **isolated** local Compose stack with `AddressSmokeHttpClientFactory`
explicitly wired as `address.http_client` and a placeholder PostNL key. Never wire
this fixture into production. It simulates these postcodes:

| Postcode | Scenario |
| --- | --- |
| 1231AA | PostNL success |
| 9998ZZ | PostNL failure, Webabo success |
| 9997ZZ | Both providers fail |
| 9999ZZ | No matching address |

The runner logs in using fallback OIDC, uses synthetic customer data and writes
cropped evidence under `/tmp/sc-200162-smoke`. `KIWI_SMOKE_BASE_URL` selects the
active or preview URL. Its default port is 9443 to avoid disrupting another stack.
Use the standard Compose/Playwright workflow, changing fallback issuer/redirect
URLs and Keycloak hostname consistently if using a different port.

Before acceptance, repeat on the prescribed Flux-bootstrapped three-node local
cluster, route successive searches across replicas with `sessionAffinity: None`,
and confirm only one PostNL token request per form session. After Bart configures
the real key, perform a limited check with a public test address. Record runtime
acceptance separately from automated mock-provider results. Production merge and
rollout require separate approval.

To reproduce the isolated mock-provider browser checks from the PR worktree:

```bash
python3 scripts/prepare-address-smoke.py
GATEWAY_HTTPS_PORT=9443 docker compose -p sc200162 -f docker-compose.yaml -f /tmp/sc-200162-smoke/compose.yaml up -d gateway
node scripts/compose-smoke-address-completion.mjs
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9443/kiwi-preview/ node scripts/compose-smoke-address-completion.mjs
```

The preparation script uses only committed fallback fixtures and placeholder keys.
Use a worktree without a real `client_secrets.json` for this test. The override is
outside the repository and must never be copied into deployment configuration.

For the PostgreSQL session-lock test, scale the isolated app to three replicas,
initialize one session with `php tests/Support/address-session-worker.php init`,
then run `php tests/Support/address-session-worker.php` concurrently in each app
container. The shared `/app/var/address-concurrency-smoke-count` must contain `1`.
The fixture creates its own session and does not read real authenticated sessions.
The same replica check still needs to be repeated on the required Flux/kind cluster.
