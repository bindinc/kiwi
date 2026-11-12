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

The versioned [controls companion](compose-smoke-theme-audit-controls.mjs) preserves additional actual renderer states used during slice 02. It shares the same reference measurements, source/served CSS guards, reports and local-host restriction with the main runner. Its CLI defaults to slice 02 and accepts the same application root, base URL, evidence directory, browser and viewport environment variables:

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-controls-and-actions \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_EVIDENCE_DIR=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-02/versioned-controls \
KIWI_SMOKE_BROWSER=chromium \
node scripts/compose-smoke-theme-audit-controls.mjs
```

Run Firefox after the first browser completes. The companion covers catalog tabs and inverse close, cart/coupon actions with localized meaningful remove names, actual composited focus pixels, controlled product suggestions/offer/channel choices, duplicate-person controls, delivery notes, disposition follow-up notes, development dialog fields and feedback/settings actions. It opens the installed application handlers with synthetic in-memory state; it does not select an identity match, acknowledge an identity warning, start a call, generate a queue, invoke the full-reset action, save settings or submit a business form.

Only the exact same-origin read-only quote POST is fulfilled from the declared fixture. Controlled offer responses are same-origin GET-only; unmatched methods fall through to the context-wide API-write guard. Each report records the companion source hash and fixture kinds. Actual dialog reachability is measured after scrolling; an unreachable short state is explicitly deferred to 08, while the same failure outside a short viewport remains required in 02. These component fixtures do not prove backend price, coupon, duplicate matching or complete operational workflow behavior. Native zoom remains the separate main-runner gate; combining it with controls-only mode is rejected rather than silently omitting scenarios.

Set `KIWI_THEME_AUDIT_CONTROL_SCENARIOS=choices` on the companion CLI to isolate actual subscription/article payment and consent states. This mode measures the rendered showcase's payment strong text and consent value labels, then compares both selected and unselected application values, decorative wrapper borders and composited selected fills. It retains the application's initially unset consent, uses real Space/arrow transitions in an isolated context, and never copies the example's business defaults. The controlled disabled-property probe restores the exact original disabled and checked states; it proves styling, not permission behavior.

The choices subset retains actual DPR1 native-widget PNGs and reports their antialiased raster colors as observations. A separate fresh context renders the same application widgets and actual reference counterparts at device scale 2 with browser zoom still 100%, exposing repeated native outer-stroke cores in each of four geometric quadrants, excluding the center dot. Detected paint must span at least 75% of the image; every core needs actual inward white backing and unrounded contrast at least 3:1. This follows [W3C's non-text contrast explanation](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), which distinguishes underlying/UA colors from screen antialiasing and prohibits rounding the threshold. No blanket native-control exemption is claimed. The showcase's decorative 42% Blue Fusion wrapper is a separate role. Device scale 2 is not native browser zoom evidence; the main runner's independent OS-shortcut path verifies 200% zoom.


The runner snapshots all five source stylesheets before navigation and requires their served bodies to match in every application context. Normalization is limited to quotes and the known seven-character Symfony fingerprint on URLs already present in that exact source file, resolved against the stylesheet directory. The complete source asset directory, origin, query and fragment must match; arbitrary CSS differences are not ignored. Missing stylesheet responses fail provenance checks, and Keycloak's unrelated `styles.css` is excluded. Foundation surface probes disable transitions only on their temporary measuring element, leaving the reference and application rules unchanged. Existing outbox 4px corners are explicitly deferred to slice 09 for reconciliation, rather than recorded as a reference match.

Quiet actions use their own role contract rather than being mistaken for an outlined cancel button. The reference defines `.preview-shell .button-calm` rules without an actual quiet element in that workflow. The runner temporarily places a `.button.button-calm` span inside that real shell to measure those existing rules, labels the probe in provenance and removes it before reference screenshots. This is an isolated reference component measurement, not a captured production workflow or newly approved design.

### Slice 03 observational shell baseline

The versioned [shell companion](compose-smoke-theme-audit-shell.mjs) captures equivalent BEFORE/AFTER states independently of the existing default, controls and native zoom modes. `KIWI_THEME_AUDIT_SHELL_PHASE=before` is the default; `after` dispatches required shell-specific assertions from the [acceptance module](compose-smoke-theme-audit-shell-acceptance.mjs), while complete slice acceptance still requires independent visual review and the remaining integration gates. BEFORE defaults remain 1440, 1024, 768, 390 and 320px at 1000px height, plus 390×320, in both Dutch and English. Existing `KIWI_THEME_APP_ROOT`, base URL, evidence directory, browser and viewport overrides apply:

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-controls-and-actions \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_EVIDENCE_DIR=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-03/before-attempt-03 \
KIWI_SMOKE_BROWSER=chromium \
node scripts/compose-smoke-theme-audit-shell.mjs
```

Run the second engine serially after the first terminates. The BEFORE runtime is the preserved slice 02 Compose stack on port 9444, source worktree `align-theme-controls-and-actions` at `3674e3cfba01bc23914c0ffc26d2fe60bcad8522`; slice 03 starts separately from merged planning source `851dc77`. Their product assets are recorded as equivalent, rather than labeling the old live runtime as slice 03. No gateway/runtime swap is permitted during a capture. Reports record the exact source/reference/runner/companion and five served stylesheet hashes.

Actual flow captures cover the empty frame, open profile, populated results, selected customer/work-session, disclosed outbox placement and the scrolled visible outbox. Native Tab/Shift+Tab/Escape outcomes and geometric overflow, region order, context visibility, menu bounds and table scrolling are observations. The green counters in this mode verify locale/provenance only; observed layout defects are not passed acceptance checks. Showcase topbar/grid/sidebar/work-area roles are measured at each viewport.

Long profile labels and long customer context/pending warning are explicitly labeled controlled DOM text/visibility fixtures, not actual identities, pending transactions or permission/reset-guard evidence. Queue/call/ACW placement captures only reveal their actual template regions one at a time; no queue/call/state/timer operation or business action executes. These fixtures establish placement, not complete operational behavior. Actual allowed/restricted roles, preserved drafts, genuine native 200% zoom and the owning slice's required interaction/fidelity gates remain separate AFTER acceptance work.

Initial observations already confirm 94px populated desktop overflow in both engines, a preceding right rail from 1024px down, hidden person/source context on narrow selected sessions, profile Escape without close/focus restoration, and a roughly 700px menu extending beyond the 390×320 viewport. Operational template fixtures paint below the header's fixed 75px allocation. These findings are baseline defects for slice 03, not regressions introduced by its implementation. Both frozen BEFORE runs completed with 144 PNGs and 132 locale/source-provenance checks per browser, zero scenario errors or blocked writes. The capture classifications are 72 actual flow, 60 controlled DOM placement fixtures and 12 reference images per browser. These counts do not accept the observed defects. Final reports are `slice-03/before-attempt-03/{chromium,firefox}/report.json`; `slice-03/before-final-provenance.json` records exact hashes, source equivalence, classifications and retained intermediate attempts, while `slice-03/before-visual-review.md` records inspected images and grouped findings. Runner SHA-256 is `279ce24a3c7f06028882b55616fe894819f9c03a5ca8e90cf20f2d08d7c41a26`; shell companion SHA-256 is `c71f2adc32682f3adc0cfc2ecd02ee92e9a8ed83adc0a2c5f04632ac80b362fd`. Three invalid mode/slice combinations are rejected before browser startup. Thirteen existing default/control/native/shared function bodies and the controls companion are byte-identical to checkpoint `62c7a8a`; `slice-03/mode-preservation-provenance.json` records the comparison. The reference contract gains shell-only measurements, and the existing modes retain their viewport branch and dispatch.

