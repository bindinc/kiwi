# theme_audit 03 — Shell, navigation and workspace hierarchy

Audit marker: `theme_audit`. Status: implemented and source-reviewed; full rendered/interaction acceptance in progress. Before-state captures use the frozen accepted slice 02 runtime. Audit baseline: `c05973e`, 2026-11-09; implementation baseline: merged slice 02 at `851dc77`, 2026-11-10.

Coordination: [evaluation and slice index](../../plans/theme_audit.md), SC-206629. Implement after slices 01 and 02. Implementation is authorized by the ten-slice task; merge and deployment require separate explicit authorization.

## Implementation record

- Branch: `codex/align-theme-shell-and-navigation`.
- Worktree: `/home/bartdeijkers/_worktrees/align-theme-shell-and-navigation`.
- Base: `851dc77a11667975311f533df8c1294a91513e0e`, the user-merged [slice 02 / PR #145](https://github.com/bindinc/kiwi/pull/145) in `codex/plan-kiwi-styleguide-alignment-slices`. At that base, product files are identical to accepted source `d39ed64`; the corrected privacy smoke helper is included through `14eb8cc`.
- PR: [#146](https://github.com/bindinc/kiwi/pull/146), draft; one Unreleased changelog entry, SC-206629.
- Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-03/`; actual baseline runtime, reference, controlled renderer fixtures and after-state evidence must remain distinguished.
- Ownership: one application implementation owner; parent owns audit/index/changelog/PR. Independent source review and slice 10 browser/native validation run without overlapping application edits.
- Current source correction: the actual workspace is `.main-content`. Existing Twig DOM order is search/actions → main work → history/outbox; remove the narrow CSS negative ordering rather than unnecessarily moving those regions.

### Acceptance register

Application source `a467d3366092772cd09e3e842554459f1b89b2c0` is committed and pushed. Independent review covers all 13 changed app/test files, including the dynamic header scroll-inset observer, menu geometry/focus/resize lifecycle and preserved business/identity/privacy hooks. All 38 frontend test files, palette checks, guardrails, whitespace and Compose Twig syntax pass. [Application CI passed](https://github.com/bindinc/kiwi/actions/runs/42823538418), including PHPUnit, all frontend files and production-image/runtime checks. Both existing privacy suites also pass at unchanged thresholds on this application source: Firefox native/original 0%, 0%, 0.511%, outside-sensitive 0.570%; Chromium 1.925%, 1.483%, 1.518%, outside-sensitive 0%. Logs are `slice-03/a467d33/privacy-{browser}/stdout.log`. Full AFTER/native/roles/draft/theme acceptance remains separate; this is not completed slice acceptance.

The narrow follow-up `ffc34a8895f86637f426f8bbb3202111a58c85f9` changes only three profile-trigger declarations: a circular 40px target, transparent resting border and restrained inverse hover. It corrects the user-reported permanent square around the avatar while preserving the native control, status, permissions and inverse keyboard focus. Focused actual Chromium/Firefox validation each passes 64 checks with 20 captures, zero deviations/runtime errors/API write attempts, and matching five served/source stylesheet bodies (`slice-03/profile-delta-attempt-02/{browser}/report.json`). Both default/native crops and hover/keyboard images were independently inspected. The first probe's capture-kind bookkeeping failure is preserved separately, not counted as a pass.

The existing integration results below retain application source `a467d33`; they are not relabeled as `ffc34a8`. Independent review accepts this bounded supplement because the profile-only geometry remains 40px and the privacy targets are the customer header/custom customer crop and isolated fidelity fixture. No capture selector, masking, business handler or relevant target geometry changes. Full shell AFTER/native validation still runs on the current frozen source.

The source-verified BEFORE matrix is versioned at slice 10 checkpoint `b3bfbb6` in draft PR #144: both engines captured 144 images (72 actual local flow, 60 explicitly labeled DOM placement fixtures, 12 reference) and 132 locale/provenance checks at six viewports in NL/EN. Zero runtime errors or attempted API writes does not mean observed layout defects passed. `slice-03/before-final-provenance.json` and `before-visual-review.md` retain all 288 PNG hashes and exact accepted source `3674e3c` ↔ merged base `851dc77` application equivalence.

Root Firefox targeted diagnostics on the frozen final app are retained in `slice-03/root-firstlook-attempt-02/`: 96 images, 88 locale/source checks, no runtime errors or attempted API writes. Independent visual review confirms the actual 1440/2048 compact grouping and corrected search fields. Sixteen paired comparisons across four viewports, NL/EN and active/pending fixture states show exactly 0px reset x/y movement against the corresponding empty state; `reset-paired-bound-check.json` is separate from the observational counts. The ordinary desktop header is 64px in empty and active states. This targeted proof does not replace the full required AFTER matrix, actual native zoom, real role rendering, draft/guard behavior or unchanged-threshold privacy/theme integration.

The BEFORE captures used the unchanged slice 02 worktree/runtime at `3674e3c`, whose product source is identical to merge `851dc77`. Isolated slice 03 edits did not alter that baseline. After both captures completed, project `kiwi-theme-audit-02` was stopped without removing containers, volumes or worktrees; the independent `kiwi-theme-audit-03` gateway now serves port 9444. Remaining gates: Compare actual identity/source/session context and populated results at 1440, 1024, 768, 390 and 320px, plus 390×320 and genuine native 200% zoom, in Chromium and Firefox. Preserve precise scope and source/served hashes, including synthetic long-label and operational placement fixtures where live states cannot be exercised without mutation. No whole-interface acceptance is claimed by this slice.

### Rendered review findings during implementation — 2026-11-10

Two user-supplied Firefox screenshots rejected issues that source review alone did not establish. The narrowed 240px search rail allowed the native postcode/house-number row to extend outside its own card into the work area. A page-width-only assertion would miss this cross-region overflow. Slice 03 owns this regression: use constrained field tracks and native input/group minimum widths, then prove each label, field and action remains inside the actual card content bounds at 1440 and 2048 CSS pixels as well as narrow sizes. Screenshot physical pixels and viewport/DPR must be recorded separately.

The active-session header also became unnecessarily tall because the first implementation always allocated a second full-width context row. The requested direction is now one compact desktop row when real content fits, preserving customer name, person reference, source/mandant, reset and system controls. Additional wrapping is reserved for actual space or long-content needs. The earlier full-width-strip direction is superseded. These screenshots remain conversation evidence; no browser chrome or customer image is committed to Git.

Further user review rejected the scattered active-session identity and the reset action moving between empty and selected states. The current direction is three deliberate groups: brand, compact customer/session context and system utilities. Customer caption/name and adjacent person/source metadata form one readable cluster. `Nieuwe sessie` has a fixed left anchor in the session group, with active identity immediately to its right; empty, active and pending states must not reposition the action. Root Firefox diagnostics on the preceding revision measured a 64px ordinary desktop header but reset x positions 1365.417→592.483 at 2048px and 881.417→468.483 at 1440px. This demonstrates a real state-transition defect despite a compact height. The paired-state correction remains an acceptance gate.

Diagnostic evidence: `slice-03/root-firstlook-attempt-01/root-visual-review.md` under the durable evidence root, with its report hash and representative actual Firefox images. Its 88 counts are locale/source checks, not geometry acceptance; the pending reset correction is not hidden by an observational successful exit.

Independent review additionally requires the natural search navigation outcome: existing `scrollIntoView({block: 'start'})` must expose the result heading/sort/actions below the measured sticky header. Canonical top-of-page captures do not prove anchoring. Short-screen nonsticky mode must contribute zero obstruction. Targeted Firefox samples now show the corrected fields, 64px ordinary desktop header and stable reset anchor. The corresponding full Firefox/Chromium geometry, natural-scroll, keyboard and visual gates remain required before completion.

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
