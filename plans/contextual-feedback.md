# Plan: Contextual Feedback Button With Teams Delivery

## Goal

Build a first-party Kiwi contextual feedback tool in the spirit of Marker.io,
Usersnap, BugHerd, and LogRocket:

- A visible "Contextual feedback" button in the Kiwi app shell.
- An element picker that lets a user point at a real UI element and attach
  feedback to that context.
- A screenshot annotation tool that produces a marked screenshot. Image support
  is a must-have, not an optional enhancement.
- A backend submission flow that creates a new message in Microsoft Teams in
  the `development feedback` channel of the `KIWI` team.
- A Teams Workflows webhook setup that can be configured safely without
  exposing the webhook URL to browser JavaScript.

This is a from-scratch product feature for Kiwi. Do not embed Marker.io,
Usersnap, BugHerd, LogRocket, or another third-party feedback SaaS.

## Current repo facts

- Kiwi is a Symfony 7.4 application on PHP 8.4.
- Frontend code is plain browser JavaScript loaded through Symfony Asset Mapper
  and `importmap.php`.
- App entrypoint is `assets/app.js`, which imports `assets/js/app/index.js`.
- Existing API code lives under `src/Controller/Api`, with unit and functional
  tests under `tests/`.
- Symfony HttpClient is already available through `symfony/http-client`.
- There is no `package.json` in this checkout, so prefer Symfony importmap or
  committed browser modules over adding a Node build pipeline.

## Important Teams constraints

Microsoft is moving Teams webhook usage toward the Workflows app. The old
Microsoft 365 connector path is nearing deprecation, so the plan should use the
Teams Workflows webhook trigger instead of creating a new legacy connector.

Teams/Power Automate message actions have an approximate 28 KB message size
limit. A full screenshot embedded as base64 will usually exceed that limit.
Therefore the screenshot must be uploaded to Kiwi first, then referenced from
the Teams Adaptive Card by a signed image URL.

Adaptive Cards support image elements with a URL. The URL must be reachable by
the Teams client or connector runtime. For production this means the image
endpoint must be served from the public Kiwi base URL using an unguessable
signed token, not behind the user's browser session cookie.

## Architecture

Use this flow:

1. Browser opens the contextual feedback mode.
2. User picks an element.
3. Browser captures the visible app state as a PNG.
4. Browser draws the selected-element marker and any manual annotations onto a
   local canvas.
5. Browser submits metadata plus the marked PNG to Kiwi.
6. Kiwi validates the user/session, stores the screenshot, creates a feedback
   record, and posts a Teams Adaptive Card through the configured Workflows
   webhook.
7. Teams shows a new channel message with the comment, selected element
   context, route/session metadata, and screenshot image.

### Frontend modules

Add a small feature folder:

- `assets/js/app/contextual-feedback/index.js`
- `assets/js/app/contextual-feedback/button.js`
- `assets/js/app/contextual-feedback/element-picker.js`
- `assets/js/app/contextual-feedback/selector.js`
- `assets/js/app/contextual-feedback/screenshot.js`
- `assets/js/app/contextual-feedback/annotation-canvas.js`
- `assets/js/app/contextual-feedback/dialog.js`
- `assets/css/contextual-feedback.css`

Import the feature from `assets/js/app/index.js` after the app shell has been
initialized.

### Backend classes

Add focused backend units:

- `src/Controller/Api/DevelopmentFeedbackController.php`
- `src/Entity/DevelopmentFeedbackReport.php`
- `src/Entity/DevelopmentFeedbackScreenshot.php`
- `src/Repository/DevelopmentFeedbackReportRepository.php`
- `src/Service/DevelopmentFeedback/DevelopmentFeedbackSubmitter.php`
- `src/Service/DevelopmentFeedback/ScreenshotStore.php`
- `src/Service/DevelopmentFeedback/SignedScreenshotUrlGenerator.php`
- `src/Service/DevelopmentFeedback/TeamsDevelopmentFeedbackNotifier.php`
- `src/Service/DevelopmentFeedback/TeamsFeedbackCardFactory.php`

Keep the controller thin. It should decode and validate the request, then hand
the semantic work to `DevelopmentFeedbackSubmitter`.

## Data model

`DevelopmentFeedbackReport`:

- `id`
- `publicId` as a UUID for links and Teams messages
- `createdAt`
- `createdByUserId`
- `createdByDisplayName`
- `createdByEmail`
- `environment` (`local`, `preview`, `production`)
- `track` (`active`, `preview`, or `unknown`)
- `pageUrl`
- `routePath`
- `viewportWidth`
- `viewportHeight`
- `devicePixelRatio`
- `userAgent`
- `selectedElementTag`
- `selectedElementLabel`
- `selectedElementSelector`
- `selectedElementTextSample`
- `selectedElementRectJson`
- `annotationJson`
- `comment`
- `severity`
- `category`
- `teamsDeliveryStatus`
- `teamsDeliveryError`
- `teamsDeliveredAt`

`DevelopmentFeedbackScreenshot`:

- `id`
- `report`
- `storagePath`
- `mimeType`
- `byteSize`
- `width`
- `height`
- `sha256`
- `accessTokenHash`
- `accessTokenExpiresAt`
- `createdAt`

Store the screenshot as a file under `var/development-feedback/screenshots` for
the first implementation. If the Kubernetes deployment needs cross-replica image
serving without sticky sessions, move this store to PostgreSQL `bytea` or an
object store before enabling production traffic. Because Kiwi runs multiple
replicas with `sessionAffinity: None`, local filesystem storage is acceptable
only if the image endpoint is guaranteed to run on the same shared volume or if
the store is database-backed.

Recommended production-ready default: store the PNG bytes in PostgreSQL. The
feature is low-volume and the implementation is simpler and replica-safe.

## Frontend UX

### Entry point

Add a compact icon button in the authenticated app shell:

- Label for screen readers: `Contextual feedback`.
- Icon: use a simple existing icon approach if one exists in the app; otherwise
  use text only for the first pass.
- Visibility:
  - enabled when `CONTEXTUAL_FEEDBACK_ENABLED=1`;
  - shown to `admin`, `dev`, and `supervisor` roles by default;
  - optionally enabled for all authenticated users after the workflow is proven.

### Picker mode

When the user clicks the button:

1. Add a full-window transparent picker layer.
2. Track pointer movement and find the real target with
   `document.elementFromPoint`.
3. Ignore the picker UI itself using a `data-feedback-ignore` attribute.
4. Draw a non-layout-affecting outline around the hovered element.
5. Show a tiny floating label with tag name and accessible name or nearby text.
6. Click selects the element.
7. `Esc` cancels.

The picker must not trigger app controls while active. Use event capture and
`preventDefault()` for pointer/click events until selection or cancel.

### Stable selector generation

Create a readable selector in this order:

1. `data-testid` or `data-feedback-id` when present.
2. Element `id` when unique and not generated-looking.
3. Semantic attributes such as `name`, `aria-label`, `role`, and stable form
   labels.
4. A short CSS path using tag names and stable class names.
5. A fallback path with `:nth-of-type()` only when needed.

Return both:

- `selector`: the best selector for reproducing the context.
- `label`: a human-friendly element label for Teams.

Avoid selectors that rely on volatile state classes, generated IDs, or text that
may contain customer data.

### Screenshot capture

Use a browser DOM-to-image capture library through Symfony importmap, preferably
`html-to-image`, while keeping the feedback product itself first-party. This
avoids adding a Node build pipeline and gives us `toBlob()` / `toPng()` browser
capture primitives.

Capture requirements:

- Capture the visible application viewport.
- Exclude the feedback toolbar, picker overlay, and dialog using
  `data-feedback-ignore`.
- Use `pixelRatio: 1` by default to control file size.
- Set a maximum rendered dimension and downscale before upload when needed.
- Produce a PNG `Blob`, not a base64 string in JSON.
- Include the selected element rectangle in viewport coordinates.

Known limitation: DOM-to-image capture can fail or omit cross-origin images,
videos, canvases, and some CSS effects. The tool should show a clear inline error
when screenshot capture fails and must not submit feedback without an image.

### Annotation tool

After element selection, open a modal-style annotation surface:

- Show the captured screenshot.
- Pre-draw a red or amber rectangle around the selected element.
- Provide tools:
  - pointer/select
  - rectangle
  - arrow
  - pin
  - free text label
  - blur/redaction rectangle
  - undo
  - clear annotations
- Collect:
  - required comment
  - optional severity (`low`, `normal`, `high`, `blocking`)
  - optional category (`bug`, `copy`, `layout`, `data`, `workflow`, `idea`)

