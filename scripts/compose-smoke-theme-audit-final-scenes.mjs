import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { finalAuditAreas, finalNativeDateFocusBinding } from './compose-smoke-theme-audit-final.mjs';
import { privacy09CalendarQuery, createPrivacy09Calendar, createPrivacy09Fixture } from './compose-smoke-theme-audit-operational-privacy.mjs';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';

// theme_audit: artifact candidate. This module never launches a browser, changes an app,
// accepts images or supplies a fictitious release. The reviewed driver owns those boundaries.
const originalReferenceSha256 = '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4';
const refinedReferenceSha256 = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const sdkSha256 = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';
const sdkUrl = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm';
const phases = ['SHELL', 'CUSTOMER', 'SUBSCRIPTION', 'ARTICLE', 'SERVICE', 'OVERLAY', 'OPERATIONAL'];
const cssNames = ['styles.css', 'article-search.css', 'delivery-date-picker.css', 'contextual-feedback.css', 'session-outbox.css'];
const nativeAreas = {
    'shell-search-customer-history': ['A01', 'A02', 'A03', 'A10'],
    'subscription-service-native-date': ['A05', 'A06'],
    'article-cart-custom-calendar': ['A07'],
    'active-call-to-acw-disposition': ['A09'],
    'outbox-feedback-image-system': ['A11', 'A12', 'A13']
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateFinalSceneInputs(release, verification, env = process.env) {
    assert.equal(release?.marker, 'theme_audit');
    assert.equal(release.slice, 10); assert.equal(release.phase, 'after');
    assert.equal(release.slice09?.status, 'accepted'); assert.equal(release.slice09.phase, 'after'); assert.equal(release.icons?.status, 'accepted');
    assert.equal(release.operationalAfter?.phase, 'after');
    assert.equal(release.operationalAfter.sourceCommit, release.source.commit);
    assert.equal(verification?.sourceCommit, release.source.commit);
    assert.ok(verification.productionFiles > 0 && verification.helperFiles > 0);
    for (const family of phases) assert.equal(env[`KIWI_THEME_AUDIT_${family}_PHASE`], 'after', `${family}: set AFTER before importing helpers.`);
    assert.notEqual(env.KIWI_THEME_AUDIT_FINAL_SOURCE, '1', 'The bounded legacy bridge is a separate mode.');
    assert.equal(release.sdk?.sha256, sdkSha256);
    assert.equal(release.reference?.original.sha256, originalReferenceSha256);
    assert.equal(release.reference?.refined.sha256, refinedReferenceSha256);
    assert.equal(release.accountPages?.path, 'scripts/theme-audit-icon-accounts.mjs');
    assert.match(release.accountPages.sha256, /^[a-f0-9]{64}$/);
    assert.ok(release.fixtures?.serviceAck?.path, 'A source-bound service acknowledgement fixture artifact is required.');
    assert.ok(release.ownerVerification?.path, 'Root must supply an actual complete owner-verification artifact.');
}

async function physicalArtifact(item, label) {
    assert.ok(item && path.isAbsolute(item.path) && path.normalize(item.path) === item.path, `${label}: canonical absolute path required.`);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    let current = path.parse(item.path).root;
    for (const segment of item.path.slice(current.length).split('/')) {
        current = path.join(current, segment);
        assert.equal((await lstat(current)).isSymbolicLink(), false, `${label}: symlink rejected.`);
    }
    assert.equal((await lstat(item.path)).isFile(), true);
    const bytes = await readFile(item.path); assert.equal(hash(bytes), item.sha256, `${label}: bytes differ.`);
    return bytes;
}

export function validateOwnerVerification(proof, release, releaseId) {
    assert.equal(proof.marker, 'theme_audit'); assert.equal(proof.status, 'verified');
    assert.equal(proof.kind, 'owner-verified-final-environment');
    assert.equal(proof.releaseId, releaseId); assert.equal(proof.sourceCommit, release.source.commit);
    assert.ok(typeof proof.reviewer === 'string' && proof.reviewer.trim());
    const nativeDateFocus = finalNativeDateFocusBinding(release);
    const expected = {
        ...(nativeDateFocus ? { nativeDateFocus } : {}),
        source: release.source.manifest.sha256, runtime: release.source.runtime.sha256,
        helpers: release.source.helpers.sha256, accepted09: release.slice09.evidence.sha256,
        accepted155: release.icons.evidence.sha256, operationalAfter: release.operationalAfter.evidence.sha256,
        sdk: release.sdk.sha256, originalReference: release.reference.original.sha256,
        refinedReference: release.reference.refined.sha256, fixtures: { serviceAck: release.fixtures.serviceAck.sha256 }, accountsHelper: release.accountPages.sha256
    };
    assert.deepEqual(proof.bindings, expected, 'Owner verification must bind every source, helper and accepted lineage input.');
    assert.equal(proof.effectiveConfiguration?.status, 'verified');
    assert.equal(proof.effectiveConfiguration.sourceCommit, release.source.commit);
    assert.ok(proof.effectiveConfiguration.artifact?.path);
    assert.equal(proof.health?.status, 'healthy'); assert.equal(proof.health.httpStatus, 200);
    assert.equal(proof.health.runtimeProofSha256, release.source.runtime.sha256);
    assert.ok(proof.health.project && proof.health.baseUrl && proof.health.observedUtc);
    return expected;
}

// Existing transports register handlers into this collector. There is one actual context
// route, one selected owner and no API continue/fallthrough. In particular overlays never
// receive outbox reads and cannot replace an active operational scene with an empty list.
export function selectFinalRequestOwner(url, baseUrl, family, { overlay = false, records = false, privateError = false } = {}) {
    if (url.username || url.password || url.pathname.includes('%')) return null;
    if (url.href === sdkUrl) return 'operational';
    if (url.origin !== baseUrl.origin) return null;
    const api = new URL('api/v1/', baseUrl).pathname;
    const otherApi = ['/kiwi/api', '/kiwi-preview/api'].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'));
    if (!url.pathname.startsWith(api)) return otherApi ? null : 'operational';
    const suffix = url.pathname.slice(api.length);
    if (privateError && suffix === 'persons/990801/editorial-complaints') return 'private-overlay';
    if (overlay && ['development-feedback', 'development-feedback/settings'].includes(suffix)) return 'overlays';
    if (suffix === 'catalog/delivery-calendar') return family === 'article' ? 'article' : 'public-calendar';
    if (suffix.startsWith('catalog/')) return family === 'article' ? 'article' : null;
    if (suffix.startsWith('addresses/')) return ['subscription', 'service', 'customer'].includes(family) ? family : null;
    if (suffix.startsWith('persons')) {
        if (records) return 'operational';
        return ['subscription', 'service', 'customer'].includes(family) ? family : 'operational';
    }
    if (suffix.startsWith('webabo/')) return ['subscription', 'service'].includes(family) ? family : 'operational';
    if (suffix === 'order/quote' || suffix === 'catalog/article-order-quote' || suffix.startsWith('orders/')) return family === 'article' ? 'article' : null;
    if (family === 'service' && (suffix.startsWith('subscriptions/') || suffix === 'customer-work-sessions/reset')) return 'service';
    return 'operational';
}

export function createFinalTransport(baseUrl, family, report, options = {}) {
    const handlers = new Map(); let closed = false;
    if (options.calendarSourceRoot) {
        let calendarReads = 0;
        const calendar = new URL('api/v1/catalog/delivery-calendar', baseUrl);
        handlers.set('public-calendar', [async route => {
            const request = route.request(), url = new URL(request.url());
            const exactLocation = url.origin === calendar.origin && url.pathname === calendar.pathname
                && !url.username && !url.password && !url.hash;
            const query = exactLocation && request.method() === 'GET'
                ? privacy09CalendarQuery(url, new URL('api/v1/', baseUrl).pathname) : null;
            if (!query || calendarReads >= 4) {
                report.deniedRequests.push({ method: request.method(), pathname: url.pathname, reason: 'Unexpected final public calendar method/query/count.' });
                return route.abort('blockedbyclient');
            }
            calendarReads++;
            report.publicCalendarReads ||= [];
            report.publicCalendarReads.push({ method: 'GET', ...query, sourceGenerated: true, locallyFulfilled: true });
            return route.fulfill({ json: createPrivacy09Calendar(options.calendarSourceRoot, query) });
        }]);
    }
    function collect(target, owner) {
        return new Proxy(target, { get(object, name) {
            if (name === 'route') return async (pattern, handler) => {
                assert.equal(pattern, '**/*', 'Only the existing exact dispatch handler may register.');
                if (!handlers.has(owner)) handlers.set(owner, []);
                handlers.get(owner).unshift(handler);
            };
            const member = Reflect.get(object, name); return typeof member === 'function' ? member.bind(object) : member;
        } });
    }
    async function dispatch(route) {
        const request = route.request(), url = new URL(request.url());
        const selectedFamily = typeof family === 'function' ? family() : family;
        const current = { ...options, records: typeof options.records === 'function' ? options.records() : options.records,
            privateError: typeof options.privateError === 'function' ? options.privateError() : options.privateError };
        const owner = selectFinalRequestOwner(url, baseUrl, selectedFamily, current);
        const deny = async reason => {
            report.deniedRequests.push({ method: request.method(), pathname: url.pathname, reason });
            await route.abort('blockedbyclient');
        };
        if (closed) return deny('Request after final session cleanup.');
        if (!owner || !handlers.has(owner)) return deny('No declared final request owner.');
        const api = ['/kiwi/api', '/kiwi-preview/api'].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'));
        let settled = false;
        async function invoke(index) {
        const handler = handlers.get(owner)[index];
        if (!handler) { settled = true; return api ? deny('Elected API owner has no matching local response.') : route.continue(); }
        const view = new Proxy(route, { get(object, name) {
            if (name === 'fallback') return async (...args) => {
                assert.equal(settled, false, 'A request cannot settle twice.');
                assert.equal(args.length, 0, 'Existing local fixture fallthrough must preserve the original request.');
                return invoke(index + 1);
            };
            if (name === 'continue') return async (...args) => {
                assert.equal(settled, false, 'A request cannot settle twice.'); settled = true;
                if (api) return deny('API continue rejected; only a declared local response may settle it.');
                return route.continue(...args);
            };
            if (name === 'fulfill' || name === 'abort') return async (...args) => {
                assert.equal(settled, false, 'A request cannot settle twice.'); settled = true;
                return object[name](...args);
            };
            const member = Reflect.get(object, name); return typeof member === 'function' ? member.bind(object) : member;
        } });
        await handler(view);
        }
        await invoke(0);
        assert.equal(settled, true, 'The elected request owner did not settle its request.');
    }
    return { collect, dispatch, close() { closed = true; }, owners() { return [...handlers.keys()]; } };
}

export function serverRoleEvidence(html, requestedRole, homeStatus) {
    const roles = [...html.matchAll(/<div\s+class="profile-menu-role"[^>]*>([^<]*)<\/div>/g)].map(match => match[1].trim());
    const expected = { 'kiwi-admin': 'KIWI admin', 'kiwi-view': 'KIWI view' }[requestedRole];
    assert.ok(expected, 'Only an actually implemented native role login may produce a session proof.');
    assert.equal(homeStatus, 200); assert.deepEqual(roles, [expected], 'Actual server document role differs from requested account.');
    return { kind: 'actual-oidc-server-render', requestedRole, roles, homeStatus, serverHtmlSha256: hash(html),
        settingsPresent: html.includes('id="contextualFeedbackSettingsButton"'), fixtureCapabilityIsRoleProof: false };
}

async function writeArtifact(filename, value) {
    await mkdir(path.dirname(filename), { recursive: true });
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); await writeFile(filename, bytes);
    return { path: filename, sha256: hash(bytes) };
}

