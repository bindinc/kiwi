import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';

// theme_audit: BEFORE observations do not accept the observed presentation or focus behavior.
const phase = process.env.KIWI_THEME_AUDIT_OVERLAY_PHASE || 'before';
if (!['before', 'after'].includes(phase)) throw new Error('Overlay phase must be before or after.');
const hash = value => createHash('sha256').update(value).digest('hex');
const modulePath = fileURLToPath(import.meta.url);
const screenshotSdkUrl = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm';
const screenshotSdkSha256 = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';
const behaviorFiles = [
    'js/app/contextual-feedback/index.js', 'js/app/contextual-feedback/button.js',
    'js/app/contextual-feedback/dialog.js', 'js/app/contextual-feedback/settings-modal.js',
    'js/app/contextual-feedback/screenshot.js', 'js/app/contextual-feedback/screenshot-redaction.js',
    'js/app/contextual-feedback/screenshot-form-state.js', 'js/app/lightbox-drafts.js',
    'js/app/slices/app-shell-slice.js', 'js/app/customer-editor.js'
];
const longComment = 'Deze lange synthetische opmerking blijft behouden bij sluiten en opnieuw openen. Controleer de volledige toelichting, de gekozen ernst en het volgende bereikbare formulieronderdeel.';
const fixtureCustomer = {
    id: 990801, firstName: 'Synthetic', lastName: 'Overlay customer with a long display name',
    sourceSystem: 'theme-audit-local', deliveryRemarks: { default: '' },
    subscriptions: [{ id: 990811, magazine: 'Avrobode', status: 'active', duration: '1-jaar', startDate: '2025-01-01' }]
};

function safeSettings(baseUrl, enabled = false) {
    return {
        feedbackEnabled: enabled, allowedRoles: ['admin', 'dev', 'supervisor'],
        teamsWebhookConfigured: false, teamsWebhookSource: 'none',
        originalDataWebhookConfigured: false, originalDataWebhookSource: 'none',
        publicBaseUrl: baseUrl.href.replace(/\/$/, ''), imageTtlDays: 14, maxImageBytes: 3145728, updatedAt: null
    };
}

function exactObject(actual, expected) {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
    const keys = Object.keys(actual).sort();
    return JSON.stringify(keys) === JSON.stringify(Object.keys(expected).sort())
        && keys.every(key => actual[key] === expected[key]);
}

async function verifyBaseline(driver) {
    const filename = process.env.KIWI_THEME_OVERLAY_BASELINE_PROOF;
    if (!filename) throw new Error('Provide the reviewed source-equivalence artifact in KIWI_THEME_OVERLAY_BASELINE_PROOF.');
    const raw = await readFile(filename), proof = JSON.parse(raw);
    if (proof.baselineSource !== '771ab506a43feddb4a56d76cd68248ef77738dcd' || proof.mismatches !== 0 || proof.files !== 212) {
        throw new Error('The reviewed accepted07 baseline proof is required for this BEFORE checkpoint.');
    }
    if (!Array.isArray(proof.sourceSha256) || proof.sourceSha256.length !== proof.files) throw new Error('Baseline proof must contain its declared source entries.');
    const entries = new Map();
    for (const entry of proof.sourceSha256) {
        const validPath = typeof entry.path === 'string' && /^(assets|templates|src)\//.test(entry.path) && !entry.path.split('/').includes('..');
        if (!validPath || !/^[a-f0-9]{64}$/.test(entry.sha256) || entries.has(entry.path)) throw new Error('Invalid or duplicate baseline source entry.');
        entries.set(entry.path, entry.sha256);
    }
    const files = [
        ...['styles.css', 'contextual-feedback.css', 'delivery-date-picker.css', 'article-search.css', 'session-outbox.css'].map(name => 'assets/css/' + name),
        ...behaviorFiles.map(file => 'assets/' + file),
        ...['index.html.twig', 'access_denied.html.twig', 'logged_out.html.twig'].map(name => 'templates/base/' + name),
        'assets/js/i18n/nl.js', 'assets/js/i18n/en.js', 'src/Controller/HomeController.php',
        'assets/js/app/contextual-feedback/annotation-canvas.js', 'assets/js/app/contextual-feedback/element-picker.js',
        'assets/js/app/contextual-feedback/payload.js'
    ];
    for (const file of files) {
        const actual = hash(await readFile(path.join(driver.sourceRoot, file)));
        if (!entries.has(file) || actual !== entries.get(file)) throw new Error('BEFORE source no longer matches its baseline: ' + file);
    }
    return { filename, sha256: hash(raw), baselineSource: proof.baselineSource, scaffoldSource: proof.scaffoldSource,
        productFilesInProof: proof.files, freshScopedSourceChecks: files.length,
        boundary: 'The root212-file equivalence proof is reused; touched and load-bearing source files are freshly guarded here.' };
}