Render final annotations onto the PNG before upload so Teams always receives a
single marked image that works outside Kiwi.

Also submit `annotationJson` so the report can be inspected or re-rendered later
inside Kiwi if needed.

### Privacy safeguards

Screenshots may contain customer data. Add guardrails before production rollout:

- Mask password inputs and known secret/token fields before capture.
- Add a redaction tool and make it prominent.
- Show a short confirmation note in the dialog: the marked screenshot will be
  posted to the KIWI Teams channel.
- Do not include cookies, tokens, request headers, or raw session payloads.
- Limit text samples from selected elements to a small length, for example 120
  characters.
- Consider auto-blurring known PII selectors after the first implementation
  identifies stable customer-detail DOM regions.

## API contract

### `POST /api/v1/development-feedback`

Use `multipart/form-data`:

- `screenshot`: required PNG file
- `payload`: required JSON string

Payload shape:

```json
{
  "comment": "The start date picker overlaps the submit button.",
  "severity": "normal",
  "category": "layout",
  "pageUrl": "https://bdc.rtvmedia.org/kiwi/...",
  "routePath": "/kiwi/...",
  "viewport": {
    "width": 1440,
    "height": 900,
    "devicePixelRatio": 1
  },
  "selectedElement": {
    "tag": "button",
    "label": "Create subscription",
    "selector": "[data-feedback-id=\"create-subscription\"]",
    "textSample": "Create subscription",
    "rect": {
      "x": 1020,
      "y": 742,
      "width": 180,
      "height": 44
    }
  },
  "annotations": [
    {
      "type": "rectangle",
      "x": 1018,
      "y": 740,
      "width": 184,
      "height": 48,
      "color": "#f97316"
    }
  ]
}
```

Response:

```json
{
  "id": "5d8781a8-0ec4-4b24-a10a-87d636a4a6bc",
  "status": "delivered",
  "teamsDeliveryStatus": "sent"
}
```

Validation:

- Authenticated user required.
- CSRF/session protection consistent with existing API patterns.
- `comment` required, trimmed, max 4000 characters.
- PNG only for first implementation.
- Max upload size: start with 3 MB.
- Reject empty or unparseable payload.
- Server derives user identity from the session, never from client JSON.
- Rate limit per user, for example 10 submissions per 10 minutes.

### `GET /api/v1/development-feedback/screenshots/{publicId}/{token}.png`

Serves the marked screenshot for Teams.

Rules:

- Does not require browser session auth, because Teams must be able to fetch it.
- Requires an unguessable token.
- Stores only a token hash server-side.
- Expires after a configured TTL, for example 30 days.
- Sends `Content-Type: image/png`.
- Sends `Cache-Control: private, max-age=3600`.
- Returns `404` for unknown, expired, or mismatched tokens.

## Teams delivery

### Configuration

Add environment variables:

```dotenv
CONTEXTUAL_FEEDBACK_ENABLED=0
CONTEXTUAL_FEEDBACK_ALLOWED_ROLES="admin,dev,supervisor"
CONTEXTUAL_FEEDBACK_WEBHOOK_URL=
CONTEXTUAL_FEEDBACK_PUBLIC_BASE_URL="https://bdc.rtvmedia.org/kiwi"
CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS=30
CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES=3145728
```

The webhook URL is a secret. It must be configured through `.env.local` for
local development or through a Kubernetes secret for preview/production. Never
commit it.

### Teams Workflows setup instructions

Use the Workflows app in Teams or Power Automate:

1. Open Microsoft Teams.
2. Go to the `KIWI` team.
3. Open the `development feedback` channel.
4. Open `Workflows`.
5. Choose a channel incoming webhook template such as `Send webhook alerts to a
   channel`, or create a workflow from scratch with the `When a Teams webhook
   request is received` trigger.
6. Configure the target as:
   - Team: `KIWI`
   - Channel: `development feedback`
   - Post as: `Flow bot` unless the organization requires posting as a service
     account user.
   - Post in: `Channel`
7. Configure the message action to post the incoming Adaptive Card payload.
8. Save the workflow.
9. Copy the generated webhook URL.
10. Store the webhook URL as `CONTEXTUAL_FEEDBACK_WEBHOOK_URL` in the Kiwi
    runtime secret store.
11. Add at least one co-owner to the workflow so delivery does not break when
    the original owner account changes or leaves.

