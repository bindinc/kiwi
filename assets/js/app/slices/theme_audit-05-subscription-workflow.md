# Slice 05 — Subscription workflow

Audit marker: theme_audit

Status: started; application unchanged pending actual before captures and focused orientation. See the [audit index](../../../../plans/theme_audit.md) for the baseline, story, sequencing and evidence boundaries.

## Implementation record

- Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629).
- Worktree: `/home/bartdeijkers/_worktrees/align-theme-subscription-workflow`.
- Branch: `codex/align-theme-subscription-workflow`.
- Base: integrated `main` at `a39b9dbfd7b839b4f1bf530382ac8cccfd838295`, following the user's prerequisite to merge #142/#147 and retain drafts #144/#148. The original scaffold started on accepted slice 04 `1c76db9`; no application edits or slice 05 browser runs occurred before the merge gate. Rebase `b26ff7d` preserves that scaffold and one changelog entry; the earlier local orientation patch/stash remain retained as recovery copies.
- Slice 04 source, visual, interaction and completion reviews passed; final Actions [43005522519](https://github.com/bindinc/kiwi/actions/runs/43005522519) succeeded.
- PR: draft [#148](https://github.com/bindinc/kiwi/pull/148), created immediately after original scaffold `e7a78c8` was pushed; retargeted to main after rebase, with English text and one Unreleased changelog entry. No slice 05 merge or deployment is authorized.
- Evidence root: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-05/`, outside Git. Actual application, intercepted fixtures and reference captures must remain distinguishable.
- Ownership: one application writer; independent review; slice 10 owner supplies Compose before/reference/after, keyboard and native-zoom validation. Parent owns this document, index, changelog and PR.
- Inherited fixes are retained: keyboard-operable payment choices from 02, shared person/address and safe screenshot serialization from 04. Historical findings below require current-source confirmation rather than reapplying already completed fixes.

## Purpose and dependencies

Make product selection, recipient, payer, payment and consent read as one deliberate workspace. Keep the selected context visible before the next action, with optional search and person details on demand. Use a compact, calm and precise presentation suitable for repeated service work.

Depends on slices **01 Foundations**, **02 Controls and actions**, and **04 Customer and data views**. Slice 02 owns the shared native-radio and hidden-payment-control corrections; this slice applies and verifies them throughout subscription creation. Slice 04 owns shared person/address controls. Integrate changes to `styles.css` and the base template sequentially after those dependencies, then apply slice 10's relevant acceptance checks.

## Findings and reference

The [showcase](../../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html) defines `.subscription-workspace`, `.subscription-form-grid`, `.subscription-form-block`, `.subscription-fields`, `.subscription-selected-person`, `.subscription-choice`, `.subscription-consent-row` and `.subscription-form-actions`. These establish flat sections, restrained separators, visible native choices, a persistent selected-person summary and a consistent action region. The [showcase review](../../../../plans/kiwi-light-and-shadow-theme-palette-review.md) explains the intended hierarchy; its fictional records and simplified behavior are not a business specification.

The original planning findings predate implementation of slices 01–04. Read-only orientation on inherited `1c76db9` distinguished the following status; the integrated main source retains those fixes and now also contains #140's date workflow:

| Planning finding | Current source boundary and slice 05 responsibility |
| --- | --- |
| Rounded, shadowed generic outer card | Foundations already flatten the outer card. The form still uses an 800px single stream and nested party borders/insets; align section composition without claiming the old outer-card defect remains. |
| Nested selected-person and search frames | Shared lookup/selected-person grammar is already improved, including the soft 2px selection rule and light disclosure. Preserve it while composing product, recipient and payer sections consistently. |
| Competing product and consent treatments | Product fieldset/summary/offer cards retain 12px shapes; section rhythm, party insets and consent separator rhythm still need alignment. Scope these changes to subscription creation. |
| Hidden native payment radios | Slice 02 has already restored visible keyboard-operable radios. Preserve the input→label→additional-input sibling relationships, checked selectors, focus and conditional payment rules. |
| Placeholder-only static lookup fields | Slice 04 already supplies persistent associated labels. Retain those labels and dynamic create-person/address associations; do not reimplement the earlier fix. |

The initial source review supports a presentation-only change to the subscription region in Twig and narrowly scoped CSS. Runtime before/reference/after checks remain required; source review does not establish that long real fields fit the proposed two-column composition.

Current integrated behavior is authoritative. #140 supplies per-guide delivery dates, explicit edition selection when needed, provider loading/unavailable/retry states and recovery after source-date rejection. `#membershipStartDate` and `#subStartDate` are enabled/required only for memberships. The earlier today-only orientation described the old slice 04 source and is superseded; it must not drive implementation or fixtures after the rebase. Preserve these real mechanisms rather than inventing or removing date behavior.

## Implementation targets

| File | Sections and responsibilities |
| --- | --- |
| [Base template](../../../../templates/base/index.html.twig) | `#newSubscriptionForm`, `#subscriptionForm`, product/werfsleutel fieldset, `#recipientRolePanel`, requester sections, payment choices, date, consent and actions. |
| [Shared styles](../../../css/styles.css) | Scoped subscription composition; `.onepager-container`, `.party-role-panel`, `.subscription-person-search-more`, `.party-selected-person`, `.payment-methods`, `.optin-row`, `.werfsleutel-fieldset`. Avoid changing article/service variants implicitly. |
| [Role runtime](../subscription-role-runtime.js) | Generated recipient/requester form and result markup; use the shared field grammar without changing role selection or search availability. |
| [Werfsleutel slice](werfsleutel.js) | Product suggestions, offers, selected-product summary and channel presentation where generated markup needs alignment. |
| [Subscription workflow](subscription-workflow-slice.js) and [payment rules](../subscription-payment.js) | Review selector, submission and required-field dependencies; change only presentation hooks if necessary. |
| [Subscription dates](../subscription-start-dates.js) | Generated guide/edition/read-only date/error/retry markup and membership date context; preserve provider, requiredness, stale-response and recovery behavior. |

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
2. Exercise product unselected/selected, lookup loading/empty/error/results, existing/new recipient, same/different payer, both payment methods, unset/set consent, validation errors and pending submission. Include guide/membership/mixed date contexts, explicit edition selection, source loading/unavailable/retry and date-rejection recovery. Keep unavailable controls and read-only information distinguishable.
3. Verify Chromium and Firefox keyboard access, native radio navigation, visible focus, associated labels, error association and readable selected states. Check 320px and 390px viewports, a representative desktop and 200% zoom; no clipped fields, hidden actions or sideways form scrolling.
4. Run `make js-test` and `make guardrail` in the implementation worktree. Pay particular attention to the existing role-runtime, role-slice, payment and subscription-workflow tests; add focused behavior coverage only if markup changes an interaction contract.
5. Use isolated Docker Compose browser checks, including the existing subscription-initials, subscription-person-details, recipient-address and marketing-preferences smoke scripts as applicable. Use controlled fixtures for submission coverage; do not create real customer transactions for visual evidence.

## Remaining unknowns and completion evidence

The mismatch is established by source review and the overall audit; this plan does not establish that every recipient/payer/product combination has been rendered. Available test fixtures for slow lookup, duplicate identities, multi-edition offers and pending/ambiguous submission must be confirmed before implementation acceptance. Record unavailable states explicitly instead of treating a screenshot of the happy path as full coverage. Completion requires the visual comparison, interaction results and any unresolved fixture gaps in the implementation PR.
