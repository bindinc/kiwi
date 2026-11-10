# theme_audit 10 — Complete visual acceptance against the showcase

Status: in progress. Baseline capture and reusable rendered comparison started before slice 01. Final acceptance remains pending slices 01–09 and the complete matrix below. This is the verification slice for [theme_audit](../plans/theme_audit.md), not a claim that the application already matches the reference.

## Implementation evidence register

Dedicated worktree: `/home/bartdeijkers/_worktrees/validate-theme-showcase-alignment`. Branch: `codex/validate-theme-showcase-alignment`. PR: [#144](https://github.com/bindinc/kiwi/pull/144); finalization follows slice 09. No merge or deployment is included.

The initial 2026-11-09 baseline was recorded outside Git at `/tmp/kiwi-theme-audit-implementation/baseline`. Those temporary artifacts were absent when work resumed on 2026-11-10; their historical results below are not a claim that the images remain reviewable. Its recorded provenance identified the palette worktree at `5b3222e`, with application assets/templates/scripts verified equivalent to merged baseline `c05973e`. The reference originated at `ecec72d`, SHA-256 `478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4`. New evidence is retained durably outside Git under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10`; each attempt has its own directory so a failed comparison is not overwritten.

On 2026-11-09, Chromium `157.0.8103.38` and Firefox `150.0.2` each captured the actual local Compose flows at 1440, 390 and 320px, with Dutch locale, reduced motion and device scale 1. Both runs reported zero scenario errors and zero attempted API writes. The historical captures covered shell/profile, search/results/customer/editor, initial subscription/payment/consent, article/catalog/calendar, edit/resend/complaint/initial winback, feedback/settings and logged out, plus standalone reference specimens. Feedback used its installed hidden-button handler without changing preference. These are historical baseline observations, not complete state acceptance or currently retained image proof.

The baseline reproduces the 1542px populated document at a 1440px viewport. At 320px, the populated document reaches 350px in Chromium and 345px in Firefox. These remain defects to resolve under slices 03/04, alongside payment reachability under slice 02. Native zoom, later conditional service branches, role permutations and write outcomes were not part of that baseline.

The new [rendered comparison harness](compose-smoke-theme-audit.mjs) records reference/application provenance, actual browser/version/viewport, source and fetched stylesheet hashes, screenshots, computed geometry and role-specific surface comparisons. It measures the showcase at the same viewport and compares the application to those measurements. Reports distinguish `verified`, `deviation` and later-slice `deferred` checks; inaccessible scenarios and blocked writes fail the run. No screenshot count is treated as visual acceptance.

Run the harness against the isolated stack owned by the current slice worktree:

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-controls-and-actions \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_AUDIT_SLICE=2 \
KIWI_THEME_EVIDENCE_DIR=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-02/contract-attempt-01 \
KIWI_SMOKE_BROWSER=chromium \
node scripts/compose-smoke-theme-audit.mjs
```

Repeat with `KIWI_SMOKE_BROWSER=firefox`. Defaults include 1440×1000, 390×1000, 320×1000 and 390×320. `KIWI_THEME_AUDIT_VIEWPORTS` can specify additional comma-separated widths/heights such as `1440x1000,1024x1000,768x1000`. The runner allows local Compose hosts only and aborts API writes; it does not submit forms or persist feedback settings. Screenshots remain outside the repository.

The runner snapshots all five source stylesheets before navigation and requires their served bodies to match in every application context. Normalization is limited to quotes and the known seven-character Symfony fingerprint on URLs already present in that exact source file, resolved against the stylesheet directory. The complete source asset directory, origin, query and fragment must match; arbitrary CSS differences are not ignored. Missing stylesheet responses fail provenance checks, and Keycloak's unrelated `styles.css` is excluded. Foundation surface probes disable transitions only on their temporary measuring element, leaving the reference and application rules unchanged. Existing outbox 4px corners are explicitly deferred to slice 09 for reconciliation, rather than recorded as a reference match.

Quiet actions use their own role contract rather than being mistaken for an outlined cancel button. The reference defines `.preview-shell .button-calm` rules without an actual quiet element in that workflow. The runner temporarily places a `.button.button-calm` span inside that real shell to measure those existing rules, labels the probe in provenance and removes it before reference screenshots. This is an isolated reference component measurement, not a captured production workflow or newly approved design.

### Slice 02 scoped controls and accessibility exception

Real application flows inspect persistent associated labels, their actual visible caption font size/weight/line height against the rendered reference `.search-label`, normal field weight against `.search-input`, named consent-channel captions and named radio groups, native 20px geometry with zero text-field padding, 40px text/actions, 44px payment choices and square outlined secondary actions. Payment checks exercise actual Tab, arrow keys, associated-label pointer selection and conditional IBAN visibility/requiredness, then restore the initial payment value without submission. Initial disabled role controls and unset consent are checked separately from enabled-role fixtures. Enabled recipient/payer and create-mode fixtures use the actual role initialization/rendering with synthetic people, a local product-selection getter and intercepted GET-only person details; every such capture is labeled as an intercepted fixture, not a complete backend workflow. Unreachable required interactions are `unverified` and fail the run, never counted as passed.

The finite action inventory includes ordinary `.btn` variants, close/icon controls, pagination/history, delivery presets, catalog browse/tabs, cart/coupon removal, search disclosures, duplicate-person actions, feedback/settings actions and outbox menu actions. Rich product suggestion, offer-toggle and channel-choice buttons receive shared base geometry checks while their descendant metadata/compound presentation remains slice 05 work. Actual renderer supplements require nonzero counts for rare families, intercepted GET offers, and an explicitly intercepted read-only quote POST that never reaches the backend. These are controlled component states, not identity-match, price, coupon or business-submission acceptance.

Feedback/settings action padding is compared with the actual `.subscription-form-actions` primary/secondary buttons. Those ordinary form controls retain 8px/12px padding at narrow widths; the customer's distinct `.preview-actions` toolbar switches to 8px inline padding and is not the reference for a form footer. Close icon contrast is checked against its actual composited ancestor surface at 3:1. Catalog close default, hover and inverse keyboard focus are exercised in the actual blue header. Existing short feedback containment can leave an action unreachable even after scrolling; the new hover probe records that exact state as an explicit slice 08 deferral, never a passed interaction.

The reference's Hematite hover text (`117,111,107`) over its 10% Hematite fill on white composites to `(241.2,240.6,240.2)` and measures **4.370723063286252:1**, below 4.5:1. The approved narrow exception retains the exact hover fill and uses the existing darker `--action-secondary-hover` text (`93,88,85`), measuring **6.196378568168753:1** on the same surface. Default Hematite text/border, square geometry and white secondary surface still match the reference. The harness records this explicit exception and checks the composited hover contrast without weakening its threshold.

The resumed diagnostic attempts are retained under `2026-11-10/slice-02/contract-attempt-01` and `contract-attempt-02` in the durable evidence root. The first desktop attempt identified remaining shared typography discrepancies and an overly broad secondary-action test target. The second full Chromium attempt used `04d1ad8`, exercised the actual controls plus enabled-role fixtures without API writes, and exposed the remaining 14.4px result-sort field. These diagnostic reports are not final slice 02 acceptance.

Known later-slice deviations remain visible in the matrix: populated-page overflow belongs to 03/04, article-specific 20px narrow insets to 06, existing outbox corners to 09, and the feedback panel's short-height containment to 08. The short feedback header/close/submit clipping was independently reproduced in both browsers using the exact pre-02 CSS on the same current markup; that comparison is **old-CSS on current markup**, not an actual historical-flow capture. Its measurements and four images are retained in `2026-11-10/slice-02/short-feedback-comparison`. The runner records the failing close bounds as a slice 08 deferral and uses Escape to leave the state. None of these deferred states is marked visually accepted.

Caption measurement reads visible associated text nodes, excluding nested controls/options, selected values and section headings. Wrapped labels use the actual caption text parent rather than the wrapper's aggregate text. The custom delivery-date button and generated customer editor/settings fields are included; named consent-channel `.optin-label` captions are measured separately from choice-value labels. Missing required caption text is a failure. The report records styles and element identity without exporting caption values or customer field contents.

The runner also fails unexpected empty runs: checks and actual application captures are mandatory. Native-only mode implies native zoom, preventing the previous zero-check success when its companion flag was omitted. Focused local instrumentation probes cover valid versus wrong-directory/origin/query/fragment asset mappings, native-only flag behavior and wrapped-label/date-caption extraction before application acceptance runs.

The native path uses actual OS zoom shortcuts and keyboard activation, with automation focusing some initial targets before Enter/Space. Payment choices and the separate rare-action supplement exercise actual Tab/arrow navigation. These paths establish the recorded activation and visible-focus behavior; they are not an uninterrupted Tab-order audit of every screen. Complete workflow focus order remains part of the owning slices and final slice 10 matrix.

### Latest scoped slice 02 rendered evidence — 2026-11-10

The independently reviewed comparison runner SHA-256 is `dcfbc3c1e1b40830b4ce514bead8f60c5e690aee5a46c1348182a19e728724fc`. The current reference remains SHA-256 `478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4`. The following runs are retained in `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-02`, with exact report hashes, source hashes, fixture classification and scope in `final-matrix-provenance.json`.

| Scope / application source | Chromium | Firefox | Retained evidence |
| --- | --- | --- | --- |
| Expanded desktop/narrow/short defaults, `1d78cf8` | 14,949 verified; 39 later-slice deferrals; 100 captures | 14,953 verified; 39 later-slice deferrals; 100 captures | `contract-attempt-08/{chromium,firefox}/report.json` |
| Actual native 200% zoom, `1d78cf8` | 656 verified; ten captures | 656 verified; ten captures | `native-attempt-03/{chromium,firefox}/report.json` |
| Actual inverse catalog close default/hover/focus, `1d78cf8` | 208 verified; 16 captures | 208 verified; 16 captures | `catalog-close-final/{chromium,firefox}/report.json` |
| Additional actual control families, `48e66cf` | 2,043 verified; one short-hover deferral; 60 captures | 2,043 verified; one short-hover deferral; 60 captures | `additional-actions-attempt-04/{chromium,firefox}/report.json` |

These completed runs have zero required deviations, unverified interactions, scenario errors or blocked business writes. The additional-family fixtures explicitly intercept 16 read-only quote POST calculations per browser; those requests never reach the backend and are not represented as real coupon/price acceptance. Additional-family results keep source `48e66cf`; the subsequent inverse-close correction is covered on `1d78cf8` separately. No count is relabeled as a newer source result.

The 39 default deferrals are 32 outbox-corner observations (09), two populated-workspace overflows (03), three narrow article insets (06), and the known short feedback close plus unreachable primary hover (08). These remain deviations owned by later slices, not visual passes. The separate delivery-notes modal caption/textarea follow-up and parent-owned privacy/existing-theme gates are not included in these default-run counts. Complete slice 10 acceptance still requires every later workflow and state in the full matrix.

Actual native zoom was re-proven with device ratio 1→2, halved CSS viewport, unchanged physical browser width, visual-viewport scale 1 and reset to 100%. Chromium measured 1050→525px and Firefox 1440→720px. Native payment focus and settings, actual narrow/desktop catalog close hover/focus, generated duplicate controls, cart focus and rich product choices were visually inspected alongside the reference. `matrix-visual-review.md` retains image-specific observations and boundaries.

### Intermediate scoped slice 02 diagnostics — 2026-11-10

The expanded caption run on source `46c9426` is retained separately at `2026-11-10/slice-02/contract-attempt-05/{chromium,firefox}/report.json`. Chromium recorded 13,366 verified checks and Firefox 13,370; each completed 100 captures, four deviations, 38 later-slice deferrals, and zero errors, unverified interactions or attempted API writes. All four deviations in each browser concern the real result-sort caption's 18.2px line height against the reference's 16.9px, once at each viewport. This is diagnostic evidence requiring correction, not final controls acceptance. The preceding `contract-attempt-04` stopped when its browser process and local Compose runtime were interrupted; its partial report is preserved and superseded by the complete attempt 05.

Independent review also identified uncovered shared compact actions. The runner now measures actual visible remark shortcuts, subscription icons, results/customer closes, modal/feedback closes, pagination/history buttons and outbox icon primitives alongside primary/secondary/danger actions. It checks 40px minimum height, square corners, nonempty accessible names and 40px width for icon/close controls. Result and customer roots receive explicit action inspection. Rare controlled-renderer states remain a separate required supplement where the default real flows do not show those primitives; absent coverage is not silently counted as accepted.

The compact text actions (page, timeline and remark buttons) also compare their actual font size, weight and line height against the measured reference primary action. Isolated instrumentation verified that all 12 action selectors pass at 40px and fail at 37px, while changing the three compact text primitives to 19px is rejected without imposing a text-button font on icon glyphs. This instrumentation checks the measurement logic; actual application acceptance still requires the flows below.

On frozen source `cf9e2b29e550c890a0556f21f6a0e34ef0e1269b`, runner SHA-256 `a97f49bf17ab9b451384dc92e33958ecf07db8fd5f3bdda77079690d597e526e`, Firefox completed `contract-attempt-06` with 13,750 verified checks, 38 explicit later-slice deferrals, 100 captures and no deviations/errors/unverified interactions/API writes. Both browsers completed `native-attempt-02` with 604 verified checks, ten captures (eight actual desktop plus two reference), no deviations/errors/unverified interactions/API writes, and all five served/source CSS matches. Actual native zoom and reset were measured again: Chromium 1050→525 CSS viewport width and Firefox 1440→720, device ratio 1→2, stable physical outer width and visual-viewport scale 1. Native payment focus and feedback settings images were inspected for actual rendering and visible focus. Final default Chromium acceptance remains pending: `contract-attempt-06` has six scenario errors following a missing search-result state at 320px, preserved for serial diagnosis rather than discarded or called a pass.

These `cf9e2b2` results are also intermediate keyboard evidence. The independent rare-action supplement exposed a real delegated-action defect: a default native button's Tab keydown could dispatch its action before the browser's normal click activation. The initial payment/zoom paths did not establish correct keyboard behavior for all shared actions. Final acceptance therefore requires the shared action-routing correction, its meaningful regression checks, the rare-action supplement, and fresh application keyboard/default/native runs on the corrected source. No previously green count is used to waive that finding.

The serialized `contract-attempt-07` runs on `5205ff839ddc97ab65fd43f562023364b7966df4`, runner `e256ce07c07036ada7e883ab4bfcdb723aa7491ab64982f71a5a5c1da039d914`, completed with Chromium 13,818 and Firefox 13,822 verified checks, 38 explicit later-slice deferrals and 100 captures each, with zero errors/deviations/unverified interactions/API writes in that runner's scope. The earlier Chromium 320px search timeout did not recur on the corrected source in this serialized run; its exact cause is not inferred from that success. Subsequent image review found that real feedback/settings text actions without `.btn` retained UA typography and were not measured by this version. Independent ancestor-level focus review also found the timeline action ring clipped by its scrolling container. The attempt 07 results therefore remain broad intermediate evidence, with these uncovered shared-action requirements still pending correction and targeted/final expanded verification.

**Partial coverage, superseded for slice 02 acceptance:** independent visual review subsequently found 26 caption-role deviations per browser that these runs did not test. Caption presence had been checked, but caption typography had not. The retained reports remain valid for their recorded scope; neither their counts nor their successful exit establish final controls acceptance. The new `77842a7` source and expanded caption checks require fresh browser runs.

Application source: `fc41c6d023ee8d39ad637e0a174a02bcc204fdab`, Compose URL `https://bdc.rtvmedia.org.local:9444/kiwi/`, source worktree `/home/bartdeijkers/_worktrees/align-theme-controls-and-actions`. Reference SHA-256 remains `478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4`. The tested harness SHA-256 is `5c8362dd7bee8e36d16b9968bb3f200d44c49a881d9eaceb91b48030d5f9317e`; each report records that runner hash, application commit and individual source/served stylesheet hashes.

| Run | Chromium 157.0.8103.38 | Firefox 150.0.2 | Durable evidence below `2026-11-10/slice-02/` |
| --- | --- | --- | --- |
| Default desktop/narrow/short contract | 8542 verified checks; 100 captures | 8546 verified checks; 100 captures | `contract-attempt-03/{chromium,firefox}/report.json` |
| Actual native 200% zoom and keyboard contract | 340 verified checks; 8 desktop captures plus 2 references | 340 verified checks; 8 desktop captures plus 2 references | `native-attempt-01/{chromium,firefox}/report.json` |

Both default runs completed at 1440×1000, 390×1000, 320×1000 and 390×320, Dutch locale and reduced motion. They record 64 control-container observations per browser, covering search/sorting, subscription/article, customer editor, initial service forms, feedback/settings and explicitly labeled selected/create recipient/payer fixtures. Checks required by that intermediate runner have zero deviations, unverified interactions, scenario errors or attempted API writes; missing caption typography coverage prevents treating this as full slice 02 acceptance. All five served stylesheets match the frozen source after the narrowly defined URL fingerprint normalization.

The 38 default-run deferrals per browser are explicit observations, not passes: 32 outbox-corner observations for 09, two populated overflow cases for 03, three narrow article insets for 06 and one short feedback close state for 08. The count difference between browsers reflects observed interaction/focus state, not different acceptance thresholds. Images and computed properties require visual review together; counts alone do not establish showcase fidelity or full slice 10 completion.

Native zoom uses actual OS shortcuts and Xvfb desktop capture, not CSS or pinch simulation. Chromium changed 1050→525 CSS viewport width with device ratio 1→2; Firefox changed 1440→720 with device ratio 1→2. Physical window width and visual-viewport scale 1 were checked, followed by reset to 100%. Actual subscription and article payment Tab/arrows, IBAN transitions, persistent labels/geometry, visible focus bounds and feedback settings were checked without submitting data. Representative native payment/settings and default subscription/payment images were inspected for real, nonblank rendering and focus visibility. This native pass is representative keyboard/zoom coverage; it does not add every role, later service branch or operational state.

Initial foundation gates compare system typography, the spacing scale, composited workflow tints, flat panel geometry and insets against the rendered showcase. Control and workspace gates become required at their owning slice. This initial runner does not yet cover every conditional workflow or replace the existing functional/privacy suites. Native 200% browser zoom uses a separate opt-in OS-shortcut path with measured pixel ratio, viewport reduction and reset; CSS zoom or pinch scaling are never labeled native zoom. Successful syntax checks alone do not establish browser acceptance.

### Slice 01 native zoom result

The final historical Compose app at `f1f7c4e` passed the native zoom path in Chromium `157.0.8103.38` and Firefox `150.0.2`, including the corrected shared focus-scroll insets. Both runs verified actual OS shortcuts from 100% to 200%, device pixel ratio 1→2, halved CSS viewport width, unchanged physical window width, visual-viewport scale 1, visible keyboard focus and reset to 100%. Profile/menu, initial subscription, payment/consent and feedback settings were traversed with the keyboard without submitting data. Each final report recorded eight verified checks, zero deviations/errors/attempted API writes and six actual desktop captures. The temporary evidence at `/tmp/kiwi-theme-audit-implementation/slice01-native/{chromium,firefox}/report.json` was lost before work resumed on 2026-11-10; native checks must be recaptured against the current source in durable storage before final slice 10 acceptance.

Native captures use the dedicated 1600×1200 Xvfb screen via `ffmpeg x11grab`. Chromium's zoomed CSS viewport was 525×546; Firefox's was 640×478. Browser-protocol screenshots and pointer coordinates were unsuitable under native zoom: initial protocol captures were blank or offset, and were replaced by real desktop captures and keyboard traversal. Those initial captures are not acceptance evidence. The actual screenshots were visually inspected. Existing menu content extends below the first zoomed viewport, and initial subscription nesting/payment defects remain assigned to slices 03, 05 and 02 respectively; this result does not accept those later-slice behaviors.

To reproduce only native zoom, add `KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY=1` (this also enables native zoom; `KIWI_THEME_AUDIT_NATIVE_ZOOM=1` runs native zoom after the default matrix) to the command above. Use a separate evidence directory from the headless matrix. This optional Linux path requires installed `Xvfb`, `ffmpeg`, Python, `libX11` and `libXtst`; it selects a dedicated display (`:95` by default, overridable with `KIWI_THEME_AUDIT_DISPLAY`). It forces Firefox's X11 backend so inherited Wayland cannot bypass that display. No host display permissions or existing application stack are changed.

## Outcome and dependencies

Replace palette-only confidence with reviewable evidence that all Kiwi surfaces follow the agreed style guide. Acceptance covers visual consistency, interaction states and accessibility observations without changing business behavior.

Start the coverage inventory with [01 — foundations](../assets/css/theme_audit-01-foundations.md) and [02 — controls and actions](../assets/css/theme_audit-02-controls-and-actions.md). Each implementation slice adds its evidence to this matrix; final acceptance depends on all applicable slices, including [operational states](../assets/js/app/theme_audit-09-operational-states.md). Do not postpone basic visual checks until every component has changed.

## Establish the reference before measuring

The reference is [the checked-in Light & Shadow showcase](../plans/kiwi-light-and-shadow-theme-palette-showcase.html), identified by the user as `/docs/kiwi-light-and-shadow-theme-palette-showcase.html`. Record the reference file's commit and SHA-256 alongside the application commit. If the served artifact differs from the checked-in file, resolve which version is authoritative before approving differences.

Use the showcase as the source for shared visual rules: type scale, spacing, borders, radii, surfaces, action hierarchy, selections and operational semantics. It contains illustrative workflows, not every production screen or a substitute backend contract. Preserve real workflow requirements where the example is intentionally simplified. The approved compact datepicker refinement is a separate established component decision; do not silently revert it because the earlier showcase uses a simpler date example.

The existing [showcase review](../plans/kiwi-light-and-shadow-theme-palette-review.md) explicitly reviews a standalone artifact, not application implementation. Its historical browser assertions are useful context, not current evidence for Kiwi.

For each new reference image or measured component contract, record:

| Field | Required provenance |
| --- | --- |
| Reference | File path, commit, hash and relevant section/component |
| Application | Commit, build/asset source and local environment |
| Capture | Browser/version, viewport, device scale, zoom, locale and input mode |
| State | Role, synthetic data identifier, current workflow state and setup steps |
| Evidence kind | Actual application flow, intercepted fixture flow, isolated class fixture or static source comparison |
| Review | Expected result, observed result, deviation, decision and reviewer/date |

Do not overwrite a failing baseline to make an image test pass. A changed reference needs an explicit documented design reason. Before/after application images are useful, but they are not themselves the style-guide reference.

## Why existing checks are insufficient

- [Palette tests](../tests/frontend/theme-palette.test.mjs) verify source values and selected color pairs. They do not measure actual typography, spacing, inherited opacity/backgrounds, native controls or the full rendered cascade.
- [Guardrails](../script/check) prevent duplicated raw swatches and legacy aliases. They cannot establish that a semantic token is used in the right visual role.
- [The theme smoke](compose-smoke-theme.mjs) captures selected real screens and isolated operational classes. It does not open every workflow or compare the application with the showcase.
- Its `KIWI_THEME_BASELINE_DIR` mode substitutes original application CSS and skips new-theme assertions. Label those results **old-CSS application comparisons**, never showcase parity.
- Its current secondary-button hover assertion expects `rgb(93, 88, 85)`, while the showcase secondary control is white, outlined and square, with a translucent neutral hover. Update the expected control contract after slices 01/02 resolve the reference; do not preserve the current assertion merely because it is green.
- Current screenshots are evidence for human inspection, not an automated golden-image comparison. Counts in the JSON report include summarized scenarios and are not counts of screens proven visually correct.
- Existing functional tests can pass while CSS is visibly inconsistent. Conversely, an isolated class fixture can pass while its real parent containers introduce overrides, clipping or incorrect inherited colors.

## Full application coverage matrix

No single example receives extra priority merely because it triggered the audit. Review every area using the same criteria. Track each row as `not reviewed`, `verified`, `deviation` or `blocked`, with evidence and an owner.

| Area | Required representative states | Existing starting points |
| --- | --- | --- |
| Shell, profile and customer-session context | Initial/selected customer; menus; multiple roles; long labels; retained/queued session notice | `compose-smoke-theme.mjs`, `compose-smoke-customer-sessions.mjs` |
| Search, filters, results and pagination | Initial, loading, populated, selected, no results, error/retry; long identifiers | Theme smoke; customer-search slice tests |
| Customer detail and editing | View/edit, readonly, individual sections, validation, retained draft, source restrictions | `smoke-customer-lightbox.mjs`, `smoke-lightbox-drafts.mjs` |
| Address and bank controls | Empty/partial/validated/conflicting address, result selection, unavailable lookup, masked/readonly bank data | `compose-smoke-shared-addresses.mjs`, `compose-smoke-address-completion.mjs`, customer editor tests |
| New subscription | Product/channel choices, recipient/payer variants, payment variants, marketing choices, errors, summary and actions | `compose-smoke-subscription-person-details.mjs`, `compose-smoke-subscription-initials.mjs`, `compose-smoke-marketing-preferences.mjs` |
| Existing subscription workflows | Edit, resend, editorial complaint, cancellation, winback, restitution and transfer; relevant conditional steps | `smoke-lightbox-drafts.mjs`, workflow/winback slice tests |
| Article sale and catalog | Search/dropdown, full catalog/tabs, cart, quantity, totals, coupon/discount success and error, payment | Theme smoke; article-search/order slice tests |
| Delivery calendar | Closed/open, selected, available/unavailable/past, navigation, keyboard, loading failure and short viewport | Theme smoke's datepicker mode; delivery-date-picker slice tests |
| Calls, recording, ACW and disposition | Queue, identified/anonymous active call, hold/resume, recording, ACW, follow-up and validation | Operational slice 09; call-agent/disposition tests |
| Contact history | Empty/populated, all semantic categories, long descriptions, fresh highlight and default category | Contact-history slice tests; operational slice 09 |
| Outbox | Empty/loading, every status, capability-limited actions, stale refresh, disclosure, menu and editor | `compose-smoke-session-outbox.mjs`; session-outbox tests |
| Feedback and settings | Form/settings, required-field error, capture/annotation, privacy variants, error/recovery and retained draft | `compose-smoke-feedback-privacy.mjs`, `smoke-lightbox-drafts.mjs` |
| System and shared overlays | Access denied, logged out, toasts, confirmations, permission-limited controls; applicable development dialogs | Theme smoke; shell/lightbox tests |

Inventory dynamically generated UI as well as Twig. Include the five application stylesheets and their load order. Vendor Swagger UI and third-party/logo artwork are not candidates for indiscriminate restyling; record wrapper-level findings separately if they are in the agreed application scope.

## State, layout and accessibility gates

For each row inspect the applicable states: default, hover, active/pressed, keyboard focus, selected/checked, unchecked, disabled, readonly, invalid, loading, empty, success, warning and error. Include native inputs/selects/textareas, radios, checkboxes, buttons, links, disclosures and menus across their real containers.

Compare the same properties throughout:

1. Information and action hierarchy; selected customer/product context remains visible where needed.
2. Font family, size, weight, line height, casing and metadata density.
3. Shared spacing, alignment, label gaps, control heights, section rhythm and content insets.
4. Radius, border weight/color, elevation and the amount of framing or decorative fill.
5. Control state feedback and agreement between native state and surrounding selection styling.
6. Actual text, icon, boundary and focus contrast, including inherited surfaces, transparency and pseudo-elements.
7. Overflow, wrapping, scrolling, sticky/fixed elements and focused-control visibility.
8. Labels, errors, keyboard order, dialog/menu exit, focus restoration and reduced-motion behavior.

Use these environment gates without turning the matrix into an unbounded Cartesian product:

| Gate | Required coverage |
| --- | --- |
| Desktop | Every area at 1440 px; inspect 1280/1024 px when column allocation or toolbar wrapping changes |
| Narrow | Every area at 390 px and 320 px; essential controls and identity remain visible |
| Intermediate | 768 px and each actual breakpoint boundary for changed responsive containers |
| Short viewport | Relevant popovers, dialogs and fixed controls at 390 × 320 or an equivalent constrained height |
| Browsers | Chromium and Firefox for all changed shared controls and representative screens; record actual versions |
| Content | Long Dutch labels, long names/identifiers, multiline errors, populated lists and sparse/empty states |
| Zoom/input | 200% browser zoom, keyboard-only traversal, reduced motion and coarse-pointer target inspection |
| Role/locale | Write-capable and readonly views; Dutch baseline plus English expansion/regression where supported |

Report native browser zoom separately from a CSS zoom simulation. If a browser, screen reader or state was not exercised, say so. Passing selected contrast calculations or automated DOM checks is not a full WCAG conformance claim.

## Extend tests around the approved contract

1. Measure representative showcase and application components side by side. Translate the agreed common rules into shared computed-style assertions for typography, spacing, radius, border and interaction states; avoid testing only the newly written declarations.
2. Add missing real application scenarios to the visual smoke. Keep supplemental synthetic class fixtures clearly separated from real-flow evidence.
3. Capture deterministic fixture states and stable regions. Control locale, viewport, fonts and test data; mask timestamps or other volatile content only when the masked area is unrelated to the assertion.
4. Compare screenshots and computed styles together. A numerical color match cannot explain alignment, clipped text or excessive framing; an image alone cannot establish keyboard behavior or semantics.
5. Keep behavioral regressions tied to the relevant component tests. Use the real backend only for isolated fixture scenarios that need it. Do not turn a style review into unintended customer mutations.
6. Reject acceptance when a covered state has an unresolved deviation. Link a specific follow-up slice for genuinely excluded work and state the limitation, rather than marking it passed.

## Existing commands and their boundaries

Run from the dedicated implementation worktree:

```bash
node tests/frontend/theme-palette.test.mjs
make js-test
make guardrail
git diff --check
```

With the isolated Docker Compose fixture application available, the existing browser entry points are:

```bash
KIWI_SMOKE_BROWSER=chromium make compose-smoke-theme
KIWI_SMOKE_BROWSER=firefox make compose-smoke-theme
KIWI_THEME_DATEPICKER_ONLY=1 KIWI_SMOKE_BROWSER=chromium make compose-smoke-theme
KIWI_THEME_DATEPICKER_ONLY=1 KIWI_SMOKE_BROWSER=firefox make compose-smoke-theme
```

The theme smoke accepts `KIWI_SMOKE_BASE_URL`, `KIWI_THEME_EVIDENCE_DIR` and `PLAYWRIGHT_MODULE_PATH`. Use an existing local Playwright installation. The isolated [draft harness](smoke-lightbox-drafts.mjs) intercepts its requests and aborts other origins; it remains component-harness evidence rather than full application acceptance.

Run `make phpunit` when changed behavior or repository checks require it; it executes in the Compose app. Use `make compose-smoke-oidc` for OIDC-related or required integration acceptance, with an explicitly isolated project: its exit cleanup removes that project's volumes. Local Kubernetes is not required.

Run the existing privacy smoke in both browsers when changes affect captured surfaces, feedback controls or shared CSS with a plausible capture impact:

```bash
KIWI_SMOKE_BROWSER=chromium make compose-smoke-feedback-privacy
KIWI_SMOKE_BROWSER=firefox make compose-smoke-feedback-privacy
```

Privacy evidence is a separate gate from style-guide fidelity. Preserve its tolerance and privacy assertions. Do not repeat unrelated full suites after they have passed unless new changes or findings justify it.

The outbox, marketing and some customer/address/subscription smoke scripts create, patch, cancel or submit synthetic records. Read their setup and fixture requirements before running them; do not execute them unchanged against a production service for this audit. The read-only review can reuse their selectors and state descriptions without executing their mutation steps.

## Completion checklist

- [ ] Reference and application provenance are recorded; accepted visual contracts are traceable to the reference or a documented component decision.
- [ ] Every coverage row has a state, evidence and a conclusion; blocked or excluded states are explicit.
- [ ] Shared components match across their different real containers, not just a specimen fixture.
- [ ] Desktop, narrow, breakpoint, short-height, zoom and keyboard gates are satisfied where applicable in Chromium and Firefox.
- [ ] Required behavioral, contrast and privacy checks pass with their limitations stated.
- [ ] The review identifies what is implemented, reviewed, merged, deployed and accepted without treating those stages as interchangeable.
- [ ] The PR/story evidence links point to accessible artifacts. A failed image upload is not reported as an attachment.
- [ ] No unchanged green test, screenshot count or palette declaration is used as a substitute for the complete visual evaluation.
