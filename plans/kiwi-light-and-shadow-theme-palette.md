# Plan: Change KIWI's default theme to Pantone Light & Shadow

## Status

Planning only. This document defines the intended palette migration; it does not implement any theme changes.

## Visual artifact

Open the standalone [Light & Shadow palette showcase](./kiwi-light-and-shadow-theme-palette-showcase.html) to review the eight swatches, recommended semantic roles, representative KIWI components, and verified contrast pairs. The artifact is a design aid only and does not load application assets.

## Goal

Replace KIWI's current blue/slate default presentation with a calm default theme based on Pantone's **Light & Shadow** palette for PANTONE 11-4201 Cloud Dancer, the 2026 Color of the Year. Keep the interface readable, preserve the meaning of operational status colors, and avoid coupling components directly to Pantone names.

This is a change to the single default light theme. It does not add a theme picker, dark mode, per-user preference, or persistence.

## Researched palette

Use the Fashion, Home + Interiors **TCX** references consistently. The following hex values are the selected sRGB screen approximations:

| Pantone color | Hex | RGB | Intended KIWI role |
| --- | --- | --- | --- |
| PANTONE 11-4201 TCX Cloud Dancer | `#F0EEE9` | `240, 238, 233` | Page background and the lightest structural layer |
| PANTONE 12-6000 TCX Veiled Vista | `#C7E2C8` | `199, 226, 200` | Calm secondary surface, selected row, and soft positive highlight |
| PANTONE 14-4320 TCX Baltic Sea | `#7AB6D9` | `122, 182, 217` | Informational accent and decorative highlight |
| PANTONE 13-0624 TCX Golden Mist | `#D5CD94` | `213, 205, 148` | Warm attention surface and non-critical highlight |
| PANTONE 16-3610 TCX Quiet Violet | `#A693AC` | `166, 147, 172` | Secondary accent and grouped-workflow highlight |
| PANTONE 16-1523 TCX Cloud Cover | `#999393` | `153, 147, 147` | Muted, disabled, and decorative neutral |
| PANTONE 17-5800 TCX Hematite | `#756F6B` | `117, 111, 107` | Dark neutral, secondary dark control, and strong border |
| PANTONE 18-4218 TCX Blue Fusion | `#496275` | `73, 98, 117` | Primary action, navigation, link, focus, and palette-aligned dark text |

### Sources and conversion decision