### Slice 03 required AFTER shell gates

AFTER uses separate `KIWI_THEME_AUDIT_SHELL_SUITE` values. `matrix` covers 2048, 1440, 1024, 768, 390 and 320px at 1000px height plus 390×320, in Dutch and English. `boundaries` covers widths 1201/1200/1199, 1001/1000/999, 769/767, 601/600/599 and 481/480/479 at 1000px height, plus 390×541/540/539. `roles` and `interactions` use 1440×1000 and 390×320; roles authenticate actual `kiwi-admin` and `kiwi-view` sessions rather than simulating permission DOM. The restricted server render must omit settings while retaining real role, masked avatar and POST logout/CSRF-presence semantics; the logout form is never submitted.

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-shell-and-navigation \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_AUDIT_SHELL_PHASE=after \
KIWI_THEME_AUDIT_SHELL_SUITE=matrix \
KIWI_THEME_EVIDENCE_DIR=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-03/new-after-run \
KIWI_SMOKE_BROWSER=chromium \
node scripts/compose-smoke-theme-audit-shell.mjs
```

Choose a fresh evidence directory for every invocation; preserve the retained attempts. Repeat serially for Firefox, then the other suites. Reports record all three tooling module hashes, five source/served stylesheet hashes and seven changed source/served behavior assets. Import normalization recognizes only the exact known source import URLs and seven-character AssetMapper fingerprint; directory, origin, query, fragment or application-code differences remain failures. Physical PNG dimensions are recorded separately from CSS viewport and device ratio. Earlier BEFORE reports keep their original source/tooling boundaries.

Required gates measure actual reference spacing, colors, typography and action roles. They enforce card-content containment including postal/house fields and captions, responsive search→work→history order, no concealed document overflow, actual post-search heading/sort visibility below the current header, a named keyboard-scrollable local results table, complete customer context within its own boxes and clipping ancestors, compact separated desktop groups, and a stable reset anchor between empty/active/long/pending states. Sticky anchors use viewport coordinates; relative headers use document coordinates to distinguish real jumps from intended page scrolling. The circular 40px profile identity is an explicit exception to ordinary square actions: unfocused/unhovered rest must be transparent without a permanent frame, separate hover stays circular, and genuine Tab/ShiftTab must show inverse keyboard focus. Actual menu wheel and Tab navigation reach the last action without activating logout; Escape restores focus. The interaction suite checks retained article drafts, debug-feature gating, topmost-debug Escape priority and the existing search shortcut.

Long customer names go through the actual in-memory work-session renderer with original person/source identity retained; deliberately repeated synthetic text forces header growth even at 2048px while a profile menu is open. Long profile agent/role labels are separately identified as DOM-only display fixtures and restored from browser-held originals; they never represent changed permissions. Pending-reset and queue/call/ACW template visibility fixtures establish placement only, without starting an operation or proving a transaction guard. Geometry is read after the existing two-animation-frame paint boundary so the application's ResizeObserver can deliver the corresponding header inset. The retained numeric trace records immediate 127.1875px header/old 80px inset becoming 144px inset after the next frame; restoration likewise settles 64px/80px. No product fix or relaxed bound was used for that measurement correction.

Actual OS 200% shell checks use the existing native runner with `KIWI_THEME_AUDIT_SLICE=3` and `KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY=1`. They run after OS zoom is verified, use actual desktop captures, and preserve CSS viewport/DPR/reset proof. The attempted Chromium Translate launch flag did not suppress the observed browser UI. Native Chromium slice 03+ therefore sends two actual OS Escape inputs at the empty application baseline, then waits at most five seconds for original X11 pixels above all three utility controls to match the computed opaque header background. It records frame hashes/colors and uncropped first/clear plus before/after images without arbitrary sleeps or image alteration. Those sample points establish readiness only; independent inspection of the complete uncropped header remains mandatory. Default, controls and native slice 02 modes retain their existing dispatch and behavior. No protocol zoom or emulated DPR is represented as native zoom.

The first Chromium full attempt is preserved with two synthetic-growth deviations at 2048px and two 768px outside-click setup errors: the fixture name still fit at broad width, and the menu covered the postal field center. The corrected probe records actual hit-tested viewport coordinates and sends a genuine pointer click to that exact uncovered input point; it still requires menu closure and retained input focus. The initial preflight's seven stale ResizeObserver inset readings are likewise retained with causal timing evidence. These attempts are not relabeled as acceptance passes. Chromium full02 also retains its two short-profile wheel-readiness deviations: a reopened menu already had a positive scrollTop, so the inherited `>0` predicate did not await the new input. Firefox full03 retains two later top-label capture errors: actual trusted upward wheel input moved544→319 but one event did not reach0. Event/RAF traces preserve that movement, unchanged document scroll/focus and stable bounds. The reviewed helper waits for actual movement from each observed starting offset and sends bounded repeated genuine upward wheels, retaining exact0 as the final requirement. No synthetic scroll, longer timeout or product change was introduced. The terminal evidence below retains those diagnostic boundaries; none is substituted for a successful final run.

### Slice 03 scoped AFTER evidence — 2026-11-10

The completed required runs use actual Compose03 on port 9444, application HEAD `ab37d44dc6f3656bb32326036530e8de50f4bdf9` (product `a467d33` plus circular-profile correction `ffc34a8`). Every observed source/served stylesheet and behavior asset matches. All final reports have zero required deviations, deferrals, unverified checks, scenario errors or attempted business writes. Their exact hashes, 1,124 retained PNG paths/hashes, capture classifications and tooling boundaries are recorded in `slice-03/after-final-provenance.json`; source-specific inspected examples are in `after-visual-review.md` and the independent review register. Counts include repeated state checks and are not a substitute for visual acceptance.

| Required scope | Chromium verified / captures | Firefox verified / captures | Retained reports |
| --- | --- | --- | --- |
| Seven-view matrix, Dutch/English, normal and long context/profile labels | 13,014 / 266 | 13,028 / 266 | `after-matrix-attempt-03/chromium`, `after-matrix-attempt-04/firefox` |
| Current repeated-wheel delta at 390×320, Dutch/English | 1,866 / 38 | 1,866 / 38 | `after-preflight-attempt-05/{chromium,firefox}` |
| All 17 declared breakpoint/height boundaries | 11,350 / 136 | 11,350 / 136 | `after-boundaries-attempt-01/{chromium,firefox}` |
| Actual admin/view OIDC rendering and profile keyboard flow | 342 / 16 | 342 / 16 | `after-roles-attempt-01/{chromium,firefox}` |
| Retained local draft, debug gating/Escape priority and search shortcut | 3,758 / 84 | 3,758 / 84 | `after-interactions-attempt-01/{chromium,firefox}` |
| Actual OS 200% zoom, complete native shell/menu/disclosure flow and 100% reset | 1,383 / 24 | 1,381 / 20 | `after-native-attempt-03/chromium`, `after-native-attempt-02/firefox` |

Each directory contains `report.json`. Chrome full03 keeps main SHA `229cc88a` and acceptance module `5f910a6e`; Firefox full04 plus boundary/role/interaction runs use the same main with module `eb4e662c`. The latter changes only actual wheel completion and bounded repeated upward inputs; the separate current short Chrome proof covers that delta. Native Firefox02 uses main `229cc88a` with module `57cd937d`, whose sole additional change handles the actually already-open outbox through genuine Enter close/open and ARIA assertions. Final native Chrome03 uses main `c8ca0b4b` with `57cd937d`, adding only the proven native Chromium browser-UI preparation; companion `5ae3999a` is unchanged throughout. Earlier reports are not relabeled as the final tooling revision. The final Chrome report correctly retains the parent's single dirty audit-document path, `templates/base/theme_audit-03-shell-and-navigation.md`; all product files and source hashes remain unchanged. Other final reports recorded clean tracked sources.

Native zoom is independently proven by actual OS shortcuts: Chromium 1050→525 CSSpx and Firefox 1440→720, device ratio 1→2, stable physical browser width, visual-viewport scale 1, and reset to 100%. Chromium's 24 images contain 18 actual application desktop states, four browser-UI preparation frames and two reference captures; Firefox has 18 actual application desktop states and two references. The earlier native Chrome02 report's green measurements are retained with its visibly obstructing Translate popup and are not accepted as complete header visual proof. The final bounded suite was repeated after actual X11 clearance. Full uncropped baseline, profile last-action focus, selected identity and outbox/header images were inspected independently in both engines: no browser popup obscures the header, complete person/source context remains readable, and circular profile focus differs clearly from unfocused rest.

The independent review also inspected actual wide/narrow/short flow images against the showcase, allowed/restricted server renders, retained draft and topmost debug dismissal. Offline instrumentation exercised 16 real exported geometry-guard cases and 11 exact JS-normalization cases. Five actual invalid CLI executions and four capture-bookkeeping model cases are distinct evidence types. Operational placement fixtures, pending-warning visibility and synthetic profile text remain explicitly bounded; this does not accept a call, transaction guard, changed permission or business write. Remaining VIEW/table/filter presentation belongs to 04; workflow/component regions and final full-interface acceptance remain 04–09 and 10.

### Slice 04 observational customer baseline

The [customer companion](compose-smoke-theme-audit-customer.mjs) adds a separate `KIWI_THEME_AUDIT_CUSTOMER_ONLY` mode. Its CLI defaults to slice 04 and `KIWI_THEME_AUDIT_CUSTOMER_PHASE=before`. The frozen baseline runner rejected AFTER; the current runner accepts the explicit `after` phase through the separate [customer acceptance module](compose-smoke-theme-audit-customer-acceptance.mjs). Existing shell/default/controls/native modes retain their dispatch. Main SHA `aa2814b8` and customer companion `7115a4c6` are retained in `slice-04/before-frozen-tooling`, including the reused exact-import normalizer `57cd937d`.

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-shell-and-navigation \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_AUDIT_CUSTOMER_PHASE=before \
KIWI_THEME_EVIDENCE_DIR=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-04/new-before-run \
KIWI_SMOKE_BROWSER=chromium \
node scripts/compose-smoke-theme-audit-customer.mjs
```

