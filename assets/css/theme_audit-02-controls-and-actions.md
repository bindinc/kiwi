# theme_audit 02 — Shared controls, labels and actions

Status: planned implementation slice; no application code changed by this document. Audit date: 2026-11-09. Baseline: `c05973e`. Coordination: [theme_audit index](../../plans/theme_audit.md), SC-206629. Depends on [slice 01](theme_audit-01-foundations.md).

## Findings and impact

This slice covers shared controls throughout Kiwi. The reported radio and subscription examples expose system-wide selector and component issues; they are not the exclusive scope.

**P1 — Enabled payment choices are unavailable to keyboard users.** In [styles.css](styles.css), `.onepager-container .payment-option input[type="radio"]` uses `display: none` (audited line 3387). Subscription and article payment choices both use this component. A label can activate a hidden radio with a pointer, but the radio and non-focusable label provide no keyboard target. Live Firefox confirmed `subPaymentAuto` and `subPaymentInstruction` were enabled (`disabled === false`) yet had zero dimensions; `.focus()` failed. Reverse Tab from the enabled `subIBAN` skipped both payment choices. The [showcase](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview) keeps native radio controls visible inside `.subscription-choice`.

**P2 — Persistent control outlines produce browser-dependent boxes.** `styles.css` lines 110–117 add a permanent 1px outline to every radio and checkbox. Firefox renders square outlines around otherwise circular native radios, including enabled consent choices; Chromium renders round outlines. This was verified in both isolated specimens and the live Firefox subscription form. It is a global resting-state rule, not the keyboard focus indicator.

**P2 — Text-field rules leak into other native controls.** `.form-group input`, `.onepager-container .form-row input`, `.article-sale-container .form-row input`, and corresponding winback selectors style all input types. Firefox exposes the inherited 10px padding, 1px border and 6px radius on row radios; Chromium suppresses much of this under native appearance. Checkbox styling also inherits field padding before later width/height rules. The showcase explicitly separates text/search/date/select styling from radio/checkbox styling.

**P2 — Action hierarchy and geometry differ from the reference.** `.btn-secondary` is filled Hematite with white text and 8px corners; showcase `.button-secondary` is white with Hematite text/border and square corners. `.btn-primary:hover` adds translation and shadow. Current action/control heights are derived from unrelated padding/border rules instead of a common minimum. An isolated specimen measured primary/secondary heights of 41/43px in Chromium and 43/45px in Firefox; live flex-aligned subscription actions both measured 45px. These are different contexts, not conflicting measurements. The reference defines a shared 40px minimum and an explicit compact typography/padding treatment.

**P2 — Persistent labels and group semantics are inconsistent.** The showcase places labels above search and data-entry controls and labels consent groups. Current subscription person search, article fields and customer-edit fields include placeholder-only controls; `subStartDate` has a visible label without a `for` association. Audit all consumers rather than repairing a single form. Existing dynamically generated labeled fields must remain labeled.

## Intended design and scope

Use the showcase's `.search-input`, `.subscription-field`, `.subscription-choice`, `.subscription-consent-row`, `.button-primary`, `.button-secondary` and `.button-calm` as the component contract. Reference locations: showcase lines 565–600, 733–799, 1071–1090, 1236–1304, and its final accessibility refinements around lines 1894–1900. Native selection controls retain their browser semantics, palette accent, predictable 20px minimum visual size, and comfortably clickable labels; keyboard focus is visible only when appropriate, distinct from the resting boundary.

1. Separate text-entry selectors from checkbox/radio/hidden/button/file/range inputs. Prefer explicit component classes or readable type exclusions; remove competing broad rules where touched instead of accumulating high-specificity patches.
2. Remove the permanent outer radio box. Preserve native appearance and verify its unchecked/checked boundary contrast in both browsers. Keep a clear `:focus-visible` ring; do not use `outline: none` as a blanket fix.
3. Make payment radios visible and keyboard-operable in both subscription and article flows. Style the complete label/choice as the click target. Preserve selection indication with the native checked state plus the reference's restrained surface/border treatment.
4. Align primary, secondary, quiet, danger, icon and compact actions with slice 01's size/type/corner roles. Ordinary secondary actions use outlined styling. Preserve explicit operational distinctions for call acceptance, hold/resume, end call and destructive operations.
5. Add persistent, associated labels and accessible names wherever shared controls currently rely only on placeholders. Use fieldsets/legends or named groups for related radio choices. Preserve existing field IDs, names, values and data-action hooks.
6. Scope focus rules to the actual light/dark surface. Verify header controls, selected dates, filled actions, profile menus, tables, feedback controls and outbox actions; light menus inside the dark header need the light-surface ring.