- [Pantone's official 2026 page](https://www.pantone.com/na/en-us/color-of-the-year/2026) defines Cloud Dancer and the Light & Shadow palette.
- The exact TCX sequence and selected digital values are recorded together in the [2026 Pantone palette reference](https://www.paleton.net/brand/24-pantone/coty/2026/).
- Veiled Vista `#C7E2C8` is independently reproduced in the [FHI Cotton TCX reference](https://www.photoshoplus.fr/couleurs/couleurs-pantone-cotton/) and [Veiled Vista digital reference](https://www.colorbook.online/50cfb17d-d482-49a8-9daa-e3a760ab1d86/).
- Hematite `#756F6B` is independently reproduced in the [Hematite digital reference](https://www.colorbook.online/d174ab16-c2bd-40b5-bd01-25e15828e621/).
- Pantone states that on-screen colors are computer simulations and may not match physical Pantone standards. These values are therefore the canonical KIWI web palette, not a print-production specification.

Some conversion sites return nearby values for Veiled Vista (`#C8E4CA`) and Hematite (`#756F6A`). Do not mix those alternatives into KIWI. If an authorized Pantone Connect export is supplied later, review and update the canonical values once, before implementation, rather than changing individual components.

## Accessibility constraints

The eight swatches are source colors, not eight interchangeable foreground colors. The semantic mapping must comply with [WCAG 2.2](https://www.w3.org/TR/WCAG22/): at least `4.5:1` for normal text, `3:1` for large text, and `3:1` for required component boundaries, icons, and states.

Useful verified pairs are:

| Foreground / background | Contrast | Permitted use |
| --- | ---: | --- |
| Blue Fusion / Cloud Dancer | `5.51:1` | Normal text, links, icons, and controls |
| Blue Fusion / Veiled Vista | `4.61:1` | Normal text, links, icons, and controls |
| White / Blue Fusion | `6.39:1` | Primary button text, header text, and inverse focus ring |
| White / Hematite | `4.95:1` | Normal text on secondary dark controls |
| Current dark ink `#0F172A` / Baltic Sea | `8.09:1` | Normal text on Baltic Sea surfaces |
| Current dark ink `#0F172A` / Golden Mist | `11.04:1` | Normal text on Golden Mist surfaces |
| Current dark ink `#0F172A` / Quiet Violet | `6.28:1` | Normal text on Quiet Violet surfaces |
| Current dark ink `#0F172A` / Cloud Cover | `5.91:1` | Normal text on Cloud Cover surfaces |
| Blue Fusion `#496275` / Current dark ink `#0F172A` | `2.60:1` | **Fails 3:1** for color-only link distinction in body text |
| Control border `#768894` / Cloud Dancer | `3.20:1` | Required form control boundaries (inputs, selects, checkboxes) |
| Control border `#768894` / White | `4.34:1` | Required form control boundaries on white surfaces |
| Cloud Cover `#999393` / Cloud Dancer | `2.60:1` | **Fails 3:1** for required control boundaries; decorative/disabled only |
| White / Cloud Dancer | `1.17:1` | Subtle surface boundary; requires explicit control border or shadow |

Consequences for the design:

- Retain a supporting near-black ink (`#0F172A`) and white as accessibility neutrals; the Pantone palette is not an instruction to make every text color a Pantone swatch.
- Do not use white normal text on Baltic Sea, Golden Mist, Quiet Violet, or Cloud Cover.
- Do not use Blue Fusion normal text on Baltic Sea, Golden Mist, Quiet Violet, or Cloud Cover.
- **Hyperlinks in body text must remain underlined** (`text-decoration: underline; text-underline-offset: 0.2em;`): because the contrast between Blue Fusion (`#496275`) and the surrounding dark ink (`#0F172A`) is `2.60:1` (< 3:1), color alone cannot be the sole visual indicator for links (WCAG 2.2 SC 1.4.1).
- **Dual focus ring tokens**:
  - Use `--focus: var(--palette-blue-fusion)` (`#496275`) on light surfaces (Cloud Dancer, Veiled Vista, White).
  - Use `--focus-inverse: #ffffff` (`6.39:1`) on dark surfaces (Blue Fusion header, navigation links, and primary action buttons) where Blue Fusion on Blue Fusion would have an imperceptible 1:1 contrast.
- **Control boundary contrast (WCAG 2.2 SC 1.4.11)**:
  - White controls on Cloud Dancer have only `1.17:1` contrast, and Cloud Cover (`#999393`) provides only `2.60:1` against Cloud Dancer.
  - Form control boundaries (inputs, selects, textareas, checkboxes, radio buttons) must use a verified border token (`--border-control: #768894`, giving `3.20:1` against Cloud Dancer and `4.34:1` against White).
  - Use `--border-subtle` (`rgba(117, 111, 107, 0.28)`) or Cloud Cover only for non-interactive dividers, card separators, or decorative lines where 3:1 contrast is not mandated.
- Preserve labels, icons, patterns, or text for state differences; color must not be the only signal.

## Current KIWI theme surface

The migration is broader than changing the existing `:root` block:

- `assets/css/styles.css` defines the current root variables, but also contains most of the application's hard-coded colors.
- Companion stylesheets reuse root variables while retaining component-specific values:
  - `assets/css/article-search.css`
  - `assets/css/delivery-date-picker.css`
  - `assets/css/contextual-feedback.css`
  - `assets/css/session-outbox.css` (already prepared with fallback values matching the proposed Light & Shadow token names).
- `templates/base/index.html.twig` loads those five stylesheets in order and contains one theme-relevant inline danger style (`line 1131: style="background-color: rgba(239, 68, 68, 0.1); border-color: #ef4444;"`).
- `templates/base/access_denied.html.twig` and `templates/base/logged_out.html.twig` share `styles.css` and must receive the same default theme.
- JavaScript contains both theme-relevant inline presentation colors and colors with special meaning:
  - Inline presentation styles in `assets/js/app/slices/article-search-slice.js` (line 826: coupon removal `color: #dc2626;`) and `assets/js/app/slices/order.js` (line 318: discount label `color: #059669;`).
  - Operational colors with domain meaning in `assets/js/app/legacy-app-state.js` and `assets/js/app/slices/contact-history-slice.js`.
  - Contextual-feedback annotation/capture modules (`screenshot.js`, `annotation-canvas.js`, `screenshot-redaction.js`).
- `public/vendor/swagger-ui-dist/swagger-ui.css` is vendored and must not be rewritten as part of this work. The Swagger wrapper background in `src/Controller/Api/SwaggerController.php` can be assessed separately without editing the vendor bundle.

There is currently no KIWI theme selector or dark-mode implementation to migrate.

## Recommended semantic model

### 1. Declare source swatches once

Add one canonical raw token per researched color under `:root`, for example `--palette-cloud-dancer` and `--palette-blue-fusion`. Raw Pantone tokens may be referenced only by the semantic theme-token layer, tests, and palette documentation.

Do not make component selectors depend directly on Pantone names. A component should express intent such as background, text, border, action, focus, information, or warning.

### 2. Define semantic default-theme tokens

Introduce a small, explicit set of roles covering surfaces, text, borders, actions, states, and elevation:

| Semantic token | Value / Raw Token | Contrast / Role |
| --- | --- | --- |
| `--page` | `var(--palette-cloud-dancer)` (`#F0EEE9`) | Default document background |
| `--surface` | `#FFFFFF` | Elevated cards, menus, modals, and form inputs |
| `--surface-subdued` | `var(--palette-cloud-dancer)` (`#F0EEE9`) | Subdued secondary containers, input groupings |
| `--surface-calm` | `var(--palette-veiled-vista)` (`#C7E2C8`) | Soft secondary surface, selected table row highlight |
| `--surface-selected` | `var(--palette-veiled-vista)` (`#C7E2C8`) | Active/selected row and entity highlight |
| `--surface-info` | `var(--palette-baltic-sea)` (`#7AB6D9`) | Informational badges and decorative accent with dark ink |
| `--surface-attention` | `var(--palette-golden-mist)` (`#D5CD94`) | Warm non-critical warning/attention surface with dark ink |
| `--surface-group` | `var(--palette-quiet-violet)` (`#A693AC`) | Grouped workflow sections with dark ink |
| `--surface-disabled` | `var(--palette-cloud-cover)` (`#999393`) | Inactive / disabled background elements |
| `--text` | `#0F172A` | Primary ink for body copy and headings (8.09:1 to 14.5:1) |
| `--text-muted` | `#475569` | Secondary metadata, captions, and hint text (meets 4.5:1) |
| `--text-palette` | `var(--palette-blue-fusion)` (`#496275`) | Palette-aligned dark text on Cloud Dancer and Veiled Vista |
| `--border-subtle` | `rgba(117, 111, 107, 0.28)` | Hematite with alpha for card borders, dividers, table row lines |
| `--border-control` | `#768894` | Form inputs, selects, checkboxes, radios (3.20:1 on Cloud Dancer, 4.34:1 on White) |
| `--action` | `var(--palette-blue-fusion)` (`#496275`) | Primary action buttons, active navigation bar, links |
| `--action-hover` | `#354C5E` | Darkened Blue Fusion (> 7:1 against white text) |
| `--action-active` | `#2B3E4D` | Pressed primary action |
| `--action-secondary` | `var(--palette-hematite)` (`#756F6B`) | Secondary dark control, border, and neutral button |
| `--action-secondary-hover` | `#5D5855` | Darkened Hematite for secondary button hover |
| `--focus` | `var(--palette-blue-fusion)` (`#496275`) | 3px outline on light surfaces |
| `--focus-inverse` | `#FFFFFF` | 3px outline on Blue Fusion header, navigation items, and dark buttons (6.39:1) |
| `--shadow-sm` | `0 1px 2px 0 rgba(117, 111, 107, 0.08)` | Subtle card elevation on Cloud Dancer |
| `--shadow-md` | `0 4px 6px -1px rgba(117, 111, 107, 0.12)` | Popovers, dropdown menus, sticky header shadow |
| `--shadow-lg` | `0 10px 15px -3px rgba(117, 111, 107, 0.16)` | Modals, dialog overlays |
| `--elevation-overlay` | `0 8px 24px rgba(15, 23, 42, 0.14)` | Outbox and drawer overlays |

Hover, active, and pressed states are explicitly declared above and tested. Do not scatter ad hoc opacity or darkening formulas through component rules.

### 3. Keep operational colors semantic

Do not mechanically replace every green, amber, red, or annotation color with the nearest Light & Shadow swatch.

- Agent availability, call state, recording, success, warning, and danger colors carry operational meaning. Move them behind semantic state tokens while keeping their meaning and adequate contrast.
- Contact-history event colors may be normalized to the same state tokens where the meanings match. Event categories that do not match must remain distinct and non-color labels/icons must remain present.
- Contextual-feedback annotation red/orange, redaction masks, and privacy-verification states are functional colors. Keep them stable unless a separate accessibility test proves a safe change.
- Logo artwork, customer/publication logos, screenshot source imagery, and third-party vendor CSS are not theme tokens.

## Implementation plan

### Phase 1: establish and test the token contract

1. Add the eight exact raw palette tokens and semantic default-theme tokens (including `--border-control`, `--border-subtle`, `--focus`, `--focus-inverse`, `--action-hover`, and shadow scale) to `assets/css/styles.css`.
2. Document the allowed supporting white, near-black ink, semantic status colors, and interaction values next to the token definitions.
3. Add a focused Node test such as `tests/frontend/theme-palette.test.mjs` that verifies the exact raw values, semantic mappings, and required contrast pairs without adding a new test framework.
4. Extend `script/check` with a narrow guardrail that prevents the eight Pantone hex values from being copied outside their canonical declarations and test fixtures.

### Phase 2: migrate the global shell and shared controls

1. Replace the current root aliases with the new semantic roles while retaining compatibility aliases only for the duration of the same PR.
2. Apply Cloud Dancer to the page, Blue Fusion to the header and primary interactions, and white/elevated surfaces to cards, menus, forms, and modals. Ensure header elements receive `--focus-inverse`.
3. Migrate typography, links (with explicit underline `text-underline-offset: 0.2em`), dividers (`--border-subtle`), form controls (`--border-control`), buttons, focus rings, overlays, and disabled states to semantic tokens.
4. Apply the same tokens to access-denied and logged-out pages.
5. Remove compatibility aliases before the PR is finalized so there is one vocabulary, not two permanent theme APIs.

### Phase 3: migrate component styles deliberately

Review every literal in the companion stylesheets (`article-search.css`, `delivery-date-picker.css`, `contextual-feedback.css`, and `session-outbox.css`) and classify it before changing it:

1. Theme presentation: replace with a semantic theme token.
2. Operational state: replace with or retain an explicit semantic state token.
3. Privacy/annotation behavior: keep unchanged unless independently tested.
4. Brand/vendor/external content: keep out of the theme.

Cover article search, delivery-date picker, session outbox, call and ACW bars, customer search/detail, subscription workflows, order and winback flows, profile/status menus, and contextual-feedback dialog/settings.

### Phase 4: remove theme presentation from markup and JavaScript

1. Replace theme-relevant inline color styling in Twig with named utility classes:
   - Replace `style="background-color: rgba(239, 68, 68, 0.1); border-color: #ef4444;"` in `templates/base/index.html.twig` with a semantic class such as `.info-box--danger`.
2. Replace inline presentation colors in generated markup with semantic utility classes:
   - `assets/js/app/slices/article-search-slice.js` (coupon removal button: `.u-text-danger`).
   - `assets/js/app/slices/order.js` (discount label: `.u-text-success`).
3. Where JavaScript must select a presentation role, set a class or semantic custom property rather than a raw hex value.
4. Keep canvas API color strings only where the canvas represents annotations or privacy masking. If a canvas color is genuinely theme-related, resolve the semantic CSS custom property through computed styles at render time.
5. Leave the vendored Swagger UI stylesheet untouched; theme only its non-vendored wrapper if that page is included in the approved visual scope.

### Phase 5: validate behavior, contrast, and visual hierarchy

1. Run automated token and contrast assertions for every foreground/background pair used in normal text, large text, icons, focus indicators, and required control boundaries.
2. Run `make js-test`, `make guardrail`, `make phpunit`, and `git diff --check`.
3. Run `make compose-smoke-oidc` in fallback OIDC mode.
4. Add a small `scripts/compose-smoke-theme.mjs` Playwright scenario following the repository's existing external-Playwright loading convention. It should log in as `kiwi-admin`, inspect computed tokens, traverse representative workflows, and save deterministic screenshots rather than downloading dependencies.
5. Execute the theme smoke in Firefox and Chromium at the main desktop viewport and one narrow viewport.
6. Run `make compose-smoke-feedback-privacy` in Firefox and Chromium to prove that the palette migration did not regress screenshot fidelity, annotations, redaction, or privacy review surfaces.
7. Compare and approve screenshots for the main shell, profile menu, customer search/results/detail, representative form controls and validation, call/ACW states, article search, date picker, modal, contextual feedback, access denied, and logged out.

## Acceptance criteria

- All eight canonical TCX colors and hex values are declared exactly once in the palette layer.
- KIWI loads the Light & Shadow treatment as its only default theme without JavaScript initialization or saved user preference.
- Page, header, cards, menus, forms, primary/secondary actions, links, focus, and accent surfaces use semantic tokens rather than raw Pantone values.
- Normal text meets `4.5:1`; large text and required non-text UI indicators meet `3:1` without rounding a failing value up.
- Form control boundaries (inputs, selects, textareas, checkboxes, radio buttons) meet `3:1` against adjacent page and card backgrounds.
- Hyperlinks within body text have a non-color visual distinction (underline) to satisfy WCAG 2.2 SC 1.4.1.
- Keyboard focus remains clearly visible across every surface, including dark headers and buttons via `--focus-inverse`.
- Operational success, warning, danger, call, availability, recording, privacy, and annotation meanings remain recognizable and are never conveyed by color alone.
- No theme-related inline color remains in KIWI-owned Twig or generated HTML.
- Contextual-feedback screenshots accurately capture the new theme while pseudonymization and redaction behavior remain unchanged.
- No vendor stylesheet, logo artwork, backend contract, application workflow, OIDC configuration, or GitOps resource changes solely because of this theme migration.
- The implementation PR contains one `CHANGELOG.md` entry under `Unreleased` and includes before/after Firefox and Chromium evidence in its description.

## Boundaries

- This plan does not implement the palette.
- It does not introduce dark mode, a selectable alternative theme, user preference storage, typography changes, layout redesign, or animation changes.
- It does not recolor publication/customer logos or the Bindinc logo asset.
- It does not make Pantone accent colors substitutes for semantic danger, warning, success, or privacy colors.
- It does not modify `public/vendor/swagger-ui-dist/swagger-ui.css`.
- Physical print matching and Pantone licensing/export workflows are outside KIWI's web-theme scope.