export function finalScenePlan(descriptor, browserName) {
    assert.ok(['chromium', 'firefox'].includes(browserName), 'A concrete browser must own the session.');
    let areaId = null, nativeGroup = null;
    if (descriptor.native === true) {
        assert.ok(Object.hasOwn(nativeAreas, descriptor.id), 'Only a canonical native group may prepare a native page.');
        nativeGroup = descriptor.id;
        assert.equal(descriptor.areaId, undefined, 'A native group is distinct from a baseline area.');
    } else {
        assert.equal(descriptor.native, false);
        const parts = /^(A\d{2})\/(chromium|firefox)\/(1440|390|320)x1000$/.exec(descriptor.id);
        assert.ok(parts && finalAuditAreas.some(area => area.id === parts[1]), 'Use the full canonical baseline cell ID.');
        areaId = parts[1];
        assert.equal(parts[2], browserName, 'Cell browser and actual driver differ.');
        assert.deepEqual(descriptor.viewport, { width: Number(parts[3]), height: 1000 }, 'Cell ID and requested viewport differ.');
        if (descriptor.areaId !== undefined) assert.equal(descriptor.areaId, areaId, 'Explicit area must match the canonical cell.');
    }
    const key = areaId || nativeGroup, family = familyFor(key);
    const requiredFamilies = new Set([family]);
    for (const area of nativeAreas[nativeGroup] || []) requiredFamilies.add(familyFor(area));
    if (areaId === 'A08') requiredFamilies.add('article');
    return { areaId, nativeGroup, family, requiredFamilies: [...requiredFamilies],
        records: ['A03', 'A04'].includes(areaId), overlay: ['A12', 'A13'].includes(areaId) || nativeGroup === 'outbox-feedback-image-system' };
}

function familyFor(id) {
    if (['A04', 'A05', 'A08', 'subscription-service-native-date'].includes(id)) return 'subscription';
    if (['A07', 'article-cart-custom-calendar'].includes(id)) return 'article';
    if (id === 'A06') return 'service';
    if (['A01', 'A02', 'shell-search-customer-history'].includes(id)) return 'customer';
    return 'operational';
}

async function loadHelpers() {
    const names = {
        shell: 'shell-acceptance', customer: 'customer', customerAcceptance: 'customer-acceptance',
        subscription: 'subscription', subscriptionAcceptance: 'subscription-acceptance',
        article: 'article', articleAcceptance: 'article-acceptance', service: 'service',
        operational: 'operational', feedback: 'operational-feedback',
        overlays: 'overlays-acceptance'
    };
    const loaded = {};
    for (const [key, suffix] of Object.entries(names)) loaded[key] = await import(`./compose-smoke-theme-audit-${suffix}.mjs`);
    loaded.accounts = await import('./theme-audit-icon-accounts.mjs');
    return loaded;
}

function scopedDriver(driver, descriptor, directory) {
    const report = { marker: 'theme_audit', phase: 'after', slice: 10,
        application: { commit: null }, environment: {}, evidenceDir: directory, checks: [], captures: [], observations: [],
        errors: [], blockedWrites: [], deniedRequests: [], sourceErrors: [], servedSources: [], sdkReads: [],
        localCallWrites: [], authentications: [], authDiagnostics: [], authLifecycle: [], outboxReads: [],
        settingsFixtures: [], readonlySourceReads: [], recordMutations: [], highlightTones: [] };
    const prefix = descriptor.id.replaceAll('/', '-') + '-';
    const child = { ...driver, report, evidenceDir: directory };
    child.check = (name, actual, expected, meta = {}, minimum = 1) => {
        driver.check(prefix + name, actual, expected, meta, minimum);
        assert.deepEqual(actual, expected, name);
        report.checks.push({ name, actual, expected, ...meta, passed: true });
    };
    child.capture = async (page, name, selector, kind) => {
        await driver.capture(page, prefix + name, selector, kind);
        const entry = driver.report.captures.at(-1); assert.ok(entry?.filename);
        const absolute = path.join(driver.evidenceDir, entry.filename);
        const local = path.join(directory, entry.filename); await copyFile(absolute, local);
        report.captures.push({ ...entry, absolute: local });
        return local;
    };
    child.saveReport = () => writeArtifact(path.join(directory, 'report.json'), report);
    return child;
}

async function registerFinalOverlays(handle) {
    const { child, release, verification } = handle;
    assert.equal(handle.ownerVerified, true, 'Explicit final registration requires the owner-verified release.');
    assert.equal(verification.sourceCommit, release.source.commit);
    assert.equal(child.report.overlayAcceptance, undefined, 'Never preseed or reuse historical overlay registration.');
    child.report.overlayEvidence = { phase: 'after', observations: [], fixtureRequests: [], loadedBehavior: [] };
    child.report.overlayAcceptance = { registration: 'explicit-final10-successor', sourceCommit: release.source.commit,
        sourceProof: release.source.manifest, operationalAfter: release.operationalAfter,
        boundary: 'Only exported page scenes run here. Original slice08 register and all its source gates are unchanged.',
        states: [], interactions: [], privacy: [] };
}