async function installTransport(page, driver, { allowSettingsEnable = false } = {}) {
    const sdkFilename = process.env.KIWI_THEME_OVERLAY_SDK_FILE;
    if (!sdkFilename) throw new Error('Provide the preserved pinned SDK bundle in KIWI_THEME_OVERLAY_SDK_FILE.');
    const sdkBytes = await readFile(sdkFilename);
    if (hash(sdkBytes) !== screenshotSdkSha256) throw new Error('Pinned screenshot SDK bytes differ from their reviewed preserved bundle.');
    const settingsPath = new URL('api/v1/development-feedback/settings', driver.baseUrl).pathname;
    const offersPath = new URL('api/v1/webabo/offers', driver.baseUrl).pathname;
    const outboxPath = new URL('api/v1/outbox-sessions', driver.baseUrl).pathname;
    const controls = { settingsPuts: 0 };
    const expectedSettings = { feedbackEnabled: true,
        publicBaseUrl: driver.baseUrl.href.replace(/\/$/, ''), imageTtlDays: 14, maxImageBytes: 3145728,
        clearWebhookUrl: false, clearOriginalDataWebhookUrl: false };
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        if (method === 'GET' && url.href === screenshotSdkUrl) {
            driver.report.overlayEvidence.fixtureRequests.push({ method, kind: 'Exact source-declared pinned SDK read, fulfilled from unchanged preserved bytes.',
                url: screenshotSdkUrl, filename: sdkFilename, sha256: screenshotSdkSha256, bytes: sdkBytes.length });
            return route.fulfill({ contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: sdkBytes });
        }
        if (url.origin !== driver.baseUrl.origin) {
            if (['data:', 'blob:', 'about:'].includes(url.protocol)) return route.fallback();
            driver.report.blockedWrites.push({ method, path: url.pathname, reason: 'Unexpected non-local origin.' });
            return route.abort('blockedbyclient');
        }
        if (method === 'GET' && url.pathname === settingsPath) {
            driver.report.overlayEvidence.fixtureRequests.push({ method, path: url.pathname, kind: 'Safe synthetic settings read; no secret values.' });
            return route.fulfill({ json: safeSettings(driver.baseUrl) });
        }
        if (method === 'PUT' && url.pathname === settingsPath) {
            let payload;
            try { payload = request.postDataJSON(); } catch { payload = null; }
            const csrfHeaderPresent = Boolean(request.headers()['x-csrf-token']);
            if (allowSettingsEnable && controls.settingsPuts === 0 && csrfHeaderPresent && exactObject(payload, expectedSettings)) {
                controls.settingsPuts += 1;
                driver.report.overlayEvidence.fixtureRequests.push({ method, path: url.pathname,
                    kind: 'One exact synthetic settings UI save; locally fulfilled, never persisted.',
                    payloadKeys: Object.keys(payload).sort(), emptySecretPropertiesVerified: true, csrfHeaderPresent });
                return route.fulfill({ json: safeSettings(driver.baseUrl, true) });
            }
        }
        if (method === 'GET' && url.pathname === offersPath && url.searchParams.get('limit') === '250') {
            return route.fulfill({ json: { items: [], total: 0 } });
        }
        if (method === 'GET' && url.pathname === outboxPath) return route.fulfill({ json: { items: [], total: 0 } });
        const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(method);
        const isLocalOidcLogin = method === 'POST' && url.pathname.startsWith('/kiwi-oidc/realms/')
            && url.pathname.endsWith('/login-actions/authenticate');
        if (!isRead && !isLocalOidcLogin) {
            driver.report.blockedWrites.push({ method, path: url.pathname, reason: 'Unexpected write; no request was forwarded.' });
            return route.abort('blockedbyclient');
        }
        return route.fallback();
    });
    return controls;
}

