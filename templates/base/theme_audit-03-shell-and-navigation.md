# theme_audit 03 — Shell, navigation and workspace hierarchy

Audit marker: `theme_audit`. Status: planned. Baseline: `c05973e`, 2026-11-09.

Coordination: [evaluation and slice index](../../plans/theme_audit.md), SC-206629. Implement after slices 01 and 02. This document does not authorize changing the application or deploying it.

## Finding and intended outcome

The showcase's customer workspace uses flat, aligned regions and a compact header. Current Kiwi retains separate raised cards, large gaps, repeated decorative icons and a welcome region that occupies the main work area. At 1440px, the empty contact-history card consumes a full-height right rail. At 390px, the empty history card appears before customer search and quick actions. These are observed local layouts, not merely differences in palette.

The goal is a stable working frame: active customer/session context remains clear, the current task receives the available space, and supporting history remains accessible without preceding the task on narrow screens. The showcase's documentation header and miniature demo brand are not replacements for Kiwi's actual branding or operational controls.

Populated search also exposes a functional layout defect: the 1440px viewport produces a 1542px document, with the right rail extending 102px outside the viewport. Measured grid tracks are 320/770/380px; the results table's intrinsic width expands the center track. Correct this together with slice 04: constrain the workspace and contain any intentional table scrolling locally.

## Source and reference

- [Base workspace](index.html.twig): header, customer work-session bar, profile controls, search/quick-action rail, center panel, history and outbox placement.
- [Shared CSS](../../assets/css/styles.css): `.header`, `.header-content`, `.header-top`, `.header-right`, `.main-container`, `.left-panel`, `.center-panel`, `.right-panel`, `.card`, `.welcome-message`, profile/status-menu rules and their media queries.
- [Shell behavior](../../assets/js/app/slices/app-shell-slice.js) and session/profile modules: inspect consumers before moving any container or control.
- [Showcase](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview): `.preview-topbar`, `.preview-body`, `.preview-sidebar` and the record/workspace relationship. Use its geometry and hierarchy, adapted to the application's actual number of regions.

Local evidence: `/tmp/kiwi-styling-evaluation-2026-11-09/1440-shell.png`, `390-shell.png`, `1440-profile.png` and `1440-reference-customer.png`. The local preview represents source at the audited commit, not a verified production deployment.

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