export function trackFinalServedSources(handle, { requiredPaths = null, artifactName = 'served-source.json' } = {}) {
    const { page, driver, child, source, release } = handle;
    const assets = source.source.filter(entry => /\.(css|js)$/.test(entry.path));
    const bodies = handle.sourceBodies;
    assert.ok(bodies instanceof Map, 'Read frozen source bodies before navigation or account track registration.');
    const pending = [], seen = new Set(); let snapshotNumber = 0;
    const callback = response => {
        const url = new URL(response.url());
        if (url.origin !== driver.baseUrl.origin) return;
        const entry = assets.find(item => {
            const expected = new URL(item.path, driver.baseUrl);
            const escaped = path.posix.basename(expected.pathname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = escaped.replace(/\\\.(css|js)$/, '(?:-[\\w-]{7})?\\.$1');
            return path.posix.dirname(url.pathname) === path.posix.dirname(expected.pathname)
                && new RegExp('^' + pattern + '$').test(path.posix.basename(url.pathname));
        });
        if (!entry) return;
        if (url.search || url.hash) { child.report.sourceErrors.push({ path: entry.path, message: 'Mapped final asset query/fragment was not declared.' }); return; }
        pending.push((async () => {
            const buffer = await response.body(), original = bodies.get(entry.path);
            const normalize = entry.path.endsWith('.js')
                ? value => normalizeKnownJsImports(value, original, new URL(entry.path, driver.baseUrl))
                : value => driver.normalizeMappedCssUrls(value, original);
            assert.equal(hash(normalize(buffer.toString('utf8'))), hash(normalize(original)), 'Served final body differs: ' + entry.path);
            seen.add(entry.path); child.report.servedSources.push({ path: entry.path, servedSha256: hash(buffer), sourceSha256: entry.sha256 });
        })().catch(error => child.report.sourceErrors.push({ path: entry.path, message: error.message })));
    };
    page.on('response', callback);
    handle.cleanup.push(() => page.off('response', callback));
    return async () => {
        await Promise.all(pending); assert.deepEqual(child.report.sourceErrors, []);
        const required = requiredPaths || [...cssNames.map(name => 'assets/css/' + name),
            ...(source.source.some(entry => entry.path === 'assets/js/app/interface-icons.js') ? ['assets/js/app/interface-icons.js'] : [])];
        for (const relative of required) assert.ok(seen.has(relative), 'Missing actual served source: ' + relative);
        const filename = snapshotNumber++ === 0 ? artifactName : `settled-${snapshotNumber}-${artifactName}`;
        return writeArtifact(path.join(child.evidenceDir, filename), { marker: 'theme_audit', sourceCommit: release.source.commit,
            runtimeProof: release.source.runtime, responses: child.report.servedSources, missing: [], errors: [] });
    };
}

async function prepareOwnedSession({ page, context, descriptor, driver, release }, owner, helpers, verification) {
    assert.equal(page.url(), 'about:blank');
    const plan = finalScenePlan(descriptor, driver.browserName);
    assert.equal(owner.proof.health.baseUrl, driver.baseUrl.href);
    assert.equal(owner.source.head, release.source.commit);
    assert.equal(owner.source.worktree, driver.sourceRoot);
    assert.equal(owner.source.referenceSha256, refinedReferenceSha256);
    const evidenceRoot = path.resolve(driver.sourceRoot, '..', '.kiwi-theme-audit/evidence') + path.sep;
    assert.ok(path.resolve(driver.evidenceDir).startsWith(evidenceRoot), 'Final screenshots belong in durable evidence outside Git.');
    const directory = path.join(driver.evidenceDir, 'final-scenes', descriptor.id.replaceAll('/', '-'));
    await mkdir(directory, { recursive: true });
    const child = scopedDriver(driver, descriptor, directory);
    child.report.application.commit = release.source.commit;
    const handle = { page, context, descriptor, areaId: plan.areaId, nativeGroup: plan.nativeGroup, driver, child, release, verification, helpers, ownerVerified: true,
        cleanup: [], observations: [], reusedEvidence: [], home: null, closed: false, source: owner.source, legacyFocusSource: owner.legacyFocusSource };
    handle.sourceBodies = new Map(await Promise.all(owner.source.source.filter(entry => /\.(css|js)$/.test(entry.path))
        .map(async entry => [entry.path, await readFile(path.join(driver.sourceRoot, entry.path), 'utf8')])));
    const { family, records, overlay } = plan;
    const state = handle.state = { phase: 'after', suite: records ? (plan.areaId === 'A03' ? 'records-after-component' : 'records-after') : 'feedback',
        sourceRoot: driver.sourceRoot, baseUrl: driver.baseUrl, api: new URL('api/v1/', driver.baseUrl).pathname,
        viewport: descriptor.viewport, evidenceDir: directory, sdkBytes: owner.sdk, report: child.report,
        referenceContract: child.contract, checkAfterObservation: helpers.feedback.checkAfterObservation };
    if (descriptor.role === 'kiwi-view') { state.suite = 'actual-view'; child.report.requestedSuite = 'input-gates'; }
    assert.ok(['kiwi-admin', 'kiwi-view'].includes(descriptor.role), 'Unsupported final login role must not be simulated.');
    state.feedbackFixtures = helpers.feedback.readonlySourceFixtures();
    const nativeRecordGroup = plan.nativeGroup === 'shell-search-customer-history';
    const componentRecords = plan.areaId === 'A03' || nativeRecordGroup;
    if (records || nativeRecordGroup) state.recordFixture = helpers.feedback.recordListAfterFixture(driver.sourceRoot, 2, componentRecords);
    handle.activeFamily = family; handle.recordMode = records;
    const requiredFamilies = new Set(plan.requiredFamilies);
    const transport = handle.transport = createFinalTransport(driver.baseUrl, () => handle.activeFamily, child.report, { calendarSourceRoot: driver.sourceRoot, overlay, records: () => handle.recordMode, privateError: () => handle.privateError === true });
    try {
        handle.control = await helpers.operational.installOperationalTransport(transport.collect(context, 'operational'), state);
        handle.cleanup.push(() => { handle.control.releaseRecordMutation(); handle.control.release(); });
        if (requiredFamilies.has('customer')) {
            handle.finishCustomerSources = await helpers.customer.trackCustomerBehavior(page, child, { viewport: descriptor.viewport });
            handle.customer = await helpers.customer.installCustomerFixtures(transport.collect(page, 'customer'), child);
            if (nativeRecordGroup) {
                const customer = state.recordFixture.customer;
                handle.customer.subscriptionSummary = { ...createPrivacy09Fixture(driver.sourceRoot).summary,
                    personId: customer.personId, credentialKey: customer.credentialKey };
            }
        }
        if (requiredFamilies.has('subscription')) {
            handle.subscription = await helpers.subscription.installSubscriptionFixtures(transport.collect(page, 'subscription'), child);
            handle.cleanup.push(() => helpers.subscription.releaseSubscriptionFixtures(handle.subscription));
        }
        if (requiredFamilies.has('article')) {
            await helpers.article.prepareArticleEvidence(child);
            handle.article = await helpers.article.installArticleFixtures(transport.collect(page, 'article'), child);
            handle.cleanup.push(() => helpers.article.releaseArticleFixtures(handle.article));
        }
        if (requiredFamilies.has('service')) {
            await helpers.service.prepareServiceEvidence(child);
            handle.service = await helpers.service.installServiceFixtures(transport.collect(page, 'service'), child);
            handle.cleanup.push(() => helpers.service.releaseServiceFixtures(handle.service));
        }
        if (overlay) {
            await registerFinalOverlays(handle);
            handle.overlay = await helpers.overlays.installOverlayTransport(transport.collect(page, 'overlays'), child, 'focused');
            handle.cleanup.push(() => handle.overlay.release());
            handle.privateOverlay = await helpers.overlays.installOverlayTransport(transport.collect(page, 'private-overlay'), child, 'private-error');
            handle.cleanup.push(() => handle.privateOverlay.release());
        }
        await context.route('**/*', transport.dispatch);
        handle.cleanup.push(() => context.unroute('**/*', transport.dispatch));
        handle.finishSources = await trackFinalServedSources(handle);
        handle.homeReads = [];
        const home = response => {
            handle.homeReads.push((async () => {
            if (response.request().method() === 'GET' && response.url() === driver.baseUrl.href && response.status() === 200) {
                handle.home = { status: response.status(), html: await response.text() };
            }
            })().catch(error => child.report.sourceErrors.push({ phase: 'actual server document', message: error.message })));
        };
        page.on('response', home); handle.cleanup.push(() => page.off('response', home));
        const runtimeError = error => child.report.errors.push({ kind: 'actual browser runtime', message: error.message.slice(0, 500) });
        page.on('pageerror', runtimeError); handle.cleanup.push(() => page.off('pageerror', runtimeError));
        return handle;
    } catch (error) { await finishFinalSceneSession(handle); throw error; }
}

export async function finishFinalSceneSession(handle) {
    if (!handle?.cleanup || handle.closed) return;
    const errors = [];
    try {
        if (handle.sessionVerified) handle.child.report.finalServedProof = await handle.finishSources();
        if (handle.nativeResetPending) {
            assert.equal(handle.page.isClosed(), false, 'Native task cannot disappear before100reset verification.');
            const reset = await handle.page.evaluate(nativeTaskIdentity, 'verify');
            handle.child.check('Native100reset preserves actual task drafts and server role identity', reset.equal, true, metaFor(handle), 10);
            handle.child.check('Native100reset returns to initial authenticated geometry', reset.dpr === 1
                && reset.width === handle.initialEnvironment.width && reset.height === handle.initialEnvironment.height && reset.pinch === 1, true, metaFor(handle), 10);
            handle.child.report.nativeResetIdentity = { ...reset, boundary: 'Snapshot stays only inside browser; report exposes equality and geometry, not private values.' };
        }
    } catch (error) { errors.push(error); }
    handle.closed = true; handle.transport?.close();
    for (const release of [() => handle.control?.releaseRecordMutation(), () => handle.control?.release(),
        () => handle.overlay?.release(), () => handle.privateOverlay?.release()]) {
        try { release(); } catch (error) { errors.push(error); }
    }
    try { if (handle.page && !handle.page.isClosed()) await handle.page.close(); }
    catch (error) { errors.push(error); }
    for (const cleanup of handle.cleanup.splice(0).reverse()) {
        try { await cleanup(); } catch (error) { errors.push(error); }
    }
    const report = handle.child?.report;
    if (report && (report.deniedRequests.length || report.errors.length || report.sourceErrors.length)) {
        errors.push(new Error('Unexpected source/runtime/request failure survived final cleanup.'));
    }
    try { await handle.child?.saveReport(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, 'Final session cleanup or native identity verification failed.');
}

function metaFor(handle) {
    return { viewport: handle.state?.viewport || handle.descriptor.viewport, locale: handle.descriptor.locale, native: handle.descriptor.native,
        prefix: handle.descriptor.id.replaceAll('/', '-') + '-', kind: 'Actual final application with explicitly intercepted local fixtures.' };
}

async function visible(handle, selector, name) {
    const node = handle.page.locator(selector).first(); await node.waitFor({ state: 'visible' });
    handle.child.check(name, await node.isVisible(), true, metaFor(handle), 10);
    return node;
}

async function observeOperational(handle, name, selectors, detail = {}) {
    return handle.helpers.operational.observeOperational(handle.page, handle.state, name, selectors, detail);
}

async function checkpoint(handle, name, selector) {
    if (selector) await handle.page.locator(selector).first().scrollIntoViewIfNeeded();
    await handle.child.painted(handle.page);
    await handle.child.capture(handle.page, name, undefined, 'Actual final source; criterion evidence awaits independent full-image review.');
}

function collectedImages(handle, captureStart, observationStart) {
    return [
        ...handle.child.report.captures.slice(captureStart).map(item => item.absolute || path.join(handle.child.evidenceDir, item.filename)),
        ...handle.child.report.observations.slice(observationStart).filter(item => item.filename).map(item => path.join(handle.child.evidenceDir, item.filename))
    ];
}

async function criterion(handle, criterionId, state, action) {
    const report = handle.child.report, checkStart = report.checks.length;
    const captureStart = report.captures.length, observationStart = report.observations.length;
    const privacyStart = report.overlayAcceptance?.privacy.length || 0;
    const reuseStart = handle.reusedEvidence?.length || 0;
    await action();
    assert.deepEqual(report.errors, []); assert.deepEqual(report.deniedRequests, []); assert.deepEqual(report.sourceErrors, []);
    const checks = verifiedCriterionChecks(report.checks.slice(checkStart), handle.legacyFocusSource);
    assert.ok(checks.length, `No complete positive check scope for ${criterionId}.`);
    await checkpoint(handle, criterionId);
    const privacyFiles = (report.overlayAcceptance?.privacy.slice(privacyStart) || []).flatMap(item =>
        [item.originalFilename, item.pseudoFilename].filter(Boolean).map(name => path.join(handle.child.evidenceDir, name)));
    const reused = (handle.reusedEvidence || []).slice(reuseStart);
    const files = [...new Set([...collectedImages(handle, captureStart, observationStart), ...privacyFiles, ...reused.flatMap(item => item.images.map(image => image.path))])];
    assert.ok(files.length, 'A criterion cannot pass without actual images.');
    const images = await Promise.all(files.map(async (filename, index) => ({ id: `${handle.descriptor.id}/${criterionId}/${index}`,
        path: filename, sha256: hash(await readFile(filename)) })));
    const checkedRecords = [
        ...checks.map((check, index) => ({ id: `${criterionId}/${index}`, ...check })),
        ...reused.flatMap((item, reuseIndex) => item.checks.map(check => ({ ...check,
            id: `${criterionId}/reuse-${reuseIndex}/${check.id}`, origin: { report: item.report, checkRef: check.id } })))
    ];
    const artifact = await writeArtifact(path.join(handle.child.evidenceDir, criterionId + '.json'), {
        marker: 'theme_audit', sourceCommit: handle.release.source.commit, criterionId, state,
        fixtureKind: 'Explicit synthetic reads/local responses through actual installed UI; no upstream policy/persistence claim.',
        checks: checkedRecords, images, sourceObservations: reused.map(({ checks, ...item }) => item),
        independentVisualReview: 'not reviewed'
    });
    const observation = { id: `${handle.descriptor.id}/${criterionId}`, criterionId, state, kind: 'intercepted-fixture-flow',
        outcome: 'verified', report: artifact, checkRefs: checkedRecords.map(check => check.id), images };
    handle.observations.push(observation);
    return observation;
}

function syntheticCustomer() {
    return { id: 990701, personId: '990701', sourceSystem: 'theme-audit-local', credentialKey: '',
        firstName: 'Synthetic', initials: 'S.', middleName: '', lastName: 'Final integration customer with a long complete display name',
        address: 'Fixturestraat 1', postalCode: '1231AA', houseNumber: '1', street: 'Fixturestraat', city: 'Testplaats', countryCode: 'NL',
        email: 'final.synthetic@example.invalid', phone: '', subscriptions: [], articles: [], contactHistory: [] };
}

async function selectCustomer(handle) {
    const longCustomer = syntheticCustomer();
    const customer = handle.nativeGroup === 'shell-search-customer-history'
        ? { ...handle.state.recordFixture.customer, lastName: longCustomer.lastName }
        : longCustomer;
    assert.ok(handle.customer, 'Customer transport must be prepared before navigation.');
    handle.customer.rows = [customer]; handle.customer.personDetails = customer;
    await handle.page.locator('#searchPostalCode').fill(customer.postalCode);
    await handle.page.locator('#searchHouseNumber').fill(customer.houseNumber);
    await handle.page.locator('button[data-action="search-customer"]').press('Enter');
    await visible(handle, '.result-row', 'Actual local search produced the declared result');
    await handle.page.locator('.result-row-actions button[data-action="select-customer"]').first().press('Enter');
    await visible(handle, '#customerDetail', 'Installed customer selection opens the detail');
    const identity = await handle.page.evaluate(() => String(window.currentCustomer?.id));
    handle.child.check('Selected identity remains exact', identity, String(customer.id), metaFor(handle), 10);
}

async function shellScene(handle) {
    const { helpers, page, child } = handle, meta = metaFor(handle);
    await criterion(handle, 'empty-and-selected-context', 'Empty shell followed by actual selected long customer', async () => {
        await helpers.shell.checkShellGeometry(page, child, child.contract, meta);
        await checkpoint(handle, 'shell-empty'); await selectCustomer(handle);
        await checkpoint(handle, 'shell-selected-long');
        await helpers.shell.checkShellGeometry(page, child, child.contract, { ...meta, state: 'selected-long-context' }, { ordinary: false });
    });
    await criterion(handle, 'profile-exit-and-focus', 'Profile keyboard traversal and Escape return', async () => {
        await helpers.shell.inspectProfileAppearance(page, child, child.contract, meta, { native: meta.native });
        await helpers.shell.inspectProfileInteractions(page, child, child.contract, meta, { native: meta.native });
    });
}

async function searchScene(handle) {
    const { page, helpers, child } = handle, meta = metaFor(handle);
    await criterion(handle, 'filters-table-sort-and-page', 'Actual expanded filters/search/sort and native result geometry', async () => {
        if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').press('Enter');
        await selectCustomer(handle);
        await returnToSearchResults(handle);
        await helpers.customerAcceptance.checkCustomerState(page, child, meta, 'actual-results');
        const sort = page.locator('#sortBy'); await sort.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        const focused = await sort.evaluate(node => ({ active: node === document.activeElement, visible: node.matches(':focus-visible'),
            width: getComputedStyle(node).outlineWidth, offset: getComputedStyle(node).outlineOffset }));
        child.check('Actual native sort has refined reference focus', focused.active && focused.visible
            && focused.width === child.contract.selectFocus.outlineWidth && focused.offset === child.contract.selectFocus.outlineOffset, true, meta, 10);
    });
    await criterion(handle, 'summary-zero-one-three', 'Source-owned zero/singular/plural summary with live language preservation', async () => {
        await helpers.feedback.searchSummaries(page, handle.state, (p, state, name, selectors, detail) =>
            helpers.operational.observeOperational(p, state, name, selectors, detail));
        child.check('Summary helper observed zero one and three', [0, 1, 3].every(count => child.report.observations.some(item =>
            item.name === 'feedback-search-summary-' + count)), true, meta, 10);
    });
    await criterion(handle, 'summary-live-nl-en-nl', 'Retained count/query and real live translations', async () => {
        const observations = child.report.observations;
        await attachObservationEvidence(handle, 'summary-zero-one-three', [1, 3].flatMap(count => [
            `feedback-search-summary-${count}`, `feedback-search-summary-${count}-en`, `feedback-search-summary-${count}-nl`]));
        child.check('Both singular and plural actual EN and NL states were captured', [1, 3].every(count => ['en', 'nl'].every(locale =>
            observations.some(item => item.name === `feedback-search-summary-${count}-${locale}` && item.actualSummary.queryUnchanged))), true, meta, 10);
        const queryCount = handle.customer.personSearchRequests;
        await page.locator('#searchSummary [data-action="scroll-to-results"]').press('Enter');
        child.check('Summary navigation emits no new search', handle.customer.personSearchRequests, queryCount, meta, 10);
    });
}

async function closeCustomerEditor(handle) {
    const editor = handle.page.locator('.customer-editor[open]');
    if (await editor.count()) { await editor.locator('.form-header .btn-close').press('Enter'); await editor.waitFor({ state: 'hidden' }); }
}

async function genderAliases(handle) {
    handle.state.suite = 'feedback';
    const originals = handle.helpers.feedback.readonlySourceFixtures();
    const values = ['Geachte heer', 'Geachte mevrouw', 'Geachte heer/mevrouw', 'Onbekende bronwaarde', ''];
    handle.state.feedbackFixtures = values.map((value, index) => {
        const item = structuredClone(originals[index % originals.length]);
        item.index = index; item.id = 990940 + index; item.credentialKey = 'theme-audit-final-readonly-' + index;
        item.suffix = `persons/${item.id}/editing?credentialKey=${item.credentialKey}`;
        item.customer.id = item.id; item.customer.personId = String(item.id); item.customer.credentialKey = item.credentialKey;
        item.salutation = value; item.model.sections.person[0].fields.salutation = value;
        return item;
    });
    const before = JSON.stringify(handle.state.feedbackFixtures);
    for (const [index, fixture] of handle.state.feedbackFixtures.entries()) {
        await handle.page.evaluate(customer => { window.currentCustomer = customer; window.customers = [customer]; window.editCustomer(); }, fixture.customer);
        const dialog = await visible(handle, '.customer-editor[open]', 'Actual source editor opens the exact readonly GET fixture');
        await dialog.locator('[data-customer-section=person] .customer-editor-record-action[data-customer-record-index="0"]').press('Enter');
        const field = dialog.locator('input[name=salutation]');
        const expected = ['Man', 'Vrouw', 'Anders', values[3], ''][index];
        handle.child.check('Readonly gender exact alias/control ' + index, await field.inputValue(), expected, metaFor(handle), 10);
        handle.child.check('Readonly source capability preserved ' + index, await field.evaluate(node => node.readOnly), true, metaFor(handle), 10);
        const label = await field.evaluate(node => node.closest('label').childNodes[0].textContent.trim());
        handle.child.check('Readonly gender caption is the source-owned role', label, 'Geslacht', metaFor(handle), 10);
        await checkpoint(handle, 'readonly-gender-' + index, '.customer-editor[open] input[name=salutation]'); await closeCustomerEditor(handle);
    }
    handle.child.check('All raw fixture inputs remain unchanged', JSON.stringify(handle.state.feedbackFixtures), before, metaFor(handle), 10);
}

async function customerScene(handle) {
    await criterion(handle, 'long-record-and-editable-editor', 'Accepted all-records renderer with local pending/error and retained raw writable draft', async () => {
        await handle.helpers.feedback.inspectRecordListsAfter(handle.page, handle.state, {
            observe: handle.helpers.operational.observeOperational, control: handle.control, mutationSection: 'person' });
        handle.child.check('Only the explicitly armed component write was locally rejected', handle.control.recordMutationGate.used(), true, metaFor(handle), 10);
        await closeCustomerEditor(handle);
    });
    await criterion(handle, 'readonly-editor', 'Null-identity records and unavailable validity remain visible readonly', async () => {
        const observations = handle.child.report.observations;
        await attachObservationEvidence(handle, 'long-record-and-editable-editor', [
            'records-after-email-1', 'records-after-bank-0', 'records-after-bank-create-readonly']);
        handle.child.check('Actual bank source restriction was observed', observations.some(item => item.name === 'records-after-bank-create-readonly'
            && item.sourceBankCreateRemainsDisabled), true, metaFor(handle), 10);
        handle.child.check('Actual null source record stays readonly', observations.some(item => item.readonly === true), true, metaFor(handle), 10);
    });
    await criterion(handle, 'exact-gender-aliases-and-controls', 'Three exact aliases plus unknown and blank through actual read renderer', () => genderAliases(handle));
}

async function addressScene(handle) {
    await criterion(handle, 'confirmed-address-and-masked-bank', 'Two actual records per type and source-shaped masked bank restrictions', async () => {
        await handle.helpers.feedback.inspectRecordListsAfter(handle.page, handle.state, {
            observe: handle.helpers.operational.observeOperational, control: handle.control });
        handle.child.check('Source model exposes separate masked bank records', handle.state.recordFixture.model.sections.bank.length, 2, metaFor(handle), 10);
        await closeCustomerEditor(handle); handle.recordMode = false;
    });
    await criterion(handle, 'wrapped-address-selection', 'Actual candidate-address selection and validation in the shared form host', async () => {
        await handle.page.locator('[data-action=show-new-subscription]').first().press('Enter');
        await visible(handle, '#newSubscriptionForm', 'Actual subscription host is open');
        await handle.page.locator('#werfsleutelInput').fill('THEME05-ALPHA');
        await handle.page.locator('.werfsleutel-suggestion[data-code="THEME05-ALPHA"]').press('Enter');
        await handle.page.locator('.channel-chip[data-arg-sales-code="THEME05-ALPHA"][data-arg-combination-key="OL"]').press('Enter');
        await handle.page.locator('input[name=recipientMode][value=existing]').press('ArrowRight');
        await visible(handle, '#recipientCreateForm', 'Source controller selects create-recipient mode');
        await handle.helpers.subscription.inspectNewAddress(handle.page, handle.child, metaFor(handle), 'Actual shared candidate address; locally fulfilled protocol.');
        const validated = handle.child.report.subscriptionEvidence.fixtureRequests.filter(item => item.path.endsWith('/addresses/validate'));
        handle.child.check('Actual selected candidate reached local source validation', validated.length > 0, true, metaFor(handle), 10);
    });
}

async function subscriptionScene(handle, dateOnly = false) {
    const { helpers, page, child } = handle, meta = { ...metaFor(handle), sentinel: true };
    await criterion(handle, dateOnly ? 'subscription-native-and-provider-dates' : 'products-edition-and-source-dates',
        'Actual mixed guide/membership and explicit provider edition dates, without submission', async () => {
            await helpers.subscription.runSubscriptionScenarios(page, child, meta, handle.subscription);
            const values = await page.evaluate(() => ({ membership: document.querySelector('#subStartDate')?.value,
                guide: document.querySelector('#subscription-date-THEME05-ALPHA')?.value }));
            child.check('Membership and guide dates remain distinct populated sources', Boolean(values.membership && values.guide && values.membership !== values.guide), true, meta, 10);
        });
    if (dateOnly) return;
    await criterion(handle, 'recipient-payer-payment-and-consent', 'Actual selected people/payment and untouched initial marketing choice', async () => {
        child.check('No subscription workflow was armed or submitted', handle.subscription.workflowRequests.length, 0, meta, 10);
        await helpers.subscriptionAcceptance.checkSubscriptionState(page, child, meta, 'existing-consent-actions');
    });
    await criterion(handle, 'lower-actions-and-quiet-close', 'Real quiet close/reopen preserves the complete form draft', async () => {
        const before = await helpers.subscriptionAcceptance.subscriptionDraftSnapshot(page);
        await page.locator('#newSubscriptionForm [data-action=close-form]').first().press('Enter');
        await page.locator('[data-action=show-new-subscription]').first().press('Enter');
        await visible(handle, '#newSubscriptionForm', 'Subscription reopens with current task');
        child.check('Complete subscription draft survives actual close', JSON.stringify(await helpers.subscriptionAcceptance.subscriptionDraftSnapshot(page)), JSON.stringify(before), meta, 10);
        await checkpoint(handle, 'subscription-lower-actions', '#newSubscriptionForm .form-actions');
    });
}

async function serviceScene(handle) {
    const { helpers, page, child } = handle, meta = metaFor(handle);
    await criterion(handle, 'bounded-multistep-context-and-choice', 'One actual cancellation path with long source context and native option', async () => {
        await helpers.service.prepareServiceCustomer(page);
        await page.evaluate(() => window.kiwiWinbackSlice.cancelSubscription(990711));
        await visible(handle, '#winbackStep1', 'Actual service first step is visible');
        await page.locator('input[name=cancelReason][value=price]').press('Space');
        await page.locator('#winbackStep1 [data-action=winback-next-step]').press('Enter');
        await visible(handle, '#winbackStep2 .offer-card', 'Actual offers step follows source-owned reason');
        const choice = page.locator('#winbackStep2 .offer-card input').first(); await choice.press('Space');
        child.check('Native offer Space selects without submitting', await choice.isChecked() && handle.service.mutations.length === 0, true, meta, 10);
        await helpers.service.observeService(page, child, meta, 'offers-selected-focus', 'winbackFlow', '#winbackStep2');
    });
    await criterion(handle, 'invalid-or-provider-error-and-actions', 'Actual selected step/action and deliberate incomplete confirmation remain in the task', async () => {
        await page.locator('#winbackStep2 [data-arg-step="3"]').press('Enter');
        await helpers.service.observeService(page, child, meta, 'confirmation', 'winbackFlow', '#winbackStep3');
        await helpers.service.closeService(page, 'winbackFlow');
        await page.evaluate(() => window.showEditorialComplaintForm());
        const description = page.locator('#editorialComplaintDescription');
        await description.fill('');
        const invalid = await description.evaluate(node => { node.reportValidity(); return { required: node.required, valid: node.validity.valid, message: node.validationMessage }; });
        child.check('Actual required service description is invalid with a native explanation', invalid.required && !invalid.valid && Boolean(invalid.message), true, meta, 10);
        await helpers.service.observeService(page, child, meta, 'complaint-invalid', 'editorialComplaintForm', '#editorialComplaintDescription');
        await description.fill('Synthetic final service draft retained after native validation.');
        child.check('No service acknowledgement callback executed', handle.service.mutations.length, 0, meta, 10);
    });
    await criterion(handle, 'quiet-close-and-return', 'Actual cancellation close and task affordance remain reachable', async () => {
        await helpers.service.closeService(page, 'editorialComplaintForm');
        child.check('Actual service close hides the form', await page.locator('#editorialComplaintForm').isVisible(), false, meta, 10);
        await visible(handle, '.header', 'Shell remains available after service close');
    });
}

async function articleRowPaint(handle) {
    const { page, child } = handle;
    const root = page.locator('#articleSaleForm');
    if (!await root.isVisible()) await page.locator('[data-action=open-article-sale-form]').first().press('Enter');
    await page.locator('#articleSearch').fill('Synthetic');
    const row = await visible(handle, '#articleDropdown .article-item', 'Actual matched article suggestion is visible');
    const read = () => row.evaluate(node => {
        const s = getComputedStyle(node), r = node.getBoundingClientRect();
        return { text: node.textContent.trim(), x: r.x, width: r.width, borderWidths: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
            borderColors: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor], radii: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius],
            background: s.backgroundColor, sheets: [...document.styleSheets].map(sheet => sheet.href).filter(Boolean), highlighted: node.classList.contains('highlighted'), matchedRules: [...document.styleSheets].flatMap((sheet, sheetOrder) => {
                const found = [];
                function walk(rules, conditions = []) {
                    for (let index = 0; index < rules.length; index += 1) {
                        const rule = rules[index];
                        if (rule.selectorText) {
                            let matches = false; try { matches = node.matches(rule.selectorText); } catch {}
                            if (matches) found.push({ sheet: sheet.href, sheetOrder, index, selector: rule.selectorText, declarations: rule.style.cssText, conditions });
                        }
                        if (rule.cssRules) walk(rule.cssRules, rule.conditionText ? [...conditions, rule.conditionText] : conditions);
                    }
                }
                try { walk(sheet.cssRules); } catch (error) { found.push({ sheet: sheet.href, error: error.name }); }
                return found;
            }) };
    });
    await page.mouse.move(0, 0); const resting = await read(); await checkpoint(handle, 'article-matched-row-rest');
    await row.hover(); const hovered = await read(); await checkpoint(handle, 'article-matched-row-hover');
    await page.locator('#articleSearch').press('ArrowDown'); const keyboard = await read(); await checkpoint(handle, 'article-matched-row-keyboard');
    child.report.articleRowPaint = { resting, hovered, keyboard,
        boundary: 'Actual matched same query/row. Computed borders/radii/order and full images require independent role/cascade review; no automatic parity from unchanged JS.' };
    child.check('Matched row identity is stable across actual states', resting.text === hovered.text && resting.text === keyboard.text, true, metaFor(handle), 10);
    child.check('Matched row has five declared application stylesheets', cssNames.every(name => resting.sheets.some(url => {
        const stem = name.slice(0, -4); return new RegExp('/' + stem + '(?:-[\\w-]{7})?\\.css$').test(url); })), true, metaFor(handle), 10);
    await page.locator('#articleSearch').press('Escape');
}

