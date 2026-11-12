# Slice 06 — Article workspace

Audit marker: theme_audit

Status: implemented and independently accepted; user-merged PR #150 into main on 2026-11-12 at `7d5ece6128850b4fcba112c90b5a77794c7b7e3c`, from accepted head `0bb8182`. Historical source/evidence boundaries remain unchanged; no deployment was performed by this work. See the [audit index](../../plans/theme_audit.md) for baseline, sequencing and evidence boundaries.

## Implementation record

- Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629).
- Worktree: `/home/bartdeijkers/_worktrees/align-theme-article-workspace`.
- Branch: `codex/align-theme-article-workspace`.
- Base: accepted slice 05 `ad68a3145ce242c77e35fe66f74e65e4f062f587`; final CI `43028159036` and independent completion pass. Originally stacked on `codex/align-theme-subscription-workflow` while #148 remained unmerged, as permitted by the sequential workflow; the user subsequently merged both PRs on 2026-11-12.
- PR: [#150](https://github.com/bindinc/kiwi/pull/150), created immediately after scaffold `20cf1c8` was pushed; English title/text and one Unreleased entry. The user merge is recorded above; no further merge, deployment or cleanup is authorized.
- Evidence root: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-06/`, outside Git.
- Ownership: one application writer for article-only styles/template/generated markup; independent read-only review; slice 10 owner for Compose/browser evidence and reusable tooling. Root owns this document, index, changelog and PR.
- Direction: make the complete recipient/catalog/cart/total context clear before committing an order, using compact flat sections and stable action placement. Preserve actual pricing, coupons, delivery calendar, identities, payment, drafts and validation.
- Existing inherited primitives and historical findings require current-source confirmation. Shared payment radios and recipient labels may already be fixed; do not reapply old defects without verifying the actual current source.



## Accepted result and evidence

The final article workspace uses flat related sections, shared type/insets/controls, contained intrinsic widths and one final action region after the complete order context. Search, calculation and creation have separate truthful progress; coupon feedback has a persistent associated live region. Request-owner checks protect reopened/reset flows from stale UI completions. Public screenshot leaves require literal captions or verified catalogue provenance; unknown names/descriptions and coupon descriptions remain private. Existing catalog, pricing, coupons, recipient identity, payment, calendar, address and draft rules are preserved.

Application `b02ca40bcb2b95e6493aaf824339adfedf06ff8b` passes [CI 43041660865](https://github.com/bindinc/kiwi/actions/runs/43041660865), including PHPUnit and production build. Corrected behavior at `ee98c6c` passes all 40 frontend files, guardrails, parsing, syntax and whitespace. The final CSS-only delta has exact reverse/source-equivalence proof, parser/whitespace, matching container hashes, Twig lint and a bounded final rendered/privacy check. Independent source, actual-image, criterion and provenance reviews pass; see `independent-review/completion-disposition.md` and `independent-review/after-final-provenance-review.json`.

| Accepted scope | Checks / PNGs | Evidence below the root |
| --- | --- | --- |
| Chromium1440 behavior, privacy and fixture negatives at unchanged `ee98c6c` bodies | 89 / 28 | `after-preflight-02/chromium/` |
| Final `b02ca40` desktop spacing and production capture containment | 17 / 5 | `final-spacing-01/` |
| Final Chromium390 full focused scope | 89 / 28 | `after-focused-01/chromium/` |
| Final Firefox1440+390 full focused scope | 178 / 56 | `after-focused-01/firefox/` |
| Chromium320 containment/calendar/action subset | 42 / 11 | `after-320-01/chromium/` |
| Firefox320 containment/calendar/action subset | 42 / 11 | `after-320-01/firefox/` |
| Actual Chromium OS200%, keyboard/draft sentinel and reset | 83 / 25 | `native-article-01/chromium/` |
| Actual Firefox OS200%, keyboard/draft sentinel and reset | 81 / 21 | `native-article-01/firefox/` |

These are 621 repeated source/layout/state checks and 185 PNGs, including reference and preparation frames; they are not 621 unique behaviors or 185 unique application states. BEFORE and failed preflight reports remain separate. The frozen `after-final-provenance.json` records all eight scopes, exact source/helper/reference hashes and artifacts; independent rehash reports 302 comparisons with zero mismatches, including all 74 unchanged BEFORE artifacts. Reviewed reusable tooling is pushed at `6abe8e240c1333c9655ff7e7f4123d40410ac52d` in draft [#144](https://github.com/bindinc/kiwi/pull/144); `tooling-delivery-6abe8e2.json` records that separate checkpoint. No tooling CI success is claimed where GitHub supplied no run/status.

Clean native recovered-cart-total frames show the total and both final actions after natural toast expiry in both engines: `native-article-01/chromium/525x546-native-200-article-recovered-cart-total.png` and `native-article-01/firefox/720x500-native-200-article-recovered-cart-total.png`. `independent-review/native-clean-final-action-review.md` records exact hashes and review. Later keyboard/profile frames retain the transient toast as timing evidence.

### Applicable inherited Compose smoke checks

`criterion4-existing-smokes-01/provenance.json` separately records unchanged inherited-script execution on final `b02ca40`. `compose-smoke-shared-addresses.mjs` with `KIWI_ADDRESS_PREFIXES=article` exits0: article completion, buffered additions, separate internal extension, validation, desktop/390 layout, and the built-in legacy-editor unavailable/retry/Escape tail pass. The subscription-only recipient script is not claimed as an article check.

`compose-smoke-theme.mjs` with `KIWI_THEME_DATEPICKER_ONLY=1` exits0 in Chromium and Firefox: five assertions and five PNGs per engine, covering1440/390/320 and short390×320 calendar states, keyboard/eligibility/earliest selection/focus behavior. The full theme branch is not claimed executed here; its feedback-settings PUT is outside this finite check. Address POST/DELETE are fulfilled locally; no workflow save/order/feedback-settings mutation is performed. These supplements do not replace actual whole-workspace reference comparisons above and do not modify the frozen final manifest.

### Boundaries and retained limitations

The reference has no complete article workflow: its visual grammar is translated to the real application. Controlled catalogue/calendar/quote/error fixtures establish UI and payload behavior, not upstream business policy. No real order, address, customer or feedback mutation was sent upstream. Actual native zoom covers layout/keyboard/draft and reset; privacy/workflow coverage comes from the separately named focused reports.

Firefox's production SVG capture omits native radio circles/select arrows although actual native screenshots render them. Selected Birthday display and actual private screenshot pixels are checked; existing internal unexported SELECT option values are not claimed sanitized. The original `1234AB`→`1234 AB` fixture only established formatting; final calibrated `2468ZX` proves normalized postal inequality with unchanged strict pixel guards. Three old preflight negative entries have an overwritten displayed `expected` metadata field; independent recomputation/source comparison proves their logical comparisons passed, and future metadata is nested. Those historical reports remain unchanged.

The existing locally scrollable cart and horizontal catalogue tabs remain usable and are distinguished from the fixed-minimum field clipping that was corrected. No screen-reader audit or WCAG conformance claim is made. Whole-interface acceptance remains slice10 after07–09; no merge, deployment or cleanup is implied.

## Historical checkpoints

The following chronology preserves original findings, failed reports and evidence boundaries. Statements about pending gates describe their checkpoint time; the accepted scopes and remaining limitations above are authoritative for final application acceptance.

## Fresh BEFORE evidence

`before-source-equivalence.json` verifies 330 relevant bodies between actual mounted Compose 05 at accepted `ad68a31` and the unmounted slice 06 scaffold `20cf1c8`. Both Chromium and Firefox complete 57 source/locale checks, 27 actual state frames and 33 PNGs each at 1440/390/320px, with zero runtime errors or unexpected writes. These are provenance and observations, not target-design acceptance. Each browser uses 18 declared synthetic GETs and 18 locally fulfilled readonly quote POSTs; no workflow POST occurs.

Independent observational review passes in both engines. Actual initial 320px columns remain 300px wide inside a 272px card, and fields/cart/coupon regions extend beyond the work surface. Desktop cart/coupon/total nesting and a competing filled Add action are visible. The mobile footer also reverses its visual action order relative to DOM order. Labels/native radios are retained, and the approved seven-column calendar popup remains contained. Preserve actual transient baseline toasts; final comparisons must also provide settled readable totals/actions through natural expiry. No additional BEFORE replay is needed. The final 66-image source/report/helper manifest is retained as `before-final-provenance.json`, SHA-256 `6fd8123787435bf276d42d577a90c0407794d2c21621b1bd10df140571b51f79`. Independent rehash of all 74 listed artifacts passes with zero mismatches. Only then was the sole writer released for article CSS/Twig; root documentation and slice 10 tooling ownership remain separate.

## Initial implementation checkpoint — rendered acceptance pending

Application `f36c6c2e92e633a7d2518ffe66714141e79de574` changes only the two article stylesheets and article Twig region. The flat workspace has a 1280px maximum, two shrinkable columns above 1024px and one column below. Standard section insets/type, quiet local Add, aligned cart/discount/total sections and a final action region replace competing compact/nested recipes. Narrow visual order follows the DOM.

Independent source review passes: one form, 31 static form controls/32 static IDs; only Add's presentation class and the two footer controls' position change. Picker/payment/calendar subtrees, 11 protected behavior files, 23 shared history/action rules and non-article Twig remain exact. All 39 frontend files, guardrails, CSS parsing, syntax and whitespace pass. `implementation-static-01/` and `independent-review/source-review-checkpoint-01.md` retain the exact proofs.

The isolated Compose 06 runtime is healthy on `https://bdc.rtvmedia.org.local:9444/kiwi/`, with exact in-container hashes of the reviewed source and passing Twig lint. It reuses the immutable validated runtime image with separate project volumes; Compose 05 is stopped and retained. `committed-source-checkpoint-01.json` records source/runtime provenance. Application [CI 43033449233](https://github.com/bindinc/kiwi/actions/runs/43033449233) passes, including PHPUnit and the production build. The finite actual AFTER/state/privacy/keyboard/native comparison remains an acceptance gate; no visual acceptance is claimed here.

## Actual first AFTER findings — correction in progress

`after-preflight-01/chromium` at 1440px is terminal with 73 verified checks, two automated deviations, zero errors/unexpected writes and 24 captures. The whole run is not accepted. Independent actual-image review confirms useful layout, authoritative quote/coupon/cart/calendar/payment/draft and private pixel/raw-restoration scopes, plus four bounded P2 groups in `independent-review/after-preflight-01-findings.md`:

- The broad last-child row exception removes the nested address/contact gap; restrict it to a section-terminal direct row.
- Coupon errors need a persistent live/status region and description association without changing coupon policy.
- Held catalogue search, pre-submit quote and actual order POST need truthful local progress and safe UI ownership, with existing validation, payloads, fallback, drafts/reset and cancellation semantics preserved.
- Production capture must retain literal date captions and proven public catalogue context. Generic restored order names are not automatically public: the backend can prefer raw names, and outbox restoration can supply item arrays. Public name leaves require an ID/name match with the existing catalogue cache. A noncoupon volume description additionally requires that verified source and the known backend formatter; coupon descriptions embed codes and stay masked, as do unknown descriptions. No extra fetch or SDK rewrite is authorized.

The old synthetic volume description is arbitrary text, not the backend formatter. Its original BEFORE/preflight remains frozen; a later positive proof must use the verified formatter and retain negative unknown/coupon masking tests. One focused writer owns the corrections and meaningful deferred/privacy-boundary regressions. Broader browser expansion is paused until a new reviewed source checkpoint; no slice 06 acceptance is claimed.

## Reviewed correction checkpoint — browser acceptance pending

Correction `ee98c6c95dff23492ce5efaac318931fb15ac69e` fixes the four bounded groups with local search/calculation/creation feedback, post-validation submission ownership, persistent linked coupon announcements, restored nested row spacing and provenance-aware public leaves. Search result/query/popular behavior and actual API/local submission functions remain unchanged. Close/reopen preserves the pending owner; true reset/new flow invalidates UI ownership. An independent regression first reproduced an older quote completion overwriting a newer phase; the final phase setter and finally both check current owner identity, and that exact negative now passes.

Independent source review verifies all eight source/test hashes, 85 protected function bodies, original control bindings with two intended description associations, four literal public caption/status leaves without private-control ancestry, and unchanged outside-article/backend/address/calendar/draft/SDK boundaries. All 40 frontend files, targeted deferred/error/retry/reset/local-fallback/private-origin cases, guardrails, parsing, syntax and whitespace pass. Actual Compose Twig lint and all seven production source hashes match inside the container. `findings-static-01/provenance-phase-fixed.json`, `independent-review/findings-source-review-02.md` and `committed-correction-checkpoint-01.json` retain precise proofs. Correction [CI 43038855944](https://github.com/bindinc/kiwi/actions/runs/43038855944) passes, including full PHPUnit and production build. Final browser/state/privacy/native gates remain pending; no whole-slice acceptance is claimed.

### Corrected-helper fixture fidelity

Before the corrected run, independent helper review found that the old synthetic postal value `1234AB` becomes pseudonym `1234 AB`: changed pixels demonstrate formatting, not a changed normalized postal value. The old preflight remains unchanged and does not establish postal-value replacement. A distinct declared synthetic fixture outside the pseudonym template set and normalized original/pseudo inequality are required alongside the unchanged pixel/raw guards. No SDK or mask threshold changes follow.

The helper's idle wait is also bound to the reviewed persistent live-region contract: cleared text and restored submit busy/disabled state, rather than absence of client rectangles. Active cues must still be visible and nonempty. These finite setup corrections are reviewed before execution, not application fixes or additional UI cases.

## Corrected Chromium evidence and remaining spacing

`after-preflight-02/chromium` on `ee98c6c` completes 89 verified checks with zero logical deviations/errors/unexpected writes and 28 PNGs. Independent actual-image review confirms truthful search/calculation/creation cues, coupon association, normalized postal replacement, retained public captions/catalogue context and all three unknown/coupon masking negatives with raw restoration. `after-preflight-02-provenance.json` freezes the report/images. A report metadata collision replaces three displayed boolean expectations with fixture text; independent source comparison and recomputation prove their actual logical conditions true. Future helpers nest that metadata; the original report is unchanged and no replay solely for bookkeeping is required.

Actual visual review still finds the Birthday group's terminal row/group margins adding 24px to the 20px panel inset (44px total). Only those actual terminal margins need trimming; address/contact separation remains protected. The production screenshot also has a tighter address/contact gap than the native UI. A single frozen-source, reversible `flow-root` geometry counterfactual is authorized to test margin containment with exact live control/card preservation and unmodified capture output. No speculative SDK/guard change or broad layout replay is authorized. Final browser expansion waits for this bounded spacing disposition.

### Causal address capture containment proof

The single `address-flow-root-diagnostic-01` Chromium1440 counterfactual passes independent source/data/image review: complete native control values/attributes/flags/rectangles and the card rectangle are exact; native Street→Phone label gap stays 12px. Only the address host height changes from 218.671875px to 230.671875px, containing its last-row margin. Both unmodified production original and pseudonymized PNGs change from touching labels to that same 12px rhythm; raw SDK equality, observer restoration, privacy verification and exact final style/live restoration pass with zero errors/writes. Detached clone boxes are empty as expected and are not used as geometry proof; serialized computed height plus actual PNGs establish causality. No SDK or threshold change is needed.

This supports one article-scoped `display:flow-root` rule alongside the Birthday terminal-margin trim. The final CSS-only checkpoint and bounded rendered spacing/privacy proof precede remaining screen/browser/native expansion; positive unchanged behavioral scopes are retained rather than replayed wholesale.

### Final spacing checkpoint and bounded render proof

CSS-only application `b02ca40bcb2b95e6493aaf824339adfedf06ff8b` batches the two causally supported changes. Independent reverse-diff proof recovers the exact `ee98c6c` stylesheet after removing only the scoped containment block and terminal selector extension; all other behavior/markup/test bodies remain exact. CSS parser/whitespace pass, and the actual container stylesheet matches SHA-256 `72b8f585cb41267c95b2a08dfacb49c0e63088bedfd5f61a68901eaa8a817af1`. No full local frontend rerun is needed for this CSS-only delta; the 40-file behavior result remains source-bound.

The approved bounded Chromium1440 final-spacing follow-up passes 17 checks with zero errors/writes and five PNGs. Independent actual-image/geometry review confirms terminal Birthday row/group margins are zero and the outer measured inset is 21px (20px padding plus 1px border); native and production original/pseudonymized Phone gaps are 12px. Fixed captions, selected Birthday masking, normalized postal replacement, unchanged strict input pixels, raw restoration and resource checks pass. This closes the two spacing findings without a broad workflow replay. The populated/public/unknown-negative behavior proof stays explicitly at unchanged `ee98c6c` bodies; remaining Chromium390, Firefox, 320px and native OS200 gates still need completion.

## Remaining matrix progress

The full Chromium390 focused run on final `b02ca40` passes 89 checks with zero deviations/errors/writes and 28 PNGs. Firefox1440+390 passes 178 checks with zero deviations/errors/writes and 56 PNGs. Independent actual samples confirm flat hierarchy, truthful pending/footer states, retained public captions, private selected-display replacement and all unknown/coupon negative proofs. Source-equivalent earlier Chromium1440 behavior plus final-spacing proof are retained without a broad replay.

Both 320px lightweight subsets pass 42 checks with zero issues/writes and 11 PNGs each. Independent native UI images confirm the old fixed-minimum field/cart overflow is resolved, labels/controls/actions remain within the work surface, all seven calendar columns and focus are available, and long notes/payment text wrap. The catalogue's existing horizontal category-tab scrolling is distinguished from clipped fixed-width fields.

Firefox's production SVG capture omits native radio circles/select arrows while actual native UI images render them; this existing renderer limitation is not presented as native widget parity or a disclosure. Known internal unexported SELECT-value limits remain unchanged. Actual OS200/reset in both engines, final provenance/tooling and completion delivery remain pending.

## Purpose and dependencies

Make recipient details, article selection, the order list and totals form one coherent workspace. The operator should be able to identify the recipient, inspect what will be ordered and find the final action without interpreting several unrelated panel styles.

Depends on **01 Foundations**, **02 Controls and actions**, and **04 Customer and data views**. Reuse their form, native-control, action and address primitives. Coordinate with slice 05 because both screens use `.onepager-container` and `.payment-option`; integrate shared stylesheet/template changes sequentially. Apply slice 10's acceptance matrix during this slice.

## Findings and reference

The [showcase](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html) provides the applicable grammar in `.preview-shell`, `.button-secondary`, `.subscription-form-grid`, `.subscription-fields`, `.subscription-choice` and `.subscription-form-actions`: flat work surfaces, consistent control geometry, restrained selection and an explicit action hierarchy. It does not provide a complete article-order workflow. Translate that grammar to the real catalog/cart behavior instead of copying the showcase's subscription-specific business structure.

Historical source findings (current status is distinguished below):

- `styles.css` gives `.article-sale-container` its own compact header, field, payment and button overrides, on top of generic onepager rules. Their geometry differs from both the showcase and other forms.
- `article-search.css` gives `.article-card` rounded borders, hover lift and shadows. `.order-items-list` wraps individual rounded `.order-item` surfaces; `.coupon-section` adds another dashed panel and `.order-summary` another strong enclosure. These layers compete with the actual order hierarchy.
- Several static recipient inputs use placeholders without persistent labels. Payment choices inherit the hidden-radio defect covered by slice 02.
- The final order action currently sits in the recipient column, while the item list and totals are in the other column. The visual and reading order needs explicit review so the final action follows the complete order context at both wide and narrow widths.

### Current-source orientation — 2026-11-11

Read-only inspection at scaffold `20cf1c8` confirms persistent recipient/Birthday labels and keyboard-operable native payment radios already exist. Article-card/order-item hover uses flat elevation without a transform; the old lift/shadow finding is not a new implementation target. Preserve these inherited fixes.

The remaining source-backed composition issues are the 300px article-column minimum, conflicting compact article insets/type, nested cart/coupon/total frames and final actions inside the recipient column before catalog/cart in DOM order. Moving the unchanged action pair after the columns, inside the single existing form, can correct the visual and keyboard sequence without changing payload ownership. The exact quote contract is `POST /api/v1/catalog/article-order-quote` with existing items and coupon code; neither it nor authoritative pricing is being redesigned. Actual current 320px clipping and representative long-content states remain BEFORE/browser observations to verify.

### Confirmed narrow containment gate — 2026-11-10

Slice 02 comparison confirmed article fields extending past the right edge of the dialog at 320px in Firefox. The fresh actual original baseline reproduces this clipping (`baseline/firefox/320-article-top.png`), while the current source capture is `slice-02/contract-attempt-06/firefox/320x1000-article-top.png`, both under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/`. This is a slice 06 composition defect, beyond its separate narrow-inset mismatch; neither clipping nor inset is accepted by the controls slice. Constrain intrinsic field/column widths and keep all entry, quantity, price and order actions reachable without hiding overflow.

## Implementation targets

| File | Sections and responsibilities |
| --- | --- |
| [Article stylesheet](article-search.css) | Search results/dropdown, `.article-card`, `.order-items-section`, `.order-items-list`, `.order-item`, `.coupon-section`, discounts and `.order-summary`. |
| [Shared stylesheet](styles.css) | `.article-sale-container`, `.article-sale-columns`, left/right columns, scoped onepager overrides, payment and delivery-remark controls. Consume shared primitives rather than adding another parallel control system. |
| [Base template](../../templates/base/index.html.twig) | `#articleSaleForm`, `#articleForm`, recipient labels, payment choices, search/add controls, order context and final actions. |
| [Article search](../js/app/slices/article-search-slice.js) and [order slice](../js/app/slices/order.js) | Generated results/order-item markup and presentation hooks; preserve catalog, quantity, coupon and calculation behavior. |
| [Delivery date stylesheet](delivery-date-picker.css) and [date slice](../js/app/slices/delivery-date-picker-slice.js) | Regression-review targets. The separately approved calendar is retained; change only if a demonstrated integration defect requires it. |

## Desired visual contract

- Use one flat workspace with related field groups, light separators and purposeful width. Apply standard 20px desktop/16px narrow section insets, approximately 13px labels/15px field text and 40px controls from the dependencies. Remove conflicting article-only geometry unless a documented dense variant is necessary.
- Use a clear search-and-add region followed by a readable order list. Distinguish selected article, available action, item metadata, quantity and price through alignment and type hierarchy. Routine rows and cards do not lift or acquire decorative shadows on hover.
- Flatten the nested order/coupon/total panels into coherent sections. Align monetary amounts; retain readable discount details and remove controls. Totals should be easy to locate without surrounding every value in a badge or box.
- Place the final submission action after the relevant order summary in the visual and keyboard reading order. Treat add-to-order and coupon application as local actions, with a hierarchy distinct from committing the complete order; preserve meaningful warning/error states.
- Use persistent labels for recipient fields, visible native payment choices and the shared address treatment. Let long payment explanations and delivery notes wrap. At narrow widths, preserve the task sequence and all information instead of hiding the order summary.
- Retain the approved delivery calendar: seven columns, visible available dates, selected/today/unavailable distinctions, keyboard navigation, safe popup positioning and unobscured focus. Overlay elevation remains justified even though ordinary workspace panels become flat.

## Scope and interaction guards

Scope is composition, typography, spacing, surfaces, labels and responsive presentation of the existing article workflow. Do not introduce a new catalog view, order engine, coupon rule, payment route or delivery policy merely to match a reference example.

Preserve field IDs, input names/values, `data-action` hooks, localization and privacy markers. Preserve article search/filter selection, quantity minimums, add/remove behavior, empty-order handling, discounts/coupon application and removal, totals and existing error messages. A displayed price remains read-only; the UI must not substitute presentation values for authoritative calculations.

Preserve recipient/address validation, payment options, delivery-date eligibility and earliest-date behavior, hidden date value synchronization, delivery remark shortcuts, draft/session ownership, cancellation and submission guards. Moving the final action must not create a second submit handler or trigger submission when adding an item, applying a coupon or choosing a date.

## Acceptance and validation

1. Compare before/after actual application captures against the named reference grammar at a representative desktop and narrow widths. Include an empty order, multiple long article names, a discount, a coupon message and long delivery notes.
2. Exercise search loading/no-results/error/results, selection, quantity changes, item add/remove, empty/populated order, coupon success/error/removal and pending/error submission with controlled data. Totals and payloads must match the existing behavior.
3. Verify keyboard order, visible focus, native payment navigation, persistent labels and announced errors in Chromium and Firefox. Inspect 320px, 390px and desktop widths plus 200% zoom; fields, amounts, remove controls, actions and all seven calendar columns remain reachable.
4. Run `make js-test` and `make guardrail`. Review the existing article-search, order and delivery-date coverage; add behavior tests only for an interaction contract actually changed by markup. Run the relevant address and theme smoke checks through isolated Docker Compose.
5. Inspect calendar open/close, month navigation, earliest-date selection, unavailable dates, focus return and its relationship to the feedback launcher. Retain the approved calendar's behavior and geometry while checking the new surrounding layout.

## Original unknowns and required completion evidence

The initial plan established the competing component recipes; it does not establish which catalog layouts and large-order states are reachable for every role or data source. Confirm those entry paths and controlled fixtures before removing an apparently unused selector. Runtime coupon failures, slow searches and submission failures need explicit fixtures or a recorded coverage gap. The implementation PR must include visual comparisons, calculation/interaction results and remaining limitations; this plan is not runtime acceptance.
