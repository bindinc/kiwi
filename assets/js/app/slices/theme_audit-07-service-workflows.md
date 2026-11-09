# Slice 07 — Service workflows

Audit marker: theme_audit

Status: planned; documentation only. See the [audit index](../../../../plans/theme_audit.md) for the baseline, story, sequencing and evidence boundaries. Deliver the coherent service-form alignment as one future implementation PR with its own worktree and changelog entry.

## Purpose and dependencies

Make subscription editing, resend, editorial complaints, winback, restitution and transfer use the same readable form language. Customer/subscription context must remain clear, conditional steps must be understandable and the action that changes a record must be distinguishable from navigation.

Depends on **01 Foundations**, **02 Controls and actions**, and **04 Customer and data views**. Slice 04 owns shared customer editing and address fields; reuse those primitives for transfer recipients. Coordinate with slice 08 for overlay shell/focus behavior and slice 09 for session/outbox state presentation. This slice owns service-form content and composition, not a second overlay or outbox system. Shared `styles.css` and template work must be integrated sequentially, with slice 10 checks applied as each branch becomes testable.

## Findings and reference

The [showcase](../../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html) supplies a common grammar through `.subscription-form-block`, `.subscription-fields`, `.subscription-choice`, `.subscription-selection-summary`, `.subscription-review` and `.subscription-form-actions`. Apply its flat grouping, context hierarchy, restrained choices and action alignment to the existing service branches. The showcase does not define cancellation, refund, deceased-customer processing or transfer rules.

Source-confirmed deviations:

- Edit, resend and complaint forms use generic rounded/shadowed `.card`, `.form-header`, `.form-group` and `.form-actions` rules, while `.winback-step` duplicates its own form spacing. There is no consistent service-form composition beyond the inherited palette.
- `.radio-option`, `.offers-container`, `.script-box`, `.info-box` and dynamically generated deceased-subscription cards create competing surfaces for options, guidance and record context. Selected choice, instructional content and warning/status need distinct treatments.
- Winback includes steps `1`, `1b`–`1e`, `2` and `3`; refund-only, transfer-only and combined paths differ. Checking only the default step would leave substantial form content and dynamic controls unreviewed.
- Shared native controls and secondary actions carry the defects/deviations recorded in slice 02. This slice must verify those corrections in all service variants, including generated controls.

## Implementation targets

| File | Sections and responsibilities |
| --- | --- |
| [Base template](../../../../templates/base/index.html.twig) | `#editSubscriptionForm`, `#resendMagazineForm`, `#editorialComplaintForm`, `#restitutionTransferForm`, `#winbackFlow`, all `.winback-step` branches and their actions. |
| [Shared styles](../../../css/styles.css) | Scoped service form layout, `.winback-step`, `.steps-indicator`, `.radio-option`, offer selection, `.script-box`, deceased-subscription sections and transfer fields; reuse the foundation/control contracts. |
| [Subscription workflow](subscription-workflow-slice.js) | Edit/resend/complaint initialization, generated options and presentation hooks. Preserve current endpoint and read-only decisions. |
| [Winback slice](winback-slice.js) | Generated offers, deceased-subscription choices, refund/transfer summaries and recipient form placement. Preserve the state machine and mutation behavior. |
| [Role runtime](../subscription-role-runtime.js), [address fields](../address-fields.js) and [customer work sessions](customer-work-session-slice.js) | Dependency/regression review for generated person forms, validated addresses and draft ownership; do not fork these systems. |
| [Customer details](customer-detail-slice.js) | Verify restitution/transfer entry context and status messages when returning from a form; core data-view styling remains in slice 04. |

## Desired visual contract

- Use the common flat form surface, header hierarchy, 20px desktop/16px narrow insets, 12px field gaps, approximately 13px labels/15px text and 40px controls. Short edit/resend forms remain short; complex transfer forms can use paired fields where their labels and values fit.
- Put available customer/subscription identity ahead of editable controls. Use restrained context summaries and separators instead of repeated filled cards. Preserve warnings about immediate effects and distinguish them from ordinary help text.
- Use visible native choices for cancellation reason, offer result and each deceased-subscription action. Selected options use the shared selection rule/surface and remain distinguishable from focus and status. Guidance/script copy is readable reference content, not a competing primary panel.
- Present the current step and next action clearly without inventing a linear path that hides the existing deceased/refund/transfer branches. Back and cancel actions are outlined or tertiary according to the shared contract; the current step has one clearly prioritized commit/continue action. Preserve any semantic destructive treatment where the action actually requires it.
- Align transfer identity/address fields with the shared customer-form system. Same-address controls, refund notes, contact details and combined-flow sections remain visible at the point they affect the operation. Collapse columns in logical reading order without obscuring actions or selected subscriptions.

## Scope and interaction guards

Scope includes the listed service screens, generated options/summaries, form density, section structure, labels and responsive styling. Customer-editor internals belong to slice 04; delivery-remarks and generic modal shells belong to slice 08; queue/history/outbox presentation belongs to slice 09. Preserve their shared behavior while avoiding duplicated implementation ownership.

Keep IDs, names/values, `data-action`/step bindings, translation keys and privacy markers. Preserve subscription eligibility, current selected subscription, read-only/API-customer restrictions, required fields, direct-edit warnings, resend reason values and complaint follow-up semantics.

Do not alter accepted/declined winback behavior, offer selection, deceased-subscription action collection, refund-only/transfer-only/combined routing, restitution reversal, address-session IDs or same-address validation/submission rules. Keep draft restoration, cancellation, pending-request locks and customer-session ownership intact. A hidden branch must stay inactive and must not gain required controls that block a different branch.

## Acceptance and validation

1. Capture before/after examples of edit, resend, complaint, ordinary winback and restitution/transfer against the shared reference grammar. Include long labels, notes, customer names and multiple selected subscriptions; a single first-step screenshot is insufficient.
2. Exercise every existing branch: accepted/declined winback, no selected reason/offer, deceased subscription choices, refund-only, transfer-only, combined processing, restitution transfer and same/different address. Check Back, cancel, reopening/resuming and switching customer context without losing or misapplying drafts.
3. Verify required/invalid/read-only/disabled/pending/error states with controlled fixtures. Preserve immediate-action warnings and final action meanings. Native choices, focus order, labels and errors must work in Chromium and Firefox at desktop, 390px/320px and 200% zoom.
4. Run `make js-test` and `make guardrail`, including the existing subscription-workflow and winback suites. Add focused coverage only for changed markup/interaction contracts. Reuse customer-session and shared-address Docker Compose checks where the composition touches those systems.
5. Validate mutations only against controlled local data. Record baseline and resulting payload/branch behavior for affected service actions; visual evaluation itself must not send real complaints, resends, refunds, cancellations or transfers.

## Remaining unknowns and completion evidence

The branch inventory is source-confirmed. Availability depends on customer type, subscription state and data fixtures; this document does not claim every branch was live-rendered or submitted. Confirm the active entry paths, permission restrictions and realistic fixtures before implementation, and record inaccessible branches as acceptance gaps. Completion requires per-family visual evidence plus branch, draft and address results; any shared overlay behavior changed under slice 08 must be included in the final regression review.
