# theme_audit 10 — Complete visual acceptance against the showcase

Status: in progress. Baseline capture and reusable rendered comparison started before slice 01. Final acceptance remains pending slices 01–09 and the complete matrix below. This is the verification slice for [theme_audit](../plans/theme_audit.md), not a claim that the application already matches the reference.

## Implementation evidence register

Dedicated worktree: `/home/bartdeijkers/_worktrees/validate-theme-showcase-alignment`. Branch: `codex/validate-theme-showcase-alignment`. PR: [#144](https://github.com/bindinc/kiwi/pull/144); finalization follows slice 09. No merge or deployment is included.

The fresh baseline is retained outside Git at `/tmp/kiwi-theme-audit-implementation/baseline`. Its `provenance.json` records the palette worktree at `5b3222e`, with application assets/templates/scripts verified equivalent to merged baseline `c05973e`. The reference originated at `ecec72d`, SHA-256 `478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4`.

Chromium `157.0.8103.38` and Firefox `150.0.2` each captured the actual local Compose flows at 1440, 390 and 320px, with Dutch locale, reduced motion and device scale 1. Both runs reported zero scenario errors and zero attempted API writes. The retained images cover shell/profile, search/results/customer/editor, initial subscription/payment/consent, article/catalog/calendar, edit/resend/complaint/initial winback, feedback/settings and logged out, plus standalone reference specimens. Feedback used its installed hidden-button handler without changing preference. These are baseline observations, not complete state acceptance.

The baseline reproduces the 1542px populated document at a 1440px viewport. At 320px, the populated document reaches 350px in Chromium and 345px in Firefox. These remain defects to resolve under slices 03/04, alongside payment reachability under slice 02. Native zoom, later conditional service branches, role permutations and write outcomes were not part of that baseline.

The new [rendered comparison harness](compose-smoke-theme-audit.mjs) records reference/application provenance, actual browser/version/viewport, source and fetched stylesheet hashes, screenshots, computed geometry and role-specific surface comparisons. It measures the showcase at the same viewport and compares the application to those measurements. Reports distinguish `verified`, `deviation` and later-slice `deferred` checks; inaccessible scenarios and blocked writes fail the run. No screenshot count is treated as visual acceptance.

Run the harness against the isolated stack owned by the current slice worktree:

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-foundations \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_AUDIT_SLICE=1 \
KIWI_THEME_EVIDENCE_DIR=/tmp/kiwi-theme-audit-implementation/slice01-contract \
KIWI_SMOKE_BROWSER=chromium \
node scripts/compose-smoke-theme-audit.mjs
```

Repeat with `KIWI_SMOKE_BROWSER=firefox`. Defaults include 1440×1000, 390×1000, 320×1000 and 390×320. `KIWI_THEME_AUDIT_VIEWPORTS` can specify additional comma-separated widths/heights such as `1440x1000,1024x1000,768x1000`. The runner allows local Compose hosts only and aborts API writes; it does not submit forms or persist feedback settings. Screenshots remain outside the repository.

Initial foundation gates compare system typography, the spacing scale, composited workflow tints, flat panel geometry and insets against the rendered showcase. Control and workspace gates become required at their owning slice. This initial runner does not yet cover every conditional workflow or replace the existing functional/privacy suites. Native 200% browser zoom uses a separate opt-in OS-shortcut path with measured pixel ratio, viewport reduction and reset; CSS zoom or pinch scaling are never labeled native zoom. Successful syntax checks alone do not establish browser acceptance.

### Slice 01 native zoom result

The actual Compose app at `7bf6ea1` passed the native zoom path in Chromium `157.0.8103.38` and Firefox `150.0.2`. Both runs verified actual OS shortcuts from 100% to 200%, device pixel ratio 1→2, halved CSS viewport width, unchanged physical window width, visual-viewport scale 1, visible keyboard focus and reset to 100%. Profile/menu, initial subscription, payment/consent and feedback settings were traversed with the keyboard without submitting data. Each final report records seven verified checks, zero deviations/errors/attempted API writes and six actual desktop captures. Evidence: `/tmp/kiwi-theme-audit-implementation/slice01-native/{chromium,firefox}/report.json`.

Native captures use the dedicated 1600×1200 Xvfb screen via `ffmpeg x11grab`. Chromium's zoomed CSS viewport was 525×546; Firefox's was 640×478. Browser-protocol screenshots and pointer coordinates were unsuitable under native zoom: initial protocol captures were blank or offset, and were replaced by real desktop captures and keyboard traversal. Those initial captures are not acceptance evidence. The actual screenshots were visually inspected. Existing menu content extends below the first zoomed viewport, and initial subscription nesting/payment defects remain assigned to slices 03, 05 and 02 respectively; this result does not accept those later-slice behaviors.

To reproduce only native zoom, add `KIWI_THEME_AUDIT_NATIVE_ZOOM=1 KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY=1` to the command above. Use a separate evidence directory from the headless matrix. This optional Linux path requires installed `Xvfb`, `ffmpeg`, Python, `libX11` and `libXtst`; it selects a dedicated display (`:95` by default, overridable with `KIWI_THEME_AUDIT_DISPLAY`). It forces Firefox's X11 backend so inherited Wayland cannot bypass that display. No host display permissions or existing application stack are changed.

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
