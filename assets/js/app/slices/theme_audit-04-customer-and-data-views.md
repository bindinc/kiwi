# theme_audit 04 — Customer search, records and data views

Audit marker: `theme_audit`. Status: implementation started; acceptance pending. Baseline: `c05973e`, 2026-11-09.

Coordination: [evaluation and slice index](../../../../plans/theme_audit.md), SC-206629. Depends on 01/02 and the workspace framing from 03; establish reusable person/address presentation before workflow slices 05–07.

## Implementation record

- Worktree: `/home/bartdeijkers/_worktrees/align-theme-customer-and-data-views`.
- Branch: `codex/align-theme-customer-and-data-views`.
- Base: accepted slice 03 at `80c7cdd81fee820636883fd2278028107feb94dc`, [PR #146](https://github.com/bindinc/kiwi/pull/146), still unmerged at start. Its final GitHub validation passed at run `42841343497`.
- PR: created immediately after the scaffold is pushed; English text, SC-206629 and one Unreleased changelog entry.
- Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-04/`, outside Git. Preserve actual application, reference and explicit fixture classifications.
- Ownership: one application implementation agent; independent source review; slice 10 owner supplies focused Compose before/reference/after, keyboard and native-zoom checks. Parent owns this document, index, changelog and PR.
- Additional retained-editor gate: both the fixed heading and `customerEditorAddress` input/label prefix collide across retained dialogs. Allocate a stable opaque identifier for each new dialog, without changing map keys, field names, source identity, address-session ownership or draft retention. Existing smoke selectors must follow the active dialog and its declared address prefix; closing intentionally retains a dialog.

## Findings

The showcase separates search, selected context, record data and next actions using alignment, light separators and a restrained selection rule. Current search filters, customer records, subscriptions and editors mix rounded nested surfaces, dashed filter frames, colored action buttons and unrelated field geometries. The live desktop postcode/house-number row also extends its last input beyond its intended panel inset; page-level overflow checks alone do not detect this.

Current customer details mix customer identity, compact icon actions, colored service buttons, subscription cards and warning banners. The information remains present, but its hierarchy does not match the flat reference. This is a system-wide data-presentation slice, not an attempt to make real records identical to the showcase's simplified fictional record.

The populated result table exposes a P1 responsive defect at desktop width: its intrinsic minimum width expands the middle workspace track, producing a 1542px document in a 1440px viewport and pushing the right rail 102px offscreen. `followup-measurements.json` and `1440-results-confirmed.png` reproduce it. Coordinate the grid correction with slice 03 rather than hiding all page overflow and clipping data.

Follow-up source/browser review on 2026-11-10 also confirmed the pre-existing repeated `customer-editor-title` ID when multiple customer editors remain in the retained-dialog map. Slice 02 fixed its newly introduced selector-label collision with local wrapping labels; this older dialog-heading ID remains a slice 04 accessibility/context gate. Keep each retained dialog's heading association unambiguous without encoding private customer values into DOM IDs or changing draft/session ownership.

## Explicit user review backlog — 2026-11-10

These three rendered findings were supplied during slice 03 review and remain unimplemented feature-presentation gates for slice 04. The existing broad action/table/filter requirements below do not count them as already resolved.

| Finding | Current source and bounded correction | Required rendered acceptance |
| --- | --- | --- |
| Gray action on a gray row | Generated `Bekijken` uses `.btn.btn-small` without a semantic variant, retaining the browser's gray button surface. Apply the existing intended outlined secondary/quiet role to customer row and record actions; inventory other unclassified customer actions. Do not make every action filled primary or change selection/identify handlers. | Inspect default, hover, keyboard focus and disabled states against white, alternating subdued, hovered and selected rows in Chromium and Firefox. The action must remain visually distinct and agree with the rendered showcase; a passing text-contrast pair alone is insufficient. |
| Broken horizontal row separators | Classes on actual `td` elements (`.result-row-initials`, `.result-row-subscriptions`, `.result-row-actions`) currently set `display:flex`. Cells therefore paint individual-height borders rather than a continuous row boundary. Retain table-cell semantics and put any flex grouping inside cells. | Compare every cell bottom/separator in populated rows with one/two-line addresses, initials, multiple subscription badges and permitted extra actions. Lines must continue at the same row boundary through all columns at broad and locally scrolling narrow widths; sorting, row/action selection and privacy markers remain intact. |
| Filter hover lacks horizontal inset | `.additional-filters-toggle` currently uses block padding with zero inline padding. Give the disclosure and chevron deliberate shared horizontal insets in default/hover/focus/expanded states. Reserve space consistently so pointer hover does not move the text. | Actual pointer hover and keyboard focus must show comfortable space between text/chevron and the tinted surface edges, while staying inside the search card and retaining a minimum 40px target, disclosure behavior and translated/long labels. |

Retain these findings as open until equivalent before/reference/after images and component bounds demonstrate the result. Current supplied Firefox screenshots are conversation evidence; no browser chrome or customer screenshot is committed to Git. The field-containment and global-frame fixes already implemented in 03 must stay intact.

## Code and reference

- [Customer search](customer-search-slice.js), [customer details](customer-detail-slice.js) and [base template](../../../../templates/base/index.html.twig): search/filter form, results, sorting/pagination, selected record, subscription summaries and customer actions.
- [Customer editor](../customer-editor.js), [address fields](../address-fields.js), address completion and address-gate modules: generated labels, field rows, address candidates and correction messages.
- [Shared CSS](../../../css/styles.css): search controls, `.results-table`, `.result-row`, customer-detail/header rules, `.subscription-item`, `.subscription-ended`, `.customer-editor`, `.address-fields` and relevant warning/empty states.
- [Showcase](../../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview): `.search-input`, `.search-result`, `.customer-card`, `.customer-card-head`, `.customer-card-grid`, record actions and the restrained selected-person treatment.

Live local captures are in `/tmp/kiwi-styling-evaluation-2026-11-09/`: `1440-results.png`, `390-results.png`, `1440-customer.png`, `390-customer.png`, and corresponding `customer-edit` images. The address-warning state is a real application state in this local data set. No customer change was submitted by this audit.

## Implementation boundary

1. Align search fields, labels, filter disclosure, sort controls and pagination with shared control/type/spacing rules. Give short fields an intentional width without violating the panel inset; allow long values to wrap or reveal fully.
2. Use a consistent result/list/table grammar: identity first, related data together, clear selection distinct from hover/focus, and stable actions. Retain meaningful column comparisons on narrow screens rather than turning every cell into a decorative card.
3. Flatten customer and subscription presentation into clear sections with restrained dividers and status labels. Keep active/ended/restitution states understandable without color alone; preserve the already corrected readability of ended subscriptions.
4. Apply the same field, label, help/error and action treatment to the customer editor, person lookup and shared address components. Preserve sensible two-column related fields; avoid removing useful grouping merely to imitate a smaller demo.
5. Normalize warning, pending verification, no-results, empty, loading, invalid and readonly presentation. Put correction/retry controls next to the affected context without making every notice the dominant page action.

History and queued work are slice 09. Workflow-specific recipient/payer and product arrangements are slice 05. This slice owns reusable identity/search/editor patterns they consume.

## Behavioral invariants

Preserve complete source identity, person IDs, source/mandant distinctions, current customer/session selection and subscription state meaning. Keep search filters, sorting, paging, additional-filter disclosure, stale-response guards and duplicate matching behavior. Preserve provider initials, address completion/confirmation, validation recovery, data masking, read-only permissions and draft retention. Do not change payload shapes or invent mandatory fields, defaults, consent or a new record schema.

Do not expose private values merely to create prettier screenshots. Use known local fixtures and retain visual evidence locally. Serialize shared CSS/template changes with other slices; use a dedicated implementation PR/worktree.

## Acceptance

- Search inputs and actions remain inside their panel at every supported width, including intrinsic browser-native input sizes and 200% zoom. The explicit gray-action, continuous-row-separator and padded-disclosure user-review gates above must each pass; none is deferred as cosmetic preference.
- Search, results, selected record and edit views visibly share the reference's type, spacing, surface and action hierarchy. Selected, hover, focus, invalid, loading and readonly states remain distinct.
- All input purposes have persistent associated labels; error/help associations survive rerendering. Long names, addresses, emails and source identifiers remain recoverable.
- Empty, populated, no-results, failed lookup/retry and address-correction paths are checked in context. Customer and subscription identities do not change as a consequence of layout work.
- Compare equivalent before/reference/after views at desktop and narrow widths in Chromium and Firefox. Include populated and expanded states, not only an empty record shell.
- Run relevant customer search/detail/editor/address and work-session suites plus palette guardrails when touched. Browser setup from existing smoke scripts may be reused, but do not execute their business mutations against real records.

Record which states used actual application data versus isolated fixtures. Complete only when both visual consistency and retained critical interactions have evidence.
