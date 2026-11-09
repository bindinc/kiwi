#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// theme_audit: measurements support visual review; they do not replace it.
const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright';
const playwright = require(playwrightPath);
const sourceRoot = path.resolve(process.env.KIWI_THEME_APP_ROOT || fileURLToPath(new URL('..', import.meta.url)));
const baseUrl = new URL(process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:8443/kiwi/');
const browserName = process.env.KIWI_SMOKE_BROWSER || 'chromium';
const slice = Number(process.env.KIWI_THEME_AUDIT_SLICE || '1');
const nativeZoom = process.env.KIWI_THEME_AUDIT_NATIVE_ZOOM === '1';
const evidenceRoot = path.resolve(process.env.KIWI_THEME_EVIDENCE_DIR || '/tmp/kiwi-theme-audit');
const evidenceDir = path.join(evidenceRoot, browserName);
const referencePath = path.join(sourceRoot, 'plans/kiwi-light-and-shadow-theme-palette-showcase.html');
const stylesheetNames = ['styles.css', 'delivery-date-picker.css', 'article-search.css', 'contextual-feedback.css', 'session-outbox.css'];
const viewports = process.env.KIWI_THEME_AUDIT_VIEWPORTS
    ? process.env.KIWI_THEME_AUDIT_VIEWPORTS.split(',').map(value => {
        const [width, height = 1000] = value.split('x').map(Number);
        return { width, height };
    })
    : [{ width: 1440, height: 1000 }, { width: 390, height: 1000 }, { width: 320, height: 1000 }, { width: 390, height: 320 }];

if (!['chromium', 'firefox'].includes(browserName)) throw new Error('Use chromium or firefox.');
if (!Number.isInteger(slice) || slice < 1 || slice > 10) throw new Error('KIWI_THEME_AUDIT_SLICE must be 1–10.');
if (!['bdc.rtvmedia.org.local', 'localhost', '127.0.0.1'].includes(baseUrl.hostname)) {
    throw new Error('This harness accepts only an isolated local Compose URL.');
}
if (viewports.some(({ width, height }) => !Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 240)) {
    throw new Error('Viewports must use WIDTHxHEIGHT, at least 320x240.');
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function git(...args) {
    return execFileSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' }).trim();
}

await mkdir(evidenceDir, { recursive: true });
let displayProcess;
let displayName;
function canOpenDisplay(name) {
    const script = `import ctypes
x = ctypes.CDLL('libX11.so.6')
x.XOpenDisplay.argtypes = [ctypes.c_char_p]
x.XOpenDisplay.restype = ctypes.c_void_p
x.XCloseDisplay.argtypes = [ctypes.c_void_p]
d = x.XOpenDisplay(None)
if not d: raise SystemExit(1)
x.XCloseDisplay(d)
`;
    try {
        execFileSync('python3', ['-'], { input: script, env: { ...process.env, DISPLAY: name }, stdio: ['pipe', 'ignore', 'ignore'] });
        return true;
    } catch {
        return false;
    }
}
if (nativeZoom) {
    displayName = process.env.KIWI_THEME_AUDIT_DISPLAY || ':95';
    if (canOpenDisplay(displayName)) throw new Error(`Display ${displayName} is already in use; select a dedicated KIWI_THEME_AUDIT_DISPLAY.`);
    let displayError = '';
    displayProcess = spawn('/usr/bin/Xvfb', [displayName, '-screen', '0', '1600x1200x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'ignore', 'pipe'] });
    displayProcess.stderr.on('data', chunk => { displayError += chunk.toString(); });
    process.on('exit', () => displayProcess?.kill('SIGTERM'));
    for (let attempt = 0; attempt < 50; attempt++) {
        if (canOpenDisplay(displayName)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!canOpenDisplay(displayName)) throw new Error(`Xvfb unavailable on ${displayName}: ${displayError.trim() || 'startup timeout'}`);
}
const launchEnvironment = nativeZoom ? {
    ...process.env, DISPLAY: displayName, MOZ_ENABLE_WAYLAND: '0', GDK_BACKEND: 'x11', WAYLAND_DISPLAY: ''
} : process.env;
const browser = await playwright[browserName].launch(browserName === 'firefox' ? { headless: !nativeZoom, env: launchEnvironment } : {
    headless: !nativeZoom,
    executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'],
    env: launchEnvironment
});
const report = {
    marker: 'theme_audit',
    slice,
    createdAt: new Date().toISOString(),
    application: {
        sourceRoot, commit: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'),
        dirtyPaths: git('status', '--porcelain=v1', '--untracked-files=no').split('\n').filter(Boolean),
        baseUrl: baseUrl.href,
        sourceStylesheets: Object.fromEntries(await Promise.all(stylesheetNames.map(async name => [name, sha256(await readFile(path.join(sourceRoot, 'assets/css', name)))])))
    },
    reference: {
        path: referencePath,
        lastChangedCommit: git('log', '-1', '--format=%H', '--', 'plans/kiwi-light-and-shadow-theme-palette-showcase.html'),
        sha256: sha256(await readFile(referencePath)),
        captureExclusion: 'Hide standalone documentation .page-header and .skip-link; workflow styles are unchanged.'
    },
    environment: {
        browser: browserName, browserVersion: browser.version(), playwrightVersion: require(path.join(playwrightPath, 'package.json')).version,
        locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', role: 'kiwi-admin', deviceScaleFactor: 1,
        reducedMotion: 'reduce', nativeZoom: nativeZoom ? 'Actual OS Ctrl+plus/0; measured per capture' : '100% default; 200% native zoom is a separate, unverified gate',
        input: 'Pointer flows plus keyboard focus and Escape checks', requestedViewports: viewports
    },
    checks: [], captures: [], blockedWrites: [], errors: [], loadedStylesheets: [],
    limitations: [
        'Measurements and screenshots require independent human visual review; no golden-image equivalence is claimed.',
        'This read-only run does not submit customer, consent, order, service or feedback changes.',
        nativeZoom ? 'Native zoom is verified by dpr/viewport changes and reset; screen-reader traversal is not covered.' : 'Native 200% browser zoom and screen-reader traversal are not simulated or claimed by this harness.',
        'Shared states not reached through real workflows remain explicitly unverified; unit/class fixtures are separate evidence.'
    ]
};

function normalizeMappedCssUrls(css, source) {
    const references = [...source.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].trim().replace(/^['"]|['"]$/g, ''));
    return css.replace(/url\(([^)]+)\)/g, (original, rawUrl) => {
        const url = rawUrl.trim().replace(/^['"]|['"]$/g, '');
        const reference = references.find(reference => {
            if (url === reference) return true;
            const basename = path.posix.basename(reference);
            const extension = path.posix.extname(basename);
            const stem = basename.slice(0, -extension.length);
            const mappedAssetPath = url.startsWith(`${baseUrl.pathname}assets/`) || path.posix.dirname(url) === path.posix.dirname(reference);
            return mappedAssetPath && path.posix.basename(url).startsWith(`${stem}-`) && url.endsWith(extension);
        });
        return reference ? `url(kiwi-asset:${path.posix.basename(reference)})` : original;
    });
}

function trackStylesheets(page, viewport) {
    const pending = [];
    page.on('response', response => {
        const pathname = new URL(response.url()).pathname;
        if (!pathname.startsWith(`${baseUrl.pathname}assets/css/`)) return;
        const name = stylesheetNames.find(filename => new RegExp(`/${filename.replace('.css', '')}(?:-[\\w-]+)?\\.css$`).test(pathname));
        if (!name) return;
        pending.push((async () => {
            const body = await response.body().catch(() => null);
            if (!body) return;
            const source = await readFile(path.join(sourceRoot, 'assets/css', name), 'utf8');
            const normalizedSourceHash = sha256(normalizeMappedCssUrls(source, source));
            const normalizedServedHash = sha256(normalizeMappedCssUrls(body.toString('utf8'), source));
            report.loadedStylesheets.push({ name, pathname, sha256: sha256(body), normalizedSourceHash, normalizedServedHash, viewport });
            check(`${name} served source matches`, normalizedServedHash, normalizedSourceHash, { state: 'asset provenance', viewport }, 10);
        })());
    });
    return () => Promise.all(pending);
}

async function saveReport() {
    await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
}

function check(name, actual, expected, context, minimumSlice = 1) {
    const matches = typeof expected === 'number'
        ? Math.abs(Number.parseFloat(actual) - expected) < 0.5
        : actual === expected;
    const status = matches ? 'verified' : slice < minimumSlice ? 'deferred' : 'deviation';
    report.checks.push({ name, actual, expected, status, requiredFromSlice: minimumSlice, ...context });
}

async function measure(page, selector) {
    return page.locator(selector).first().evaluate(element => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'borderRadius', 'boxShadow', 'backgroundColor', 'color', 'borderTopWidth', 'borderTopColor', 'outlineWidth', 'outlineColor', 'minHeight', 'transform'];
        return {
            ...Object.fromEntries(properties.map(property => [property, style[property]])),
            width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right,
            top: bounds.top, bottom: bounds.bottom, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth
        };
    });
}

async function capture(page, name, selector, kind = 'actual Compose application flow') {
    const viewport = page.viewportSize() || await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const filename = `${viewport.width}x${viewport.height}-${name}.png`;
    const target = selector ? page.locator(selector).first() : page;
    const isNativeWindow = nativeZoom && page.viewportSize() === null;
    if (isNativeWindow) {
        // Browser protocol clipping assumes unzoomed CSS coordinates; capture the real X screen.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-video_size', '1600x1200', '-i', displayName, '-frames:v', '1', '-update', '1', path.join(evidenceDir, filename)], { env: launchEnvironment });
    } else {
        await target.screenshot({ path: path.join(evidenceDir, filename), animations: 'disabled' });
    }
    const geometry = await page.evaluate(() => ({
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth, devicePixelRatio,
        visualViewportScale: visualViewport?.scale ?? null
    }));
    report.captures.push({ name, filename, viewport, kind, geometry, captureMethod: isNativeWindow ? 'actual 1600x1200 Xvfb desktop via ffmpeg x11grab' : 'browser protocol screenshot' });
    await saveReport();
}

async function newContext(viewport, readOnly = true) {
    const context = await browser.newContext({
        ignoreHTTPSErrors: true, viewport, reducedMotion: 'reduce', deviceScaleFactor: 1,
        locale: 'nl-NL', timezoneId: 'Europe/Amsterdam'
    });
    if (!readOnly) return context;
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const isApiWrite = url.pathname.includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
        if (!isApiWrite) return route.continue();
        report.blockedWrites.push({ method: request.method(), path: url.pathname });
        return route.abort('blockedbyclient');
    });
    return context;
}

async function login(page) {
    await page.goto(baseUrl.href);
    await page.locator('[name="username"]').fill('kiwi-admin');
    await page.locator('[name="password"]').fill('kiwi-local-dev-password');
    await Promise.all([
        page.waitForURL(url => url.pathname === baseUrl.pathname),
        page.locator('input[type="submit"],button[type="submit"]').click()
    ]);
    await page.waitForFunction(() => window.kiwiCustomerDetailSlice && window.kiwiCustomerWorkSession);
    await page.locator('#agentProfileTrigger').click();
    await page.locator('[data-locale-option="nl"]').click();
}

async function referenceContract(viewport) {
    const context = await newContext(viewport, false);
    const page = await context.newPage();
    try {
        await page.goto(pathToFileURL(referencePath).href);
        await page.addStyleTag({ content: '.page-header, .skip-link { visibility: hidden !important; }' });
        const contract = {
            body: await measure(page, '.preview-shell'),
            panel: await measure(page, '.customer-card'),
            panelInset: await measure(page, '.customer-header'),
            title: await measure(page, '.customer-header h3'),
            sectionTitle: await measure(page, '.preview-sidebar h3'),
            label: await measure(page, '.search-label'),
            input: await measure(page, '.search-input'),
            primary: await measure(page, '.preview-shell .button-primary'),
            secondary: await measure(page, '.preview-shell .button-secondary'),
            choice: await measure(page, '.subscription-choice')
        };
        contract.spaces = await page.evaluate(() => Object.fromEntries([1, 2, 3, 4, 5, 6, 8, 12].map(step => [`--space-${step}`, getComputedStyle(document.documentElement).getPropertyValue(`--space-${step}`).trim()])));
        contract.surfaces = await resolveSurfaces(page, '.preview-shell', {
            canvas: '--preview-canvas', data: '--preview-data-surface', label: '--preview-label-surface',
            selected: '--preview-selected-surface', info: '--preview-info-surface', attention: '--preview-attention-surface', group: '--preview-workflow-surface'
        });
        await capture(page, 'reference-customer', '.preview-shell', 'standalone showcase reference');
        await capture(page, 'reference-subscription', '.subscription-preview', 'standalone showcase reference');
        await writeFile(path.join(evidenceDir, `${viewport.width}x${viewport.height}-reference-contract.json`), JSON.stringify(contract, null, 2));
        return contract;
    } finally {
        await context.close();
    }
}

async function resolveSurfaces(page, selector, roles) {
    return page.locator(selector).first().evaluate((parent, names) => {
        const sample = document.createElement('span');
        sample.style.setProperty('transition', 'none', 'important');
        parent.append(sample);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        const colors = {};
        for (const [role, token] of Object.entries(names)) {
            sample.style.backgroundColor = `var(${token})`;
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = getComputedStyle(sample).backgroundColor;
            context.fillRect(0, 0, 1, 1);
            colors[role] = [...context.getImageData(0, 0, 1, 1).data];
        }
        sample.remove();
        return colors;
    }, roles);
}

async function foundationChecks(page, contract, state) {
    const context = { state, viewport: page.viewportSize(), kind: 'actual application rendered comparison' };
    const body = await measure(page, 'body');
    for (const property of ['fontFamily', 'fontSize', 'lineHeight']) check(`body ${property}`, body[property], contract.body[property], context);
    const spaces = await page.evaluate(() => Object.fromEntries([1, 2, 3, 4, 5, 6, 8, 12].map(step => [`--space-${step}`, getComputedStyle(document.documentElement).getPropertyValue(`--space-${step}`).trim()])));
    for (const [token, value] of Object.entries(contract.spaces)) check(token, spaces[token], value, context);
    const surfaces = await resolveSurfaces(page, 'body', {
        canvas: '--surface-canvas', data: '--surface-data', label: '--surface-label', selected: '--surface-selected',
        info: '--surface-info', attention: '--surface-attention', group: '--surface-group'
    });
    for (const [role, value] of Object.entries(contract.surfaces)) check(`composited ${role} surface`, JSON.stringify(surfaces[role]), JSON.stringify(value), context);
    const cards = await page.locator('.card:visible').evaluateAll(elements => elements.map(element => ({
        id: element.id, className: element.className, padding: getComputedStyle(element).paddingLeft,
        shadow: getComputedStyle(element).boxShadow, radius: getComputedStyle(element).borderTopLeftRadius
    })));
    for (const card of cards) {
        check(`${card.id || card.className} panel shadow`, card.shadow, contract.panel.boxShadow, context);
        const isOutbox = card.id === 'subscriptionQueuePanel';
        const expectedCorner = isOutbox ? '4px' : contract.panel.borderRadius;
        check(`${card.id || card.className} panel corner`, card.radius, expectedCorner, context);
        // Workflow-specific form insets are deliberately adopted by their own slices.
        const formSlice = state === 'subscription' ? 5 : state.startsWith('article') ? 6 : state === 'shell' ? 1 : 4;
        check(`${card.id || card.className} panel inset`, card.padding, contract.panelInset.paddingLeft, context, formSlice);
    }
}

async function keyboardFocus(page, selector, state) {
    const element = page.locator(selector).first();
    await page.keyboard.press('Tab');
    await element.focus();
    await page.waitForFunction(selector => {
        const node = document.querySelector(selector);
        return node === document.activeElement && node.matches(':focus-visible') && Number.parseFloat(getComputedStyle(node).outlineWidth) >= 2;
    }, selector);
    const result = await element.evaluate(node => ({
        focused: document.activeElement === node, visible: node.matches(':focus-visible'),
        width: Number.parseFloat(getComputedStyle(node).outlineWidth)
    }));
    check(`${selector} keyboard focus`, result.focused && result.visible && result.width >= 2, true, { state, viewport: page.viewportSize() });
}

async function controlChecks(page, contract, state) {
    if (slice < 2) return;
    const context = { state, viewport: page.viewportSize(), kind: 'actual application rendered comparison' };
    const primary = page.locator('.btn-primary:visible').first();
    if (await primary.count()) {
        const actual = await measure(page, '.btn-primary:visible');
        check('primary corner', actual.borderRadius, contract.primary.borderRadius, context);
        check('primary min-height', actual.minHeight, contract.primary.minHeight, context);
        await primary.hover();
        check('primary hover movement', (await measure(page, '.btn-primary:visible')).transform, 'none', context);
        await page.mouse.move(0, 0);
    }
    const secondary = page.locator('.btn-secondary:visible').first();
    if (await secondary.count()) {
        const actual = await measure(page, '.btn-secondary:visible');
        for (const property of ['backgroundColor', 'color', 'borderRadius', 'borderTopColor']) {
            check(`secondary ${property}`, actual[property], contract.secondary[property], context);
        }
    }
    const nativeInputs = await page.locator('input[type="radio"]:visible,input[type="checkbox"]:visible').evaluateAll(elements => elements.map(element => ({
        id: element.id, type: element.type, size: element.getBoundingClientRect().width,
        outline: getComputedStyle(element).outlineStyle, focused: element.matches(':focus-visible')
    })));
    for (const input of nativeInputs) {
        check(`${input.id} native minimum size`, input.size >= 20, true, context);
        if (!input.focused) check(`${input.id} resting outer outline`, input.outline, 'none', context);
    }
}

async function scenario(page, name, action) {
    try {
        await action();
    } catch (error) {
        report.errors.push({ scenario: name, viewport: page.viewportSize(), message: error.message.slice(0, 1200) });
        await capture(page, `${name}-failure`).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
    }
    await saveReport();
}

async function inspectApplication(viewport, contract) {
    const setupViewport = { width: viewport.width, height: Math.max(1000, viewport.height) };
    const context = await newContext(setupViewport);
    const page = await context.newPage();
    const finishAssetEvidence = trackStylesheets(page, viewport);
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => report.errors.push({ scenario: 'browser runtime', viewport, message: error.message }));
    try {
        await login(page);
        await page.setViewportSize(viewport);
        await capture(page, 'shell');
        await foundationChecks(page, contract, 'shell');
        await keyboardFocus(page, '#agentProfileTrigger', 'shell');
        await page.locator('#agentProfileTrigger').click();
        await capture(page, 'profile');
        await page.keyboard.press('Escape');
        if (await page.locator('#agentStatusMenu').isVisible()) await page.locator('#agentProfileTrigger').click();

        await scenario(page, 'subscription', async () => {
            await page.locator('[data-action="show-new-subscription"]').first().click();
            await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
            await capture(page, 'subscription-top');
            await foundationChecks(page, contract, 'subscription');
            await controlChecks(page, contract, 'subscription');
            await page.locator('#subStartDate').scrollIntoViewIfNeeded();
            await capture(page, 'subscription-payment-consent');
            const payment = await page.locator('#subPaymentAuto').evaluate(input => ({
                enabled: !input.matches(':disabled'), display: getComputedStyle(input).display,
                width: input.getBoundingClientRect().width, checked: input.checked
            }));
            check('enabled payment radio is rendered', !payment.enabled || (payment.display !== 'none' && payment.width > 0), true, { state: 'subscription', viewport }, 2);
            if (slice >= 2 && payment.enabled) await keyboardFocus(page, '#subPaymentAuto', 'subscription');
            await page.locator('#newSubscriptionForm [data-action="close-form"]').first().click();
        });
        await scenario(page, 'article', async () => {
            await page.locator('[data-action="open-article-sale-form"]').first().click();
            await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
            await capture(page, 'article-top');
            await foundationChecks(page, contract, 'article');
            await controlChecks(page, contract, 'article');
            await page.locator('#articleSearch').fill('a');
            await page.locator('#articleDropdown').waitFor({ state: 'visible' });
            await capture(page, 'article-results');
            await page.locator('#articleSearch').fill('');
            await page.locator('#deliveryDateDisplay').click();
            await page.locator('#deliveryCalendar .delivery-calendar-grid').waitFor();
            await capture(page, 'calendar', '#deliveryCalendar');
            await page.keyboard.press('Escape');
            await page.locator('#articleSaleForm [data-action="close-article-sale-form"]').first().click();
            if (await page.locator('#endCustomerWorkSessionButton').isVisible()) await page.locator('#endCustomerWorkSessionButton').click();
        });
        await scenario(page, 'customer', async () => {
            if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').click();
            await page.locator('#searchName').fill('Jansen');
            await page.locator('button[data-action="search-customer"]').click();
            await page.locator('#paginatedResults .result-row').first().waitFor();
            await page.locator('#searchResultsView').scrollIntoViewIfNeeded();
            await capture(page, 'results');
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            check('populated workspace page overflow', overflow <= 1, true, { state: 'results', viewport }, 3);
            await page.locator('#paginatedResults .result-row').first().click();
            await page.locator('#customerDetail').waitFor({ state: 'visible' });
            await capture(page, 'customer');
            await foundationChecks(page, contract, 'customer');
        });
        for (const [name, action, form] of [
            ['customer-edit', 'edit-customer', 'editCustomerForm'],
            ['resend', 'show-resend-magazine', 'resendMagazineForm'],
            ['editorial-complaint', 'show-editorial-complaint-form', 'editorialComplaintForm'],
            ['subscription-edit', 'edit-subscription', 'editSubscriptionForm'],
            ['winback', 'cancel-subscription', 'winbackFlow']
        ]) {
            await scenario(page, name, async () => {
                await page.locator(`[data-action="${action}"]:visible`).first().click();
                await page.locator(`#${form}`).waitFor({ state: 'visible' });
                await capture(page, name);
                await foundationChecks(page, contract, name);
                await page.locator(`#${form} [data-action="close-form"]`).first().click();
            });
        }
        await scenario(page, 'feedback-settings', async () => {
            await page.locator('#contextualFeedbackSettingsButton').click();
            await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' });
            await capture(page, 'feedback-settings');
            await page.locator('[data-feedback-settings-close]').first().click();
        });
        await scenario(page, 'feedback', async () => {
            // Installed handler inspection avoids persisting an enablement preference.
            await page.locator('#contextualFeedbackButton').evaluate(element => element.click());
            await page.locator('.contextual-feedback-modal').waitFor({ state: 'visible' });
            await capture(page, 'feedback', undefined, 'actual application dialog; installed hidden-button handler, preference unchanged');
            await page.locator('[data-feedback-close]').first().click();
        });
        await page.goto(new URL('logged-out', baseUrl).href);
        await capture(page, 'logged-out');
    } finally {
        await finishAssetEvidence();
        await context.close();
    }
}

function sendNativeZoomKey(reset = false) {
    // XTest sends real browser shortcuts. CSS zoom and CDP pinch scaling are not equivalent.
    const script = `
import ctypes, time
x11 = ctypes.CDLL('libX11.so.6')
xtest = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XKeysymToKeycode.restype = ctypes.c_ubyte
x11.XFlush.argtypes = [ctypes.c_void_p]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
if not display: raise RuntimeError('Dedicated X display unavailable')
control = x11.XKeysymToKeycode(display, 0xffe3)
key = x11.XKeysymToKeycode(display, ${reset ? '0x30' : '0x3d'})
for code, pressed in [(control,1),(key,1),(key,0),(control,0)]:
    xtest.XTestFakeKeyEvent(display, code, pressed, 0)
x11.XFlush(display)
time.sleep(0.2)
x11.XCloseDisplay(display)
`;
    execFileSync('python3', ['-'], { input: script, env: launchEnvironment });
}

async function nativeZoomChecks() {
    const context = await browser.newContext({
        viewport: null, ignoreHTTPSErrors: true, locale: 'nl-NL',
        timezoneId: 'Europe/Amsterdam', reducedMotion: 'reduce'
    });
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (!url.pathname.includes('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
        report.blockedWrites.push({ method: request.method(), path: url.pathname });
        return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const finishAssetEvidence = trackStylesheets(page, 'native window');
    page.on('pageerror', error => report.errors.push({ scenario: 'native browser runtime', message: error.message }));
    page.setDefaultTimeout(10000);
    const geometry = () => page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight, dpr: devicePixelRatio, pinchScale: visualViewport?.scale }));
    try {
        await login(page);
        await page.bringToFront();
        sendNativeZoomKey(true);
        const before = await geometry();
        let zoomed = before;
        let increments = 0;
        while (zoomed.dpr < before.dpr * 1.99 && increments < 10) {
            sendNativeZoomKey();
            zoomed = await geometry();
            increments++;
        }
        const native200 = Math.abs(zoomed.dpr / before.dpr - 2) < 0.03;
        const widthHalved = Math.abs(zoomed.innerWidth / before.innerWidth - 0.5) < 0.03;
        // Firefox reports outerWidth in zoomed CSS units; Chromium keeps screen units.
        const beforeOuter = browserName === 'firefox' ? before.outerWidth * before.dpr : before.outerWidth;
        const zoomedOuter = browserName === 'firefox' ? zoomed.outerWidth * zoomed.dpr : zoomed.outerWidth;
        const outerStable = Math.abs(zoomedOuter - beforeOuter) <= 2;
        const noPinch = Math.abs(zoomed.pinchScale - 1) < 0.01;
        check('native 200% browser zoom verified', native200 && widthHalved && outerStable && noPinch, true, {
            state: 'native zoom', before, zoomed, increments, kind: 'actual OS browser shortcut'
        });
        if (!native200 || !widthHalved || !outerStable || !noPinch) return;
        await capture(page, 'native-200-shell');
        await keyboardFocus(page, '#agentProfileTrigger', 'native 200% shell');
        await capture(page, 'native-200-profile-focus');
        await page.locator('#agentProfileTrigger').press('Enter');
        await page.locator('#agentStatusMenu').waitFor({ state: 'visible' });
        await capture(page, 'native-200-profile-menu');
        await page.keyboard.press('Escape');
        if (await page.locator('#agentStatusMenu').isVisible()) await page.locator('#agentProfileTrigger').press('Enter');
        await page.locator('[data-action="show-new-subscription"]').first().press('Enter');
        await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
        await page.locator('#newSubscriptionForm').evaluate(form => form.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await capture(page, 'native-200-subscription');
        await page.locator('#subStartDate').scrollIntoViewIfNeeded();
        await capture(page, 'native-200-payment-consent');
        await page.locator('#newSubscriptionForm [data-action="close-form"]').first().press('Enter');
        await page.locator('#contextualFeedbackSettingsButton').press('Enter');
        await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' });
        await capture(page, 'native-200-settings');
        await page.locator('[data-feedback-settings-close]').first().press('Enter');
        sendNativeZoomKey(true);
        const reset = await geometry();
        check('native zoom reset restored 100%', Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3, true, { state: 'native zoom reset', before, reset });
    } finally {
        sendNativeZoomKey(true);
        await finishAssetEvidence();
        await context.close();
    }
}

try {
    if (process.env.KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY !== '1') {
        for (const viewport of viewports) {
            const contract = await referenceContract(viewport);
            await inspectApplication(viewport, contract);
        }
    }
    if (nativeZoom) {
        try {
            await nativeZoomChecks();
        } catch (error) {
            report.errors.push({ scenario: 'native-200-percent', message: error.message.slice(0, 1200) });
        }
    }
} catch (error) {
    report.errors.push({ scenario: 'runner', message: error.message.slice(0, 1200) });
} finally {
    report.environment.capturedViewports = [...new Map(report.captures.map(capture => [JSON.stringify(capture.viewport), capture.viewport])).values()];
    report.summary = {
        verified: report.checks.filter(check => check.status === 'verified').length,
        deviations: report.checks.filter(check => check.status === 'deviation').length,
        deferred: report.checks.filter(check => check.status === 'deferred').length,
        errors: report.errors.length, blockedWrites: report.blockedWrites.length,
        captures: report.captures.length,
        acceptance: 'Requires independent visual review and remaining explicit gates; a successful run is not complete slice 10 acceptance.'
    };
    await saveReport();
    await browser.close();
    displayProcess?.kill('SIGTERM');
    console.log(`[theme_audit] ${browserName} slice ${slice}: ${JSON.stringify(report.summary)}`);
    if (report.summary.deviations || report.summary.errors || report.summary.blockedWrites) process.exitCode = 1;
}