Use a fresh evidence directory and serial browser window. The retained baseline uses unchanged accepted 03 runtime/source `80c7cdd81fee820636883fd2278028107feb94dc`, not the developing 04 worktree. A fresh whole-tree diff against merged planning `9f7c1f7` is empty. Chromium and Firefox each retained 49 images and 69 successful locale/source-provenance checks, zero scenario errors or attempted business writes. Coverage is 1440×1000 Dutch plus 390×1000 Dutch/English: 21 actual-flow images, 24 explicitly controlled component fixtures and four rendered references per engine. Each engine intercepted three address-search POSTs and three session-cleanup DELETEs only inside the explicit source-editor fixture; no validate request was exercised and none was sent upstream. Five actual invalid CLI executions reject pre04, conflicting modes, native combination and unimplemented AFTER before browser startup.

Actual filter/result/VIEW hover and keyboard-focus, selected record and legacy editor are captured separately from a three-row GET fixture with long/multiline data, multiple active/ended/empty subscriptions and an uninvoked optional identify action from a restored read-only dependency getter. Actual source-editor code renders deferred loading, failed read/reopen retry, two editable retained dialogs for the same person with different credentials, address candidates/selection, and a separate readonly capability model. No person/order/call mutation or save submission executes; the global write abort remains active and source-editor mutation callbacks throw. These are component fixtures, not actual provider or permission acceptance.

The baseline visibly records gray VIEW actions, broken separators from flex table cells, zero-inline-padding filter hover and repeated retained-editor heading/address IDs. The second editable address section lacks its own completion binding under the original global prefix. Compound editor context has no explicit name/id privacy markers. These are observed defects, not green parity checks. Actual reference selectors are `.sidebar-result`, `.customer-header`, `.customer-grid` and `.preview-actions`; no nonexistent example selector is used. Reports and 98 image hashes/source equivalence are in `slice-04/before-final-provenance.json`; image-specific observations are in `before-visual-review.md`. At this baseline checkpoint, AFTER/native/redaction/readonly/draft and current-source integration were still pending; completed scoped evidence follows below.

### Slice 04 focused customer acceptance

The AFTER companion uses the actual local search/select/legacy-editor flow, then bounded controlled renderers for uncommon subscription and source-editor states. It compares metadata captions/values with the actual showcase `.detail span` and `.detail strong` roles and measures filter insets, native table-cell geometry, secondary actions, field/label ownership and retained editor identity. Native selects keep their browser line-height; address candidate lists retain their deliberate caption-sized multirow role. Hidden original addition controls transfer their visible label to the real addition selector; their IDs and descriptions remain owned by the same editor.

Table checks exercise real sorting, keyboard local scrolling, pagination and the existing no-results consumer, which hides the old rows and exposes the welcome region without clearing the query. A restored three-row GET fixture provides white/striped/current, multiline and disabled-secondary surfaces. Actual pointer hover and held pointer press are captured separately and released outside the action. The contextual table hover/pressed rule keeps the reference white fill, declared action-hover/action-active ink and action borders; global secondary and disabled roles remain separate. Actual desktop screenshot pixels prove matching divider coverage across every column, alongside native table geometry; narrow overflow is checked through its named keyboard-scrollable wrapper.

The original 98 BEFORE images did not include the reusable-person lookup. A separate recovered baseline therefore ran the actual retained slice03 Compose source `80c7cdd` at 1440/390 in both engines, with only exact role-runtime/CSS provenance and no SDK capture. `before-lookup-recovered-02` retains 12 images and 26 successful provenance/locale checks per engine; these are observational. Real pointer expansion captures field and result regions separately. The first attempt remains as keyboard-interference evidence: the delegated role Enter shortcut prevented native summary expansion and performed a search. A bounded current-source `97df611` Chromium probe independently reproduced that exact failure while Space, input Enter and button Enter passed; its 22 passed checks and one required failure are retained in `lookup-keyboard-current-97df`. Global subscription composition and person-selection/order behavior remain owned by later slices.