function trackRuntimeErrors(page, driver, viewport) {
    page.on('pageerror', error => driver.report.errors.push({ scenario: 'overlay runtime', viewport,
        message: error.message.replaceAll('kiwi-local-dev-password', '[local fixture password]').replace(/https?:\/\/\S+/g, '[local URL]').slice(0, 500) }));
}

async function trackBehavior(page, driver, meta) {
    const trackedFiles = phase === 'after' ? behaviorFiles.concat(['js/app/contextual-feedback/modal-surface.js', 'js/app/contextual-feedback/selector.js', 'js/app/overlay-notification.js', 'js/i18n/nl.js', 'js/i18n/en.js']) : behaviorFiles;
    const sources = Object.fromEntries(await Promise.all(trackedFiles.map(async file =>
        [file, await readFile(path.join(driver.sourceRoot, 'assets', file), 'utf8')])));
    const pending = [], seen = new Set();
    page.on('response', response => {
        const url = new URL(response.url());
        const file = trackedFiles.find(file => {
            const expected = new URL('assets/' + file, driver.baseUrl), stem = path.posix.basename(expected.pathname, '.js');
            return url.origin === expected.origin && path.posix.dirname(url.pathname) === path.posix.dirname(expected.pathname)
                && new RegExp('^' + stem + '(?:-[\\w-]{7})?\\.js$').test(path.posix.basename(url.pathname));
        });
        if (!file) return;
        pending.push((async () => {
            const body = await response.body().catch(() => null); if (!body) return;
            const source = sources[file], sourceUrl = new URL('assets/' + file, driver.baseUrl);
            const sourceHash = hash(normalizeKnownJsImports(source, source, sourceUrl));
            const servedHash = hash(normalizeKnownJsImports(body.toString('utf8'), source, sourceUrl));
            driver.report.overlayEvidence.loadedBehavior.push({ file, sourceHash, servedHash, ...meta });
            driver.check(file + ' overlay source matches actual served behavior', servedHash, sourceHash, meta, 8);
            seen.add(file);
        })());
    });
    return async () => {
        await Promise.all(pending);
        for (const file of trackedFiles) driver.check(file + ' overlay behavior actually loaded', seen.has(file), true, meta, 8);
    };
}

