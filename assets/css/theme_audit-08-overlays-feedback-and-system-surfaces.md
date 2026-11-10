# theme_audit 08 — Overlays, feedback and system surfaces

Audit marker: `theme_audit`. Status: planned. Baseline: `c05973e`, 2026-11-09.

Coordination: [evaluation and slice index](../../plans/theme_audit.md), SC-206629. Depends on 01/02 and shell placement from 03; coordinate disposition/outbox overlays with 09 and form lightboxes with 04–07.

## Finding and reference

Standard dialogs, form lightboxes, contextual feedback and account-state pages currently follow different header, inset, radius, button and text conventions. Shared modals use colored headers and 24px padding; contextual feedback uses white 18px headers/insets and smaller controls. Decorative differences compete with actual differences in urgency and purpose.

Apply the [showcase](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview) action/field/spacing contract and its restrained reset-confirmation and status patterns. The showcase is not a complete production overlay specification: keep each real dialog's necessary task behavior and define missing states explicitly instead of treating demo behavior as an application requirement.

## Target code

- [Shared styles](styles.css): `.modal`, `.modal-content`, `.modal-header`, modal bodies/footers, form lightbox/backdrop and `.toast` rules.
- [Feedback styles](contextual-feedback.css) and [feedback modules](../js/app/contextual-feedback/): dialog, settings, button, element selection, annotation and privacy review surfaces.
- [Base template](../../templates/base/index.html.twig): delivery instructions, disposition and development-only dialogs. Shared header/layout changes must not replace their actual fields.
- [Access denied](../../templates/base/access_denied.html.twig) and [logged out](../../templates/base/logged_out.html.twig): secondary application surfaces, headings, explanation and next actions.
- [Shell behavior](../js/app/slices/app-shell-slice.js): overlay dismissal and focus lifecycle; retain current draft semantics.

The audit captured local feedback settings, the actual feedback dialog, logout and access-denied views at 1440/390px. Because feedback was disabled by preference, the installed button handler was invoked directly for dialog inspection; the preference was not changed. Rendering inspection of a dialog is not proof of capture privacy, successful submission or permission behavior. See the index evidence table for exact gaps.

### Confirmed short-height containment defect — 2026-11-10

Slice 02 browser review confirmed that the feedback panel clips its close and submit controls at 390×320 in Chromium and Firefox. A controlled comparison used the same current feedback markup with the exact pre-02 CSS snapshot: both pre-02 and current panels extend above/below the viewport, with `overflow: visible` and no maximum height. Keyboard focus does not reveal the clipped controls. This is an existing overlay-containment failure that slice 08 must resolve before its acceptance; the state is recorded as a deviation deferred to 08, never as a passing short-height check.

Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-02/short-feedback-comparison/report.json` and its four browser/comparison PNGs. The comparison is labeled **old-CSS application comparison**; it does not establish showcase parity or feedback-submission acceptance. Preserve the working Escape/draft behavior while making the header, form body and actions reachable.

### Additional disposition containment gate — 2026-11-10

The slice 02 actual component probe at `c12b7fe` confirms canonical caption/field/focus painting in the delivery, disposition and debug dialogs. It separately records partial focused disposition textareas at 390×320: Chromium follow-up bottom 340.75px; Firefox notes/follow-up bottoms 359.70px/343.87px, beyond the 320px viewport. These are current container-visibility failures owned by 08, not passing full-focus/containment states. Unlike the feedback comparison above, this finding does not claim a separately replayed historical CSS baseline. Existing rows, width/margins and modal scroll composition are preserved by 02; 08 must make every focused field and its full indicator reachable without losing values.

Evidence is retained under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-02/c12b7fe/`; the standalone-field reports and screenshots distinguish the 260 passing type/geometry/draft/source checks per engine from these explicit containment observations. Do not mark this gate complete from those counts alone.

## Bounded implementation

1. Establish shared dialog header/body/footer spacing, type, borders and control dimensions. Use restrained elevation to express the overlay layer; ordinary form sections inside the dialog remain flat.
2. Apply the same primary/secondary/tertiary action grammar without making all dialogs look destructive or urgent. Keep clear object/context and a predictable cancel/close path.
3. Align feedback settings, the feedback form, helper/error text and privacy-review controls with that grammar. Keep capture/annotation tools visually distinct only where their job requires it.
4. Align toasts, inline notices, empty/error/status messages and account-state pages with the same hierarchy. Do not use transient notifications as the only location for consequential guidance.
5. Verify long dialogs, nested scroll areas, viewport height, sticky headers and floating controls together. The floating feedback trigger must not obstruct dates, form actions or another overlay's controls.
6. Review icon-only close/settings controls for consistent hit areas, accessible names and focus. Preserve existing useful icons; avoid adding another icon dependency or decorative symbol system.

## Invariants and exclusions

Preserve focus containment, initial focus, Escape behavior, focus return and draft retention. Do not turn visual cancel/close into discard. Keep user settings semantics and permission gating unchanged.

Feedback screenshot capture, redaction, pseudonymization, annotation colors and sensitive-field metadata are protected behavior. Cosmetic improvements must not remove shielding, change the redaction palette, expose sensitive text or weaken the existing screenshot-fidelity threshold. No feedback submission, screenshot upload, customer mutation or external message is authorized by this planning document.

The approved datepicker remains a distinct popover with its existing tested keyboard and availability behavior. This slice verifies coexistence; it does not redesign it again. Release/deployment, authentication policy, session storage and backend error handling are outside scope.

## Acceptance and validation

- Shared overlay headers, controls, messages and action rows visibly agree with the reference contract at normal and narrow widths.
- Dialogs with short and long content work at 390×320 and 200% zoom: title, current focus, error and next action remain reachable without horizontal clipping.
- Keyboard open/traversal/close/return focus works for actual dialog triggers, including failure/retry and retained drafts. Verify clicks on the backdrop do not lose data unexpectedly.
- Default, hover, focus, checked, disabled, invalid, success and error states remain legible; warning/danger information is not conveyed only by fill color.
- Access denied and logged out pages preserve correct messaging and next actions, using the same typography and control hierarchy. Verify their specific routes rather than assuming the main shell stylesheet applies.
- Use existing dialog/settings, payload, selector and screenshot privacy tests. If feedback layout or sensitive-field markup changes, rerun the appropriate Compose privacy smoke in Chromium and Firefox at the existing threshold; do not relax a test to fit the new styling.
- Capture representative dialogs and permission/account states alongside their surrounding app context. Clearly label fixture-only states and do not claim complete privacy or accessibility acceptance from screenshots alone.

Implement in a separate PR/worktree, serialize shared CSS/template edits, and retain a single changelog entry. Done requires visual, keyboard and applicable privacy evidence, with no unresolved high-impact regression.
