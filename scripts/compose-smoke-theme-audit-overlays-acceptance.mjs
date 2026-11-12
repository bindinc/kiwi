import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { accountPage, exactObject, observe, safeSettings, trackBehavior, trackRuntimeErrors } from './compose-smoke-theme-audit-overlays.mjs';

// theme_audit: exact local responses exercise real frontend handlers, never upstream writes.
const modulePath = fileURLToPath(import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sdkUrl = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm';
const sdkHash = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';
const suite = process.env.KIWI_THEME_AUDIT_OVERLAY_SUITE || 'matrix';
const feedbackSelector = '.contextual-feedback-modal';
const settingsSelector = '.contextual-feedback-settings-modal';
const inlineSelector = '.overlay-notification.error';
const comment = 'Synthetic overlay08 comment retained through capture, dismissal, failure and explicit retry.';
const rejection = 'Synthetic feedback request08 was rejected; retain the screenshot and complete draft.';
const privatePerson = 'Synthetic Elena Overlay08';
const privateEmail = 'synthetic.inline08@example.invalid';
const privateError = `Synthetic request failed for ${privatePerson}, ${privateEmail}; preserve the draft and retry.`;
const expectedComplaint = { magazine: 'Avrobode', type: 'klacht', category: 'inhoud',
    description: 'Synthetic inline08 complaint retained after the controlled rejection.', edition: 'Synthetic edition08', followup: true };

function validateLocalUrl(value) {
    const url = new URL(value);
    const local = ['bdc.rtvmedia.org.local', 'localhost', '127.0.0.1'].includes(url.hostname);
    if (!local || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Overlay08 requires a credential-free local HTTP(S) base URL without query or fragment.');
    }
    return url;
}

function validSourcePath(value) {
    return typeof value === 'string' && /^(assets|templates|src)\//.test(value) && !value.split('/').includes('..');
}

async function register(driver) {
    if (driver.report.overlayAcceptance) return;
    if (process.env.KIWI_THEME_AUDIT_OVERLAY_PHASE !== 'after' || process.env.KIWI_THEME_AUDIT_SLICE !== '8') {
        throw new Error('Required overlay08 checks need explicit slice08/after mode.');
    }
    validateLocalUrl(driver.baseUrl.href);
    const filename = process.env.KIWI_THEME_OVERLAY_SOURCE_PROOF;
    if (!filename) throw new Error('Provide the reviewed frozen candidate in KIWI_THEME_OVERLAY_SOURCE_PROOF.');
    const raw = await readFile(filename), proof = JSON.parse(raw);
    const head = driver.report.application?.commit || execFileSync('git', ['-C', driver.sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const correctCandidate = /^[a-f0-9]{40}$/.test(proof.candidateSource) && proof.candidateSource === head;
    if (!correctCandidate || !Array.isArray(proof.sourceSha256) || proof.sourceSha256.length !== proof.files || proof.files < 200) {
        throw new Error('The complete reviewed08 candidate source proof must match the checked-out source commit.');
    }
    const seen = new Set();
    for (const entry of proof.sourceSha256) {
        if (!validSourcePath(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || seen.has(entry.path)) throw new Error('Invalid candidate source entry.');
        if (hash(await readFile(path.join(driver.sourceRoot, entry.path))) !== entry.sha256) throw new Error('Candidate source changed: ' + entry.path);
        seen.add(entry.path);
    }
    if (suite === 'boundaries') {
        const breakpoint = Number(process.env.KIWI_THEME_AUDIT_OVERLAY_BREAKPOINT);
        if (!proof.changedOverlayBreakpoints?.includes(breakpoint)) throw new Error('Boundary suite must use a reviewed actual changed overlay breakpoint.');
    }
    driver.report.overlayEvidence ||= { phase: 'after', observations: [], fixtureRequests: [], loadedBehavior: [] };
    driver.report.overlayAcceptance = { sourceProof: { filename, sha256: hash(raw), candidateSource: head, files: proof.files },
        module: { path: modulePath, sha256: hash(await readFile(modulePath)) }, suite, states: [], interactions: [], privacy: [],
        boundary: 'Required scoped UI checks plus independent full-image review; local fixture acknowledgement is not upstream persistence.' };
}

function settingsPayload(baseUrl) {
    return { feedbackEnabled: true, publicBaseUrl: baseUrl.href.replace(/\/$/, ''), imageTtlDays: 14, maxImageBytes: 3145728,
        clearWebhookUrl: false, clearOriginalDataWebhookUrl: false };
}

async function readJson(request) {
    try { return request.postDataJSON(); } catch { return null; }
}

async function readFeedbackMultipart(request, expected) {
    const bytes = request.postDataBuffer(), contentType = request.headers()['content-type'];
    if (!bytes || !contentType?.startsWith('multipart/form-data;')) throw new Error('Expected actual source multipart feedback request.');
    const form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
    const keys = [...form.keys()].sort(), expectedKeys = expected.images ? ['originalScreenshot', 'payload', 'screenshot'] : ['payload'];
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error('Unexpected feedback multipart fields or duplicates.');
    const payload = JSON.parse(form.get('payload'));
    if (!isDeepStrictEqual(payload, expected.payload)) throw new Error('Actual feedback payload differs from the declared source contract.');
    const files = [];
    for (const [field, filename] of [['screenshot', 'kiwi-contextual-feedback-pseudonymized.png'], ['originalScreenshot', 'kiwi-contextual-feedback-original.png']]) {
        if (!expected.images) break;
        const file = form.get(field);
        if (!file || file.name !== filename || file.type !== 'image/png' || file.size <= 0 || file.size > 3145728) throw new Error('Unexpected feedback PNG metadata.');
        const bytes = Buffer.from(await file.arrayBuffer());
        const png = bytes.length >= 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
        if (!png) throw new Error('Expected actual PNG screenshot bytes.');
        const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
        if (width !== expected.dimensions?.width || height !== expected.dimensions?.height) throw new Error('Feedback PNG dimensions differ from the actual retained canvas.');
        files.push({ field, filename, type: file.type, bytes: file.size, width, height, sha256: hash(bytes) });
    }
    return { payload, files };
}

export async function installOverlayTransport(page, driver, mode = 'ordinary') {
    validateLocalUrl(driver.baseUrl.href);
    if (!['ordinary', 'focused', 'private-error', 'legacy-privacy', 'restricted'].includes(mode)) throw new Error('Unknown explicit overlay transport mode.');
    const filename = process.env.KIWI_THEME_OVERLAY_SDK_FILE;
    if (!filename) throw new Error('Provide the preserved original screenshot SDK file.');
    const sdk = await readFile(filename);
    if (hash(sdk) !== sdkHash) throw new Error('Preserved original screenshot SDK changed.');
    const api = new URL('api/v1/', driver.baseUrl);
    const settingsPath = api.pathname + 'development-feedback/settings', feedbackPath = api.pathname + 'development-feedback';
    const controls = { mode, enabled: false, settingsPuts: 0, settingsReads: [], settingsMode: 'ready', settingsReleases: [],
        feedback: null, feedbackRequests: [], feedbackReleases: [], privateErrors: 0 };
    const settingsLimit = mode === 'legacy-privacy' ? 2 : ['restricted', 'private-error'].includes(mode) ? 0 : 1;
    const fixture = value => driver.report.overlayEvidence.fixtureRequests.push(value);
    const deny = (route, request, url, reason) => {
        driver.report.blockedWrites.push({ method: request.method(), path: url.pathname, reason });
        return route.abort('blockedbyclient');
    };
    await page.route('**/*', async route => {
        const request = route.request(), method = request.method(), url = new URL(request.url());
        if (url.username || url.password) return deny(route, request, url, 'Credential-bearing request URL is forbidden.');
        if (method === 'GET' && url.href === sdkUrl) {
            fixture({ method, url: sdkUrl, kind: 'Unchanged original pinned SDK local read.', sha256: sdkHash, bytes: sdk.length });
            return route.fulfill({ contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: sdk });
        }
        if (url.origin !== driver.baseUrl.origin) {
            if (['data:', 'blob:', 'about:'].includes(url.protocol)) return route.fallback();
            return deny(route, request, url, 'Unexpected non-local origin.');
        }
        if (method === 'GET' && url.pathname === settingsPath && !url.search) {
            const state = controls.settingsMode;
            controls.settingsReads.push({ state });
            fixture({ method, path: settingsPath, kind: 'Declared safe settings read.', state });
            if (state === 'held') await new Promise(resolve => controls.settingsReleases.push(resolve));
            if (controls.settingsMode === 'error') return route.fulfill({ status: 503, json: { error: { code: 'synthetic_settings_unavailable', message: 'Synthetic settings08 unavailable; retry the same configuration task.' } } });
            return route.fulfill({ json: safeSettings(driver.baseUrl, controls.enabled) });
        }
        const csrfPresent = Boolean(request.headers()['x-csrf-token']);
        if (method === 'PUT' && url.pathname === settingsPath && !url.search && csrfPresent && controls.settingsPuts < settingsLimit) {
            const payload = await readJson(request);
            if (!exactObject(payload, settingsPayload(driver.baseUrl))) return deny(route, request, url, 'Settings payload differs from the exact safe UI fixture.');
            controls.settingsPuts += 1; controls.enabled = true;
            fixture({ method, path: settingsPath, kind: 'Exact safe settings UI save; locally fulfilled, never persisted.', csrfPresent, secretPropertiesAbsent: true });
            return route.fulfill({ json: safeSettings(driver.baseUrl, true) });
        }
        if (method === 'POST' && url.pathname === feedbackPath && !url.search && csrfPresent && mode === 'focused' && controls.feedback) {
            const expected = controls.feedback;
            if (controls.feedbackRequests.length >= expected.limit) return deny(route, request, url, 'Unexpected extra feedback request.');
            let parsed;
            try { parsed = await readFeedbackMultipart(request, expected); }
            catch { return deny(route, request, url, 'Multipart payload or PNG metadata differs from declared local feedback fixture.'); }
            controls.feedbackRequests.push(parsed);
            fixture({ method, path: feedbackPath, kind: 'Actual frontend multipart request; locally held/rejected/retried only.', csrfPresent,
                payloadKeys: Object.keys(parsed.payload).sort(), files: parsed.files, outcome: expected.outcome });
            if (expected.held) await new Promise(resolve => controls.feedbackReleases.push(resolve));
            if (expected.outcome === 'reject') return route.fulfill({ status: 503, json: { error: { code: 'synthetic_feedback_rejected', message: rejection } } });
            return route.fulfill({ status: 200, json: { teamsDeliveryStatus: 'sent' } });
        }
        if (method === 'POST' && url.pathname === api.pathname + 'persons/990801/editorial-complaints' && !url.search && mode === 'private-error' && csrfPresent && controls.privateErrors === 0) {
            // api-client.js adds CSRF from the authenticated page for writes; no new service security header is invented.
            if (!exactObject(await readJson(request), expectedComplaint)) return deny(route, request, url, 'Unexpected private-error complaint payload.');
            controls.privateErrors += 1;
            fixture({ method, path: url.pathname, kind: 'Single declared actual-controller private-error local422; no customer write.', csrfPresent });
            return route.fulfill({ status: 422, json: { error: { code: 'synthetic_inline_private_error', message: privateError } } });
        }
        if (method === 'GET' && url.pathname === api.pathname + 'webabo/offers' && url.search === '?limit=250') return route.fulfill({ json: { items: [], total: 0 } });
        if (method === 'GET' && url.pathname === api.pathname + 'outbox-sessions') return route.fulfill({ json: { items: [], total: 0 } });
        const read = ['GET', 'HEAD', 'OPTIONS'].includes(method);
        const login = method === 'POST' && url.pathname.startsWith('/kiwi-oidc/realms/') && url.pathname.endsWith('/login-actions/authenticate');
        if (!read && !login) return deny(route, request, url, 'Unexpected write; no request forwarded.');
        return route.fallback();
    });
    controls.release = () => {
        controls.settingsReleases.splice(0).forEach(resolve => resolve());
        controls.feedbackReleases.splice(0).forEach(resolve => resolve());
    };
    return controls;
}

function check(driver, meta, name, passed, detail) {
    driver.check(name, passed, true, { ...meta, detail }, 8);
}

async function waitForCount(values, count) {
    const deadline = Date.now() + 10000;
    while (values.length < count) {
        if (Date.now() > deadline) throw new Error('Declared local overlay request did not arrive.');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

async function enableVisibleFeedback(page, controls, native = false) {
    await page.locator('#contextualFeedbackSettingsButton').press('Enter');
    const form = page.locator('[data-feedback-settings-form]');
    await form.waitFor({ state: 'visible' });
    if (!await form.locator('[name=feedbackEnabled]').isChecked()) {
        if (native) { await form.locator('[name=feedbackEnabled]').focus(); await page.keyboard.press('Space'); }
        else await form.locator('[name=feedbackEnabled]').check();
    }
    if (!await form.locator('[name=feedbackEnabled]').isChecked()) throw new Error('Actual settings checkbox did not change.');
    if (!await form.locator('input[type=password]').evaluateAll(nodes => nodes.every(node => node.value === ''))) throw new Error('Safe synthetic settings inputs must remain empty.');
    await form.locator('button[type=submit]').press('Enter');
    await page.locator('#contextualFeedbackButton').waitFor({ state: 'visible' });
    await page.locator('[data-feedback-settings-close]').first().press('Enter');
    if (controls.settingsPuts !== 1) throw new Error('Exactly one declared local settings enable was required.');
}

async function openFeedback(page) {
    await page.locator('#contextualFeedbackButton').press('Enter');
    await page.locator(feedbackSelector).waitFor({ state: 'visible' });
}

async function closeFeedback(page, driver, meta) {
    await page.keyboard.press('Escape');
    await page.locator(feedbackSelector).waitFor({ state: 'hidden' });
    const restored = await page.locator('#contextualFeedbackButton').evaluate(node => !node.disabled && document.activeElement === node);
    check(driver, meta, 'feedback Escape restores its enabled actual invoker', restored);
}

async function closeSettings(page, driver, meta) {
    await page.keyboard.press('Escape');
    await page.locator(settingsSelector).waitFor({ state: 'hidden' });
    const restored = await page.locator('#contextualFeedbackSettingsButton').evaluate(node => !node.disabled && document.activeElement === node);
    check(driver, meta, 'settings Escape restores its enabled actual invoker', restored);
}

async function inspectDialog(page, driver, meta, name, selector, panelSelector) {
    const data = await observe(page, driver, meta, name, selector, panelSelector,
        meta.native ? 'Actual OS200percent overlay; uncropped native desktop, declared local transport only.' : meta.entryBoundary || 'Actual installed overlay and visible-control entry; declared local transport, not backend persistence.');
    const extra = await page.locator(selector).evaluate(root => {
        const rect = root.getBoundingClientRect(), visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
        return { modal: root.matches(':modal'), open: root.open, hidden: root.hidden,
            focused: root.contains(document.activeElement),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            fields: [...root.querySelectorAll('input:not([type=hidden]):not([type=password]),select,textarea')].filter(visible).map(node => ({
                tag: node.tagName, type: node.type, labels: node.labels?.length || 0,
                accessibleName: Boolean(node.labels?.length || node.getAttribute('aria-label') || node.getAttribute('aria-labelledby')),
                fontSize: getComputedStyle(node).fontSize, height: node.getBoundingClientRect().height })),
            backdrop: getComputedStyle(root, '::backdrop').backgroundColor,
            rootBounds: { x: rect.x, right: rect.right }, bodyReviewing: document.body.classList.contains('contextual-feedback-reviewing') };
    });
    check(driver, meta, name + ' is an actual native modal with contained focus and no page-width overflow', extra.modal && extra.open && !extra.hidden && extra.focused && !extra.overflow, extra);
    check(driver, meta, name + ' keeps the measured square title and standard labeled controls', data.panel.radius === '0px'
        && data.title.fontSize === driver.contract.subscriptionTitle.fontSize
        && extra.fields.every(field => field.accessibleName && (['checkbox', 'radio'].includes(field.type) || field.height >= 39)), { data, extra });
    driver.report.overlayAcceptance.states.push({ ...meta, name, data, extra });
    return { data, extra, filename: driver.report.captures.at(-1).filename };
}

export function nativeFocusBoundaryValid(state) {
    if (state.modal !== true || state.open !== true || state.hidden !== false) return false;
    if (state.inside === true) return true;
    const outsideDocumentFallback = state.inside === false && state.documentHasFocus === false && ['BODY', 'HTML'].includes(state.tag);
    return outsideDocumentFallback;
}

async function readNativeFocus(page, selector, key) {
    return page.locator(selector).evaluate((root, key) => {
        const active = document.activeElement;
        return { key, inside: root.contains(active), documentHasFocus: document.hasFocus(),
            modal: root.matches(':modal'), open: root.open, hidden: root.hidden,
            id: active.id, name: active.getAttribute('name'), tag: active.tagName };
    }, key);
}

async function inspectTabContainment(page, driver, meta, selector) {
    const count = await page.locator(selector).evaluate(root => [...root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
        .filter(node => node.getClientRects().length && !node.disabled && node.tabIndex >= 0).length);
    const sequence = [await readNativeFocus(page, selector, 'initial')];
    for (let index = 0; index < count + 2; index += 1) {
        await page.keyboard.press('Tab'); sequence.push(await readNativeFocus(page, selector, 'Tab'));
    }
    for (let index = 0; index < 3; index += 1) {
        await page.keyboard.press('Shift+Tab'); sequence.push(await readNativeFocus(page, selector, 'Shift+Tab'));
    }
    if (!sequence.at(-1).inside) {
        await page.keyboard.press('Tab'); sequence.push(await readNativeFocus(page, selector, 'Tab after outside-document fallback'));
    }
    const returns = sequence.flatMap((state, index) => state.inside ? [] : [{ index, nextInside: sequence[index + 1]?.inside === true }]);
    check(driver, meta, 'natural Tab and ShiftTab preserve the native application focus boundary', count > 0
        && sequence.every(nativeFocusBoundaryValid) && returns.every(item => item.nextInside), { selector, sequence, returns,
        boundary: 'Only unfocused-document BODY/HTML fallback is allowed while native modal remains open; no application background target is accepted. Exact browser-chrome control is not identified.' });
}

async function inspectFocusedActions(page, driver, meta, selector, actionSelector, name) {
    const action = page.locator(actionSelector);
    await action.focus();
    const geometry = await action.evaluate(node => {
        const b = node.getBoundingClientRect(), root = node.closest('dialog'), header = root.querySelector('header'), h = header.getBoundingClientRect();
        const panel = node.closest('.contextual-feedback-panel,.contextual-feedback-settings-panel').getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return { action: { x: b.x, y: b.y, right: b.right, bottom: b.bottom }, header: { y: h.y, bottom: h.bottom },
            focused: node === document.activeElement, focusVisible: node.matches(':focus-visible'),
            actionVisible: b.x >= 3 && b.right <= innerWidth - 3 && b.y >= 3 && b.bottom <= innerHeight - 3,
            headerVisible: h.y >= 0 && h.bottom <= innerHeight, panelContained: b.x >= panel.x + 3 && b.right <= panel.right - 3 && b.y >= panel.y + 3 && b.bottom <= panel.bottom - 3, hitAction: hit === node || node.contains(hit) };
    });
    check(driver, meta, name + ' keeps its focused action and outline reachable with header position recorded', geometry.focused && geometry.focusVisible
        && geometry.actionVisible && geometry.panelContained && geometry.hitAction, { setup: 'Explicit action focus after separate natural Tab containment proof; no activation or forced click.', geometry });
    await observe(page, driver, meta, name, selector, selector === feedbackSelector ? '.contextual-feedback-panel' : '.contextual-feedback-settings-panel');
}

async function setUnderlyingOutbox(page) {
    const toggle = page.locator('#subscriptionQueueToggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.press('Enter');
    await page.locator('#subscriptionQueuePanel').waitFor({ state: 'visible' });
}

async function matchUnderlyingScroll(page, driver, meta, target, state) {
    const entry = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
    await page.evaluate(({ x, y }) => window.scrollTo({ left: x, top: y, behavior: 'instant' }), target);
    await driver.painted(page);
    const actual = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
    driver.report.overlayAcceptance.interactions.push({ ...meta, state: 'matched-background-scroll-' + state, entry, target, actual,
        boundary: 'Declared renderer-comparison scroll fixture after actual control entry; no DOM styles, shadows, fields or permission state changed.' });
    if (Math.abs(actual.x - target.x) > 1 || Math.abs(actual.y - target.y) > 1) throw new Error('Underlying scroll fixture could not match; pixel comparison setup is invalid.');
}

export function panelPaintBounds(panel) {
    const bounds = { x: panel.x, y: panel.y, right: panel.right, bottom: panel.bottom, shadow: panel.shadow };
    if (!panel.shadow || panel.shadow === 'none') return bounds;
    const lengths = [...panel.shadow.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]));
    if (!lengths.length || lengths.length % 4) throw new Error('Unsupported actual shadow serialization; no safe sampling region inferred.');
    for (let offset = 0; offset < lengths.length; offset += 4) {
        const [x, y, blur, spread] = lengths.slice(offset, offset + 4);
        const halo = Math.max(0, spread) + 2 * Math.max(0, blur);
        bounds.x = Math.min(bounds.x, panel.x + x - halo); bounds.right = Math.max(bounds.right, panel.right + x + halo);
        bounds.y = Math.min(bounds.y, panel.y + y - halo); bounds.bottom = Math.max(bounds.bottom, panel.bottom + y + halo);
    }
    return bounds;
}

function pointOutside(point, bounds) { return point.x < bounds.x || point.x >= bounds.right || point.y < bounds.y || point.y >= bounds.bottom; }

async function pairedOrdinaryDialogs(page, driver, meta) {
    await setUnderlyingOutbox(page);
    await page.locator('[data-action=show-new-subscription]').first().press('Enter');
    await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
    await matchUnderlyingScroll(page, driver, meta, { x: 0, y: 0 }, 'new-subscription-reference');
    const reference = await observe(page, driver, meta, 'new-subscription-reference', '#newSubscriptionForm', '#newSubscriptionForm .card');
    const referenceFile = driver.report.captures.at(-1).filename;
    const sourceScroll = { x: reference.scrollX, y: reference.scrollY };
    await page.locator('#newSubscriptionForm [data-action=close-form]').first().press('Enter');
    await openFeedback(page);
    await matchUnderlyingScroll(page, driver, meta, sourceScroll, 'feedback');
    const feedback = await inspectDialog(page, driver, { ...meta, entryBoundary: 'Actual native feedback over declared matched-underlying scroll fixture; actual control/focus behavior is checked separately.' }, 'feedback-initial', feedbackSelector, '.contextual-feedback-panel');
    check(driver, meta, 'ordinary no-image feedback uses the actual Newsubscription veil without a review shield', feedback.data.root.background === reference.root.background && feedback.extra.backdrop === 'rgba(0, 0, 0, 0)'
        && feedback.data.root.backdropFilter === 'none' && feedback.data.background.filter === 'none'
        && feedback.data.background.opacity === '1' && !feedback.extra.bodyReviewing, { reference, feedback });
    await page.locator('textarea[name=comment]').fill(comment);
    await inspectTabContainment(page, driver, meta, feedbackSelector);
    await inspectFocusedActions(page, driver, meta, feedbackSelector, '[data-feedback-submit]', 'feedback-action-focus');
    await closeFeedback(page, driver, meta);
    await openFeedback(page);
    check(driver, meta, 'closed feedback retains its complete comment without an image shield', await page.locator('textarea[name=comment]').inputValue() === comment
        && !await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
    await closeFeedback(page, driver, meta);
    await page.locator('#contextualFeedbackSettingsButton').press('Enter');
    await page.locator('[data-feedback-settings-form]').waitFor({ state: 'visible' });
    await matchUnderlyingScroll(page, driver, meta, sourceScroll, 'settings');
    const settings = await inspectDialog(page, driver, { ...meta, entryBoundary: 'Actual native settings over declared matched-underlying scroll fixture; actual control/focus behavior is checked separately.' }, 'settings-initial', settingsSelector, '.contextual-feedback-settings-panel');
    check(driver, meta, 'ordinary settings uses the same sharp Newsubscription veil', settings.data.root.background === reference.root.background && settings.extra.backdrop === 'rgba(0, 0, 0, 0)'
        && settings.data.root.backdropFilter === 'none' && settings.data.background.filter === 'none' && settings.data.background.opacity === '1', { reference, settings });
    await inspectTabContainment(page, driver, meta, settingsSelector);
    await inspectFocusedActions(page, driver, meta, settingsSelector, '.contextual-feedback-settings-modal button[type=submit]', 'settings-action-focus');
    await closeSettings(page, driver, meta);
    if (!meta.native) await inspectOrdinaryVeilPixels(page, driver, meta, [
        { filename: referenceFile, panel: reference.panel, scroll: sourceScroll },
        { filename: feedback.filename, panel: feedback.data.panel, scroll: { x: feedback.data.scrollX, y: feedback.data.scrollY } },
        { filename: settings.filename, panel: settings.data.panel, scroll: { x: settings.data.scrollX, y: settings.data.scrollY } }
    ]);
}

export function classifyBackdropSampling(captures, edgePoints, roi = null) {
    const panels = captures.map(capture => capture.panel), paintBounds = panels.map(panelPaintBounds), scrolls = captures.map(capture => capture.scroll);
    const matchedScroll = scrolls.every(scroll => Math.abs(scroll.x - scrolls[0].x) <= 1 && Math.abs(scroll.y - scrolls[0].y) <= 1);
    const textSafe = Boolean(roi && paintBounds.every(bounds => roi.x + roi.width <= bounds.x || roi.x >= bounds.right
        || roi.y + roi.height <= bounds.y || roi.y >= bounds.bottom));
    const safeEdges = matchedScroll ? edgePoints.filter(point => paintBounds.every(bounds => pointOutside(point, bounds))) : [];
    const status = !matchedScroll ? 'invalid' : safeEdges.length ? 'available' : 'unavailable';
    return { status, matchedScroll, panels, paintBounds, scrolls, textSafe, safeEdges };
}

async function inspectOrdinaryVeilPixels(page, driver, meta, captures) {
    const filenames = captures.map(capture => capture.filename);
    const roi = meta.viewport.width === 1440 ? await page.locator('.search-card h2').evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node); const b = range.getBoundingClientRect();
        return { x: Math.floor(b.x) - 2, y: Math.floor(b.y) - 2, width: Math.ceil(b.width) + 4, height: Math.ceil(b.height) + 4 };
    }) : null;
    const edgePoints = [2, meta.viewport.width - 3].flatMap(x => [0.25, 0.75].map(fraction => ({ x, y: Math.floor(meta.viewport.height * fraction) })));
    const sampling = classifyBackdropSampling(captures, edgePoints, roi), { safeEdges, textSafe } = sampling;
    if (!sampling.matchedScroll) throw new Error('Different actual underlying scroll positions; pixel comparison is invalid setup.');
    if (roi && !textSafe) throw new Error('Declared desktop text ROI meets panel/shadow paint; choose a meaningful unoccluded fixed prefix before comparing.');
    const availability = { ...meta, ...sampling, filenames, requestedTextRoi: roi,
        reason: safeEdges.length ? 'Matched actual scroll and samples outside all panels/conservative shadow extents.' : 'No common sampled region outside all actual panels and conservative shadow extents; no pixel parity pass is emitted.',
        boundary: 'Shadow exclusion is conservative2xblur plus spread/offset; no shadow/style override. Per-state raw veil/filter checks and full-image review remain required.' };
    driver.report.overlayAcceptance.backgroundComparisons ||= [];
    driver.report.overlayAcceptance.backgroundComparisons.push(availability);
    if (!safeEdges.length && !textSafe) return;
    const images = await Promise.all(filenames.map(async filename => (await readFile(path.join(driver.evidenceDir, filename))).toString('base64')));
    const comparison = await page.evaluate(async ({ images, roi, safeEdges }) => {
        const regions = [], edges = [];
        for (const data of images) {
            const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            if (roi) regions.push(context.getImageData(roi.x, roi.y, roi.width, roi.height).data);
            edges.push(safeEdges.map(({ x, y }) => ({ x, y, rgba: [...context.getImageData(x, y, 1, 1).data] })));
        }
        const text = regions.slice(1).map(region => {
            let maxDifference = 0, changedPixels = 0;
            for (let offset = 0; offset < region.length; offset += 4) {
                const difference = Math.max(...[0, 1, 2, 3].map(channel => Math.abs(region[offset + channel] - regions[0][offset + channel])));
                maxDifference = Math.max(maxDifference, difference); if (difference > 8) changedPixels += 1;
            }
            return { maxDifference, changedPixels, pixels: region.length / 4 };
        });
        const edgeDifferences = edges.slice(1).map(samples => samples.map((sample, index) => ({ ...sample,
            maxDifference: Math.max(...sample.rgba.map((channel, component) => Math.abs(channel - edges[0][index].rgba[component]))) })));
        return { text, edges, edgeDifferences };
    }, { images, roi: textSafe ? roi : null, safeEdges });
    if (safeEdges.length) check(driver, meta, 'matched ordinary veils retain actual safe left/right pixel colors outside panel shadows',
        comparison.edgeDifferences.every(samples => samples.every(sample => sample.maxDifference <= 1)), { availability, edges: comparison.edges, differences: comparison.edgeDifferences,
        boundary: 'Exact prior1-value tolerance; unsafe/unavailable samples do not pass by omission. Full-frame review remains required.' });
    if (textSafe) check(driver, meta, 'same-underlying actual background text retains its sharp rendered pixels outside every panel shadow',
        comparison.text.every(result => result.changedPixels === 0), { availability, roi, pixels: comparison.text,
        boundary: 'Prior8-value paint tolerance unchanged; independent whole-image sharpness review remains necessary.' });
}

async function captureReviewedHeading(page, driver, meta) {
    const target = page.locator('#welcomeMessage h2');
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error('Actual safe welcome heading is required for production capture.');
    const description = await target.evaluate(async node => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type=importmap]')].map(script => JSON.parse(script.textContent).imports));
        const key = Object.keys(imports).find(value => value.endsWith('/contextual-feedback/selector.js'));
        const { describeElement } = await import(imports[key]);
        return describeElement(node);
    });
    await openFeedback(page);
    await page.locator('textarea[name=comment]').fill(comment);
    await page.locator('[data-feedback-add-screenshot]').press('Enter');
    await page.locator('.contextual-feedback-picker-overlay').waitFor({ state: 'visible' });
    const suspended = await page.locator(feedbackSelector).evaluate(node => ({ hidden: node.hidden, open: node.open,
        display: getComputedStyle(node).display, reviewing: document.body.classList.contains('contextual-feedback-reviewing'),
        ordinary: document.body.classList.contains('contextual-feedback-overlay-open') }));
    check(driver, meta, 'actual capture picker suspends native dialog and both ordinary/review layers', suspended.hidden && !suspended.open
        && suspended.display === 'none' && !suspended.reviewing && !suspended.ordinary, suspended);
    await observe(page, driver, meta, 'capture-suspended', '.contextual-feedback-picker-overlay');
    const selectedBox = await target.boundingBox();
    if (!selectedBox) throw new Error('Actual picker target must still be visible.');
    await page.mouse.click(selectedBox.x + selectedBox.width / 2, selectedBox.y + selectedBox.height / 2);
    await page.locator('.contextual-feedback-modal.has-screenshot canvas').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
        const modal = document.querySelector('.contextual-feedback-modal'), canvas = modal?.querySelector('[data-feedback-canvas]');
        return modal?.matches(':modal') && !modal.querySelector('[data-feedback-add-screenshot]').disabled && canvas?.width > 0 && canvas?.height > 0;
    });
    const review = await inspectDialog(page, driver, meta, 'image-review', feedbackSelector, '.contextual-feedback-panel');
    check(driver, meta, 'actual retained image review preserves every original strong privacy layer and its comment', review.extra.bodyReviewing
        && review.data.root.background === 'rgba(15, 23, 42, 0.86)' && review.data.root.backdropFilter === 'blur(14px)'
        && review.data.background.filter === 'blur(18px)' && review.data.background.opacity === '0.08'
        && await page.locator('textarea[name=comment]').inputValue() === comment, review);
    const image = await page.locator('[data-feedback-canvas]').evaluate(canvas => ({ width: canvas.width, height: canvas.height, pixels: canvas.toDataURL() }));
    return { description, box: selectedBox, image };
}