async function articleScene(handle) {
    const { page, child, helpers } = handle, meta = { ...metaFor(handle), suite: 'layout' };
    await criterion(handle, 'matched-row-paint-and-load-order', 'Same actual suggestion across rest/hover/keyboard with exact served sheet provenance', () => articleRowPaint(handle));
    await criterion(handle, 'catalog-long-cart-and-totals', 'Existing finite actual catalogue/cart/quote sequence, no workflow', async () => {
        if (await page.locator('#articleSaleForm').isVisible()) await page.locator('#articleSaleForm [data-action=close-article-sale-form]').first().press('Enter');
        await buildArticleCart(handle);
        child.check('Actual cart contains both declared products', await page.locator('#orderItemsList .order-item').count(), 2, meta, 10);
    });
    await criterion(handle, 'coupon-payment-actions-and-close', 'Retained coupon outcome/payment and quiet close', async () => {
        child.check('No article workflow was armed', handle.article.workflowRequests.length, 0, meta, 10);
        await helpers.articleAcceptance.checkArticleState(page, child, meta, 'payment-notes-actions');
        await page.locator('#articleSaleForm [data-action=close-article-sale-form]').first().press('Enter');
        child.check('Actual article close exits its form', await page.locator('#articleSaleForm').isVisible(), false, meta, 10);
    });
}