async function observe(page, driver, meta, name, rootSelector, panelSelector = rootSelector, kind = 'Actual installed application handler with declared local fixture data') {
    await driver.painted(page);
    await page.evaluate(async selectors => {
        const roots = selectors.map(selector => document.querySelector(selector)).filter(Boolean);
        const animations = [...new Set(roots.flatMap(root => root.getAnimations({ subtree: true })))];
        const finite = animations.filter(animation => animation.playState === 'running'
            && Number.isFinite(animation.effect?.getComputedTiming().endTime));
        await Promise.all(finite.map(animation => animation.finished.catch(() => {})));
    }, [rootSelector, panelSelector]);
    await driver.painted(page);
    await driver.capture(page, phase + '-overlay-' + name, undefined, kind);
    const data = await page.evaluate(({ rootSelector, panelSelector }) => {
        const box = node => {
            if (!node) return null;
            const r = node.getBoundingClientRect(), s = getComputedStyle(node);
            return { tag: node.tagName, id: node.id, x: r.x, y: r.y, width: r.width, height: r.height,
                right: r.right, bottom: r.bottom, background: s.backgroundColor, filter: s.filter,
                backdropFilter: s.backdropFilter, opacity: s.opacity, radius: s.borderRadius, padding: s.padding,
                fontSize: s.fontSize, lineHeight: s.lineHeight, shadow: s.boxShadow, overflow: s.overflow,
                outline: s.outline, outlineOffset: s.outlineOffset, focusVisible: node.matches(':focus-visible') };
        };
        const root = document.querySelector(rootSelector), panel = document.querySelector(panelSelector);
        const active = document.activeElement;
        const background = [...document.body.children].find(node => node !== root && !node.matches('[data-feedback-ignore],script'));
        return { viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
            documentWidth: document.documentElement.scrollWidth, scrollX, scrollY,
            root: box(root), panel: box(panel), backdrop: root ? getComputedStyle(root, '::backdrop').backgroundColor : null,
            bodyReviewing: document.body.classList.contains('contextual-feedback-reviewing'), background: box(background),
            activeOverlayLayers: [...document.querySelectorAll('.form-container,.form-lightbox,.modal,.contextual-feedback-modal,.contextual-feedback-settings-modal')]
                .filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none')
                .map(node => ({ ...box(node), className: node.className, nativeModal: node.matches(':modal') })),
            title: box(panel?.querySelector('h1,h2')), header: box(panel?.querySelector('header,.form-header,.modal-header')),
            active: box(active), activeInside: Boolean(root?.contains(active)),
            fields: [...(root?.querySelectorAll('input:not([type=hidden]),select,textarea,button,a[href]') || [])].map(node => ({
                ...box(node), name: node.getAttribute('name'), disabled: node.disabled, checked: node.checked,
                value: node.type === 'password' ? undefined : node.value, labelCount: node.labels?.length,
                hasAccessibleName: Boolean(node.labels?.length || node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || node.textContent?.trim())
            })) };
    }, { rootSelector, panelSelector });
    const last = driver.report.captures.at(-1);
    const png = meta.native ? null : (await readFile(path.join(driver.evidenceDir, last.filename))).toString('base64');
    const pixels = meta.native ? [] : await page.evaluate(async data => {
        const image = new Image(); image.src = 'data:image/png;base64,' + data;
        await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        return [0.25, 0.5, 0.75].map(fraction => {
            const x = 2, y = Math.min(image.height - 1, Math.floor(image.height * fraction));
            return { x, y, rgba: [...ctx.getImageData(x, y, 1, 1).data] };
        });
    }, png);
    driver.report.overlayEvidence.observations.push({ ...meta, state: name, kind, filename: last.filename, data, colorSampleBoundary: meta.native ? 'Native full-desktop pixels are not CSS viewport coordinates; use uncropped image review.' : 'Three uniform viewport-edge samples describe color only; sharpness requires whole images/computed filters.', outsidePanelColorSamples: pixels.map(pixel => ({ ...pixel, outsidePanel: !data.panel || pixel.x < data.panel.x || pixel.x >= data.panel.right || pixel.y < data.panel.y || pixel.y >= data.panel.bottom })) });
    return data;
}

async function openFeedback(page) {
    await page.locator('#contextualFeedbackButton').evaluate(node => node.click());
    await page.locator('.contextual-feedback-modal').waitFor({ state: 'visible' });
}

async function closeFeedback(page) {
    // Setup focus is explicit: BEFORE may expose an existing broken sequential focus boundary.
    await page.locator('.contextual-feedback-modal textarea[name=comment]').focus();
    await page.keyboard.press('Escape');
    await page.locator('.contextual-feedback-modal').waitFor({ state: 'hidden' });
}

async function focusByTab(page, selector, limit = 18) {
    const sequence = [];
    for (let attempt = 0; attempt < limit; attempt += 1) {
        if (await page.locator(selector).evaluate(node => node === document.activeElement)) return { reached: true, sequence };
        await page.keyboard.press('Tab');
        sequence.push(await page.evaluate(() => ({ id: document.activeElement?.id, name: document.activeElement?.getAttribute('name'), tag: document.activeElement?.tagName })));
    }
    return { reached: false, sequence };
}

async function waitForToastIdle(page) {
    await page.waitForFunction(() => !document.getElementById('toast')?.classList.contains('show'));
}

async function showNotification(page) {
    await waitForToastIdle(page);
    await page.evaluate(() => window.kiwiAppShellSlice.showToast(
        'Synthetische foutmelding met volledige toelichting. Bewaar de invoer en probeer de bestaande actie opnieuw.',
        'error', { recordContactHistory: false }));
    await page.waitForFunction(() => {
        const toast = document.getElementById('toast'), transform = toast && getComputedStyle(toast).transform;
        return toast?.classList.contains('show') && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(transform);
    });
}