async function inspectImageLifecycle(page, driver, meta, keepForSubmission = false) {
    const { description, box: selectedBox, image } = await captureReviewedHeading(page, driver, meta);
    await closeFeedback(page, driver, meta);
    check(driver, meta, 'closed image review clears body privacy shield', !await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
    await openFeedback(page);
    check(driver, meta, 'actual image and comment survive close and reopen', await page.locator('[data-feedback-canvas]').evaluate((canvas, before) => canvas.toDataURL() === before, image.pixels)
        && await page.locator('textarea[name=comment]').inputValue() === comment
        && await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
    await page.locator('[data-feedback-add-screenshot]').press('Enter');
    await page.locator('.contextual-feedback-picker-overlay').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('.contextual-feedback-modal.has-screenshot').waitFor({ state: 'visible' });
    check(driver, meta, 'actual picker Escape restores retained image and its review shield',
        await page.locator('[data-feedback-canvas]').evaluate((canvas, before) => canvas.toDataURL() === before, image.pixels)
        && await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
    await inspectFocusedActions(page, driver, meta, feedbackSelector, '[data-feedback-submit]', 'image-review-action-focus');
    await observe(page, driver, meta, 'image-retained-after-picker-cancel', feedbackSelector, '.contextual-feedback-panel');
    if (keepForSubmission) return { description, box: selectedBox, dimensions: { width: image.width, height: image.height }, pixels: image.pixels };
    await page.locator('[data-feedback-remove-screenshot]').press('Enter');
    await page.locator('[data-feedback-workspace]').waitFor({ state: 'hidden' });
    const removed = await inspectDialog(page, driver, meta, 'image-removed', feedbackSelector, '.contextual-feedback-panel');
    check(driver, meta, 'removing actual image restores the ordinary sharp layer without losing comment', !removed.extra.bodyReviewing
        && removed.data.background.filter === 'none' && removed.data.background.opacity === '1'
        && await page.locator('textarea[name=comment]').inputValue() === comment, removed);
    await closeFeedback(page, driver, meta);
    return { description, box: selectedBox, dimensions: { width: image.width, height: image.height } };
}

const genericCustomer = { id: 990801, firstName: 'Synthetic', lastName: 'Overlay customer with a long display name',
    sourceSystem: 'theme-audit-local', deliveryRemarks: { default: '' },
    subscriptions: [{ id: 990811, magazine: 'Avrobode', status: 'active', duration: '1-jaar', startDate: '2025-01-01' }] };

async function prepareGenericCustomer(page) {
    await page.evaluate(customer => window.kiwiLegacyCustomerSearchBridge.setCurrentCustomer(structuredClone(customer)), genericCustomer);
}

async function inspectActualRegionHits(page, driver, meta, selector, name) {
    const result = await page.locator(selector).evaluate(node => {
        const b = node.getBoundingClientRect(), style = getComputedStyle(node);
        const insetX = Math.min(4, b.width / 4), insetY = Math.min(4, b.height / 4);
        const points = [[b.x + b.width / 2, b.y + b.height / 2], [b.x + insetX, b.y + insetY], [b.right - insetX, b.y + insetY],
            [b.right - insetX, b.bottom - insetY], [b.x + insetX, b.bottom - insetY], [b.right - insetX, b.y + b.height / 2],
            [b.x + insetX, b.y + b.height / 2], [b.x + b.width / 2, b.y + insetY], [b.x + b.width / 2, b.bottom - insetY]];
        const samples = points.map(([x, y]) => {
            const hit = document.elementFromPoint(x, y);
            return { x, y, owned: hit === node || node.contains(hit), hitTag: hit?.tagName, hitId: hit?.id,
                feedbackHit: Boolean(hit?.closest('#contextualFeedbackButton')) };
        });
        const feedback = document.getElementById('contextualFeedbackButton'), f = feedback?.getBoundingClientRect();
        const outset = node.matches(':focus-visible') ? parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset)) : 0;
        let paintIntersection = null;
        if (f && !feedback.hidden && f.width > 0 && f.height > 0) {
            const left = Math.max(b.x - outset, f.x), right = Math.min(b.right + outset, f.right);
            const top = Math.max(b.y - outset, f.y), bottom = Math.min(b.bottom + outset, f.bottom);
            if (right > left && bottom > top) {
                const x = (left + right) / 2, y = (top + bottom) / 2, hit = document.elementFromPoint(x, y);
                paintIntersection = { left, right, top, bottom, x, y, feedbackHit: Boolean(hit?.closest('#contextualFeedbackButton')) };
            }
        }
        return { target: { tag: node.tagName, id: node.id, width: b.width, height: b.height }, samples, paintIntersection,
            boundary: 'Real elementFromPoint samples on center/edges plus actual feedback overlap hit; full images still establish visual paint/outline agreement.' };
    });
    check(driver, meta, name + ' actual center, edges and focus paint are not obscured by the floating feedback entry',
        result.target.width > 0 && result.target.height > 0 && result.samples.every(point => point.owned)
        && !result.paintIntersection?.feedbackHit, result);
}

async function inspectInlineNotice(page, driver, meta, rootSelector, actionSelector, text) {
    const notice = page.locator(rootSelector + ' ' + inlineSelector);
    await notice.waitFor({ state: 'visible' });
    const result = await page.locator(rootSelector).evaluate((root, actionSelector) => {
        const error = root.querySelector('.overlay-notification.error'), action = root.querySelector(actionSelector);
        const e = error.getBoundingClientRect(), a = action.getBoundingClientRect(), hit = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
        return { text: error.textContent, role: error.getAttribute('role'), privateType: error.getAttribute('data-feedback-sensitive'), publicAncestor: Boolean(error.closest('[data-feedback-public]')),
            errorContained: e.x >= 0 && e.right <= innerWidth && e.y >= 0 && e.bottom <= innerHeight,
            actionContained: a.x >= 0 && a.right <= innerWidth && a.y >= 0 && a.bottom <= innerHeight,
            textFits: error.scrollWidth <= error.clientWidth + 1 && error.scrollHeight <= error.clientHeight + 1,
            overlap: Math.max(0, Math.min(e.right, a.right) - Math.max(e.x, a.x)) * Math.max(0, Math.min(e.bottom, a.bottom) - Math.max(e.y, a.y)),
            hitAction: hit === action || action.contains(hit), focused: document.activeElement.id || document.activeElement.getAttribute('data-action') };
    }, actionSelector);
    check(driver, meta, 'active task error is private, complete and in flow beside an unobscured actual action', result.text === text && result.role === 'alert'
        && result.privateType === 'opaque-text' && !result.publicAncestor && result.errorContained && result.actionContained && result.textFits
        && result.overlap === 0 && result.hitAction, result);
    await inspectActualRegionHits(page, driver, meta, rootSelector + ' ' + inlineSelector, 'active inline error');
    return result;
}

async function inspectGenericDialogs(page, driver, meta) {
    await prepareGenericCustomer(page);
    await page.evaluate(() => window.kiwiDeliveryRemarksSlice.editDeliveryRemarks());
    await page.locator('#editCustomerDeliveryRemarks').fill('Synthetic long delivery note08 remains editable and reachable in the actual generic modal.');
    await page.locator('#editCustomerDeliveryRemarks').focus();
    const delivery = await observe(page, driver, meta, 'delivery-note-focus', '#editDeliveryRemarksModal', '#editDeliveryRemarksModal .modal-content');
    checkGenericGeometry(driver, meta, 'delivery', delivery);
    await inspectActualRegionHits(page, driver, meta, '#editCustomerDeliveryRemarks', 'focused delivery note');
    const message = 'Synthetic error08 keeps this complete explanation and the current task action visible together.';
    const focus = await page.evaluate(() => document.activeElement.id);
    await page.evaluate(text => window.kiwiAppShellSlice.showToast(text, 'error', { recordContactHistory: false }), message);
    await inspectInlineNotice(page, driver, meta, '#editDeliveryRemarksModal', '[data-action="save-delivery-remarks"]', message);
    check(driver, meta, 'inline task error does not steal actual field focus', await page.evaluate(() => document.activeElement.id) === focus);
    await observe(page, driver, meta, 'notification-in-modal', '#editDeliveryRemarksModal', '#editDeliveryRemarksModal .modal-content');
    await page.evaluate(() => window.kiwiDeliveryRemarksSlice.closeEditRemarksModal());
    await page.evaluate(() => window.kiwiCallAgentRuntime.showDispositionModal());
    await page.locator('#dispNotes').fill('Synthetic disposition08 explanatory notes retained in the existing form.');
    await page.locator('#dispFollowUpRequired').focus();
    if (!await page.locator('#dispFollowUpRequired').isChecked()) await page.keyboard.press('Space');
    check(driver, meta, 'actual disposition checkbox responds to real Space', await page.locator('#dispFollowUpRequired').isChecked(), { setup: 'Explicit checkbox focus; no check-property assignment.' });
    await page.locator('#dispFollowUpNotes').fill('Synthetic follow-up08 notes with enough text to verify focus scrolling and the retained footer.');
    await page.locator('#dispFollowUpNotes').focus();
    const disposition = await observe(page, driver, meta, 'disposition-followup-focus', '#dispositionModal', '#dispositionModal .modal-content');
    checkGenericGeometry(driver, meta, 'disposition', disposition);
    await inspectActualRegionHits(page, driver, meta, '#dispFollowUpNotes', 'focused disposition note');
    await page.evaluate(() => window.kiwiCallAgentRuntime.cancelDisposition());
    await page.waitForFunction(() => !document.querySelector('.toast.show'));
    await page.evaluate(() => window.kiwiCallAgentRuntime.openDebugModal());
    await page.locator('#debugQueueSize').focus();
    const debug = await observe(page, driver, meta, 'debug-field-focus', '#debugModal', '#debugModal .modal-content');
    checkGenericGeometry(driver, meta, 'debug', debug);
    await inspectActualRegionHits(page, driver, meta, '#debugQueueSize', 'focused debug number field');
    await page.locator('#debugModal [data-action="debug.close-modal"]').press('Enter');
    await page.evaluate(text => window.kiwiAppShellSlice.showToast(text, 'error', { recordContactHistory: false }), message);
    await page.locator('.toast.show').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'notification-global', '#toast');
    if (!meta.native && meta.viewport.width === 1440) {
        const start = Date.now(); await page.waitForFunction(() => !document.querySelector('.toast.show'));
        const remainingMs = Date.now() - start;
        check(driver, meta, 'ordinary global toast retains its existing three-second lifetime', remainingMs > 2000 && remainingMs < 4000, { remainingMs, boundary: 'Measured after actual render/capture; source3000ms is independently protected.' });
    } else await page.waitForFunction(() => !document.querySelector('.toast.show'));
}

