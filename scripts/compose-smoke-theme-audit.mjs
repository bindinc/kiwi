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
const finalSource = process.env.KIWI_THEME_AUDIT_FINAL_SOURCE === '1';
const finalReference = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const nativeZoomOnly = process.env.KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY === '1';
const nativeZoom = process.env.KIWI_THEME_AUDIT_NATIVE_ZOOM === '1' || nativeZoomOnly;
const controlsOnly = process.env.KIWI_THEME_AUDIT_CONTROLS_ONLY === '1';
const shellOnly = process.env.KIWI_THEME_AUDIT_SHELL_ONLY === '1';
const customerOnly = process.env.KIWI_THEME_AUDIT_CUSTOMER_ONLY === '1';
const subscriptionOnly = process.env.KIWI_THEME_AUDIT_SUBSCRIPTION_ONLY === '1';
const articleOnly = process.env.KIWI_THEME_AUDIT_ARTICLE_ONLY === '1';
const serviceOnly = process.env.KIWI_THEME_AUDIT_SERVICE_ONLY === '1';
const overlayOnly = process.env.KIWI_THEME_AUDIT_OVERLAY_ONLY === '1';
const overlayPhase = process.env.KIWI_THEME_AUDIT_OVERLAY_PHASE || 'before';
const overlaySuite = process.env.KIWI_THEME_AUDIT_OVERLAY_SUITE || 'matrix';
const overlayBreakpoint = Number(process.env.KIWI_THEME_AUDIT_OVERLAY_BREAKPOINT || 0);
const nativeOverlay = nativeZoom && slice === 8 && overlayOnly && overlayPhase === 'after';
const servicePhase = process.env.KIWI_THEME_AUDIT_SERVICE_PHASE || 'before';
const serviceSuite = process.env.KIWI_THEME_AUDIT_SERVICE_SUITE || 'full';
const articlePhase = process.env.KIWI_THEME_AUDIT_ARTICLE_PHASE || 'before';
const articleSuite = process.env.KIWI_THEME_AUDIT_ARTICLE_SUITE || 'layout';
const subscriptionPhase = process.env.KIWI_THEME_AUDIT_SUBSCRIPTION_PHASE || 'before';
const subscriptionSuite = process.env.KIWI_THEME_AUDIT_SUBSCRIPTION_SUITE || 'focused';
const customerPhase = process.env.KIWI_THEME_AUDIT_CUSTOMER_PHASE || 'before';
const customerLookupOnly = process.env.KIWI_THEME_AUDIT_CUSTOMER_LOOKUP_ONLY === '1';
const nativeCustomer = nativeZoom && slice === 4 && customerPhase === 'after';
const nativeSubscription = nativeZoom && slice === 5 && subscriptionPhase === 'after';
const nativeArticle = nativeZoom && slice === 6 && articlePhase === 'after';
const nativeService = nativeZoom && slice === 7 && servicePhase === 'after';
const shellPhase = process.env.KIWI_THEME_AUDIT_SHELL_PHASE || 'before';
const shellSuite = process.env.KIWI_THEME_AUDIT_SHELL_SUITE || 'matrix';
const evidenceRoot = path.resolve(process.env.KIWI_THEME_EVIDENCE_DIR || path.join(sourceRoot, '..', '.kiwi-theme-audit/evidence', `slice-${String(slice).padStart(2, '0')}`, `contract-${new Date().toISOString().replace(/[:.]/g, '-')}`));
const evidenceDir = path.join(evidenceRoot, browserName);
const referencePath = path.join(sourceRoot, 'plans/kiwi-light-and-shadow-theme-palette-showcase.html');
if (finalSource) {
    if (!process.env.KIWI_THEME_APP_ROOT) throw new Error('Current-source legacy checks require an explicit application worktree.');
    if (slice === 10 || !(controlsOnly || customerOnly || nativeCustomer) || (customerOnly && customerPhase !== 'after')) {
        throw new Error('This current-source bridge supports legacy controls and AFTER customer checks only; final10 remains separate.');
    }
    if (sha256(await readFile(referencePath)) !== finalReference) throw new Error('Current-source checks require the approved reference67.');
}
const stylesheetNames = ['styles.css', 'delivery-date-picker.css', 'article-search.css', 'contextual-feedback.css', 'session-outbox.css'];
const actionPrimitiveClasses = [
    'btn-primary', 'btn-secondary', 'btn-danger', 'btn-close', 'icon-btn', 'remark-shortcut',
    'btn-close-results', 'btn-close-customer', 'modal-close', 'contextual-feedback-close',
    'page-btn', 'timeline-nav-btn', 'session-outbox-icon-button', 'browse-all-link',
    'article-tab', 'order-item-remove', 'coupon-remove', 'additional-filters-toggle',
    'subscription-duplicate-action', 'werfsleutel-suggestion', 'subscription-offer-toggle', 'channel-chip'
];
const sourceCssByName = Object.fromEntries(await Promise.all(stylesheetNames.map(async name => [name, await readFile(path.join(sourceRoot, 'assets/css', name), 'utf8')])));
function shellViewports() {
    if (shellPhase === 'before') return [1440, 1024, 768, 390, 320].map(width => ({ width, height: 1000 })).concat({ width: 390, height: 320 });
    if (shellSuite === 'boundaries') {
        return [1201, 1200, 1199, 1001, 1000, 999, 769, 767, 601, 600, 599, 481, 480, 479].map(width => ({ width, height: 1000 }))
            .concat([541, 540, 539].map(height => ({ width: 390, height })));
    }
    if (['roles', 'interactions', 'profile'].includes(shellSuite)) return [{ width: 1440, height: 1000 }, { width: 390, height: 320 }];
    return [2048, 1440, 1024, 768, 390, 320].map(width => ({ width, height: 1000 })).concat({ width: 390, height: 320 });
}

function overlayViewports() {
    if (overlaySuite === 'boundaries') return [overlayBreakpoint + 1, overlayBreakpoint, overlayBreakpoint - 1].map(width => ({ width, height: 1000 }));
    if (overlaySuite === 'complaint') return [{ width: 320, height: 1000 }];
    if (overlaySuite === 'roles-language') return [{ width: 390, height: 320 }];
    if (overlaySuite === 'focused') return [{ width: 1440, height: 1000 }, { width: 390, height: 320 }];
    return [1440, 768, 390, 320].map(width => ({ width, height: 1000 })).concat({ width: 390, height: 320 });
}

const viewports = process.env.KIWI_THEME_AUDIT_VIEWPORTS
    ? process.env.KIWI_THEME_AUDIT_VIEWPORTS.split(',').map(value => {
        const [width, height = 1000] = value.split('x').map(Number);
        return { width, height };
    })
    : overlayOnly && overlayPhase === 'after' ? overlayViewports()
    : shellOnly ? shellViewports()
        : (articleOnly || serviceOnly) ? [1440, 390, 320].map(width => ({ width, height: 1000 }))
        : (customerOnly || subscriptionOnly) ? [{ width: 1440, height: 1000 }, { width: 390, height: 1000 }]
        : [{ width: 1440, height: 1000 }, { width: 390, height: 1000 }, { width: 320, height: 1000 }, { width: 390, height: 320 }];