async function ordinaryOverlays(page, driver, meta) {
    const outboxToggle = page.locator('#subscriptionQueueToggle');
    if (await outboxToggle.getAttribute('aria-expanded') !== 'true') await outboxToggle.press('Enter');
    await page.locator('#subscriptionQueuePanel').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'underlying', 'body', 'main');
    await page.locator('[data-action=show-new-subscription]').first().press('Enter');
    await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'new-subscription', '#newSubscriptionForm', '#newSubscriptionForm .card');
    await page.locator('#newSubscriptionForm [data-action=close-form]').first().press('Enter');
    await page.locator('#newSubscriptionForm').waitFor({ state: 'hidden' });

    await openFeedback(page);
    await observe(page, driver, meta, 'feedback-initial', '.contextual-feedback-modal', '.contextual-feedback-panel',
        'Actual dialog from installed button-handler invocation; preference unchanged, not pointer-entry proof');
    await page.locator('.contextual-feedback-modal textarea[name=comment]').fill(longComment);
    const tab = await focusByTab(page, '[data-feedback-submit]');
    driver.report.overlayEvidence.observations.push({ ...meta, state: 'feedback-tab-sequence', tab });
    await observe(page, driver, meta, 'feedback-actions-focus', '.contextual-feedback-modal', '.contextual-feedback-panel');
    await closeFeedback(page);
    await openFeedback(page);
    driver.report.overlayEvidence.observations.push({ ...meta, state: 'feedback-reopened-draft',
        retainedComment: await page.locator('textarea[name=comment]').inputValue() === longComment });
    await closeFeedback(page);

    await page.locator('#contextualFeedbackSettingsButton').press('Enter');
    await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'settings-initial', '.contextual-feedback-settings-modal', '.contextual-feedback-settings-panel');
    const settingsTab = await focusByTab(page, '.contextual-feedback-settings-modal button[type=submit]', 24);
    driver.report.overlayEvidence.observations.push({ ...meta, state: 'settings-tab-sequence', tab: settingsTab });
    await observe(page, driver, meta, 'settings-actions-focus', '.contextual-feedback-settings-modal', '.contextual-feedback-settings-panel');
    await page.keyboard.press('Escape');
    if (await page.locator('.contextual-feedback-settings-modal').isVisible()) {
        await page.locator('.contextual-feedback-settings-modal input').first().focus();
        await page.keyboard.press('Escape');
    }
    await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'hidden' });
}

async function genericOverlays(page, driver, meta) {
    await page.evaluate(customer => window.kiwiLegacyCustomerSearchBridge.setCurrentCustomer(structuredClone(customer)), fixtureCustomer);
    await page.evaluate(() => window.kiwiDeliveryRemarksSlice.editDeliveryRemarks());
    await page.locator('#editDeliveryRemarksModal').waitFor({ state: 'visible' });
    await page.locator('#editCustomerDeliveryRemarks').fill('Lange synthetische bezorginstructie voor formulierbehoud en volledige zichtbaarheid van de actuele focus.');
    await page.locator('#editCustomerDeliveryRemarks').scrollIntoViewIfNeeded();
    await observe(page, driver, meta, 'delivery-focused-note', '#editDeliveryRemarksModal', '#editDeliveryRemarksModal .modal-content');
    await showNotification(page);
    await observe(page, driver, meta, 'notification-in-modal', '#editDeliveryRemarksModal', '#editDeliveryRemarksModal .modal-content');
    await page.evaluate(() => window.kiwiDeliveryRemarksSlice.closeEditRemarksModal());
    await waitForToastIdle(page);

    await page.evaluate(() => window.kiwiCallAgentRuntime.showDispositionModal());
    await page.locator('#dispositionModal').waitFor({ state: 'visible' });
    await page.locator('#dispNotes').fill('Synthetische toelichting bij de bestaande afsluitreden; geen gesprek of registratie wordt verstuurd.');
    await page.locator('#dispFollowUpRequired').check();
    await page.locator('#dispFollowUpNotes').fill('Lange synthetische vervolgnotitie die bij een laag venster volledig met focus bereikbaar moet blijven.');
    await page.locator('#dispFollowUpNotes').scrollIntoViewIfNeeded();
    await observe(page, driver, meta, 'disposition-followup-focus', '#dispositionModal', '#dispositionModal .modal-content');
    await page.evaluate(() => window.kiwiCallAgentRuntime.cancelDisposition());
    await waitForToastIdle(page);

    await page.evaluate(() => window.kiwiCallAgentRuntime.openDebugModal());
    await page.locator('#debugModal').waitFor({ state: 'visible' });
    await page.locator('#debugQueueSize').focus();
    await page.locator('#debugQueueSize').scrollIntoViewIfNeeded();
    await observe(page, driver, meta, 'debug-focused-field', '#debugModal', '#debugModal .modal-content');
    await page.locator('#debugModal [data-action="debug.close-modal"]').press('Enter');
    await showNotification(page);
    await observe(page, driver, meta, 'notification-global', '#toast', '#toast');
    await waitForToastIdle(page);
}