function checkGenericGeometry(driver, meta, name, data) {
    const visible = box => box && box.x >= 0 && box.right <= data.viewport.width + 1 && box.y >= 0 && box.bottom <= data.viewport.height + 1;
    check(driver, meta, name + ' uses the square measured white header and contained actual focus', data.panel.radius === '0px'
        && data.header.background === driver.contract.panel.backgroundColor && data.title.fontSize === driver.contract.subscriptionTitle.fontSize
        && data.documentWidth <= data.viewport.width + 1 && visible(data.active), data);
}

async function inspectNestedDialogs(page, driver, meta) {
    await prepareGenericCustomer(page);
    await page.evaluate(() => window.editSubscription(990811));
    await page.locator('#editSubDuration').selectOption('2-jaar');
    await openFeedback(page);
    const nested = await inspectDialog(page, driver, meta, 'nested-feedback', feedbackSelector, '.contextual-feedback-panel');
    if (meta.viewport.width === 1440 && !meta.native) {
        await page.locator('[data-feedback-add-screenshot]').press('Enter');
        await page.locator('.contextual-feedback-picker-overlay').waitFor({ state: 'visible' });
        const suspended = await page.evaluate(() => {
            const task = document.getElementById('editSubscriptionForm'), modal = document.querySelector('.contextual-feedback-modal');
            return { taskVisible: task.getClientRects().length > 0, taskVeil: getComputedStyle(task).backgroundColor,
                duration: document.getElementById('editSubDuration').value, modalHidden: modal.hidden, nativeClosed: !modal.open,
                ordinary: document.body.classList.contains('contextual-feedback-overlay-open'), reviewing: document.body.classList.contains('contextual-feedback-reviewing') };
        });
        check(driver, meta, 'actual nested picker suspension restores the real task veil and retains its draft', suspended.taskVisible
            && suspended.taskVeil === 'rgba(15, 23, 42, 0.5)' && suspended.duration === '2-jaar'
            && suspended.modalHidden && suspended.nativeClosed && !suspended.ordinary && !suspended.reviewing, suspended);
        await observe(page, driver, meta, 'nested-capture-suspended', '.contextual-feedback-picker-overlay');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => { const modal = document.querySelector('.contextual-feedback-modal');
            return modal?.matches(':modal') && !modal.querySelector('[data-feedback-add-screenshot]').disabled; });
        const resumed = await page.evaluate(() => ({ taskVisible: document.getElementById('editSubscriptionForm').getClientRects().length > 0,
            taskVeil: getComputedStyle(document.getElementById('editSubscriptionForm')).backgroundColor,
            duration: document.getElementById('editSubDuration').value, ordinary: document.body.classList.contains('contextual-feedback-overlay-open'),
            reviewing: document.body.classList.contains('contextual-feedback-reviewing') }));
        check(driver, meta, 'actual nested picker Escape restores the ordinary top dialog and unchanged underlying draft', resumed.taskVisible
            && resumed.taskVeil === 'rgba(0, 0, 0, 0)' && resumed.duration === '2-jaar' && resumed.ordinary && !resumed.reviewing, resumed);
        await observe(page, driver, meta, 'nested-capture-cancel-resumed', feedbackSelector, '.contextual-feedback-panel');
    }
    const task = nested.data.activeOverlayLayers.find(layer => layer.id === 'editSubscriptionForm');
    check(driver, meta, 'nested feedback has one ordinary veil while the real underlying task stays visible', task && task.background === 'rgba(0, 0, 0, 0)'
        && nested.data.root.background === 'rgba(15, 23, 42, 0.5)' && nested.extra.backdrop === 'rgba(0, 0, 0, 0)', nested);
    await closeFeedback(page, driver, meta);
    check(driver, meta, 'topmost feedback Escape preserves the underlying task and changed duration', await page.locator('#editSubscriptionForm').isVisible()
        && await page.locator('#editSubDuration').inputValue() === '2-jaar');
    const restoredVeil = await page.locator('#editSubscriptionForm').evaluate(node => getComputedStyle(node).backgroundColor);
    check(driver, meta, 'closing feedback restores the underlying ordinary task veil', restoredVeil === 'rgba(15, 23, 42, 0.5)', { restoredVeil });
    await observe(page, driver, meta, 'nested-feedback-escape-result', '#editSubscriptionForm', '#editSubscriptionForm .card');
    const actualInvoker = await page.evaluateHandle(() => document.activeElement);
    const invokerMetadata = await actualInvoker.evaluate(node => ({ id: node.id, tag: node.tagName, disabled: Boolean(node.disabled) }));
    await page.locator('#contextualFeedbackSettingsButton').evaluate(node => node.click());
    await page.locator('[data-feedback-settings-form]').waitFor({ state: 'visible' });
    await inspectDialog(page, driver, { ...meta, entryBoundary: 'Actual installed settings-handler fixture over a custom task; no pointer-entry or newly public capability claim.' }, 'nested-settings', settingsSelector, '.contextual-feedback-settings-panel');
    driver.report.overlayAcceptance.interactions.push({ ...meta, state: 'nested-settings-entry',
        invoker: invokerMetadata, boundary: 'Actual installed settings-handler invocation over a custom task; actual focused invoker recorded. No pointer-entry or newly public entry-capability claim.' });
    try {
        await page.keyboard.press('Escape');
        await page.locator(settingsSelector).waitFor({ state: 'hidden' });
        check(driver, meta, 'nested settings restores its actual source-captured invoker',
            await actualInvoker.evaluate(node => node.isConnected && !node.disabled && document.activeElement === node), invokerMetadata);
    } finally { await actualInvoker.dispose(); }
    check(driver, meta, 'topmost settings Escape preserves underlying task and draft', await page.locator('#editSubscriptionForm').isVisible()
        && await page.locator('#editSubDuration').inputValue() === '2-jaar');
    await page.locator('#editSubscriptionForm [data-action=close-form]').first().press('Enter');
}

