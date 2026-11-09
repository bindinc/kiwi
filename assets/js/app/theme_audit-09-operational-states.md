# theme_audit 09 — Align operational state presentation

Status: planned; documentation only. This file does not authorize or implement runtime changes.

Parent plan: [theme_audit implementation slices](../../../plans/theme_audit.md). Reference: [Light & Shadow showcase](../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html), especially its operational-state specimens, restrained surfaces, action hierarchy and spacing. The showcase has no complete call-console or outbox workflow; apply its shared visual rules without inventing equivalent business behavior.

## Outcome and dependencies

Present call handling, contact history and queued changes as parts of the same application. Keep the active customer, operation, state and next permitted action identifiable. State color supports a readable label or icon; it does not replace either.

Depends on [01 — foundations](../../css/theme_audit-01-foundations.md), [02 — controls and actions](../../css/theme_audit-02-controls-and-actions.md), and [03 — shell and navigation](../../../templates/base/theme_audit-03-shell-and-navigation.md) for the agreed shared contracts and workspace framing. Coordinate with the shell, dialog/form and feedback slices before changing shared selectors. Use [theme_audit 10](../../../scripts/theme_audit-10-visual-acceptance.md) for acceptance evidence. Resolve the remaining dependency filenames through the parent index rather than introducing another token vocabulary in this slice.

## Source scope and observed gaps

| Surface | Primary source | Source-grounded finding to resolve |
| --- | --- | --- |
| Call queue, active call, hold, recording and ACW | [styles.css](../../css/styles.css), [index.html.twig](../../../templates/base/index.html.twig), [call-agent-runtime.js](call-agent-runtime.js), [call-session-slice.js](slices/call-session-slice.js) | Separate bars and actions retain their own padding, radii, shadows, uppercase labels, monospace timers and motion rules. Palette replacement alone did not establish a shared operational hierarchy or responsive treatment. |
| Disposition and follow-up | [acw-disposition-slice.js](slices/acw-disposition-slice.js), [disposition-categories.js](disposition-categories.js), [index.html.twig](../../../templates/base/index.html.twig), [styles.css](../../css/styles.css) | Disposition styling is distributed across shared modal rules and repeated disposition-specific blocks. It needs verification in the actual dialog, including conditional fields and validation. |
| Contact-history timeline | [contact-history-slice.js](slices/contact-history-slice.js), [legacy-app-state.js](legacy-app-state.js), [styles.css](../../css/styles.css) | Event categories use semantic tones, but event typography, density, icons, separators and temporary highlighting still need comparison with the agreed reference. Correct tone names do not prove correct visual treatment. |
| Outbox list, action menu, details and editor | [session-outbox.js](session-outbox.js), [outbox-presentation.js](outbox-presentation.js), [session-outbox.css](../../css/session-outbox.css), [index.html.twig](../../../templates/base/index.html.twig) | The outbox already uses restrained rows and a native top-layer action menu. Reconcile it with shared controls and dialogs without replacing this useful behavior or adding decorative cards. Existing theme coverage demonstrates only a synthetic paused row. |

These are source observations and implementation targets, not a claim that every state has been visually inspected. Add measured screenshots and computed-style findings to the implementation review.

## One operational presentation model

Use a common ordering: **identity → state → relevant timing/details → permitted action**. Preserve the location and visibility of information needed to act safely.

- Use the shared type and spacing scales for labels, metadata and actions. Prefer tabular numerals within the product font for timers unless an existing requirement justifies a different face. Do not change timing calculations.
- Keep ordinary rows and information areas flat. Reserve elevation for actual overlays such as menus and dialogs. Remove duplicated framing, saturated fills and decorative movement where they do not communicate state.
- Distinguish primary progression, secondary actions and destructive actions using the shared control contract. A successful or available state does not make every adjacent action a filled green primary button.
- Preserve semantic success, warning, danger and recording meanings. Neutralize incidental presentation without converting operational colors into arbitrary palette accents.
- Retain labels for status, recording, pending work and uncertainty. Inspect the actual foreground/background combinations, including inherited backgrounds, opacity, hover and focus.
- Reuse the established icon family for ordinary controls where the shared contract requires it. Do not silently remove meaningful state symbols before an equivalent label/icon treatment is verified.

## Implementation sequence

### 09a — Call handling and disposition

1. Inventory the actual queue, active-call, hold, recording and ACW combinations rendered by the runtime. Include anonymous and identified callers, long names/service labels and simultaneous indicators.
2. Align the bars' typography, horizontal rhythm, state emphasis and action spacing with the shared contract. Keep essential state and actions visible when content wraps. Do not hide caller identity, recording state, the elapsed timer or the required completion action to make a narrow screenshot fit.
3. Align disposition with shared dialog anatomy: heading, context, labeled fields, conditional follow-up, errors and actions. Resolve duplicate selector overrides in the smallest applicable source block rather than appending another broad override layer.
4. Preserve keyboard reachability and visible focus on both light and dark backgrounds. Verify long forms, scrolling, Escape/cancel and return focus using the actual dialog.
5. Remove decorative pulse/translation effects only where they do not encode essential state; preserve an intelligible static state and respect reduced-motion preferences.