async function captureLifecycle(page, driver, meta) {
    if (![1440, 390].includes(meta.viewport.width) || meta.viewport.height < 1000) return;
    const target = page.locator('#welcomeMessage h2');
    await target.scrollIntoViewIfNeeded();
    const bounds = await target.boundingBox();
    if (!bounds) throw new Error('The actual safe welcome heading is required for capture.');
    await openFeedback(page);
    await page.locator('[data-feedback-add-screenshot]').press('Enter');
    await page.locator('.contextual-feedback-picker-overlay').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'capture-suspended', '.contextual-feedback-picker-overlay');
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.locator('.contextual-feedback-modal.has-screenshot canvas').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('[data-feedback-canvas]')?.width > 0);
    await observe(page, driver, meta, 'feedback-image-review', '.contextual-feedback-modal', '.contextual-feedback-panel');
    const before = await page.locator('textarea[name=comment]').inputValue();
    await closeFeedback(page);
    await openFeedback(page);
    driver.report.overlayEvidence.observations.push({ ...meta, state: 'feedback-retained-image',
        hasScreenshot: await page.locator('.contextual-feedback-modal').evaluate(node => node.classList.contains('has-screenshot')),
        retainedComment: await page.locator('textarea[name=comment]').inputValue() === before });
    if (meta.viewport.width === 390) await page.setViewportSize({ width: 390, height: 320 });
    await observe(page, driver, { ...meta, viewport: page.viewportSize() }, meta.viewport.width === 390 ? 'feedback-image-review-short' : 'feedback-image-review-retained', '.contextual-feedback-modal', '.contextual-feedback-panel');
    await page.locator('[data-feedback-remove-screenshot]').press('Enter');
    await page.locator('[data-feedback-workspace]').waitFor({ state: 'hidden' });
    await observe(page, driver, { ...meta, viewport: page.viewportSize() }, 'feedback-image-removed', '.contextual-feedback-modal', '.contextual-feedback-panel');
    await closeFeedback(page);
    if (meta.viewport.width === 390) await page.setViewportSize(meta.viewport);
}

async function nestedEscape(page, driver, meta) {
    if (meta.viewport.height < 1000 || ![1440, 390].includes(meta.viewport.width)) return;
    await page.evaluate(customer => {
        window.kiwiLegacyCustomerSearchBridge.setCurrentCustomer(structuredClone(customer));
        window.editSubscription(990811);
    }, fixtureCustomer);
    await page.locator('#editSubscriptionForm').waitFor({ state: 'visible' });
    await page.locator('#editSubDuration').selectOption('2-jaar');
    await openFeedback(page);
    await observe(page, driver, meta, 'nested-feedback-open', '.contextual-feedback-modal', '.contextual-feedback-panel');
    await page.locator('textarea[name=comment]').focus();
    await page.keyboard.press('Escape');
    driver.report.overlayEvidence.observations.push({ ...meta, state: 'nested-feedback-escape',
        feedbackVisible: await page.locator('.contextual-feedback-modal').isVisible(),
        underlyingVisible: await page.locator('#editSubscriptionForm').isVisible(),
        retainedDraftDuration: await page.locator('#editSubDuration').inputValue() === '2-jaar' });
    await observe(page, driver, meta, 'nested-feedback-escape-result', 'body', '#editSubscriptionForm');
    if (await page.locator('.contextual-feedback-modal').isVisible()) await closeFeedback(page);
    await page.evaluate(() => window.editSubscription(990811));
    await page.locator('#editSubscriptionForm').waitFor({ state: 'visible' });
    await page.locator('#contextualFeedbackSettingsButton').press('Enter');
    await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'nested-settings-open', '.contextual-feedback-settings-modal', '.contextual-feedback-settings-panel');
    await page.locator('.contextual-feedback-settings-modal input').first().focus();
    await page.keyboard.press('Escape');
    driver.report.overlayEvidence.observations.push({ ...meta, state: 'nested-settings-escape',
        settingsVisible: await page.locator('.contextual-feedback-settings-modal').isVisible(),
        underlyingVisible: await page.locator('#editSubscriptionForm').isVisible(),
        retainedDraftDuration: await page.locator('#editSubDuration').inputValue() === '2-jaar' });
    await observe(page, driver, meta, 'nested-settings-escape-result', 'body', '#editSubscriptionForm');
    if (await page.locator('#editSubscriptionForm').isVisible()) await page.locator('#editSubscriptionForm [data-action=close-form]').first().press('Enter');
}

