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
