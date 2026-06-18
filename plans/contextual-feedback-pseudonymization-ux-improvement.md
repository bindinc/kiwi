# Contextual feedback pseudonymization and UX improvement plan

## Evidence from Playwright validation

Validated locally on the PR worktree stack at `https://bdc.rtvmedia.org.local:8443/kiwi/` with fallback OIDC user `kiwi-admin`.

Flow tested:

1. Enable the contextual feedback feature in Settings.
2. Search customer by name: `Jansen`.
3. Select `Mevr. M. Jansen`.
4. Open contextual feedback.
5. Select the customer name and a larger customer-card area.
6. Inspect the feedback modal and captured annotation canvas.

Captured evidence:

- `/tmp/kiwi-feedback-jansen/01-jansen-results.png`
- `/tmp/kiwi-feedback-jansen/02-jansen-detail.png`
- `/tmp/kiwi-feedback-jansen/03-picker-hover-name.png`
- `/tmp/kiwi-feedback-jansen/04-modal-name.png`
- `/tmp/kiwi-feedback-jansen/05-modal-card.png`
- `/tmp/kiwi-feedback-jansen/canvas-name.png`
- `/tmp/kiwi-feedback-jansen/canvas-card.png`

Key finding: the screenshot canvas now contains pseudo data, but the user-visible modal and darkened page behind it still expose real Jansen data. The result is better than full blanking, but not yet a trustworthy or polished privacy UX.

## Problems to fix

### 0. Screenshot captures full page instead of cropping to the selected element

The current implementation takes a full-page screenshot and draws an orange outline box around the selected element, rather than cropping the screenshot to the selected element's bounds. This is the inverse of the intended behavior, which should work like Firefox's built-in `Ctrl+Shift+S` element screenshot: the captured image is cropped to exactly the selected element, with no surrounding page content included.

Current behavior:
- A full-page screenshot is captured.
- An orange border box is rendered on top to mark the selected area.
- The modal canvas shows the entire page with a misplaced overlay marker.

Expected behavior:
- The screenshot is cropped to the bounding box of the selected element.
- No orange marker box is drawn; the crop itself communicates the selection boundary.
- The modal canvas shows only the selected element's region, matching the Firefox `Ctrl+Shift+S` crop UX.

Acceptance criteria:

- Selecting `#customerName` produces a canvas that contains only the customer name element region, not the full page.
- No orange outline box appears on the canvas.
- The crop dimensions match the element's `getBoundingClientRect()` output.

### 1. Real sensitive text leaks outside the captured canvas

The modal header currently shows the selected element label as real data:

- Example observed: `Mevr. M. Jansen #customerName`

The darkened background behind the modal also remains the live unsanitized page, so real data is still readable around the modal:

- `Jansen`
- `maria.jansen@email.nl`
- `Wijnhaven 15`
- `3011BD`
- `06-87654321`

This conflicts with the privacy promise in the modal note. The canvas is sanitized, but the review UI is not.

### 2. Pseudo data is not entity-consistent

The screenshot showed mixed identities:

- Customer detail name became `Nora Bakker`.
- Search name field became `Sophie de Vries`.
- Email became `nora.bakker@example.test`.
- Phone became `0612345678`.

This proves replacement works, but the result reads as inconsistent test data instead of one believable pseudo customer. That makes screenshots harder to reason about.

### 3. The picker and modal UX do not communicate what is sanitized

The modal says sensitive page data is replaced, but the user cannot tell:

- which values were replaced,
- whether the selected element label is safe,
- whether the visible background is safe,
- whether Teams receives only the canvas or more metadata.

For a privacy-sensitive tool, the UI needs to make the boundary obvious.

### 4. Text replacement loses domain meaning in contact history

Contact history descriptions are replaced with generic `Contactmoment met voorbeeldtekst` / `Klantnotitie met testgegevens`. This removes customer data, but also removes the useful issue context. Feedback about a specific subscription or contact-history bug can become harder to understand.

### 5. Automated testing currently covers DOM mutation, not rendered screenshot quality

The frontend unit tests verify pseudonymization and restore behavior, but they do not prove:

- the modal header is sanitized,
- the dimmed background does not leak sensitive data,
- the canvas remains readable,
- pseudo data is consistent across a customer,
- the feature still works in the real compose/OIDC flow.

## Recommended implementation plan

### Phase 0: fix screenshot crop behavior

Replace the full-page-plus-overlay approach with an element-cropped capture, matching the Firefox `Ctrl+Shift+S` UX.

- Use `html2canvas` (or the existing capture library) scoped to the selected element's bounding box instead of the full document.
- Alternatively, capture the full page and crop the resulting canvas to `getBoundingClientRect()` coordinates before displaying it in the modal.
- Remove the orange outline box rendering entirely; the crop boundary makes the selection self-evident.
- Pseudonymization must still be applied before the crop, so the captured region already contains pseudo data.

Acceptance criteria:

- The modal canvas shows only the selected element region, not the full page.
- No orange border box appears in any captured image.
- Capturing `#customerName` yields a canvas whose dimensions are within a few pixels of the element's rendered size.

