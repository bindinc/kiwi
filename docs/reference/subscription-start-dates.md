# Guide subscription start dates (SC-203456)

## Confirmed provider contract

The supplied Abel Webabo OpenAPI file
`security2026/Docs/Abel/API/Webabo/webabo-api-docs.json` defines operation
`getStartDates`: `GET /subscriptions/start-dates`, relative to the configured
`hup.webabo_base_url`. Both `productCode` and `variantCode` are required query
parameters. Use the cached offer's originating credential for authentication;
never fall back to the first configured credential.

HTTP 200 returns a `StartDate` object with `startDate` of type `string`, format
`date` (`YYYY-MM-DD`). It is a calendar date: no time or timezone conversion is
appropriate. HTTP 400 and 404 are documented. Missing, invalid and unavailable
dates must never become today's date. `Offer.variantCodeList` supplies available
editions. No default edition or recurring schedule is specified.

The endpoint returns only the next possible start date. It does not establish
which later dates are valid; accepting arbitrary dates after a minimum or
inventing a weekly schedule would exceed this contract.

## Outstanding configuration evidence

The supplied `Offer` and `BaseData` schemas do not classify products as guide
subscriptions versus broadcaster memberships. A confirmed product classification
per credential and product code is required. Display names, sales-code prefixes,
and delivery frequency are not a reliable substitute. Broadcaster memberships
must retain their existing date rules and must never call this delivery-date API.

Live provider behavior and credentials have not been verified by this contract
inspection. Local synthetic tests are not evidence of live acceptance.

## Delivery status and remaining work

Draft PR: https://github.com/bindinc/kiwi/pull/140

Story: https://app.shortcut.com/bindincit/story/203456

The provider client is implemented and tested. It is deliberately not connected
to signup yet: without a verified product-kind rule, calling it for every offer
would violate the explicit requirement to leave memberships independent. The
existing signup behavior, including its incorrect date default for guides,
therefore remains unresolved in this draft.

Before completing the integration, confirm:

1. The authoritative guide/membership classification, keyed by source credential,
   mandant and exact `productCode`, or an authoritative model field that supplies it.
2. How the order's edition is selected when `variantCodeList` contains multiple
   values. No first-item or `NORMAAL` fallback is established by this contract.

Then connect offer/edition selection to the source lookup and server-side signup
validation. Reject dates outside the returned source value, missing/past/invalid
dates, and unavailable responses. Preserve calendar dates without UTC conversion.
Invalidate reads when the offer, edition or customer work-session changes; ignore
out-of-order responses. Multiple selected products need dates per product when
their source dates differ, while memberships keep their independent rules.
Revalidate before creating the deferred outbox intent, and retain source context
in its immutable payload. Delayed upstream execution needs a separate source-date
recheck by its sender; no production sender is implemented in this repository.

Complete the form/error-state tests and a cropped synthetic-data screenshot,
confirm its Shortcut attachment, and verify a controlled provider interaction
before claiming end-to-end acceptance.
