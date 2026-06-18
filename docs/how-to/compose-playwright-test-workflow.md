# Docker Compose and Playwright test instructions

Follow these instructions when browser-testing Kiwi with Docker Compose and
Playwright. They are intended for both humans and LLM agents working in this
repository.

## Use this workflow for

Use this workflow whenever a change must be verified in the real browser runtime,
especially changes to:

- contextual feedback screenshots,
- OIDC login and role-based UI behavior,
- Docker Compose gateway behavior,
- JavaScript that depends on rendered layout, canvas, or browser APIs.

Always keep unit tests such as `make js-test` in the validation set. Do not use
them as a substitute for browser checks when screenshot or interaction behavior
is part of the change.

## Start from the correct checkout

For PR work, run Compose from the PR worktree. Do not test PR browser behavior
from the main checkout.

Example PR worktree:

```bash
cd /home/bartdeijkers/_worktrees/improve-feedback-screenshot-pseudonymization
```

Only one local Kiwi gateway can bind port `8443` at a time. Before testing,
verify which checkout owns the running app:

```bash
docker inspect kiwi-app-1 --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
```

If the running stack comes from `/home/bartdeijkers/kiwi` but the test must cover
a PR worktree, stop the main stack:

```bash
cd /home/bartdeijkers/kiwi
docker compose down --remove-orphans
```

Start Compose from the PR worktree:

```bash
cd /home/bartdeijkers/_worktrees/<worktree-name>
make compose-up
```

Confirm that the running app container belongs to the worktree:

```bash
docker inspect <compose-project>-app-1 --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

For the worktree above, the container name is:

```bash
improve-feedback-screenshot-pseudonymization-app-1
```

## Use the local URL and handle DNS/certificates

Use this URL:

```text
https://bdc.rtvmedia.org.local:8443/kiwi/
```

The local certificate is self-signed/local-CA based. Set
`ignoreHTTPSErrors: true` in Playwright unless the runner imports the local CA.

If DNS does not resolve `bdc.rtvmedia.org.local`, map it explicitly to
`127.0.0.1` in Chromium:

```js
args: [
  '--ignore-certificate-errors',
  '--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'
]
```

## Log in through fallback OIDC

When `client_secrets.json` is missing, Compose uses fallback Keycloak.

Navigate to Kiwi and let the app redirect to Keycloak:

```text
https://bdc.rtvmedia.org.local:8443/kiwi/
```

Useful fallback users:

| User | Password | Role |
| --- | --- | --- |
| `kiwi-admin` | `kiwi-local-dev-password` | admin |
| `kiwi-dev` | `kiwi-local-dev-password` | dev |
| `kiwi-supervisor` | `kiwi-local-dev-password` | supervisor |
| `kiwi-user` | `kiwi-local-dev-password` | user |
| `kiwi-view` | `kiwi-local-dev-password` | view |
| `donny` | `kiwi-local-dev-password` | no Kiwi role |

Use `kiwi-admin` for contextual feedback settings. The feedback toggle is
admin/supervisor controlled.

## Use the Playwright runner safely

This repository does not currently define Playwright as a local package
dependency. For local ad hoc validation, Playwright was available from another
checkout:

```js
const { chromium } = require('/home/bartdeijkers/emailtemplates/node_modules/playwright');
```

Add a repo-native test command before making this a CI requirement. Until then,
use this local pattern only for ad hoc verification.

Do not use `npx playwright ...` automatically. It fetches and executes external
code. Use it only after explicit approval.

## Use this basic Playwright script pattern

Use this pattern for local browser checks:

```js
const { chromium } = require('/home/bartdeijkers/emailtemplates/node_modules/playwright');

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--ignore-certificate-errors',
    '--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'
  ]
});

const page = await browser.newPage({
  ignoreHTTPSErrors: true,
  viewport: { width: 1693, height: 1209 }
});

await page.goto('https://bdc.rtvmedia.org.local:8443/kiwi/', {
  waitUntil: 'domcontentloaded',
  timeout: 30000
});

