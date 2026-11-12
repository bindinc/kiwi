# theme_audit 08 — Overlays, feedback and system surfaces

Audit marker: `theme_audit`. Status: implementation preparation; source orientation and fresh BEFORE acceptance are required before application changes. Original audit baseline: `c05973e`, 2026-11-09. Current implementation base: accepted slice07 `771ab50`.

Coordination: [evaluation and slice index](../../plans/theme_audit.md), SC-206629. Depends on 01/02 and shell placement from 03; coordinate disposition/outbox overlays with 09 and form lightboxes with 04–07.

## Implementation record

- Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629), tracked in Codex feedback engineer / Codex in Progress.
- Worktree: `/home/bartdeijkers/_worktrees/align-theme-overlays-and-feedback`.
- Branch: `codex/align-theme-overlays-and-feedback`.
- Base: accepted slice07 `771ab506a43feddb4a56d76cd68248ef77738dcd`, [full CI43189913666](https://github.com/bindinc/kiwi/actions/runs/43189913666) passed. Stack on `codex/align-theme-service-workflows` while PR151 remains unmerged.
- Evidence root: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-12/slice-08/`, outside Git. Keep the existing07 runtime/source unchanged for the observational baseline until a reviewed08 candidate is ready.
- Ownership: one application writer; independent source/actual-image reviewer; one browser/slice10 tooling owner. Root owns08 audit/index/changelog/PR/runtime/commits.
- Direction: consistent New subscription backdrop transparency/sharpness; restrained shared dialog anatomy, reachable short-height content and clear contextual feedback. Preserve actual screenshot-review shielding, capture suspension, privacy, annotation, draft, permission and request semantics. Resolve the explicit320 global notification/action overlap without losing its complete message or the required action.
- Preparation only: no application modification or rendered acceptance is claimed. One changelog entry is retained for this PR; merge/deployment/cleanup remain separately gated.

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

### Narrow toast/action overlap gate — 2026-11-12

Actual Firefox320×1000 complaint recovery on service source `4f1f57f` shows the full transient error toast overlapping the Register action. After its existing expiry, the unchanged form retains its description/follow-up values, the full action is visible and a genuine identical-payload retry succeeds through the controlled queued acknowledgement. The passing functional/geometry counters are not evidence of an unobstructed error-state image.

This slice explicitly owns the shared `.toast` surface and placement. Inspect narrow and short-height toast/error/success presentation with actual form actions and current focus; make consequential feedback readable without covering the required next action. Preserve message lifecycle, outbox notice consumption, draft values and request semantics. Verify in both browsers and repeat the affected service error/action state after the correction. Do not solve overlap by hiding the error, shortening its text, forcing a click or weakening visibility assertions.

Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-12/slice-07/after-narrow-complaint-firefox-01/firefox/320x1000-service-complaint-visible-error.png`, its settled rejected/queued images and `report.json`. This is a current-source observation; no historical pixel replay is claimed. Service slice07 covers owned progress, retained values and real retry; unobstructed global toast presentation remains a required08 gate and is not accepted by the service report's green counters.

## Explicit backdrop decision — 2026-11-11

The user requires the background used by **New subscription** to become the shared backdrop for ordinary overlays. Opening contextual feedback currently looks substantially less transparent than opening New subscription or feedback settings. This is an explicit slice 08 acceptance requirement; implementation remains sequential after slices 04–07.

The current application source shows the chosen live New subscription form/lightbox reference and generic modal using `--overlay-backdrop` (`rgba(15, 23, 42, 0.5)`). Contextual feedback instead uses alpha `0.86` plus `blur(14px)`, and feedback settings uses alpha `0.72`. The feedback dialog also currently activates `body.contextual-feedback-reviewing` as soon as it opens, adding another blur/opacity reduction before any screenshot exists. The user-selected live component establishes alpha `0.5` as the explicit application target when comparing the showcase's separate dialog specimen (alpha `0.4`).

- Use the existing shared New subscription backdrop token for ordinary forms, dialogs, feedback without a screenshot, feedback settings and other modal surfaces. Avoid stacking an additional native-dialog veil; the form lightbox's existing transparent `::backdrop` remains relevant.
- Ordinary opening must show the same background transparency and sharpness. Replacing the RGBA declaration alone is insufficient while an extra body filter, opacity or backdrop blur still makes feedback appear darker.
- Preserve the separately required screenshot-review privacy shield when an image is actually under review. Scope that state to actual review, clear it on close/removal/suspension as appropriate, and restore it when returning to a retained image. Capture redaction, pseudonymization, selected-element privacy and original/restricted routing remain protected.
- The element picker's selection veil, menus and popovers have distinct interaction roles; inspect them in context rather than adding the modal backdrop to ordinary floating content.

Required proof: compare equivalent New subscription, feedback initial form, feedback settings and representative generic/native dialogs against the same actual underlying screen in Chromium and Firefox at desktop/narrow widths. Check the shared computed token and actual unobscured background pixels/blur, then independently verify image-review shielding, capture suspension, close/reopen/draft retention and unchanged-threshold privacy. Keep the `theme_audit` marker and record resulting PR/evidence here before acceptance.

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