async function restoreEditableCustomer(handle) {
    // Restore a source-declared local customer through the accepted owner/controller.
    // Do not force article/subscription opening or clear a readonly business guard.
    handle.state.suite = 'feedback'; handle.recordMode = false;
    const customer = handle.helpers.operational.operationalCustomerFixture('after');
    const originalFamily = handle.activeFamily;
    handle.activeFamily = 'operational';
    try {
        await handle.page.evaluate(async sourceCustomer => window.kiwiCustomerDetailSlice.selectCustomer(sourceCustomer.id,
            { sourceCustomer, requireFresh: true }), customer);
    } finally {
        handle.activeFamily = originalFamily;
    }
    const actual = await handle.page.evaluate(() => String(window.currentCustomer?.id));
    handle.child.check('Restore exact locally editable owner through actual selection controller', actual, String(customer.id), metaFor(handle), 10);
}

async function calendarScene(handle) {
    await subscriptionScene(handle, true);
    await handle.page.locator('#newSubscriptionForm [data-action=close-form]').first().press('Enter');
    handle.activeFamily = 'article';
    await criterion(handle, 'article-calendar-states-navigation-and-exit', 'Distinct article calendar host and actual source navigation', async () => {
        await handle.page.locator('[data-action=open-article-sale-form]').first().press('Enter');
        await visible(handle, '#articleSaleForm', 'Article workflow opens without bypassing customer ownership');
        await handle.helpers.articleAcceptance.inspectArticleCalendar(handle.page, handle.child, metaFor(handle), handle.helpers.article.observeArticle);
        await visible(handle, '#deliveryDateDisplay', 'Real article date host remains visible after calendar exit');
    });
}

