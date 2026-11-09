# Kiwi styleguide evaluation and implementation slices

Audit marker: `theme_audit`

Date: 2026-11-09. Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629).

## Purpose and boundary

Evaluate the complete application against the reviewed Light & Shadow showcase, then define implementation slices beside the affected code. The reported radio outlines and new-subscription appearance are examples of a wider mismatch; they do not define the scope or receive exclusive priority.

This PR changes documentation only. It does not implement the slices, change business behavior, create customer transactions, merge implementation work, release an image or deploy Kiwi. Each future implementation slice needs its own branch, worktree, PR, changelog entry and applicable validation under the existing Shortcut workflow.

## Reference and baseline

- The user-facing reference `/docs/kiwi-light-and-shadow-theme-palette-showcase.html` corresponds to the repository's [showcase](kiwi-light-and-shadow-theme-palette-showcase.html). The source file is under `plans/`; no equivalent file exists under `docs/` in this checkout.
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
| P1 | Hidden payment controls lose keyboard reachability | Existing payment radios use `display:none`; enabled inputs cannot receive focus. This is a functional accessibility failure, distinct from visual preference. | 02 fixes the shared pattern; 05/06 verify workflow variants. |
| P2 | Palette adoption preserved a conflicting component system | Current card/onepager/button rules retain larger radii, shadows, filled secondary actions and per-flow spacing. | 01–03 establish shared grammar; 04–09 apply it coherently. |
| P2 | Native-control styling depends on browser behavior | Global radio/checkbox outlines and broad input rules combine differently in Chromium and Firefox; the latter visibly renders square radio outlines. | 02 scopes text-control styling and verifies native controls in both engines. |
| P2 | Workflow density and hierarchy vary by implementation | Subscription, article, customer editor and feedback each use different insets, field geometry and nested surfaces. | 04–08 align composition while preserving workflow-specific information needs. |
| P2 | State styling lacks a shared hierarchy | Selection, status, secondary actions and informational panels use competing shapes and fills. | 02, 04 and 09 define and apply distinct state treatments. |
| P2 | Existing checks prove different properties | Palette tests assert colors and selected contrast pairs; the theme smoke even encodes a filled secondary hover, rather than the showcase's outline pattern. | 10 introduces an explicit reference contract and complete coverage matrix. |

These are consolidated root causes. Visual inconsistency is not labeled a functional blocker without observed interaction or accessibility evidence.

## Evidence and completion status

The audit combines source comparison, isolated native-control rendering and local browser inspection. Detailed coverage and limitations will be recorded here before this documentation PR is finalized. Screenshots and computed-style records are local evidence under `/tmp/kiwi-styling-evaluation-2026-11-09`; do not commit screenshots or customer data.

All implementation slices remain **planned**, not completed. Approval or merge of this documentation PR does not imply that the application has been restyled, deployed or accepted.
