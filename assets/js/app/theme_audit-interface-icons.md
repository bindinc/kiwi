# theme_audit — Unify interface icons

Status: application implementation and independent acceptance pass on 2026-11-17 at production source `769a9eee8192a7032ca63ec78d4351a71dfe18e2`. The finite icon, layout, naming and capture-restoration findings are resolved. PR155 is reviewable; complete integrated interface acceptance remains the final slice10 gate. No merge or deployment is included.

Story: [SC-206629](https://app.shortcut.com/bindincit/story/206629). Parent: [theme_audit plan](../../../plans/theme_audit.md).

Worktree: `/home/bartdeijkers/_worktrees/unify-kiwi-interface-icons`.
Branch: `codex/unify-kiwi-interface-icons`.
PR: [#155](https://github.com/bindinc/kiwi/pull/155).
Initial base: `codex/align-theme-operational-states` at `31056b4e4d7eae9010defc2e8b8c0a9e7d0ffe5c`.

Finish slice09 and adopt its accepted source before implementing this refinement. Keep application edits sequential. Complete the icon refinement before final slice10 integration so the final whole-interface review includes the approved icon language. The additional PR retains one Unreleased changelog entry and does not authorize merging, deployment or worktree cleanup.

## Accepted dependency adoption — 2026-11-16

Accepted slice09 source `2c193b25770506321d3b85bf9e5954deb159c2ef` is adopted in this branch before application changes. Preparation head `40a334757a2f8165981e19efac4a51a5fe0d12b9` preserves the existing single icon changelog entry and the completed09 entry. The earlier source inventory remains a historical orientation; current implementation and evidence need their own exact source identities.

Implementation, independent review and Compose validation have separate owners. The user-authorized work window ends at11:55 Europe/Amsterdam; unfinished gates remain explicit at pause. Current guidance and evidence are retained under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-16/icon-refinement/`. Context7 MDN documentation confirms decorative SVG hiding and accessible names on containing controls. The retrieved icons guide is applied with self-contained inline SVG to retain faithful isolated screenshot capture.

## Approved direction

Use the header's restrained line icons: inline SVG, a 24-unit viewBox, approximately 1.75-unit strokes, round line caps/joins and `currentColor`. Use the established control and spacing tokens. Align icons with their labels without adding decorative tiles or changing action hierarchy.

Keep visible labels, accessible names, state meaning, permissions and click/keyboard behavior. Decorative icons must not duplicate spoken labels. Customer logos, avatars, brand identity and native browser controls retain their existing roles. Recording and presence retain clear status words and their established semantic indications.

Keep icon markup separate from translatable text. Use self-contained inline SVG that remains intact in privacy screenshots. Preserve every privacy annotation, opaque/private boundary and the original screenshot SDK and fidelity criteria.

## Initial source orientation

The initial source scan covers tracked JavaScript, Twig and CSS at the base above. It finds graphical Unicode symbols in 21 files, including translations; this is an inventory, not a count of confirmed defects. Durable path/hash/codepoint evidence is retained beside the worktrees under `.kiwi-theme-audit/evidence/2026-11-13/icon-refinement/initial-inventory-01.json`. Classify ordinary punctuation, navigation arrows, status conventions and favicon/brand assets separately before replacing a symbol.

| Area | Source to inspect | Required outcome |
| --- | --- | --- |
| Shared page and controls | `templates/base/index.html.twig`, `assets/js/app/legacy-app-state.js` | Consistent heading, action, disclosure and state icons, with preserved labels and control targets. |
| Calls and history | `call-agent-runtime.js`, `slices/call-session-slice.js`, `slices/contact-history-slice.js` | Quiet phone, hold, recording, timing and event icons with unchanged state transitions and event content. |
| Customer search and details | `slices/customer-search-slice.js`, `slices/customer-detail-slice.js`, `customer-editor.js` | Cohesive search, view/edit and close icons while preserving exact customer/record identity and drafts. |
| Article, ordering and service flows | `slices/article-search-slice.js`, `slices/order.js`, `slices/werfsleutel.js`, `slices/winback-slice.js` | Shared catalogue, cart, price, edit/delete and service icon grammar without changing pricing or workflow rules. |
| Feedback and capture | `contextual-feedback/dialog.js`, `settings-modal.js`, `element-picker.js`, `index.js` | Consistent close, capture, selection and settings affordances; screenshot masking, fidelity and lifecycle remain correct. |
| Localization | `assets/js/i18n/nl.js`, `en.js` | Text-only translated labels alongside decorative SVG; actual language switching preserves dynamic state. |
| Access and session pages | `templates/base.html.twig`, `templates/base/access_denied.html.twig`, `logged_out.html.twig` | Deliberate access/session illustrations and existing identity assets, assessed in their actual page context. |

Inspect the existing header SVG definitions before introducing helpers or dependencies. Preserve the frozen pre-refinement source and reference separately; update any current reference specimen deliberately under this user-approved direction.

## Semantic classification and protected payloads

Read-only orientation against current slice09 source `ac26a020eac29be6a86e83bca6047b8be2e682c3` classifies all21 inventory files and11 supporting source bodies. All32 bodies match that commit;67 source and usage checks pass. The durable `semantic-classification-01/manifest.json` is pinned at `65a7453c06e31610f8fb300ee22483cd91a35cadad5ed35c05a76c6fd2b59d3a`. Adopt accepted09 before application implementation.

- Toast messages are stored verbatim as contact-history descriptions and can reach the history API. Preserve those messages, shared translation values and stored/user-written content; separate icon presentation from the payload.
- Delivery shortcut captions and their plain `delivery.remarkPresets` payloads are already separate. Replace only their presentation glyphs. Provider offer/quote values and free annotation text keep their existing content.
- Static translation updates and runtime writers can replace a parent's entire `textContent`. Place SVG outside translated caption nodes and preserve it through hold/resume, coupon, pending and locale changes.
- Subscription edit/cancel controls currently rely on titles. Give the existing buttons explicit localized accessible names when their decorative glyphs become SVG.
- Current close controls use a literal glyph in an unframed40px target with1.5rem text. Assess a vector cross while preserving the target, focus and dismissal behavior. Existing quiet SVGs, native controls, status conventions, punctuation and identity assets require deliberate exceptions.
- Current screenshot redaction masks explicitly marked media and replaces unsupported embedded content; it does not automatically mask static inline SVG. Preserve existing sensitivity/mask/ignore boundaries. No new public wrapper or blanket masking exemption is required.

This classification is preparation, not implementation or rendered acceptance. Source references and per-file decisions are retained in `semantic-classification-01/review.md` beside the worktrees. The retrieved `icons` guidance and implementation direction are retained in the same icon-refinement evidence directory.

## Acceptance

- Inventory every remaining demo-style interface icon and record intentional exceptions.
- Review the implementation independently, including semantic labels, icon-only controls, keyboard behavior and protected business/privacy code.
- Compare actual desktop, narrow and short states in Chromium and Firefox. Include long labels, disabled/error states and real access roles where affected.
- Check inline SVG and caption fidelity with the unchanged privacy capture implementation and thresholds.
- Record exact source, PR, tests, whole-image evidence and remaining limitations here. Final slice10 must validate the integrated result, rather than accepting a source scan or colour checks alone.

## Checks so far

Implementation checkpoint on2026-11-16: all142 frontend tests, three guardrails,18 changed-JavaScript syntax checks and whitespace pass. Container lint passes all five Twig files. The frozen candidate manifest is `5f523181109aeb4c545f87a679af3fd22463a3c67fe649b537e23b2e656b0365`; independent source and actual Chromium/Firefox/private-capture gates are in progress. No rendered acceptance is inferred from these checks.

## Implementation checkpoint — 2026-11-16

A trusted40-glyph self-contained SVG catalogue and matching Twig macro replace the active demo pictograms across forms, customer/service actions, history decoration, calls/queue, article/catalogue/cart and feedback controls. Dynamic captions use separate translated leaf nodes; the readonly customer action keeps its View state through NL/EN/NL. Icon-only subscription controls receive localized accessible names.

Known call/queue notifications carry explicit separate presentation metadata; stored raw history/messages, shared business translations, delivery presets and provider/user text stay unchanged. The outbox save-notice override clears optional presentation so status stays authoritative. Caption output is escaped and icons remain decorative, nonfocusable and pointer-inert. No new public/privacy annotation or SDK/fidelity change is introduced.

Intentional exceptions are existing approved SVGs, source logos/avatars and unused scaffold favicon, native controls/confirmation text, presence/recording/ACW indicators, ordinary arrows/check notation and an inactive commented demo action. These are distinct from remaining validation gates. The inventory and exact protected-value checks remain in the frozen candidate archive; the complete interface still needs final slice10 acceptance after this refinement.

## Scoped rendered checkpoint — 2026-11-16

- Implementation `32db2641dcfe85f5816a69fee1dce3202ff7652d`:142 frontend tests,3 guardrails,18 syntax checks and full source review `c7afcb93` pass. The complete production inventory is216 files (two new,193 old bodies unchanged); all 216 runtime bodies match the committed source.
- Firefox after03 on that source passes171 checks with84 application frames across1440/390/320 and390-short, plus three isolated full-SDK specimen images. The isolated specimen reports zero fidelity/outside-private differences and1182 private pixels with unchanged live fields; it does not replace the full original or affected-record privacy suites.
- Whole-image review found two remaining active wait-hourglass literals. Final code `b782eb32e1733af97d839aeafdc33b6659316e57` replaces only those Twig glyphs with the existing clock macro; a whitespace-only follow-up normalizes those changed lines. Final Chromium and Firefox call-only390 supplements each pass23 checks/8 frames, with all 216 Git/current/runtime bodies, servedJS/fiveCSS and all five Twig lints verified. No source changes occurred during capture.
- Independent scoped review `115588ba6c063c2de936c5e7d744ffa94e9916e6bd6e69ffb2acf6861dce78d8` personally reviewed103 whole images and verifies the tiny final-source carry. No additional concrete geometry/spacing issue was found in that scope.
- Remaining: complete the broad Chromium matrix, capture visibly populated contact-history glyphs (the current history-named frame is empty), and finish remaining inventory/advanced/native/full privacy gates. Historical broad Chromium attempts remain failed/incomplete because of explicitly recorded driver readiness expectations; a scoped pass does not promote them. Native browser confirmation text, brand/identity assets and preserved raw business/user/provider content retain documented intentional exceptions.
- Durable source/attempt/report/image hashes and handoff: `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-16/icon-refinement/validation-handoff-01.json` (253 artifact pins). All browsers were terminal by10:48:04UTC. The user-requested pause is11:55 Europe/Amsterdam. No merge, deployment or cleanup is included.

## Current corrective source and evidence — 2026-11-17

The layout/name correction is `c5cb682762e501d91e7ec4b440581e5d1e78cb67`, following the source-bound `3c9ea3ce` checkpoint; the final protected-source correction is `769a9ee` below. The complete inventory remains 216 files; 214 production bodies are byte-identical. The only changes are an explicit translated accessible name for the search-results close control and intrinsic row sizing in the existing feedback canvas grid. One existing Unreleased changelog entry is amended.

The small, legitimate 66×17px capture of a button caption exposed a short-screen interaction failure. In both engines the default grid compressed the privacy row to 64px while its contents overflowed, covering the canvas with the privacy input/label. Nine actual scroll attempts could not reveal an owned canvas point. Those failed runs remain failed. A separately labeled diagnostic changed only `grid-auto-rows` to `max-content`; the row then measured approximately 102px, contained its controls and exposed the canvas. The diagnostic restored the original style, image, comment and privacy choice and is not production acceptance. The committed correction now supplies that intrinsic sizing without changing picker, annotation, privacy-choice, shielding, SDK or request logic.

The exact corrective source proof is `corrected-production-source-carry-01.json` (`4314cdb5`), independently reviewed at `a6e80fdd`. The new runtime release `corrected-runtime-release-01/release.json` (`f4ecc385`) binds all 216 Git/current/container bodies, the retained image, HTTP200 health and five Twig lints; independent binding is `bcb9322b`. Code [CI44055919385](https://github.com/bindinc/kiwi/actions/runs/44055919385) passes. The complete application CI includes the existing 142 frontend tests; three local guardrails, the changed Twig lint and whitespace also pass. No implementation-mirroring test was added for two attributes or one CSS declaration.

All evidence below is outside Git under `/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-17/icon-refinement/`. Counts identify retained artifacts and checks; independent image decisions establish the stated visual scopes.

| Scope | Actual evidence and independent conclusion | Source boundary |
| --- | --- | --- |
| Broad desktop/narrow/short and selected history | Both engines: 175 checks/84 application frames; separate actual selected-local-customer history 45 checks/8 frames each. Review `efed5683` verifies 194 pins and personally views 120 fresh whole images. | Executed on 3c9; unchanged production bodies carry explicitly. |
| Advanced call, service and generated states | Review `18ad1522` accepts the documented1440/390/320 scopes from `advanced-02`; the combined report remains failed because of its later short annotation failure. Queue/person/help/clock paint and coarse controls have their separate review `a69f08c6`. No business callback replay or persistence claim. | Executed on 3c9; component/source impact is explicit. |
| Actual access roles and account pages | Both engines: 67 checks/12 frames each across1440/390/320. Review `e97598ae` views all 24 whole frames: actual readonly SSR, exact one-use native donny authentication/server403 and public logged-out GET. | Executed on 3c9; these exact bodies are unchanged. Public GET does not prove session revocation. |
| Native OS200/reset | Both engines: 28 checks each, Chromium11 and Firefox9 whole X11 images. Review `ad1a3f67` verifies actual SSR role, real geometry ratios and exact inner/outer/DPR/pinch and canonical task reset. | Executed on 3c9; initial feedback without screenshot is distinct from the current screenshot-workspace supplement. |
| Corrected short canvas and close control | Both engines: 73 short checks/28 frames each; localized close-control supplement Chromium73/8 and Firefox67/8. Review `957c0136` verifies all 76 pins and views28 critical whole frames. No injected CSS; trusted pin/undo, unchanged privacy/draft/shield, NL/EN/NL, same SVG, keyboard Enter and exact retained customer/work-session/call identity pass. | Executed on c5. Chromium uses browser AX; Firefox uses explicitly qualified DOM/role snapshots, without an OS-screen-reader claim. |
| Corrected representative workspace and touch | Both engines: matrix63 checks/12 frames plus coarse33/6 each. Review `8ee66c56` verifies40 pins and personally views all 36 whole images. Real picker/pin/undo, quiet tools, pseudo choice, draft and shielding pass at desktop/narrow and actual coarse/hover-none. | Executed on c5. Exact local settings fulfillment does not persist settings. |
| Corrected native screenshot workspace | Both engines: 28 checks each; Chromium6 and Firefox4 whole X11 frames. Actual SDK capture callback, installed dialog, six keyboard tools, owned canvas geometry, pseudo shielding and exact native reset pass. | Executed on c5; component/native rendered review `367f6f89` passes. A separate global visual-restoration finding remains open. This is a component/native-workspace scope, without native picker/drawing or backend claims. |

### Privacy profiles and bounded carry

The original full script remains `f3e58cf2` and SDK remains `1913ae11`, with unchanged 64-channel/2% thresholds. On3c9 the default Firefox run and separately declared grayscale Chromium comparison profile pass; the default Chromium run remains failed at1163/57600 pixels (2.0190972%). Its native/canvas image pair is byte-identical to the already classified Nov13 letter-edge failure. Review `b727797a` verifies all29 pins and views the actual comparison images. The failing default run is never relabeled as green. Ordinary UI and native evidence retain their documented default renderer.

Affected-record capture on 3c9 passes 21 checks/5 retained images per engine,37 synthetic private sources with zero leaks and exact raw DOM, field, selection, global and retained-root restoration. Review `93a10ab0` views all10 images. Chromium's four text regions change pixels; Firefox's three text regions change and its originally uniform native-DATE clone retains the narrow previously established serialized-state exception. The actual live DATE field remains unchanged. The full-form193×1600 production PNG uses the SDK's maximum-dimension scaling and is not presented as a narrow application viewport.

Carry to c5 is limited and independently explained: the new CSS declaration matches only `.contextual-feedback-canvas-wrap`; original header/custom-fixture pixel targets and the affected-record `.customer-editor` are outside that workspace. The script, SDK, serializer, redaction/restoration and business/role logic are among the 214 unchanged bodies. Current-code capture/picker and workspace checks cover the changed layout while retaining the real privacy choice and shield. These original and affected-record suites are described as prior-source observations with exact impact carry, not freshly rerun full suites on c5.

Known notifications preserve the raw argument and use explicit presentation metadata. With the installed outbox, the existing toast-to-history gate intentionally suppresses persistence; actual notification tests do not disable that rule or claim a stored notification. The selected-history corpus separately verifies preserved raw Unicode content. Brand/avatar assets, native controls, presence/recording conventions and meaningful annotation marks `!`/`T` remain intentional exceptions.

The Shortcut connector has no attachment-upload tool. Whole images, source/report hashes, failed attempts, diagnostics and independent decisions remain locally reviewable beside the worktrees; no screenshot or customer data is committed. No merge, deployment or cleanup is authorized by this acceptance work.

### Resolved global capture-restoration finding

Late whole-image review of both native screenshot-workspace runs observes the initially visible KA profile avatar becoming a plain gray circle after production capture, dialog close and geometry reset. Component geometry and canonical task identity checks remain valid; they do not prove global visual restoration. Review `2eed258b` records the separate finding.

The application bridge `screenshot-redaction.js` (`7a09c620`) is byte-identical in accepted09,3c9 andc5. Its clone path calls `redactScreenshotDom` with the clone's `ownerDocument`; that routine appends a global mask stylesheet to the document head, and the clone caller discards its restoration closure. The unchanged SDK's native clones can share the live document. The bounded actual probe confirms the cause in both engines: only pseudonymized onclone appends one persistent263-byte live-head stylesheet (`f5a6a03d`); the detached clone shares the live document, and the unchanged avatar children become hidden after dialog close/reset. Original onclone adds zero styles, body classes are empty and the SDK observer is exactly restored. Independent diagnostic review is `d75f165f`; no diagnostic stylesheet removal is presented as a product fix. It is not classified as an introduced icon/CSS regression or as observed data disclosure.

The existing clone unit fixture has no document head, so its green result does not cover this path. A correction must keep masks effective for public selections and masked content, preserve the live redaction API's restoration behavior and leave SDK bytes and privacy thresholds unchanged. A shared-ownerDocument regression and actual browser head/avatar restoration are required; original full and affected-record privacy must be rechecked as appropriate to a protected-source change. Earlier scoped observations are not promoted to blanket restoration acceptance.

### Protected-source restoration correction — 2026-11-17

The bounded correction is committed and pushed at `769a9eee8192a7032ca63ec78d4351a71dfe18e2`. Only `screenshot-redaction.js` changes in production relative to c5; 215 of 216 bodies remain identical (213 are identical to 3c9). The clone now uses the existing root pseudonymization loop and applies the existing four neutral mask properties and descendant visibility rules inline on that detached tree. It never reads or writes its live ownerDocument/head. The exported live redaction API retains its temporary stylesheet and returned restoration function. No new media/void-root hiding policy, SDK, resource, crop, annotation, privacy annotation, consent or request change is introduced.

Independent source review `7c8747cf` verifies the exact module `fd8e74b1` and existing test `387289af`. The new shared-head regression fails the exact old `7a09c620` module and passes the correction (`2dde67c4`). All eight existing feedback test files, three guardrails, syntax and whitespace pass. Complete application [CI44063153278](https://github.com/bindinc/kiwi/actions/runs/44063153278) passes.

Fresh release `privacy-release-02/release.json` (`88ce70a2`), independently bound by `3d38bbde`, verifies all 216 current/Git/runtime bodies and the unchanged original script/SDK/helper/local-health inputs. Existing actual before/after checks now observe zero head styles and unchanged avatar DOM/visibility through capture, close and reset in both engines; existing affected-record checks also pass21 each. Their immutable bundle is `restoration-current-evidence-01.json` (`913274de`).

The agreed full original tests are newly executed on 769a: default Firefox and the declared Chromium grayscale profile both exit0 with unchanged f3/SDK1913 and64-channel/2% assertions. Bundle `restored-original-privacy-evidence-01.json` is `bc4af6ff`. No fresh default-Chromium-full pass is claimed; the historical default failure and the exact Firefox native-DATE exception stay explicit. These are the existing relevant privacy checks following a protected-source change, without another matrix or unrelated workflow replay. Independent verification closes the live-head/avatar finding and the current privacy gates; no further browser work is required for this refinement.

### Acceptance closure and delivery

The current correction is independently verified against both sealed actual bundles: `restoration-current-evidence-01.json` (`913274de`) and `restored-original-privacy-evidence-01.json` (`bc4af6ff`). All 20 relevant new whole images are personally reviewed. Both browsers retain zero live-head mask styles and unchanged avatar DOM/visibility through capture, close and reset. Current affected-record privacy passes 21 checks per engine: Chromium field regions change 77/108/105/72 pixels, Firefox 39/48/47 plus the unchanged, tightly bounded originally-uniform sanitized DATE exception. The full original default-Firefox and declared-grayscale-Chromium suites pass on 769a with immutable f3/SDK1913 and unchanged 64-channel/2% assertions. No new default-Chromium-full pass, backend persistence, native-picker/drawing or OS-screen-reader claim is made.

No icon-refinement finding remains open. Current product restrictions such as unavailable per-record validity/read-only source capabilities are inherited, explicitly approved constraints, not new functionality. All prior failed attempts and diagnostic-only runs retain their actual verdicts and source boundaries. The final ten-slice matrix, integrated coexistence/reference/cascade review and whole-interface conclusion belong to PR144; they are not inferred from this refinement's finite acceptance.

Final finite acceptance is sealed in `independent-review/icons155-final-finite-acceptance-review-01.json` (`b26e5e438ce9ea731c8625205c07ae1ca468f7367efe9774a8485f0cbe783530`). Current restoration/privacy review is `ac3f6ba2278dbee210bbbc2635814c8c2448ad5df44f8eb21bae2e144a7feca0`. The decision binds41 current artifact pins and12 prior independent seals, all20 required current images and all six declared groups. The inherited live-head finding is closed on769a; no further browser work is required for this PR. Documentation-only delivery must retain all216 production bodies exactly.
