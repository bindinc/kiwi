# Preserve contextual feedback screenshot fidelity

## Goal

Make element and area screenshots match the Firefox/Chromium page while keeping Kiwi's two stored variants and selected Teams routing. The original variant must retain visible media and page geometry. The pseudonymized variant must replace sensitive data on a detached clone without changing the live application.

## Implementation

- Replace `html-to-image` with pinned `dom-to-image-more@3.10.1` and use clone hooks for pseudonymization and layout-preserving explicit masks.
- Measure the target, viewport, document, scroll state, and sensitive element geometry once. Reuse those measurements for original and pseudonymized rendering.
- Preserve public images, SVG, CSS backgrounds, and supported canvases. Report failed or unsupported resources instead of hiding all media.
- Extend sensitive-text inference and explicit Kiwi annotations, remove raw text samples from selection metadata, and verify that marked source values do not remain in the pseudonymized clone.
- Block regular-workflow pseudo delivery when verification fails; retain the existing restricted original-data route and multipart contract.

## Verification

- Compare deterministic element and area fixtures with native Playwright screenshots in Firefox and Chromium.
- Require stable dimensions and landmarks, retained media, unchanged pixels outside sensitive regions, zero unresolved values, and an unchanged live DOM.
- Run frontend tests, targeted feedback PHPUnit suites, Compose browser smoke tests, guardrails, and `git diff --check`.

## Boundaries

- Firefox is primary and Chromium secondary. Safari is outside this change because SVG `foreignObject` capture is not reliable there.
- Public media remains visible. Only explicitly marked sensitive media is masked without collapsing layout.
- Backend screenshot storage and Teams routing interfaces remain unchanged.