if (overlayOnly && (baseUrl.username || baseUrl.password || !['http:', 'https:'].includes(baseUrl.protocol))) throw new Error('Overlay08 requires a credential-free local HTTP(S) URL.');
if (overlayOnly && (slice !== 8 || !['before', 'after'].includes(overlayPhase) || controlsOnly || shellOnly || customerOnly || subscriptionOnly || articleOnly || serviceOnly)) throw new Error('Run overlay08 before/after separately from all other workflow modes.');
if (overlayOnly && !['matrix', 'boundaries', 'focused', 'roles-language', 'complaint', 'native'].includes(overlaySuite)) throw new Error('Unknown overlay08 suite.');
if (overlayOnly && overlaySuite === 'boundaries' && (!Number.isInteger(overlayBreakpoint) || overlayBreakpoint < 321)) throw new Error('Provide the reviewed actual changed overlay breakpoint explicitly.');
if (overlayOnly && overlayPhase === 'before' && (overlaySuite !== 'matrix' || nativeZoom)) throw new Error('Observational overlay08 BEFORE supports matrix at100percent only.');
if (overlayOnly && overlayPhase === 'after' && ((overlaySuite === 'native') !== nativeZoomOnly || (nativeZoom && !nativeZoomOnly))) throw new Error('Overlay native requires explicit native-only mode and after/native suite.');
if (nativeZoom && slice === 8 && !nativeOverlay) throw new Error('Native overlay08 requires explicit overlay after mode.');
if (overlayOnly && overlaySuite === 'complaint' && (process.env.KIWI_THEME_AUDIT_SERVICE_PHASE !== 'after' || process.env.KIWI_THEME_AUDIT_SERVICE_SUITE !== 'complaint' || viewports.length !== 1 || viewports[0].width !== 320)) throw new Error('Overlay complaint regression requires existing service after/complaint fixture mode at one320px viewport.');
if (overlayOnly && overlayPhase === 'after' && (!process.env.KIWI_THEME_OVERLAY_SOURCE_PROOF || !process.env.KIWI_THEME_OVERLAY_SDK_FILE)) throw new Error('Overlay AFTER requires explicit frozen source proof and original pinned SDK paths.');
if (overlayOnly && process.env.KIWI_THEME_AUDIT_OVERLAY_PRIVACY === '1') throw new Error('Run guarded legacy privacy with its own original script.');
if (nativeZoom && slice === 7 && !nativeService) throw new Error('Native service07 mode requires SERVICE_PHASE=after.');
if ((serviceOnly || nativeService) && ['provider', 'winback'].includes(serviceSuite) && (servicePhase !== 'after' || nativeZoom || viewports.length !== 1 || viewports[0].width < 1000)) throw new Error('Run scoped service provider or callback checks in the after phase at one explicit desktop viewport.');
if ((serviceOnly || nativeService) && serviceSuite === 'complaint' && (servicePhase !== 'after' || nativeZoom || viewports.length !== 1 || viewports[0].width !== 320)) throw new Error('Run the existing complaint callback subset after at one explicit320px viewport.');
if (serviceOnly && (slice !== 7 || !['before', 'after'].includes(servicePhase) || shellOnly || customerOnly || controlsOnly || subscriptionOnly || articleOnly || nativeZoom)) throw new Error('Run service07 before/after separately from other modes.');
if (articleOnly && (shellOnly || customerOnly || controlsOnly || subscriptionOnly || nativeZoom)) throw new Error('Run article BEFORE separately from other modes.');
if (!['before', 'after'].includes(articlePhase)) throw new Error('Article phase must be before or after.');
if (!['layout', 'focused', 'sentinels'].includes(articleSuite)) throw new Error('Unknown article suite.');
if (articleOnly && slice !== 6) throw new Error('Article BEFORE requires slice06.');
if (!['chromium', 'firefox'].includes(browserName)) throw new Error('Use chromium or firefox.');
if (!Number.isInteger(slice) || slice < 1 || slice > 10) throw new Error('KIWI_THEME_AUDIT_SLICE must be 1–10.');
if (controlsOnly && slice < 2) throw new Error('Controlled action scenarios start at slice 02.');
if (shellOnly && (controlsOnly || nativeZoom)) throw new Error('Run shell, controls and native zoom modes separately.');
if (shellOnly && !['before', 'after'].includes(shellPhase)) throw new Error('Shell phase must be before or after.');
if (shellOnly && !['matrix', 'boundaries', 'roles', 'interactions', 'profile'].includes(shellSuite)) throw new Error('Unknown shell acceptance suite.');
if (shellOnly && slice < 3) throw new Error('Shell scenarios start at slice 03.');
if (controlsOnly && nativeZoom) throw new Error('Run native zoom separately with the main theme audit runner.');
if (customerOnly && (shellOnly || controlsOnly || nativeZoom)) throw new Error('Run customer, shell, controls and native modes separately.');
if (customerLookupOnly && !customerOnly) throw new Error('Lookup-only requires the dedicated customer mode.');
if (subscriptionOnly && (shellOnly || customerOnly || controlsOnly || nativeZoom)) throw new Error('Run subscription BEFORE separately from other modes.');
if (subscriptionOnly && slice < 5) throw new Error('Subscription scenarios start at slice05.');
if (subscriptionOnly && !['before', 'after'].includes(subscriptionPhase)) throw new Error('Subscription phase must be before or after.');
if (!['focused', 'sentinels'].includes(subscriptionSuite)) throw new Error('Subscription suite must be focused or sentinels.');
if (customerOnly && slice < 4) throw new Error('Customer scenarios start at slice 04.');
if (customerOnly && !['before', 'after'].includes(customerPhase)) throw new Error('Customer phase must be before or after.');
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
    args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1', ...(nativeZoom && slice >= 3 ? ['--disable-features=Translate,TranslateUI'] : [])],
    env: launchEnvironment
});
const report = {
    marker: 'theme_audit',
    slice,
    createdAt: new Date().toISOString(),
    runner: { path: fileURLToPath(import.meta.url), sourceSha256: sha256(await readFile(fileURLToPath(import.meta.url))) },
    application: {
        sourceRoot, commit: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'),
        dirtyPaths: git('status', '--porcelain=v1', '--untracked-files=no').split('\n').filter(Boolean),
        baseUrl: baseUrl.href,
        sourceStylesheets: Object.fromEntries(Object.entries(sourceCssByName).map(([name, css]) => [name, sha256(css)]))
    },
    reference: {
        path: referencePath,
        lastChangedCommit: git('log', '-1', '--format=%H', '--', 'plans/kiwi-light-and-shadow-theme-palette-showcase.html'),
        sha256: sha256(await readFile(referencePath)),
        captureExclusion: 'Hide standalone documentation .page-header and .skip-link; workflow styles are unchanged.',
        componentProbes: 'The showcase defines workflow quiet-button rules without a quiet element inside its preview shell. A temporary .button.button-calm span inside that real shell measures those existing rules, then is removed before screenshots.'
    },
    environment: {
        browser: browserName, browserVersion: browser.version(), playwrightVersion: require(path.join(playwrightPath, 'package.json')).version,
        locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', role: overlayOnly ? (overlayPhase === 'before' ? 'Actual admin and no-role account contexts; see per-state overlay observations' : 'Actual per-state roles/locales; see scoped overlay evidence') : shellOnly && shellSuite === 'roles' ? 'Actual per-context fallback roles; see shellAcceptance.roles' : 'kiwi-admin', deviceScaleFactor: 1,
        reducedMotion: 'reduce', nativeZoom: nativeZoom ? 'Actual OS Ctrl+plus/0; measured per capture' : '100% default; 200% native zoom is a separate, unverified gate',
        scenarioSet: overlayOnly ? (overlayPhase === 'before' ? 'Observed overlay08 BEFORE: actual form/feedback/settings/dialog/account surfaces, controlled local transport and capture lifecycle; no parity acceptance' : 'Required scoped overlay08 AFTER: ' + overlaySuite + '; independent full-image review remains necessary') : nativeService ? 'Actual native OS200% service family layout, native choices and reset; no mutation/privacy repetition' : serviceOnly ? (serviceSuite === 'complaint' ? 'Service07 existing complaint held/rejected/identical-retry acknowledgement only at320px; visible progress/error wrapping and source-derived queued model; no full workspace claim' : serviceSuite === 'winback' ? 'Service07 existing accepted/declined callbacks only: real held/queued callbacks and source-derived provisional models; no full workspace or provider/privacy repetition' : serviceSuite === 'provider' ? 'Service07 finite provider GET20 held/empty/error/recovery probe; no service mutations or full-workspace acceptance' : 'Service07 ' + servicePhase + ': finite actual service families and conditional branches with controlled fixtures') : articleOnly ? (articlePhase === 'before' ? 'Observed article BEFORE; source/locale counters are not acceptance' : 'Scoped article AFTER: ' + articleSuite) : nativeArticle ? 'Focused actual native OS200% article workspace and small shared sentinel' : subscriptionOnly ? (subscriptionPhase === 'before' ? 'Observed subscription BEFORE; source/locale counters are not acceptance' : 'Focused subscription AFTER layout and preserved interaction gates: ' + subscriptionSuite) : nativeSubscription ? 'Focused actual native OS200% subscription and small shell sentinel' : customerLookupOnly ? 'Bounded actual reusable-person lookup ' + customerPhase + '; not global subscription workflow acceptance' : nativeCustomer ? 'Required focused customer native OS200% gates and small shell sentinel' : customerOnly ? (customerPhase === 'before' ? 'Observed customer BEFORE states; no parity acceptance' : 'Required focused customer AFTER presentation and interaction gates') : shellOnly ? (shellPhase === 'before' ? 'Observed shell states; no parity verdict' : 'Required shell AFTER acceptance: ' + shellSuite) : controlsOnly ? 'Controlled action renderers and canonical modal fields' : 'Default application flows',
        input: customerLookupOnly ? (customerPhase === 'before' ? 'Actual pointer disclosure and native search-action Enter; no selection or submission' : 'Actual native summary Enter/Space and input/button Enter; no selection or submission') : 'Pointer flows plus keyboard focus and Escape checks', requestedViewports: viewports
    },
    checks: [], captures: [], controlContainers: [], blockedWrites: [], errors: [], loadedStylesheets: [],
    limitations: [
        'Measurements and screenshots require independent human visual review; no golden-image equivalence is claimed.',
        overlayOnly ? (overlayPhase === 'before' ? 'Only one explicitly declared settings PUT is fulfilled locally for native-entry observation; no settings, feedback or customer write is forwarded.' : 'Declared settings/multipart/service fixtures are locally fulfilled; counts are per scope and no server preference, feedback, webhook or customer write is forwarded.') : 'This read-only run does not submit customer, consent, order, service or feedback changes.',
        nativeZoom ? 'Native zoom is verified by dpr/viewport changes and reset; screen-reader traversal is not covered.' : 'Native 200% browser zoom and screen-reader traversal are not simulated or claimed by this harness.',
        'Shared states not reached through real workflows remain explicitly unverified; unit/class fixtures are separate evidence.'
    ]
};