async function nativeCoexistence(page, driver, meta, controls) {
    await page.locator('#contextualFeedbackSettingsButton').press('Enter');
    const form = page.locator('[data-feedback-settings-form]');
    await form.locator('[name=feedbackEnabled]').check();
    driver.check('native coexistence settings secret inputs remain empty',
        await form.locator('input[type=password]').evaluateAll(nodes => nodes.every(node => node.value === '')), true, meta, 8);
    await form.locator('button[type=submit]').press('Enter');
    await page.locator('#contextualFeedbackButton').waitFor({ state: 'visible' });
    driver.check('only one declared local settings UI save was fulfilled', controls.settingsPuts, 1, meta, 8);
    await page.locator('[data-feedback-settings-close]').first().press('Enter');
    await page.evaluate(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type=importmap]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/customer-editor.js'));
        if (!key) throw new Error('Actual source editor import is required.');
        const { openCustomerEditor } = await import(imports[key]);
        await openCustomerEditor({ id: 'theme-audit-08-native', credentialKey: 'theme-audit-08', firstName: 'Synthetic', lastName: 'Native overlay fixture' }, {
            api: { get: async url => {
                    if (url !== '/api/v1/persons/theme-audit-08-native/editing?credentialKey=theme-audit-08') throw new Error('Unexpected native fixture read URL.');
                    return { capabilities: { roleCanWrite: false, operations: {} }, sections: {} };
                },
                request: async () => { throw new Error('Native overlay fixture forbids writes.'); } }, refresh: async () => {}
        });
    });
    await page.locator('dialog.customer-editor[open]').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'native-editor-backdrop', 'dialog.customer-editor[open]', 'dialog.customer-editor[open] .card',
        'Actual source editor showModal constructor with declared readonly model; not server permission acceptance');
    const button = page.locator('#contextualFeedbackButton');
    const hit = await button.evaluate(node => {
        const r = node.getBoundingClientRect(), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { visible: r.width > 0 && r.height > 0, hitTag: target?.tagName, hitId: target?.id, hitInsideButton: node.contains(target) };
    });
    let pointerAttempt;
    try { await button.click({ timeout: 1500 }); pointerAttempt = { completed: true }; }
    catch (error) { pointerAttempt = { completed: false,
        message: error.message.replace(/https?:\/\/\S+/g, '[local URL]').slice(0, 1000) }; }
    driver.report.overlayEvidence.observations.push({ ...meta, state: 'native-visible-feedback-entry-observation', hit, pointerAttempt,
        feedbackDomVisible: await page.locator('.contextual-feedback-modal').isVisible(),
        boundary: 'Native background inertness is a platform/entry observation, not a newly required feedback-over-native feature.' });
    await observe(page, driver, meta, 'native-editor-feedback-entry', 'dialog.customer-editor[open]', 'dialog.customer-editor[open] .card');
    await page.keyboard.press('Escape');
    await page.locator('dialog.customer-editor[open]').waitFor({ state: 'hidden' });
    await button.click();
    await page.locator('.contextual-feedback-modal').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'visible-feedback-trigger-outside-native', '.contextual-feedback-modal', '.contextual-feedback-panel');
    await closeFeedback(page);
}