await page.fill('input[name="username"]', 'kiwi-admin');
await page.fill('input[name="password"]', 'kiwi-local-dev-password');
await Promise.all([
  page.waitForURL(/\/kiwi\/?$/, { timeout: 30000 }),
  page.click('input[type="submit"], button[type="submit"]')
]);

await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
```

If Chrome fails inside the sandbox with `setsockopt: Operation not permitted` or
similar crashpad/sandbox errors, rerun the same Playwright command outside the
sandbox after explicit approval.

## Run the contextual feedback privacy smoke test

Use the repo-native smoke command when a local Compose stack is already running:

```bash
make compose-smoke-feedback-privacy
```

The command loads Playwright from
`/home/bartdeijkers/emailtemplates/node_modules/playwright` by default because
this repository does not vendor Playwright. Override that path when needed:

```bash
PLAYWRIGHT_MODULE_PATH=/path/to/node_modules/playwright make compose-smoke-feedback-privacy
```

The smoke test maps `bdc.rtvmedia.org.local` to `127.0.0.1`, ignores local CA
certificate errors, writes failure screenshots to
`/tmp/kiwi-feedback-privacy-smoke`, and fails when real Jansen data appears in
the feedback modal text, when the live page behind the modal is not strongly
hidden, or when the captured canvas is blank or not cropped to the selected
element.

## Manual contextual feedback privacy scenario

Use this scenario to test the feedback screenshot privacy behavior:

1. Log in as `kiwi-admin`.
2. Enable contextual feedback if `#contextualFeedbackButton` is hidden:
   - click `#contextualFeedbackSettingsButton`,
   - check `input[name="feedbackEnabled"]`,
   - submit the settings form,
   - wait for `#contextualFeedbackButton:not([hidden])`.
3. Open Additional filters if the name field is hidden.
4. Search by name `Jansen`.
5. Select the first result.
6. Confirm the selected customer details contain:
   - `Mevr. M. Jansen`,
   - `maria.jansen@email.nl`,
   - `Wijnhaven 15`,
   - `3011BD`,
   - `06-87654321`.
7. Open contextual feedback.
8. Select the customer name or customer card through a coordinate click.
9. Wait for `.contextual-feedback-modal canvas`.
10. Save:
   - a full-page modal screenshot,
   - `canvas.toDataURL('image/png')` as a PNG.
11. Check that the canvas uses pseudo data.
12. Check that the modal header and visible background do not leak real customer
    data. If they do, record it as a privacy/UX finding.

The picker overlay intentionally intercepts normal element clicks. In automated
tests, compute the target element bounding box before opening feedback mode and
click the center coordinates after the overlay appears:

```js
const box = await page.locator('#customerName').boundingBox();
await page.click('#contextualFeedbackButton');
await page.waitForSelector('.contextual-feedback-picker-overlay');
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
```

## Save evidence output

Write temporary evidence under `/tmp`, grouped by scenario:

```text
/tmp/kiwi-feedback-jansen/
  01-jansen-results.png
  02-jansen-detail.png
  03-picker-hover-name.png
  04-modal-name.png
  05-modal-card.png
  canvas-name.png
  canvas-card.png
```

Do not commit `/tmp` evidence files. Summarize important findings in a plan,
PR description, or test failure output.

## Run validation commands

Run these after code or docs changes:

```bash
make js-test
make guardrail
git diff --check
```

Run the browser smoke test for contextual feedback screenshot/privacy changes:

```bash
make compose-smoke-feedback-privacy
```

Run `make phpunit` when backend behavior, API contracts, or persistence are
touched.

## Clean up

Leave PR worktrees in place unless cleanup was explicitly requested.

Stop the worktree stack when it is no longer needed:

```bash
cd /home/bartdeijkers/_worktrees/<worktree-name>
docker compose down --remove-orphans
```

Restore the main checkout stack afterward when needed:

```bash
cd /home/bartdeijkers/kiwi
make compose-up
```