Source fixtures supply two editable identities and a third readonly model to the actual editor module, with source writes throwing and exact synthetic address-search/validate/session-cleanup requests intercepted before upstream. A held response proves pending lookup, then candidate/addition selection, confirmation, no results, validation rejection, ambiguous lookup, provider failure and keyboard retry. Closing a dialog correctly ends its lookup session: distinct session IDs are compared before/after that boundary while the local draft and retained field identity survive actual reopen without another read. Loading/error copy, public prompts, private context/options, labels and descriptions remain explicit.

Editor images capture the actual viewport at deliberate top, address-status, lower-field and retained-draft positions. Oversized dialog screenshots that include clipped blank areas are retained only as preflight diagnostics. Direct SDK redaction checks removal of original private values and exact restoration of field state and semantic DOM; the report separately records raw HTML and empty-style-attribute normalization with before/after SDK and evidence-screenshot phase counts. The actual production `captureElementScreenshot` clone/onclone pipeline must independently produce verified pseudonymized output without changing the raw live editor DOM or fields. Only the pseudonymized synthetic-editor PNG is retained; no feedback is submitted or uploaded.

Firefox's first corrected-source run retained 131 images with 647 passed checks, five failed checks and no scenario error or attempted write. Its production PNGs visibly remove the original input/option values; the remaining input-pixel failure was confined to the native DATE field. A bounded actual production-callback diagnostic proves the original valid ISO property/attribute is present while its unmodified 365×32px original PNG inner region is exactly one opaque background color; the pseudonymized property/attribute no longer contains that private date and the live date is unchanged. This is an explicit Firefox SVG/foreignObject native-date rendering limitation, separate from the real app's date control. The strict pixel gate retains equal dimensions, live-state/observer restoration, coverage and region-count requirements: every nondate or painted-date region must change pixels; only an originally uniform opaque Firefox DATE may instead use actual original and sanitized serialized state proof. Twelve offline counterexamples and six independent boundary cases cover failures such as retained private attributes, painted unchanged dates, unchanged text, another engine, transparency and mutated live state. The original Firefox report remains a diagnostic, not accepted formal evidence.

That run's VIEW-focus failures likewise retain their actual images: the previous programmatic-focus/Tab/ShiftTab setup returned to the table wrapper in Firefox. A recorded real focus trace proves named-wrapper focus followed by native forward Tab reaches the actual VIEW button. The current helper requires that exact active control, `:focus-visible` and the unchanged 3px action outline; a wrapper focus ring never substitutes for the action's focus proof. Direct SDK restoration phase counts in both desktop/narrow Firefox are 43 empty-style attributes before redaction, 43 after redaction, 56 after the evidence screenshot and 56 after restoration: inert serialized attribute differences originate during screenshot evidence, while all semantic DOM and field state restore exactly.

Native slice04 dispatch reuses actual XTest Ctrl-plus/Ctrl-zero, measured OS200% geometry and Chromium's real X11 popup-clearance gate. Its focused customer suite and small shell/profile/context sentinel replace unrelated workflow replay; all native images remain uncropped X11 desktops. BEFORE artifacts remain immutable. The first frozen-source Chromium run on `495631a` retained 119 images and 620 successful numerical checks with no scenario error or blocked write at 1440 and 390px (Dutch baseline and narrow English subset). Independent image review nevertheless rejected its production editor PNG: original synthetic input values remained visible while the privacy summary reported verified. `2026-11-11/slice-04/after-focused-01/visual-acceptance-status.json` records the failure and immutable image hash. It is not accepted evidence. The runner now requires actual original/pseudonymized sensitive-input region pixel changes at equal output dimensions, plus independent review of the pseudonymized text. The scoped completion below resolves the required focused, stress, native and corrected production-capture gates without relabeling that rejected run; slice10 remains incomplete through slices05–09.

### Slice 04 accepted scoped checkpoint (2026-11-11)

Product/test code is frozen at `d18bb5409da48320ac8014df901e48355338d13f`. Later `e8339d3` and `1c76db9` change only the owning audit/index and the queued slice08 backdrop plan; all 18 independently reviewed product/test bodies remain identical. Report-local commits, dirty paths and tooling hashes retain their actual capture-time values. The final application checkpoint is `1c76db9661b177eef6363f365d9d04d68421ded6`.

Evidence is retained outside Git under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-04`. `after-final-provenance.json` hashes eight selected reports and 639 PNGs, verifies all 18 reviewed bodies, and links the criterion-by-report independent review. `lookup-before-final-provenance.json` records the separately recovered 24 lookup BEFORE images and proves the original two reports plus 98 PNGs are unchanged (100/100 hashes). Image counts include references and explicitly labeled component fixtures; they are not counts of independently unique workflows.

| Report relative to the evidence directory | Verified checks | Captures | Outcome |
| --- | ---: | ---: | --- |
| `after-focused-04/chromium` | 669 | 133 | All required desktop1440/narrow390 Dutch and narrow English gates pass. |
| `after-stress-sentinels-02/chromium` | 564 | 108 | 2048/1024/768,320 and390×320 pass. |
| `after-focused-03/firefox` | 654 | 131 | One retained narrow directional-scroll assumption is resolved only by the explicit narrow supplement below. All other covered gates pass. |
| `after-stress-sentinels-01/firefox` | 563 | 108 | One retained2048 single-pixel raster-coordinate assumption is resolved only by the wide supplement below. All other covered gates pass. |
| `after-wide-pixel-followup/firefox` | 85 | 17 | All six columns share actual opaque border rows336/457; zero remaining failures. |
| `after-narrow-followup-01/firefox` | 412 | 80 | Normal-height390 scrolling, explicit address no-results, Dutch/English and production privacy pass. |
| `native-customer-01/firefox` | 165 | 29 | Actual OS200%, uncropped X11 and100%reset pass. |
| `native-customer-01/chromium` | 167 | 33 | Actual OS200%, X11 popup readiness, uncropped frames and100%reset pass. |

Every selected run has zero scenario errors or attempted unexpected business writes. Expected synthetic address lookup/validate/session-cleanup requests remain intercepted and separately counted. Original partial report summaries are immutable; the manifest maps each of their two exact helper deviations to its successful supplement. Native Firefox changes1440×1000 CSSpx to720×500 and Chromium1050×1093 to525×546, device ratio1→2 with pinch scale1, stable physical window and exact100%reset. Separate revealed record-heading/contact-band frames and populated live native DATE frames establish actual visible native content; natural-state captures remain retained. All actual native images are full1600×1200 X11 desktops. Chromium's33 captures include four browser-UI preparation/readiness frames; those are not additional application workflows.

The independent source, strict focus/date/raster-probe reviews and scoped rendered completion pass. Existing privacy integration was rerun on the changed capture algorithm at the same2%/channel64 thresholds: Firefox0/0/.511%, outside.570%; Chromium.940/1.503/1.518%, outside0. Its exact source/log provenance is `integration-sdk-fixed/provenance.json`; older theme/privacy integration boundaries remain separately recorded rather than presented as current-SDK proof. Tooling syntax/whitespace,12 meaningful pixel-proof guard counterexamples and six independent boundary cases pass. The Firefox SVG blank-date limitation remains explicit; actual live native date controls retain their values and render separately from that capture path. Generic modal/backdrop alignment remains slice08 work, including the user's explicit50% ordinary-backdrop target and the protected actual-image-review privacy state.

Reproduce the focused suite using a fresh evidence directory and one serial browser window:

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-customer-and-data-views \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_AUDIT_CUSTOMER_PHASE=after \
KIWI_SMOKE_BROWSER=chromium \
KIWI_THEME_EVIDENCE_DIR=/tmp/kiwi-theme-audit-customer-new-run \
node scripts/compose-smoke-theme-audit-customer.mjs
```