async function inspectSettingsRecovery(page, driver, meta, controls, held) {
    controls.settingsMode = held ? 'held' : 'error';
    const count = controls.settingsReads.length;
    await page.locator('#contextualFeedbackSettingsButton').click();
    await waitForCount(controls.settingsReads, count + 1);
    await page.locator(settingsSelector).waitFor({ state: 'visible' });
    if (held) {
        const pending = await page.locator(settingsSelector).evaluate(root => ({ modal: root.matches(':modal'),
            status: root.querySelector('[data-feedback-settings-load-status]')?.textContent.trim(),
            openerDisabled: document.querySelector('#contextualFeedbackSettingsButton').disabled }));
        check(driver, meta, 'actual held settings GET has a native loading view and disabled source opener', pending.modal && pending.status && pending.openerDisabled, pending);
        await observe(page, driver, meta, 'settings-get-held', settingsSelector, '.contextual-feedback-settings-panel');
        controls.settingsMode = 'error'; controls.settingsReleases.splice(0).forEach(resolve => resolve());
    }
    await page.locator('[data-feedback-settings-load-error]').waitFor({ state: 'visible' });
    const error = await page.locator('[data-feedback-settings-load-error]').textContent();
    check(driver, meta, 'actual failed settings GET displays its complete localized fallback without a write', error === 'De feedbackinstellingen konden niet worden geladen.' && controls.settingsPuts === 0, { error });
    await observe(page, driver, meta, 'settings-get-rejected', settingsSelector, '.contextual-feedback-settings-panel');
    controls.settingsMode = 'ready';
    await page.locator('[data-feedback-settings-retry]').press('Enter');
    await waitForCount(controls.settingsReads, count + 2);
    await page.locator('[data-feedback-settings-form]').waitFor({ state: 'visible' });
    check(driver, meta, 'actual settings retry repeats only the source GET and recovers safe fields', controls.settingsReads.length === count + 2
        && controls.settingsPuts === 0 && await page.locator('[data-feedback-settings-form] input[type=password]').evaluateAll(nodes => nodes.every(node => node.value === '')));
    await page.locator(settingsSelector + ' button[type=submit]').press('Shift+Tab');
    await page.keyboard.press('Tab');
    check(driver, meta, 'natural ShiftTab and Tab return to recovered settings Save with a keyboard outline',
        await page.locator(settingsSelector + ' button[type=submit]').evaluate(node => node === document.activeElement && node.matches(':focus-visible')),
        { setup: 'Explicit Save setup followed by a genuine keyboard roundtrip after source GET recovery; no activation or full-form Tab-order claim.' });
    await inspectFocusedActions(page, driver, meta, settingsSelector, settingsSelector + ' button[type=submit]', 'settings-get-recovered-actions');
    await closeSettings(page, driver, meta);
}

