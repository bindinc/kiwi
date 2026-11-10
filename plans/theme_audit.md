# Kiwi styleguide evaluation and implementation slices

Audit marker: `theme_audit`

Date: 2026-11-09. Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629).

## Purpose and boundary

Evaluate the complete application against the reviewed Light & Shadow showcase, then define implementation slices beside the affected code. The reported radio outlines and new-subscription appearance are examples of a wider mismatch; they do not define the scope or receive exclusive priority.

PR #142 introduced this audit as documentation only. The authorized implementation now proceeds through separate stacked branches, worktrees and PRs, each with one changelog entry and applicable validation under the existing Shortcut workflow. Merge and deployment require separate explicit authorization.

## Implementation progress

Slice 10 started with a fresh baseline before slice 01 changes. Baseline provenance, screenshots and measurements are retained under `/tmp/kiwi-theme-audit-implementation/baseline`; implementation evidence is added per slice. Those temporary artifacts were subsequently lost; fresh, source-verified captures and current implementation evidence are retained in the durable directory described below. Runtime browser coverage and source review are reported separately.

| Slice | Current status | Branch / PR | Acceptance |
| --- | --- | --- | --- |
| 01 | Accepted; merged into planning branch | [#143](https://github.com/bindinc/kiwi/pull/143), merge `a627d2d`; local worktree/branch cleaned after authorization | Independent source/rendered review passed on 2026-11-09; historical temporary images are no longer accessible, as recorded in the slice document |
| 02 | Accepted; ready for PR review | `codex/align-theme-controls-and-actions` / [#145](https://github.com/bindinc/kiwi/pull/145), application `d39ed64` | Independent source/rendered review, 37-file suite, application CI, scoped broad/focused/keyboard/native-zoom checks and final Chromium/Firefox theme/privacy integration pass; test-only readiness correction `14eb8cc`, exact source boundaries in the slice document |
| 03–09 | Planned | Separate sequential branches after the preceding slice passes | Not accepted |
| 10 | Baseline and reusable checks in progress | `codex/validate-theme-showcase-alignment` / [#144](https://github.com/bindinc/kiwi/pull/144) | Baseline, source-bound comparison/controls runner and actual native zoom checks pushed at `62c7a8a`; final gate after 01–09 |

On 2026-11-10 the `/tmp` evidence from the original audit was found missing after an environment restart. Fresh source-verified original-baseline and standalone-reference captures are retained outside Git under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10`, with per-slice reports and current comparisons added there. Historical results are distinguished from available current artifacts; lost screenshots are not presented as accessible links.

## Reference and baseline

- The user references `/docs/kiwi-light-and-shadow-theme-palette-showcase.html`. This evaluation uses the repository's same-named [showcase](kiwi-light-and-shadow-theme-palette-showcase.html) under `plans/`; no equivalent file exists under `docs/` in this checkout, and a serving alias was not verified. If a separately served copy differs, resolve its provenance against the recorded hash before implementation acceptance.
- Compare the showcase's working customer/subscription examples and component grammar, not its documentation navigation, explanatory copy or fictional business data.
- The [showcase review](kiwi-light-and-shadow-theme-palette-review.md) documents the intended visual and interaction refinements. Its standalone verification is not application verification.
- Evaluated application baseline: `main` at `c05973e60cb0b4ede9b05e49c5b68b7b3962e7ee`, containing merged [PR #130](https://github.com/bindinc/kiwi/pull/130). The remote branch was checked on the audit date.
- The retained theme worktree at `5b3222e` has identical application assets, templates and scripts to that merge commit; it supplies the isolated local Docker Compose preview. This is not a claim about the deployed production version.

## Central finding

The palette plan and the reviewed showcase expressed different scopes. The [palette plan](kiwi-light-and-shadow-theme-palette.md) preserved existing layout and typography, while the showcase also defined flat surfaces, restrained corners, a spacing scale, consistent controls, outlined secondary actions and structured workspaces. PR #130 largely applied the color contract to the existing component systems. The separately refined datepicker is a narrower exception.

Consequently, matching palette values and passing contrast tests did not establish adoption of the showcase's design. The correction needs shared component rules plus workflow-by-workflow application, rather than another color replacement or isolated cosmetic patches.

## Target visual contract

The application should feel calm, precise and compact enough for repeated customer-service work. Record and product context come first, the next action second, and optional detail on demand.

- Use flat white work surfaces, restrained separators and intentional grouping. Reserve elevation for actual overlays.
- Adopt the showcase's 4/8/12/16/20/24/32/48 spacing scale and role-based insets. Its primary workflow examples use 20px desktop and 16px narrow panel insets.
- Use the existing system font with a compact, explicit hierarchy. Standard form labels and input text should follow the reference's approximately 13px/15px treatment and 40px control height; document purposeful dense variants.
- Use the reference's component-specific 0–4px corner treatments, not a blanket radius replacement. Preserve circular native controls, established state markers and the separately approved datepicker geometry where appropriate.
- Give each action region one filled primary action, outlined secondary actions and clear tertiary links. Remove decorative hover lift and shadow from routine controls.
- Use the reference's restrained selection rule and soft selected surface where they communicate selection. Keep selection, hover, keyboard focus, invalidity and operational status distinct.
- Preserve native control semantics, persistent labels, keyboard reachability and visible focus. Styling cannot hide an interactive control without an equivalent accessible replacement.
- Preserve all actual workflow capabilities, identities, data-action bindings, validation, availability, consent, privacy and submission semantics. The showcase's simplified business examples must not replace application logic.

## Implementation slices

Each linked document is located beside code it governs and contains the exact marker `theme_audit`.

| Slice | Adjacent implementation plan | Scope | Dependencies |
| --- | --- | --- | --- |
| 01 | [Foundations](../assets/css/theme_audit-01-foundations.md) | Spacing, typography, surfaces, borders, radii and elevation | Reference contract |
| 02 | [Controls and actions](../assets/css/theme_audit-02-controls-and-actions.md) | Native controls, labels, action hierarchy and shared states | 01 |
| 03 | [Shell and navigation](../templates/base/theme_audit-03-shell-and-navigation.md) | Application frame, profile/status menus and workspace rails | 01, 02 |
| 04 | [Customer and data views](../assets/js/app/slices/theme_audit-04-customer-and-data-views.md) | Search, results, customer details, editor and address fields | 01, 02, 03 |
| 05 | [Subscription workflow](../assets/js/app/slices/theme_audit-05-subscription-workflow.md) | Product, recipient, payer, payment and consent composition | 01, 02, 04 |
| 06 | [Article workspace](../assets/css/theme_audit-06-article-workspace.md) | Catalog, order list, totals, fields and calendar context | 01, 02, 04 |
| 07 | [Service workflows](../assets/js/app/slices/theme_audit-07-service-workflows.md) | Subscription editing, resend, complaints, winback, restitution and transfer | 01, 02, 04 |
| 08 | [Overlays, feedback and system surfaces](../assets/css/theme_audit-08-overlays-feedback-and-system-surfaces.md) | Dialogs, feedback/settings, notices and access/logout pages | 01, 02, 03 |
| 09 | [Operational states](../assets/js/app/theme_audit-09-operational-states.md) | Calls, ACW, disposition, history and outbox | 01, 02, 03; coordinate 08 |
| 10 | [Visual acceptance](../scripts/theme_audit-10-visual-acceptance.md) | Reference-based comparison and complete state/viewport matrix | Starts before 01; final gate after 03–09 |

Slice 10 is a cross-cutting acceptance plan, not a reason to postpone verification until the end. Capture representative before states first, and apply its relevant checks to every slice. Slices sharing `styles.css` or the base template must be integrated sequentially or explicitly coordinate ownership; they are not independent merely because their documents are separate.

## Prioritized findings

| Priority | Finding | Evidence and impact | Correction |
| --- | --- | --- | --- |
| P1 | Search results overflow the desktop workspace | At a 1440px viewport the populated results layout measures 1542px wide; the right rail extends 102px beyond the viewport. The table's intrinsic minimum width expands the center grid track. | 03/04 constrain the workspace and keep any necessary table scrolling inside its own region. |
| P1 | Hidden payment controls lose keyboard reachability | Existing payment radios use `display:none`; enabled inputs cannot receive focus. This is a functional accessibility failure, distinct from visual preference. | 02 fixes the shared pattern; 05/06 verify workflow variants. |
| P2 | Palette adoption preserved a conflicting component system | Current card/onepager/button rules retain larger radii, shadows, filled secondary actions and per-flow spacing. | 01–03 establish shared grammar; 04–09 apply it coherently. |
| P2 | Native-control styling depends on browser behavior | Global radio/checkbox outlines and broad input rules combine differently in Chromium and Firefox; the latter visibly renders square radio outlines. | 02 scopes text-control styling and verifies native controls in both engines. |
| P2 | Workflow density and hierarchy vary by implementation | Subscription, article, customer editor and feedback each use different insets, field geometry and nested surfaces. | 04–08 align composition while preserving workflow-specific information needs. |
| P2 | State styling lacks a shared hierarchy | Selection, status, secondary actions and informational panels use competing shapes and fills. | 02, 04 and 09 define and apply distinct state treatments. |
| P2 | Existing checks prove different properties | Palette tests assert colors and selected contrast pairs; the theme smoke even encodes a filled secondary hover, rather than the showcase's outline pattern. | 10 introduces an explicit reference contract and complete coverage matrix. |

These are consolidated root causes. Visual inconsistency is not labeled a functional blocker without observed interaction or accessibility evidence.

## Evidence and completion status

The audit combines source comparison, isolated native-control rendering and local browser inspection. Screenshots and computed-style records are local evidence under `/tmp/kiwi-styling-evaluation-2026-11-09`; do not commit screenshots or customer data. The source comparison covers all component families below; rendered coverage is deliberately reported separately from future implementation acceptance.

Reference SHA-256: `478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4`. The local reference was loaded directly from the repository HTML. Chromium inspection used Google Chrome `157.0.8103.38`, 1440×1000 and 390×1000 viewports, device scale 1, Dutch application language and reduced-motion preference. The focused Firefox inspection records its own native-control geometry; it is not a second complete application matrix. The local Compose project is `kiwi-theme-sc206629` and uses the fallback development login.

| Area | Audit evidence | Limit of this evaluation |
| --- | --- | --- |
| Shell, profile and session context | Source plus Chromium desktop/narrow shell, selected-customer and profile captures; Firefox profile capture | Active-call and every role permutation not replayed |
| Search, filters, result table and paging controls | Source plus populated local search in Chromium at both widths; repeated geometry confirms 102px desktop page overflow | Loading, network-error/retry and many-page states are specified in slice 10, not all replayed |
| Customer detail, editor, address and bank sections | Source plus local customer/detail/editor and address-warning views | Save, bank mutation, every address provider state and readonly variant not executed |
| New subscription | Source plus empty/disabled initial roles, payment/date/consent regions at both widths; focused Firefox enabled-payment keyboard checks | Populated product/recipient/payer combinations and submission outcomes remain implementation validation gates |
| Article sale and catalog | Source plus open article form, catalog dropdown and surrounding field geometry | Cart mutations, discount/coupon outcomes and order submission not executed |
| Delivery calendar | Source plus actual open calendar in its article context at both widths | Earlier keyboard/availability verification is historical; not rerun as a complete suite here |
| Existing service workflows | Source across all families; live edit-subscription, resend, editorial complaint and initial cancellation/winback views at both widths | No subscription change, complaint, cancellation, restitution or transfer submitted; later conditional branches source-reviewed only |
| Contact history | Source plus empty and populated real local timeline in the workspace | All categories/expanded details not replayed |
| Outbox | Source plus empty panel in local workspace | Queued, paused, error and retry states source-reviewed; prior synthetic fixtures are not current live proof |
| Calls, recording, ACW and disposition | Source review of actual modules/styles/template and existing test coverage | No live call/session simulation or disposition submission in this audit |
| Feedback and settings | Source plus settings and actual dialog rendering at both widths | Feedback preference remained unchanged; the installed hidden-button handler opened the dialog for component inspection. No feedback submitted, screenshot capture/redaction or annotation acceptance claimed |
| Account/system surfaces | Source plus logged-out and access-denied pages at both widths; a natural local success toast | All permission/error/success variants and development-only dialogs not replayed |

Evidence contains 44 Chromium PNG files (including four reference captures and targeted repeat captures), three Firefox PNG files, `audit-report.json`, `followup-measurements.json` and `firefox/control-measurements.json`. Counts are capture counts, not proof that every screen or state passed. Representative images were visually inspected alongside measured CSS and source. The initial narrow subscription capture was interrupted by an open profile-menu overlay; `390-subscription-top-confirmed.png` and `390-subscription-consent-confirmed.png` are the successful focused repeat. Prefer `*-results-confirmed.png` for result-layout inspection because the initial search captures retained an unhelpful scroll position.

The confirmed desktop grid measures `320px 770px 380px` tracks plus gutters; its right rail ends at x=1542 in a 1440px viewport. At 390px, the page itself stays within the viewport, but the history-first order remains a hierarchy problem. Per-element containment matters in addition to page width: a short search field exceeds its card inset, and article field rows need protection against intrinsic input widths. These observations are acceptance inputs for slices 02–04/06, not fixes in this PR.

Source-level and representative visual evaluation is complete for planning. Exhaustive runtime state coverage, screen-reader checks, native browser zoom and full cross-browser acceptance remain the explicit gates in slice 10. No new WCAG conformance claim is made. No business forms were submitted and no production version was inspected or changed.

The evaluation above records the original planning baseline. Current implementation and acceptance status are tracked in the progress table and each adjacent slice document. Approval or merge of the original documentation PR does not imply application acceptance.