async function callsScene(handle) {
    const criteria = ['separate-queue-and-valid-active-call', 'recording-hold-and-resume', 'actual-end-to-inactive-acw', 'disposition-invalid-followup-and-error'];
    await criterion(handle, criteria[0], 'Accepted finite actual queue/call/hold/end/ACW/disposition controller sequence', async () => {
        await handle.helpers.operational.inspectOperationalCalls(withCallControlReadiness(handle.page), handle.state, handle.control);
        const names = new Set(handle.child.report.observations.map(item => item.name));
        handle.child.check('Separate queue and actual identified/anonymous states are captured', ['queue-long', 'call-anonymous-recording', 'call-identified-long']
            .every(name => names.has(name)), true, metaFor(handle), 10);
    });
    for (const [criterionId, names] of [
        [criteria[1], ['call-hold-recording', 'call-resumed']],
        [criteria[2], ['acw-disposition-empty', 'acw-after-cancel']],
        [criteria[3], ['disposition-invalid', 'disposition-followup']]
    ]) {
        await criterion(handle, criterionId, 'Actual accepted controller observations retained from the same finite sequence', async () => {
            const observations = handle.child.report.observations;
            handle.child.check('Required actual states: ' + names.join(', '), names.every(name => observations.some(item => item.name === name)), true, metaFor(handle), 10);
            for (const item of observations.filter(item => names.includes(item.name))) {
                handle.child.report.captures.push({ absolute: path.join(handle.child.evidenceDir, item.filename), name: item.name });
            }
        });
    }
    const invariant = await handle.page.evaluate(() => {
        if (!window.callSession || !window.agentStatus || !('acwInterval' in window.agentStatus)) throw new Error('Installed call/ACW state is missing.');
        const bar = document.getElementById('acwBar');
        const acwVisible = Boolean(bar?.getClientRects().length) && getComputedStyle(bar).display !== 'none';
        return !(window.callSession.active && (window.agentStatus.acwInterval !== null || acwVisible));
    });
    handle.child.check('Final controller state never combines active call and ACW', invariant, true, metaFor(handle), 10);
}

async function historyScene(handle) {
    await criterion(handle, 'empty-long-default-and-highlight', 'Actual history source categories with long/default and fresh highlight', async () => {
        await handle.helpers.operational.inspectOperationalHistory(handle.page, handle.state);
        handle.child.check('Actual history observations exist', handle.child.report.observations.some(item => item.name.startsWith('history-')), true, metaFor(handle), 10);
    });
    await criterion(handle, 'native-disclosure-and-focus', 'Actual installed timeline button disclosure and keyboard perimeter', async () => {
        const customer = handle.helpers.operational.operationalCustomerFixture('after');
        customer.contactHistory = [{ id: 'synthetic-final-disclosure', type: 'synthetic_unknown', date: '2026-11-17T10:00:00Z', description: 'Synthetic final long history disclosure with complete contextual text.' }];
        await handle.page.evaluate(customer => { window.currentCustomer = customer; window.customers = [customer]; window.kiwiContactHistorySlice.displayContactHistory(); }, customer);
        const button = handle.page.locator('.timeline-header').first(); await button.scrollIntoViewIfNeeded();
        await handle.child.keyboardFocus(handle.page, '.timeline-header', 'Native history disclosure');
        const before = await button.getAttribute('aria-expanded'); await button.press('Enter');
        handle.child.check('Native timeline Enter changes actual aria-expanded', await button.getAttribute('aria-expanded') !== before, true, metaFor(handle), 10);
        const focus = await button.evaluate(node => ({ focused: node === document.activeElement, visible: node.matches(':focus-visible'), width: getComputedStyle(node).outlineWidth }));
        handle.child.check('Native history action retains exact3px focus', focus.focused && focus.visible && focus.width === '3px', true, metaFor(handle), 10);
    });
}

async function outboxScene(handle) {
    const fallbackItems = structuredClone(handle.control.items);
    const closeQueue = async () => {
        const toggle = handle.page.locator('[data-action="toggle-subscription-queue-info"]');
        if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.press('Enter');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Each outbox helper requires a closed queue before its opening toggle.');
    };
    await criterion(handle, 'empty-long-and-restricted', 'Actual installed outbox reads/long/status/capability fixtures', async () => {
        await handle.helpers.operational.initialOutbox(handle.page, handle.state, handle.control);
        await closeQueue();
        await handle.helpers.operational.inspectOperationalOutbox(handle.page, handle.state, handle.control);
        handle.child.check('Outbox reads remained locally owned', handle.child.report.outboxReads.length > 0, true, metaFor(handle), 10);
    });
    await criterion(handle, 'menu-disclosure-and-editor', 'Actual native outbox menu/disclosure/editor and Escape return', async () => {
        const observed = handle.child.report.observations;
        handle.child.check('Actual native editor and Escape were observed', observed.some(item => item.name === 'outbox-native-editor')
            && observed.some(item => item.name === 'outbox-native-editor-escape'), true, metaFor(handle), 10);
        for (const item of observed.filter(item => /outbox.*(menu|native-editor)/.test(item.name))) {
            handle.child.report.captures.push({ absolute: path.join(handle.child.evidenceDir, item.filename), name: item.name });
        }
    });
    await criterion(handle, 'real-refresh-focus-and-fallback', 'Actual five-second refresh and source-owned focus fallback', async () => {
        await closeQueue();
        if (await handle.page.locator('#customerSessionChanges').evaluate(node => node.open)) {
            await handle.page.locator('#customerSessionChanges > summary').press('Enter');
        }
        await handle.helpers.operational.inspectAsyncOutbox(handle.page, handle.state, handle.control);
        await closeQueue();
        // Async checks finish with a restricted row; fallback needs the original declared read fixture.
        handle.control.items = structuredClone(fallbackItems);
        await handle.helpers.operational.inspectOutboxFallbackFocus(handle.page, handle.state, handle.control);
        handle.child.check('Async refresh did not forward a business request', handle.child.report.deniedRequests.length, 0, metaFor(handle), 10);
    });
}

export async function inspectRetainedCaptureInFreshDocument(handle) {
    const { child, context, driver } = handle, meta = metaFor(handle);
    const measure = () => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
        zoom: visualViewport?.scale, locale: document.documentElement.lang });
    const originalEnvironment = await handle.page.evaluate(measure);
    const page = await context.newPage();
    // Keep this document's served-body receipt distinct from the retained application page.
    const tracking = { ...handle, page, child: { ...child, report: { servedSources: [], sourceErrors: [] } }, cleanup: [] };
    const runtimeError = error => child.report.errors.push({ kind: 'retained capture component runtime', name: error.name });
    try {
        assert.equal(page.context(), context, 'The component document must share the actual authenticated context.');
        const finishSources = trackFinalServedSources(tracking, { artifactName: 'retained-component-served-source.json' });
        page.on('pageerror', runtimeError); tracking.cleanup.push(() => page.off('pageerror', runtimeError));
        const response = await page.goto(driver.baseUrl.href, { waitUntil: 'domcontentloaded' });
        assert.equal(response?.url(), driver.baseUrl.href, 'The component must load the exact same-origin application document.');
        const role = serverRoleEvidence(await response.text(), handle.descriptor.role, response.status());
        await page.waitForFunction(() => window.kiwiCustomerDetailSlice && window.kiwiCustomerWorkSession);
        const environment = await page.evaluate(measure);
        assert.deepEqual(environment, originalEnvironment, 'The fresh component document must retain the current viewport, zoom and locale.');
        assert.deepEqual((await page.locator('.profile-menu-role').allTextContents()).map(value => value.trim()), role.roles);
        const receipt = child.report.retainedCaptureComponent = { boundary: 'Existing dialog-controller component fixture in a fresh authenticated document; original application dialog and draft remain retained.',
            sourceBefore: await finishSources(),
            role: await writeArtifact(path.join(child.evidenceDir, 'retained-component-server-role.json'), {
                marker: 'theme_audit', sourceCommit: handle.release.source.commit, ...role }),
            environment: await writeArtifact(path.join(child.evidenceDir, 'retained-component-environment.json'), {
                marker: 'theme_audit', sourceCommit: handle.release.source.commit, environment }) };
        await handle.helpers.overlays.inspectRetainedCaptureCallbackError(page, child, meta);
        for (const name of ['dialog', 'screenshot', 'selector']) assert.ok(tracking.child.report.servedSources.some(item =>
            item.path === `assets/js/app/contextual-feedback/${name}.js`), 'Missing actual served component source: ' + name);
        receipt.sourceAfter = await finishSources();
    } catch (error) {
        await child.capture(page, 'retained-capture-component-failure', undefined,
            'Actual failed fresh-document component setup or assertion; retained diagnostic, never accepted.').catch(() => {});
        throw error;
    } finally {
        try { if (!page.isClosed()) await page.close(); }
        finally { for (const cleanup of tracking.cleanup.splice(0).reverse()) await cleanup(); }
    }
}

async function feedbackScene(handle) {
    const { helpers, page, child } = handle, meta = metaFor(handle);
    await criterion(handle, 'visible-task-entry-and-ordinary-settings', 'Production visible trigger and matched ordinary/settings native dialogs', async () => {
        await helpers.overlays.enableVisibleFeedback(page, handle.overlay, meta.native);
        await helpers.overlays.pairedOrdinaryDialogs(page, child, meta);
        child.check('Exactly one declared safe settings enable was locally fulfilled', handle.overlay.settingsPuts, 1, meta, 10);
    });
    await criterion(handle, 'image-annotation-private-error-and-replace', 'Real production capture/image actions and current failed upload with retained image', async () => {
        await helpers.overlays.inspectFeedbackRecovery(page, child, meta, handle.overlay, true);
        child.check('Actual controlled feedback request was captured', handle.overlay.feedbackRequests.length > 0, true, meta, 10);
        child.check('No feedback request left the fixture owner', child.report.deniedRequests.length, 0, meta, 10);
        await inspectRetainedCaptureInFreshDocument(handle);
        handle.privateError = true;
        try { await helpers.overlays.inspectPrivateErrorCapture(page, child, meta, handle.privateOverlay); }
        finally { handle.privateError = false; }
        child.check('Actual opaque private-error PNG and metadata checks were retained', child.report.overlayAcceptance.privacy.length > 0, true, meta, 10);
    });
    await criterion(handle, 'quiet-close-and-return', 'Native feedback close returns to its actual visible invoker', async () => {
        if (await page.locator('.contextual-feedback-modal[open]').count()) await helpers.overlays.closeFeedback(page, child, meta);
        await helpers.overlays.openFeedback(page); await helpers.overlays.closeFeedback(page, child, meta);
        child.check('Visible enabled trigger owns actual returned focus', await page.locator('#contextualFeedbackButton').evaluate(node =>
            !node.disabled && node === document.activeElement), true, meta, 10);
    });
}

