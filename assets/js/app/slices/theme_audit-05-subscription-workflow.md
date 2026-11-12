# Slice 05 — Subscription workflow

Audit marker: theme_audit

Status: implemented and accepted at application `ac37e1b`; independent source/rendered completion review and delivery evidence are recorded below. PR #148 was retained as draft until the user merged it into main on 2026-11-12 at `232e700cab9a9a04a01144fc25c7532d1d30036e`, from accepted head `ad68a31`. Historical evidence stays at its recorded source; no deployment was performed by this work. See the [audit index](../../../../plans/theme_audit.md) for the baseline, story, sequencing and evidence boundaries.

## Implementation record

- Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629).
- Worktree: `/home/bartdeijkers/_worktrees/align-theme-subscription-workflow`.
- Branch: `codex/align-theme-subscription-workflow`.
- Base: integrated `main` at `a39b9dbfd7b839b4f1bf530382ac8cccfd838295`, following the user's prerequisite to merge #142/#147 and retain drafts #144/#148. The original scaffold started on accepted slice 04 `1c76db9`; no application edits or slice 05 browser runs occurred before the merge gate. Rebase `b26ff7d` preserves that scaffold and one changelog entry; the earlier local orientation patch/stash remain retained as recovery copies.
- Slice 04 source, visual, interaction and completion reviews passed; final Actions [43005522519](https://github.com/bindinc/kiwi/actions/runs/43005522519) succeeded.
- PR: [#148](https://github.com/bindinc/kiwi/pull/148), created immediately after original scaffold `e7a78c8` was pushed; retargeted to main after rebase, with English text and one Unreleased changelog entry. Originally retained as draft; user-merged on 2026-11-12 as recorded above. No further merge or deployment is authorized.
- Evidence root: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-05/`, outside Git. Actual application, intercepted fixtures and reference captures must remain distinguishable.
- Ownership: one application writer; independent review; slice 10 owner supplies Compose before/reference/after, keyboard and native-zoom validation. Parent owns this document, index, changelog and PR.
- Inherited fixes are retained: keyboard-operable payment choices from 02, shared person/address and safe screenshot serialization from 04. Historical findings below require current-source confirmation rather than reapplying already completed fixes.

## Fresh before evidence and implementation release

The user merge prerequisite was fulfilled before any slice 05 application edit. `before-source-equivalence.json` verifies all 13 relevant bodies (six JavaScript modules, five stylesheets, Twig and the showcase) between the actual mounted PR #142 runtime at `d34dac1`, integrated main `a39b9db` and the rebased slice 05 scaffold `228620c`. The runtime path is recorded separately from the equivalent unmounted slice 05 worktree.

Actual Chromium and Firefox captures at 1440×1000 and 390×1000, Dutch locale, each complete 46 source/locale checks, 30 observed state frames and 34 PNGs including four standalone reference images, with zero runtime errors or blocked writes. These counters establish provenance and state presence, not visual acceptance. Representative states include three long products, selected recipient/open lookup, different payer, create-person fields, payment/consent/actions and mixed guide/explicit-edition/membership dates, using exact synthetic GET fixtures.

The observed baseline retains an 800px desktop card (326px at the 390px viewport), 12px product corners with 14px insets and 13.6px nested role padding. Independent observational image/source review passes; these are baseline mismatches to correct rather than accepted target values. `before-final-provenance.json` freezes 68 images, both reports/logs and exact helper versions. All artifacts are outside Git under this slice's evidence root.

The sole application writer was released only after both browser runs and this review. Ownership is limited to the subscription region in Twig and CSS scoped to `#newSubscriptionForm`; root documentation and slice 10 tooling have separate writers. Actual after/reference comparison, keyboard/draft/privacy/conditional-state checks, native OS 200% zoom and final independent review remain acceptance gates.

## Initial application checkpoint — rendered acceptance pending

Application `a486ae9bf7d50c8db0bfa2bb4538a9559bb83a7f` changes only the subscription region in Twig and a scoped CSS block. Product context and actions span the flat workspace; recipient/requester sections and payment/date versus consent sections can use two columns from 960px, with a 1080px maximum. New sections retain the original control order. Product selection, field/help rhythm, generated date labels and consent separators use shared typography, surfaces and insets. Actual content fit remains a browser gate rather than a consequence of those CSS declarations.

Independent source review and `implementation-static-01/provenance.json` verify all 40 control attributes/order, existing IDs, payment sibling subtrees and both runtime-owned date hosts unchanged. Twig outside the subscription region and inherited CSS outside the new block remain byte-identical. All 58 new top-level selectors are scoped to `#newSubscriptionForm`; CSS parsing reports no syntax errors. No role, date, payment, workflow or backend JavaScript/PHP is changed.

All 39 frontend files, guardrails, five relevant JavaScript syntax checks and whitespace pass. Source hashes: CSS `3dcadd7fc51140d766aa82433e32bc973a5d26d04b10785a222c86f37f178e46`, Twig `bb236df98f7ec4145b85762f0a7c5f40d1445127101cdb6782fa4cfe87f1166e`. `independent-review/source-review-checkpoint-01.md` records the separate source verdict and committed-source equivalence.

The isolated `kiwi-theme-audit-05` Compose runtime is healthy on `https://bdc.rtvmedia.org.local:9444/kiwi/`; actual Twig lint passes. Older runtimes, volumes and worktrees are retained. CI `43011775425` and the source-frozen after-state matrix are separate acceptance gates; no rendered acceptance or slice 05 completion is claimed here.

## Observed state findings and correction checkpoints

The first application checkpoint passes CI `43011775425` and the Chromium desktop/narrow layout guards, but independent actual-image review finds a P2 interaction-clarity gap: held person lookup and held workflow submission look idle, with enabled Search/Create actions and no local pending cue. An earlier lookup-error toast remains prominent in the workflow-pending frame. This is an observed state-presentation problem, not evidence of an incorrect transaction or changed idempotency behavior. Evidence: `independent-review/pending-state-finding.md` and `after-preflight-02/chromium/`.

The root-authorized correction adds local localized status/ARIA feedback. New lookup queries must remain possible and stale completions must not clear a newer request's cue. Workflow duplicate suppression and busy feedback apply only to an actual POST/reconciliation, with an atomic owner claim immediately before POST; existing asynchronous validation remains available. Cancel, close, fields, drafts, submission IDs, payloads, server idempotency, provider/date recovery and global toast behavior remain protected. Reset invalidates the UI owner without changing business requests. Meaningful deferred-request, stale-result, error/reset and duplicate-submit tests plus a fresh independently reviewed source/browser checkpoint are required before acceptance.

Historical preflights remain rejected as whole runs. `after-preflight-01` stopped before form checks because of a reference-contract wiring error. `after-preflight-02` has 164 verified checks, two snapshot deviations, two address-fixture setup errors, two blocked synthetic search POSTs and 52 captures. The strict snapshot was taken before lazy address companion selects existed; it now compares equivalent post-initialization state. The exact fixture now distinguishes normalized address lookup house number `2` from validation `2A`. These reviewed tooling corrections do not relax source/privacy guards or constitute application fixes. No real request was forwarded to create a transaction. The actual pending-clarity finding remains open separately.

The source-reviewed pending correction at `ca04ce8` adds three local public status hosts, keeps newer searches available and guards only actual concurrent POSTs. All 39 frontend suites, guardrails and meaningful deferred/stale/error/reset/reconciliation regressions pass; negative tests fail against `a486ae9` for the missing lookup cue and concurrent requests. Original submission orchestration remains byte-identical after subtracting the two ownership hooks, and all 40 original control attributes/order remain intact. CI `43015152693` passes. Actual Chromium pending ownership/re-entry/retained-reopen proof passes, but the whole run remains rejected because the status exposed a narrow footer overflow and fixed captions were pseudonymized.

Correction `c596411` explicitly contains the footer on a narrow column axis and marks only fixed Birthday/consent/status text leaves public. Private controls, options, identities and containers remain unmarked. The date module changes only one fixed translated status attribute. `footer-caption-static-01/` and the independent source review retain exact six-file hashes, rendering/privacy-boundary tests and original control/date/payment inventories. All 39 frontend files, guardrails, syntax, CSS parsing, actual Compose Twig and CI `43017746704` pass.

The strict live-DOM diagnostic on `ca04ce8` observes all 74 field properties and attributes unchanged across 11 phases. Only the two real duplicate-check status subtrees finish asynchronously during the original clone. The helper now waits for actual `isChecking=false` and `debounceTimer=null` before taking the baseline; no raw-DOM normalization or SDK restoration rewrite is used. A synthetic IBAN that matched a pseudonym template is replaced by a distinct public fixture, with normalized original-versus-clone inequality required in addition to changed pixels.

The `c596411`-source `after-focused-02` reports remain partial, not accepted whole runs: Chromium has 241 verified checks, one physical-hit readiness deviation and 86 captures; Firefox has 240 verified checks, two deviations and 86 captures, both with zero runtime errors or unexpected writes. Actual footer, fixed-copy, pending, model/draft and raw-restoration checks pass in their inspected scopes. A finite address-view lifecycle proof permits only a selected protocol choice to become hidden/empty when its exact entered model remains visible, labelled and readonly; loss of any other field/source/consent still fails.

The final source supplements below resolve the DATE containment, transient-toast hit-point, responsive and actual OS 200% gates. The original strict image and raw-live-state guards remain unchanged.

### DATE capture geometry and populated Birthday boundary

The Firefox full-form DATE failure is a measurable clone-layout shift. The last guide fieldset's 16px bottom margin collapses through the live auto-height `#subscriptionStartDates` wrapper. The pinned renderer copies its computed 252px height, preventing that collapse and moving the later membership DATE by 12 raster pixels. The former ROI consequently includes a border row; separate-axis rounding and fieldset height are not the cause. `independent-review/geometry/source-and-saved-raster-analysis.md` and `margin-counterfactual-metric-analysis.json` retain the measurements.

Two bounded counterfactuals restore the expected DATE box and the unchanged original ROI's 8,880 uniform white pixels. Setting only the detached wrapper's height/block-size to auto establishes causality. A temporary live `display: flow-root` then preserves all 86 controls' values, attributes, global/relative rectangles and root geometry exactly while containing the margin in a 268px wrapper. This supports one scoped CSS correction, with no SDK, fieldset-height, ROI or exception change. The separate final whole-interval raw flag remains false because Playwright's native screenshot caret handling introduces 64 empty input style attributes; immediate application/SDK phase comparisons remain exact. This diagnostic artifact is retained, not normalized away.

Final application `ac37e1b4b1c0950977ebf74712cc175fe7120af0` implements only that scoped formatting-context rule. All remaining CSS is byte-identical to `c596411`; SHA-256 is `e835604ab0a4a04c8c2affd5cc27487fd18dd122116d1153745040d8442583c6`. Independent source review, all 39 frontend files, guardrails, CSS parsing and whitespace checks pass. `flow-root-static-01/` retains the exact source proof. Application [CI 43024732089](https://github.com/bindinc/kiwi/actions/runs/43024732089) passes, including full PHPUnit and production build; final browser supplements are mapped below.

Both `final-privacy-date-ac37/{chromium,firefox}` supplements pass 32 checks each with zero deviations/errors/writes and 12 captures each. Independent Firefox inspection confirms the native populated DATE and focus, readable pseudonymized payment/payer/consent crops, exact public copy, changed normalized IBAN and all ten raw SDK restoration phases. The unchanged pixel guard passes all eleven sensitive input regions, using only its pre-existing uniform-original DATE fallback for Firefox's blank native DATE. This is a source-bound screenshot supplement, not a passing relabel of `after-focused-02` or an assertion that Firefox paints native DATE values into SVG.

`dob-populated-c596/{chromium,firefox}` exercises six genuinely selected Birthday Day/Month/Year controls at the frozen `c596411` source. Actual selected text and PNG output are pseudonymized, fixed public captions remain readable, selection serialization is consistent and live raw markup/properties/attributes remain exact. Independent image/source review is recorded in `independent-review/populated-dob-review.md`. Both 42-verified/2-deviation reports deliberately retain a stronger failed diagnostic: original option values remain in the internal detached SELECT metadata. The existing redactor changes OPTION text, and the capture API exports PNG blobs/dimensions rather than detached HTML. This proves the actual image boundary for these six controls, not sanitation of internal SELECT values or every private select generally. No SDK rewrite or privacy-guard relaxation is introduced.

### Final source acceptance supplements

`final-pointer-ac37/{chromium,firefox}` each pass 76 checks, zero deviations/errors/writes and 18 captures at 390px. Both retain the actual initial `#toast.toast.error.show` obstruction. The same fixed submit-button center becomes unobscured after the existing toast's own expiry (2,361ms Chromium; 2,464ms Firefox), with no toast removal, forced click or moved hit point. Actual pointer activation and awaited handler re-entry retain exactly one held local POST, truthful busy feedback and the entered draft. Reopen, date rejection and retry/recovery remain exact. These source-bound positive supplements resolve the earlier hit-readiness probe, whose failed report remains unchanged.

`final-boundary-ac37/chromium` records 216 verified checks, three host-only DATE-focus deviations and 57 captures across 320/959/960px. All layout/containment checks and the 60-stop native Tab routes reach Cancel. Independent inspection of all three actual DATE-focus images confirms a clearly outlined native calendar button within the labelled, visible input (`:focus-within=true`), although the host itself does not match `:focus-visible`. The visible-focus criterion is met by these specific native images; the automated whole report remains failed and its predicate is unchanged.

Chromium `final-native-ac37-attempt-02/chromium` similarly records 101 verified checks, one host-only native-DATE predicate deviation and 30 captures. Actual OS zoom reaches 200% and resets to 100%. Independent uncropped X11 inspection confirms readable single-column fields, visible native calendar focus, contained actions and the retained-draft/profile flow. The same specific native-focus evidence meets the criterion without converting that whole report to a green result. The first native preflight remains rejected for a missing frozen helper dependency; its corrected rerun uses the exact existing helper body and fresh manifest.

Firefox `final-boundary-ac37/firefox` records 218 verified checks, one immediate-full-box Tab-position deviation and 54 captures. All three widths pass layout/containment checks. The finite `final-firefox-product-tab-ac37` probe (35 verified/one deviation/three captures) confirms that a long product button's lower 5.533px initially falls below the viewport after Tab; this is not a timing false positive. Its title, price and most focus outline remain visible. `final-firefox-product-recovery-ac37` then passes 34 checks with zero issues/writes and five captures: two actual ArrowDown inputs keep the same target focused and reveal its complete box, followed by actual Enter disclosure activation with product/source/channel selections exact. Independent image review confirms keyboard reachability, visible focus and the action. The stronger immediate-full-box reports remain failed; no custom focus handler or relaxed predicate is introduced.

Firefox `final-native-ac37-attempt-05/firefox` completes 101 verified checks, one immediate-full-box product-position deviation and 29 captures, with zero errors/writes. Real OS 200% zoom and the 100% reset pass. The previous pointer interception is a protocol/native-zoom dispatch mismatch: the actual CSS center hits the radio and the preceding fieldset ends above it. Measured X11 pointer input activates both existing-person radios with actual checked/runtime-mode assertions. The recorded setup also distinguishes Firefox's actual `firefox-default` class and 1085px physical window from the rounded 1086px outer-height reading. Earlier failed setup runs remain separate. The final native product-focus supplement below resolves the remaining keyboard scope; no visible-focus or containment requirement is waived.

The reusable slice 05 runner/acceptance modules are independently reviewed and pushed as `e810d657fe0f0d59cfcaf4a13dfe4bcf6edf6217` in draft [#144](https://github.com/bindinc/kiwi/pull/144), with three syntax checks, whitespace and the single existing slice 10 changelog amendment. Diagnostic-only runners and all PNGs remain outside Git. Slice 10 itself remains incomplete until the full interface gate after slice 09.

## Completion and retained limitations

The minimal `final-native-firefox-product-recovery-ac37` supplement passes 46 checks with zero deviations/errors/writes and six uncropped X11 frames. Actual native zoom is 200% (DPR 2, visual-viewport scale 1) and resets to 100%. The first ALPHA toggle initially ends at 512.05px in the 500px CSS viewport; two real ArrowDown inputs keep its focus and exact product/source/channel model, revealing the full button at 478.05px. Actual Enter expands the disclosure without changing selections. This completes the native keyboard criterion with direct evidence instead of inferring it from the 320px BETA result.

| Acceptance scope | Evidence and disposition |
| --- | --- |
| Actual before/reference/after composition and conditional states | Both 1440/390 browser captures, source-bound `after-focused-02` scopes and independent actual-image review; long products/people, both payer modes, payment/consent, lookup/provider states and rejection recovery retained |
| Final production screenshot path | `final-privacy-date-ac37` both browsers 32/0/12 captures; unchanged pixel/raw guards, exact public copy and normalized private IBAN replacement; selected DOB PNG proof separately bounded |
| Pending, pointer and retained transaction draft | `final-pointer-ac37` both browsers 76/0/18, with actual toast expiry and one intercepted held POST; deferred/stale/duplicate/retry regression tests and exact draft/source assertions |
| Responsive/keyboard boundaries | Both 320/959/960 matrices; explicit native DATE focus images and Firefox real-scroll/Enter supplements above resolve user-facing criteria while stronger whole-report failures remain recorded |
| Real OS 200% and reset | Chromium native attempt 02 plus visible native-focus evidence; Firefox native attempt 05 plus 46/0 ALPHA supplement; actual uncropped X11 review, source/model retention and measured 100% resets |
| Source, static tests and CI | Application `ac37e1b`, all 39 frontend files, guards, syntax/CSS parsing, Compose Twig and full application CI `43024732089` pass; one existing Unreleased entry; independent review register |
| Reusable evidence and delivery | Tooling `e810d65` in draft #144; `final-source-equivalence-ac37.json` and `after-final-provenance.json` retain exact source/helper/report/image boundaries outside Git; draft #148 is pushed and reviewable |

Independent findings and completion mapping are retained in `independent-review/completion-review.md` and `final-runtime-supplement-review.md`. There is no unresolved slice 05 application finding. Acceptance preserves the following evidence limits: stronger immediate-full-box/host-only-focus reports remain failed rather than relabelled; Firefox native DATE is blank only in the SVG renderer; internal unexported select values are not sanitized; synthetic transaction responses establish presentation/recovery without an upstream business write. Original diagnostic/preflight failures remain available. Images are retained locally, not uploaded to Shortcut by this connector. Slice 10's complete-interface acceptance remains after slice 09.

## Purpose and dependencies

Make product selection, recipient, payer, payment and consent read as one deliberate workspace. Keep the selected context visible before the next action, with optional search and person details on demand. Use a compact, calm and precise presentation suitable for repeated service work.

Depends on slices **01 Foundations**, **02 Controls and actions**, and **04 Customer and data views**. Slice 02 owns the shared native-radio and hidden-payment-control corrections; this slice applies and verifies them throughout subscription creation. Slice 04 owns shared person/address controls. Integrate changes to `styles.css` and the base template sequentially after those dependencies, then apply slice 10's relevant acceptance checks.

## Findings and reference

The [showcase](../../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html) defines `.subscription-workspace`, `.subscription-form-grid`, `.subscription-form-block`, `.subscription-fields`, `.subscription-selected-person`, `.subscription-choice`, `.subscription-consent-row` and `.subscription-form-actions`. These establish flat sections, restrained separators, visible native choices, a persistent selected-person summary and a consistent action region. The [showcase review](../../../../plans/kiwi-light-and-shadow-theme-palette-review.md) explains the intended hierarchy; its fictional records and simplified behavior are not a business specification.

The original planning findings predate implementation of slices 01–04. Read-only orientation on inherited `1c76db9` distinguished the following status; the integrated main source retains those fixes and now also contains #140's date workflow:

| Planning finding | Current source boundary and slice 05 responsibility |
| --- | --- |
| Rounded, shadowed generic outer card | Foundations already flatten the outer card. The form still uses an 800px single stream and nested party borders/insets; align section composition without claiming the old outer-card defect remains. |
| Nested selected-person and search frames | Shared lookup/selected-person grammar is already improved, including the soft 2px selection rule and light disclosure. Preserve it while composing product, recipient and payer sections consistently. |
| Competing product and consent treatments | Product fieldset/summary/offer cards retain 12px shapes; section rhythm, party insets and consent separator rhythm still need alignment. Scope these changes to subscription creation. |
| Hidden native payment radios | Slice 02 has already restored visible keyboard-operable radios. Preserve the input→label→additional-input sibling relationships, checked selectors, focus and conditional payment rules. |
| Placeholder-only static lookup fields | Slice 04 already supplies persistent associated labels. Retain those labels and dynamic create-person/address associations; do not reimplement the earlier fix. |

The initial source review supports a presentation-only change to the subscription region in Twig and narrowly scoped CSS. Runtime before/reference/after checks remain required; source review does not establish that long real fields fit the proposed two-column composition.

Current integrated behavior is authoritative. #140 supplies per-guide delivery dates, explicit edition selection when needed, provider loading/unavailable/retry states and recovery after source-date rejection. `#membershipStartDate` and `#subStartDate` are enabled/required only for memberships. The earlier today-only orientation described the old slice 04 source and is superseded; it must not drive implementation or fixtures after the rebase. Preserve these real mechanisms rather than inventing or removing date behavior.

## Implementation targets

| File | Sections and responsibilities |
| --- | --- |
| [Base template](../../../../templates/base/index.html.twig) | `#newSubscriptionForm`, `#subscriptionForm`, product/werfsleutel fieldset, `#recipientRolePanel`, requester sections, payment choices, date, consent and actions. |
| [Shared styles](../../../css/styles.css) | Scoped subscription composition; `.onepager-container`, `.party-role-panel`, `.subscription-person-search-more`, `.party-selected-person`, `.payment-methods`, `.optin-row`, `.werfsleutel-fieldset`. Avoid changing article/service variants implicitly. |
| [Role runtime](../subscription-role-runtime.js) | Generated recipient/requester form and result markup; use the shared field grammar without changing role selection or search availability. |
| [Werfsleutel slice](werfsleutel.js) | Product suggestions, offers, selected-product summary and channel presentation where generated markup needs alignment. |
| [Subscription workflow](subscription-workflow-slice.js) and [payment rules](../subscription-payment.js) | Review selector, submission and required-field dependencies; change only presentation hooks if necessary. |
| [Subscription dates](../subscription-start-dates.js) | Generated guide/edition/read-only date/error/retry markup and membership date context; preserve provider, requiredness, stale-response and recovery behavior. |

## Desired visual contract

- Use one flat form surface with a readable header and meaningful section boundaries. Use the foundation spacing scale, 20px desktop/16px narrow section insets, approximately 13px labels, 15px field text and standard 40px controls. Use the reference's 22px form title and 15px section-heading hierarchy where they fit the shared primitives.
- Compose product/context and editable sections using available width, with two form columns only when realistic content fits. Collapse in DOM order without horizontal scrolling; do not force the showcase's exact column count into every state.
- Present selected products and people with the restrained 2px selection rule and soft selection surface. Keep person identity, role and the action to change the selection clear. Advanced lookup remains a light disclosure, not another decorated card.
- Use visible, keyboard-operable payment choices with a clear checked state and at least the reference's 44px choice height. Keep conditional IBAN details adjacent to the relevant payment context. Use separated consent rows with visible Yes/No choices and a persistent channel label.
- End with one filled submission action and an outlined cancel action. Context needed to avoid a wrong recipient, payer or product must remain available before submission; reuse authoritative state rather than inventing a second summary data model.

## Scope and interaction guards

Scope includes section layout, grouping, typography, persistent labels, responsive behavior and presentation of existing conditional states. It excludes backend changes, new subscription rules, new offers, new payment providers and copying the showcase's simulated validation or lookup behavior.

Preserve IDs, input names and values, `data-action` bindings, localization and `data-feedback-sensitive` markers. Preserve product/division/mandant search restrictions, explicit edition selection, recipient/requester existing-versus-create modes, duplicate-person checks, reuse-current-customer behavior and same-as-recipient logic. Do not reset entered values when changing layout or expanding a disclosure.

Keep `subPayment` values `B`/`AC`, conditional IBAN visibility/requiredness, existing start-date rules and the intentionally unselected marketing preferences. Preserve address validation, read-only states, submission IDs, ambiguous-outcome reconciliation, draft restoration and customer-session ownership. An appearance-only change must not introduce a request or change payloads.

## Acceptance and validation

1. Capture the actual form before and after at desktop and narrow widths; compare composition against the named showcase sections, not only palette values. Include a long selected product, long person name, open lookup and both payer modes.
2. Exercise product unselected/selected, lookup loading/empty/error/results, existing/new recipient, same/different payer, both payment methods, unset/set consent, validation errors and pending submission. Include guide/membership/mixed date contexts, explicit edition selection, source loading/unavailable/retry and date-rejection recovery. Keep unavailable controls and read-only information distinguishable.
3. Verify Chromium and Firefox keyboard access, native radio navigation, visible focus, associated labels, error association and readable selected states. Check 320px and 390px viewports, a representative desktop and 200% zoom; no clipped fields, hidden actions or sideways form scrolling.
4. Run `make js-test` and `make guardrail` in the implementation worktree. Pay particular attention to the existing role-runtime, role-slice, payment and subscription-workflow tests; add focused behavior coverage only if markup changes an interaction contract.
5. Use isolated Docker Compose browser checks, including the existing subscription-initials, subscription-person-details, recipient-address and marketing-preferences smoke scripts as applicable. Use controlled fixtures for submission coverage; do not create real customer transactions for visual evidence.

## Remaining unknowns and completion evidence

The completed evidence above covers the declared representative conditional states and failure/recovery fixtures. It does not claim every possible product/person combination, live provider health, server permission behavior or a real subscription transaction. Existing orchestration and identity/payment/date/consent semantics remain protected by exact-source inventories and focused regression tests. Remaining renderer/test-contract limits are explicitly recorded above and in the PR; there is no deferred slice 05 implementation work.
