# theme_audit 09 — Align operational state presentation

Status: implementation and rendered acceptance in progress. Original08-source BEFORE and the b4 multiple-record supplement are independently sealed. Readonly and component desktop record scopes pass independent rendered review. Targeted outbox-focus and search-language corrections pass source review; their fresh rendered checks, remaining environment checks and validity decision remain open. Slice09 is not accepted.

Parent plan: [theme_audit implementation slices](../../../plans/theme_audit.md). Reference: [Light & Shadow showcase](../../../plans/kiwi-light-and-shadow-theme-palette-showcase.html), especially its operational-state specimens, restrained surfaces, action hierarchy and spacing. The showcase has no complete call-console or outbox workflow; apply its shared visual rules without inventing equivalent business behavior.

## Implementation record — 2026-11-12

- Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629), retained in progress for slices09–10.
- Worktree: `/home/bartdeijkers/_worktrees/align-theme-operational-states`.
- Branch: `codex/align-theme-operational-states`; draft PR [#154](https://github.com/bindinc/kiwi/pull/154).
- Base: main `861b386f8d3013b4c4c8ed89b7ada4e8cc64e101`, the user's merge of accepted08 [#152](https://github.com/bindinc/kiwi/pull/152). Its complete tree equals accepted documentation head `e036b49`; application source remains equivalent to validated `e0e5822`.
- Scope: calls/recording/ACW/disposition, all contact-history categories and outbox states, including the existing five-second refresh/focus failure. All three areas must pass before closure.
- Evidence: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-12/slice-09/`, outside Git and retained beside worktrees.
- Ownership: one application writer, one independent source/actual-image reviewer and one browser/PR144 tooling owner. Root owns this audit/index/changelog, PR, runtime and Git. Shared application files are edited serially.
- Initial checks: documentation-only scaffolding and whitespace; source, browser and behavioral acceptance remain open. One changelog entry is reserved for this PR and amended as implementation completes. No merge, deployment or cleanup is authorized.

## Customer record overview revision — 2026-11-13

The user chose **all records visible per data type, with validity and an individual view/edit action**. Record lists replace the section dropdowns. One selected form per section repeats its ordinal and sensitive summary; person singleton remains initially open. Desktop2/12-record review confirms the selected identity and naturally focused first field remain clear. Narrow/short checks and reverse keyboard return remain open. New copy uses the existing Dutch/English localization.

Remove only the redundant customer-detail X beside Editorial complaint. New session, controller/router compatibility, exact source IDs/credentials, null-ID/read-only gates, versions/idempotency/readback, masked banks, dirty cancellation/reset/reopen, unique address prefixes and privacy annotations remain protected. All replacement row/create actions lock during submission; synthetic events also respect the existing disabled bank/delete/reset gates.

The current PPA Snapshot exports IDs and editable values without validity intervals. The supplied PPA contract has an as-of `validitydate` selector/defaultcurrent but no contact start/end fields. Anonymous newer-documentation checks returned404 or redirected to SSO, without credentials/customer lookup. Current copy is **Geldigheid niet beschikbaar / Validity unavailable**. Actual periods remain unfulfilled and the fallback decision is pending; no current/future status is inferred from array order.

Evidence is durable under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/`. The b4 supplemental BEFORE closure `354e664ed1beb96241d82ebdec86d2083d71a01a79d2ab048220ea88f980e2a0` seals two Chromium1440/390 contexts:18 states/28 matching served bodies/two exact readonly GETs each, zero errors/business writes. All36 whole frames were reviewed. Visible X/New session is proven; complaint adjacency is DOM-only because source policy hid that action. Original08/ref478 BEFORE remains immutable:11 contexts/506 frames, aggregate394b33fd and closureef28ae1a.

The six-file record candidate is frozen in `records-implementation/candidate-01/manifest.json`, SHA-256 `d96172a15df6351143219ca5a60959f24e948bdc9e01c781b667769b1bbfbbd4`. Independent source review `6ddccc61631d1b0b9289aad2585ade7816564397c20e472b0d05d08d1cb9dbba` verifies patch, protected regions and logs:15 focused tests,45 frontend files, three guards, syntax, whitespace and CSS parsing pass. Compose Twig lint also passes. New committed/runtime proofs and exact AFTER tooling precede browser release; no rendered acceptance follows these static checks.

### Rendered progress and outbox correction

Evidence paths below are relative to the durable Nov13 slice09 directory. These are finite scopes, not full slice acceptance; failed attempts remain preserved.

| Scope | Actual checks and evidence | Independent outcome |
| --- | --- | --- |
| Readonly record lists, Chromium1440, two and twelve records | `after-records-02`:26 whole application frames plus two reference frames, exact served-source checks and source-shaped readonly GET fixtures; no mutations or unexpected requests. | `independent-review/records-after-readonly-rendered-review-01.json`, `ac31a76e`:all28 whole frames reviewed. Selected identity and desktop reachability pass; actual periods and other environments remain open. |
| Separate synthetic writable component contexts | `after-records-component-01`:32 whole application frames plus two references. Exact person/email PATCH requests are held and locally answered503; no upstream business write or source capability activation. Draft cancellation, confirmation, reset, pending locks and failed-value retention pass. | `independent-review/records-after-component-rendered-review-01.json`, `c7a3cf7c`:all new whole frames reviewed. Raw writable salutation and exact source identities are preserved; email reopen retention is a DOM assertion, not a claim that the reopened viewport shows its error. |
| Operational desktop | `after-preflight-02` operational report:86 whole frames, all history categories and outbox states, real five-second refresh scenarios. Natural Tab scrolls the disposition footer fully into view, including the focused action perimeter. The containing attempt remains failed because the separate feedback context hit a tooling text-boundary assertion. | `independent-review/general-after-operational-rendered-review-01.json`, `ec4649f9`:all86 whole frames reviewed. A clipped fallback-row focus perimeter remains an actual finding; the rest of this scope cannot close09. |
| Summary and visible feedback desktop | `after-feedback-01`:27 whole application frames plus two references. Exact per-node zero/singular/plural counts, live NL/EN/NL with unchanged query count, and actual visible feedback/settings entry pass. | `independent-review/feedback-after-rendered-review-01.json`, `6d571f9d`:all27 whole application frames reviewed. A separate title/range language-switch defect remains open; summary wording itself passes. The earlier whole-container text assertion failure is retained. |

The independently observed outbox fallback row is fully inside its scrolling list, but its inherited3px outline plus3px outward offset is clipped at the list edges. The targeted readonly diagnostic `after-outbox-focus-diagnostic-01` confirms this is an outward-perimeter issue, with scrollTop0 and no row-border-box clipping. The correction adds only a scoped3px inset outline to the focused outbox row. It changes no JavaScript, refresh timing, scroll behavior, server capability, request or draft logic. Candidate `outbox-focus-correction/candidate-01/manifest.json` (`788084ed`) preserves all213 other production bodies exactly. New committed/runtime proof, independent source review and actual corrected-row checks precede the wider browser matrix.

The native language-switch frames also exposed stale static title/range translations: actual one/three-row results retained their correct compact count, but the range became the fictional1–20 of153 and the title lost its query. The bounded correction refreshes only metadata from accepted cached results and a request-start display-filter snapshot. It never rebuilds rows, changes the selected customer, closes a retained workspace, scrolls or performs a request. Older responses cannot replace the latest accepted snapshot, and unsent filter edits do not rename existing results. The two stale Twig annotations and fictional placeholder are removed; existing translation keys are reused without putting the raw query in DOM parameters.

`search-metadata-correction/candidate-01/manifest.json` (`253415e4`) freezes three production files and one existing test file against committed outbox correction `73ce992`. Independent source review `independent-review/search-metadata-candidate01-source-review-01.json` (`3232f367`) verifies all214 bodies:three changed/211 unchanged, with the inset outbox CSS retained. Focused tests cover real locale lifecycle calls for zero/one/three results, page2, explicit result injection, unsent filters, retained row/selection/focus/visibility/scroll/API state and overlapping requests; all45 frontend files, three guards, syntax and whitespace pass. Fresh native browser frames must prove the visible correction before accepting that criterion.

All original calls/history/outbox requirements remain. Preparatory final10 registry source review passed, but all78 area/environment cells remain unreviewed. No merge, production deployment or cleanup is authorized.

## Additional user-directed modal refinements — 2026-11-12

The follow-up feedback after merged08 extends this PR without replacing any operational-state requirement:

- Replace the permanently framed, small feedback close glyph with the existing quiet customer-close grammar: a clear centered cross, 40px target, subtle hover and accessible close name. Preserve native dismissal, focus return, drafts and in-flight guards in every affected dialog.
- Replace the separated heavy input-focus ring with a single flush 2px boundary (offset0, no extra shadow). Keep a visibly contrasting full focus perimeter, no layout shift, complete text-entry coverage and the approved dark-toolbar/native-datepicker exceptions. Actual before/after keyboard images decide visual quality; color checks alone do not.
- In the readonly customer editor opened by **Gegevens bekijken**, label the displayed field **Geslacht** and format the personal summary and field using the three confirmed exact aliases: `Geachte heer`→`Man`, `Geachte mevrouw`→`Vrouw`, `Geachte heer/mevrouw`→`Anders`. Match case/trim only; never use substring inference. Unknown/blank values remain unchanged. Writable Aanhef values, summaries, reset/change comparison, PATCH payloads, original source data and the letter salutation normalizer remain unchanged.
- Replace the search-summary grey framed card and heavy green phrase with a compact, left-aligned status and the existing clear results link. Preserve the count-only `resultCount` ID and search/filter/pagination/navigation/privacy behavior. Use **1 klant gevonden** versus **klanten gevonden**, with matching English customer/customers wording and correct live language changes. Check zero, one and multiple results plus desktop/narrow and keyboard link activation. This follow-up is tracked before implementation in SC-206629 comment207082.

The original showcase snapshot/hash478a remains immutable BEFORE evidence. Any approved focus/close reference refinement must carry a new hash and its explicit user decision. Supplemental actual readonly fixture and close/focus observations are required before application acceptance. No user test identity is copied into fixtures or story comments.

## Immutable BEFORE and parallel implementation boundary

The original09 scaffold `f1c489f` is frozen in `before-originals-01/manifest.json` (SHA-256 `18bcfc0420519a0c64681898be5edbc5ced27d69df95172fa992c9c9c8ba52f6`): all214 production bodies and20 existing tooling sources are preserved. Independent review verified the path set and hashes. Actual BEFORE reads the separate retained08 worktree at `e036b49`, served by Compose08 on port9444; all214 bodies equal that frozen09 source and the original showcase hash478a remains unchanged. See `before-runtime-source-equivalence-01.json`, `before-read-source-equivalence-02.json` and `independent-review/before-read-source-bridge-review-02.json`.

This physical separation permits09 implementation while BEFORE continues against unchanged08. Mutable09 files cannot supply BEFORE evidence. Initial three browser attempts stopped during authentication setup and produced no application captures; they remain failed diagnostics. The reviewed runner uses the native form submission and a bounded main-frame binding, with independently pinned local fixture credentials and default-denied business writes. It has eight passing guard tests; this is tooling verification, not UI acceptance. Browser stages widen only after source/transport and actual-image review. AFTER requires a fresh candidate/runtime source proof and the complete operational and user-feedback acceptance scopes.

## Original candidate and static verification — 2026-11-12 snapshot

Candidate03 is frozen outside Git under `implementation-candidate-03/`:20 changed application/reference/test paths, exact patch, file hashes and logs. It aligns call/ACW bars and disposition, timeline density and native disclosure, outbox surfaces/status/menu/editor, quiet close controls, flush text-entry focus, readonly gender display and the compact plural-aware search summary. The server remains authoritative. Source review checks protected call/timing/history, request/reset/capability/revision/idempotency and writable-customer regions separately from presentation.

Independent source/static review passes: `independent-review/candidate03-source-review-01.json` (SHA-256 `7507a4523d0ed6a51dadfbf66e10fb5adf195cc70a9892ccdacc95e0b4aab31c`). The complete214-file production inventory has14 reviewed changed bodies and200 unchanged bodies; protected business/request/timing/draft regions are verified separately. Four focused tests also ran independently against the reconstructed frozen candidate. This authorizes publishing the draft candidate and CI; rendered acceptance remains pending.

Candidate02's complete45-file frontend suite and three guardrails pass. Candidate03 carries the byte-identical JS/test bodies and resolves the two independent CSS/Twig findings; focused outbox/search, guardrails, whitespace, syntax and CSS parsing pass. Compose09 Twig lint passes for the changed template. All80 installed public package version/source references equal accepted08 and the unchanged lockfile; this is dependency equivalence, not UI acceptance. The09 containers and volumes are prepared separately; its application/gateway have not been started for rendered review.

The revised09 showcase SHA-256 is `67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb`. Its only reference change is the explicitly requested text-entry focus boundary; header/filled/button/calendar focus contracts stay distinct. Original478a remains the sealed BEFORE reference. The palette review records the user-directed change and the existing customer-close grammar.

Desktop BEFORE06 is observationally complete:85 whole frames with exact baseline/source/SDK/native-auth guards and no unexpected request or runtime/source error. Independent review verifies provenance and representative whole images, including actual five-second focus loss and the malformed old native outbox editor. The narrow run retains a later old-refresh setup race as a failed report; a stable pending-GET geometry fixture must be reviewed before retry and does not prove refresh correctness. Firefox, short-height and the new-feedback addendum remain pending. No application or slice09 acceptance follows these static/baseline results.

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

### Confirmed refresh-focus gate — 2026-11-10

Slice 02's actual-renderer supplement found that the five-second outbox refresh replaces the list/trigger while a closed-menu trigger has keyboard focus. The focused element detaches before Enter, losing the user's position. This is an existing operational refresh/focus failure owned by 09, not an accepted shared-control state. Evidence is retained under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-10/slice-02/02c9a36/compact-attempt-04/chromium/`. The controls supplement separately holds later fixture GET responses pending to inspect stable button geometry/native activation; that pending-response fixture does not prove production refresh acceptance. Preserve capability/revision/idempotency behavior while retaining meaningful focus across refreshes and correctly restoring focus after menu exit.

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
