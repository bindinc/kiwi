# Slice 05 — Subscription workflow

Audit marker: theme_audit

Status: planned; documentation only. See the [audit index](../../../../plans/theme_audit.md) for the baseline, story, sequencing and evidence boundaries. This slice is one future implementation PR, with its own worktree and changelog entry.

## Purpose and dependencies

Make product selection, recipient, payer, payment and consent read as one deliberate workspace. Keep the selected context visible before the next action, with optional search and person details on demand. Use a compact, calm and precise presentation suitable for repeated service work.

Depends on slices **01 Foundations**, **02 Controls and actions**, and **04 Customer and data views**. Slice 02 owns the shared native-radio and hidden-payment-control corrections; this slice applies and verifies them throughout subscription creation. Slice 04 owns shared person/address controls. Integrate changes to `styles.css` and the base template sequentially after those dependencies, then apply slice 10's relevant acceptance checks.

## Findings and reference

The [showcase](../../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html) defines `.subscription-workspace`, `.subscription-form-grid`, `.subscription-form-block`, `.subscription-fields`, `.subscription-selected-person`, `.subscription-choice`, `.subscription-consent-row` and `.subscription-form-actions`. These establish flat sections, restrained separators, visible native choices, a persistent selected-person summary and a consistent action region. The [showcase review](../../../../plans/kiwi-light-and-shadow-theme-palette-review.md) explains the intended hierarchy; its fictional records and simplified behavior are not a business specification.

Source-confirmed deviations in the application:

- `#newSubscriptionForm` uses the generic rounded, shadowed `.card.onepager-container`; `.party-role-panel`, `.party-selected-person` and the advanced-search disclosure add further bordered boxes instead of the reference's flatter grouping.
- `.form-row`, `.form-subtitle`, `.party-mode-toggle` and `.optin-row` use different spacing, label treatments and filled surfaces. Product, person and consent sections consequently compete for attention.
- `.payment-option input[type="radio"]` is hidden with `display:none`. This is a keyboard accessibility defect owned by slice 02, not merely a shape preference. Its checked-sibling selectors also control the appearance of payment details and must be accounted for when composing this screen.
- Static recipient/requester lookup fields rely on placeholders, while dynamically generated create-person fields already support persistent labels. Preserve that improvement and bring lookup fields to the same readable standard.

## Implementation targets

| File | Sections and responsibilities |
| --- | --- |
| [Base template](../../../../templates/base/index.html.twig) | `#newSubscriptionForm`, `#subscriptionForm`, product/werfsleutel fieldset, `#recipientRolePanel`, requester sections, payment choices, date, consent and actions. |
| [Shared styles](../../../css/styles.css) | Scoped subscription composition; `.onepager-container`, `.party-role-panel`, `.subscription-person-search-more`, `.party-selected-person`, `.payment-methods`, `.optin-row`, `.werfsleutel-fieldset`. Avoid changing article/service variants implicitly. |
| [Role runtime](../subscription-role-runtime.js) | Generated recipient/requester form and result markup; use the shared field grammar without changing role selection or search availability. |
| [Werfsleutel slice](werfsleutel.js) | Product suggestions, offers, selected-product summary and channel presentation where generated markup needs alignment. |
| [Subscription workflow](subscription-workflow-slice.js) and [payment rules](../subscription-payment.js) | Review selector, submission and required-field dependencies; change only presentation hooks if necessary. |

## Desired visual contract

- Use one flat form surface with a readable header and meaningful section boundaries. Use the foundation spacing scale, 20px desktop/16px narrow section insets, approximately 13px labels, 15px field text and standard 40px controls. Use the reference's 22px form title and 15px section-heading hierarchy where they fit the shared primitives.
- Compose product/context and editable sections using available width, with two form columns only when realistic content fits. Collapse in DOM order without horizontal scrolling; do not force the showcase's exact column count into every state.
- Present selected products and people with the restrained 2px selection rule and soft selection surface. Keep person identity, role and the action to change the selection clear. Advanced lookup remains a light disclosure, not another decorated card.
- Use visible, keyboard-operable payment choices with a clear checked state and at least the reference's 44px choice height. Keep conditional IBAN details adjacent to the relevant payment context. Use separated consent rows with visible Yes/No choices and a persistent channel label.
- End with one filled submission action and an outlined cancel action. Context needed to avoid a wrong recipient, payer or product must remain available before submission; reuse authoritative state rather than inventing a second summary data model.

## Scope and interaction guards

Scope includes section layout, grouping, typography, persistent labels, responsive behavior and presentation of existing conditional states. It excludes backend changes, new subscription rules, new offers, new payment providers and copying the showcase's simulated validation or lookup behavior.

Preserve IDs, input names and values, `data-action` bindings, localization and `data-feedback-sensitive` markers. Preserve product/division/mandant search restrictions, explicit edition selection, recipient/requester existing-versus-create modes, duplicate-person checks, reuse-current-customer behavior and same-as-recipient logic. Do not reset entered values when changing layout or expanding a disclosure.

Keep `subPayment` values `B`/`AC`, conditional IBAN visibility/requiredness, existing start-date rules and the intentionally unselected marketing preferences. Preserve address validation, read-only states, submission IDs, ambiguous-outcome reconciliation, draft restoration and customer-session ownership. An appearance-only change must not introduce a request or change payloads.

## Acceptance and validation

1. Capture the actual form before and after at desktop and narrow widths; compare composition against the named showcase sections, not only palette values. Include a long selected product, long person name, open lookup and both payer modes.
2. Exercise product unselected/selected, lookup loading/empty/error/results, existing/new recipient, same/different payer, both payment methods, unset/set consent, validation errors and pending submission. Keep unavailable controls and read-only information distinguishable.
3. Verify Chromium and Firefox keyboard access, native radio navigation, visible focus, associated labels, error association and readable selected states. Check 320px and 390px viewports, a representative desktop and 200% zoom; no clipped fields, hidden actions or sideways form scrolling.
4. Run `make js-test` and `make guardrail` in the implementation worktree. Pay particular attention to the existing role-runtime, role-slice, payment and subscription-workflow tests; add focused behavior coverage only if markup changes an interaction contract.
5. Use isolated Docker Compose browser checks, including the existing subscription-initials, subscription-person-details, recipient-address and marketing-preferences smoke scripts as applicable. Use controlled fixtures for submission coverage; do not create real customer transactions for visual evidence.

## Remaining unknowns and completion evidence

The mismatch is established by source review and the overall audit; this plan does not establish that every recipient/payer/product combination has been rendered. Available test fixtures for slow lookup, duplicate identities, multi-edition offers and pending/ambiguous submission must be confirmed before implementation acceptance. Record unavailable states explicitly instead of treating a screenshot of the happy path as full coverage. Completion requires the visual comparison, interaction results and any unresolved fixture gaps in the implementation PR.