async function expectedFeedbackPayload(page, captured = null) {
    const environment = await page.evaluate(() => ({ pageUrl: location.href, routePath: location.pathname + location.search,
        userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, devicePixelRatio } }));
    const payload = { comment, severity: 'normal', category: 'bug', selectionKind: captured ? 'element' : 'none', ...environment, annotations: [] };
    if (!captured) return payload;
    const round = value => Math.round(value * 100) / 100;
    return { ...payload, teamsScreenshotVariant: 'pseudonymized', selectedElement: {
        tag: captured.description.tag, label: captured.description.label, selector: captured.description.selector, textSample: null,
        rect: { x: round(captured.box.x), y: round(captured.box.y), width: round(captured.box.width), height: round(captured.box.height) } } };
}

async function inspectFeedbackRecovery(page, driver, meta, controls, withImage) {
    const rejectionMessage = 'Feedback kon niet worden verstuurd.';
    let captured;
    if (withImage) captured = await inspectImageLifecycle(page, driver, meta, true);
    else { await openFeedback(page); await page.locator('textarea[name=comment]').fill(comment); }
    controls.feedback = { payload: await expectedFeedbackPayload(page, captured), images: withImage, dimensions: captured?.dimensions,
        held: withImage, outcome: 'reject', limit: withImage ? 2 : 1 };
    await page.locator('[data-feedback-submit]').press('Enter');
    await waitForCount(controls.feedbackRequests, 1);
    if (withImage) {
        const pending = await page.locator(feedbackSelector).evaluate(root => ({ busy: root.getAttribute('aria-busy'),
            controlsDisabled: [...root.querySelectorAll('input,select,textarea,button')].every(node => node.disabled),
            status: root.querySelector('[data-feedback-status]')?.textContent.trim() }));
        check(driver, meta, 'actual held feedback multipart request has truthful busy status and disabled controls', pending.busy === 'true' && pending.controlsDisabled && Boolean(pending.status), pending);
        await page.keyboard.press('Escape');
        check(driver, meta, 'pending feedback native Escape retains the visible image-bearing owner', await page.locator(feedbackSelector).isVisible()
            && await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
        const button = page.locator('[data-feedback-submit]'), b = await button.boundingBox();
        const hit = await button.evaluate(node => { const r = node.getBoundingClientRect(), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return target === node || node.contains(target); });
        check(driver, meta, 'actual disabled pending feedback control remains an unobscured pointer target', hit);
        if (!hit || !b) throw new Error('Pending control is obscured; no forced click permitted.');
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        check(driver, meta, 'physical disabled feedback click sends no duplicate multipart request', controls.feedbackRequests.length === 1);
        await observe(page, driver, meta, 'feedback-submit-held', feedbackSelector, '.contextual-feedback-panel');
        controls.feedbackReleases.splice(0).forEach(resolve => resolve());
    }
    await page.locator('[data-feedback-error]').filter({ hasText: rejectionMessage }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('[data-feedback-submit]').disabled);
    check(driver, meta, 'actual rejected feedback retains its complete comment and restores retry controls', await page.locator('textarea[name=comment]').inputValue() === comment
        && await page.locator('[data-feedback-error]').textContent() === rejectionMessage);
    const errorLayout = await page.locator(feedbackSelector).evaluate(root => {
        const error = root.querySelector('[data-feedback-error]'), action = root.querySelector('[data-feedback-submit]');
        const e = error.getBoundingClientRect(), a = action.getBoundingClientRect(), p = root.querySelector('.contextual-feedback-panel').getBoundingClientRect();
        return { errorContained: e.x >= p.x && e.right <= p.right && e.y >= p.y && e.bottom <= p.bottom,
            actionContained: a.x >= p.x && a.right <= p.right && a.y >= p.y && a.bottom <= p.bottom,
            textFits: error.scrollWidth <= error.clientWidth + 1 && error.scrollHeight <= error.clientHeight + 1,
            overlap: Math.max(0, Math.min(e.right, a.right) - Math.max(e.x, a.x)) * Math.max(0, Math.min(e.bottom, a.bottom) - Math.max(e.y, a.y)) };
    });
    check(driver, meta, 'actual feedback failure immediately exposes its complete error and current action without overlap',
        errorLayout.errorContained && errorLayout.actionContained && errorLayout.textFits && errorLayout.overlap === 0, errorLayout);
    await observe(page, driver, meta, 'feedback-rejected-error-layout', feedbackSelector, '.contextual-feedback-panel');
    if (withImage) check(driver, meta, 'actual feedback rejection retains the same reviewed image',
        await page.locator('[data-feedback-canvas]').evaluate((canvas, before) => canvas.toDataURL() === before, captured.pixels));
    await page.locator('[data-feedback-submit]').press('Shift+Tab');
    await page.keyboard.press('Tab');
    check(driver, meta, 'natural ShiftTab and Tab return to the rejected feedback action with a keyboard outline',
        await page.locator('[data-feedback-submit]').evaluate(node => node === document.activeElement && node.matches(':focus-visible')),
        { setup: 'Explicit submit setup followed by a genuine keyboard roundtrip after the physical pending-pointer case; no activation or full-form Tab-order claim.' });
    await inspectFocusedActions(page, driver, meta, feedbackSelector, '[data-feedback-submit]', 'feedback-submit-rejected-actions');
    if (!withImage) { await closeFeedback(page, driver, meta); return; }
    controls.feedback = { ...controls.feedback, held: false, outcome: 'success' };
    const retry = page.locator('[data-feedback-submit]');
    check(driver, meta, 'explicit feedback retry starts while its full error remains visible', await page.locator('[data-feedback-error]').isVisible());
    await retry.click();
    await waitForCount(controls.feedbackRequests, 2);
    await page.locator(feedbackSelector).waitFor({ state: 'hidden' });
    check(driver, meta, 'actual explicit feedback retry preserves semantic payload and both retained PNG hashes',
        isDeepStrictEqual(controls.feedbackRequests[0], controls.feedbackRequests[1]), { first: controls.feedbackRequests[0], second: controls.feedbackRequests[1] });
    check(driver, meta, 'local success callback restores real feedback opener and clears shield', await page.locator('#contextualFeedbackButton').evaluate(node => !node.disabled && document.activeElement === node)
        && !await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
    await page.locator('#contextualFeedbackButton').click();
    await page.locator(feedbackSelector).waitFor({ state: 'visible' });
    check(driver, meta, 'successful local feedback callback starts a fresh empty draft', await page.locator('textarea[name=comment]').inputValue() === ''
        && !await page.locator(feedbackSelector).evaluate(node => node.classList.contains('has-screenshot')));
    await page.mouse.click(2, 2);
    await page.locator(feedbackSelector).waitFor({ state: 'hidden' });
    check(driver, meta, 'actual backdrop pointer dismissal restores its enabled feedback invoker', await page.locator('#contextualFeedbackButton').evaluate(node => !node.disabled && document.activeElement === node));
}

async function inspectPrivateErrorCapture(page, driver, meta, controls) {
    await prepareGenericCustomer(page);
    await page.evaluate(() => window.showEditorialComplaintForm());
    await page.locator('#editorialComplaintMagazine').selectOption(expectedComplaint.magazine);
    await page.locator('#editorialComplaintDescription').fill(expectedComplaint.description);
    await page.locator('#editorialComplaintEdition').fill(expectedComplaint.edition);
    await page.locator('#editorialComplaintFollowup').check();
    await page.locator('[data-action=submit-editorial-complaint]').press('Enter');
    await page.locator('#editorialComplaintForm .overlay-notification.error').filter({ hasText: privateError }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('#editorialComplaintForm [data-service-commit]')].every(node => !node.disabled));
    check(driver, meta, 'private inline error originates in the one exact actual controller local422', controls.privateErrors === 1);
    await inspectInlineNotice(page, driver, meta, '#editorialComplaintForm', '[data-service-commit]', privateError);
    await observe(page, driver, meta, 'private-inline-error-live', '#editorialComplaintForm', '#editorialComplaintForm .card');
    const result = await page.evaluate(async ({ person, email }) => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type=importmap]')].map(script => JSON.parse(script.textContent).imports));
        const key = Object.keys(imports).find(value => value.endsWith('/contextual-feedback/screenshot.js'));
        const { captureElementScreenshot } = await import(imports[key]);
        const selectorKey = Object.keys(imports).find(value => value.endsWith('/contextual-feedback/selector.js'));
        const redactionKey = Object.keys(imports).find(value => value.endsWith('/contextual-feedback/screenshot-redaction.js'));
        const { describeElement } = await import(imports[selectorKey]);
        const { pseudonymizeSelectedElement } = await import(imports[redactionKey]);
        const root = document.querySelector('#editorialComplaintForm .card'), error = root.querySelector('.overlay-notification.error');
        const snapshot = () => ({ html: root.outerHTML, fields: [...root.querySelectorAll('input,select,textarea')].map(node => ({
            id: node.id, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex, disabled: node.disabled, readonly: Boolean(node.readOnly) })) });
        const before = snapshot(), bounds = root.getBoundingClientRect(), e = error.getBoundingClientRect();
        const marker = error.getAttribute('data-feedback-sensitive'), publicAncestor = Boolean(error.closest('[data-feedback-public]'));
        const descriptor = describeElement(error), pseudoDescriptor = pseudonymizeSelectedElement(descriptor);
        const pseudoJson = JSON.stringify(pseudoDescriptor), serializedDescriptor = JSON.parse(pseudoJson);
        const metadata = { rawSensitivityType: descriptor.sensitivityType,
            rawPersonPresent: descriptor.label.includes(person), rawEmailPresent: descriptor.label.includes(email), rawTextSampleNull: descriptor.textSample === null,
            pseudoPersonPresent: pseudoJson.includes(person), pseudoEmailPresent: pseudoJson.includes(email),
            pseudoTextSampleNull: serializedDescriptor.textSample === null, pseudoTypeOmitted: !Object.hasOwn(serializedDescriptor, 'sensitivityType'),
            selectorPreserved: serializedDescriptor.selector === descriptor.selector };
        const sdk = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default;
        const originalToBlob = sdk.toBlob, cloneObservations = [];
        sdk.toBlob = (node, options) => originalToBlob.call(sdk, node, { ...options, onclone(clone) {
            const returned = options.onclone(clone), clonedError = clone.querySelector('.overlay-notification.error');
            cloneObservations.push({ personPresent: clonedError?.textContent.includes(person), emailPresent: clonedError?.textContent.includes(email),
                sensitivityType: clonedError?.getAttribute('data-feedback-sensitive'), publicAncestor: Boolean(clonedError?.closest('[data-feedback-public]')),
                liveFieldsUnchanged: JSON.stringify(snapshot().fields) === JSON.stringify(before.fields) });
            return returned;
        } });
        let capture;
        try { capture = await captureElementScreenshot({ element: root }); }
        finally { sdk.toBlob = originalToBlob; }
        const pixels = async variant => {
            const image = await createImageBitmap(variant.blob), canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); image.close();
            const png = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(variant.blob); });
            return { width: canvas.width, height: canvas.height, context, png };
        };
        const original = await pixels(capture.original), pseudo = await pixels(capture.pseudonymized), scale = pseudo.width / bounds.width;
        const x = Math.max(0, Math.round((e.x - bounds.x + 3) * scale)), y = Math.max(0, Math.round((e.y - bounds.y + 3) * scale));
        const width = Math.min(pseudo.width - x, Math.max(1, Math.floor((e.width - 6) * scale)));
        const height = Math.min(pseudo.height - y, Math.max(1, Math.floor((e.height - 6) * scale)));
        let changedPixels = 0, originalNonuniform = false;
        if (width > 0 && height > 0) {
            const a = original.context.getImageData(x, y, width, height).data, b = pseudo.context.getImageData(x, y, width, height).data;
            for (let offset = 0; offset < a.length; offset += 4) {
                if ([0, 1, 2, 3].some(channel => a[offset + channel] !== a[channel])) originalNonuniform = true;
                if (Math.max(...[0, 1, 2, 3].map(channel => Math.abs(a[offset + channel] - b[offset + channel]))) > 64) changedPixels += 1;
            }
        }
        return { privacy: capture.privacySummary, marker, publicAncestor, metadata, cloneObservations,
            observerRestored: sdk.toBlob === originalToBlob, exactRawLiveRestored: JSON.stringify(snapshot()) === JSON.stringify(before),
            dimensions: { original: [original.width, original.height], pseudonymized: [pseudo.width, pseudo.height] },
            privatePixels: { x, y, width, height, originalNonuniform, changedPixels, channelTolerance: 64 },
            originalPng: original.png, pseudonymizedPng: pseudo.png };
    }, { person: privatePerson, email: privateEmail });
    const originalFilename = 'overlay08-private-inline-error-original.png', pseudoFilename = 'overlay08-private-inline-error-pseudonymized.png';
    await writeFile(path.join(driver.evidenceDir, originalFilename), Buffer.from(result.originalPng.split(',')[1], 'base64'));
    await writeFile(path.join(driver.evidenceDir, pseudoFilename), Buffer.from(result.pseudonymizedPng.split(',')[1], 'base64'));
    delete result.originalPng; delete result.pseudonymizedPng;
    const phases = result.cloneObservations;
    check(driver, meta, 'actual production PNG capture masks unique private inline-error tokens and changes their painted pixels', result.marker === 'opaque-text' && !result.publicAncestor
        && result.privacy.verified && phases.length === 2 && phases[0].personPresent && phases[0].emailPresent
        && !phases[1].personPresent && !phases[1].emailPresent && phases.every(phase => phase.sensitivityType === 'opaque-text' && !phase.publicAncestor && phase.liveFieldsUnchanged)
        && result.privatePixels.originalNonuniform && result.privatePixels.changedPixels > 0
        && isDeepStrictEqual(result.dimensions.original, result.dimensions.pseudonymized), result);
    const metadata = result.metadata;
    check(driver, meta, 'actual direct opaque-error metadata removes the same private tokens and serialized sensitivity type', metadata.rawSensitivityType === 'opaque-text'
        && metadata.rawPersonPresent && metadata.rawEmailPresent && metadata.rawTextSampleNull
        && !metadata.pseudoPersonPresent && !metadata.pseudoEmailPresent && metadata.pseudoTextSampleNull && metadata.pseudoTypeOmitted && metadata.selectorPreserved, metadata);
    check(driver, meta, 'production private-error capture restores exact raw live draft and the delegating SDK observer', result.exactRawLiveRestored && result.observerRestored, result);
    driver.report.overlayAcceptance.privacy.push({ ...meta, result, originalFilename, pseudoFilename,
        boundary: 'Original/pseudonymized PNGs are actual production capture API outputs. Metadata is the actual direct production describeElement/pseudonymizeSelectedElement JSON result, not a submitted network flow. Internal clone observations are diagnostic, not serialized/exported screenshot claims; SDK callback/result bytes are never replaced.' });
    await page.locator('#editorialComplaintForm [data-action=close-form]').first().press('Enter');
}