For local testing, Teams will not be able to fetch images from
`bdc.rtvmedia.org.local` unless a tunnel or reachable preview URL is used. Local
tests should still verify that Kiwi stores the PNG and sends a card with the
expected signed URL.

### Adaptive Card shape

Post one channel message per feedback report. The card should include:

- Title: `New Kiwi contextual feedback`
- Reporter name and email
- Environment and track
- Page path
- Selected element label and selector
- Severity and category
- Comment
- Screenshot image
- Button/link to open the Kiwi page
- Button/link to open the screenshot directly

Example card body generated by `TeamsFeedbackCardFactory`:

```json
{
  "type": "message",
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
          {
            "type": "TextBlock",
            "text": "New Kiwi contextual feedback",
            "weight": "Bolder",
            "size": "Medium"
          },
          {
            "type": "TextBlock",
            "text": "The start date picker overlaps the submit button.",
            "wrap": true
          },
          {
            "type": "FactSet",
            "facts": [
              { "title": "Reporter", "value": "Jane Doe" },
              { "title": "Environment", "value": "preview" },
              { "title": "Page", "value": "/kiwi/subscriptions" },
              { "title": "Element", "value": "Create subscription" },
              { "title": "Selector", "value": "`[data-feedback-id=\"create-subscription\"]`" },
              { "title": "Severity", "value": "normal" }
            ]
          },
          {
            "type": "Image",
            "url": "https://bdc.rtvmedia.org/kiwi/api/v1/development-feedback/screenshots/5d8781a8-0ec4-4b24-a10a-87d636a4a6bc/<token>.png",
            "altText": "Marked screenshot for Kiwi feedback"
          }
        ],
        "actions": [
          {
            "type": "Action.OpenUrl",
            "title": "Open Kiwi page",
            "url": "https://bdc.rtvmedia.org/kiwi/subscriptions"
          },
          {
            "type": "Action.OpenUrl",
            "title": "Open screenshot",
            "url": "https://bdc.rtvmedia.org/kiwi/api/v1/development-feedback/screenshots/5d8781a8-0ec4-4b24-a10a-87d636a4a6bc/<token>.png"
          }
        ]
      }
    }
  ]
}
```

Keep the payload small. The image must be referenced by URL, not embedded as a
data URI.

## Implementation phases

### Phase 1: Backend foundation

1. Add Doctrine entities and migrations for report and screenshot storage.
2. Add `ScreenshotStore` with PostgreSQL-backed storage or another
   replica-safe store.
3. Add signed screenshot URL generation.
4. Add screenshot serving endpoint.
5. Add `POST /api/v1/development-feedback` endpoint.
6. Add validation and upload size limits.
7. Add unit tests for payload validation, screenshot token validation, and
   storage.
8. Add functional tests for auth, upload, and screenshot retrieval.

### Phase 2: Teams integration

1. Add `TeamsFeedbackCardFactory`.
2. Add `TeamsDevelopmentFeedbackNotifier` using Symfony `HttpClientInterface`.
3. Send JSON to `CONTEXTUAL_FEEDBACK_WEBHOOK_URL` only from the backend.
4. Record delivery status on the report.
5. On Teams failure, keep the report and expose a clear API error or warning.
6. Add unit tests with `MockHttpClient` proving request method, URL, payload, and
   failure handling.
7. Add README documentation for the Workflows webhook setup and secret.

### Phase 3: Contextual feedback button and picker

1. Add CSS and app-shell button.
2. Add feature flag and role-based visibility.
3. Add picker overlay with hover outline, click selection, and `Esc` cancel.
4. Add selector generation and tests for stable selector behavior.
5. Add metadata collection for route, viewport, user agent, and selected
   element rect.

### Phase 4: Screenshot and annotation

1. Add the screenshot capture dependency through Symfony importmap.
2. Build screenshot capture around `toBlob()`.
3. Add canvas annotation modal.
4. Render selected-element rectangle automatically.
5. Add rectangle, arrow, pin, text, blur, undo, and clear tools.
6. Enforce "cannot submit without screenshot".
7. Submit `multipart/form-data` to the API.
8. Show delivery states: capturing, uploading, delivered, failed.

### Phase 5: Hardening and rollout

1. Add rate limiting.
2. Add cleanup command for expired screenshots and old reports.
3. Add observability logs for Teams delivery failures.
4. Add docs for local, preview, and production configuration.
5. Enable on preview first.
6. Verify Teams image rendering from the preview URL.
7. Enable production after the `development feedback` channel confirms receipt.

## Testing plan

Backend:

- `make phpunit`
- Unit test `TeamsFeedbackCardFactory` for required card fields.
- Unit test `TeamsDevelopmentFeedbackNotifier` with `MockHttpClient`.
- Unit test signed screenshot token generation and expiry.
- Functional test `POST /api/v1/development-feedback` requires auth.
- Functional test upload rejects non-PNG files.
- Functional test upload rejects oversized screenshots.
- Functional test screenshot endpoint serves valid tokens and rejects expired
  tokens.

Frontend:

- Existing JS test command: `make js-test`.
- Test selector generation with stable IDs, labels, classes, and fallback paths.
- Test picker state transitions: idle, hovering, selected, cancelled.
- Test feedback payload construction.
- Test that `data-feedback-ignore` elements are excluded from picking.

Manual/browser:

- Open local Kiwi through `https://bdc.rtvmedia.org.local/kiwi`.
- Login with a fallback user that has a permitted role.
- Start contextual feedback.
- Pick a button or form field.
- Confirm the selected element is highlighted.
- Draw at least one annotation.
- Submit feedback.
- Verify a report row and screenshot are stored.
- Verify the Teams webhook receives an Adaptive Card.
- Verify the Teams card shows the marked screenshot on preview/production.