function normalizeMappedCssUrls(css, source) {
    const references = [...source.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].trim().replace(/^['"]|['"]$/g, ''));
    const stylesheetDirectory = new URL('assets/css/', baseUrl);
    return css.replace(/url\(([^)]+)\)/g, (original, rawUrl) => {
        const url = rawUrl.trim().replace(/^['"]|['"]$/g, '');
        const reference = references.find(reference => {
            if (url === reference) return true;
            const expected = new URL(reference, stylesheetDirectory);
            const served = new URL(url, stylesheetDirectory);
            const sameLocation = served.origin === expected.origin
                && path.posix.dirname(served.pathname) === path.posix.dirname(expected.pathname)
                && served.search === expected.search && served.hash === expected.hash;
            if (!sameLocation) return false;
            const basename = path.posix.basename(expected.pathname);
            const extension = path.posix.extname(basename);
            const stem = basename.slice(0, -extension.length);
            const mappedName = path.posix.basename(served.pathname);
            const fingerprint = mappedName.slice(stem.length + 1, -extension.length);
            const hasExpectedName = mappedName.startsWith(`${stem}-`) && mappedName.endsWith(extension);
            return hasExpectedName && /^[A-Za-z0-9_-]{7}$/.test(fingerprint);
        });
        return reference ? `url(kiwi-asset:${new URL(reference, stylesheetDirectory).href})` : original;
    });
}

function trackStylesheets(page, viewport) {
    const pending = [];
    const observed = new Set();
    page.on('response', response => {
        const pathname = new URL(response.url()).pathname;
        if (!pathname.startsWith(`${baseUrl.pathname}assets/css/`)) return;
        const name = stylesheetNames.find(filename => new RegExp(`/${filename.replace('.css', '')}(?:-[\\w-]+)?\\.css$`).test(pathname));
        if (!name) return;
        pending.push((async () => {
            const body = await response.body().catch(() => null);
            if (!body) return;
            const source = sourceCssByName[name];
            const normalizedSourceHash = sha256(normalizeMappedCssUrls(source, source));
            const normalizedServedHash = sha256(normalizeMappedCssUrls(body.toString('utf8'), source));
            report.loadedStylesheets.push({ name, pathname, sha256: sha256(body), normalizedSourceHash, normalizedServedHash, viewport });
            observed.add(name);
            check(`${name} served source matches`, normalizedServedHash, normalizedSourceHash, { state: 'asset provenance', viewport });
        })());
    });
    return async () => {
        await Promise.all(pending);
        for (const name of stylesheetNames) {
            check(`${name} loaded from app assets`, observed.has(name), true, { state: 'asset provenance', viewport });
        }
    };
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

function unverified(name, reason, context, minimumSlice = 2) {
    report.checks.push({ name, reason, status: slice < minimumSlice ? 'deferred' : 'unverified', requiredFromSlice: minimumSlice, ...context });
}

async function measure(page, selector) {
    return page.locator(selector).first().evaluate(element => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'borderRadius', 'boxShadow', 'backgroundColor', 'color', 'borderTopWidth', 'borderTopColor', 'outlineWidth', 'outlineColor', 'minHeight', 'transform', 'textDecorationLine'];
        return {
            ...Object.fromEntries(properties.map(property => [property, style[property]])),
            width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right,
            top: bounds.top, bottom: bounds.bottom, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth
        };
    });
}

async function painted(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function capture(page, name, selector, kind = 'actual Compose application flow') {
    const viewport = page.viewportSize() || await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const filename = `${viewport.width}x${viewport.height}-${name}.png`;
    const target = selector ? page.locator(selector).first() : page;
    const isNativeWindow = nativeZoom && page.viewportSize() === null;
    if (isNativeWindow) {
        // Browser protocol clipping assumes unzoomed CSS coordinates; capture the real X screen.
        await painted(page);
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

async function newContext(viewport, readOnly = true, deviceScaleFactor = 1) {
    const context = await browser.newContext({
        ...((subscriptionOnly || articleOnly || serviceOnly || overlayOnly) ? { serviceWorkers: 'block' } : {}),
        ignoreHTTPSErrors: true, viewport, reducedMotion: 'reduce', deviceScaleFactor,
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

async function login(page, username = 'kiwi-admin') {
    await page.goto(baseUrl.href);
    await page.locator('[name="username"]').fill(username);
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
        await page.locator('.preview-shell').first().evaluate(shell => {
            const sample = document.createElement('span');
            sample.id = 'themeAuditQuietReference';
            sample.className = 'button button-calm';
            sample.textContent = 'Quiet reference sample';
            shell.append(sample);
        });
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
            formPrimary: await measure(page, '.subscription-form-actions .button-primary'),
            formSecondary: await measure(page, '.subscription-form-actions .button-secondary'),
            choiceText: await measure(page, '.subscription-choice strong'),
            consentValue: await measure(page, '.subscription-consent-row label'),
            quiet: await measure(page, '#themeAuditQuietReference'),
            choice: await measure(page, '.subscription-choice')
        };
        if (finalSource) {
            contract.referenceSha256 = sha256(await readFile(referencePath));
            if (contract.referenceSha256 !== finalReference) throw new Error('The approved reference changed before focus measurement.');
            const input = page.locator('.search-input').first();
            await input.scrollIntoViewIfNeeded();
            await input.focus();
            await page.keyboard.press('ArrowRight');
            await painted(page);
            contract.inputFocus = await input.evaluate(node => {
                const style = getComputedStyle(node);
                return {
                    active: document.activeElement === node, focusVisible: node.matches(':focus-visible'),
                    tag: node.tagName, type: node.type,
                    outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset,
                    outlineColor: style.outlineColor, boxShadow: style.boxShadow
                };
            });
            await writeFile(path.join(evidenceDir, `${viewport.width}x${viewport.height}-reference-focus-contract.json`),
                JSON.stringify({ marker: 'theme_audit', referencePath, referenceSha256: contract.referenceSha256,
                    inputFocus: contract.inputFocus }, null, 2) + '\n');
            await capture(page, 'reference-text-focus', undefined, 'Actual ref67 native keyboard focus; whole viewport, documentation header excluded.');
            const focus = contract.inputFocus;
            if (!focus.active || !focus.focusVisible || focus.tag !== 'INPUT' || focus.type !== 'search'
                || focus.outlineWidth !== '2px' || focus.outlineOffset !== '0px'
                || focus.outlineColor !== contract.primary.backgroundColor || focus.boxShadow !== 'none') {
                throw new Error('The actual focused reference must retain its approved single flush2px text-entry boundary.');
            }
        }
        contract.choiceStates = {};
        for (const [state, selector] of [
            ['checked', '.subscription-choice:has(input:checked)'],
            ['unchecked', '.subscription-choice:not(:has(input:checked))']
        ]) {
            const choice = page.locator(selector).first();
            const surface = await compositedTextContrast(choice);
            const border = await compositedTextContrast(choice, 'borderTopColor');
            contract.choiceStates[state] = {
                surface: surface.background.map(Math.round), border: border.foreground.map(Math.round),
                compositingSupported: surface.supported && border.supported
            };
        }
        await page.locator('.preview-shell .button-secondary').first().hover();
        await painted(page);
        contract.secondaryHover = await measure(page, '.preview-shell .button-secondary');
        await page.locator('#themeAuditQuietReference').hover();
        await painted(page);
        contract.quietHover = await measure(page, '#themeAuditQuietReference');
        await page.locator('#themeAuditQuietReference').evaluate(sample => sample.remove());
        await page.mouse.move(0, 0);
        if (shellOnly || (nativeZoom && slice >= 3)) {
            contract.shell = {};
            for (const selector of ['.preview-topbar', '.preview-body', '.preview-sidebar', '.preview-main', '.preview-brand']) {
                contract.shell[selector] = await measure(page, selector);
            }
        }
        if (subscriptionOnly || nativeSubscription || articleOnly || nativeArticle || serviceOnly || nativeService || (overlayOnly && overlayPhase === 'after')) {
            contract.subscription = {};
            for (const selector of ['.subscription-workspace', '.subscription-form-grid', '.subscription-form-block', '.subscription-selected-person', '.subscription-choice', '.subscription-consent-row', '.subscription-form-actions']) contract.subscription[selector] = await measure(page, selector);
            contract.subscriptionTitle = await measure(page, '.subscription-form-header h3');
            contract.subscriptionHeading = await measure(page, '.subscription-form-block > h4');
            contract.subscriptionInput = await measure(page, '.subscription-field input');
            contract.subscriptionCaption = await measure(page, '.subscription-field > label');
        }
        if (customerOnly || nativeCustomer) {
            contract.customer = {};
            for (const selector of ['.sidebar-result', '.customer-header', '.customer-header p', '.customer-grid', '.customer-grid .detail', '.detail span', '.detail strong', '.preview-actions']) {
                contract.customer[selector] = await measure(page, selector);
            }
        }
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
        ownerId: element.closest('.form-container')?.id || element.id,
        shadow: getComputedStyle(element).boxShadow, radius: getComputedStyle(element).borderTopLeftRadius
    })));
    for (const card of cards) {
        check(`${card.id || card.className} panel shadow`, card.shadow, contract.panel.boxShadow, context);
        const isOutbox = card.id === 'subscriptionQueuePanel';
        check(`${card.id || card.className} panel corner`, card.radius, contract.panel.borderRadius,
            isOutbox ? { ...context, reason: 'Existing outbox 4px exception is reconciled in slice 09.' } : context,
            isOutbox ? 9 : 1);
        const formSlice = panelInsetOwner(card.ownerId);
        check(`${card.id || card.className} panel inset`, card.padding, contract.panelInset.paddingLeft, context, formSlice);
    }
}

function panelInsetOwner(id) {
    if (id === 'subscriptionQueuePanel') return 9;
    if (id === 'newSubscriptionForm') return 5;
    if (id === 'articleSaleForm') return 6;
    if (id === 'editCustomerForm') return 4;
    if (['editSubscriptionForm', 'resendMagazineForm', 'editorialComplaintForm', 'winbackFlow', 'restitutionTransferForm'].includes(id)) return 7;
    return 1;
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
    const clipped = await element.evaluate(node => {
        const style = getComputedStyle(node);
        const ring = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
        const rect = node.getBoundingClientRect();
        const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const parentStyle = getComputedStyle(parent);
            const bounds = parent.getBoundingClientRect();
            if (parentStyle.overflowX !== 'visible') {
                clip.left = Math.max(clip.left, bounds.left + parent.clientLeft);
                clip.right = Math.min(clip.right, bounds.left + parent.clientLeft + parent.clientWidth);
            }
            if (parentStyle.overflowY !== 'visible') {
                clip.top = Math.max(clip.top, bounds.top + parent.clientTop);
                clip.bottom = Math.min(clip.bottom, bounds.top + parent.clientTop + parent.clientHeight);
            }
        }
        const horizontalFits = rect.left - ring >= clip.left - 1 && rect.right + ring <= clip.right + 1;
        const verticalFits = rect.top - ring >= clip.top - 1 && rect.bottom + ring <= clip.bottom + 1;
        const visible = horizontalFits && verticalFits;
        return { visible, ring, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, clip };
    });
    check(`${selector} focus ring stays inside visible scroll bounds`, clipped.visible, true, { state, viewport: page.viewportSize(), geometry: clipped });
}

async function controlChecks(page, contract, state, rootSelector, kind = 'actual application rendered comparison', { inspectHover = true } = {}) {
    if (slice < 2) return;
    const context = { state, viewport: page.viewportSize(), kind };
    const root = page.locator(rootSelector);
    const inputs = await root.locator('input:not([type="hidden"]),select,textarea,button#deliveryDateDisplay').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const namedElements = name => (element.getAttribute(name) || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)).filter(Boolean);
        const isVisibleText = node => Boolean(node.getClientRects().length && node.textContent.trim());
        const labels = [...new Set([...(element.labels || []), ...namedElements('aria-labelledby')])];
        const isCaptionField = !['radio', 'checkbox', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(element.type)
            || element.id === 'deliveryDateDisplay';
        const captions = [];
        if (isCaptionField) {
            for (const label of labels) {
                const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
                const parents = new Set();
                while (walker.nextNode()) {
                    const text = walker.currentNode;
                    const parent = text.parentElement;
                    if (!text.textContent.trim() || !parent) continue;
                    // Wrapped labels can contain select options and input values: those are not captions.
                    if (parent.closest('input,select,textarea,button,option,h1,h2,h3,h4,h5,h6,[aria-hidden="true"]')) continue;
                    const range = document.createRange();
                    range.selectNodeContents(text);
                    const textStyle = getComputedStyle(parent);
                    if (!range.getClientRects().length || textStyle.visibility !== 'visible') continue;
                    parents.add(parent);
                }
                for (const caption of parents) {
                    const captionStyle = getComputedStyle(caption);
                    captions.push({
                        element: caption.tagName, className: caption.className,
                        fontSize: captionStyle.fontSize, fontWeight: captionStyle.fontWeight, lineHeight: captionStyle.lineHeight
                    });
                }
            }
        }
        const group = element.closest('fieldset,[role="radiogroup"],[role="group"]');
        const groupLabels = group ? [
            group.querySelector('legend'),
            ...(group.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id))
        ].filter(Boolean) : [];
        const hasGroupName = Boolean(group && (group.getAttribute('aria-label')?.trim() || groupLabels.some(isVisibleText)));
        return {
            id: element.id || null, name: element.name || null, type: element.type, tag: element.tagName,
            width: rect.width, height: rect.height, padding: style.padding, radius: style.borderRadius,
            outline: style.outlineStyle, focused: element.matches(':focus-visible'), fontSize: style.fontSize, fontWeight: style.fontWeight,
            isCaptionField, captions,
            disabled: element.matches(':disabled'), readonly: Boolean(element.readOnly),
            hasPersistentLabel: labels.some(isVisibleText), hasGroupName,
            invalid: element.getAttribute('aria-invalid') === 'true',
            hasErrorDescription: namedElements('aria-describedby').some(isVisibleText)
        };
    }));
    report.controlContainers.push({
        state, rootSelector, kind, viewport: page.viewportSize(),
        controls: inputs.length, disabled: inputs.filter(input => input.disabled).length,
        readonly: inputs.filter(input => input.readonly).length,
        radios: inputs.filter(input => input.type === 'radio').length,
        checkboxes: inputs.filter(input => input.type === 'checkbox').length,
        captionFragments: inputs.reduce((count, input) => count + input.captions.length, 0)
    });
    check('real control coverage is populated', inputs.length > 0, true, context, 2);
    for (const input of inputs) {
        const identity = input.id || input.name || input.type;
        check(`${identity} persistent associated label`, input.hasPersistentLabel, true, { ...context, disabled: input.disabled, readonly: input.readonly }, 2);
        if (input.isCaptionField) {
            check(`${identity} visible caption coverage`, input.captions.length > 0, true, context, 2);
            for (const [index, caption] of input.captions.entries()) {
                for (const property of ['fontSize', 'fontWeight', 'lineHeight']) {
                    check(`${identity} caption ${index + 1} ${property}`, caption[property], contract.label[property], { ...context, caption }, 2);
                }
            }
        }
        if (input.type === 'radio' || input.type === 'checkbox') {
            check(`${identity} native minimum size`, input.width >= 20 && input.height >= 20, true, context, 2);
            check(`${identity} native padding`, input.padding, '0px', context, 2);
            if (!input.focused) check(`${identity} resting outer outline`, input.outline, 'none', context, 2);
            if (input.type === 'radio') {
                const circular = input.radius === '50%' || Math.abs(Number.parseFloat(input.radius) - input.width / 2) < 0.5;
                check(`${identity} radio remains circular`, circular, true, context, 2);
                check(`${identity} named choice group`, input.hasGroupName, true, context, 2);
            } else {
                check(`${identity} checkbox remains square`, input.radius, '0px', context, 2);
            }
        } else if (!['button', 'submit', 'file', 'range', 'color'].includes(input.type)) {
            check(`${identity} text control height`, input.height >= Number.parseFloat(contract.input.minHeight), true, context, 2);
            check(`${identity} field text size`, input.fontSize, contract.input.fontSize, context, 2);
            check(`${identity} field text weight`, input.fontWeight, contract.input.fontWeight, context, 2);
            check(`${identity} field corner`, input.radius, contract.input.borderRadius, context, 2);
        }
        if (input.invalid) check(`${identity} error is associated`, input.hasErrorDescription, true, context, 2);
    }

    const consentCaptions = await root.locator('.optin-label:visible').evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        return { fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
    }));
    for (const [index, caption] of consentCaptions.entries()) {
        for (const property of ['fontSize', 'fontWeight', 'lineHeight']) {
            check(`consent channel caption ${index + 1} ${property}`, caption[property], contract.label[property], context, 2);
        }
    }
    await choiceStyleChecks(page, contract, state, rootSelector, kind);

    await actionChecks(page, contract, state, rootSelector, kind);
    if (!inspectHover) return;
    await page.mouse.move(0, 0);
    await painted(page);
    const primarySelector = `${rootSelector} .btn-primary:visible:not(:disabled),${rootSelector} .contextual-feedback-actions button[type="submit"]:visible:not(:disabled)`;
    const primary = page.locator(primarySelector).first();
    if (await primary.count()) {
        const actual = await measure(page, primarySelector);
        for (const property of ['backgroundColor', 'color', 'borderTopColor']) {
            check(`primary ${property}`, actual[property], contract.primary[property], context, 2);
        }
        if (await hoverAction(page, primary, 'primary', context)) {
            check('primary hover movement', (await measure(page, primarySelector)).transform, 'none', context, 2);
        }
        await page.mouse.move(0, 0);
    }
    const secondarySelector = `${rootSelector} .form-actions .btn-secondary:visible:not(.ghost):not(:disabled),${rootSelector} .contextual-feedback-actions button[type="button"]:visible:not(:disabled)`;
    const secondary = page.locator(secondarySelector).first();
    if (await secondary.count()) {
        const actual = await measure(page, secondarySelector);
        for (const property of ['backgroundColor', 'color', 'borderRadius', 'borderTopColor']) {
            check(`secondary ${property}`, actual[property], contract.secondary[property], context, 2);
        }
        if (await hoverAction(page, secondary, 'secondary', context)) {
            const hover = await measure(page, secondarySelector);
            const contrast = await compositedTextContrast(secondary);
            check('secondary hover surface', hover.backgroundColor, contract.secondaryHover.backgroundColor, context, 2);
            check('secondary hover movement', hover.transform, 'none', context, 2);
            check('secondary hover accessible text override', hover.color, 'rgb(93, 88, 85)', {
                ...context, referenceColor: contract.secondaryHover.color,
                reason: 'The reference Hematite hover text falls below 4.5:1 on its translucent fill; the approved existing darker action-secondary-hover text role is the narrow accessibility exception.'
            }, 2);
            if (contrast.supported) {
                check('secondary hover composited contrast', contrast.ratio >= 4.5, true, { ...context, contrast }, 2);
            } else {
                unverified('secondary hover composited contrast', 'Ancestor opacity requires separate compositing review.', { ...context, contrast });
            }
        }
        await page.mouse.move(0, 0);
    }
    const quietSelector = `${rootSelector} .btn.ghost:visible:not(:disabled)`;
    const quiet = page.locator(quietSelector).first();
    if (await quiet.count()) {
        const actual = await measure(page, quietSelector);
        for (const property of ['backgroundColor', 'color', 'borderTopColor', 'borderRadius', 'textDecorationLine']) {
            check(`quiet action ${property}`, actual[property], contract.quiet[property], context, 2);
        }
        await quiet.hover();
        await painted(page);
        const hover = await measure(page, quietSelector);
        for (const property of ['backgroundColor', 'color', 'transform']) {
            check(`quiet action hover ${property}`, hover[property], contract.quietHover[property], context, 2);
        }
        await page.mouse.move(0, 0);
    }
}