async function inspectRetainedCaptureCallbackError(page, driver, meta) {
    const boundary = 'Production dialog-controller component fixture with an actual SDK-produced retained image and a controlled second capture callback rejection; not a full feature picker, SDK or network failure.';
    const failure = 'Synthetic screenshot callback08 failed. The reviewed image and complete comment are retained; correct the issue and retry.';
    await page.locator('#welcomeMessage h2').scrollIntoViewIfNeeded();
    const fixture = await page.evaluateHandle(async failure => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type=importmap]')].map(script => JSON.parse(script.textContent).imports));
        const moduleUrl = name => imports[Object.keys(imports).find(key => key.endsWith('/contextual-feedback/' + name + '.js'))];
        const { openFeedbackDialog } = await import(moduleUrl('dialog'));
        const { captureElementScreenshot } = await import(moduleUrl('screenshot'));
        const { describeElement } = await import(moduleUrl('selector'));
        const target = document.querySelector('#welcomeMessage h2'), rect = target.getBoundingClientRect();
        const captured = await captureElementScreenshot({ element: target, selectedElement: describeElement(target) });
        const screenshot = { selectionKind: 'element', selectedRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            selectedElement: captured.selectedElement, privacySummary: captured.privacySummary,
            screenshots: { pseudonymized: captured.pseudonymized, original: captured.original } };
        const state = { captureCalls: 0, submitCalls: 0 };
        await openFeedbackDialog({
            opener: document.activeElement,
            async onRequestScreenshot() {
                state.captureCalls += 1;
                if (state.captureCalls === 1) return screenshot;
                throw new Error(failure);
            },
            async onSubmit() { state.submitCalls += 1; throw new Error('Unexpected component fixture submission.'); }
        });
        return state;
    }, failure);
    try {
        await page.locator('textarea[name=comment]').fill(comment);
        await page.locator('[data-feedback-add-screenshot]').press('Enter');
        await page.waitForFunction(() => {
            const modal = document.querySelector('.contextual-feedback-modal'), canvas = modal?.querySelector('[data-feedback-canvas]');
            return modal?.matches(':modal') && modal.classList.contains('has-screenshot')
                && !modal.querySelector('[data-feedback-add-screenshot]').disabled && canvas?.width > 0 && canvas?.height > 0;
        });
        const before = await page.locator('[data-feedback-canvas]').evaluate(canvas => ({ data: canvas.toDataURL(), width: canvas.width, height: canvas.height }));
        await page.locator('[data-feedback-add-screenshot]').press('Enter');
        await page.locator('[data-feedback-error]').filter({ hasText: failure }).waitFor({ state: 'visible' });
        await page.waitForFunction(() => !document.querySelector('[data-feedback-add-screenshot]').disabled);
        await driver.painted(page);
        const geometry = await page.locator(feedbackSelector).evaluate(root => {
            const replace = root.querySelector('[data-feedback-add-screenshot]'), error = root.querySelector('[data-feedback-error]');
            const panel = root.querySelector('.contextual-feedback-panel').getBoundingClientRect();
            const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
            const inside = (r, inset = 0) => r.x >= Math.max(0, panel.x) + inset && r.right <= Math.min(innerWidth, panel.right) - inset
                && r.y >= Math.max(0, panel.y) + inset && r.bottom <= Math.min(innerHeight, panel.bottom) - inset;
            const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
            const r = box(replace), e = box(error), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            const actions = [...root.querySelectorAll('.contextual-feedback-actions button')].filter(node => node.getClientRects().length)
                .map(node => {
                    const r = box(node), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                    return { text: node.textContent.trim(), box: r, contained: inside(r), disabled: node.disabled, hit: hit === node || node.contains(hit) };
                });
            const background = [...document.body.children].find(node => node !== root && !node.matches('[data-feedback-ignore],script'));
            return { panel: { x: panel.x, y: panel.y, right: panel.right, bottom: panel.bottom }, replace: r, error: e, actions,
                replaceFocused: document.activeElement === replace, focusVisible: replace.matches(':focus-visible'), replaceOutlineContained: inside(r, 3),
                replaceHit: hit === replace || replace.contains(hit), errorContained: inside(e), errorText: error.textContent,
                errorTextFits: error.scrollWidth <= error.clientWidth + 1 && error.scrollHeight <= error.clientHeight + 1,
                privateType: error.getAttribute('data-feedback-sensitive'), publicAncestor: Boolean(error.closest('[data-feedback-public]')),
                errorActionOverlap: actions.some(action => overlap(e, action.box) > 0), nativeModal: root.matches(':modal'),
                reviewing: document.body.classList.contains('contextual-feedback-reviewing'), veil: getComputedStyle(root).backgroundColor,
                backdropFilter: getComputedStyle(root).backdropFilter, backgroundFilter: getComputedStyle(background).filter,
                backgroundOpacity: getComputedStyle(background).opacity };
        });
        const callbacks = await fixture.evaluate(state => ({ captureCalls: state.captureCalls, submitCalls: state.submitCalls }));
        const retained = await page.locator('[data-feedback-canvas]').evaluate((canvas, before) => canvas.toDataURL() === before.data && canvas.width === before.width && canvas.height === before.height, before)
            && await page.locator('textarea[name=comment]').inputValue() === comment;
        check(driver, meta, 'component capture callback rejection retains the real reviewed image and complete draft without submission',
            callbacks.captureCalls === 2 && callbacks.submitCalls === 0 && retained && geometry.nativeModal && geometry.reviewing
            && geometry.veil === 'rgba(15, 23, 42, 0.86)' && geometry.backdropFilter === 'blur(14px)'
            && geometry.backgroundFilter === 'blur(18px)' && geometry.backgroundOpacity === '0.08', { callbacks, retained, geometry, boundary });
        check(driver, meta, 'component capture error and its naturally retained Replace focus outline are complete and unobscured together',
            geometry.replaceFocused && geometry.focusVisible && geometry.replaceOutlineContained && geometry.replaceHit
            && geometry.errorContained && geometry.errorTextFits && geometry.errorText === failure && !geometry.errorActionOverlap
            && geometry.privateType === 'opaque-text' && !geometry.publicAncestor, { geometry, boundary });
        driver.report.overlayAcceptance.interactions.push({ ...meta, state: 'retained-capture-callback-error-component', callbacks, retained, geometry, boundary });
        await observe(page, driver, { ...meta, entryBoundary: boundary }, 'retained-capture-callback-error', feedbackSelector, '.contextual-feedback-panel', boundary);
        await page.keyboard.press('Escape');
        await page.locator(feedbackSelector).waitFor({ state: 'hidden' });
    } finally { await fixture.dispose(); }
}

