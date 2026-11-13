# theme_audit — Unify interface icons

Status: preparation only. The user requested this refinement on 2026-11-13, using the existing header icons as the visual reference. No icon implementation or rendered acceptance is claimed.

Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629). Parent: [theme_audit plan](../../../plans/theme_audit.md).

Worktree: `/home/bartdeijkers/_worktrees/unify-kiwi-interface-icons`.
Branch: `codex/unify-kiwi-interface-icons`.
Initial base: `codex/align-theme-operational-states` at `31056b4e4d7eae9010defc2e8b8c0a9e7d0ffe5c`.

Finish slice09 and adopt its accepted source before implementing this refinement. Keep application edits sequential. Complete the icon refinement before final slice10 integration so the final whole-interface review includes the approved icon language. The additional PR retains one Unreleased changelog entry and does not authorize merging, deployment or worktree cleanup.

## Approved direction

Use the header's restrained line icons: inline SVG, a 24-unit viewBox, approximately 1.75-unit strokes, round line caps/joins and `currentColor`. Use the established control and spacing tokens. Align icons with their labels without adding decorative tiles or changing action hierarchy.

Keep visible labels, accessible names, state meaning, permissions and click/keyboard behavior. Decorative icons must not duplicate spoken labels. Customer logos, avatars, brand identity and native browser controls retain their existing roles. Recording and presence retain clear status words and their established semantic indications.

Keep icon markup separate from translatable text. Use self-contained inline SVG that remains intact in privacy screenshots. Preserve every privacy annotation, opaque/private boundary and the original screenshot SDK and fidelity criteria.

## Initial source orientation

The initial source scan covers tracked JavaScript, Twig and CSS at the base above. It finds graphical Unicode symbols in 21 files, including translations; this is an inventory, not a count of confirmed defects. Classify ordinary punctuation, navigation arrows, status conventions and favicon/brand assets separately before replacing a symbol.

| Area | Source to inspect | Required outcome |
| --- | --- | --- |
| Shared page and controls | `templates/base/index.html.twig`, `assets/js/app/legacy-app-state.js` | Consistent heading, action, disclosure and state icons, with preserved labels and control targets. |
| Calls and history | `call-agent-runtime.js`, `slices/call-session-slice.js`, `slices/contact-history-slice.js` | Quiet phone, hold, recording, timing and event icons with unchanged state transitions and event content. |
| Customer search and details | `slices/customer-search-slice.js`, `slices/customer-detail-slice.js`, `customer-editor.js` | Cohesive search, view/edit and close icons while preserving exact customer/record identity and drafts. |
| Article, ordering and service flows | `slices/article-search-slice.js`, `slices/order.js`, `slices/werfsleutel.js`, `slices/winback-slice.js` | Shared catalogue, cart, price, edit/delete and service icon grammar without changing pricing or workflow rules. |
| Feedback and capture | `contextual-feedback/dialog.js`, `settings-modal.js`, `element-picker.js`, `index.js` | Consistent close, capture, selection and settings affordances; screenshot masking, fidelity and lifecycle remain correct. |
| Localization | `assets/js/i18n/nl.js`, `en.js` | Text-only translated labels alongside decorative SVG; actual language switching preserves dynamic state. |
| Access and session pages | `templates/base.html.twig`, `templates/base/access_denied.html.twig`, `logged_out.html.twig` | Deliberate access/session illustrations and existing identity assets, assessed in their actual page context. |

Inspect the existing header SVG definitions before introducing helpers or dependencies. Preserve the frozen pre-refinement source and reference separately; update any current reference specimen deliberately under this user-approved direction.

## Acceptance

- Inventory every remaining demo-style interface icon and record intentional exceptions.
- Review the implementation independently, including semantic labels, icon-only controls, keyboard behavior and protected business/privacy code.
- Compare actual desktop, narrow and short states in Chromium and Firefox. Include long labels, disabled/error states and real access roles where affected.
- Check inline SVG and caption fidelity with the unchanged privacy capture implementation and thresholds.
- Record exact source, PR, tests, whole-image evidence and remaining limitations here. Final slice10 must validate the integrated result, rather than accepting a source scan or colour checks alone.

## Checks so far

Read-only source orientation and repository instructions only. No application/runtime changes, browser validation, merge, deployment or cleanup.
