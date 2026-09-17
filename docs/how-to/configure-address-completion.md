# Configure address completion

Kiwi searches Dutch addresses using any two or more of postcode, house number, street
and city, and shows a result list. An invalid postcode is ignored when two other
fields are usable. House numbers must be valid; street and city support prefixes.
Selecting a result completes postcode, house number, street, city and the addition.
The panel floats below street/city and closes after selection; its validation buffer remains. The addition
input never filters searches, including a letter typed in the number field. This applies to recipient/requester creation, article orders,
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

### Interactive SOPS entry

Run this yourself in a local Linux terminal with Python 3, SOPS 3.11 or newer,
and your existing SOPS decryption access. The dedicated GitOps worktree below
has been prepared on branch `codex/configure-postnl-api-key`:

```bash
python3 /home/bartdeijkers/_worktrees/fix-address-completion-with-postnl/scripts/configure-postnl-api-key.py \
  --age-key-file ~/age.agekey \
  /home/bartdeijkers/_worktrees/configure-postnl-api-key/clusters/prod/secrets/kiwi/oidc-client-secrets.sops.yaml
```

Enter the key twice at the hidden prompts. Do not put it in arguments, environment
variables or chat. Success reports that the key was saved encrypted and verified.
The identity path follows the GitOps repository's SOPS instructions. Adjust the
path if your identity is stored elsewhere. The option passes the path to SOPS via
`SOPS_AGE_KEY_FILE`; the script does not read the private identity. Omit the option
if your existing SOPS environment already provides decryption access. Failure
messages identify the SOPS stage and exit code without printing raw diagnostics.
The script preserves all other client settings, supports both Kubernetes `data`
and `stringData`, and retains existing SOPS recipients. Decrypted content stays in
process memory; temporary files contain ciphertext only. SOPS diagnostics are
suppressed because they can contain sensitive content. Failures before replacement
leave the target unchanged. Tests use synthetic values and mocked SOPS, not real keys.

This updates only the local encrypted GitOps file. It does not commit, push,
reconcile Flux or restart workloads. Those steps require the separately approved
GitOps deployment workflow. The production context is `bink8s`; it is distinct
from the local Flux/kind acceptance environment. Both Kiwi deployments mount
`client_secrets.json` from `kiwi-oidc-client`.

## API and behaviour

- `POST /api/v1/addresses/search`: JSON strings `formSessionId` (UUID), `postalCode`,
  `houseNumber`, `street`, `city` (at least two usable fields). Any supplied `houseNumberAddition` is ignored. Authentication and a Kiwi role are required.
- Responses contain `status` and, for successful lookups, `candidates`: objects with
  `postalCode`, `houseNumber`, `houseNumberAddition`, `street` and `city`.
  A single candidate has status `matched`; multiple candidates have `ambiguous`.
  Both require explicit user selection. An empty list has `not_found`; technical
  failure has `unavailable`. Responses are not cached and contain no provider HTML.
  A null addition indicates Webabo did not supply it; selecting this result preserves
  the user's addition. An empty string is a known absence and clears the addition.
- `DELETE /api/v1/addresses/sessions/{formSessionId}` ends the form session (204).
  A late search for a closed session is rejected (409). Invalid input is rejected (400).
- All routes use the deployment prefix, including `/kiwi-preview`.

PostNL is tried first. Missing configuration, transport errors, 401/403, 429, 5xx and
malformed responses permit Webabo fallback. Empty or ambiguous valid results do not.
PostNL 400 is an integration error. Each external call, including HUP authentication,
is capped at three seconds within a ten-second total lookup budget.

Candidates match every supplied field: postcode/number exactly and street/city by
case-insensitive prefix. If none match and at least two other fields exist, one
additional search omits the postcode, sharing the UUID and remaining time budget.
The UI labels these alternatives and changes the postcode only on selection.
There are no transport retries for PostNL. Distinct additions remain separate choices.
Webabo may omit `houseNo`; these results cannot validate the number/addition. A missing
number remains empty unless the user supplied one. A null addition preserves manual
input. Full pages (50 PostNL / 20 Webabo) display a refinement hint rather than claiming
completeness. The internal address extension is never sent to providers.

Each form/tab gets its own local form identifier. The PostNL UUID is requested lazily
and stored in the existing PostgreSQL-backed authenticated session under its advisory
lock. Repeated searches reuse it across replicas. Successful submission, cancellation,
customer switch and page exit close the form session; failed submission keeps it.
UUIDs expire after twelve hours or at the next UTC calendar day. A bounded map of at
most 100 form sessions prevents unbounded session growth. Closed entries retain no
PostNL UUID and expire with the same retention period.

The UI waits 350 ms after typing, suppresses duplicate requests, ignores old results,
and preserves manual edits. Selection is explicit, also for a single result.
The native labelled result list supports keyboard navigation. Changing only the
addition does not trigger or narrow a search. Copied/prefilled values trigger no provider request.
An unavailable service offers a retry. Manual editing remains available, but saving a new or changed address is blocked until the complete address is confirmed.

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

## Mandatory address confirmation

`POST /api/v1/addresses/validate` accepts `formSessionId`, `postalCode`,
`houseNumber`, `houseNumberAddition`, `street` and `city`. A confirmed address is
returned with status `confirmed`. Mutating address APIs independently perform the
same check before writing or queueing. Client-supplied confirmation flags are ignored.
Existing, unchanged customer addresses are not rewritten by this feature.

Search responses include `verified` per candidate, `limited`, and `complete`.
The browser keeps results after dismissing the panel. PostgreSQL session storage
keeps the provider result for the form; API validation and submission reuse it without
another external call when a full candidate matches. Results expire with the form
session, after twelve hours or at the next UTC date, and are erased on close.
There is no shared cache across users or forms.

Only an untruncated postcode/base-number search with fully structured results can
prove a missing variant invalid. A broad, partial, malformed or street-only response
cannot prove absence. In that case validation searches postcode/base number again
using the same UUID and normal lookup budget. A positive complete-address candidate
can confirm existence even in a limited list. Otherwise saving is blocked; Webabo
street-only completion and total provider failure never confirm an address.

Canonical payloads keep the single uppercase house letter attached to the number
(`123A`) and retain the remaining suffix separately (`houseNumberAddition: "2"`).
For the ACI combined suffix, the conversion rule treats a single letter, optionally
followed by a numeric suffix, as that house letter. This API does not expose separate
BAG house-letter and addition fields; this rule is a formatting convention, not an
independent BAG classification. Multiple letters are not moved into houseNumber.
Postcodes have no spaces and city names are uppercase; countryCode is NL.
Internal addressExtension remains separate. The queue preserves houseNumberAddition
as its own field; this PR does not implement a new Paradise delivery worker.

PostNL documentation bills unique UUID sessions rather than each search in the same
session/day. The buffer reduces requests and latency; it does not necessarily reduce
session credits beyond the existing UUID reuse.