async function hoverAction(page, locator, role, context) {
    await locator.scrollIntoViewIfNeeded();
    const geometry = await locator.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        return {
            feedback: Boolean(element.closest('.contextual-feedback-modal,.contextual-feedback-settings-modal')),
            short: innerHeight <= 320,
            centerVisible: centerX >= 0 && centerX <= innerWidth && centerY >= 0 && centerY <= innerHeight,
            left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
            viewportWidth: innerWidth, viewportHeight: innerHeight
        };
    });
    if (geometry.feedback && geometry.short && !geometry.centerVisible) {
        unverified(role + ' hover remains unreachable after scrolling',
            'Known pre-02 short feedback containment defect; recorded for slice 08, not accepted as a hover pass.',
            { ...context, geometry }, 8);
        return false;
    }
    await locator.hover();
    await painted(page);
    return true;
}

async function actionChecks(page, contract, state, rootSelector, kind = 'actual application rendered comparison') {
    if (slice < 2) return;
    const context = { state, viewport: page.viewportSize(), kind };
    const selector = [
        '.btn:visible:not(.btn-end-session-header)',
        ...actionPrimitiveClasses.map(name => `.${name}:visible`),
        '.contextual-feedback-actions button:visible'
    ].join(',');
    const buttons = await page.locator(rootSelector).locator(selector).evaluateAll((elements, primitiveClasses) => elements.map(element => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        let primitive = primitiveClasses.find(name => element.classList.contains(name)) || 'btn';
        if (element.closest('.contextual-feedback-actions')) {
            primitive = element.type === 'submit' ? 'feedback primary' : 'feedback secondary';
        }
        const iconOnly = ['btn-close', 'icon-btn', 'btn-close-results', 'btn-close-customer', 'modal-close', 'contextual-feedback-close', 'session-outbox-icon-button', 'order-item-remove', 'coupon-remove'].includes(primitive);
        return {
            type: primitive, iconOnly, action: element.dataset.action || null, width: bounds.width, height: bounds.height,
            radius: style.borderRadius, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
            paddingTop: style.paddingTop, paddingRight: style.paddingRight, paddingBottom: style.paddingBottom, paddingLeft: style.paddingLeft,
            isOutboxTextAction: primitive === 'session-outbox-icon-button' && Boolean(element.querySelector('span')),
            hasName: Boolean((element.getAttribute('aria-label') || element.title || element.textContent).trim())
        };
    }), actionPrimitiveClasses);
    for (const button of buttons) {
        const metadata = { ...context, action: button.action, geometry: { width: button.width, height: button.height } };
        check(`${button.type} action height`, button.height >= 40, true, metadata, 2);
        check(`${button.type} action corner`, button.radius, '0px', metadata, 2);
        check(`${button.type} action accessible name`, button.hasName, true, metadata, 2);
        if (button.iconOnly) check(`${button.type} action width`, button.width >= 40, true, metadata, 2);
        const hasSharedTextRole = button.isOutboxTextAction || [
            'btn', 'btn-primary', 'btn-secondary', 'btn-danger', 'page-btn', 'timeline-nav-btn',
            'remark-shortcut', 'feedback primary', 'feedback secondary', 'browse-all-link',
            'article-tab', 'additional-filters-toggle', 'subscription-duplicate-action'
        ].includes(button.type);
        if (hasSharedTextRole) {
            for (const property of ['fontSize', 'fontWeight', 'lineHeight']) {
                check(`${button.type} action ${property}`, button[property], contract.primary[property], metadata, 2);
            }
        }
        if (button.type === 'feedback primary' || button.type === 'feedback secondary') {
            const actionContract = button.type === 'feedback primary' ? contract.formPrimary : contract.formSecondary;
            for (const property of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
                check(`${button.type} action ${property}`, button[property], actionContract[property], metadata, 2);
            }
        }
    }
    const closeButtons = page.locator(rootSelector).locator('.btn-close:visible,.btn-close-results:visible,.btn-close-customer:visible,.modal-close:visible,.contextual-feedback-close:visible');
    for (let index = 0; index < await closeButtons.count(); index++) {
        const contrast = await compositedTextContrast(closeButtons.nth(index));
        if (contrast.supported) {
            check('actual close icon composited contrast', contrast.ratio >= 3, true, { ...context, index, contrast }, 2);
        } else {
            unverified('actual close icon composited contrast', 'Ancestor opacity requires separate compositing review.', { ...context, index, contrast });
        }
    }
}

