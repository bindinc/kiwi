# app.js to slices migration checklist

## 1) Header and scope

- Inventory sources:
  - `app/static/assets/js/app.js` (`6,325` lines)
  - `app/static/assets/js/article-search.js` (`695` lines)
  - `app/static/assets/js/delivery-date-picker.js` (`378` lines)
- Inventory depth: full inventory (function-level grouped by domain).
- Snapshot count:
  - `app.js`: `205` top-level `function` declarations + `2` top-level arrow function constants (`translate`, `isDebugModalEnabled`)
  - `article-search.js`: `28` top-level `function` declarations
  - `delivery-date-picker.js`: `19` top-level `function` declarations

## 2) Baseline already extracted

- [x] Runtime extracted for call/queue/agent/disposition/debug in `app/static/assets/js/app/call-agent-runtime.js`.
- [x] Router slices already registered in `app/static/assets/js/app/slices/`:
  - [x] `agent-status-slice.js`
  - [x] `call-session-slice.js`
  - [x] `queue-slice.js`
  - [x] `acw-disposition-slice.js`
  - [x] `debug-slice.js`
  - [x] `order.js` (bridge handlers)
  - [x] `werfsleutel.js` (bridge handlers)
- [x] `app/static/assets/js/app/legacy-actions-customer-subscription.js` is still bridge-only and not domain-implemented.

## 3) PR tracking (one PR per checklist item)

- Rule: each checklist item below must be implemented in its own PR.
- Keep this table updated as the source of truth for planning and merge progress.
- `Merged into main` must only be marked `yes` after the PR branch is merged into `main`.
- Allowed `PR status` values: `not started`, `in progress`, `draft`, `open`, `review`, `blocked`, `merged`, `closed`.