### 09b — Contact history

1. Apply the same type scale, row rhythm, separators and metadata placement to every supported event category, including the default/unknown category.
2. Retain the event description, timestamp, category and existing caller/subscription context. Keep long descriptions readable without allowing a badge or icon to dominate the row.
3. Verify each tone on both its resting surface and the temporary highlight surface. A pair tested on white is insufficient when the actual row is highlighted.
4. Preserve current ordering, insertion, highlighting duration and customer scoping. Do not change event payloads or persistence to simplify presentation.

### 09c — Outbox

1. Align list heading, count, customer title, change/contributor metadata, status and actions with the same hierarchy. Preserve the distinction between an editable customer title and a non-interactive title.
2. Cover every current status: `pending`, `paused`, `ready`, `processing`, `completed`, `failed`, `uncertain` and `cancelled`, plus unknown-status fallback. Keep uncertainty distinct from success or failure.
3. Align the native popover, change disclosure and editor with shared menu/dialog controls. Check edge positioning, scroll boundaries, keyboard opening, Escape and focus restoration. Keep destructive actions explicit.
4. Verify empty/loading/error/stale-data states and long customer names, contributor labels, operation summaries and large change counts. Retain the stale-data message when refresh fails.
5. Keep fine-pointer hover disclosure usable by keyboard and coarse pointers. Focusable actions must not become invisible or unreachable when the row is not hovered.

Each substep can be reviewed separately, but the slice is complete only when all three areas use the same agreed grammar. Do not close it after styling the call bars alone.

## Behavioral invariants

- Preserve availability, queue and call state transitions, hold/resume, recording indication, ACW completion rules, disposition categories, required fields and follow-up behavior.
- Preserve event types, labels, order, customer identity and contact-history persistence. A style audit must not emit synthetic events into a real customer's history.
- The server continues to own outbox membership, deadlines, revisions and capabilities. Keep revision headers, idempotency keys, pause/resume behavior and unsaved-editor protection unchanged.
- Keep outbox edit/pause/resume/delete visibility derived from server capabilities. Styling must not expose an action that the current item or role cannot perform.
- Do not treat an outbox label, a timer reaching zero or a successful UI action as proof of downstream completion.
- Keep privacy annotations, masking, source logos and third-party styles outside operational recoloring.

## Acceptance criteria

- [ ] Queue, active call, hold, recording, ACW, disposition, timeline and outbox are all represented in the review, with screenshots identified by actual state.
- [ ] Shared spacing, typography, radii, action hierarchy and elevation match slices 01/02; any deliberate exception has a concrete operational reason.
- [ ] Every meaningful state has a text/icon indication in addition to color. Text and required controls meet the agreed contrast criteria on their actual surfaces.
- [ ] Desktop, narrow and short-height checks show no clipped identity, essential action, timer, popover or focused control. Long content remains readable.
- [ ] Keyboard-only users can enter and leave menus/dialogs and reach revealed actions. Focus is visible and restored to a sensible control.
- [ ] State transitions, event content, server capability checks and outbox concurrency behavior are unchanged.
- [ ] Real rendered operational surfaces pass review; synthetic class fixtures are retained only as supplemental coverage and are labeled as such.
- [ ] The shared visual report records untested or inaccessible states explicitly rather than counting them as passed.

## Validation using existing entry points

Run from the implementation worktree:

```bash
node --test tests/frontend/app/call-agent-runtime.test.mjs tests/frontend/app/disposition-categories.test.mjs tests/frontend/app/session-outbox.test.mjs tests/frontend/app/slices/call-session-slice.test.mjs tests/frontend/app/slices/contact-history-slice.test.mjs
make js-test
make guardrail
git diff --check
```

On an isolated Docker Compose fixture stack, run the existing theme checks in both supported validation browsers:

```bash
KIWI_SMOKE_BROWSER=chromium make compose-smoke-theme
KIWI_SMOKE_BROWSER=firefox make compose-smoke-theme
```

These commands currently cover only selected operational class fixtures. Extend the scenario coverage to the real states above; passing them unchanged does not satisfy this slice. The existing [outbox smoke](../../../scripts/compose-smoke-session-outbox.mjs) supplies useful selectors and a behavioral regression scenario, but it cancels and writes synthetic customer changes and expects the documented fixture gateway on port 9443. Run it only against that isolated fixture setup; never use it as a read-only production inspection command. The [lightbox draft harness](../../../scripts/smoke-lightbox-drafts.mjs) can supplement dialog checks without a live customer service.

Store review screenshots outside the repository unless their inclusion is explicitly requested. Record source commit, browser, viewport, locale, role, fixture state and whether the capture is a real application flow or an isolated component fixture.
