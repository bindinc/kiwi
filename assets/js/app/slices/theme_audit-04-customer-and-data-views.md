# theme_audit 04 — Customer search, records and data views

Audit marker: `theme_audit`. Status: implemented and independently source-reviewed; rendered acceptance pending. Baseline: `c05973e`, 2026-11-09.

Coordination: [evaluation and slice index](../../../../plans/theme_audit.md), SC-206629. Depends on 01/02 and the workspace framing from 03; establish reusable person/address presentation before workflow slices 05–07.

## Implementation record

- Worktree: `/home/bartdeijkers/_worktrees/align-theme-customer-and-data-views`.
- Branch: `codex/align-theme-customer-and-data-views`.
- Base: accepted slice 03 at `80c7cdd81fee820636883fd2278028107feb94dc`, [PR #146](https://github.com/bindinc/kiwi/pull/146), unmerged at start and subsequently user-merged into the planning branch at `9f7c1f7d2e5a15e4f5d1a398f02802d46de585cf` on 2026-11-10. The merge tree is exactly identical to `80c7cdd` and contains that accepted head; no source rebase or baseline recapture is needed. PR #147 now targets the planning branch. Final slice 03 validation passed at run `42841343497`.
- PR: draft [#147](https://github.com/bindinc/kiwi/pull/147), created immediately after scaffold `b81db31` was pushed; English text, SC-206629 and one Unreleased changelog entry.
- Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-04/`, outside Git. Preserve actual application, reference and explicit fixture classifications.
- Ownership: one application implementation agent; independent source review; slice 10 owner supplies focused Compose before/reference/after, keyboard and native-zoom checks. Parent owns this document, index, changelog and PR.
- Additional retained-editor gate: both the fixed heading and `customerEditorAddress` input/label prefix collide across retained dialogs. Allocate a stable opaque identifier for each new dialog, without changing map keys, field names, source identity, address-session ownership or draft retention. Existing smoke selectors must follow the active dialog and its declared address prefix; closing intentionally retains a dialog.

## Implemented changes and current verification

The reviewed thirteen app/test/smoke files apply outlined customer/lookup actions, native table cells with inner flex groups, stable filter insets, distinct hover/current/focus treatments, compact sort/paging and flat record/subscription sections. Customer metadata has persistent labels. Shared editor/address help and error associations, readonly presentation and action groups use the same control grammar. Selected-row decoration compares normalized full source credentials rather than treating an unknown source as a wildcard.

Each new retained editor receives opaque, stable heading/status/address identifiers; reopening retains its draft and prefix. Context and resource options carry explicit sensitive annotations, while fixed UI copy remains public. No redaction algorithm, masking palette, request payload, source field name, version/permission gate or session ownership is replaced. The existing shared-address smoke discovers active-dialog address prefixes and expects retained close behavior instead of requiring dialog removal.

Independent source review: `source-review/review.json` and `review.md`, with exact thirteen-file hashes and the resolved identity/privacy findings. Implementer evidence: `implementation-static-checks/provenance.json`, `source-diff.patch` and logs for all 38 frontend files, six editor cases, 46 address cases, seven palette cases, eleven syntax checks, all guardrails and whitespace. All pass. Shared CSS hash at freeze is `ce75b9f50e3f48bb80ba3c2a8f2ba0acc39b3ce183a7610b1306adc141659937`.

Actual Compose Twig, before/reference/after visual review, browser state/keyboard/draft/readonly/address checks, editor pseudonymization/restoration, unchanged-threshold privacy/theme integration and real 200% zoom remain acceptance gates. Source approval alone does not complete this slice.

## Open production-capture acceptance finding — 2026-11-11

The focused Chromium run on `495631a` completed its numeric checks but failed independent visual privacy review. In the actual production `captureElementScreenshot` pseudonymized PNG, synthetic editor input values remain visible even though context text is replaced and the SDK reports `verified=true` with zero unresolved values. No feedback was submitted. This is a real acceptance failure, not an accepted counter result.

Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-04/independent-review/production-editor-privacy-finding.json` and the matching `after-focused-01/chromium/*editor-production-pseudonymized.png`. The existing SDK files are unchanged from the pre-04 source. Actual browser clone/SVG diagnosis at `privacy-serialization-fix/diagnosis-before.json` confirms that a pseudonymized input property can serialize its original value attribute, selected form state can be lost before cloning completes, and a cleared checked property can retain its serialized attribute.

The bounded detached-clone correction is implemented and independently source-reviewed: current form state is copied after child cloning, then sanitized input values, textarea content and selected/checked attributes are serialized after pseudonymization. The actual Chromium SVG roundtrip and production mini-fixture PNG now replace the original text/email values, with unchanged 700×294 dimensions and exact live DOM preservation. The previously unchanged sensitive input regions now change by 542/928 pixels at the existing channel tolerance 64. Regression cases, all 38 frontend files, guardrails, syntax and whitespace pass; `privacy-serialization-fix/source-and-checks.json` and `independent-review/privacy-serialization-fix-source-review.json` retain exact source and review evidence. Original/live form values, drafts, permissions, masking palette, capture targets and fidelity thresholds remain protected. Acceptance requires meaningful serialization regressions, actual original/pseudonymized input pixel comparisons, independent image review and both-browser production capture evidence. Existing header-only privacy integration does not establish this editor route. Slice 04 remains open until the defect is fixed and these gates pass.

## Findings

The showcase separates search, selected context, record data and next actions using alignment, light separators and a restrained selection rule. Current search filters, customer records, subscriptions and editors mix rounded nested surfaces, dashed filter frames, colored action buttons and unrelated field geometries. The live desktop postcode/house-number row also extends its last input beyond its intended panel inset; page-level overflow checks alone do not detect this.

Current customer details mix customer identity, compact icon actions, colored service buttons, subscription cards and warning banners. The information remains present, but its hierarchy does not match the flat reference. This is a system-wide data-presentation slice, not an attempt to make real records identical to the showcase's simplified fictional record.

The populated result table exposes a P1 responsive defect at desktop width: its intrinsic minimum width expands the middle workspace track, producing a 1542px document in a 1440px viewport and pushing the right rail 102px offscreen. `followup-measurements.json` and `1440-results-confirmed.png` reproduce it. Coordinate the grid correction with slice 03 rather than hiding all page overflow and clipping data.

Follow-up source/browser review on 2026-11-10 also confirmed the pre-existing repeated `customer-editor-title` ID when multiple customer editors remain in the retained-dialog map. Slice 02 fixed its newly introduced selector-label collision with local wrapping labels; this older dialog-heading ID remains a slice 04 accessibility/context gate. Keep each retained dialog's heading association unambiguous without encoding private customer values into DOM IDs or changing draft/session ownership.

## Explicit user review backlog — 2026-11-10

These three rendered findings were supplied during slice 03 review. Their corrections are implemented in the source-reviewed slice 04 snapshot, but remain open until rendered acceptance proves the result. The existing broad action/table/filter requirements below do not count them as already resolved.

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
- [Showcase](../../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview): `.search-input`, `.sidebar-result`, `.customer-card`, `.customer-header`, `.customer-grid`, `.preview-actions` and the restrained selected-person treatment.

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
