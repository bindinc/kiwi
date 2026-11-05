# Guide subscription start dates (SC-203456)

## Product and edition rules

Confirmed for PR #140 on 2026-11-05:

- Exact product codes `ATV`, `ATL` and `ATM` are AVROTROS memberships;
  `STKN` is a KRO-NCRV membership. They retain the existing independent date
  field and never call or depend on the delivery-date API.
- All other product codes are guides. Missing product/credential context cannot
  be replaced with a guessed classification or a primary credential.
- A single available edition is selected automatically. With multiple entries
  in `variantCodeList`, the employee explicitly chooses an edition. There is no
  first-entry or `NORMAAL` fallback. Missing editions block guide signup.

The cached active offer, selected by sales code, supplies authoritative product,
credential, mandant and allowed editions. Browser-supplied classifications,
credentials and source-date snapshots cannot override it.

## Provider contract

The supplied Abel Webabo OpenAPI contract defines `getStartDates`:
`GET /subscriptions/start-dates`, relative to `hup.webabo_base_url`, with
required `productCode` and `variantCode` query parameters. The response is a
`StartDate` object containing `startDate`, a calendar date in `YYYY-MM-DD` format.
HTTP 400 and 404 are documented. No timezone conversion is appropriate.

`WebaboStartDateClient` uses HTTPS, disables redirects, applies a shared deadline
to authentication and lookup, and retries authentication at most once. Source
bodies and authentication errors are not returned to the browser. Missing,
invalid, past or unavailable source dates never become today's date.

Only the next possible start date is documented. Later dates or a recurring
weekly schedule are not inferred.

## Form and persistence

`GET /api/v1/webabo/offers/{salesCode}/start-date?variantCode=...` is an
authenticated read route with `Cache-Control: no-store`. Offer suggestions expose
`subscriptionKind` and `variantCodes`. The form displays a read-only source date
for each selected guide, explicit edition choices where needed, loading/error
messages and a retry action. A mixed order keeps a separate editable membership
date. Each product retains its own date when source dates differ.

Changing an offer, edition or customer work-session invalidates pending results.
Request generations prevent an older edition response from replacing a later
choice. Saving is blocked while a guide date is missing, loading or unavailable.
A restored outbox order retains its edition and fetches a fresh source date.

`SubscriptionQueueService::normalizeQueuePayload` rechecks the provider date
before either queue persistence or `DeferredCustomerWrites::subscription`
stages an outbox intent. A changed or forged date returns `start_date_changed`
and creates no intent. Valid guide intents retain their edition and a
server-generated `startDateSource` with credential key, mandant, product code,
edition, calendar date and check timestamp. These are source identifiers, not
credentials or tokens.

A delayed upstream sender must recheck the source date before execution; there
is no production subscription sender in this repository. Staging an intent is
not proof of an upstream customer or subscription write.

## Validation and delivery

PR: https://github.com/bindinc/kiwi/pull/140

Story: https://app.shortcut.com/bindincit/story/203456

Regression coverage includes exact membership exclusions, explicit and invalid
editions, independent product dates, changed/past/invalid source dates, rejected
browser overrides, immutable outbox source context, retry and stale-response
handling. Provider transport/authentication is tested separately with synthetic
HTTP responses. No live customer/provider acceptance or production deployment
is implied by these tests.

Shortcut updates and screenshot attachment are deferred under the explicit
one-time exception for this PR because Shortcut access is unavailable.