async function inspectRoleAndLanguage(page, driver, meta, controls) {
    if (meta.role === 'kiwi-view') {
        await page.locator('#agentProfileTrigger').press('Enter');
        const result = await page.evaluate(() => ({ roles: [...document.querySelectorAll('.profile-menu-role')].map(node => node.textContent.trim()),
            settings: document.querySelectorAll('#contextualFeedbackSettingsButton').length,
            logoutPost: document.querySelector('#agentStatusMenu form')?.method.toLowerCase() === 'post',
            csrfPresent: Boolean(document.querySelector('#agentStatusMenu input[type=hidden][name]')) }));
        check(driver, meta, 'actual restricted role preserves server settings omission, role and POST logout semantics', result.settings === 0
            && result.roles.includes('KIWI view') && result.logoutPost && result.csrfPresent, result);
        await observe(page, driver, meta, 'actual-view-profile', 'body', '#agentStatusMenu', 'Actual fallback view-role server render; no permission simulation or logout POST.');
        await page.keyboard.press('Escape');
        return;
    }
    await page.locator('#agentProfileTrigger').press('Enter');
    await page.locator('[data-locale-option=en]').press('Enter');
    await page.reload();
    await page.waitForFunction(() => window.kiwiCustomerDetailSlice && window.kiwiCustomerWorkSession);
    await page.waitForFunction(() => typeof window.kiwiAddressCompletion?.getSubmission === 'function'
        && typeof window.kiwiAddressCompletion?.validate === 'function');
    check(driver, meta, 'actual English fresh document retains supported locale', await page.locator('html').getAttribute('lang') === 'en');
    await enableVisibleFeedback(page, controls);
    await pairedOrdinaryDialogs(page, driver, { ...meta, locale: 'en' });
    await inspectGenericDialogs(page, driver, { ...meta, locale: 'en' });
}