Use `KIWI_THEME_AUDIT_VIEWPORTS=2048,1024,768,320,390x320` for the bounded sentinels/stress, and repeat with Firefox. Native runs use the main entry point with `KIWI_THEME_AUDIT_SLICE=4`, `KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY=1`, `KIWI_THEME_AUDIT_CUSTOMER_PHASE=after`, `KIWI_THEME_AUDIT_CUSTOMER_ONLY=0` and an unused `KIWI_THEME_AUDIT_DISPLAY`; they require real Xvfb/XTest/ffmpeg and never simulate zoom through viewport/DPR settings.

This completes the slice04 tooling checkpoint. PR144 stays draft: slices05–09, final complete-interface acceptance and final base reconciliation remain required before slice10 can complete. No merge, deployment, worktree/container/volume cleanup or feedback upload is included.

### Slice 05 observational subscription baseline (2026-11-11)

The subscription companion adds a separate `KIWI_THEME_AUDIT_SUBSCRIPTION_ONLY` mode. Frozen main `733dac7a` and companion `c5719ddd` captured the actual integrated application before slice 05 edits, using the same showcase reference at 1440×1000 and 390×1000 in Chromium and Firefox, Dutch locale. Each browser completed 46 source/locale checks with zero errors or attempted writes and retained 34 PNGs: 15 actual form states plus two reference images per width. These counts establish provenance and representative BEFORE coverage, not layout or workflow acceptance.

The mounted source was the retained PR142 integration worktree at `d34dac13`, project `kiwi-theme-audit-integrated-04` on port 9444. The untouched slice05 worktree at `228620c4` was not mounted. `slice-05/before-source-equivalence.json` proves all six behavior modules, five stylesheets, Twig template and showcase bytes equal across that runtime, rebased 05 and merged main `a39b9dbf`. `before-final-provenance.json` hashes both reports/logs and all 68 images; `before-frozen-tooling` retains the exact executable bodies. Independent baseline and source-equivalence review passed. The earlier unexecuted today-only helper remains in `before-tooling-pre-merge`; current main already contains PR140 guide editions/provider dates and recovery.

The actual baseline includes initial product/new-recipient/payment/consent, three long selected products, a single-edition guide, explicit regional edition, mixed readonly provider dates and editable membership date, long selected recipient, open lookup, separate payer, create recipient/payer and lower actions. Exact synthetic GET fixtures preserve products `THEME05-ALPHA`/`THEME05-BETA`, persons 99051/99052 and source `theme-audit05-source`, adding fixed ATV membership 990503. Generated form-session cleanup is fulfilled locally; unmatched API mutations are blocked. No form is submitted. Both browsers measure an 800px desktop card, 326px narrow card, 12px product radius, 14px product inset and 13.6px nested party inset. These are observations of the inherited composition.

Current AFTER tooling has a separate `after` phase and `focused`/`sentinels` suites. It reuses the baseline states, reference roles and source guards, then exercises actual lookup/provider errors and recovery, native payment/IBAN validity, local draft reopening, duplicate-warning renderer fixtures and exact intercepted submission outcomes. Shared SDK production-capture pixel and restoration criteria are retained. Native mode uses the existing actual XTest 200% zoom/header-readiness/100% reset path, with uncropped desktop captures. The pointer-only supplement (`KIWI_THEME_AUDIT_SUBSCRIPTION_POINTER_SUPPLEMENT=1`) preserves actual toast obstruction, waits for the same button center to become hit-testable through natural expiry, then verifies a physical disabled-button click, direct awaited production-handler reentry and exactly one locally held POST. Slice 10 remains incomplete until 09.

The first preflights on application source `a486ae9` are retained separately. Preflight 01 stopped on a missing harness reference-contract binding. Preflight 02 preserves 52 images and actual pending-state clarity findings, together with two harness assumptions: address search normalizes 2A input to base 2 while validation retains 2A, and native submission lazily adds four empty address selects before the rejection checkpoint. Every existing field and selected identity remained exact in the independently inspected snapshot diff. These failed whole runs are not acceptance passes; their evidence and exact helper bodies are preserved before corrections.


On final application `ac37e1b4`, bounded strict full-card production privacy/DATE supplements pass 32 checks in each browser; narrow pointer supplements pass 76 checks each. Exact live HTML and field attributes/properties, fixed captions/catalogue copy, normalized private IBAN replacement and the original sensitive-input pixel guard remain required. Firefox's original SVG membership DATE interior is uniformly opaque; the existing narrowly bounded fallback also requires original/sanitized serialized date properties, equal dimensions and exact live restoration. Actual native DATE painting is a separate gate. The source correction contains only the scoped date-wrapper formatting context; neither ROI math nor the privacy exception was relaxed.

The coherent earlier `after-focused-02` reports remain failed whole runs (Chromium 241/1, Firefox 240/2, 86 captures each). Their inspected passing state/draft/source/ownership scopes are retained with exact code-equivalence and resolving supplements, rather than relabelled green. Populated DOB diagnostic reports retain 42 verified checks and two selected-value deviations per browser: displayed selections are pseudonymized and public captions/live form remain exact, while unexported detached option values remain original under the existing SDK design. This does not establish a visible DOB leak or authorize an SDK rewrite.

Responsive and native runs retain actual focus evidence separately from host-only predicates. Independently inspected Chromium native calendar-button focus is visible even when the input host does not match `:focus-visible`; the corresponding three boundary flags and one OS200 flag remain in the raw reports. Firefox's finite product-Tab and native protocol-hit attribution remain explicit supplements; final completion requires their actual keyboard/OS evidence and independent review. Diagnostic helpers, original synthetic crop/SVG evidence, failed attempts and frozen executable versions remain outside Git under `slice-05/`.

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

