# theme_audit 04 — Customer search, records and data views

Audit marker: `theme_audit`. Status: accepted after independent source, visual and interaction review; PR #147 merged into the planning branch under explicit user authorization. Baseline: `c05973e`, 2026-11-09.

Coordination: [evaluation and slice index](../../../../plans/theme_audit.md), SC-206629. Depends on 01/02 and the workspace framing from 03; establish reusable person/address presentation before workflow slices 05–07.

## Implementation record

- Worktree: `/home/bartdeijkers/_worktrees/align-theme-customer-and-data-views`.
- Branch: `codex/align-theme-customer-and-data-views`.
- Base: accepted slice 03 at `80c7cdd81fee820636883fd2278028107feb94dc`, [PR #146](https://github.com/bindinc/kiwi/pull/146), unmerged at start and subsequently user-merged into the planning branch at `9f7c1f7d2e5a15e4f5d1a398f02802d46de585cf` on 2026-11-10. The merge tree is exactly identical to `80c7cdd` and contains that accepted head; no source rebase or baseline recapture is needed. PR #147 now targets the planning branch. Final slice 03 validation passed at run `42841343497`.
- PR: [#147](https://github.com/bindinc/kiwi/pull/147), created immediately after scaffold `b81db31` was pushed; English text, SC-206629 and one Unreleased changelog entry. Accepted closure `1c76db9` passed CI `43005522519` and merged at `13419fdfd51528b63fc281bab027303db96bebcb`. The user subsequently authorized #142's integration to main before slice 05; its separate combined-source checks are recorded in the central index. No deployment is authorized.
- Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-{10,11}/slice-04/`, outside Git. Preserve actual application, reference and explicit fixture classifications.
- Ownership: one application implementation agent; independent source review; slice 10 owner supplies focused Compose before/reference/after, keyboard and native-zoom checks. Parent owns this document, index, changelog and PR.
- Additional retained-editor gate: both the fixed heading and `customerEditorAddress` input/label prefix collide across retained dialogs. Allocate a stable opaque identifier for each new dialog, without changing map keys, field names, source identity, address-session ownership or draft retention. Existing smoke selectors must follow the active dialog and its declared address prefix; closing intentionally retains a dialog.

## Initial implementation checkpoint

The reviewed thirteen app/test/smoke files apply outlined customer/lookup actions, native table cells with inner flex groups, stable filter insets, distinct hover/current/focus treatments, compact sort/paging and flat record/subscription sections. Customer metadata has persistent labels. Shared editor/address help and error associations, readonly presentation and action groups use the same control grammar. Selected-row decoration compares normalized full source credentials rather than treating an unknown source as a wildcard.

Each new retained editor receives opaque, stable heading/status/address identifiers; reopening retains its draft and prefix. Context and resource options carry explicit sensitive annotations, while fixed UI copy remains public. No redaction algorithm, masking palette, request payload, source field name, version/permission gate or session ownership is replaced. The existing shared-address smoke discovers active-dialog address prefixes and expects retained close behavior instead of requiring dialog removal.

Historical initial source review: `source-review/review.json` and `review.md`, with exact thirteen-file hashes and the resolved identity/privacy findings. Implementer evidence: `implementation-static-checks/provenance.json`, `source-diff.patch` and logs for all 38 frontend files, six editor cases, 46 address cases, seven palette cases, eleven syntax checks, all guardrails and whitespace. All pass at that checkpoint. Its shared CSS hash is `ce75b9f50e3f48bb80ba3c2a8f2ba0acc39b3ce183a7610b1306adc141659937`; later actual-rendering findings and the final source boundary are recorded below.

The acceptance gates established at that checkpoint were actual Compose Twig, before/reference/after visual review, browser state/keyboard/draft/readonly/address checks, editor pseudonymization/restoration, unchanged-threshold privacy/theme integration and real 200% zoom. Their current results are recorded below; source approval alone does not complete this slice.

## Production-capture finding and verified correction — 2026-11-11

The focused Chromium run on `495631a` completed its numeric checks but failed independent visual privacy review. In the actual production `captureElementScreenshot` pseudonymized PNG, synthetic editor input values remain visible even though context text is replaced and the SDK reports `verified=true` with zero unresolved values. No feedback was submitted. This is a real acceptance failure, not an accepted counter result.

Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-04/independent-review/production-editor-privacy-finding.json` and the matching `after-focused-01/chromium/*editor-production-pseudonymized.png`. At that failing `495631a` snapshot the SDK files were unchanged from the pre-04 source. Actual browser clone/SVG diagnosis at `privacy-serialization-fix/diagnosis-before.json` confirms that a pseudonymized input property can serialize its original value attribute, selected form state can be lost before cloning completes, and a cleared checked property can retain its serialized attribute.

The bounded detached-clone correction at `97df611` is independently source-reviewed: current form state is copied after child cloning, then sanitized input values, textarea content and selected/checked attributes are serialized after pseudonymization. The Chromium SVG roundtrip and production mini-fixture PNG replace the original text/email values, with unchanged 700×294 dimensions and exact live DOM preservation. The previously unchanged sensitive input regions change by 542/928 pixels at the existing channel tolerance 64. Regression cases, all 38 frontend files, guardrails, syntax and whitespace pass; `privacy-serialization-fix/source-and-checks.json` and `independent-review/privacy-serialization-fix-source-review.json` retain exact source and review evidence.

Current full production captures also pass independent image review: Chromium changes all seven populated private input regions; Firefox changes its painted private input regions. Actual production capture preserves raw live DOM and field state exactly, retains public copy and keeps equal image dimensions. Existing header/custom-area privacy integration was separately rerun on product `d18bb540` in both browsers: Chromium changed 0.940%/1.503%/1.518% of the assessed regions with 0% outside-mask drift; Firefox changed 0%/0%/0.511% with 0.570% outside-mask drift, within the unchanged 2% maximum/channel tolerance 64. These integration figures do not substitute for the actual editor evidence.

Firefox's SVG foreignObject renderer paints the original native DATE input as a uniform opaque background despite a valid live ISO value and correct original serialized attribute. Only this precisely proven blank original DATE region uses a serialization proof: sanitized clone property and attribute agree, the original private value is absent, dimensions agree and live state is unchanged. Painted dates and all other input regions still require changed pixels. This is a renderer limitation, not evidence that an unchanged visible private value is safe. Live native date visibility/value preservation is a separate native-browser acceptance gate. Direct SDK restoration is semantically exact after normalizing inert empty style attributes introduced by the evidence screenshot; the stricter actual production-capture raw DOM comparison passes without that normalization.

## Current acceptance evidence — 2026-11-11

Evidence root: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-04/`. Product source is `d18bb5409da48320ac8014df901e48355338d13f`; `e8339d3` adds only the future slice 08 backdrop decision. Independent `independent-review/d18bb540-source-equivalence.json` verifies all 18 reviewed application/test files. The initial thirteen-file static report above remains a historical checkpoint, not the final source manifest.

| Gate | Current result and retained evidence |
| --- | --- |
| Actual before/reference | The original two-browser `2026-11-10/slice-04/before-attempt-01` captures are preserved and hashed. Missing expanded reusable-lookup states were recovered from exact accepted slice 03 `80c7cdd`, tree-identical to user merge `9f7c1f7`: `before-lookup-recovered-02`, 26 checks and 12 images per browser. The original artifacts remain unchanged. |
| Chromium customer/editor/lookup matrix | `after-focused-04/chromium`: 669 verified checks, zero deviations/runtime errors/unexpected writes, 133 images. Includes the three explicit user findings, actual record hierarchy, retained independent editors, address states, lookup keyboard behavior and production editor privacy. |
| Firefox customer/editor/lookup matrix | `after-focused-03/firefox`: 654 verified checks, one harness scroll-direction deviation, zero runtime errors/unexpected writes, 131 images. The deviation is resolved by `after-narrow-followup-01`: 412 verified checks, zero deviations/errors/writes, 80 images, including explicit address no-results and actual directional keyboard scrolling at 390px. Earlier failed setup/DATE probes remain preserved. |
| Broad, narrow and short sentinels | Chromium `after-stress-sentinels-02`: 564 verified checks, zero deviations/errors/writes, 108 images. Firefox stress: 563 verified checks, one divider pixel-coordinate deviation, zero runtime errors/writes, 108 images; resolved by `after-wide-pixel-followup`: 85 verified checks, zero deviations/errors/writes, 17 images. Covers 2048/1024/768/320 and 390×320 contexts. |
| Row separator and scrolling proof | Native table cells retain a common border across all six columns. Fractional CSS positions are checked at one shared raster Y within ±1px, distinct from both neighboring surfaces; columns cannot choose separate Y positions. Keyboard direction is chosen from the actual scroll position and must move the local table without document X drift. |
| Native lookup interaction | `d18bb540` limits the delegated Enter search handler to input targets. Actual native disclosure Enter/Space toggles without a search; input Enter and button Enter each search once. Meaningful regression tests fail on the old handler. |
| Actual OS 200% and reset | `native-customer-01`: Chromium 167 verified checks/33 captures and Firefox 165/29, zero deviations/errors/writes. Independent uncropped X11 image review passes for both, including filter/VIEW focus, record/contact hierarchy, address candidates and visibly populated, unchanged live DATE. Actual OS zoom changes Firefox CSS viewport 1440×1000 to 720×500 and Chromium 1050×1093 to 525×546; both verify DPR 1 to 2, pinch scale 1 and exact 100% reset. The Chrome reset zoom popover is reset evidence, not an unobscured header specimen. |
| Existing theme integration | Both browsers passed 106 assertions with 27 images each on the exact `10e6be8` checkpoint. Later table hover/sort focus, SDK serialization and lookup changes are covered by their current focused runs and source equivalence; older broad results are not relabeled as a full current-source run. |
| Tests, guardrails and CI | All 38 frontend files, editor/address regressions, palette, syntax, Compose Twig and guardrails pass in retained owner logs. Actions `42997661408` (SDK fix), `42999560762` (lookup fix) and `43003025319` (planning-only `e8339d3`) passed. Final closure-document head CI is a separate PR-readiness gate, recorded in the PR and local closure provenance. |

Independent source/image reviews and the exact report-to-criterion mapping are retained in `independent-review/criterion-report-map.md`. Numeric pass counts alone do not override a visual privacy rejection: `after-focused-01/chromium` remains explicitly rejected despite its green counters. No customer transaction or feedback submission was made; intercepted synthetic fixture requests are classified separately from unexpected writes.

The connected Shortcut tools cannot upload local files. Evidence remains outside Git with paths/hashes in the acceptance reports; no Shortcut image attachment is claimed. Ordinary modal background consistency is recorded as a mandatory slice 08 gate following the explicit user decision; it is not an unimplemented slice 04 criterion.

## Findings

The showcase separates search, selected context, record data and next actions using alignment, light separators and a restrained selection rule. Current search filters, customer records, subscriptions and editors mix rounded nested surfaces, dashed filter frames, colored action buttons and unrelated field geometries. The live desktop postcode/house-number row also extends its last input beyond its intended panel inset; page-level overflow checks alone do not detect this.

Current customer details mix customer identity, compact icon actions, colored service buttons, subscription cards and warning banners. The information remains present, but its hierarchy does not match the flat reference. This is a system-wide data-presentation slice, not an attempt to make real records identical to the showcase's simplified fictional record.

The populated result table exposes a P1 responsive defect at desktop width: its intrinsic minimum width expands the middle workspace track, producing a 1542px document in a 1440px viewport and pushing the right rail 102px offscreen. `followup-measurements.json` and `1440-results-confirmed.png` reproduce it. Coordinate the grid correction with slice 03 rather than hiding all page overflow and clipping data.

Follow-up source/browser review on 2026-11-10 also confirmed the pre-existing repeated `customer-editor-title` ID when multiple customer editors remain in the retained-dialog map. Slice 02 fixed its newly introduced selector-label collision with local wrapping labels; this older dialog-heading ID remains a slice 04 accessibility/context gate. Keep each retained dialog's heading association unambiguous without encoding private customer values into DOM IDs or changing draft/session ownership.

## Explicit user review backlog — 2026-11-10

These three rendered findings were supplied during slice 03 review. Their source corrections and actual equivalent before/reference/after states now pass the two-browser acceptance runs and independent image review recorded above.

| Finding | Current source and bounded correction | Required rendered acceptance |
| --- | --- | --- |
| Gray action on a gray row | Generated `Bekijken` uses `.btn.btn-small` without a semantic variant, retaining the browser's gray button surface. Apply the existing intended outlined secondary/quiet role to customer row and record actions; inventory other unclassified customer actions. Do not make every action filled primary or change selection/identify handlers. | Inspect default, hover, keyboard focus and disabled states against white, alternating subdued, hovered and selected rows in Chromium and Firefox. The action must remain visually distinct and agree with the rendered showcase; a passing text-contrast pair alone is insufficient. |
| Broken horizontal row separators | Classes on actual `td` elements (`.result-row-initials`, `.result-row-subscriptions`, `.result-row-actions`) currently set `display:flex`. Cells therefore paint individual-height borders rather than a continuous row boundary. Retain table-cell semantics and put any flex grouping inside cells. | Compare every cell bottom/separator in populated rows with one/two-line addresses, initials, multiple subscription badges and permitted extra actions. Lines must continue at the same row boundary through all columns at broad and locally scrolling narrow widths; sorting, row/action selection and privacy markers remain intact. |
| Filter hover lacks horizontal inset | `.additional-filters-toggle` currently uses block padding with zero inline padding. Give the disclosure and chevron deliberate shared horizontal insets in default/hover/focus/expanded states. Reserve space consistently so pointer hover does not move the text. | Actual pointer hover and keyboard focus must show comfortable space between text/chevron and the tinted surface edges, while staying inside the search card and retaining a minimum 40px target, disclosure behavior and translated/long labels. |

The supplied Firefox screenshots remain conversation evidence; no browser chrome or customer screenshot is committed to Git. The field-containment and global-frame fixes already implemented in 03 remain intact. The table records the original defects and required checks, rather than describing the corrected current source as defective.

## Code and reference

- [Customer search](customer-search-slice.js), [customer details](customer-detail-slice.js) and [base template](../../../../templates/base/index.html.twig): search/filter form, results, sorting/pagination, selected record, subscription summaries and customer actions.
- [Customer editor](../customer-editor.js), [address fields](../address-fields.js), address completion and address-gate modules: generated labels, field rows, address candidates and correction messages.
- [Shared CSS](../../../css/styles.css): search controls, `.results-table`, `.result-row`, customer-detail/header rules, `.subscription-item`, `.subscription-ended`, `.customer-editor`, `.address-fields` and relevant warning/empty states.
- [Showcase](../../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html#preview): `.search-input`, `.sidebar-result`, `.customer-card`, `.customer-header`, `.customer-grid`, `.preview-actions` and the restrained selected-person treatment.

The original planning captures under `/tmp/kiwi-styling-evaluation-2026-11-09/` are historical and no longer available after the environment restart. They are not current evidence links. Use the durable before/reference/after reports and images recorded above, including actual address-warning views and separately classified fixtures. No customer change was submitted by this audit.

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