### Phase 1: sanitize the whole feedback review surface

- Pseudonymize the selected element label before it is rendered in the modal header.
- Apply the same redacted clone/snapshot data to the modal header context as the canvas, not the live text from `describeElement`.
- Hide or strongly blur the live page behind the modal after capture so real page data is not readable around the modal.
- Keep the annotation canvas as the only detailed page preview visible in the modal.
- Update the privacy note to distinguish:
  - what is visible in the modal,
  - what is posted to Teams,
  - what metadata is submitted.

Acceptance criteria:

- Searching `Jansen` and selecting `#customerName` never shows `Jansen`, `maria.jansen@email.nl`, `Wijnhaven`, `3011BD`, or `06-87654321` in the modal header, modal body, or visible dimmed background.
- The canvas remains readable and contains pseudo values.

### Phase 2: introduce customer-scoped pseudo identities

Replace the current per-value round-robin mapping with a capture-scoped pseudo profile.

Example pseudo profile:

```json
{
  "name": "Sophie de Vries",
  "initials": "S.",
  "lastName": "de Vries",
  "email": "sophie.devries@example.test",
  "phone": "0612345678",
  "address": "Dorpsstraat 12",
  "postalCode": "1234 AB",
  "city": "Utrecht",
  "personReference": "10012345"
}
```

Rules:

- The same source customer should map to one coherent pseudo profile during one capture.
- Search fields, result rows, customer detail, contact history, selected-person blocks, and modal selected-element labels should use the same profile.
- Repeated values keep the same replacement.
- Different source customers in the same screenshot may use different profiles.

Acceptance criteria:

- The Jansen flow shows one coherent pseudo customer across the left search panel and center detail header.
- A screenshot never mixes `Sophie de Vries` search input with `Nora Bakker` selected customer unless two different customers are visibly present.

### Phase 3: make domain text useful without exposing PII

Use typed pseudo templates for long text instead of generic free text everywhere.

Examples:

- Contact history:
  - `Vraag over facturatie. Uitleg gegeven over automatische incasso.`
  - becomes `Vraag over facturatie. Uitleg gegeven over betaalwijze.`
- Address changes:
  - `Adres gewijzigd van Kerkstraat 10 naar Damstraat 42.`
  - becomes `Adres gewijzigd van Voorbeeldstraat 8 naar Dorpsstraat 12.`
- Subscription descriptions keep magazine/status/date context unless the value itself is sensitive.

Acceptance criteria:

- Contact history remains useful for UI feedback.
- Real names, addresses, email addresses, phone numbers, account numbers, and person references are replaced.
- Non-sensitive domain terms such as magazine titles, subscription statuses, and UI action labels remain readable.

### Phase 4: improve annotation UX for review quality

- Make the screenshot workspace larger and reduce wasted whitespace in the modal.
- Keep the annotation toolbar compact and icon-led, with tooltips.
- Show a small privacy status indicator near the canvas:
  - `Pseudo data applied`
  - `Media hidden`
  - `Manual redaction available`
- Add a visible warning if screenshot capture falls back to hiding a region instead of pseudonymizing it.
- Add a `Retake screenshot` action after changing the selected element.
- Keep manual `Redact` prominent for edge cases.

Acceptance criteria:

- The captured screenshot is readable at default desktop size without zooming.
- The user can immediately tell that pseudo data has been applied.
- Manual redaction remains available but is not the only privacy mechanism.

### Phase 5: add real browser regression coverage

Add a small Playwright smoke test script for the compose/fallback-OIDC flow.

Required scenario:

1. Log in as `kiwi-admin`.
2. Enable feedback if disabled.
3. Search `Jansen`.
4. Select the Jansen customer.
5. Open contextual feedback and select the customer header.
6. Assert that the modal text and visible page behind the modal do not contain:
   - `Jansen`
   - `maria.jansen@email.nl`
   - `Wijnhaven`
   - `3011BD`
   - `06-87654321`
7. Assert that the canvas is non-empty and contains expected dimensions.
8. Save evidence screenshots on failure.

Implementation notes:

- Use the existing local Chrome/Playwright setup or add a repo-native dev dependency deliberately.
- Use `--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1` or document the required hosts entry because DNS did not resolve in the shell during validation.
- Use `ignoreHTTPSErrors` for the local CA unless the test runner imports the dev CA.

Acceptance criteria:

- A single documented command can run the feedback privacy smoke test against local compose.
- The test fails if real Jansen data appears anywhere in the feedback review UI.

## Suggested priority

1. Fix screenshot crop (element-crop instead of full-page + orange box marker).
2. Fix modal/header/background leaks.
3. Add customer-scoped pseudo profiles.
4. Improve long-text/domain-specific pseudonymization.
5. Refine annotation UI and privacy status affordances.
6. Add compose-backed Playwright coverage.

The current implementation proves that DOM pseudonymization can work, but the product should not be considered privacy-complete until the full feedback review surface, not only the canvas, is sanitized.