async function systemScene(handle, { accountPages = true } = {}) {
    const { helpers, page, child } = handle, meta = metaFor(handle);
    await restoreEditableCustomer(handle);
    if (accountPages) await criterion(handle, 'actual-role-denied-and-logged-out', 'Strict155 isolated actual native Donny403 and public logged-out pages', async () => {
        let documentIndex = 0;
        await helpers.accounts.inspectIconAccountPages(handle.context.browser(), {
            baseUrl: child.baseUrl, viewport: meta.viewport, report: child.report,
            track(page) {
                const account = { ...handle, page, cleanup: [] };
                const finish = trackFinalServedSources(account, { requiredPaths: ['assets/css/styles.css'], artifactName: `account-${documentIndex++}-served-source.json` });
                handle.cleanup.push(...account.cleanup);
                return finish;
            },
            capture: (page, name, viewport, kind) => child.capture(page, 'strict155-' + name, undefined, kind),
            check: (name, passed, detail) => child.check(name, passed, true, { ...meta, detail }, 10),
            focus: (page, selector) => child.keyboardFocus(page, selector, 'strict155 account action')
        });
        child.check('Main scene actual server role proof remains unchanged', Boolean(handle.roleProof), true, meta, 10);
    });
    await criterion(handle, 'toast-inline-error-and-confirmation', 'Actual current task inline explanation beside a reachable action', async () => {
        await page.evaluate(() => window.kiwiDeliveryRemarksSlice.editDeliveryRemarks());
        const field = await visible(handle, '#editCustomerDeliveryRemarks', 'Actual generic delivery form is open');
        await field.fill('Synthetic final delivery draft'); await field.focus();
        const message = 'Synthetic final task error remains readable beside the current action.';
        await page.evaluate(text => window.kiwiAppShellSlice.showToast(text, 'error', { recordContactHistory: false }), message);
        await helpers.overlays.inspectInlineNotice(page, child, meta, '#editDeliveryRemarksModal', '[data-action=save-delivery-remarks]', message);
        child.check('Current inline task explanation exists', await page.locator('#editDeliveryRemarksModal .overlay-notification.error').isVisible(), true, meta, 10);
        await page.evaluate(() => window.kiwiDeliveryRemarksSlice.closeEditRemarksModal());
        await inspectCancelConfirmation(handle);
    });
    await criterion(handle, 'eligible-dialog-layered-exit-and-return', 'Actual eligible developer dialog native Escape exit', async () => {
        await child.keyboardFocus(page, '#agentProfileTrigger', 'Stable live invoker before the developer dialog');
        const opener = await page.evaluateHandle(() => document.activeElement);
        await page.evaluate(() => window.kiwiCallAgentRuntime.openDebugModal());
        const field = await visible(handle, '#debugQueueSize', 'Actual eligible developer field is visible');
        await field.focus(); await checkpoint(handle, 'system-debug-focused');
        await page.keyboard.press('Escape');
        await page.locator('#debugModal').waitFor({ state: 'hidden' });
        child.check('Actual Escape returns to the previous live invoker', await page.evaluate(node => node === document.activeElement, opener), true, meta, 10);
        await opener.dispose();
        child.check('Actual developer close hides its dialog', await page.locator('#debugModal').isVisible(), false, meta, 10);
    });
}

const implementations = {
    A01: shellScene, A02: searchScene, A03: customerScene, A04: addressScene, A05: subscriptionScene,
    A06: serviceScene, A07: articleScene, A08: calendarScene, A09: callsScene, A10: historyScene,
    A11: outboxScene, A12: feedbackScene, A13: systemScene
};

async function runArea(handle, areaId) {
    assert.equal(handle.sessionVerified, true, 'No scene runs before actual authenticated source/role/environment proof.');
    assert.ok(implementations[areaId], 'Only the canonical13 areas may run.');
    if (['A03', 'A04'].includes(areaId) && !handle.state.recordFixture) handle.state.recordFixture = handle.helpers.feedback.recordListAfterFixture(handle.driver.sourceRoot, 2, areaId === 'A03');
    handle.activeFamily = familyFor(areaId); handle.recordMode = ['A03', 'A04'].includes(areaId);
    handle.state.suite = areaId === 'A03' ? 'records-after-component' : areaId === 'A04' ? 'records-after' : 'feedback';
    const start = handle.observations.length;
    await implementations[areaId](handle);
    const observations = handle.observations.slice(start), area = finalAuditAreas.find(item => item.id === areaId);
    assert.deepEqual(observations.map(item => item.criterionId).sort(), area.criteria.slice().sort(), 'Every canonical criterion must have actual finite evidence.');
    return observations;
}

export async function createFinalSceneHooks({ release, verification }) {
    validateFinalSceneInputs(release, verification);
    let owner = null, helpers = null;
    return {
        operationalAfter: release.operationalAfter,
        async verifyRelease({ release: requested, releaseId }) {
            assert.equal(requested, release, 'Use the exact already verified release object.');
            const bytes = await physicalArtifact(release.ownerVerification, 'Root final environment verification');
            const proof = JSON.parse(bytes); validateOwnerVerification(proof, release, releaseId);
            const config = JSON.parse(await physicalArtifact(proof.effectiveConfiguration.artifact, 'Root effective public configuration/health proof'));
            assert.equal(config.marker, 'theme_audit'); assert.equal(config.status, 'verified'); assert.equal(config.sourceCommit, release.source.commit);
            const source = JSON.parse(await physicalArtifact(release.source.manifest, 'Final complete source'));
            const inventory = JSON.parse(await physicalArtifact(release.source.helpers, 'Complete accepted helper inventory'));
            assert.ok(inventory.files.some(entry => entry.path === release.accountPages.path && entry.sha256 === release.accountPages.sha256),
                'Strict account module must be frozen in this accepted155-bound helper release.');
            const sdk = await physicalArtifact(release.sdk, 'Original SDK');
            await physicalArtifact(release.fixtures.serviceAck, 'Source-bound service acknowledgement projection');
            assert.equal(process.env.KIWI_THEME_SERVICE_ACK_FIXTURES, release.fixtures.serviceAck.path, 'Existing service helper must read the exact released source projection.');
            assert.equal(process.env.KIWI_THEME_OVERLAY_SDK_FILE, release.sdk.path, 'Existing overlay helper must read this exact released SDK.');
            const operational = inventory.files.find(entry => entry.path === legacyFocusPath);
            assert.ok(operational, 'The operational assertion source must belong to the full helper inventory.');
            const actualOperational = hash(await readFile(new URL('./compose-smoke-theme-audit-operational.mjs', import.meta.url)));
            assert.equal(actualOperational, operational.sha256, 'Operational assertion body differs from its frozen helper release.');
            const legacyFocusSource = { path: operational.path, sha256: actualOperational, verified: true };
            owner = { proof, source, sdk, releaseId, legacyFocusSource };
            helpers = await loadHelpers();
            return { releaseId, evidence: release.ownerVerification };
        },
        async prepareSession(input) {
            assert.ok(owner && helpers, 'Actual owner release verification must complete before session setup.');
            assert.equal(input.release, release);
            return prepareOwnedSession(input, owner, helpers, verification);
        },
        async loginSession(session) {
            const handle = session.owned || session;
            assert.equal(handle.page.url(), 'about:blank');
            await helpers.operational.loginOperationalSession(handle.page, handle.control, handle.state);
            if (await handle.page.locator('#agentStatusMenu').isVisible()) await handle.page.keyboard.press('Escape');
            if (handle.descriptor.locale !== 'nl') {
                await handle.page.locator('#agentProfileTrigger').press('Enter');
                await handle.page.locator('[data-locale-option=' + handle.descriptor.locale + ']').press('Enter');
                if (await handle.page.locator('#agentStatusMenu').isVisible()) await handle.page.keyboard.press('Escape');
            }
        },
        async verifySession(session, { releaseId }) {
            const handle = session.owned || session;
            assert.equal(releaseId, owner.releaseId);
            const source = await handle.finishSources();
            if (handle.finishCustomerSources) await handle.finishCustomerSources();
            await Promise.all(handle.homeReads);
            assert.deepEqual(handle.child.report.sourceErrors, []);
            assert.ok(handle.home, 'Actual authenticated server document response is required.');
            const role = serverRoleEvidence(handle.home.html, handle.descriptor.role, handle.home.status);
            const measured = await handle.page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
                zoom: visualViewport?.scale, locale: document.documentElement.lang,
                reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, coarse: matchMedia('(pointer: coarse)').matches }));
            const actualRoles = (await handle.page.locator('.profile-menu-role').allTextContents()).map(value => value.trim());
            assert.deepEqual(actualRoles, role.roles, 'Visible role labels must equal the actual server document.');
            assert.equal(measured.locale, handle.descriptor.locale); assert.equal(measured.dpr, 1); assert.equal(measured.zoom, 1);
            assert.equal(measured.reduced, handle.descriptor.reducedMotion === 'reduce');
            if (handle.descriptor.hasTouch) assert.equal(measured.coarse, true);
            const environment = { browser: handle.driver.browserName, browserVersion: handle.context.browser().version(),
                width: measured.width, height: measured.height, locale: measured.locale, role: handle.descriptor.role,
                input: 'keyboard-and-pointer', zoom: 100, reducedMotion: handle.descriptor.reducedMotion,
                ...(handle.descriptor.native ? { native: true, hasTouch: handle.descriptor.hasTouch } : {}) };
            const environmentProof = await writeArtifact(path.join(handle.child.evidenceDir, 'actual-environment.json'), { marker: 'theme_audit', sourceCommit: release.source.commit, environment, measured });
            const roleArtifact = await writeArtifact(path.join(handle.child.evidenceDir, 'actual-server-role.json'), { marker: 'theme_audit', sourceCommit: release.source.commit, ...role });
            handle.roleProof = roleArtifact; handle.initialEnvironment = environment; handle.sessionVerified = true; handle.state.report.environment = environment;
            if (handle.descriptor.native) {
                handle.state.nativeKernel = { async captureWholeDesktop(filename) {
                    await handle.child.capture(handle.page, filename, undefined, 'Actual uncropped X11 frame from existing final driver OS engine.');
                    await copyFile(handle.child.report.captures.at(-1).absolute, path.join(handle.child.evidenceDir, filename));
                } };
            }
            return { sourceReleaseId: releaseId, environment, proofs: { source, environment: environmentProof,
                role: { kind: 'actual-oidc-server-render', artifact: roleArtifact } } };
        },
        async finishSession(handle) { await finishFinalSceneSession(handle?.owned || handle); },
        scenes: Object.fromEntries(finalAuditAreas.map(area => [area.id, async handle => runArea(handle.owned || handle, area.id)])),
        async inspectNative(handle, { group }) {
            const owned = handle.owned || handle; assert.ok(nativeAreas[group], 'Unknown native group.');
            owned.state.viewport = await owned.page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
            for (const area of nativeAreas[group]) {
                if (area === 'A13') {
                    owned.activeFamily = familyFor(area); owned.recordMode = false;
                    await systemScene(owned, { accountPages: false });
                } else await runArea(owned, area);
            }
            const stored = await owned.page.evaluate(nativeTaskIdentity, 'remember');
            assert.equal(stored.stored, true); owned.nativeResetPending = true;
            return owned.observations;
        }
    };
}