async function compositedTextContrast(locator, foregroundProperty = 'color') {
    return locator.evaluate((element, property) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        const rgba = css => {
            const rgb = css.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
            if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
            const srgb = css.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/);
            if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = css;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value);
        };
        const over = (foreground, background) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));
        const ancestors = [];
        for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
        const supported = ancestors.every(node => Number.parseFloat(getComputedStyle(node).opacity) === 1);
        let background = [255, 255, 255];
        for (const node of ancestors) background = over(rgba(getComputedStyle(node).backgroundColor), background);
        const foreground = over(rgba(getComputedStyle(element)[property]), background);
        const luminance = rgb => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
        return { supported, ratio: (values[1] + 0.05) / (values[0] + 0.05), foreground, background };
    }, foregroundProperty);
}

async function choiceStyleChecks(page, contract, state, rootSelector, kind = 'actual application choice state') {
    if (slice < 2) return;
    const metadata = { state, viewport: page.viewportSize(), kind };
    const options = page.locator(rootSelector).locator('.payment-option:visible');
    for (let index = 0; index < await options.count(); index++) {
        const option = options.nth(index);
        const text = option.locator('label .payment-text');
        check('actual payment value text coverage', await text.count(), 1, { ...metadata, index }, 2);
        const observed = await option.evaluate(node => {
            const input = node.querySelector('input[type="radio"]');
            const text = node.querySelector('label .payment-text');
            const style = text && getComputedStyle(text);
            return { id: input?.id, checked: Boolean(input?.checked), disabled: Boolean(input?.disabled),
                fontSize: style?.fontSize, fontWeight: style?.fontWeight, lineHeight: style?.lineHeight, color: style?.color };
        });
        for (const property of ['fontSize', 'fontWeight', 'lineHeight', 'color']) {
            check('payment value ' + property, observed[property], contract.choiceText[property], { ...metadata, observed }, 2);
        }
        const surface = await compositedTextContrast(option.locator('label').first());
        const border = await compositedTextContrast(option, 'borderTopColor');
        const expected = contract.choiceStates[observed.checked ? 'checked' : 'unchecked'];
        if (surface.supported && border.supported && expected.compositingSupported) {
            check('payment choice composited surface', JSON.stringify(surface.background.map(Math.round)), JSON.stringify(expected.surface), { ...metadata, observed }, 2);
            check('payment choice composited border', JSON.stringify(border.foreground.map(Math.round)), JSON.stringify(expected.border), {
                ...metadata, observed,
                reason: observed.checked ? 'Actual selected accent boundary.' : 'Reference decorative 42% wrapper; native marker accessibility is verified separately.'
            }, 2);
        } else {
            unverified('payment choice surface and boundary', 'Ancestor opacity requires separate compositing review.', { ...metadata, observed });
        }
    }
    const values = await page.locator(rootSelector).locator('.optin-options label:visible').evaluateAll(labels => labels.map(label => {
        const style = getComputedStyle(label), input = label.querySelector('input[type="radio"]');
        return { checked: Boolean(input?.checked), disabled: Boolean(input?.disabled),
            fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, color: style.color };
    }));
    for (const [index, observed] of values.entries()) {
        for (const property of ['fontSize', 'fontWeight', 'lineHeight', 'color']) {
            check('consent value ' + property, observed[property], contract.consentValue[property], { ...metadata, index, observed }, 2);
        }
    }
}

async function paymentChecks(page, contract, { rootSelector, state, firstId, secondId, ibanId, keyboardOnly = false }) {
    if (slice < 2) return;
    const context = { state, viewport: page.viewportSize(), kind: keyboardOnly ? 'actual application payment keyboard interaction at native zoom' : 'actual application payment interaction' };
    const first = page.locator(`#${firstId}`);
    const second = page.locator(`#${secondId}`);
    const inputs = page.locator(`${rootSelector} .payment-option input[type="radio"]`);
    check('real payment choices are present', await inputs.count(), 2, context, 2);
    const stateOf = locator => locator.evaluate(input => ({
        visible: input.getClientRects().length > 0 && getComputedStyle(input).visibility !== 'hidden',
        disabled: input.matches(':disabled'), checked: input.checked, value: input.value,
        labelHeight: input.labels?.[0]?.getBoundingClientRect().height || 0
    }));
    const firstState = await stateOf(first);
    const secondState = await stateOf(second);
    for (const [id, input] of [[firstId, firstState], [secondId, secondState]]) {
        check(`${id} native payment is rendered`, input.visible, true, context, 2);
        check(`${id} whole choice minimum height`, input.labelHeight >= Number.parseFloat(contract.choice.minHeight), true, context, 2);
    }
    await choiceStyleChecks(page, contract, state + ' initial values', rootSelector, context.kind);
    if (firstState.disabled || secondState.disabled) {
        unverified('enabled payment keyboard and pointer path', 'The actual workflow has disabled payment choices; a permitted enabled fixture is still required.', context);
        return;
    }
    if (!firstState.checked) await first.press('Space');
    const hasPrecedingTabStop = await first.evaluate(input => {
        const candidates = [...input.closest('form').querySelectorAll('input,select,textarea,button,a[href],summary,[tabindex]')].filter(element =>
            element.getClientRects().length && !element.matches(':disabled') && element.tabIndex >= 0 && (element.type !== 'radio' || element.checked)
        );
        const previous = candidates[candidates.indexOf(input) - 1];
        if (!previous) return false;
        previous.focus();
        return true;
    });
    if (hasPrecedingTabStop) {
        await page.keyboard.press('Tab');
        check('Tab reaches checked payment radio', await first.evaluate(input => document.activeElement === input), true, context, 2);
    } else {
        unverified('Tab reaches checked payment radio', 'No preceding real tab stop was available.', context);
    }
    await keyboardFocus(page, `#${firstId}`, state);
    await first.press('ArrowRight');
    await painted(page);
    check('ArrowRight selects and focuses next payment', await second.evaluate(input => input.checked && document.activeElement === input), true, context, 2);
    await choiceStyleChecks(page, contract, state + ' next payment selected', rootSelector, context.kind);
    if (ibanId) {
        const iban = await page.locator(`#${ibanId}`).evaluate(input => ({ visible: input.getClientRects().length > 0, required: input.required }));
        check('invoice hides IBAN and removes requiredness', !iban.visible && !iban.required, true, context, 2);
    }
    await capture(page, `${state}-payment-next`, `${rootSelector} .payment-methods`);
    await second.press('ArrowLeft');
    await painted(page);
    check('ArrowLeft restores first payment and focus', await first.evaluate(input => input.checked && document.activeElement === input), true, context, 2);
    await choiceStyleChecks(page, contract, state + ' first payment restored', rootSelector, context.kind);
    if (ibanId) {
        const iban = await page.locator(`#${ibanId}`).evaluate(input => ({ visible: input.getClientRects().length > 0, required: input.required }));
        check('direct debit restores visible required IBAN', iban.visible && iban.required, true, context, 2);
    }
    if (!keyboardOnly) {
        await page.locator(`label[for="${secondId}"]`).click();
        check('pointer label selects same payment value', await second.isChecked(), true, { ...context, value: secondState.value }, 2);
        await page.locator(`label[for="${firstId}"]`).click();
        check('payment returns to initial first value', await first.isChecked(), true, { ...context, value: firstState.value }, 2);
    }
}