async function accountPage(driver, viewport, denied) {
    const context = await driver.newContext(viewport), page = await context.newPage();
    await installTransport(page, driver);
    trackRuntimeErrors(page, driver, viewport);
    const meta = { viewport, role: denied ? 'donny (no Kiwi role)' : 'public logged-out route', phase };
    const expected = new URL('assets/css/styles.css', driver.baseUrl), source = await readFile(path.join(driver.sourceRoot, 'assets/css/styles.css'), 'utf8');
    const pending = []; let loaded = false; let homeStatus = null;
    page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === driver.baseUrl.origin && url.pathname === driver.baseUrl.pathname) homeStatus = response.status();
        if (url.origin !== expected.origin || path.posix.dirname(url.pathname) !== path.posix.dirname(expected.pathname)
            || !/^styles(?:-[\w-]{7})?\.css$/.test(path.posix.basename(url.pathname))) return;
        pending.push((async () => {
            const body = await response.body();
            const a = hash(driver.normalizeMappedCssUrls(source, source)), b = hash(driver.normalizeMappedCssUrls(body.toString('utf8'), source));
            driver.check('account route styles source matches actual served CSS', b, a, meta, 8); loaded = true;
        })());
    });
    try {
        if (denied) {
            await page.goto(driver.baseUrl.href);
            await page.locator('[name=username]').fill('donny');
            await page.locator('[name=password]').fill('kiwi-local-dev-password');
            await Promise.all([page.waitForURL(url => url.pathname === driver.baseUrl.pathname),
                page.locator('input[type=submit],button[type=submit]').click()]);
        } else await page.goto(new URL('logged-out', driver.baseUrl).href);
        await page.locator('.access-denied-card h1').waitFor({ state: 'visible' });
        if (denied) driver.check('actual no-role home route returns403', homeStatus, 403, meta, 8);
        await observe(page, driver, meta, denied ? 'account-access-denied' : 'account-logged-out', 'body', '.access-denied-card',
            'Actual server account-state route; no logout POST, role DOM simulation or permission change');
        await Promise.all(pending);
        driver.check('actual account route loads its own shared stylesheet', loaded, true, meta, 8);
    } finally { await context.close(); }
}

export async function inspectOverlays(driver, viewport, contract) {
    if (phase === 'after') {
        const { inspectOverlayAcceptance } = await import('./compose-smoke-theme-audit-overlays-acceptance.mjs');
        return inspectOverlayAcceptance({ ...driver, contract }, viewport);
    }
    driver.report.overlayEvidence ||= { phase,
        baseline: await verifyBaseline(driver),
        companion: { path: modulePath, sha256: hash(await readFile(modulePath)) },
        observations: [], fixtureRequests: [], loadedBehavior: [],
        boundary: 'Observational source/locale counters only; actual geometry/focus/backdrop differences are not acceptance. No screenshot upload or forwarded business/settings write.' };
    const context = await driver.newContext(viewport), page = await context.newPage();
    page.setDefaultTimeout(12000);
    const meta = { viewport, role: 'kiwi-admin', phase };
    await installTransport(page, driver);
    const finishAssets = driver.trackStylesheets(page, viewport), finishBehavior = await trackBehavior(page, driver, meta);
    trackRuntimeErrors(page, driver, viewport);
    try {
        await driver.login(page);
        driver.check('actual overlay application locale', await page.locator('html').getAttribute('lang'), 'nl', meta, 8);
        await ordinaryOverlays(page, driver, meta);
        await captureLifecycle(page, driver, meta);
        await genericOverlays(page, driver, meta);
        await nestedEscape(page, driver, meta);
    } catch (error) {
        driver.report.errors.push({ scenario: 'overlay BEFORE', viewport, message: error.message.replaceAll('kiwi-local-dev-password', '[local fixture password]').replace(/https?:\/\/\S+/g, '[local URL]').slice(0, 1200) });
        await driver.capture(page, 'before-overlay-failure', undefined, 'Actual failed observational setup; not accepted').catch(() => {});
    } finally {
        await finishBehavior(); await finishAssets(); await context.close(); await driver.saveReport();
    }
    for (const denied of [false, true]) await accountPage(driver, viewport, denied);
    if (viewport.width === 1440 && viewport.height === 1000) {
        const nativeContext = await driver.newContext(viewport), nativePage = await nativeContext.newPage();
        const controls = await installTransport(nativePage, driver, { allowSettingsEnable: true });
        trackRuntimeErrors(nativePage, driver, viewport);
        const finish = driver.trackStylesheets(nativePage, viewport);
        try { await driver.login(nativePage); await nativeCoexistence(nativePage, driver, meta, controls); }
        finally { await finish(); await nativeContext.close(); await driver.saveReport(); }
    }
}

export { behaviorFiles, safeSettings, exactObject, observe, trackBehavior, trackRuntimeErrors, accountPage };
