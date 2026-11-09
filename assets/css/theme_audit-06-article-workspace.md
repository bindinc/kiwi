# Slice 06 — Article workspace

Audit marker: theme_audit

Status: planned; documentation only. See the [audit index](../../plans/theme_audit.md) for the baseline, story, sequencing and evidence boundaries. Deliver this slice as one future implementation PR with its own worktree and changelog entry.

## Purpose and dependencies

Make recipient details, article selection, the order list and totals form one coherent workspace. The operator should be able to identify the recipient, inspect what will be ordered and find the final action without interpreting several unrelated panel styles.

Depends on **01 Foundations**, **02 Controls and actions**, and **04 Customer and data views**. Reuse their form, native-control, action and address primitives. Coordinate with slice 05 because both screens use `.onepager-container` and `.payment-option`; integrate shared stylesheet/template changes sequentially. Apply slice 10's acceptance matrix during this slice.

## Findings and reference

The [showcase](../../plans/kiwi-light-and-shadow-theme-palette-showcase.html) provides the applicable grammar in `.preview-shell`, `.button-secondary`, `.subscription-form-grid`, `.subscription-fields`, `.subscription-choice` and `.subscription-form-actions`: flat work surfaces, consistent control geometry, restrained selection and an explicit action hierarchy. It does not provide a complete article-order workflow. Translate that grammar to the real catalog/cart behavior instead of copying the showcase's subscription-specific business structure.

Source-confirmed deviations:

- `styles.css` gives `.article-sale-container` its own compact header, field, payment and button overrides, on top of generic onepager rules. Their geometry differs from both the showcase and other forms.
- `article-search.css` gives `.article-card` rounded borders, hover lift and shadows. `.order-items-list` wraps individual rounded `.order-item` surfaces; `.coupon-section` adds another dashed panel and `.order-summary` another strong enclosure. These layers compete with the actual order hierarchy.
- Several static recipient inputs use placeholders without persistent labels. Payment choices inherit the hidden-radio defect covered by slice 02.
- The final order action currently sits in the recipient column, while the item list and totals are in the other column. The visual and reading order needs explicit review so the final action follows the complete order context at both wide and narrow widths.

## Implementation targets

| File | Sections and responsibilities |
| --- | --- |
| [Article stylesheet](article-search.css) | Search results/dropdown, `.article-card`, `.order-items-section`, `.order-items-list`, `.order-item`, `.coupon-section`, discounts and `.order-summary`. |
| [Shared stylesheet](styles.css) | `.article-sale-container`, `.article-sale-columns`, left/right columns, scoped onepager overrides, payment and delivery-remark controls. Consume shared primitives rather than adding another parallel control system. |
| [Base template](../../templates/base/index.html.twig) | `#articleSaleForm`, `#articleForm`, recipient labels, payment choices, search/add controls, order context and final actions. |
| [Article search](../js/app/slices/article-search-slice.js) and [order slice](../js/app/slices/order.js) | Generated results/order-item markup and presentation hooks; preserve catalog, quantity, coupon and calculation behavior. |
| [Delivery date stylesheet](delivery-date-picker.css) and [date slice](../js/app/slices/delivery-date-picker-slice.js) | Regression-review targets. The separately approved calendar is retained; change only if a demonstrated integration defect requires it. |

## Desired visual contract

- Use one flat workspace with related field groups, light separators and purposeful width. Apply standard 20px desktop/16px narrow section insets, approximately 13px labels/15px field text and 40px controls from the dependencies. Remove conflicting article-only geometry unless a documented dense variant is necessary.
- Use a clear search-and-add region followed by a readable order list. Distinguish selected article, available action, item metadata, quantity and price through alignment and type hierarchy. Routine rows and cards do not lift or acquire decorative shadows on hover.
- Flatten the nested order/coupon/total panels into coherent sections. Align monetary amounts; retain readable discount details and remove controls. Totals should be easy to locate without surrounding every value in a badge or box.
- Place the final submission action after the relevant order summary in the visual and keyboard reading order. Treat add-to-order and coupon application as local actions, with a hierarchy distinct from committing the complete order; preserve meaningful warning/error states.
- Use persistent labels for recipient fields, visible native payment choices and the shared address treatment. Let long payment explanations and delivery notes wrap. At narrow widths, preserve the task sequence and all information instead of hiding the order summary.
- Retain the approved delivery calendar: seven columns, visible available dates, selected/today/unavailable distinctions, keyboard navigation, safe popup positioning and unobscured focus. Overlay elevation remains justified even though ordinary workspace panels become flat.

## Scope and interaction guards

Scope is composition, typography, spacing, surfaces, labels and responsive presentation of the existing article workflow. Do not introduce a new catalog view, order engine, coupon rule, payment route or delivery policy merely to match a reference example.

Preserve field IDs, input names/values, `data-action` hooks, localization and privacy markers. Preserve article search/filter selection, quantity minimums, add/remove behavior, empty-order handling, discounts/coupon application and removal, totals and existing error messages. A displayed price remains read-only; the UI must not substitute presentation values for authoritative calculations.

Preserve recipient/address validation, payment options, delivery-date eligibility and earliest-date behavior, hidden date value synchronization, delivery remark shortcuts, draft/session ownership, cancellation and submission guards. Moving the final action must not create a second submit handler or trigger submission when adding an item, applying a coupon or choosing a date.

## Acceptance and validation

1. Compare before/after actual application captures against the named reference grammar at a representative desktop and narrow widths. Include an empty order, multiple long article names, a discount, a coupon message and long delivery notes.
2. Exercise search loading/no-results/error/results, selection, quantity changes, item add/remove, empty/populated order, coupon success/error/removal and pending/error submission with controlled data. Totals and payloads must match the existing behavior.
3. Verify keyboard order, visible focus, native payment navigation, persistent labels and announced errors in Chromium and Firefox. Inspect 320px, 390px and desktop widths plus 200% zoom; fields, amounts, remove controls, actions and all seven calendar columns remain reachable.
4. Run `make js-test` and `make guardrail`. Review the existing article-search, order and delivery-date coverage; add behavior tests only for an interaction contract actually changed by markup. Run the relevant address and theme smoke checks through isolated Docker Compose.
5. Inspect calendar open/close, month navigation, earliest-date selection, unavailable dates, focus return and its relationship to the feedback launcher. Retain the approved calendar's behavior and geometry while checking the new surrounding layout.

## Remaining unknowns and completion evidence

The source establishes the competing component recipes; it does not establish which catalog layouts and large-order states are reachable for every role or data source. Confirm those entry paths and controlled fixtures before removing an apparently unused selector. Runtime coupon failures, slow searches and submission failures need explicit fixtures or a recorded coverage gap. The implementation PR must include visual comparisons, calculation/interaction results and remaining limitations; this plan is not runtime acceptance.