async function consentStateChecks(page, contract, rootSelector, state) {
    const metadata = { state, viewport: page.viewportSize(), kind: 'Actual native consent interactions in an isolated local context; no submission.' };
    const inputs = page.locator(rootSelector).locator('.optin-options input[type="radio"]');
    check('consent initially remains unset', await inputs.evaluateAll(nodes => nodes.filter(node => node.checked).length), 0, metadata, 2);
    const first = inputs.first();
    const name = await first.getAttribute('name');
    const group = page.locator(rootSelector).locator('.optin-options input[name="' + name + '"]');
    check('real consent group has two choices', await group.count(), 2, metadata, 2);
    await group.first().press('Space'); await painted(page);
    check('consent Space selects the focused option', await group.first().isChecked(), true, metadata, 2);
    await choiceStyleChecks(page, contract, state + ' first consent choice', rootSelector, metadata.kind);
    await capture(page, state + '-consent-first');
    await group.first().press('ArrowRight'); await painted(page);
    check('consent arrow selects the alternative', await group.nth(1).isChecked(), true, metadata, 2);
    check('consent native group stays mutually exclusive', await group.evaluateAll(nodes => nodes.filter(node => node.checked).length), 1, metadata, 2);
    await choiceStyleChecks(page, contract, state + ' alternative consent choice', rootSelector, metadata.kind);
    await capture(page, state + '-consent-alternative');
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
        await controlChecks(page, contract, 'initial-search', '.search-card');
        await keyboardFocus(page, '#agentProfileTrigger', 'shell');
        await page.locator('#agentProfileTrigger').click();
        await capture(page, 'profile');
        await page.keyboard.press('Escape');
        if (await page.locator('#agentStatusMenu').isVisible()) await page.locator('#agentProfileTrigger').click();

        await scenario(page, 'subscription', async () => {
            await page.locator('[data-action="show-new-subscription"]').first().click();
            await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
            await capture(page, 'subscription-top');
            if (slice >= 2) {
                const modes = await page.locator('#newSubscriptionForm input[name="recipientMode"]').evaluateAll(inputs => inputs.map(input => input.matches(':disabled')));
                check('recipient modes preserve initial unavailable state', modes.length === 2 && modes.every(Boolean), true, { state: 'subscription without product', viewport }, 2);
            }
            await foundationChecks(page, contract, 'subscription');
            await controlChecks(page, contract, 'subscription', '#newSubscriptionForm');
            check('new subscription consent remains unselected', await page.locator('#newSubscriptionForm input[name^="subOptin"]:checked').count(), 0, { state: 'subscription', viewport }, 2);
            await paymentChecks(page, contract, { rootSelector: '#newSubscriptionForm', state: 'subscription', firstId: 'subPaymentAuto', secondId: 'subPaymentInstruction', ibanId: 'subIBAN' });
            await page.locator('#subStartDate').scrollIntoViewIfNeeded();
            await capture(page, 'subscription-payment-consent');
            await page.locator('#newSubscriptionForm [data-action="close-form"]').first().click();
        });
        await scenario(page, 'article', async () => {
            await page.locator('[data-action="open-article-sale-form"]').first().click();
            await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
            await capture(page, 'article-top');
            await foundationChecks(page, contract, 'article');
            await controlChecks(page, contract, 'article', '#articleSaleForm');
            await paymentChecks(page, contract, { rootSelector: '#articleSaleForm', state: 'article', firstId: 'articlePaymentIdeal', secondId: 'articlePaymentTransfer' });
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
            await controlChecks(page, contract, 'expanded-search', '.search-card');
            await page.locator('#searchName').fill('Jansen');
            await page.locator('button[data-action="search-customer"]').click();
            await page.locator('#paginatedResults .result-row').first().waitFor();
            await controlChecks(page, contract, 'result sorting', '#searchResultsView .results-controls');
            await actionChecks(page, contract, 'results', '#searchResultsView');
            await page.locator('#searchResultsView').scrollIntoViewIfNeeded();
            await capture(page, 'results');
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            check('populated workspace page overflow', overflow <= 1, true, { state: 'results', viewport }, 3);
            await page.locator('#paginatedResults .result-row').first().click();
            await page.locator('#customerDetail').waitFor({ state: 'visible' });
            await capture(page, 'customer');
            await foundationChecks(page, contract, 'customer');
            await actionChecks(page, contract, 'customer', '#customerDetail');
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
                await controlChecks(page, contract, name, `#${form}`);
                await page.locator(`#${form} [data-action="close-form"]`).first().click();
            });
        }
        await scenario(page, 'feedback-settings', async () => {
            await page.locator('#contextualFeedbackSettingsButton').click();
            await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' });
            await capture(page, 'feedback-settings');
            await controlChecks(page, contract, 'feedback-settings', '.contextual-feedback-settings-modal');
            await page.locator('[data-feedback-settings-close]').first().click();
        });
        await scenario(page, 'feedback', async () => {
            // Installed handler inspection avoids persisting an enablement preference.
            await page.locator('#contextualFeedbackButton').evaluate(element => element.click());
            await page.locator('.contextual-feedback-modal').waitFor({ state: 'visible' });
            await capture(page, 'feedback', undefined, 'actual application dialog; installed hidden-button handler, preference unchanged');
            await controlChecks(page, contract, 'feedback', '.contextual-feedback-modal');
            const closeBounds = await page.locator('[data-feedback-close]').first().evaluate(button => {
                const rect = button.getBoundingClientRect();
                return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: innerWidth, height: innerHeight };
            });
            const closeInViewport = closeBounds.top >= 0 && closeBounds.bottom <= closeBounds.height && closeBounds.left >= 0 && closeBounds.right <= closeBounds.width;
            check('feedback close remains inside short viewport', closeInViewport, true, {
                state: 'feedback', viewport, geometry: closeBounds,
                reason: 'The same clipping was confirmed with pre-02 CSS on current markup in both browsers; overlay containment belongs to slice 08. Escape is used to leave the known failing short state.'
            }, 8);
            if (closeInViewport) await page.locator('[data-feedback-close]').first().click();
            else await page.keyboard.press('Escape');
            await page.locator('.contextual-feedback-modal').waitFor({ state: 'hidden' });
        });
        await page.goto(new URL('logged-out', baseUrl).href);
        await capture(page, 'logged-out');
    } finally {
        await finishAssetEvidence();
        await context.close();
    }
}