async function inspectBoundary(page, driver, meta) {
    if (Number(process.env.KIWI_THEME_AUDIT_OVERLAY_BREAKPOINT) === 1560) return inspectWideArticleTriggerRail(page, driver, meta);
    await openFeedback(page);
    const actionLayout = await page.locator(feedbackSelector).locator('.contextual-feedback-actions').evaluate(node => ({ direction: getComputedStyle(node).flexDirection,
        groups: [...node.children].filter(child => child.tagName === 'DIV').map(child => ({ display: getComputedStyle(child).display, columns: getComputedStyle(child).gridTemplateColumns })) }));
    if (Number(process.env.KIWI_THEME_AUDIT_OVERLAY_BREAKPOINT) === 600) {
        check(driver, meta, 'actual feedback actions follow the reviewed600 single-column boundary',
            meta.viewport.width <= 600 ? actionLayout.direction === 'column' && actionLayout.groups.every(group => group.display === 'grid' && group.columns.split(' ').length === 1) : actionLayout.direction === 'row', actionLayout);
    }
    await inspectDialog(page, driver, meta, 'actual-breakpoint-feedback', feedbackSelector, '.contextual-feedback-panel');
    await inspectFocusedActions(page, driver, meta, feedbackSelector, '[data-feedback-submit]', 'actual-breakpoint-feedback-actions');
    await closeFeedback(page, driver, meta);
    await page.locator('#contextualFeedbackSettingsButton').press('Enter');
    await page.locator('[data-feedback-settings-form]').waitFor({ state: 'visible' });
    await inspectDialog(page, driver, meta, 'actual-breakpoint-settings', settingsSelector, '.contextual-feedback-settings-panel');
    await inspectFocusedActions(page, driver, meta, settingsSelector, settingsSelector + ' button[type=submit]', 'actual-breakpoint-settings-actions');
    await closeSettings(page, driver, meta);
    if (Number(process.env.KIWI_THEME_AUDIT_OVERLAY_BREAKPOINT) === 760) {
        await captureReviewedHeading(page, driver, meta);
        const workspace = await page.locator('.contextual-feedback-workspace').evaluate(node => ({
            columns: getComputedStyle(node).gridTemplateColumns,
            toolbarColumns: getComputedStyle(node.querySelector('.contextual-feedback-toolbar')).gridTemplateColumns,
            width: node.getBoundingClientRect().width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
        check(driver, meta, 'actual image workspace follows the reviewed760 grid boundary without clipping', workspace.scrollWidth <= workspace.clientWidth + 1
            && workspace.columns.split(' ').length === (meta.viewport.width <= 760 ? 1 : 2), workspace);
        await observe(page, driver, meta, 'actual-breakpoint-image-workspace', feedbackSelector, '.contextual-feedback-panel');
        await page.locator('[data-feedback-remove-screenshot]').press('Enter');
        await closeFeedback(page, driver, meta);
    }
}

async function inspectWideArticleTriggerRail(page, driver, meta) {
    await page.locator('[data-action=open-article-sale-form]').first().press('Enter');
    await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
    const field = page.locator('#articleSearch'), trigger = page.locator('#contextualFeedbackButton');
    await field.focus();
    await inspectActualRegionHits(page, driver, meta, '#articleSearch', 'widest actual article search field');
    const before = await field.inputValue();
    const layout = await page.locator('#articleSaleForm').evaluate(root => {
        const card = root.querySelector('.card').getBoundingClientRect(), r = root.getBoundingClientRect();
        return { card: { x: card.x, right: card.right, width: card.width }, overlay: { x: r.x, right: r.right },
            paddingEnd: getComputedStyle(root).paddingInlineEnd, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    check(driver, meta, 'reviewed1560 scene keeps the actual widest1280article card and full backdrop borderbox within viewport', Math.abs(layout.card.width - 1280) <= 1
        && layout.card.x >= 0 && layout.card.right <= layout.viewportWidth && layout.overlay.x === 0 && Math.abs(layout.overlay.right - layout.viewportWidth) <= 1
        && layout.documentWidth <= layout.viewportWidth + 1, layout);
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => Math.abs(document.getElementById('contextualFeedbackButton').getBoundingClientRect().width - 46) <= 1);
    await observe(page, driver, meta, 'widest-article-trigger-rest', '#articleSaleForm', '#articleSaleForm .card', 'Actual widest article form geometry and empty search field only; no article workflow or submission.');
    const expandedWidth = meta.viewport.width <= 1560 ? 46 : 124;
    await trigger.hover();
    await page.waitForFunction(width => Math.abs(document.getElementById('contextualFeedbackButton').getBoundingClientRect().width - width) <= 1, expandedWidth);
    await inspectActualRegionHits(page, driver, meta, '#articleSearch', 'article field while actual trigger hovered');
    const hover = await trigger.evaluate(node => ({ width: node.getBoundingClientRect().width,
        captionOpacity: getComputedStyle(node.querySelector('.contextual-feedback-label')).opacity }));
    check(driver, meta, 'actual article trigger hover follows reviewed compact/expanded1560 behavior', Math.abs(hover.width - expandedWidth) <= 1
        && Number(hover.captionOpacity) === (meta.viewport.width <= 1560 ? 0 : 1), hover);
    await observe(page, driver, meta, 'widest-article-trigger-hover', '#articleSaleForm', '#articleSaleForm .card');
    await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await trigger.focus();
    await page.waitForFunction(width => Math.abs(document.getElementById('contextualFeedbackButton').getBoundingClientRect().width - width) <= 1, expandedWidth);
    const focus = await trigger.evaluate(node => {
        const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { width: r.width, height: r.height, x: r.x, right: r.right, y: r.y, bottom: r.bottom,
            focusVisible: node.matches(':focus-visible'), tabIndex: node.tabIndex, disabled: node.disabled,
            hasName: Boolean(node.getAttribute('aria-label') || node.getAttribute('title')), hit: hit === node || node.contains(hit) };
    });
    check(driver, meta, 'actual reserved-rail feedback entry remains named, focusable and an unobstructed pointer target', focus.focusVisible && focus.tabIndex >= 0
        && !focus.disabled && focus.hasName && focus.hit && focus.x >= 0 && focus.right <= meta.viewport.width
        && focus.y >= 0 && focus.bottom <= meta.viewport.height && Math.abs(focus.width - expandedWidth) <= 1, focus);
    await inspectActualRegionHits(page, driver, meta, '#articleSearch', 'article field while actual trigger keyboard-focused');
    await observe(page, driver, meta, 'widest-article-trigger-focus', '#articleSaleForm', '#articleSaleForm .card');
    await trigger.press('Enter');
    await page.locator(feedbackSelector).waitFor({ state: 'visible' });
    check(driver, meta, 'actual reserved-rail trigger opens native feedback over the unchanged article task', await page.locator(feedbackSelector).evaluate(node => node.matches(':modal'))
        && await page.locator('#articleSaleForm').isVisible());
    await closeFeedback(page, driver, meta);
    check(driver, meta, 'closing feedback keeps the actual article task and existing search value', await page.locator('#articleSaleForm').isVisible() && await field.inputValue() === before);
    if (meta.viewport.width === 1560) await inspectCompactMotionPreferences(page, driver, meta);
    await page.locator('#articleSaleForm [data-action=close-article-sale-form]').first().press('Enter');
    driver.report.overlayAcceptance.interactions.push({ ...meta, state: 'widest-article-entry-scope',
        setup: 'Actual existing article opener; explicit field/trigger focus after keyboard modality. No natural full-form Tab-order or completed article workflow claim.' });
}

async function inspectCompactMotionPreferences(page, driver, meta) {
    const trigger = page.locator('#contextualFeedbackButton');
    const observations = [];
    try {
        for (const preference of ['reduce', 'no-preference']) {
            await page.emulateMedia({ reducedMotion: preference });
            await page.mouse.move(0, 0); await page.locator('#articleSearch').focus();
            const read = () => trigger.evaluate(node => {
                const style = getComputedStyle(node), seconds = text => text.split(',').map(value => value.trim().endsWith('ms') ? parseFloat(value) / 1000 : parseFloat(value));
                return { property: style.transitionProperty, durations: seconds(style.transitionDuration), delays: seconds(style.transitionDelay),
                    width: node.getBoundingClientRect().width, reduceMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
                    normalMatches: matchMedia('(prefers-reduced-motion: no-preference)').matches };
            });
            const resting = await read(); await trigger.hover(); const hovered = await read();
            await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await trigger.focus(); const focused = await read();
            const states = [resting, hovered, focused];
            check(driver, meta, 'actual compact trigger honors ' + preference + ' without width motion',
                states.every(state => state.property.split(',').every(property => property.trim() === 'background-color') && Math.abs(state.width - 46) <= 1)
                && states.every(state => preference === 'reduce' ? state.reduceMatches && !state.normalMatches
                    && state.durations.every(duration => duration === 0) && state.delays.every(delay => delay === 0)
                    : !state.reduceMatches && state.normalMatches && state.durations.every(duration => duration > 0)),
                { preference, resting, hovered, focused, boundary: 'Actual page.emulateMedia preference; computed CSS and static compact width only. No CSS/DOM override or animation screenshot claim.' });
            observations.push({ preference, resting, hovered, focused });
        }
    } finally { await page.emulateMedia({ reducedMotion: 'reduce' }); }
    check(driver, meta, 'motion probe restores declared reduced-motion context', await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
    driver.report.overlayAcceptance.interactions.push({ ...meta, state: 'compact-motion-preferences', observations,
        documentation: 'https://github.com/microsoft/playwright/blob/main/docs/src/api/class-page.md',
        boundary: 'One1560 case per engine; no workflow, native200percent or lifecycle replay solely for color-animation correction.' });
}

async function preparePage(page, driver, meta, mode) {
    page.setDefaultTimeout(12000);
    trackRuntimeErrors(page, driver, meta.viewport);
    const controls = await installOverlayTransport(page, driver, mode);
    const finishStyles = driver.trackStylesheets(page, meta.viewport), finishBehavior = await trackBehavior(page, driver, meta);
    return { controls, async finish() { controls.release(); await finishBehavior(); await finishStyles(); await driver.saveReport(); } };
}

async function inspectComplaintSubset(driver, viewport) {
    const service = await import('./compose-smoke-theme-audit-service.mjs');
    await service.prepareServiceEvidence(driver);
    const context = await driver.newContext(viewport), page = await context.newPage();
    const meta = { viewport, role: 'kiwi-admin', locale: 'nl', phase: 'after', suite: 'complaint', overlayInlineErrors: true };
    const session = await preparePage(page, driver, meta, 'ordinary');
    const controls = await service.installServiceFixtures(page, driver), finishService = await service.trackServiceBehavior(page, driver, meta);
    try {
        await driver.login(page);
        await (await import('./compose-smoke-theme-audit-service-acceptance.mjs')).inspectComplaintCallbacks(page, driver, meta, controls);
    } catch (error) {
        driver.report.errors.push({ scenario: 'overlay08 existing complaint regression', message: error.message.slice(0, 1200) });
        await driver.capture(page, 'overlay08-complaint-failure', undefined, 'Actual failed local complaint setup/acceptance; retained, never accepted.').catch(() => {});
    } finally {
        service.releaseServiceFixtures(controls); await finishService(); await session.finish(); await context.close();
    }
}

async function runPage(driver, viewport, mode, role, run) {
    const context = await driver.newContext(viewport), page = await context.newPage();
    const meta = { viewport, role, locale: 'nl', phase: 'after', suite };
    const session = await preparePage(page, driver, meta, mode);
    try {
        await driver.login(page, role);
        await run(page, meta, session.controls);
    } catch (error) {
        driver.report.errors.push({ scenario: 'overlay08 ' + suite, viewport,
            message: error.message.replaceAll('kiwi-local-dev-password', '[local fixture password]').replace(/https?:\/\/\S+/g, '[local URL]').slice(0, 1600) });
        await driver.capture(page, 'after-overlay-failure-' + mode, undefined, 'Actual failed overlay setup/acceptance; retained, never accepted.').catch(() => {});
    } finally { await session.finish(); await context.close(); }
}

export async function inspectOverlayAcceptance(driver, viewport) {
    await register(driver);
    if (suite === 'complaint') return inspectComplaintSubset(driver, viewport);
    if (suite === 'roles-language') {
        await runPage(driver, viewport, 'restricted', 'kiwi-view', (page, meta, controls) => inspectRoleAndLanguage(page, driver, meta, controls));
        return runPage(driver, viewport, 'ordinary', 'kiwi-admin', (page, meta, controls) => inspectRoleAndLanguage(page, driver, meta, controls));
    }
    await runPage(driver, viewport, suite === 'focused' ? 'focused' : 'ordinary', 'kiwi-admin', async (page, meta, controls) => {
        if (suite === 'focused') {
            await inspectSettingsRecovery(page, driver, meta, controls, viewport.width === 1440);
            await enableVisibleFeedback(page, controls);
            await inspectFeedbackRecovery(page, driver, meta, controls, viewport.width === 1440);
            return;
        }
        await enableVisibleFeedback(page, controls);
        if (suite === 'boundaries') return inspectBoundary(page, driver, meta);
        await pairedOrdinaryDialogs(page, driver, meta);
        if ([1440, 390, 320, 600, 601].includes(viewport.width) && viewport.height === 1000) {
            await inspectImageLifecycle(page, driver, meta);
        }
        if ([1440, 390].includes(viewport.width) && viewport.height === 1000) {
            await inspectNestedDialogs(page, driver, meta);
        }
        await inspectGenericDialogs(page, driver, meta);
    });
    if (suite === 'focused' && viewport.width === 1440) {
        await runPage(driver, viewport, 'private-error', 'kiwi-admin', (page, meta, controls) => inspectPrivateErrorCapture(page, driver, meta, controls));
    }
    if (suite === 'focused' && viewport.width === 390 && viewport.height === 320) {
        await runPage(driver, viewport, 'restricted', 'kiwi-admin', (page, meta) => inspectRetainedCaptureCallbackError(page, driver, meta));
    }
    if (suite === 'matrix' && [1440, 320].includes(viewport.width)) {
        for (const denied of [false, true]) await accountPage(driver, viewport, denied);
    }
}

export async function prepareNativeOverlay(page, driver) {
    await register(driver);
    const controls = await installOverlayTransport(page, driver, 'ordinary');
    const finishBehavior = await trackBehavior(page, driver, { state: 'native overlay source' });
    return { controls, async finish() { controls.release(); await finishBehavior(); } };
}

export async function inspectNativeOverlay(page, driver, session, meta) {
    await enableVisibleFeedback(page, session.controls, true);
    await pairedOrdinaryDialogs(page, driver, meta);
    await inspectImageLifecycle(page, driver, meta);
    await inspectGenericDialogs(page, driver, meta);
}

export async function prepareLegacyOverlayPrivacy({ baseUrl, evidenceDir }) {
    const url = validateLocalUrl(baseUrl);
    const declaredOutput = process.env.KIWI_FEEDBACK_EVIDENCE_DIR;
    if (!declaredOutput || !path.isAbsolute(declaredOutput) || path.resolve(declaredOutput).startsWith('/tmp/')) {
        throw new Error('Guarded legacy privacy requires an explicit durable evidence directory.');
    }
    const sourceRoot = process.env.KIWI_THEME_APP_ROOT;
    if (!sourceRoot) throw new Error('Guarded legacy privacy requires the frozen application source root.');
    const report = { marker: 'theme_audit', errors: [], blockedWrites: [],
        application: { commit: execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } };
    const driver = { baseUrl: url, sourceRoot, report };
    await register(driver);
    let controls;
    return {
        async attach(page) {
            trackRuntimeErrors(page, driver, { width: 1693, height: 1209 });
            controls = await installOverlayTransport(page, driver, 'legacy-privacy');
        },
        async finish() {
            controls?.release();
            report.summary = { errors: report.errors.length, blockedRequests: report.blockedWrites.length,
                localSettingsPuts: controls?.settingsPuts || 0,
                boundary: 'Original privacy assertions/thresholds execute unchanged. Every accepted settings PUT was locally fulfilled; no preference persisted.' };
            await writeFile(path.join(evidenceDir, 'overlay-transport-report.json'), JSON.stringify(report, null, 2));
            if (report.summary.errors || report.summary.blockedRequests) throw new Error('Guarded legacy privacy recorded unexpected runtime/network activity.');
        }
    };
}

export { readFeedbackMultipart, register, validateLocalUrl };