async function buildArticleCart(handle) {
    const { page, child, helpers } = handle, meta = metaFor(handle);
    await page.locator('[data-action=open-article-sale-form]').first().press('Enter');
    await visible(handle, '#articleSaleForm', 'Article opens through its actual customer guard');
    await page.locator('#articleSearch').fill('Synthetic');
    await page.locator('#articleDropdown .browse-all-link').press('Enter');
    await visible(handle, '#allArticlesModal', 'Actual full catalogue opens');
    await helpers.article.observeArticle(page, child, meta, 'catalog', '#allArticlesModal');
    await page.locator('#allArticlesModal [data-arg-article-id="990601"]').press('Enter');
    // The installed detail response owns readiness; no invented window.selectedArticle.
    await page.locator('#articleName[data-article-id="990601"]').waitFor({ state: 'attached' });
    for (const [id, quantity] of [['990601', '5'], ['990602', '2']]) {
        if (id === '990602') {
            await page.locator('#articleSearch').fill('Synthetic');
            await page.locator('#articleDropdown [data-arg-article-id="990602"]').press('Enter');
            await page.locator('#articleName[data-article-id="990602"]').waitFor({ state: 'attached' });
        }
        await page.locator('#articleQuantity').fill(quantity); await page.locator('#articleQuantity').press('Tab');
        child.check('Actual source detail identity is ready before add', await page.locator('#articleName').getAttribute('data-article-id'), id, meta, 10);
        await page.locator('[data-action=add-article-to-order]').press('Enter');
        await page.waitForFunction(count => document.querySelectorAll('#orderItemsList .order-item').length === count, id === '990601' ? 1 : 2);
    }
    await helpers.article.observeArticle(page, child, meta, 'populated-quote', '#orderItemsSection');
    await page.locator('#couponCode').fill('THEME06'); await page.locator('#couponCode').press('Enter');
    await visible(handle, '#couponMessage.success', 'Actual source coupon success is visible');
    await helpers.article.observeArticle(page, child, meta, 'coupon-success-total', '#couponMessage');
    await page.locator('#articleNotes').fill('Synthetic final long delivery note retained with the complete cart.');
    await page.locator('#articlePaymentTransfer').press('Space');
    child.check('Actual native transfer radio responds to Space', await page.locator('#articlePaymentTransfer').isChecked(), true, meta, 10);
    await helpers.article.observeArticle(page, child, meta, 'payment-notes-actions', '#articleNotes');
    await helpers.articleAcceptance.inspectArticleCalendar(page, child, meta, helpers.article.observeArticle);
}

async function inspectCancelConfirmation(handle) {
    const { page, control, child } = handle;
    control.mode = 'ready'; control.release();
    await page.evaluate(() => window.kiwiOutbox.refreshOutbox());
    if (await page.locator('#subscriptionQueueToggle').getAttribute('aria-expanded') !== 'true') await page.locator('#subscriptionQueueToggle').press('Enter');
    const row = page.locator('.session-outbox-item').first();
    await row.locator('[data-outbox-control=actions]').press('Enter');
    const writes = child.report.localCallWrites.length;
    let prompt = null;
    page.once('dialog', async dialog => {
        prompt = { type: dialog.type(), text: dialog.message(), decision: 'cancel', boundary: 'Actual browser-native confirmation; no custom CSS parity or live prompt screenshot claim.' };
        await dialog.dismiss();
    });
    await row.locator('.session-outbox-menu .is-destructive').press('Enter');
    child.check('Actual destructive action asks the source-owned native confirmation', prompt?.type === 'confirm' && prompt.text.startsWith('Alle ')
        && prompt.text.includes('verwijderen'), true, metaFor(handle), 10);
    child.check('Cancelling actual confirmation emits no business write', child.report.localCallWrites.length, writes, metaFor(handle), 10);
    child.report.confirmation = prompt;
}

// Passed directly to page.evaluate. Keep it self-contained: Node closures and raw draft
// values must not cross into exported evidence. Tests also execute this body in a separate VM.
export function nativeTaskIdentity(mode) {
    const context = window.kiwiCustomerWorkSession.getRequestContext();
    const customer = window.currentCustomer;
    const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=password]):not([type=file]),select,textarea')]
        .filter(node => !/csrf|token|idempotency|submission|session|credential|webhook/i.test([node.id, node.name].join(' ')))
        .map(node => ({ id: node.id, name: node.name, value: node.value, checked: node.checked, disabled: node.disabled, readonly: node.readOnly }));
    const snapshot = JSON.stringify({ customer: customer ? [customer.personId, customer.credentialKey, customer.sourceSystem] : null,
        reference: context.customerReference, workflow: context.workflowSessionId, generation: context.contextGeneration,
        fields, roles: [...document.querySelectorAll('.profile-menu-role')].map(node => node.textContent.trim()),
        call: { active: window.callSession.active, customerId: window.callSession.customerId,
            onHold: window.callSession.onHold, recordingActive: window.callSession.recordingActive },
        order: window.orderItems || [] });
    const geometry = { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, pinch: visualViewport?.scale };
    if (mode === 'remember') { window.__kiwiThemeFinalResetIdentity = snapshot; return { stored: true, ...geometry }; }
    if (mode !== 'verify') throw new Error('Only remember/verify native task identity is supported.');
    const equal = typeof window.__kiwiThemeFinalResetIdentity === 'string' && window.__kiwiThemeFinalResetIdentity === snapshot;
    delete window.__kiwiThemeFinalResetIdentity;
    return { equal, ...geometry };
}

// Only the accepted hold/resume command gets a post-action readiness gate. The original
// fixture/controller and whole-call observer bodies remain exact; no timeout guesses or
// invented selectedArticle-style globals establish readiness.
export function withCallControlReadiness(page) {
    return new Proxy(page, { get(target, name) {
        if (name !== 'locator') {
            const member = Reflect.get(target, name); return typeof member === 'function' ? member.bind(target) : member;
        }
        return (selector, ...options) => {
            const locator = target.locator(selector, ...options);
            if (selector !== '#holdCallBtn') return locator;
            return new Proxy(locator, { get(control, property) {
                if (property !== 'press') {
                    const member = Reflect.get(control, property); return typeof member === 'function' ? member.bind(control) : member;
                }
                return async (...args) => {
                    const before = await page.evaluate(() => window.callSession.onHold);
                    assert.equal(typeof before, 'boolean');
                    await control.press(...args);
                    await page.waitForFunction(expected => {
                        const node = document.getElementById('holdIndicator');
                        const painted = Boolean(node?.getClientRects().length) && getComputedStyle(node).visibility !== 'hidden';
                        return window.callSession.onHold === expected && painted === expected;
                    }, !before);
                };
            } });
        };
    } });
}

const legacyFocusPath = 'scripts/compose-smoke-theme-audit-operational.mjs';
const legacyFocusSha256s = [
    '6d312cd304824f9117434ed7e84ba2bc437883d0b87963b826e3b94b092f05a9',
    '6d92de17eec977297856200774f70f1abfed45ba37aee703c31d7afd6e342287'
];
const legacyFocusName = 'Actual five-second first trigger focus is retained and visible';

// Called after the source operation returned, so its original assert.ok has already run.
// Only this exact, independently reviewed helper record has the older missing-pass shape.
export function verifiedCriterionChecks(records, source) {
    return records.map(record => {
        if (Object.hasOwn(record, 'passed')) {
            assert.equal(record.passed, true, 'A failed/unverified source check cannot support a criterion.');
            return record;
        }
        assert.equal(record.name, legacyFocusName, 'Unknown missing-pass source record.');
        assert.deepEqual(Object.keys(record).sort(), ['matches', 'name', 'visible'], 'The legacy focus shape must stay exact.');
        assert.equal(source?.verified, true); assert.equal(source.path, legacyFocusPath);
        assert.ok(legacyFocusSha256s.includes(source.sha256), 'Legacy focus requires an exact independently reviewed helper body.');
        assert.equal(record.matches, true); assert.equal(record.visible, true);
        return { ...record, passed: true, evidenceType: 'reviewed-legacy-focus-assertion', assertionSource: { path: source.path, sha256: source.sha256 } };
    });
}

export async function returnToSearchResults(handle) {
    const inputs = () => handle.page.locator('.search-card input:not([type=hidden])').evaluateAll(nodes =>
        nodes.map(node => ({ id: node.id, value: node.value, checked: node.checked })));
    const before = await inputs();
    await handle.page.locator('button[data-action="search-customer"]').press('Enter');
    await visible(handle, '#searchResultsView', 'Installed search action returns to results');
    await visible(handle, '#paginatedResults .result-row', 'The returned search has actual visible result rows');
    handle.child.check('Returning through installed search preserves the query controls', JSON.stringify(await inputs()), JSON.stringify(before), metaFor(handle), 10);
}

export async function attachObservationEvidence(handle, criterionId, names) {
    assert.equal(new Set(names).size, names.length);
    const prior = handle.observations.find(item => item.criterionId === criterionId);
    assert.ok(prior, 'The source criterion must have completed before evidence reuse.');
    const report = JSON.parse(await physicalArtifact(prior.report, 'Earlier actual criterion'));
    assert.equal(report.marker, 'theme_audit'); assert.equal(report.sourceCommit, handle.release.source.commit); assert.equal(report.criterionId, criterionId);
    const observations = names.map(name => {
        const found = handle.child.report.observations.filter(item => item.name === name);
        assert.equal(found.length, 1, `Expected one exact actual observation: ${name}`);
        assert.ok(found[0].filename); return found[0];
    });
    const images = observations.map(item => {
        const filename = path.join(handle.child.evidenceDir, item.filename);
        const image = prior.images.find(image => image.path === filename);
        assert.ok(image, `The prior criterion must already bind the actual ${item.name} PNG.`); return image;
    });
    for (const image of images) await physicalArtifact(image, 'Earlier actual observation image');
    const checks = report.checks.filter(check => names.includes(check.state));
    for (const name of names) assert.ok(checks.some(check => check.state === name), `Missing actual check references for ${name}`);
    assert.ok(checks.every(check => check.passed === true && prior.checkRefs.includes(check.id)), 'Only original positive check IDs may be reused.');
    const evidence = { criterionId, report: prior.report, checkRefs: checks.map(check => check.id), images, observations, checks };
    handle.reusedEvidence ||= []; handle.reusedEvidence.push(evidence);
    return evidence;
}