## Acceptance criteria

- The app has a contextual feedback button behind a feature flag.
- Clicking the button enters element picker mode.
- Users can select a real element without triggering the underlying app action.
- Users can cancel picker mode with `Esc`.
- The selected element is represented by a human-readable label and a stable
  selector when possible.
- Submitting feedback requires a text comment and a marked screenshot.
- The marked screenshot includes the selected element marker.
- The final screenshot is uploaded as an image file, not embedded in JSON.
- Kiwi stores the feedback report and screenshot.
- Kiwi posts a new message to the `development feedback` channel in the `KIWI`
  team through the configured Teams Workflows webhook.
- The Teams message contains the comment, reporter, environment, route, selected
  element context, and screenshot image.
- The webhook URL is never exposed to frontend JavaScript.
- The screenshot URL uses an unguessable expiring token.
- The implementation works with multiple Kiwi replicas.
- Unit, functional, and JS tests cover the new behavior.
- README or operational docs explain how to configure the Teams Workflows
  webhook and the Kiwi secret.

## Risks and decisions

### Screenshot storage

Decision: use PostgreSQL or another shared store before production. Local
filesystem storage is simpler but conflicts with multi-replica serving unless a
shared volume is guaranteed.

### Teams image reachability

Decision: serve signed image URLs from the public Kiwi base URL. Teams cannot
fetch images from an OIDC-protected endpoint or a local-only hostname.

### Payload size

Decision: keep the Teams card small and reference the image by URL. Do not send
the screenshot as base64 to the webhook.

### Privacy

Decision: add redaction in the first implementation and treat screenshots as
internal but sensitive data. Do not include hidden technical secrets or raw
session data in reports.

### Capture library

Decision: build the feedback product from scratch, but use a focused DOM image
capture library for PNG generation. Reimplementing HTML/CSS rendering to canvas
inside Kiwi would be high-risk and not useful product work.

## Documentation updates to include with implementation

- `README.md`: feature purpose, env vars, local limitations, Teams Workflows
  setup, and secret handling.
- `CHANGELOG.md`: one unreleased entry when implementation is done in a PR.
- Optional `docs/how-to/contextual-feedback.md`: deeper operator and troubleshooting
  guide if README becomes too large.

## Initial file checklist

- `assets/js/app/contextual-feedback/*`
- `assets/css/contextual-feedback.css`
- `src/Controller/Api/DevelopmentFeedbackController.php`
- `src/Entity/DevelopmentFeedbackReport.php`
- `src/Entity/DevelopmentFeedbackScreenshot.php`
- `src/Service/DevelopmentFeedback/*`
- `tests/Unit/DevelopmentFeedback/*`
- `tests/Functional/DevelopmentFeedbackControllerTest.php`
- `tests/frontend/app/contextual-feedback/*.test.mjs`
- `README.md`
- `CHANGELOG.md`
