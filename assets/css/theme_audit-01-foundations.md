# theme_audit 01 — Shared visual foundations

Status: planned implementation slice; this document changes no application behavior. Audit date: 2026-11-09. Baseline: `c05973e` / merged PR #130. Coordination: [theme_audit index](../../plans/theme_audit.md), SC-206629.

## Problem and reference contract

The application adopted the palette but retained much of its previous visual system. Matching eight hex values does not reproduce the reviewed design's density, hierarchy, surfaces, typography, or interaction treatment.

Use the actual repository [showcase](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview), especially its `.preview-shell`, customer workflow, subscription workflow, and [component specimens](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#components), as the visual reference. Its location is `plans/`, not `docs/`. The [showcase review](../../plans/kiwi-light-and-shadow-theme-palette-review.md) explains the intended calm, precise, warm presentation and the removal of decorative framing.

The earlier [palette plan](../../plans/kiwi-light-and-shadow-theme-palette.md#boundaries) excluded typography, layout, and animation changes. That explains the mismatch with the more developed showcase; it must not be interpreted as evidence that the complete visual design was already implemented. This follow-up defines the broader alignment contract without changing domain workflows.

| Foundation | Reference evidence | Current application evidence | Required direction |
| --- | --- | --- | --- |
| Spacing | Showcase `:root`: 4/8/12/16/20/24/32/48px scale; 20px panel inset, 16px workspace inset | `styles.css` mixes local rem and pixel values; `.card` uses 24px, forms and companion components use independent values | Introduce a small shared spacing scale and explicit component insets; migrate deliberately rather than replacing every number |
| Control dimensions | Showcase `--control-height: 40px`; shared field/action geometry | `.btn`, `.form-control`, onepager, article, and specialized inputs have independently calculated heights | Establish the common 40px minimum; allow wrapping text and explicitly documented compact variants |
| Corners | Workflow panels, fields, and secondary actions use 0px corners; generic specimens allow a restrained 4px | `styles.css :root` defines 6/8/12px; `.card`, `.btn`, menus and article cards inherit them | Define flat workflow surfaces and a small consistent corner family; keep circles for actual avatars and native radios |
| Elevation and motion | `.preview-shell`, `.customer-card`, `.subscription-form-panel`: no shadow; no hover lift | `.card`, `.header`, `.article-card:hover`, primary/call actions retain shadows, translation or scaling; several rules use `transition: all` | Use separators for ordinary work areas; reserve modest elevation for real overlays. Remove decorative movement and respect reduced motion |
| Surface recipes | `.preview-shell` defines tinted data, selection, information, attention, and workflow surfaces | Large `.info-box` surfaces use raw Baltic Sea; table hover and other selections use raw Veiled Vista | Express the showcase's tint recipes as semantic tokens, distinguish them from source swatches and operational status colors |
| Typography | System font, 15px workflow body, 13px labels/metadata, 22px main record/form titles; controlled 400/600/700 weights | Shared `.card h2/h3`, local form headings, uppercase table headers and component-specific sizes compete | Define body/label/title/metadata roles with sufficient contrast; scope headings so generic card rules cannot override component intent |

Reference locations at the audited revision: showcase lines 10–69 (`:root`), 433–466 (`.preview-shell`), 542–731 (customer workflow), 733–799 (buttons), and 891–1100 (subscription layout/fields). Application entry points: [styles.css](styles.css), particularly `:root`, `.header`, `.card`, `.btn`, `.results-table`, `.info-box`; [article-search.css](article-search.css) `.article-card`; [session-outbox.css](session-outbox.css), which already uses flatter 4px/no-shadow surfaces. The approved [delivery picker](delivery-date-picker.css) also already has a more restrained treatment and must not regress.

## Implementation scope

1. Define the shared semantic spacing, typography, surface, border, corner, control-size, and elevation roles in `styles.css`. Keep the exact eight canonical palette declarations unchanged.
2. Establish a documented distinction between decorative separators, required control boundaries, focused controls, selected records, information, and operational success/warning/danger.
3. Migrate the shared shell/card/type primitives to these roles. Prepare explicit component exceptions for overlay elevation and required operational indicators. Feature-specific composition belongs to subsequent slices.
4. Remove conflicting duplicate declarations in touched primitives rather than stacking another override layer at the end of the stylesheet.
5. Update the palette contract and focused frontend assertions so they test the revised roles, not only canonical hex values. Existing theme smoke assertions that expect filled Hematite secondary buttons must be revised with slice 02, not accepted as the visual source of truth.

Candidate files: `assets/css/styles.css`; foundation consumers in `assets/css/article-search.css`, `assets/css/session-outbox.css`, `assets/css/contextual-feedback.css`, and `assets/css/delivery-date-picker.css`; `tests/frontend/theme-palette.test.mjs`; `scripts/compose-smoke-theme.mjs`; the palette plan where its contract needs reconciliation. Keep the historical showcase review intact.

## Dependencies and boundaries

This is the first implementation slice. Each implementation slice requires its own PR, branch, and dedicated worktree. **Serialize all edits to shared `styles.css`: finish and integrate this slice before another slice changes the same foundation rules.** Read-only reviews can run in parallel. Slice 02 consumes these tokens and owns native control/action rules; feature slices own their layouts.

Do not copy showcase navigation, decorative brand demonstrations, fictional records, or simulated workflows into production. Preserve the existing Bindinc logo, real customer context, rights, statuses, API contracts, submission behavior, draft retention, validation, OIDC, privacy masks/annotations, and operational call meanings. No dark theme, theme picker, dependency upgrade, backend change, deployment, or merge is implied by this planning document.

## Acceptance and validation

- Shared foundation roles have one canonical definition and explain each intentional exception. No raw Pantone value is copied into component selectors.
- Side-by-side rendered comparisons use the showcase's **workflow** examples, matching viewport, locale and comparable content. Palette swatches alone are insufficient evidence.
- Ordinary panels are flat, spacing follows the declared scale, and heading/label/control roles remain consistent across shell, search, customer detail, forms, article tools, menus, outbox, feedback, and static account pages.
- Inspect default, hover, focus, selected, disabled, read-only, loading, empty, error, success and warning states. Test Chromium and Firefox at 1440px, 390px and 320px, plus a short viewport and 200% zoom. Check overflow, long Dutch/English text, and reduced-motion behavior.
- Recalculate contrast on the final **composited** surfaces: normal text at least 4.5:1; required boundaries/icons and focus at least 3:1. Include muted descendants and hover/selected surfaces, not only token pairs.
- Run `make js-test`, `make guardrail`, and `git diff --check`. Run Compose theme and feedback-privacy smokes after foundation changes; keep their privacy thresholds intact. Run additional suites when the touched implementation requires them.

Done means a reviewable PR contains one Unreleased changelog entry, the finalized contract, focused checks and before/after browser evidence across the shared surfaces. Passing token tests alone is not completion; merge, deployment and user acceptance remain separate stages.

## Verified audit evidence

Source review and isolated Chromium/Firefox specimen rendering were completed on 2026-11-09. The specimen used current application CSS without modifying it. It confirmed 8px button corners, filled secondary actions, and browser-dependent native control geometry. Live Firefox on the local Compose app additionally confirmed the control findings recorded in [slice 02](theme_audit-02-controls-and-actions.md).

Local evidence: `/tmp/kiwi-style-audit-native-controls.png`, `/tmp/kiwi-style-audit-native-controls-firefox.png`, and `/tmp/kiwi-styling-evaluation-2026-11-09/firefox/control-measurements.json`. These are local audit artifacts, not repository assets or proof of a full accessibility certification. This planning slice has not implemented or validated the proposed foundation changes.