These recorded runs used the independently reviewed comparison runner at [040d728](https://github.com/bindinc/kiwi/blob/040d728/scripts/compose-smoke-theme-audit.mjs), SHA-256 `dcfbc3c1e1b40830b4ce514bead8f60c5e690aee5a46c1348182a19e728724fc`. The controls companion dispatch in checkpoint `afa5cbf` retained those measurement functions; subsequent choice guards extend them. Every new report records its own runner/companion hashes rather than relabeling earlier runs. The current reference remains SHA-256 `478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4`. The following runs are retained in `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-02`, with exact report hashes, source hashes, fixture classification and scope in `final-matrix-provenance.json`.

| Scope / application source | Chromium | Firefox | Retained evidence |
| --- | --- | --- | --- |
| Expanded desktop/narrow/short defaults, `1d78cf8` | 14,949 verified; 39 later-slice deferrals; 100 captures | 14,953 verified; 39 later-slice deferrals; 100 captures | `contract-attempt-08/{chromium,firefox}/report.json` |
| Actual native 200% zoom, `1d78cf8` | 656 verified; ten captures | 656 verified; ten captures | `native-attempt-03/{chromium,firefox}/report.json` |
| Actual inverse catalog close default/hover/focus, `1d78cf8` | 208 verified; 16 captures | 208 verified; 16 captures | `catalog-close-final/{chromium,firefox}/report.json` |
| Additional actual control families, `48e66cf` | 2,043 verified; one short-hover deferral; 60 captures | 2,043 verified; one short-hover deferral; 60 captures | `additional-actions-attempt-04/{chromium,firefox}/report.json` |

These completed runs have zero required deviations, unverified interactions, scenario errors or blocked business writes. The additional-family fixtures explicitly intercept 16 read-only quote POST calculations per browser; those requests never reach the backend and are not represented as real coupon/price acceptance. Additional-family results keep source `48e66cf`; the subsequent inverse-close correction is covered on `1d78cf8` separately. No count is relabeled as a newer source result.

The 39 default deferrals are 32 outbox-corner observations (09), two populated-workspace overflows (03), three narrow article insets (06), and the known short feedback close plus unreachable primary hover (08). These remain deviations owned by later slices, not visual passes. The separate delivery-notes modal caption/textarea follow-up and parent-owned privacy/existing-theme gates are not included in these default-run counts. Complete slice 10 acceptance still requires every later workflow and state in the full matrix.

Actual native zoom was re-proven with device ratio 1→2, halved CSS viewport, unchanged physical browser width, visual-viewport scale 1 and reset to 100%. Chromium measured 1050→525px and Firefox 1440→720px. Native payment focus and settings, actual narrow/desktop catalog close hover/focus, generated duplicate controls, cart focus and rich product choices were visually inspected alongside the reference. `matrix-visual-review.md` retains image-specific observations and boundaries.

The versioned controls companion was subsequently exercised on application source `c12b7fec5d55d37c5dd6b36ec654a813574a08a9`: **3,094 verified checks, two explicit slice 08 deferrals, 80 captures and zero required deviations/errors/blocked business writes per browser**, at all four viewports. Reports are retained at `versioned-controls-attempt-02/{chromium,firefox}/report.json`. They require all nine conditional ordinary fields across delivery, disposition and development dialogs, with 36 field observations per browser; 16 read-only quote calculations remain explicitly intercepted. The deferrals concern the short disposition follow-up field's viewport bounds and unreachable short feedback hover. Correct canonical focus paint is not represented as complete viewport/ancestor containment.

The same dispatcher retained the existing default path: a desktop regression recorded Chromium 3,738 and Firefox 3,739 verified checks, nine later-slice deferrals, 25 captures and no errors/deviations/writes (`versioned-default-dispatch`). Three offline CLI rejection checks passed for an unsupported pre-02 slice, controls/native combination and external application origin. At checkpoint `afa5cbf`, the preserved default/measurement/native function bodies were byte-identical to checkpoint `040d728`; `versioned-controls-dispatch-provenance.json` records that comparison. Payment/consent descendant value typography and selected-wrapper counterparts identified afterward require their own focused source correction and verification; these earlier counters do not establish those properties.

The initial isolated choice follow-up on application source `d39ed641cc8850c165f830f433902144b9308e41` was a **raster-measurement diagnostic, not final acceptance**. The reviewed measurement runner `3d56e5f1401096c24fa2794a11ca5eda06b10cb512aa889543c848265a5ae4df` and companion `2a99024434035f93ad309260da3a1987c6e23caae1c7a0608063b14de586a9b8` completed `choice-values-attempt-03` at all four viewports: Chromium 1,620 verified / zero deviations, Firefox 1,607 verified / 13 deviations, 56 captures each and no scenario errors or blocked writes. Payment text 13/600/16.9, consent values 13/400/18.2 muted, both wrapper states, selected 6% fill, real keyboard selection and disabled-fixture restoration passed in both browsers. Firefox's failures concern actual native boundary pixels: the unchecked marker's darkest pixels are `(148,148,161)` and `(148,148,162)`, respectively 2.99581289736:1 and 2.99278791856:1 against actual white; no rounding to 3:1 is allowed. The cardinal-only probe also rejected one short checked marker's antialiased raster position. Independent whole-ring analysis found real outer cores in all four quadrants at least 4.94011483505:1; the reviewed full-quadrant correction removes that measurement false failure while retaining all twelve unchecked failures. Paired whole-viewport/input PNGs show the desktop unchecked capture is byte-identical across all 420 pixels, ruling out locator-crop resampling for that finding. The later intended-color interpretation and actual same-source proof below supersede that literal raster verdict without modifying the retained report.

The original desktop `choice-values-attempt-01` remains preserved as a measurement diagnostic: its annulus selected inner antialias colors and omitted the extra fractional-crop row. The corrected geometry probe was independently reviewed and tested against those retained PNGs without changing the application or the 3:1 gate. Its real Chromium unchecked minimum is 3.84294495450:1. These diagnostic changes never overwrite earlier reports or count a failed native boundary as accepted.

The final focused choice run on the same frozen `d39ed64` source passed in both browsers: **3,348 verified checks, 116 captures, zero deviations/deferred/unverified/errors/blocked writes per engine**, across all four viewports (`choice-values-attempt-05/{chromium,firefox}/report.json`). Main runner SHA-256 is `34b5306c703c813377494b60de95d5d8005acc083cbd5ffd2b2148055a1da001`; companion SHA-256 is `4b9366212600fa03615fe74bfdf7c51ba990ca0b7fb34f710325f4fe9bae431a`. Every fresh actual application phase retains all five served/source CSS comparisons. DPR2 showcase counterparts are actual rendered reference inputs, not class specimens. In Firefox, both application and reference unchecked cores are exactly `(143,143,157)` at **3.1896587192629013:1** and selected cores `(73,98,117)` at **6.388343064073346:1** against actual white. DPR1's raw approximately 2.993–2.996 raster observations remain visible, interpreted as antialiasing rather than rounded to a passing ratio. No CSS modification or blanket user-agent exception was used.

The current-source native browser gate also passed in both engines: **945 verified checks, 12 captures (ten actual desktop captures plus two reference captures), zero deviations/deferred/unverified/errors/blocked writes per browser**, retained at `choice-native-final/{chromium,firefox}/report.json`. Actual OS shortcuts changed Chromium 1050→525 CSS pixels and Firefox 1440→720, device ratio 1→2, with stable physical browser width, visual-viewport scale 1 and reset to 100%. This is independent native 200% browser zoom evidence; the DPR2 diagnostic above is not used as a substitute. Actual payment/consent keyboard transitions, initial unset consent, conditional IBAN and current reference-derived typography/surfaces were exercised. Representative actual desktop captures were inspected, including Firefox payment focus and Chromium consent selection. Chrome's browser translation popover appears at the top of a capture without covering the changed consent region; complete shell/header parity is not claimed here.

Offline negative measurement fixtures reject a center-dot-only false boundary, a genuinely pale 200/200/200 stroke and missing actual white backing (`native-probe-negative-guards.json`). Unknown companion scenario mode is rejected before browser startup (`choice-cli-guard.json`). Actual default/narrow/short payment/consent screenshots and DPR2 application/reference native images were inspected; workflow layout and complete modal containment remain with their later owning slices.

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

### Slice 06 article baseline and focused acceptance tooling (2026-11-11)

The [article companion](compose-smoke-theme-audit-article.mjs) and [acceptance module](compose-smoke-theme-audit-article-acceptance.mjs) keep source-bound BEFORE observations separate from required AFTER checks. Use `KIWI_THEME_AUDIT_SLICE=6`, `KIWI_THEME_AUDIT_ARTICLE_ONLY=1`, `KIWI_THEME_AUDIT_ARTICLE_PHASE=before|after` and `KIWI_THEME_AUDIT_ARTICLE_SUITE=layout|focused`. Existing local Compose URL, application root, evidence directory, browser and viewport variables apply. Each run uses a fresh evidence directory and closes its browser before the next engine starts. `layout` captures the existing catalog/cart/coupon/payment/calendar sequence; `focused` additionally validates preserved cart calculations, actual native interaction, retained drafts, pending/error/retry ownership and production screenshot privacy. `sentinels` remains an explicit CLI value rather than an implicit claim of complete interface coverage.

Original BEFORE evidence is immutable under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-06/before-01`. Each engine retained 33 PNGs and 57 source/locale checks with zero errors or attempted unexpected writes. The combined 66 PNGs contain 54 actual application states and 12 reference specimens. `before-final-provenance.json` hashes 74 artifacts and records exact source equivalence of 330 application asset/template bodies against the accepted slice05 runtime. Those green BEFORE counters establish provenance, not visual acceptance: 320px fields exceed their card insets and the inherited workspace composition remains visibly inconsistent.

The AFTER fixture intercepts only declared local catalog/calendar reads, the exact read-only article-order quote contract and explicitly enabled synthetic address search/validation/session cleanup. The bounded workflow uses the original application API/controller and holds/rejects the exact declared article-order POST entirely locally; unmatched mutations reach the abort guard. No customer, order, feedback or upstream address write is performed. Catalog prices, coupon outcomes, calendar availability and workflow rejection are controlled responses, not acceptance of server pricing or business policy.

Production privacy executes the unmodified `captureElementScreenshot` and normal clone callback on a declared synthetic recipient. The original sensitive-input pixel gate, dimensions, actual clone observations, complete raw live restoration and resource checks remain required. Fixed captions and verified catalog/volume formatter copy are positive cases; unknown catalog text, unknown discount descriptions and coupon descriptions remain strict masking negatives. Selected Birthday text and selected-option serialization are checked separately: internal unexported option values are not claimed sanitized. The calibrated postal fixture is `2468ZX`, outside all actual pseudonym postal templates, and must change after whitespace/case normalization; the first diagnostic's `1234AB` to `1234 AB` formatting-only collision is retained and is not normalized replacement evidence.

The initial three-file app checkpoint failed actual pending/coupon/caption/privacy review despite successful color/layout checks. Its failed preflight remains unchanged. Corrected Chromium1440 preflight on `ee98c6c` retained 28 PNGs and 89 successful logical checks with zero errors or unexpected writes, including original API quote/POST ownership, disabled duplicate prevention, retained pending reopen and explicit retry. Three negative-case report contexts accidentally serialized fixture text over `expected` after boolean status calculation; an independently verified one-key context nesting correction preserves the original report and all predicates. `after-preflight-02-metadata-attribution.json` records exact body reversal and the bounded limitation. Numerical success did not finalize visual acceptance: independent review identified terminal Birthday double margins and a production-capture address-wrapper margin-collapse gap, both held for the owning slice06 correction and final scoped evidence.

Actual native200% article dispatch uses the existing XTest Ctrl-plus/Ctrl-zero and OS geometry/reset proof, the focused article UI and a small unchanged shell/draft sentinel. Use `KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY=1`, slice06 and article phase `after`, without `ARTICLE_ONLY`; native mode excludes the controlled workflow/privacy sequence and retains uncropped X11 evidence. The completed scoped checkpoint below records the actual outcomes; slice10 remains in progress through the remaining implementation slices.

### Slice 06 accepted scoped checkpoint (2026-11-11)

Product source is frozen at `b02ca40bcb2b95e6493aaf824339adfedf06ff8b`. Relative to reviewed `ee98c6c`, only `styles.css` changes: eight added lines and one removed line trim terminal Birthday margins and contain the article address wrapper with `display: flow-root`. All seven other reviewed production/test bodies are exact. A single Chromium1440 counterfactual independently establishes that containment leaves every native control value, attribute, rectangle and card rectangle unchanged while restoring the production-capture Phone gap; its exact host style and complete live state restore afterward. The final bounded source run proves the 20px terminal padding plus 1px border, native 12px Phone gap, unmodified production original/pseudonymized output and unchanged strict privacy guards. No SDK or screenshot threshold changes are included.

Evidence remains outside Git under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-06`. `after-final-provenance.json` hashes eight selected reports and 185 PNGs, records all reviewed source bodies and frozen tooling, and rechecks the original 74 BEFORE artifacts with zero mismatches. `independent-review/completion-disposition.md` records a PASS for the five slice06 criteria after actual image and interaction review; there is no unresolved application finding. The initial failed preflight, earlier metadata collision and postal formatting-only diagnostic remain unchanged. This is scoped slice06 acceptance, not full interface or slice10 completion.

| Report relative to the evidence directory | Verified checks | PNGs | Scope |
| --- | ---: | ---: | --- |
| `after-preflight-02/chromium` | 89 | 28 | Actual1440 on reviewed ee98; preserved populated cart, held quote/POST, duplicate/retry and privacy outcomes under exact unchanged-body proof. |
| `final-spacing-01` | 17 | 5 | Bounded1440 on final b02; terminal Birthday inset, native/captured address gap and strict production privacy. No workflow replay. |
| `after-focused-01/chromium` | 89 | 28 | Final390 full focused scope. |
| `after-focused-01/firefox` | 178 | 56 | Final1440/390 full focused scope. |
| `after-320-01/chromium` | 42 | 11 | Final320 lightweight layout subset. |
| `after-320-01/firefox` | 42 | 11 | Final320 lightweight layout subset. |
| `native-article-01/chromium` | 83 | 25 | Actual OS200%, focused UI, small shared profile/draft sentinel and100%reset. |
| `native-article-01/firefox` | 81 | 21 | Same actual native scope; no emulation or pointer workaround required. |

Every selected report has zero required deviations, scenario errors or attempted unexpected writes. Counts include source guards, controlled local responses and reference specimens; they are not unique workflow or image-equivalence claims. Native Chromium changes1050×1093 to525×546 CSSpx; Firefox changes1440×1000 to720×500. Both record device ratio1→2, pinch scale1, stable physical width and exact100%reset. Every native frame is an uncropped1600×1200 X11 desktop. The recovered-cart-total frames show readable totals and unobscured Cancel/Submit after natural toast expiry; later keyboard-cancel frames retain the actual declared catalog-error toast and are used for focus evidence, not unobscured Submit proof.

Positive production captures preserve fixed captions, verified catalog names and the exact backend volume formatter. Three negative captures per focused viewport prove unknown title, arbitrary discount text and coupon descriptions remain masked through the original production callback. Normalized postal inequality, actual private input pixels, selected Birthday display/serialization, original API/controller preservation, raw live restoration and resource verification all pass in both engines. No screen-reader traversal, real upstream business mutation or upstream success/policy acceptance is claimed. PR144 remains draft until the remaining implementation and complete interface acceptance are finished.

### Slice 07 scoped service acceptance (2026-11-12)

Application source is frozen at `4f1f57fd3c78e3d3ed3d641fc4eea02a7e81c1b3` in [PR #151](https://github.com/bindinc/kiwi/pull/151). The [service companion](compose-smoke-theme-audit-service.mjs), [interaction/privacy checks](compose-smoke-theme-audit-service-acceptance.mjs), [finite provider probe](compose-smoke-theme-audit-service-provider.mjs) and [acknowledgement fixtures](compose-smoke-theme-audit-service-ack-fixtures.mjs) run the actual local application with synthetic customer, offer and address transport. The PHP projection generator executes the actual in-memory backend projection logic; its reviewed output supplies nine independent provisional acknowledgements. Business payloads, prepared change identifiers, customer reloads and full projected models remain checked. No database, consumer or upstream business persistence is claimed.

Evidence remains outside Git under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-12/slice-07`. `after-final-provenance.json`, SHA-256 `1ffbf02ccfa9ba74453e80e258ff4c48709af1fee1848887faafd89925c0b312`, selects 439 artifacts including 332 PNGs, records 28 application/reference/SDK/backend/test source hashes and nine tooling hashes, and proves all 114 original BEFORE artifacts unchanged. The separately retained BEFORE register is observational. Independent source and whole-image reviews accompany each scoped result; image and check counts do not imply complete interface acceptance.

| Selected report | Verified checks | Captures | Scope |
| --- | ---: | ---: | --- |
| `after-winback-notice-01/chromium` | 96 | 6 | Existing accepted/declined held and queued callbacks only |
| `after-full-firefox-01/firefox` | 620 | 79 | Desktop nine acknowledgements, provider, privacy and drafts; 390/320px representative layouts |
| `after-narrow-chromium-01/chromium` | 214 | 36 | Sixteen actual family/choice states plus two references at each of 390/320px |
| `after-narrow-complaint-firefox-01/firefox` | 59 | 6 | One 320px held rejection and identical-payload explicit retry |
| `after-narrow-complaint-chromium-01/chromium` | 59 | 6 | The same finite pending/error/retry scope in Chromium |
| `after-native-chromium-01/chromium` | 124 | 23 | Actual OS200% family/choice layout and exact 100% reset |
| `after-native-firefox-02/firefox` | 148 | 19 | Actual OS200% family/keyboard-choice layout and exact reset |

All selected reports have zero deviations, scenario errors or unexpected writes. Chromium desktop `after-preflight-04` remains a failed whole run with one incorrect processed-cancellation notice. Only its named unaffected positives transfer through `source-carry-forward-01.json`; the final-source 96-check accepted/declined supplement resolves that notice. Earlier provider, callback, hover-oracle and native setup failures remain immutable diagnostics. The full Firefox run independently exercises all nine final-source callbacks. Held controls, duplicate attempts, retained drafts, Back/provider ownership, close/reopen, queued customer reloads and explicit retry are actual controller interactions with local responses.

The minimal three-property address diagnostic separately proves exact native geometry for 33 controls and complete original/pseudonymized checkbox paint. Final-source production captures independently preserve all literal captions, replace 13 private pixel regions, change selected Birthday display and normalized postal data, and restore raw fields/attributes and the capture observer. The diagnostic's 33-control comparison is not claimed as a repeated measurement in every final browser. Native Chromium measures 1050×1093/DPR1 → 525×546/DPR2 → exact reset; Firefox measures 1440×1000/DPR1 → 720×500/DPR2 → exact reset. Native screenshots are uncropped X11 desktops.

Firefox's first native run failed because nonforced `locator.check()` reported card interception at 200%. One finite diagnostic retains the actual failed screen, DOM/protocol rectangles and hit stack: the checkbox is the first CSS hit, a real XTest pointer checks it with trusted events, and Edition → actual Tab → Space restores the raw draft. This establishes actual reachability and a native-zoom protocol-action limitation; its exact internal mapping is not measured. The reviewed helper uses actual focus and Space only for native Firefox setup, with enabled/visible/focus/checked assertions. It preserves all 100% and Chromium pointer paths and the separate natural offer Tab/Space/Arrow checks. Setup focus is not reported as natural sequential Tab for every control.

For a fresh isolated full Firefox checkpoint, choose a new durable evidence directory:

```bash
KIWI_THEME_APP_ROOT=/home/bartdeijkers/_worktrees/align-theme-service-workflows \
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_THEME_AUDIT_SLICE=7 KIWI_THEME_AUDIT_SERVICE_PHASE=after \
KIWI_THEME_AUDIT_SERVICE_ONLY=1 KIWI_THEME_AUDIT_SERVICE_SUITE=full \
KIWI_THEME_AUDIT_VIEWPORTS=1440x1000,390x1000,320x1000 \
KIWI_THEME_SERVICE_ACK_FIXTURES=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-07/source-derived-ack-fixtures-01/service-projections.json \
KIWI_SMOKE_BROWSER=firefox \
KIWI_THEME_EVIDENCE_DIR=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-12/slice-07/new-review-run \
node scripts/compose-smoke-theme-audit.mjs
```

`KIWI_THEME_AUDIT_SERVICE_SUITE=winback` selects the two existing outcome callbacks at one explicit desktop viewport. `KIWI_THEME_AUDIT_SERVICE_SUITE=complaint` selects only the existing held 422 → same-payload retry acknowledgement at one explicit 320px viewport, including visible pending/error evidence before the original toast expiry. For native mode omit `KIWI_THEME_AUDIT_SERVICE_ONLY`, set `KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY=1`, use `KIWI_THEME_AUDIT_SERVICE_SUITE=full` and an unused `KIWI_THEME_AUDIT_DISPLAY`; record measured geometry and reset in each engine. Do not repeat unrelated full matrices to close a bounded finding.

The guarded shared-address check also passes, with six component images, five synthetic searches, three closed local address sessions and zero unexpected writes:

```bash
KIWI_SMOKE_BASE_URL=https://bdc.rtvmedia.org.local:9444/kiwi/ \
KIWI_ADDRESS_PREFIXES=transfer,transfer2,restitutionTransfer \
KIWI_ADDRESS_EVIDENCE_DIR=/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-12/slice-07/new-address-review \
node scripts/compose-smoke-shared-addresses.mjs
```

This preserves the original unconditional edit unavailable/retry/Escape tail after the three selected service prefixes. It does not claim all eight address flows or upstream validation. The whole legacy customer-session smoke was not replayed; criterion mapping uses the recorded controlled A/B draft block, explicit reset and unchanged source/tests.

Two boundaries remain explicit. At 320px, the transient global error toast overlaps the lower action until natural expiry; complete error text, retained data and the settled successful retry are proven, while unobstructed error-state action access is not. The [.toast owner in slice 08](../assets/css/theme_audit-08-overlays-feedback-and-system-surfaces.md) must resolve that global presentation gate. Actual English UI expansion remains assigned to final slice 10; this checkpoint proves Dutch application flows and reviewed English source translations. Slice 10 and PR #144 remain in progress through slices 08–09 and final integrated acceptance. No merge or deployment follows from this evidence.

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