async function inspectEnabledRoleFixture(viewport, contract) {
    if (slice < 2) return;
    const kind = 'intercepted person fixture through the actual subscription role runtime';
    const context = await newContext({ width: viewport.width, height: Math.max(viewport.height, 1000) });
    const page = await context.newPage();
    const finishAssetEvidence = trackStylesheets(page, viewport);
    page.setDefaultTimeout(10000);
    const recipient = {
        id: 73, personId: '73', firstName: 'Alex', initials: 'A.B.', lastName: 'Fixture',
        salutation: 'Dhr.', birthday: '1980-03-02', postalCode: '1234AB', houseNumber: '10',
        address: 'Teststraat 10', city: 'Teststad', email: 'recipient@example.invalid',
        credentialKey: 'fixture', mandant: 'HMC', sourceSystem: 'subscription-api'
    };
    const payer = { ...recipient, id: 74, personId: '74', firstName: '', initials: 'R.S.', email: 'payer@example.invalid' };
    await page.route('**/api/v1/persons/7*', async route => {
        if (route.request().method() !== 'GET') return route.fallback();
        const id = new URL(route.request().url()).pathname.split('/').at(-1);
        if (!['73', '74'].includes(id)) return route.fallback();
        return route.fulfill({ json: id === '73' ? recipient : payer });
    });
    page.on('pageerror', error => report.errors.push({ scenario: 'role fixture runtime', viewport, kind, message: error.message }));
    try {
        await login(page);
        await page.setViewportSize(viewport);
        await page.waitForFunction(() => window.kiwiSubscriptionRoleRuntime && window.kiwiWerfsleutelSlice);
        await page.evaluate(person => {
            currentCustomer = person;
            window.kiwiWerfsleutelSlice.getSelections = () => [{
                selectedKey: { salesCode: 'THEME-AUDIT-FIXTURE', mandant: 'HMC', divisionId: '14' },
                selectedChannel: 'OL', selectedChannelMeta: { key: 'OL' }
            }];
            window.showNewSubscription();
        }, recipient);
        await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
        const metadata = { state: 'enabled role fixture', viewport, kind, setup: 'Synthetic current customer, local product-selection getter and GET-only detail responses; actual role initialization and rendering remain in use.' };
        check('selected-product fixture enables recipient modes', await page.locator('input[name="recipientMode"]').evaluateAll(inputs => inputs.length === 2 && inputs.every(input => !input.matches(':disabled'))), true, metadata, 2);
        await controlChecks(page, contract, 'selected recipient fixture', '#newSubscriptionForm', kind);
        await capture(page, 'fixture-selected-recipient', '#newSubscriptionForm', kind);
        const samePayer = page.locator('#requesterSameAsRecipient');
        check('same payer checkbox is initially selected', await samePayer.isChecked(), true, metadata, 2);
        await samePayer.press('Space');
        await page.locator('#requesterRolePanel').waitFor({ state: 'visible' });
        await page.evaluate(person => {
            subscriptionRoleState.requester.searchResults = [{ ...person, initials: '' }];
            window.kiwiSubscriptionRoleRuntime.selectSubscriptionRolePerson('requester', person.id);
        }, payer);
        await page.waitForFunction(() => document.getElementById('subRequesterInitials')?.value === 'R.S.');
        check('independent payer mode is enabled', await page.locator('input[name="requesterMode"]').evaluateAll(inputs => inputs.length === 2 && inputs.every(input => !input.matches(':disabled'))), true, metadata, 2);
        await controlChecks(page, contract, 'independent payer fixture', '#newSubscriptionForm', kind);
        await capture(page, 'fixture-independent-payer', '#newSubscriptionForm', kind);
        for (const [role, name, form] of [['recipient', 'recipientMode', 'recipientCreateForm'], ['payer', 'requesterMode', 'requesterCreateForm']]) {
            await page.locator(`input[name="${name}"][value="existing"]`).press('ArrowRight');
            await painted(page);
            check(`${role} native arrow selects create mode`, await page.locator(`input[name="${name}"][value="create"]`).isChecked(), true, metadata, 2);
            await page.locator(`#${form}`).waitFor({ state: 'visible' });
            await controlChecks(page, contract, `${role} create fixture`, '#newSubscriptionForm', kind);
            await capture(page, `fixture-${role}-create`, '#newSubscriptionForm', kind);
        }
    } catch (error) {
        report.errors.push({ scenario: 'enabled role fixture', viewport, kind, message: error.message.slice(0, 1200) });
        await capture(page, 'fixture-role-failure', undefined, kind).catch(() => {});
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

function dismissNativeBrowserPopup() {
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
key = x11.XKeysymToKeycode(display, 0xff1b)
for _ in range(2):
    xtest.XTestFakeKeyEvent(display, key, 1, 0)
    xtest.XTestFakeKeyEvent(display, key, 0, 0)
    x11.XFlush(display)
    time.sleep(0.2)
x11.XCloseDisplay(display)
`;
    execFileSync('python3', ['-'], { input: script, env: launchEnvironment });
}

async function waitForNativeHeaderUncovered(page) {
    const probe = await page.evaluate(() => {
        const header = document.querySelector('.header'), bounds = header.getBoundingClientRect();
        const color = getComputedStyle(header).backgroundColor.match(/[\d.]+/g).map(Number);
        const selectors = ['#agentProfileTrigger', '#contextualFeedbackSettingsButton', '#subscriptionQueueToggle'];
        const points = selectors.map(selector => {
            const control = document.querySelector(selector).getBoundingClientRect();
            const cssPoint = { x: control.x + control.width / 2, y: control.y - 2 };
            const hit = document.elementFromPoint(cssPoint.x, cssPoint.y);
            return { selector, cssPoint, backgroundHit: Boolean(hit?.closest('.header') && !hit.closest('button,a,img,[data-action]')),
                insideHeader: cssPoint.x > bounds.x && cssPoint.x < bounds.right && cssPoint.y > bounds.y && cssPoint.y < bounds.bottom,
                screenPoint: { x: Math.round(screenX + cssPoint.x * devicePixelRatio),
                    y: Math.round(screenY + outerHeight - innerHeight * devicePixelRatio + cssPoint.y * devicePixelRatio) } };
        });
        return { color, points, window: { x: screenX, y: screenY, outerWidth, outerHeight, innerWidth, innerHeight, dpr: devicePixelRatio } };
    });
    const validColor = probe.color.length === 3 || probe.color[3] === 1;
    const validPoints = probe.points.every(point => point.backgroundHit && point.insideHeader
        && point.screenPoint.x > 0 && point.screenPoint.x < 1600 && point.screenPoint.y > 0 && point.screenPoint.y < 1200);
    if (!validColor || !validPoints) throw new Error('Native header requires opaque background and verified free-strip sample points.');
    const frames = [], started = Date.now();
    while (Date.now() - started < 5000) {
        const bytes = execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'x11grab', '-video_size', '1600x1200', '-i', displayName,
            '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'], { env: launchEnvironment, maxBuffer: 8 * 1024 * 1024 });
        const colors = await page.evaluate(async ({ dataUrl, points }) => {
            const image = new Image(); image.src = dataUrl; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            return points.map(point => [...context.getImageData(point.screenPoint.x, point.screenPoint.y, 1, 1).data]);
        }, { dataUrl: 'data:image/png;base64,' + bytes.toString('base64'), points: probe.points });
        const clear = colors.every(color => color[3] === 255 && probe.color.slice(0, 3).every((value, index) => color[index] === value));
        frames.push({ elapsedMs: Date.now() - started, sha256: sha256(bytes), colors, clear });
        for (const name of [frames.length === 1 ? 'native-header-ui-first-frame' : null, clear ? 'native-header-ui-clear-frame' : null].filter(Boolean)) {
            const filename = name + '.png'; await writeFile(path.join(evidenceDir, filename), bytes);
            report.captures.push({ name, filename, viewport: { width: probe.window.innerWidth, height: probe.window.innerHeight },
                kind: 'Actual native OS desktop browser-UI readiness probe; not a workflow acceptance image.',
                captureMethod: 'actual1600x1200 X11desktop via ffmpeg x11grab; canvas only reads original PNG pixels',
                geometry: { viewportWidth: probe.window.innerWidth, viewportHeight: probe.window.innerHeight, devicePixelRatio: probe.window.dpr } });
        }
        if (clear) return { probe, frames, boundary: 'Observed actual free header strip; independent full uncropped visual inspection still required.' };
    }
    throw new Error('Actual native header remains obscured: ' + JSON.stringify({ probe, frames }));
}

async function nativeZoomChecks() {
    const contract = slice >= 2 ? await referenceContract({ width: 1440, height: 1000 }) : null;
    const context = await browser.newContext({
        ...((nativeSubscription || nativeArticle || nativeService || nativeOverlay) ? { serviceWorkers: 'block' } : {}),
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
    const nativeDriver = { baseUrl, sourceRoot, capture, check, evidenceDir, login, newContext, normalizeMappedCssUrls, painted, report, saveReport, trackStylesheets, contract };
    const overlayModule = nativeOverlay ? await import('./compose-smoke-theme-audit-overlays-acceptance.mjs') : null;
    const overlaySession = nativeOverlay ? await overlayModule.prepareNativeOverlay(page, nativeDriver) : null;
    const subscriptionModule = nativeSubscription ? await import('./compose-smoke-theme-audit-subscription.mjs') : null;
    const finishSubscriptionEvidence = nativeSubscription
        ? await subscriptionModule.trackSubscriptionBehavior(page, nativeDriver, { state: 'native subscription window' }) : async () => {};
    const subscriptionFixtures = nativeSubscription ? await subscriptionModule.installSubscriptionFixtures(page, nativeDriver) : null;
    const serviceModule = nativeService ? await import('./compose-smoke-theme-audit-service.mjs') : null;
    if (nativeService) await serviceModule.prepareServiceEvidence(nativeDriver);
    const finishServiceEvidence = nativeService
        ? await serviceModule.trackServiceBehavior(page, nativeDriver, { state: 'native service window' }) : async () => {};
    const serviceFixtures = nativeService ? await serviceModule.installServiceFixtures(page, nativeDriver) : null;
    const articleModule = nativeArticle ? await import('./compose-smoke-theme-audit-article.mjs') : null;
    if (nativeArticle) await articleModule.prepareArticleEvidence(nativeDriver);
    const finishArticleEvidence = nativeArticle
        ? await articleModule.trackArticleBehavior(page, nativeDriver, { state: 'native article window' }) : async () => {};
    const articleFixtures = nativeArticle ? await articleModule.installArticleFixtures(page, nativeDriver) : null;
    const finishAssetEvidence = trackStylesheets(page, 'native window');
    const finishCustomerEvidence = nativeCustomer
        ? await (await import('./compose-smoke-theme-audit-customer.mjs')).trackCustomerBehavior(page, { sourceRoot, baseUrl, check, report }, { state: 'native customer window' })
        : async () => {};
    const finishBehaviorEvidence = slice >= 3
        ? await (await import('./compose-smoke-theme-audit-shell-acceptance.mjs')).trackShellBehaviorAssets(page, { sourceRoot, baseUrl, check, evidenceDir, report }, { state: 'native window' })
        : async () => {};
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
        if (browserName === 'chromium' && slice >= 3) {
            report.nativeBrowserUI = {
                action: 'Two actual XTest Escape inputs at empty OS200% baseline dismiss Translate; actual X11 pixels gate subsequent browser-popup clearance.' };
            const appState = () => page.evaluate(() => ({ profileHidden: document.querySelector('#agentStatusMenu').hidden,
                outboxHidden: document.querySelector('#subscriptionQueuePanel').hidden,
                selectedCustomer: Boolean(window.kiwiCustomerWorkSession?.getRequestContext?.()?.customerReference),
                scrollX, scrollY, width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
            const beforePopup = await appState();
            await capture(page, 'native-popup-before-dismissal', undefined, 'Actual OS200% Chrome browser-popup diagnostic before dismissal; uncropped desktop.');
            dismissNativeBrowserPopup();
            report.nativeBrowserUI.headerReadiness = await waitForNativeHeaderUncovered(page);
            check('native browser UI leaves actual header strip uncovered', true, true, { state: 'native browser UI', evidence: report.nativeBrowserUI.headerReadiness });
            await capture(page, 'native-popup-after-dismissal', undefined, 'Actual OS200% Chrome browser-popup diagnostic after real XTest Escape; uncropped desktop.');
            const afterPopup = await appState();
            report.nativeBrowserUI.applicationBefore = beforePopup;
            report.nativeBrowserUI.applicationAfter = afterPopup;
            report.nativeBrowserUI.scope = 'Browser UI preparation before the complete native200% application suite; uncropped visual review remains required.';
            check('actual browser-popup dismissal retains empty application state', JSON.stringify(afterPopup), JSON.stringify(beforePopup), { state: 'native browser UI' });
        }
        if (nativeOverlay) {
            await overlayModule.inspectNativeOverlay(page, nativeDriver, overlaySession, { viewport: { width: zoomed.innerWidth, height: zoomed.innerHeight }, native: true, locale: 'nl', phase: 'after' });
            sendNativeZoomKey(true);
            const reset = await geometry();
            check('native overlay zoom reset restored 100%', Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3, true, { before, reset });
            await capture(page, 'native-overlay-100-reset', undefined, 'Actual OS100percent reset after focused overlay native200percent; uncropped desktop.');
            return;
        }
        if (nativeService) {
            const meta = { viewport: { width: zoomed.innerWidth, height: zoomed.innerHeight }, locale: 'nl', phase: 'after', native: true };
            await serviceModule.runServiceScenarios(page, nativeDriver, meta, serviceFixtures);
            sendNativeZoomKey(true);
            const reset = await geometry();
            check('native service zoom reset restored 100%', Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3, true, { before, reset });
            await capture(page, 'native-service-100-reset', undefined, 'Actual OS100% reset after focused service native200% family/choice layout; uncropped desktop.');
            return;
        }
        if (nativeArticle) {
            const meta = { viewport: { width: zoomed.innerWidth, height: zoomed.innerHeight }, locale: 'nl', phase: 'after', suite: 'focused', native: true };
            await articleModule.runArticleScenarios(page, nativeDriver, meta, articleFixtures);
            await (await import('./compose-smoke-theme-audit-article-acceptance.mjs')).inspectArticleSharedSentinel(page, nativeDriver, meta);
            sendNativeZoomKey(true);
            const reset = await geometry();
            check('native article zoom reset restored 100%', Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3, true, { before, reset });
            await capture(page, 'native-article-100-reset', undefined, 'Actual OS100% reset after the focused article native200% suite; uncropped X11 desktop.');
            return;
        }
        if (nativeSubscription) {
            const meta = { viewport: { width: zoomed.innerWidth, height: zoomed.innerHeight }, locale: 'nl', native: true, sentinel: false };
            await subscriptionModule.runSubscriptionScenarios(page, nativeDriver, meta, subscriptionFixtures);
            sendNativeZoomKey(true);
            const reset = await geometry();
            check('native subscription zoom reset restored 100%', Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3, true, { before, reset });
            await capture(page, 'native-subscription-100-reset', undefined, 'Actual OS100% reset after focused subscription native200% suite; uncropped desktop.');
            return;
        }
        if (nativeCustomer) {
            const { installCustomerFixtures, runCustomerScenarios, inspectCustomerShellSentinel } = await import('./compose-smoke-theme-audit-customer.mjs');
            const driver = { baseUrl, sourceRoot, capture, check, compositedTextContrast, evidenceDir, login, newContext, painted, report, saveReport, trackStylesheets, contract };
            const fixtures = await installCustomerFixtures(page, driver);
            const meta = { viewport: { width: zoomed.innerWidth, height: zoomed.innerHeight }, locale: 'nl', native: true, compact: true,
                prefix: 'native-200-customer-', kind: 'Actual OS200% customer flow; uncropped X11 desktop. Controlled component fixtures remain separately labeled.' };
            await runCustomerScenarios(page, driver, meta, fixtures);
            await inspectCustomerShellSentinel(page, driver, meta);
            sendNativeZoomKey(true);
            const reset = await geometry();
            check('native customer zoom reset restored 100%', Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3, true, { before, reset });
            await capture(page, 'native-customer-100-reset', undefined, 'Actual OS100% reset after focused customer native200% suite; uncropped desktop.');
            return;
        }
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
        if (slice >= 2) {
            await controlChecks(page, contract, 'native 200% subscription', '#newSubscriptionForm', 'actual native-zoomed application; keyboard traversal', { inspectHover: false });
            await paymentChecks(page, contract, { rootSelector: '#newSubscriptionForm', state: 'native-200-subscription', firstId: 'subPaymentAuto', secondId: 'subPaymentInstruction', ibanId: 'subIBAN', keyboardOnly: true });
            await consentStateChecks(page, contract, '#newSubscriptionForm', 'native-200-subscription');
        }
        await page.locator('#subStartDate').scrollIntoViewIfNeeded();
        await capture(page, 'native-200-payment-consent');
        await page.locator('#newSubscriptionForm [data-action="close-form"]').first().press('Enter');
        if (slice >= 2) {
            await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
            await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
            await controlChecks(page, contract, 'native 200% article', '#articleSaleForm', 'actual native-zoomed application; keyboard traversal', { inspectHover: false });
            await paymentChecks(page, contract, { rootSelector: '#articleSaleForm', state: 'native-200-article', firstId: 'articlePaymentIdeal', secondId: 'articlePaymentTransfer', keyboardOnly: true });
            await page.locator('#articleSaleForm [data-action="close-article-sale-form"]').first().press('Enter');
        }
        await page.locator('#contextualFeedbackSettingsButton').press('Enter');
        await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' });
        await capture(page, 'native-200-settings');
        if (slice >= 2) await controlChecks(page, contract, 'native 200% feedback settings', '.contextual-feedback-settings-modal', 'actual native-zoomed application; keyboard traversal', { inspectHover: false });
        await page.locator('[data-feedback-settings-close]').first().press('Enter');
        if (slice >= 3) {
            const { inspectNativeShell } = await import('./compose-smoke-theme-audit-shell-acceptance.mjs');
            await inspectNativeShell(page, { capture, check, controlChecks, evidenceDir, painted, report }, contract);
        }
        sendNativeZoomKey(true);
        const reset = await geometry();
        check('native zoom reset restored 100%', Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3, true, { state: 'native zoom reset', before, reset });
    } finally {
        sendNativeZoomKey(true);
        if (nativeOverlay) await overlaySession.finish();
        if (nativeSubscription) subscriptionModule.releaseSubscriptionFixtures(subscriptionFixtures);
        if (nativeArticle) articleModule.releaseArticleFixtures(articleFixtures);
        if (nativeService) serviceModule.releaseServiceFixtures(serviceFixtures);
        await finishServiceEvidence();
        await finishArticleEvidence();
        await finishSubscriptionEvidence();
        await finishCustomerEvidence();
        await finishBehaviorEvidence();
        await finishAssetEvidence();
        await context.close();
    }
}

try {
    if (!nativeZoomOnly) {
        for (const viewport of viewports) {
            const contract = await referenceContract(viewport);
            if (overlayOnly) {
                const { inspectOverlays } = await import('./compose-smoke-theme-audit-overlays.mjs');
                await inspectOverlays({ baseUrl, sourceRoot, capture, check, evidenceDir, login, newContext, normalizeMappedCssUrls, painted, report, saveReport, trackStylesheets }, viewport, contract);
            } else if (serviceOnly) {
                const { inspectService } = await import('./compose-smoke-theme-audit-service.mjs');
                await inspectService({ baseUrl, sourceRoot, capture, check, evidenceDir, login, newContext, painted, report, saveReport, trackStylesheets }, viewport, contract);
            } else if (articleOnly) {
                const { inspectArticle } = await import('./compose-smoke-theme-audit-article.mjs');
                await inspectArticle({ baseUrl, sourceRoot, capture, check, evidenceDir, login, newContext, painted, report, saveReport, trackStylesheets }, viewport, contract);
            } else if (shellOnly) {
                const { inspectShell } = await import('./compose-smoke-theme-audit-shell.mjs');
                await inspectShell({ baseUrl, sourceRoot, capture, check, controlChecks, evidenceDir, login, newContext, painted, report, saveReport, trackStylesheets }, viewport, contract);
            } else if (subscriptionOnly) {
                const { inspectSubscription } = await import('./compose-smoke-theme-audit-subscription.mjs');
                await inspectSubscription({ baseUrl, sourceRoot, capture, check, evidenceDir, login, newContext, painted, report, saveReport, trackStylesheets }, viewport, contract);
            } else if (customerOnly) {
                const { inspectCustomer } = await import('./compose-smoke-theme-audit-customer.mjs');
                await inspectCustomer({ baseUrl, sourceRoot, capture, check, compositedTextContrast, evidenceDir, login, newContext, painted, report, saveReport, trackStylesheets }, viewport, contract);
            } else if (controlsOnly) {
                const { inspectControls } = await import('./compose-smoke-theme-audit-controls.mjs');
                await inspectControls({
                    actionChecks, baseUrl, capture, check, compositedTextContrast, controlChecks, evidenceDir,
                    keyboardFocus, login, newContext, painted, paymentChecks, choiceStyleChecks, consentStateChecks, referenceUrl: pathToFileURL(referencePath).href, report, saveReport, trackStylesheets, unverified
                }, viewport, contract);
            } else {
                await inspectApplication(viewport, contract);
                await inspectEnabledRoleFixture(viewport, contract);
            }
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
    if (!report.checks.length || !report.captures.some(capture => capture.kind.toLowerCase().includes('actual'))) {
        report.errors.push({ scenario: 'runner coverage', message: 'Unexpected empty run: checks and actual application captures are mandatory.' });
    }
    report.environment.capturedViewports = [...new Map(report.captures.map(capture => [JSON.stringify(capture.viewport), capture.viewport])).values()];
    report.summary = {
        verified: report.checks.filter(check => check.status === 'verified').length,
        deviations: report.checks.filter(check => check.status === 'deviation').length,
        deferred: report.checks.filter(check => check.status === 'deferred').length,
        unverified: report.checks.filter(check => check.status === 'unverified').length,
        errors: report.errors.length, blockedWrites: report.blockedWrites.length,
        captures: report.captures.length,
        acceptance: (overlayOnly && overlayPhase === 'before') || (serviceOnly && servicePhase === 'before') || (articleOnly && articlePhase === 'before') || (subscriptionOnly && subscriptionPhase === 'before') || (customerOnly && customerPhase === 'before') || (shellOnly && shellPhase === 'before')
            ? 'Observational BEFORE capture: locale/provenance counters do not accept recorded visual/keyboard defects.'
            : 'Required gates plus independent visual review remain necessary; a successful run is not complete slice 10 acceptance.'
    };
    await saveReport();
    await browser.close();
    displayProcess?.kill('SIGTERM');
    console.log(`[theme_audit] ${browserName} slice ${slice}: ${JSON.stringify(report.summary)}`);
    if (report.summary.deviations || report.summary.unverified || report.summary.errors || report.summary.blockedWrites) process.exitCode = 1;
}
