# theme_audit 03 — Shell, navigation and workspace hierarchy

Audit marker: `theme_audit`. Status: accepted for slice scope; implementation, rendered comparison and independent completion review passed. Final documentation CI is tracked in the PR. Before-state captures use the frozen accepted slice 02 runtime. Audit baseline: `c05973e`, 2026-11-09; implementation baseline: merged slice 02 at `851dc77`, 2026-11-10.

Coordination: [evaluation and slice index](../../plans/theme_audit.md), SC-206629. Implement after slices 01 and 02. Implementation is authorized by the ten-slice task; merge and deployment require separate explicit authorization.

## Implementation record

- Branch: `codex/align-theme-shell-and-navigation`.
- Worktree: `/home/bartdeijkers/_worktrees/align-theme-shell-and-navigation`.
- Base: `851dc77a11667975311f533df8c1294a91513e0e`, the user-merged [slice 02 / PR #145](https://github.com/bindinc/kiwi/pull/145) in `codex/plan-kiwi-styleguide-alignment-slices`. At that base, product files are identical to accepted source `d39ed64`; the corrected privacy smoke helper is included through `14eb8cc`.
- PR: [#146](https://github.com/bindinc/kiwi/pull/146); one Unreleased changelog entry, SC-206629.
- Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-03/`; actual baseline runtime, reference, controlled renderer fixtures and after-state evidence must remain distinguished.
- Ownership: one application implementation owner; parent owns audit/index/changelog/PR. Independent source review and slice 10 browser/native validation run without overlapping application edits.
- Current source correction: the actual workspace is `.main-content`. Existing Twig DOM order is search/actions → main work → history/outbox; remove the narrow CSS negative ordering rather than unnecessarily moving those regions.

### Delivered behavior

- A compact 64px ordinary desktop header separates brand, session/customer context and utilities. Reset stays at the left of the session group; active identity and person/source metadata remain adjacent. Wrapping accommodates real space/content needs, and short-height mode stops the header obstructing work.
- The workspace uses constrained 240px / flexible / 300px desktop regions, then two-column and single-column layouts. Search precedes optional history on narrow screens. Postcode/house-number controls stay inside their own card; table overflow stays inside its labeled keyboard-usable group.
- Profile/status controls retain permissions and native semantics, with a circular profile trigger, inverse header focus and readable light-menu focus. Actual viewport/trigger bounds constrain the menu; resize/scroll listeners are removed on close.
- A small ResizeObserver-based helper measures the real sticky header, including operational bars, for result scroll clearance. Nonsticky short-height mode contributes no obstruction. Profile Escape restores trigger focus and preserves the current draft; debug retains its existing first-Escape priority.
- The existing logo, identity/source mapping, customer/session actions, role gates, call-state hooks, consent and privacy annotations remain intact. Customer data composition and operational presentation retain their respective slice 04/09 owners.

### Acceptance register

Application source `a467d3366092772cd09e3e842554459f1b89b2c0` is committed and pushed. Independent review covers all 13 changed app/test files, including the dynamic header scroll-inset observer, menu geometry/focus/resize lifecycle and preserved business/identity/privacy hooks. All 38 frontend test files, palette checks, guardrails, whitespace and Compose Twig syntax pass. [Application CI passed](https://github.com/bindinc/kiwi/actions/runs/42823538418), including PHPUnit, all frontend files and production-image/runtime checks. Both existing privacy suites also pass at unchanged thresholds on this application source: Firefox native/original 0%, 0%, 0.511%, outside-sensitive 0.570%; Chromium 1.925%, 1.483%, 1.518%, outside-sensitive 0%. Logs are `slice-03/a467d33/privacy-{browser}/stdout.log`. Full shell acceptance is recorded in the ledger below; these integration results retain their own exact source boundary.

The narrow follow-up `ffc34a8895f86637f426f8bbb3202111a58c85f9` changes only three profile-trigger declarations: a circular 40px target, transparent resting border and restrained inverse hover. It corrects the user-reported permanent square around the avatar while preserving the native control, status, permissions and inverse keyboard focus. Focused actual Chromium/Firefox validation each passes 64 checks with 20 captures, zero deviations/runtime errors/API write attempts, and matching five served/source stylesheet bodies (`slice-03/profile-delta-attempt-02/{browser}/report.json`). Both default/native crops and hover/keyboard images were independently inspected. The first probe's capture-kind bookkeeping failure is preserved separately, not counted as a pass.

The existing integration results below retain application source `a467d33`; they are not relabeled as `ffc34a8`. Independent review accepts this bounded supplement because the profile-only geometry remains 40px and the privacy targets are the customer header/custom customer crop and isolated fidelity fixture. No capture selector, masking, business handler or relevant target geometry changes. Full shell AFTER/native validation runs on the current frozen source, as recorded below.

The source-verified BEFORE matrix is versioned at slice 10 checkpoint `b3bfbb6` in draft PR #144: both engines captured 144 images (72 actual local flow, 60 explicitly labeled DOM placement fixtures, 12 reference) and 132 locale/provenance checks at six viewports in NL/EN. Zero runtime errors or attempted API writes does not mean observed layout defects passed. `slice-03/before-final-provenance.json` and `before-visual-review.md` retain all 288 PNG hashes and exact accepted source `3674e3c` ↔ merged base `851dc77` application equivalence.

Root Firefox targeted diagnostics on the frozen final app are retained in `slice-03/root-firstlook-attempt-02/`: 96 images, 88 locale/source checks, no runtime errors or attempted API writes. Independent visual review confirms the actual 1440/2048 compact grouping and corrected search fields. Sixteen paired comparisons across four viewports, NL/EN and active/pending fixture states show exactly 0px reset x/y movement against the corresponding empty state; `reset-paired-bound-check.json` is separate from the observational counts. The ordinary desktop header is 64px in empty and active states. This targeted proof supplements the required full matrix, native zoom, real roles, draft/guard and unchanged-threshold privacy/theme gates recorded separately.

The BEFORE captures used the unchanged slice 02 worktree/runtime at `3674e3c`, whose product source is identical to merge `851dc77`. Isolated slice 03 edits did not alter that baseline. After both captures completed, project `kiwi-theme-audit-02` was stopped without removing containers, volumes or worktrees; the independent `kiwi-theme-audit-03` gateway now serves port 9444. Completed shell gates compare actual identity/source/session context and populated results at 1440, 1024, 768, 390 and 320px, plus 390×320 and genuine native 200% zoom, in Chromium and Firefox. Synthetic long-label and operational placement fixtures remain explicitly labeled; no whole-interface acceptance is claimed by this slice.

### Full rendered acceptance ledger — 2026-11-10

The frozen current application is `ab37d44dc6f3656bb32326036530e8de50f4bdf9`: product implementation `a467d33`, the three-declaration profile correction `ffc34a8`, and documentation-only follow-ups. Every report records five served/source stylesheet bodies and seven changed JavaScript bodies; known asset-import rewrites are normalized explicitly, with positive and negative source-guard cases. The standalone showcase remains SHA-256 `478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4`.

All paths below are relative to the durable slice 03 evidence directory. Counts describe recorded assertions and images; independent visual comparison is a separate gate.

| Gate | Chromium | Firefox | Evidence |
| --- | --- | --- | --- |
| Full shell, NL/EN, 2048/1440/1024/768/390/320 and 390×320 | 13,014 checks / 266 images | 13,028 checks / 266 images | `after-matrix-attempt-03/chromium/report.json`, `after-matrix-attempt-04/firefox/report.json` |
| Seventeen responsive boundaries, including 539/540/541px heights | 11,350 / 136 | 11,350 / 136 | `after-boundaries-attempt-01/{browser}/report.json` |
| Actual fallback OIDC admin/view roles, profile keyboard and logout semantics | 342 / 16 | 342 / 16 | `after-roles-attempt-01/{browser}/report.json` |
| Retained article draft, profile Escape/focus return, debug-first Escape and search shortcut | 3,758 / 84 | 3,758 / 84 | `after-interactions-attempt-01/{browser}/report.json` |
| Focused short-height real-wheel supplement | 1,866 / 38 | 1,866 / 38 | `after-preflight-attempt-05/{browser}/report.json` |
| Existing integrated theme checks on `a467d33` | 106 / 27 | 106 / 27 | `a467d33/theme-{browser}/{browser}-after-report.json` |

These passing reports record zero deviations, deferred/unverified assertions, runtime errors or attempted business API writes. Actual local empty/search/results/customer/profile/outbox flows, real login roles and keyboard paths are distinguished from explicitly labeled, restored long-content and operational placement fixtures. No customer edit, order, consent, call or outbox mutation was submitted.

`after-independent-visual-review.json` verifies report/image hashes and the same frozen application bodies, inspects representative actual desktop/narrow/short and long-profile images against the showcase, and records no unresolved slice 03 visual finding. Natural result navigation is checked below the measured sticky-header inset; keyboard horizontal movement remains within the named result-table group. The reset anchor, own-card search-field bounds, full identity/source context and circular profile affordance have explicit checks rather than being inferred from page width or color tests.

The retained failed harness attempts are not passed acceptance. Independently reviewed corrections address two-frame ResizeObserver fixture readiness, a long-label fixture that originally did not grow, real pointer hit-testing outside the menu, asynchronous wheel observation and bounded repeated real Firefox wheel input. Actual application source did not change for those corrections. Report-local runner/module hashes retain the exact executed revisions: Chromium full matrix uses helper `5f910a6e`; Firefox full matrix and both short supplements use `eb4e662c`. Native disclosure checks read the actual open state before closing/reopening with Enter. No synthetic scroll assignment, forced focus, relaxed geometry, capture mask or privacy threshold substitutes for the relevant interaction.

Native Firefox 200% zoom and return to 100% pass 1,381 checks / 20 images at `after-native-attempt-02/firefox/report.json`; Chromium passes 1,383 / 24 at `after-native-attempt-03/chromium/report.json`. Both use real OS zoom input and uncropped X11 captures with actual viewport/DPR metadata, not a simulated device scale. Chromium runner `c8ca0b4b` dismisses browser translation UI with real Escape and observes the browser zoom bubble disappear through bounded actual X11 frames before capture. The full uncropped before/clear/after frames remain available; no application control or style is hidden. Earlier structurally passing but browser-obscured native captures are retained and excluded from final visual acceptance. The Chromium report records only `M templates/base/theme_audit-03-shell-and-navigation.md` as a dirty tracked path; all five product stylesheets and seven behavior bodies match frozen source `ab37d44`. Firefox records no dirty tracked paths. Root and independent review inspected the final unobscured shell, selected session and final keyboard-action images. Final documentation/CI and PR readiness remain separate administrative gates.

### Completion decision

`completion-independent-audit.json` records PASS for all slice 03 criteria, the thirteen app/test-file source review, actual/reference visual comparison, keyboard/role/draft behavior, native zoom and the explicitly bounded integration evidence. No unresolved slice 03 finding remains. Historical pending-gate wording has been reconciled with the completed ledger. Final evidence inventory `after-final-provenance.json` records twelve passed reports and 1,124 PNG paths/hashes, including the exact report-local runner boundaries; images stay outside Git. Application CI at `ab37d44` passed; the final documentation commit's CI and review-ready transition are recorded in PR #146. No merge, cleanup or deployment is performed.

### Rendered review findings during implementation — 2026-11-10

Two user-supplied Firefox screenshots rejected issues that source review alone did not establish. The narrowed 240px search rail allowed the native postcode/house-number row to extend outside its own card into the work area. A page-width-only assertion would miss this cross-region overflow. Slice 03 owns this regression: use constrained field tracks and native input/group minimum widths, then prove each label, field and action remains inside the actual card content bounds at 1440 and 2048 CSS pixels as well as narrow sizes. Screenshot physical pixels and viewport/DPR must be recorded separately.

The active-session header also became unnecessarily tall because the first implementation always allocated a second full-width context row. The requested direction is now one compact desktop row when real content fits, preserving customer name, person reference, source/mandant, reset and system controls. Additional wrapping is reserved for actual space or long-content needs. The earlier full-width-strip direction is superseded. These screenshots remain conversation evidence; no browser chrome or customer image is committed to Git.

Further user review rejected the scattered active-session identity and the reset action moving between empty and selected states. The current direction is three deliberate groups: brand, compact customer/session context and system utilities. Customer caption/name and adjacent person/source metadata form one readable cluster. `Nieuwe sessie` has a fixed left anchor in the session group, with active identity immediately to its right; empty, active and pending states must not reposition the action. Root Firefox diagnostics on the preceding revision measured a 64px ordinary desktop header but reset x positions 1365.417→592.483 at 2048px and 881.417→468.483 at 1440px. This demonstrates a real state-transition defect despite a compact height. The paired-state correction was an acceptance gate; the completed ledger and sixteen exact-position pairs above establish its resolution.

Diagnostic evidence: `slice-03/root-firstlook-attempt-01/root-visual-review.md` under the durable evidence root, with its report hash and representative actual Firefox images. Its 88 counts are locale/source checks, not geometry acceptance; the then-pending reset correction was not hidden by an observational successful exit and is resolved by the later paired-state evidence.

Independent review additionally requires the natural search navigation outcome: existing `scrollIntoView({block: 'start'})` must expose the result heading/sort/actions below the measured sticky header. Canonical top-of-page captures do not prove anchoring. Short-screen nonsticky mode must contribute zero obstruction. Targeted Firefox samples now show the corrected fields, 64px ordinary desktop header and stable reset anchor. The corresponding full Firefox/Chromium geometry, natural-scroll, keyboard and visual gates are satisfied by the completed ledger above.

Subsequent user feedback on gray row actions, uneven table separators and missing filter-hover horizontal padding is explicitly assigned to the [slice 04 review backlog](../../assets/js/app/slices/theme_audit-04-customer-and-data-views.md). Those customer/search presentation findings remain open and are not counted as passed by shell acceptance.

## Original audit findings and intended outcome

The showcase's customer workspace uses flat, aligned regions and a compact header. The original audited baseline retained separate raised cards, large gaps, repeated decorative icons and a welcome region that occupied the main work area. At 1440px, the empty contact-history card consumes a full-height right rail. At 390px, the empty history card appears before customer search and quick actions. These are observed local layouts, not merely differences in palette.

The goal is a stable working frame: active customer/session context remains clear, the current task receives the available space, and supporting history remains accessible without preceding the task on narrow screens. The showcase's documentation header and miniature demo brand are not replacements for Kiwi's actual branding or operational controls.

Populated search also exposes a functional layout defect: the 1440px viewport produces a 1542px document, with the right rail extending 102px outside the viewport. Measured grid tracks are 320/770/380px; the results table's intrinsic width expands the center track. Correct this together with slice 04: constrain the workspace and contain any intentional table scrolling locally.

## Source and reference

- [Base workspace](index.html.twig): header, customer work-session bar, profile controls, search/quick-action rail, center panel, history and outbox placement.
- [Shared CSS](../../assets/css/styles.css): `.header`, `.header-content`, `.header-top`, `.header-right`, `.main-content`, `.left-panel`, `.center-panel`, `.right-panel`, `.card`, `.welcome-message`, profile/status-menu rules and their media queries.
- [Shell behavior](../../assets/js/app/slices/app-shell-slice.js) and session/profile modules: inspect consumers before moving any container or control.
- [Showcase](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview): `.preview-topbar`, `.preview-body`, `.preview-sidebar` and the record/workspace relationship. Use its geometry and hierarchy, adapted to the application's actual number of regions.

Local evidence: `/tmp/kiwi-styling-evaluation-2026-11-09/1440-shell.png`, `390-shell.png`, `1440-profile.png` and `1440-reference-customer.png`. The local preview represented source at the audited commit, not a verified production deployment. These original temporary images were lost after the environment restart; they remain a historical record. Current accessible baseline/reference evidence and exact source boundaries are registered above.

## Bounded implementation

1. Apply slice 01's flat surface, inset and type roles to the shared frame. Remove decorative card elevation and excessive empty-state framing; do not collapse meaningful customer/session regions.
2. Align the search, active work and supporting history/outbox regions to deliberate desktop guides. Keep data comparison space broad enough for the supported workflows.
3. Define a narrow-screen order that puts active task/context and useful search/actions before optional or empty history. Prefer disclosure for secondary detail over silently hiding it.
4. Align the profile/status menu, header actions and session-context bar with shared control geometry. Use one coherent icon treatment; preserve the existing logo and useful labels. Remove ornamental emoji where they add noise rather than recognition.
5. Specify menu open, hover, focus, selected, unavailable and long-content states. Check header overflow, scroll anchoring and overlays against the actual sticky header.

Keep search/result content changes in slice 04 and operational call/history/outbox presentation in slice 09. This slice owns placement and framing, not those regions' business logic. Coordinate with slice 08 on layering and menu/dialog focus.

## Invariants and exclusions

Preserve IDs, actions, permissions, source/mandant identity, selected-customer context, session reset/discard semantics, call-state indicators, role-specific controls and debug gating. Keep draft retention and the user's ability to leave a task. Do not replace the app with the showcase's simplified sidebar or add a navigation framework, theme picker, backend endpoint or unrelated product feature.

Because this slice touches `styles.css` and `index.html.twig`, integrate after 01/02 and serialize overlapping edits with 04–09. Use its own implementation PR/worktree and one changelog entry.

## Acceptance and verification

- Desktop, intermediate and narrow layouts retain active customer identity and clear primary work; empty history never becomes the first meaningful narrow-screen region.
- Populated results cannot widen the entire page or push the history/outbox rail outside the viewport. Necessary data-table scrolling is confined to an explicit, keyboard-usable region.
- The header and menus support long agent/customer labels, translated text and 200% zoom without clipping or covering actionable fields.
- Branding is preserved. Profile, status, settings, session and role-specific actions remain available and keyboard operable, with correct focus on light menus inside the dark header.
- Default/hover/focus/selected treatments derive from the shared contract; routine frame elements do not lift or gain ornamental shadows.
- Before/after screenshots compare equivalent empty, selected-customer, expanded-menu and active-session states at 1440, 1024, 768 and 390px; include 320px and short-height stress checks where necessary.
- Use Docker Compose and slice 10's matrix. Run relevant shell/session tests and guardrails if their files change. Do not present a synthetic header fixture as proof of the complete working shell.

Done means source, rendered comparison and preserved interaction evidence agree. An attractive empty screenshot alone does not complete this slice.