| Item | Domain | Branch | PR | PR status | Merged into main | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Localization + static i18n + locale switching | `codex/migrate-localization-and-locale-switching-to-slice` | [#40](https://github.com/bindinc/kiwi/pull/40) | `merged` | `yes` |  |
| 2 | Bootstrap + shared data init + persistence shell | `codex/extract-bootstrap-and-shared-data-init-into-slice` | [#43](https://github.com/bindinc/kiwi/pull/43) | `merged` | `yes` |  |
| 3 | Werfsleutel catalog + picker implementation | `codex/implement-werfsleutel-catalog-and-picker-slice` | [#45](https://github.com/bindinc/kiwi/pull/45) | `merged` | `yes` |  |
| 4 | Subscription role forms + duplicate guard + person role selection | `TBD` | `TBD` | `not started` | `no` |  |
| 5 | Customer search + results + pagination | `TBD` | `TBD` | `not started` | `no` |  |
| 6 | Customer detail + subscriptions rendering + contact history UI | `TBD` | `TBD` | `not started` | `no` |  |
| 7 | Subscription workflows (create/edit/customer-edit/resend/editorial) | `TBD` | `TBD` | `not started` | `no` |  |
| 8 | Winback + deceased + restitution transfer workflows | `TBD` | `TBD` | `not started` | `no` |  |
| 9 | Article sales + delivery remarks modal implementation | `TBD` | `TBD` | `not started` | `no` |  |
| 10 | Article catalog search/order engine | `TBD` | `TBD` | `not started` | `no` |  |
| 11 | Delivery date picker/calendar engine | `TBD` | `TBD` | `not started` | `no` |  |
| 12 | App shell events + form closing + toast + keyboard/click/change globals | `TBD` | `TBD` | `not started` | `no` |  |
| 13 | Runtime compatibility bridge while migrating | `TBD` | `TBD` | `not started` | `no` |  |

## 4) Full migration checklist by domain

- [ ] 1. Localization + static i18n + locale switching
  - Target slice file(s): `app/static/assets/js/app/slices/localization-slice.js`
  - Source range: `app.js:24-299`
  - Key functions: `translate`, `normalizeStaticLiteral`, `shouldTranslateStaticLiteral`, `hashStaticLiteral`, `buildStaticLiteralSlug`, `buildIndexHtmlI18nKey`, `applyIndexHtmlTranslations`, `normalizeAppLocale`, `getAppLocale`, `getDateLocaleForApp`, `setDocumentLocale`, `updateLocaleMenuSelection`, `applyLocaleToUi`, `setAppLocale`
  - Bound action names: none yet (currently inline handlers for locale switching)
  - Dependency/risk note: convert inline template handlers at `app/templates/base/index.html:62` and `app/templates/base/index.html:63` to router actions before removing globals.

- [ ] 2. Bootstrap + shared data init + persistence shell
  - Target slice file(s): `app/static/assets/js/app/slices/bootstrap-slice.js`, `app/static/assets/js/app/slices/app-data-slice.js` (or one consolidated equivalent)
  - Source range: `app.js:1-23`, `app.js:301-314`, `app.js:3064-3174`
  - Key functions/state: `customers`, `currentCustomer`, `selectedOffer`, `searchState`, `contactHistoryState`, endpoint constants, `bootstrapState`, `upsertCustomerInCache`, `initializeKiwiApplication`, `loadBootstrapState`, `initializeData`, `saveCustomers`, `updateCustomerActionButtons`, `updateTime`
  - Bound action names: none direct (cross-cutting initialization and persistence shell)
  - Dependency/risk note: this block wires `initDeliveryDatePicker`, `initArticleSearch`, and runtime startup; extraction order must preserve startup sequence.

- [ ] 3. Werfsleutel catalog + picker implementation
  - Target slice file(s): `app/static/assets/js/app/slices/werfsleutel.js` (replace bridge-only calls with implementation)
  - Source range: `app.js:414-1207`
  - Key functions/state: werfsleutel constants/state + `ensureWerfsleutelsLoaded`, `syncWerfsleutelsCatalog`, `searchWerfsleutelsViaApi`, `findWerfsleutelCandidate`, `getWerfsleutelOfferDetails`, `initWerfsleutelPicker`, `handleWerfsleutelInputKeyDown`, `handleWerfsleutelQuery`, `renderWerfsleutelSuggestions`, `selectWerfsleutel`, `renderWerfsleutelChannelOptions`, `selectWerfsleutelChannel`, `updateWerfsleutelSummary`, `resetWerfsleutelPicker`, `triggerWerfsleutelBackgroundRefreshIfStale`
  - Bound action names: `handle-werfsleutel-input`, `reset-werfsleutel-picker`, `select-werfsleutel`, `select-werfsleutel-channel`
  - Dependency/risk note: strongly coupled to subscription creation payload and to shared `translate`/currency helpers.

- [ ] 4. Subscription role forms + duplicate guard + person role selection
  - Target slice file(s): `app/static/assets/js/app/slices/subscription-role-slice.js`
  - Source range: `app.js:1376-2851`
  - Key functions/state: birthday helpers, reusable customer form helpers, role config/rendering, requester synchronization, duplicate input normalization/fingerprinting/cache/API check flow, duplicate UI rendering/actions, role person search/select flow, payload builders, role initialization/reset
  - Bound action names: `toggle-customer-form-address`, `set-subscription-role-mode`, `search-subscription-role-person`, `toggle-requester-same-as-recipient`, `select-subscription-duplicate-person`, `toggle-subscription-duplicate-matches`, `acknowledge-subscription-duplicate-warning`, `select-subscription-role-person`
  - Dependency/risk note: high coupling to `customers`, `currentCustomer`, `personsApiUrl`, and modal/form DOM IDs; extraction should keep state container explicit.

- [ ] 5. Customer search + results + pagination
  - Target slice file(s): `app/static/assets/js/app/slices/customer-search-slice.js`
  - Source range: `app.js:3209-3777` (+ `searchState` at `app.js:6-13`)
  - Key functions: `normalizePhone`, `getSearchFilters`, matching helpers, `buildSearchQueryLabel`, `setAdditionalFiltersOpen`, `toggleAdditionalFilters`, `searchCustomer`, `handleSearchKeyPress`, `displayPaginatedResults`, name rendering helpers, `renderCustomerRow`, `renderPagination`, `getPageNumbers`, `goToPage`, `scrollToResults`, `clearSearchResults`, `closeCustomerDetail`, `sortResults`, `sortResultsData`, `displaySearchResults`
  - Bound action names: `search-handle-keypress`, `toggle-additional-filters`, `search-customer`, `sort-results`, `go-to-page`, `scroll-to-results`, `clear-search-results`, `close-customer-detail`
  - Dependency/risk note: result-row markup also drives call-session identify action (`call-session.identify-caller`) and selection action (`select-customer`).

- [ ] 6. Customer detail + subscriptions rendering + contact history UI
  - Target slice file(s): `app/static/assets/js/app/slices/customer-detail-slice.js`, `app/static/assets/js/app/slices/contact-history-slice.js`
  - Source range: `app.js:3780-4214` (+ `contactHistoryState` at `app.js:15-23`)
  - Key functions: `selectCustomer`, `displayDeceasedStatusBanner`, `displaySubscriptions`, contact type config + `getContactTypeInfo`, `displayContactHistory`, `toggleTimelineItem`, `changeContactHistoryPage`, `formatDate`, `formatDateTime`
  - Bound action names: `select-customer`, `toggle-timeline-item`, `change-contact-history-page`, plus subscription item actions embedded in rendered markup (`edit-subscription`, `cancel-subscription`, `start-winback-for-subscription`, `revert-restitution`)
  - Dependency/risk note: `selectCustomer` is also required by runtime compatibility while call runtime remains global.

- [ ] 7. Subscription workflows (create/edit/customer-edit/resend/editorial)
  - Target slice file(s): `app/static/assets/js/app/slices/subscription-workflow-slice.js`
  - Source range: `app.js:4217-4832` (+ `app.js:4380-4392`)
  - Key functions: `showNewSubscription`, `createSubscription`, `getSubscriptionRequesterMetaLine`, `editCustomer`, `saveCustomerEdit`, `showResendMagazine`, `resendMagazine`, `showEditorialComplaintForm`, `submitEditorialComplaint`, `editSubscription`, `saveSubscriptionEdit`
  - Bound action names: `show-new-subscription`, `create-subscription`, `edit-customer`, `save-customer-edit`, `show-resend-magazine`, `resend-magazine`, `show-editorial-complaint-form`, `submit-editorial-complaint`, `edit-subscription`, `save-subscription-edit`
  - Dependency/risk note: depends on role payload builders and duplicate-submit guard from domain 4.

- [ ] 8. Winback + deceased + restitution transfer workflows
  - Target slice file(s): `app/static/assets/js/app/slices/winback-slice.js`
  - Source range: `app.js:4835-5619`
  - Key functions/state: `cancelSubscription`, `startWinbackForSubscription`, `showWinbackFlow`, `winbackNextStep`, `winbackPrevStep`, `generateWinbackOffers`, `selectOffer`, `generateWinbackScript`, `winbackHandleDeceased`, `processDeceasedSubscriptions`, deceased form variants, restitution transfer functions, `completeAllDeceasedActions`, transfer/refund getters and validators, `completeWinback`
  - Bound action names: `cancel-subscription`, `start-winback-for-subscription`, `winback-next-step`, `winback-prev-step`, `process-deceased-subscriptions`, `complete-all-deceased-actions`, `revert-restitution`, `toggle-restitution-transfer-address`, `complete-restitution-transfer`, `complete-winback`, `select-offer`
  - Dependency/risk note: uses temporary `window.*` workflow state; extraction should replace with explicit module state.

- [ ] 9. Article sales + delivery remarks modal implementation
  - Target slice file(s): `app/static/assets/js/app/slices/order.js` (implementation), `app/static/assets/js/app/slices/delivery-remarks-slice.js`
  - Source range: `app.js:5621-6162`
  - Key functions: `displayArticles`, `showArticleSale`, `addDeliveryRemark`, `addDeliveryRemarkByKey`, `createArticleSale`, `editDeliveryRemarks`, `addDeliveryRemarkToModal`, `addDeliveryRemarkToModalByKey`, `saveDeliveryRemarks`, `closeEditRemarksModal`
  - Bound action names: order actions (`open-article-sale-form`, `close-article-sale-form`, `submit-article-sale-form`, `add-delivery-remark`, `add-delivery-remark-modal`, `filter-articles`, `update-article-price`, `add-article-to-order`, `apply-coupon`, `apply-coupon-on-enter`) and modal actions already bound for remark shortcuts
  - Dependency/risk note: move inline handlers at `app/templates/base/index.html:1287`, `app/templates/base/index.html:1338`, and `app/templates/base/index.html:1339` to action-router hooks; keep `createArticleSale` working while `orderItems`/`getOrderData` ownership shifts into slices.

- [ ] 10. Article catalog search/order engine (currently in legacy script)
  - Target slice file(s): `app/static/assets/js/app/slices/article-search-slice.js` (or split into `article-catalog-slice.js` + `order-quote-slice.js`)
  - Source range: `article-search.js:1-695`
  - Key functions/state: `translateArticle`, catalog/quote API constants, `articleLookup`, `latestSearchArticles`, `modalArticles`, `currentArticleTab`, `selectedArticleIndex`, `orderItems`, `appliedCoupon`, `lastOrderQuote`, `fetchArticles`, `fetchArticleById`, `requestOrderQuote`, `initArticleSearch`, `filterArticles`, `renderArticleDropdown`, `selectArticle`, modal/tabs/search functions, order mutation functions (`addArticleToOrder`, `removeArticleFromOrder`, `applyCoupon`, `removeCoupon`), `renderOrderItems`, `getOrderData`
  - Bound action names: `filter-articles`, `update-article-price`, `add-article-to-order`, `apply-coupon`, `apply-coupon-on-enter`, `show-all-articles`, `select-article`, `filter-modal-articles`, `show-article-tab`, `select-article-from-modal`, `close-all-articles-modal`, `remove-article-from-order`, `remove-coupon`
  - Dependency/risk note: currently depends on global `showToast` and is initialized from `initializeKiwiApplication`; extraction needs explicit shared interface for order state used by `createArticleSale`.

- [ ] 11. Delivery date picker/calendar engine (currently in legacy script)
  - Target slice file(s): `app/static/assets/js/app/slices/delivery-date-picker-slice.js`
  - Source range: `delivery-date-picker.js:1-378`
  - Key functions/state: `translateDelivery`, delivery calendar API/cache state, `formatDateInputValue`, `fetchDeliveryCalendar`, `formatDeliveryDateLabel`, `initDeliveryDatePicker`, calendar open/close/position helpers, `generateCalendar`, `navigateCalendar`, `selectDeliveryDate`, `selectDeliveryDateByString`, `selectRecommendedDate`, `findNextAvailableDate`, quick-select helpers
  - Bound action names: `select-recommended-delivery-date`, `navigate-delivery-calendar`, `select-delivery-date`
  - Dependency/risk note: currently uses document/window listeners and is initialized from `initializeKiwiApplication`; preserve lifecycle and listener cleanup semantics when moving to slices.

- [ ] 12. App shell events + form closing + toast + keyboard/click/change globals
  - Target slice file(s): `app/static/assets/js/app/slices/app-shell-slice.js`
  - Source range: `app.js:1304`, `app.js:6165-6325`
  - Key functions/listeners: `endSession`, `closeForm`, `mapToastTypeToContactType`, `showToast`, `isDebugModalEnabled`, debug key sequence constants/state, global `document` listeners for `keydown`, `click`, `change`
  - Bound action names: `close-form` (plus global listeners outside router)
  - Dependency/risk note: listener extraction must preserve outside-click close behavior for both debug modal and agent status menu.

- [ ] 13. Runtime compatibility bridge while migrating
  - Target slice file(s): temporary bridge section only (no final target slice)
  - Source functions required by runtime namespace: `addContactMoment` (`app.js:2980`), `getDispositionCategories` (`app.js:1282`), `selectCustomer` (`app.js:3780`), `showToast` (`app.js:6190`), `startCallSession` (`app.js:2995`)
  - Bound action names: indirect via runtime client methods in `app/static/assets/js/app/slices/call-agent-runtime-client.js`
  - Dependency/risk note: keep compatibility exports until runtime no longer depends on legacy globals.
  - [ ] Remove this temporary bridge once runtime dependencies have been internalized by slices.

## 5) Recommended migration order

1. Localization + app shell action conversion
2. Shared bootstrap/state extraction
3. Werfsleutel + subscription role/duplicate logic
4. Customer search/detail/contact history
5. Article catalog/order engine extraction (`article-search.js` -> slices)
6. Delivery calendar extraction (`delivery-date-picker.js` -> slices)
7. Subscription workflows
8. Winback/deceased/restitution
9. Article sales + delivery remarks
10. Runtime bridge cleanup

## 6) Verification commands

- Action coverage parity (markup vs registered actions):

```bash
set -euo pipefail
TMPA=$(mktemp)
TMPB=$(mktemp)
rg -o 'data-action="[^"]+"' app/templates/base/index.html app/static/assets/js/app.js \
  app/static/assets/js/article-search.js app/static/assets/js/delivery-date-picker.js \
  | sed -E 's/.*data-action="([^"]+)"/\1/' | sort -u > "$TMPA"
rg -n "^[[:space:]]*'[^']+'" app/static/assets/js/app/legacy-actions-customer-subscription.js app/static/assets/js/app/slices/*.js \
  | sed -E "s/.*'([^']+)'.*/\1/" | sort -u > "$TMPB"
echo "IN_MARKUP_NOT_REGISTERED"
comm -23 "$TMPA" "$TMPB" || true
echo "REGISTERED_NOT_IN_MARKUP"
comm -13 "$TMPA" "$TMPB" || true
rm -f "$TMPA" "$TMPB"
```

- Function inventory check against legacy frontend sources:

```bash
wc -l app/static/assets/js/app.js app/static/assets/js/article-search.js app/static/assets/js/delivery-date-picker.js
rg -n "^(async\\s+)?function\\s+[A-Za-z0-9_]+" app/static/assets/js/app.js | wc -l
rg -n "^(async\\s+)?function\\s+[A-Za-z0-9_]+" app/static/assets/js/article-search.js | wc -l
rg -n "^(async\\s+)?function\\s+[A-Za-z0-9_]+" app/static/assets/js/delivery-date-picker.js | wc -l
rg -n "^const\\s+[A-Za-z0-9_]+\\s*=\\s*\\([^)]*\\)\\s*=>" app/static/assets/js/app.js | wc -l
```

- Manual coverage check:

```bash
# Manually verify every app.js range appears exactly once across domains 1-13.
# Manually verify full-file ranges are covered for article-search.js and delivery-date-picker.js.
# Confirm that only intentional cross-cutting references remain.
```

## 7) Important public API/interface/type changes

- No runtime API/type changes in this task.
- This is a documentation-only change that defines planned target slice boundaries and migration order.

## 8) Test cases and scenarios (for this planning-doc change)

1. Confirm `plan/app-js-to-slices-checklist.md` exists.
2. Confirm all 13 domain checklist items are present and unchecked.
3. Confirm baseline-completed section exists and marks current extracted slices/runtime as done.
4. Confirm line references are present for every domain item (`app.js`, `article-search.js`, `delivery-date-picker.js` sources).
5. Confirm migration order and verification commands sections are present.

## 9) Assumptions and defaults

- Language is English.
- Scope is full inventory.
- Primary inventory scope includes `app/static/assets/js/app.js`, `app/static/assets/js/article-search.js`, and `app/static/assets/js/delivery-date-picker.js`.
- Template inline handlers are still documented as coupling/risk notes until converted to router actions.
- Line references are based on the current snapshot and may drift after later edits.
