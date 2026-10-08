# KIWI palette showcase review

Reviewed and updated on 2026-09-08 using the `enterprise-product-ui` skill. Scope: the existing standalone [showcase](./kiwi-light-and-shadow-theme-palette-showcase.html), not the application theme implementation.

## Findings and corrections

### P1 — Form selections did not reflect the user's choice

- **Evidence:** In the original subscription example, selecting `Betaalinstructie` left the hard-coded `.is-selected` class on `Automatische incasso` and kept the IBAN field visible. Unchecking the same-payer checkbox exposed no alternative payer. The page contained no interaction script.
- **Impact:** Reviewers could not assess payment and payer transitions, and the displayed state contradicted native control state.
- **Correction:** Selection styling follows `:checked`. Payment changes show the applicable fields, and a different payer requires an explicit choice from fictional example data. Changing recipient or product search input clears the old selection and its context summary until it is selected again.

### P1 — Actions, validation, and recovery were not reviewable

- **Evidence:** Search, product selection, recipient lookup, cancellation, and creation buttons had no handlers. Required-looking fields such as `#demo-start-date` lacked native required constraints. The date hint claimed that only available delivery dates could be selected, although no such restriction existed.
- **Impact:** The artifact presented unsupported behavior and could not demonstrate error prevention or recovery.
- **Correction:** The two examples now support local search and selection, inline validation with first-error focus, a simulated submission, retained input after a simulated failure, retry, and a reset dialog with a safe initial focus. Scenario controls expose initial empty, populated, loading, no-results, error, and read-only views. Static component samples are no longer buttons. Copy explicitly identifies fictional data, simulation, and the absence of bank or delivery-date validation.

### P1 — Header contrast and navigation focus needed correction

- **Evidence:** The original 13 px preview subtitle used white at 68% opacity over Blue Fusion; the measured contrast was 3.95:1. The global Blue Fusion focus outline also used the header's own color. At widths below 720 px, section navigation was hidden.
- **Impact:** Small header text and keyboard focus were difficult to distinguish; narrow-screen users lost section shortcuts.
- **Correction:** Preview subtitles and header focus use white, giving 6.39:1 against the header. Section navigation wraps at narrow widths. Field errors are associated with their inputs, and the Dutch examples have an explicit language boundary.

### P2 — Decorative framing delayed the useful comparison

- **Evidence:** The original first desktop viewport was dominated by a 500 px abstract illustration, a display-size heading, gradients, and shadowed swatches. The workflow examples appeared after the palette gallery. Decorative circles also appeared behind work areas.
- **Impact:** Reviewing everyday customer-service work required substantial scrolling through decorative material.
- **Correction:** Workflows precede palette reference material. A compact introduction, flat work surfaces, restrained separators, and one filled primary action establish hierarchy. The product's existing system font stack replaces the unprovided Ubuntu Sans font. Desktop search fields share rows; narrow layouts retain labels, customer identity, recovery controls, and section navigation. All eight palette values remain unchanged.

## Product direction

The primary users represented are customer-service employees handling repeated customer and subscription tasks. The design prioritizes selected customer and product context, then the next action, then reference information. Standard density becomes compact for related desktop search fields. The visual character is calm, precise, and warm; a Blue Fusion selection rule is the recurring signature.

## Verification

- Chromium 152: 30 scripted interaction assertions passed across search/selection and form submission/recovery. These covered stale search response suppression, payment and payer changes, input preservation, read-only restrictions, reset confirmation, and no preselected marketing consent.
- Keyboard checks passed for search submission, form traversal and submission, disclosure, initial dialog focus, Escape, focus restoration, skip link, and the visible header focus outline.
- Rendered desktop and narrow views inspected at 1440 px and 390 px. Additional layout checks at 1280, 768, and 320 px found no horizontal page overflow or clipped controls. The spacing revision measured 953 px in height at 1440 and 1280 px widths, before the later pre-submission summary was added.
- A 200% CSS zoom simulation and long example names/email addresses produced no horizontal page overflow. Reduced-motion emulation retained non-animated scrolling.
- A computed-style contrast check of 228 visible text nodes in the populated desktop view found no failures. Visible text/search/date/select control borders passed 3:1. This check does not cover every browser-drawn control detail or every possible state.
- DOM checks found no duplicate IDs, unlabeled inputs/selects, or broken ARIA references. No browser console errors were observed. Simulated submission made no network requests.
- JavaScript syntax, standalone whitespace, and `git diff --check` passed. The eight source tokens were compared with the original file and are unchanged.

## Spacing refinement — 2026-09-08

- Replaced scattered spacing values with a 4/8/12/16/20/24/32/48 px scale and shared roles for page gutters, panel padding, workspace padding, and section separation.
- Aligned all reference headings and their descriptions to the same column guides. Customer search and subscription context now use the same rail width and panel insets.
- Standardized panel content insets at 20 px on desktop and 16 px on narrow screens, including validation and status messages. Scoped section spacing to direct children of the main document so it does not affect nested workflow sections.
- Added the missing 12 px gaps above the alternate-payer group and between marketing guidance and consent choices. Normalized label gaps, checkbox/radio margins, control padding, swatch metadata, contrast samples, status rows, and dialog spacing.
- Rechecked 1440, 1280, 1024, 980, 768, 720, 600, 480, 390, and 320 px widths. No horizontal page overflow or clipped controls remained; the postcode field's desktop minimum width was corrected during this check. A 200% CSS zoom simulation also passed the overflow check.
- Inspected rendered desktop form, narrow validation state, palette, and component/contrast sections. Confirmed matching header/message insets, visible first-error focus, reset-dialog layout, Escape, and successful simulated submission. Whitespace and `git diff --check` passed. HTML and JavaScript were compared with the pre-refinement artifact and remain identical.

## Follow-up review fixes — 2026-09-08

All four findings from the follow-up review were corrected:

1. **Validation:** Editing an unrelated field preserves unresolved errors. Correcting a field updates that field and the summary count. Product/recipient selection and conditional payer requirements also revalidate their affected fields. Reset clears the validation state.
2. **Search recovery:** `Opnieuw zoeken` retains the current query. The separately labeled `Zoek De Vries` action still loads the example query. Focus stays in the search field during recovery, then moves to the found customer's heading; the next Tab reaches the customer action. A user who moves elsewhere while waiting keeps that focus.
3. **Context at submission:** A compact summary immediately above the action buttons shows recipient/customer number, product, and payer. It updates with selections and reset, and explicitly indicates missing selections. On the 390 × 844 viewport, all three values and the final action are visible together.
4. **Secondary action reference:** The specimen and workflow use the same shared outline style, including color, border, padding, type size, and radius. Computed-style equality was checked in the browser.

Verification: 23 focused interaction assertions passed in Chromium, covering all corrections and conditional validation, reset, read-only behavior, submission failure, and retry. Desktop and narrow screenshots were inspected. Layout checks at 1440, 1280, 768, 390, and 320 px found no horizontal page overflow or clipped controls. No browser console errors were observed. JavaScript syntax, standalone whitespace, and `git diff --check` passed.

## Boundaries

This is a local design artifact. It does not save customer data, create subscriptions, validate bank accounts, check actual delivery availability, or connect to KIWI services. The existing implementation plan and application source were not changed. No PR was created for this local showcase revision.

Screen-reader testing, Firefox/Safari verification, and native browser zoom were not performed. The checks above are scoped evidence, not a full WCAG 2.2 AA conformance claim. Application acceptance checks such as OIDC, PHP tests, and Kubernetes rollout tests do not apply to this standalone artifact revision.
