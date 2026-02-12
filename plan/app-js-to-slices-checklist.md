# app.js to slices migration checklist

## 1) Header and scope

- Inventory sources:
  - `app/static/assets/js/app.js` (`2,086` lines)
  - `app/static/assets/js/app/slices/article-search-slice.js` (`1,014` lines)
  - `app/static/assets/js/app/slices/delivery-date-picker-slice.js` (`635` lines)
- Inventory depth: full inventory (function-level grouped by domain).
- Snapshot count:
  - `app.js`: `107` top-level `function` declarations + `1` top-level arrow function constant (`isDebugModalEnabled`)
  - `article-search.js`: `16` top-level `function` declarations
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
- [x] Legacy customer-subscription router bridge removed; `close-form` and caller-identification actions are owned by `app-shell-slice.js` and `call-session-slice.js`.

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
| 4 | Subscription role forms + duplicate guard + person role selection | `codex/migrate-subscription-role-forms-duplicate-guard-person-role-selection` | [#41](https://github.com/bindinc/kiwi/pull/41) | `merged` | `yes` |  |
| 5 | Customer search + results + pagination | `codex/migrate-customer-search-results-and-pagination-to-slice` | [#42](https://github.com/bindinc/kiwi/pull/42) | `merged` | `yes` |  |
| 6 | Customer detail + subscriptions rendering + contact history UI | `codex/migrate-customer-detail-and-contact-history-to-slices` | [#44](https://github.com/bindinc/kiwi/pull/44) | `merged` | `yes` |  |
| 7 | Subscription workflows (create/edit/customer-edit/resend/editorial) | `codex/migrate-subscription-workflows-to-subscription-workflow-slice` | [#46](https://github.com/bindinc/kiwi/pull/46) | `merged` | `yes` |  |
| 8 | Winback + deceased + restitution transfer workflows | `codex/migrate-winback-deceased-restitution-workflows-to-slice` | [#48](https://github.com/bindinc/kiwi/pull/48) | `merged` | `yes` |  |
| 9 | Article sales + delivery remarks modal implementation | `codex/implement-article-sales-and-delivery-remarks-modal-slices` | [#49](https://github.com/bindinc/kiwi/pull/49) | `merged` | `yes` |  |
| 10 | Article catalog search/order engine | `codex/extract-article-catalog-search-and-order-engine-into-slice` | [#47](https://github.com/bindinc/kiwi/pull/47) | `merged` | `yes` |  |
| 11 | Delivery date picker/calendar engine | `codex/migrate-delivery-date-picker-calendar-engine-to-slice` | [#50](https://github.com/bindinc/kiwi/pull/50) | `merged` | `yes` |  |
| 12 | App shell events + form closing + toast + keyboard/click/change globals | `codex/extract-app-shell-events-and-global-listeners-into-app-shell-slice` | [#51](https://github.com/bindinc/kiwi/pull/51) | `merged` | `yes` |  |
| 13 | Runtime compatibility bridge while migrating | `codex/implement-runtime-compatibility-bridge-while-migrating` | [#52](https://github.com/bindinc/kiwi/pull/52) | `merged` | `yes` |  |
| 14 | Remove duplicated Werfsleutel implementation from legacy app.js | `codex/remove-duplicated-werfsleutel-implementation-from-legacy-app-js` | [#56](https://github.com/bindinc/kiwi/pull/56) | `merged` | `yes` | Keep a single source of truth in `slices/werfsleutel.js`. |
| 15 | Extract shared pricing + subscription identity helpers from app.js globals | `codex/extract-shared-pricing-and-subscription-identity-helpers` | [#59](https://github.com/bindinc/kiwi/pull/59) | `merged` | `yes` | Move helper ownership out of legacy globals. |
| 16 | Extract contact-history mutation + contact-moment adapter from app.js | `codex/extract-contact-history-mutation-and-contact-moment-adapter` | [#57](https://github.com/bindinc/kiwi/pull/57) | `merged` | `yes` | Remove direct state mutation and persistence fallback from legacy script. |
| 17 | Extract call-session start/duration UI bridge from app.js | `codex/extract-call-session-start-and-duration-ui-bridge` | [#60](https://github.com/bindinc/kiwi/pull/60) | `merged` | `yes` | Consolidate call-session timer/UI ownership. |
| 18 | Remove window dependency-provider bridge (`kiwiGet*SliceDependencies`) | `codex/remove-window-slice-dependency-provider-bridge` | [#58](https://github.com/bindinc/kiwi/pull/58) | `merged` | `yes` | Replace `window` provider lookups with explicit module wiring. |
| 19 | Remove legacy facade wrappers that only proxy to slice methods | `codex/remove-legacy-facade-wrappers-proxying-to-slices` | [#61](https://github.com/bindinc/kiwi/pull/61) | `merged` | `yes` | Migrate remaining global function callers to router/slice entry points. |
| 20 | Remove app-shell fallback paths + move runtime wiring out of app.js | `codex/remove-app-shell-fallbacks-and-runtime-wiring-from-app-js` | [#62](https://github.com/bindinc/kiwi/pull/62) | `merged` | `yes` | App shell and runtime wiring should live in slice/runtime modules only. |
| 21 | Retire legacy bootstrap wrappers and script-loader dependency on app.js | `codex/retire-legacy-bootstrap-wrappers-and-app-js-loader-path` | [#63](https://github.com/bindinc/kiwi/pull/63) | `open` | `no` | Final deletion target for `app.js` legacy bootstrap role. |

## 4) Full migration checklist by domain

- Status update (inspected on 2026-02-11):
  - Domains `1-13` are implemented and merged.
  - Domains `1-13` keep historical line references from the pre-slice legacy snapshot (`app.js` at `6,325` lines) for merged-PR traceability.
  - `app.js` still contains residual legacy code that duplicates slice logic and bridges dependencies through `window`.
  - Domains `14-21` use the current snapshot (`app.js` at `2,086` lines) and track the remaining post-migration cleanup.

- [x] 1. Localization + static i18n + locale switching
  - Target slice file(s): `app/static/assets/js/app/slices/localization-slice.js`
  - Source range: `app.js:24-299`
  - Key functions: `translate`, `normalizeStaticLiteral`, `shouldTranslateStaticLiteral`, `hashStaticLiteral`, `buildStaticLiteralSlug`, `buildIndexHtmlI18nKey`, `applyIndexHtmlTranslations`, `normalizeAppLocale`, `getAppLocale`, `getDateLocaleForApp`, `setDocumentLocale`, `updateLocaleMenuSelection`, `applyLocaleToUi`, `setAppLocale`
  - Bound action names: `localization.set-locale`
  - Dependency/risk note: locale switching now routes through action-router handlers in `app/templates/base/index.html`.

- [x] 2. Bootstrap + shared data init + persistence shell
  - Target slice file(s): `app/static/assets/js/app/slices/bootstrap-slice.js`, `app/static/assets/js/app/slices/app-data-slice.js` (or one consolidated equivalent)
  - Source range: `app.js:1-23`, `app.js:301-314`, `app.js:3064-3174`
  - Key functions/state: `customers`, `currentCustomer`, `selectedOffer`, `searchState`, `contactHistoryState`, endpoint constants, `bootstrapState`, `upsertCustomerInCache`, `initializeKiwiApplication`, `loadBootstrapState`, `initializeData`, `saveCustomers`, `updateCustomerActionButtons`, `updateTime`
  - Bound action names: none direct (cross-cutting initialization and persistence shell)
  - Dependency/risk note: this block wires `initDeliveryDatePicker`, `initArticleSearch`, and runtime startup; extraction order must preserve startup sequence.

- [x] 3. Werfsleutel catalog + picker implementation
  - Target slice file(s): `app/static/assets/js/app/slices/werfsleutel.js` (replace bridge-only calls with implementation)
  - Source range: `app.js:414-1207`
  - Key functions/state: werfsleutel constants/state + `ensureWerfsleutelsLoaded`, `syncWerfsleutelsCatalog`, `searchWerfsleutelsViaApi`, `findWerfsleutelCandidate`, `getWerfsleutelOfferDetails`, `initWerfsleutelPicker`, `handleWerfsleutelInputKeyDown`, `handleWerfsleutelQuery`, `renderWerfsleutelSuggestions`, `selectWerfsleutel`, `renderWerfsleutelChannelOptions`, `selectWerfsleutelChannel`, `updateWerfsleutelSummary`, `resetWerfsleutelPicker`, `triggerWerfsleutelBackgroundRefreshIfStale`
  - Bound action names: `handle-werfsleutel-input`, `reset-werfsleutel-picker`, `select-werfsleutel`, `select-werfsleutel-channel`
  - Dependency/risk note: strongly coupled to subscription creation payload and to shared `translate`/currency helpers.

- [x] 4. Subscription role forms + duplicate guard + person role selection
  - Target slice file(s): `app/static/assets/js/app/slices/subscription-role-slice.js`
  - Source range: `app.js:1376-2851`
  - Key functions/state: birthday helpers, reusable customer form helpers, role config/rendering, requester synchronization, duplicate input normalization/fingerprinting/cache/API check flow, duplicate UI rendering/actions, role person search/select flow, payload builders, role initialization/reset
  - Bound action names: `toggle-customer-form-address`, `set-subscription-role-mode`, `search-subscription-role-person`, `toggle-requester-same-as-recipient`, `select-subscription-duplicate-person`, `toggle-subscription-duplicate-matches`, `acknowledge-subscription-duplicate-warning`, `select-subscription-role-person`
  - Dependency/risk note: high coupling to `customers`, `currentCustomer`, `personsApiUrl`, and modal/form DOM IDs; extraction should keep state container explicit.

- [x] 5. Customer search + results + pagination
  - Target slice file(s): `app/static/assets/js/app/slices/customer-search-slice.js`
  - Source range: `app.js:3209-3777` (+ `searchState` at `app.js:6-13`)
  - Key functions: `normalizePhone`, `getSearchFilters`, matching helpers, `buildSearchQueryLabel`, `setAdditionalFiltersOpen`, `toggleAdditionalFilters`, `searchCustomer`, `handleSearchKeyPress`, `displayPaginatedResults`, name rendering helpers, `renderCustomerRow`, `renderPagination`, `getPageNumbers`, `goToPage`, `scrollToResults`, `clearSearchResults`, `closeCustomerDetail`, `sortResults`, `sortResultsData`, `displaySearchResults`
  - Bound action names: `search-handle-keypress`, `toggle-additional-filters`, `search-customer`, `sort-results`, `go-to-page`, `scroll-to-results`, `clear-search-results`, `close-customer-detail`
  - Dependency/risk note: result-row markup also drives call-session identify action (`call-session.identify-caller`) and selection action (`select-customer`).

- [x] 6. Customer detail + subscriptions rendering + contact history UI
  - Target slice file(s): `app/static/assets/js/app/slices/customer-detail-slice.js`, `app/static/assets/js/app/slices/contact-history-slice.js`
  - Source range: `app.js:3780-4214` (+ `contactHistoryState` at `app.js:15-23`)
  - Key functions: `selectCustomer`, `displayDeceasedStatusBanner`, `displaySubscriptions`, contact type config + `getContactTypeInfo`, `displayContactHistory`, `toggleTimelineItem`, `changeContactHistoryPage`, `formatDate`, `formatDateTime`
  - Bound action names: `select-customer`, `toggle-timeline-item`, `change-contact-history-page`, plus subscription item actions embedded in rendered markup (`edit-subscription`, `cancel-subscription`, `start-winback-for-subscription`, `revert-restitution`)
  - Dependency/risk note: `selectCustomer` is also required by runtime compatibility while call runtime remains global.

- [x] 7. Subscription workflows (create/edit/customer-edit/resend/editorial)
  - Target slice file(s): `app/static/assets/js/app/slices/subscription-workflow-slice.js`
  - Source range: `app.js:4217-4832` (+ `app.js:4380-4392`)
  - Key functions: `showNewSubscription`, `createSubscription`, `getSubscriptionRequesterMetaLine`, `editCustomer`, `saveCustomerEdit`, `showResendMagazine`, `resendMagazine`, `showEditorialComplaintForm`, `submitEditorialComplaint`, `editSubscription`, `saveSubscriptionEdit`
  - Bound action names: `show-new-subscription`, `create-subscription`, `edit-customer`, `save-customer-edit`, `show-resend-magazine`, `resend-magazine`, `show-editorial-complaint-form`, `submit-editorial-complaint`, `edit-subscription`, `save-subscription-edit`
  - Dependency/risk note: depends on role payload builders and duplicate-submit guard from domain 4.

- [x] 8. Winback + deceased + restitution transfer workflows
  - Target slice file(s): `app/static/assets/js/app/slices/winback-slice.js`
  - Source range: `app.js:4835-5619`
  - Key functions/state: `cancelSubscription`, `startWinbackForSubscription`, `showWinbackFlow`, `winbackNextStep`, `winbackPrevStep`, `generateWinbackOffers`, `selectOffer`, `generateWinbackScript`, `winbackHandleDeceased`, `processDeceasedSubscriptions`, deceased form variants, restitution transfer functions, `completeAllDeceasedActions`, transfer/refund getters and validators, `completeWinback`
  - Bound action names: `cancel-subscription`, `start-winback-for-subscription`, `winback-next-step`, `winback-prev-step`, `process-deceased-subscriptions`, `complete-all-deceased-actions`, `revert-restitution`, `toggle-restitution-transfer-address`, `complete-restitution-transfer`, `complete-winback`, `select-offer`
  - Dependency/risk note: uses temporary `window.*` workflow state; extraction should replace with explicit module state.

- [x] 9. Article sales + delivery remarks modal implementation
  - Target slice file(s): `app/static/assets/js/app/slices/order.js` (implementation), `app/static/assets/js/app/slices/delivery-remarks-slice.js`
  - Source range: `app.js:5621-6162`
  - Key functions: `displayArticles`, `showArticleSale`, `addDeliveryRemark`, `addDeliveryRemarkByKey`, `createArticleSale`, `editDeliveryRemarks`, `addDeliveryRemarkToModal`, `addDeliveryRemarkToModalByKey`, `saveDeliveryRemarks`, `closeEditRemarksModal`
  - Bound action names: order actions (`open-article-sale-form`, `close-article-sale-form`, `submit-article-sale-form`, `add-delivery-remark`, `add-delivery-remark-modal`, `filter-articles`, `update-article-price`, `add-article-to-order`, `apply-coupon`, `apply-coupon-on-enter`) and modal actions already bound for remark shortcuts
  - Dependency/risk note: modal handlers at `app/templates/base/index.html:1287`, `app/templates/base/index.html:1338`, and `app/templates/base/index.html:1339` now use action-router hooks; `createArticleSale` remains coupled to shared order-state dependencies exposed by slices.

- [x] 10. Article catalog search/order engine
  - Target slice file(s): `app/static/assets/js/app/slices/article-search-slice.js` (or split into `article-catalog-slice.js` + `order-quote-slice.js`)
  - Source range: `article-search.js:1-695`
  - Key functions/state: `translateArticle`, catalog/quote API constants, `articleLookup`, `latestSearchArticles`, `modalArticles`, `currentArticleTab`, `selectedArticleIndex`, `orderItems`, `appliedCoupon`, `lastOrderQuote`, `fetchArticles`, `fetchArticleById`, `requestOrderQuote`, `initArticleSearch`, `filterArticles`, `renderArticleDropdown`, `selectArticle`, modal/tabs/search functions, order mutation functions (`addArticleToOrder`, `removeArticleFromOrder`, `applyCoupon`, `removeCoupon`), `renderOrderItems`, `getOrderData`
  - Bound action names: `filter-articles`, `update-article-price`, `add-article-to-order`, `apply-coupon`, `apply-coupon-on-enter`, `show-all-articles`, `select-article`, `filter-modal-articles`, `show-article-tab`, `select-article-from-modal`, `close-all-articles-modal`, `remove-article-from-order`, `remove-coupon`
  - Dependency/risk note: currently depends on global `showToast` and is initialized from `initializeKiwiApplication`; extraction needs explicit shared interface for order state used by `createArticleSale`.

- [x] 11. Delivery date picker/calendar engine
  - Target slice file(s): `app/static/assets/js/app/slices/delivery-date-picker-slice.js`
  - Source range: `delivery-date-picker.js:1-378`
  - Key functions/state: `translateDelivery`, delivery calendar API/cache state, `formatDateInputValue`, `fetchDeliveryCalendar`, `formatDeliveryDateLabel`, `initDeliveryDatePicker`, calendar open/close/position helpers, `generateCalendar`, `navigateCalendar`, `selectDeliveryDate`, `selectDeliveryDateByString`, `selectRecommendedDate`, `findNextAvailableDate`, quick-select helpers
  - Bound action names: `select-recommended-delivery-date`, `navigate-delivery-calendar`, `select-delivery-date`
  - Dependency/risk note: currently uses document/window listeners and is initialized from `initializeKiwiApplication`; preserve lifecycle and listener cleanup semantics when moving to slices.

- [x] 12. App shell events + form closing + toast + keyboard/click/change globals
  - Target slice file(s): `app/static/assets/js/app/slices/app-shell-slice.js`
  - Source range: `app.js:1304`, `app.js:6165-6325`
  - Key functions/listeners: `endSession`, `closeForm`, `mapToastTypeToContactType`, `showToast`, `isDebugModalEnabled`, debug key sequence constants/state, global `document` listeners for `keydown`, `click`, `change`
  - Bound action names: `close-form` (plus global listeners outside router)
  - Dependency/risk note: listener extraction must preserve outside-click close behavior for both debug modal and agent status menu.

- [x] 13. Runtime compatibility bridge while migrating
  - Target slice file(s): temporary bridge section only (no final target slice)
  - Source functions required by runtime namespace: `addContactMoment` (`app.js:1321`), `getDispositionCategories` (`app.js:1115`), `selectCustomer` (`app.js:1755`), `showToast` (`app.js:2021`), `startCallSession` (`app.js:1336`)
  - Bound action names: indirect via runtime client methods in `app/static/assets/js/app/slices/call-agent-runtime-client.js`
  - Dependency/risk note: runtime now uses explicit injected dependencies via `configureDependencies` in `app/static/assets/js/app/call-agent-runtime.js`; the legacy bridge installer and global fallback lookup were removed from `app/static/assets/js/app.js`.
  - Bridge removal prerequisites:
    - Wire the runtime to explicit slice-owned dependencies for the five bridge methods (`addContactMoment`, `getDispositionCategories`, `selectCustomer`, `showToast`, `startCallSession`) and stop resolving them from `window`.
    - Remove fallback global lookup (`window[methodName]`) from runtime compatibility resolution to avoid accidental legacy coupling.
    - Verify call flows still work end-to-end without legacy bridge globals: caller identification, contact-moment writes, disposition category rendering, toast/contact-history updates, and call-session start.
    - Remove `installRuntimeCompatibilityBridge` and `RUNTIME_COMPATIBILITY_BRIDGE_NAMESPACE` from `app.js` after the runtime has no bridge consumers.
    - Add/extend tests to assert runtime behavior with no `window.kiwiRuntimeCompatibilityBridge` and no direct legacy global method fallback.
  - [x] Remove this temporary bridge once runtime dependencies have been internalized by slices.

- [x] 14. Remove duplicated Werfsleutel implementation from legacy app.js
  - Target slice file(s): `app/static/assets/js/app/slices/werfsleutel.js`
  - Source range: `app.js:182-1039`
  - Key functions/state: `getEuroFormatter`, Werfsleutel catalog constants/state, `getWerfsleutelSliceApi`, `syncWerfsleutelCatalogMetadataIntoSlice`, `getSelectedWerfsleutelState`, `getWerfsleutelOfferDetailsFromActiveSlice`, `ensureWerfsleutelsLoaded`, `syncWerfsleutelsCatalog`, `searchWerfsleutelsViaApi`, `findWerfsleutelCandidate`, picker rendering/select/reset functions
  - Bound action names: `handle-werfsleutel-input`, `reset-werfsleutel-picker`, `select-werfsleutel`, `select-werfsleutel-channel`
  - Dependency/risk note: current dual implementations (`app.js` and `slices/werfsleutel.js`) can diverge in state and trigger duplicate API refresh behavior.

- [x] 15. Extract shared pricing + subscription identity helpers from app.js globals
  - Target slice file(s): `app/static/assets/js/app/slices/customer-detail-slice.js`, `app/static/assets/js/app/slices/customer-search-slice.js`, `app/static/assets/js/app/subscription-role-runtime.js` (consumer updates), plus shared helper module
  - Source range: `app.js:577-625`, `app.js:1198-1232`
  - Key functions/state: `MIN_SUB_NUMBER`, `MAX_SUB_NUMBER`, `NAME_INSERTION_PREFIXES`, `normalizeNameFragment`, `generateSubscriptionNumber`, `formatEuro`, `subscriptionPricing`, `getPricingDisplay`, `getSubscriptionDurationDisplay`
  - Bound action names: none direct (cross-cutting helpers)
  - Dependency/risk note: helper behavior is currently accessed via globals/fallback lookups; extraction must preserve deterministic subscription-number generation and duration-label rendering.

- [x] 16. Extract contact-history mutation + contact-moment adapter from app.js
  - Target slice file(s): `app/static/assets/js/app/slices/contact-history-slice.js` (or dedicated contact-history state module), `app/static/assets/js/app/slices/call-agent-runtime-client.js`
  - Source range: `app.js:1238-1332`
  - Key functions/state: `generateContactHistoryId`, `pushContactHistory`, `addContactMoment`, `contactHistoryHighlightTimer` interactions
  - Bound action names: indirect via toast/contact updates and runtime call events
  - Dependency/risk note: this block touches API persistence fallback, paging/highlight state, and runtime notifications; state ownership must be centralized before deleting legacy code.

- [x] 17. Extract call-session start/duration UI bridge from app.js
  - Target slice file(s): `app/static/assets/js/app/slices/call-session-slice.js`, `app/static/assets/js/app/call-agent-runtime.js` (wiring update)
  - Source range: `app.js:1335-1401`
  - Key functions/state: `startCallSession`, `updateCallDuration`, `recordingConfig` interactions, `callSession.durationInterval` timer ownership
  - Bound action names: indirect runtime flows (`call-session.simulate-incoming-call`, `call-session.identify-caller`, `call-session.end`)
  - Dependency/risk note: these functions currently mix DOM rendering, timers, and runtime state; extraction must avoid duplicate timer mutation between legacy and runtime modules.

- [x] 18. Remove window dependency-provider bridge (`kiwiGet*SliceDependencies`)
  - Target slice file(s): `app/static/assets/js/app.js`, `app/static/assets/js/app/index.js`, `app/static/assets/js/app/slices/customer-detail-slice.js`, `app/static/assets/js/app/slices/contact-history-slice.js`, `app/static/assets/js/app/slices/order.js`, `app/static/assets/js/app/slices/delivery-remarks-slice.js`, `app/static/assets/js/app/slices/app-shell-slice.js`
  - Source range: `app.js:1547-1751`
  - Key functions/state: `getSliceApi`, `invokeSliceMethod`, `invokeSliceMethodAsync`, `getCustomerDetailSliceDependencies`, `getOrderSliceDependencies`, `getDeliveryRemarksSliceDependencies`, `getAppShellSliceDependencies`, global provider registration
  - Bound action names: none direct (cross-slice dependency plumbing)
  - Dependency/risk note: dependency resolution is now explicitly wired in `app/index.js` via `window.kiwiLegacySliceDependencies`, removing per-slice `window.kiwiGet*` provider lookups and making slice wiring explicit.

- [x] 19. Remove legacy facade wrappers that only proxy to slice methods
  - Target slice file(s): `app/static/assets/js/app.js`, `app/static/assets/js/app/slices/*.js`, `app/templates/base/index.html` (if any remaining global function invocations exist)
  - Source range: `app.js:1754-1981`
  - Key functions: `selectCustomer`, `displayDeceasedStatusBanner`, `displaySubscriptions`, contact-history wrappers, winback wrappers, order/delivery-remarks wrappers
  - Bound action names: `select-customer`, `toggle-timeline-item`, `change-contact-history-page`, `cancel-subscription`, `start-winback-for-subscription`, `complete-winback`, `open-article-sale-form`, `submit-article-sale-form`, `add-delivery-remark-modal`
  - Dependency/risk note: removing wrappers requires caller migration (templates, runtime hooks, and any manual JS calls) to router actions or direct slice APIs.

- [x] 20. Remove app-shell fallback paths and move runtime dependency wiring out of app.js
  - Target slice file(s): `app/static/assets/js/app/slices/app-shell-slice.js`, `app/static/assets/js/app/slices/call-agent-runtime-client.js`, `app/static/assets/js/app.js`
  - Source range: `app.js:1136-1192`, `app.js:1985-2086`
  - Key functions/state: `endSession` fallback body, `closeForm` fallback body, `mapToastTypeToContactType` fallback switch, `showToast` fallback DOM path, `wireCallAgentRuntimeDependencies`, `isDebugModalEnabled`
  - Bound action names: `close-form`
  - Dependency/risk note: preserve no-customer toast UX and debug-flag behavior while moving runtime dependency injection to module bootstrap instead of legacy script tail.

- [x] 21. Retire legacy bootstrap wrappers and loader dependency on app.js
  - Target slice file(s): `app/static/assets/js/app/legacy-app-state.js` (new module), `app/static/assets/js/app/index.js`, `app/static/assets/js/app/legacy-loader.js`
  - Source range: entire former `app.js` (deleted)
  - Key functions/state: all state, bridge registrations, bootstrap wrappers, and utility functions moved to `legacy-app-state.js`; initialization trigger moved to `index.js`
  - Bound action names: none direct (startup/bootstrap path)
  - Changes:
    - Deleted `app/static/assets/js/app.js` — all content moved to `legacy-app-state.js` ES module.
    - `legacy-loader.js`: renamed `ensureLegacyAppLoaded` to `ensureRuntimeScriptsLoaded`, removed `app.js` from the load chain.
    - `index.js`: imports `legacy-app-state.js`, installs globals on `window` via `installLegacyAppState()`, triggers bootstrap initialization directly via `bootstrapSlice.initializeKiwiApplication()` after runtime scripts load.
    - State variables shared with runtime scripts are exposed via `Object.defineProperty` getters/setters on `window`.
    - Bootstrap-slice functions (`loadBootstrapState`, `initializeData`, `saveCustomers`, `updateCustomerActionButtons`, `updateTime`) are called directly from module code instead of through legacy proxy functions.

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
11. Remove duplicated Werfsleutel implementation from legacy app.js (item 14)
12. Extract shared pricing/subscription helper ownership (item 15)
13. Extract contact-history mutation and contact-moment adapter (item 16)
14. Extract call-session start/duration UI bridge (item 17)
15. Remove `window.kiwiGet*SliceDependencies` bridge (item 18)
16. Remove legacy facade wrappers that proxy to slices (item 19)
17. Remove app-shell fallback logic and runtime tail wiring from app.js (item 20)
18. Retire legacy bootstrap wrappers and app.js loader path (item 21)

## 6) Verification commands

- Action coverage parity (markup vs registered actions):

```bash
set -euo pipefail
TMPA=$(mktemp)
TMPB=$(mktemp)
rg -o 'data-action="[^"]+"' app/templates/base/index.html app/static/assets/js/app.js \
  app/static/assets/js/app/slices/article-search-slice.js app/static/assets/js/app/slices/delivery-date-picker-slice.js \
  | sed -E 's/.*data-action="([^"]+)"/\1/' | sort -u > "$TMPA"
rg -n "^[[:space:]]*'[^']+'" app/static/assets/js/app/slices/*.js \
  | sed -E "s/.*'([^']+)'.*/\1/" | sort -u > "$TMPB"
echo "IN_MARKUP_NOT_REGISTERED"
comm -23 "$TMPA" "$TMPB" || true
echo "REGISTERED_NOT_IN_MARKUP"
comm -13 "$TMPA" "$TMPB" || true
rm -f "$TMPA" "$TMPB"
```

- Function inventory check against legacy frontend sources:

```bash
wc -l app/static/assets/js/app.js app/static/assets/js/app/slices/article-search-slice.js app/static/assets/js/app/slices/delivery-date-picker-slice.js
rg -n "^(async\\s+)?function\\s+[A-Za-z0-9_]+" app/static/assets/js/app.js | wc -l
rg -n "^(async\\s+)?function\\s+[A-Za-z0-9_]+" app/static/assets/js/app/slices/article-search-slice.js | wc -l
rg -n "^(async\\s+)?function\\s+[A-Za-z0-9_]+" app/static/assets/js/app/slices/delivery-date-picker-slice.js | wc -l
rg -n "^const\\s+[A-Za-z0-9_]+\\s*=\\s*\\([^)]*\\)\\s*=>" app/static/assets/js/app.js | wc -l
```

- Manual coverage check:

```bash
# Manually verify every app.js range appears exactly once across domains 1-21.
# Manually verify full-file ranges are covered for article-search.js and delivery-date-picker.js.
# Confirm that only intentional cross-cutting references remain.
```

## 7) Important public API/interface/type changes

- No runtime API/type changes in this task.
- This is a documentation-only change that defines planned target slice boundaries and migration order.

## 8) Test cases and scenarios (for this planning-doc change)

1. Confirm `plan/app-js-to-slices-checklist.md` exists.
2. Confirm domains `1-13` are marked completed and domains `14-21` are present as unchecked follow-up work.
3. Confirm baseline-completed section exists and marks current extracted slices/runtime as done.
4. Confirm line references are present for every domain item (`app.js`, `article-search.js`, `delivery-date-picker.js` sources).
5. Confirm migration order and verification commands sections are present.

## 9) Assumptions and defaults

- Language is English.
- Scope is full inventory.
- Primary inventory scope includes `app/static/assets/js/app.js`, `app/static/assets/js/app/slices/article-search-slice.js`, and `app/static/assets/js/app/slices/delivery-date-picker-slice.js`.
- Template coupling notes are kept for tracking residual dependencies and compatibility bridges.
- Line references are based on the current snapshot and may drift after later edits.
