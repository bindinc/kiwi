# theme_audit — Unify interface icons

Status: implementation in progress from 2026-11-16. The user-approved reference is the existing quiet header icon family. Source review and actual rendered acceptance remain required; this draft is not accepted.

Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629). Parent: [theme_audit plan](../../../plans/theme_audit.md).

Worktree: `/home/bartdeijkers/_worktrees/unify-kiwi-interface-icons`.
Branch: `codex/unify-kiwi-interface-icons`.
PR: draft [#155](https://github.com/bindinc/kiwi/pull/155).
Initial base: `codex/align-theme-operational-states` at `31056b4e4d7eae9010defc2e8b8c0a9e7d0ffe5c`.

Finish slice09 and adopt its accepted source before implementing this refinement. Keep application edits sequential. Complete the icon refinement before final slice10 integration so the final whole-interface review includes the approved icon language. The additional PR retains one Unreleased changelog entry and does not authorize merging, deployment or worktree cleanup.

## Accepted dependency adoption — 2026-11-16

Accepted slice09 source `2c193b25770506321d3b85bf9e5954deb159c2ef` is adopted in this branch before application changes. Preparation head `40a334757a2f8165981e19efac4a51a5fe0d12b9` preserves the existing single icon changelog entry and the completed09 entry. The earlier source inventory remains a historical orientation; current implementation and evidence need their own exact source identities.

Implementation, independent review and Compose validation have separate owners. The user-authorized work window ends at11:55 Europe/Amsterdam; unfinished gates remain explicit at pause. Current guidance and evidence are retained under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-16/icon-refinement/`. Context7 MDN documentation confirms decorative SVG hiding and accessible names on containing controls. The retrieved icons guide is applied with self-contained inline SVG to retain faithful isolated screenshot capture.

## Approved direction

Use the header's restrained line icons: inline SVG, a 24-unit viewBox, approximately 1.75-unit strokes, round line caps/joins and `currentColor`. Use the established control and spacing tokens. Align icons with their labels without adding decorative tiles or changing action hierarchy.

Keep visible labels, accessible names, state meaning, permissions and click/keyboard behavior. Decorative icons must not duplicate spoken labels. Customer logos, avatars, brand identity and native browser controls retain their existing roles. Recording and presence retain clear status words and their established semantic indications.

Keep icon markup separate from translatable text. Use self-contained inline SVG that remains intact in privacy screenshots. Preserve every privacy annotation, opaque/private boundary and the original screenshot SDK and fidelity criteria.

## Initial source orientation

The initial source scan covers tracked JavaScript, Twig and CSS at the base above. It finds graphical Unicode symbols in 21 files, including translations; this is an inventory, not a count of confirmed defects. Durable path/hash/codepoint evidence is retained beside the worktrees under `.kiwi-theme-audit/evidence/2026-11-13/icon-refinement/initial-inventory-01.json`. Classify ordinary punctuation, navigation arrows, status conventions and favicon/brand assets separately before replacing a symbol.

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

## Semantic classification and protected payloads

Read-only orientation against current slice09 source `ac26a020eac29be6a86e83bca6047b8be2e682c3` classifies all21 inventory files and11 supporting source bodies. All32 bodies match that commit;67 source and usage checks pass. The durable `semantic-classification-01/manifest.json` is pinned at `65a7453c06e31610f8fb300ee22483cd91a35cadad5ed35c05a76c6fd2b59d3a`. Adopt accepted09 before application implementation.

- Toast messages are stored verbatim as contact-history descriptions and can reach the history API. Preserve those messages, shared translation values and stored/user-written content; separate icon presentation from the payload.
- Delivery shortcut captions and their plain `delivery.remarkPresets` payloads are already separate. Replace only their presentation glyphs. Provider offer/quote values and free annotation text keep their existing content.
- Static translation updates and runtime writers can replace a parent's entire `textContent`. Place SVG outside translated caption nodes and preserve it through hold/resume, coupon, pending and locale changes.
- Subscription edit/cancel controls currently rely on titles. Give the existing buttons explicit localized accessible names when their decorative glyphs become SVG.
- Current close controls use a literal glyph in an unframed40px target with1.5rem text. Assess a vector cross while preserving the target, focus and dismissal behavior. Existing quiet SVGs, native controls, status conventions, punctuation and identity assets require deliberate exceptions.
- Current screenshot redaction masks explicitly marked media and replaces unsupported embedded content; it does not automatically mask static inline SVG. Preserve existing sensitivity/mask/ignore boundaries. No new public wrapper or blanket masking exemption is required.

This classification is preparation, not implementation or rendered acceptance. Source references and per-file decisions are retained in `semantic-classification-01/review.md` beside the worktrees. The retrieved `icons` guidance and implementation direction are retained in the same icon-refinement evidence directory.

## Acceptance

- Inventory every remaining demo-style interface icon and record intentional exceptions.
- Review the implementation independently, including semantic labels, icon-only controls, keyboard behavior and protected business/privacy code.
- Compare actual desktop, narrow and short states in Chromium and Firefox. Include long labels, disabled/error states and real access roles where affected.
- Check inline SVG and caption fidelity with the unchanged privacy capture implementation and thresholds.
- Record exact source, PR, tests, whole-image evidence and remaining limitations here. Final slice10 must validate the integrated result, rather than accepting a source scan or colour checks alone.

## Checks so far

Implementation checkpoint on2026-11-16: all142 frontend tests, three guardrails,18 changed-JavaScript syntax checks and whitespace pass. Container lint passes all five Twig files. The frozen candidate manifest is `5f523181109aeb4c545f87a679af3fd22463a3c67fe649b537e23b2e656b0365`; independent source and actual Chromium/Firefox/private-capture gates are in progress. No rendered acceptance is inferred from these checks.

## Implementation checkpoint — 2026-11-16

A trusted40-glyph self-contained SVG catalogue and matching Twig macro replace the active demo pictograms across forms, customer/service actions, history decoration, calls/queue, article/catalogue/cart and feedback controls. Dynamic captions use separate translated leaf nodes; the readonly customer action keeps its View state through NL/EN/NL. Icon-only subscription controls receive localized accessible names.

Known call/queue notifications carry explicit separate presentation metadata; stored raw history/messages, shared business translations, delivery presets and provider/user text stay unchanged. The outbox save-notice override clears optional presentation so status stays authoritative. Caption output is escaped and icons remain decorative, nonfocusable and pointer-inert. No new public/privacy annotation or SDK/fidelity change is introduced.

Intentional exceptions are existing approved SVGs, source logos/avatars and unused scaffold favicon, native controls/confirmation text, presence/recording/ACW indicators, ordinary arrows/check notation and an inactive commented demo action. These are distinct from remaining validation gates. The inventory and exact protected-value checks remain in the frozen candidate archive; the complete interface still needs final slice10 acceptance after this refinement.