Primary files: [styles.css](styles.css), [article-search.css](article-search.css), [Twig form markup](../../templates/base/index.html.twig), affected generated control markup under `assets/js/app/`, and NL/EN label translations. Inspect existing control consumers in delivery picker, feedback and outbox CSS, but retain their established behavior. Tests belong in the relevant frontend suites and Compose browser scenarios; do not build a second controls framework for this task.

## Dependencies and preservation

Implement after slice 01's foundation contract is integrated. Each slice has a separate PR, branch and worktree. **Serialize edits to shared `styles.css` and shared Twig sections** with the feature-layout slices; agree ownership before beginning. Feature-specific panel reordering, context rails, subscription summaries and data layout belong to their respective slices.

Keep native radio mutual exclusion, values `B`/`AC`, existing `:checked + label` and `:checked ~ .additional-input` behavior until an equivalent tested structure replaces it. Preserve IBAN visibility, disabled/required transitions, validation, payment payloads, absent marketing defaults, consent names/values, recipient/payer relationships, rights and draft retention. Do not turn disabled role controls into enabled ones for visual consistency. Do not copy showcase simulation handlers or fictitious records. No backend, business workflow, theme selector, dependency, privacy processing or deployment changes belong here.

## Acceptance and validation

- Text fields, selects and textareas use the shared dimensions without contaminating other input types. Radios remain circular and checkboxes square in Chromium and Firefox; neither receives an extra resting-state outline box.
- Enabled payment choices are reachable by keyboard, change with native arrow-key behavior, and have visible focus. Pointer selection and associated labels produce the same value. Conditional IBAN fields retain their existing validation behavior.
- Every shared control has an accessible name; persistent labels remain available after entry. Related consent choices expose their group label, and no consent becomes preselected.
- Primary/secondary/quiet actions have the intended hierarchy and consistent sizing; multiline and translated labels remain usable. Hover effects do not move ordinary work controls. Disabled, read-only, validation, error, pending, selected and checked states remain distinguishable without color alone.
- Exercise main search filters; recipient/payer modes; subscription/article payment; customer editing and salutation; consent; cancellation/winback; delivery picker; feedback settings/privacy toggle; and outbox actions. Check active and disabled cases separately.
- In Chromium and Firefox, inspect 1440px, 390px and 320px, plus 200% zoom and a short viewport. Run keyboard-only paths with Tab, Shift+Tab, arrows, Space and Enter. Verify visible focus is not clipped by overflow or covered by floating controls. Do not submit business records for styling review.
- Compare computed dimensions, resting/focus outlines and primary/secondary surfaces with the showcase. Retain screenshots of representative shared specimens and real flows. Run `make js-test`, `make guardrail`, `git diff --check`, relevant Twig checks, and Compose theme/feedback-privacy smokes. Exercise existing payment/draft tests when markup or event handling changes.

Done means one reviewable PR contains the coherent shared-control implementation, one Unreleased changelog entry, passing relevant checks and before/after evidence. A screenshot of one corrected radio or a token-only test pass does not complete this slice. Merge, deployment and runtime acceptance remain separate.

## Verified audit evidence and limits

Live local Compose Firefox evidence is retained under `/tmp/kiwi-styling-evaluation-2026-11-09/firefox/`: `control-measurements.json`, `recipient-controls.png`, `subscription-payment-and-consent.png`, and `profile-menu.png`. Measured enabled consent radios are 14px with a permanent 1px outline; enabled payment radios are `display:none` and cannot receive focus. Recipient mode and same-person controls were intentionally disabled before product selection; the report records that distinction. No form was submitted.

Isolated current-CSS comparison screenshots are `/tmp/kiwi-style-audit-native-controls.png` and `/tmp/kiwi-style-audit-native-controls-firefox.png`. These support the browser-specific cascade finding, not claims of full application accessibility or completed remediation. Screenshot evidence remains outside the repository. The proposed fixes have not been implemented by this planning slice.
