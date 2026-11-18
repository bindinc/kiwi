import { createHash } from 'node:crypto';
import * as nodePath from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { inspectSubscriptionKeyboard } from '../../scripts/compose-smoke-theme-audit-subscription-acceptance.mjs';
import { createFinalDriver, finalContextOptions, finalNativeGroups, prepareFinalDriver, loadVerifiedFinalHooks, validateFinalMode, validateFinalSourceInventory, verifyFinalRelease } from '../../scripts/compose-smoke-theme-audit-final-driver.mjs';
import { finalAuditAreas, finalReleaseIdentity } from '../../scripts/compose-smoke-theme-audit-final.mjs';

// Synthetic metadata and in-memory sessions only: these tests cannot accept source, roles, zoom or pixels.
const hash = 'a'.repeat(64), commit = 'b'.repeat(40);
const artifact = name => ({ path: `/synthetic-unit-evidence/${name}`, sha256: hash });
const release = () => ({
    slice09: { phase: 'after', status: 'accepted', evidence: artifact('accepted09.json') },
    source: { commit, manifest: artifact('source.json'), runtime: artifact('runtime.json'), helpers: artifact('helpers.json') },
    reference: { original: { ...artifact('original.html'), sha256: '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4' },
        refined: { ...artifact('refined.html'), sha256: '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb' } },
    sdk: { ...artifact('sdk.js'), sha256: '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c' }
});
const env = () => ({ KIWI_THEME_AUDIT_FINAL_ONLY: '1', KIWI_THEME_AUDIT_SLICE: '10', KIWI_THEME_APP_ROOT: '/synthetic-source',
    KIWI_THEME_FINAL_RELEASE: '/synthetic-unit-evidence/release.json', KIWI_THEME_FINAL_RELEASE_SHA256: hash,
    ...Object.fromEntries(['SHELL', 'CUSTOMER', 'SUBSCRIPTION', 'ARTICLE', 'SERVICE', 'OVERLAY', 'OPERATIONAL'].map(name => [`KIWI_THEME_AUDIT_${name}_PHASE`, 'after'])) });
const descriptor = () => ({ id: 'synthetic-session', locale: 'nl', role: 'kiwi-admin', viewport: { width: 390, height: 1000 },
    hasTouch: false, reducedMotion: 'reduce', native: false });
const contract = () => Object.fromEntries(['shell', 'customer', 'subscription', 'subscriptionTitle', 'subscriptionHeading',
    'subscriptionInput', 'subscriptionCaption', 'inputFocus', 'selectFocus'].map(key => [key, { syntheticUnitContract: true }]));

function setup({ fail, outcome = 'verified', omitCriterion = false, navigateDuringPrepare = false, verification, nativeError } = {}) {
    const calls = [], contexts = [], declaration = release();
    const operationalAfter = { phase: 'after', sourceCommit: commit, evidence: artifact('operational-after.json') };
    declaration.operationalAfter = operationalAfter;
    const driver = { browserName: 'chromium', report: {}, check() {}, capture() {}, painted() {}, trackStylesheets() {},
        async saveReport() { calls.push('save'); },
        login() { throw new Error('Generic login must never run under the final transport.'); },
        async newFinalContext(options) {
            calls.push('context'); finalContextOptions(options);
            const page = { address: 'about:blank', url() { return this.address; } };
            const context = { page, closes: 0, async newPage() { return page; }, async close() { this.closes++; calls.push('close'); } };
            contexts.push(context); return context;
        }
    };
    const hooks = {
        operationalAfter,
        async verifyRelease({ releaseId }) { calls.push('release'); return { releaseId, evidence: artifact('verification.json') }; },
        async prepareSession({ page, descriptor }) {
            calls.push(`prepare:${descriptor.role}:${descriptor.locale}`);
            assert.equal(page.url(), 'about:blank');
            if (navigateDuringPrepare) page.address = 'https://synthetic.invalid/too-early';
            if (fail === 'prepare') throw new Error('Synthetic preparation failure');
            return { installedBeforeNavigation: true };
        },
        async loginSession(handle) {
            calls.push('login'); assert.equal(handle.owned.installedBeforeNavigation, true);
            if (fail === 'login') throw new Error('Synthetic login failure');
            handle.page.address = 'https://synthetic.invalid/kiwi/';
        },
        async verifySession(handle, { releaseId, cell, native }) {
            calls.push('verify-session'); assert.equal(handle.page.url(), 'https://synthetic.invalid/kiwi/');
            if (fail === 'verify') throw new Error('Synthetic served-source failure');
            return { sourceReleaseId: releaseId, environment: { ...cell.environment, ...(native ? { width: 1440, height: 1000 } : {}), browserVersion: 'unit-no-browser' },
                proofs: { source: artifact('served-source.json'), environment: artifact('environment.json'),
                    role: { kind: 'actual-oidc-server-render', artifact: artifact('role.json') } } };
        },
        async finishSession() { calls.push('finish'); },
        async inspectNative(handle, { group, geometry }) {
            calls.push(`native:${group}`); assert.equal(handle.descriptor.native, true);
            if (nativeError) throw nativeError;
            assert.equal(driver.contract, geometry.contract);
        },
        scenes: Object.fromEntries(finalAuditAreas.map(area => [area.id, async (handle, { cell }) => {
            calls.push(`scene:${area.id}`); assert.equal(handle.page.url(), 'https://synthetic.invalid/kiwi/');
            if (fail === 'scene') throw new Error('Synthetic scene failure');
            return area.criteria.slice(omitCriterion ? 1 : 0).map(criterionId => ({
                id: `${cell.id}/${criterionId}`, criterionId, state: 'synthetic-unit-state', kind: 'intercepted-fixture-flow', outcome,
                report: artifact('scene-report.json'), checkRefs: [criterionId], images: [{ id: `${cell.id}/frame`, ...artifact('frame.png') }]
            }));
        }]))
    };
    const ownerVerification = { releaseId: finalReleaseIdentity(declaration), evidence: artifact('owner-prelaunch-verification.json') };
    return { calls, contexts, hooks, driver, declaration, ownerVerification, bridge: createFinalDriver({ release: declaration, hooks, ownerVerification, verification }, driver) };
}

test('safe driver import ignores executable runner configuration', async () => {
    const previous = process.env.PLAYWRIGHT_MODULE_PATH;
    process.env.PLAYWRIGHT_MODULE_PATH = '/must-not-load';
    try {
        const url = new URL('../../scripts/compose-smoke-theme-audit-final-driver.mjs?synthetic-safe-import', import.meta.url);
        const module = await import(url.href);
        assert.equal(module.finalNativeGroups.length, 5);
    } finally {
        if (previous === undefined) delete process.env.PLAYWRIGHT_MODULE_PATH;
        else process.env.PLAYWRIGHT_MODULE_PATH = previous;
    }
});

test('explicit final-only mode and exact native-only mode validate without mutating environment', () => {
    const value = env(), before = structuredClone(value);
    assert.deepEqual(validateFinalMode(value, new URL('https://bdc.rtvmedia.org.local:9444/kiwi/')), { native: false });
    assert.deepEqual(value, before);
    value.KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY = '1';
    assert.deepEqual(validateFinalMode(value, new URL('https://localhost/kiwi-preview/')), { native: true });
});

test('old modes, mixed phases, missing release and unsafe base URLs fail before any adapter import', async () => {
    const invalid = [
        value => { value.KIWI_THEME_AUDIT_FINAL_ONLY = '0'; }, value => { value.KIWI_THEME_AUDIT_SLICE = '9'; },
        value => { value.KIWI_THEME_AUDIT_FINAL_SOURCE = '1'; }, value => { value.KIWI_THEME_AUDIT_NATIVE_ZOOM = '1'; },
        value => { delete value.KIWI_THEME_APP_ROOT; }, value => { delete value.KIWI_THEME_FINAL_RELEASE_SHA256; },
        ...['SHELL', 'CUSTOMER', 'SUBSCRIPTION', 'ARTICLE', 'SERVICE', 'OVERLAY', 'OPERATIONAL'].map(name => value => { value[`KIWI_THEME_AUDIT_${name}_PHASE`] = 'before'; }),
        ...['CONTROLS', 'SHELL', 'CUSTOMER', 'SUBSCRIPTION', 'ARTICLE', 'SERVICE', 'OVERLAY', 'CUSTOMER_LOOKUP'].map(name => value => { value[`KIWI_THEME_AUDIT_${name}_ONLY`] = '1'; })
    ];
    let imports = 0;
    for (const change of invalid) {
        const value = env(); change(value);
        await assert.rejects(prepareFinalDriver({ env: value, baseUrl: new URL('https://localhost/kiwi/'), loadModule() { imports++; } }));
    }
    for (const url of ['https://production.invalid/kiwi/', 'https://localhost/kiwi/?private=value', 'https://localhost/kiwi/#fragment',
        'https://name:secret@localhost/kiwi/', 'file:///kiwi/', 'https://localhost/other/']) assert.throws(() => validateFinalMode(env(), new URL(url)));
    assert.equal(imports, 0);
});

test('unaccepted09, unaccepted icons and absent final commit are rejected before file reads', async () => {
    const options = { sourceRoot: '/unreadable', toolingRoot: '/unreadable', baseUrl: new URL('https://localhost/kiwi/') };
    for (const declaration of [{ marker: 'theme_audit', slice: 10, phase: 'after' },
        { marker: 'theme_audit', slice: 10, phase: 'after', slice09: { phase: 'after', status: 'accepted' } },
        { marker: 'theme_audit', slice: 10, phase: 'after', slice09: { phase: 'after', status: 'accepted' }, icons: { status: 'accepted' } }]) {
        await assert.rejects(verifyFinalRelease(declaration, options));
    }
});

test('context options enumerate locale, real role, touch and motion without arbitrary spreads', () => {
    const options = finalContextOptions({ ...descriptor(), role: 'kiwi-view', locale: 'en', hasTouch: true, reducedMotion: 'no-preference', unsafeExtra: true });
    assert.deepEqual(options, { ignoreHTTPSErrors: true, serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/Amsterdam', hasTouch: true,
        reducedMotion: 'no-preference', viewport: { width: 390, height: 1000 }, deviceScaleFactor: 1 });
    const native = finalContextOptions({ ...descriptor(), native: true });
    assert.equal(native.viewport, null); assert.equal('deviceScaleFactor' in native, false);
    for (const delta of [{ locale: 'fr' }, { role: 'made-up-role' }, { hasTouch: 'true' }, { reducedMotion: 'fast' }, { native: 1 }, { viewport: { width: 200, height: 1000 } }]) {
        assert.throws(() => finalContextOptions({ ...descriptor(), ...delta }));
    }
});

test('each final viewport dispatches all13 areas and prepares transport before its owned login', async () => {
    const { bridge, calls, contexts, driver } = setup();
    const result = await bridge.viewport({ width: 1440, height: 1000 }, contract());
    assert.equal(contexts.length, 13); assert.ok(contexts.every(context => context.closes === 1));
    for (let index = 0; index < finalAuditAreas.length; index++) {
        const offset = calls.indexOf(`scene:${finalAuditAreas[index].id}`);
        assert.deepEqual(calls.slice(offset - 3, offset), ['prepare:kiwi-admin:nl', 'login', 'verify-session']);
    }
    assert.equal(driver.report.finalAudit.cells.filter(cell => cell.evidence.length).length, 13);
    assert.ok(driver.report.finalAudit.cells.every(cell => cell.status === 'not reviewed'));
    assert.equal(result.finalAcceptance, false); assert.equal(result.baselineAccepted, false);
});

for (const fail of ['prepare', 'login', 'verify', 'scene']) test(`failed ${fail} retains failure evidence and releases its context`, async () => {
    const { bridge, contexts, calls, driver } = setup({ fail });
    await assert.rejects(bridge.viewport({ width: 1440, height: 1000 }, contract()));
    assert.equal(contexts.length, 1); assert.equal(contexts[0].closes, 1);
    assert.equal(calls.filter(value => value === 'finish').length, 1);
    assert.equal(driver.report.finalAudit.errors.length, 1);
});

test('preparation cannot navigate before arming authentication and source listeners', async () => {
    const { bridge, contexts, calls } = setup({ navigateDuringPrepare: true });
    await assert.rejects(bridge.viewport({ width: 1440, height: 1000 }, contract()), /must not navigate/);
    assert.equal(calls.includes('login'), false); assert.equal(contexts[0].closes, 1);
});

test('missing measured contract rejects before opening any session', async () => {
    const { bridge, contexts } = setup();
    const incomplete = contract(); delete incomplete.subscriptionCaption;
    await assert.rejects(bridge.viewport({ width: 1440, height: 1000 }, incomplete), /Missing measured reference/);
    assert.equal(contexts.length, 0);
});

for (const change of [{ omitCriterion: true }, { outcome: 'deviation' }, { outcome: 'unverified' }]) test(`partial or failed criteria stop the finite dispatch: ${JSON.stringify(change)}`, async () => {
    const { bridge, contexts, driver } = setup(change);
    await assert.rejects(bridge.viewport({ width: 1440, height: 1000 }, contract()));
    assert.equal(contexts.length, 1); assert.equal(contexts[0].closes, 1);
    assert.equal(driver.report.finalAudit.cells.filter(cell => cell.evidence.length).length, 1);
    assert.ok(driver.report.finalAudit.cells.every(cell => cell.status === 'not reviewed'));
});

test('five finite native groups use preparation then owned login and the same zoomed page', async () => {
    const { bridge, driver, calls } = setup();
    assert.equal(finalNativeGroups.length, 5); assert.equal(new Set(finalNativeGroups).size, 5);
    for (const group of finalNativeGroups) {
        const context = await driver.newFinalContext({ ...descriptor(), native: true });
        const page = await context.newPage();
        const native = await bridge.prepareNative(page, context, group, contract());
        assert.equal(page.url(), 'about:blank');
        await native.login(); await native.inspect({ contract: contract(), before: { dpr: 1 }, zoomed: { dpr: 2 } }); await native.finish();
        assert.ok(calls.includes(`native:${group}`));
    }
    assert.equal(calls.filter(value => value === 'login').length, 5);
});

test('native failed preparation closes its context without reaching generic login', async () => {
    const { bridge, driver, calls } = setup({ fail: 'prepare' });
    const context = await driver.newFinalContext({ ...descriptor(), native: true });
    await assert.rejects(bridge.prepareNative(await context.newPage(), context, finalNativeGroups[0], contract()));
    assert.equal(context.closes, 1); assert.equal(calls.includes('login'), false);
});

test('dynamic complete inventory accepts newly integrated icon files and rejects missing, extra, duplicate or changed bodies', () => {
    const entries = ['assets/specimen.js', 'templates/specimen.twig', 'src/Specimen.php', 'assets/icons/new-icon.svg']
        .map(path => ({ path, sha256: hash, bytes: 12 }));
    const source = { productionCount: entries.length, source: entries };
    const runtime = structuredClone(source), paths = entries.map(entry => entry.path);
    assert.equal(validateFinalSourceInventory(source, runtime, paths, paths), 4);
    const cases = [
        (a, b, disk) => { disk.pop(); }, (a, b, disk, tracked) => { tracked.push('assets/unfrozen.svg'); },
        a => { a.source.pop(); }, a => { a.source.push({ ...a.source[0] }); },
        a => { a.productionCount = 214; }, (a, b) => { b.source[0].sha256 = 'c'.repeat(64); },
        (a, b) => { b.productionCount--; }, (a, b) => { b.source.pop(); }
    ];
    for (const change of cases) {
        const a = structuredClone(source), b = structuredClone(runtime), disk = [...paths], tracked = [...paths];
        change(a, b, disk, tracked);
        assert.throws(() => validateFinalSourceInventory(a, b, disk, tracked));
    }
});


function actualMeasureInSeparateBrowserRealm(source, requestedFinalMode) {
    const start = source.indexOf('async function measure('), end = source.indexOf('async function painted(', start);
    assert.ok(start >= 0 && end > start);
    const measure = runInNewContext(`(${source.slice(start, end)})`, { finalOnly: requestedFinalMode });
    const style = new Proxy({}, { get: (_, key) => key === 'outlineOffset' ? '0px' : `synthetic-${key}` });
    const element = { getBoundingClientRect: () => ({ width: 240, height: 40, left: 10, right: 250, top: 20, bottom: 60 }), scrollWidth: 240, clientWidth: 240 };
    const page = { locator() { return { first() { return { evaluate(callback, argument) {
        // Playwright serializes evaluate callbacks into another realm without Node closure bindings.
        return runInNewContext(`(${callback.toString()})(element, argument)`, { element, argument, getComputedStyle: () => style });
    } }; } }; } };
    return measure(page, '#synthetic-control');
}

test('actual main measurement callback executes in an isolated browser realm in legacy and final modes', async () => {
    const source = readFileSync(new URL('../../scripts/compose-smoke-theme-audit.mjs', import.meta.url), 'utf8');
    for (const finalMode of [false, true]) {
        const measured = await actualMeasureInSeparateBrowserRealm(source, finalMode);
        assert.equal(measured.fontFamily, 'synthetic-fontFamily');
        assert.equal(measured.width, 240); assert.equal(measured.height, 40);
        assert.equal(measured.scrollWidth, 240);
        assert.equal(measured.outlineWidth, 'synthetic-outlineWidth');
    }
});

async function ownerPreflight(fixture, trace, override) {
    const hooks = { ...fixture.hooks, verifyRelease: override || (async ({ releaseId }) => {
        trace.push('owner-verify'); return { releaseId, evidence: artifact('synthetic-owner-proof.json') };
    }) };
    return loadVerifiedFinalHooks({ release: fixture.declaration, verification: { syntheticUnitOnly: true },
        adapterUrl: 'file:///synthetic-unit-evidence/scenes.mjs',
        loadModule: async () => ({ createFinalSceneHooks: async () => { trace.push('factory'); return hooks; } }),
        verifyArtifact: async () => { trace.push('receipt-verified'); return JSON.stringify({ marker: 'theme_audit', status: 'verified',
            releaseId: finalReleaseIdentity(fixture.declaration), sourceCommit: commit }); } });
}

for (const native of [false, true]) test(`owner release rejection blocks launch in ${native ? 'native' : 'baseline'} mode`, async () => {
    const fixture = setup(), trace = [];
    const mode = env(); if (native) mode.KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY = '1';
    validateFinalMode(mode, new URL('https://localhost/kiwi/'));
    await assert.rejects(ownerPreflight(fixture, trace, async () => { trace.push('owner-reject'); throw new Error('Synthetic owner rejected release'); })
        .then(() => { trace.push('browser-launch'); }), /owner rejected/);
    assert.deepEqual(trace, ['factory', 'owner-reject']);
    assert.equal(fixture.contexts.length, 0);
});

test('preflight awaits the actual delayed owner receipt and validates it before launch', async () => {
    const fixture = setup(), trace = [];
    let resolve;
    const pending = ownerPreflight(fixture, trace, () => new Promise(done => { trace.push('owner-wait'); resolve = done; }))
        .then(configuration => { trace.push('browser-launch'); return configuration; });
    await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(trace, ['factory', 'owner-wait']);
    resolve({ releaseId: finalReleaseIdentity(fixture.declaration), evidence: artifact('synthetic-owner-proof.json') });
    const configuration = await pending;
    assert.deepEqual(trace, ['factory', 'owner-wait', 'receipt-verified', 'browser-launch']);
    assert.equal(configuration.ownerVerification.releaseId, finalReleaseIdentity(fixture.declaration));
});

test('wrong owner receipt identity and absent owner receipt cannot open native or baseline contexts', async () => {
    const fixture = setup(), trace = [];
    await assert.rejects(ownerPreflight(fixture, trace, async () => ({ releaseId: 'wrong', evidence: artifact('wrong-owner-proof.json') })), /match the complete final release/);
    assert.throws(() => createFinalDriver({ release: fixture.declaration, hooks: fixture.hooks }, fixture.driver), /match the complete final release/);
    assert.equal(fixture.contexts.length, 0);
    assert.equal(trace.includes('receipt-verified'), false);
});

async function executeActualNativeMain({ geometryFailure, rejectSessionProof = false, nativeError } = {}) {
    const fixture = setup({ fail: rejectSessionProof ? 'verify' : undefined, nativeError });
    fixture.driver.browserName = 'firefox';
    const report = fixture.driver.report;
    report.errors = []; report.checks = [];
    let geometryReads = 0;
    const before = { innerWidth: 1440, innerHeight: 1000, outerWidth: 1440, outerHeight: 1100, dpr: 1, pinchScale: 1 };
    const zoomed = { innerWidth: 720, innerHeight: 500, outerWidth: 720, outerHeight: 550, dpr: 2, pinchScale: 1 };
    const browser = { async newContext() {
        const context = await fixture.driver.newFinalContext({ ...descriptor(), native: true });
        context.route = async () => {};
        context.page.setDefaultTimeout = () => {};
        context.page.bringToFront = async () => {};
        let reads = 0;
        context.page.evaluate = async () => {
            geometryReads++; reads++;
            if (geometryFailure === 'initial200') return before;
            if (reads === 1) return before;
            if (reads === 2 || geometryFailure === 'reset100') return zoomed;
            return before;
        };
        return context;
    } };
    const source = readFileSync(new URL('../../scripts/compose-smoke-theme-audit.mjs', import.meta.url), 'utf8');
    const helperStart = source.indexOf('async function nativeZoomChecks(');
    const helperEnd = source.indexOf('\ntry {\n    if (!nativeZoomOnly)', helperStart);
    const dispatchStart = source.indexOf('    if (nativeZoom) {\n        if (finalOnly)', helperEnd);
    const dispatchEnd = source.indexOf('\n} catch (error)', dispatchStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart && dispatchStart > helperEnd && dispatchEnd > dispatchStart);
    const noop = async () => {};
    const diagnosticSource = source.match(/function nativeFailureDiagnostic\(error\) \{[\s\S]*?\n\}/)?.[0] || '';
    const runtime = runInNewContext(`(async () => { ${diagnosticSource}; ${source.slice(helperStart, helperEnd)}; ${source.slice(dispatchStart, dispatchEnd)} })`, {
        slice: 10, finalOnly: true, nativeZoom: true, browserName: 'firefox', browser, report,
        nativeOverlay: false, nativeSubscription: false, nativeArticle: false, nativeService: false, nativeCustomer: false,
        referenceContract: async () => contract(), finalDriver: fixture.bridge, finalNativeGroups, finalContextOptions,
        baseUrl: new URL('https://synthetic.invalid/kiwi/'), sourceRoot: '/synthetic', evidenceDir: '/synthetic-unit-evidence',
        login: () => { throw new Error('Generic login reached'); }, newContext: noop, normalizeMappedCssUrls: value => value,
        painted: noop, saveReport: noop, trackStylesheets: noop,
        sendNativeZoomKey: reset => fixture.calls.push(reset ? 'os-reset' : 'os-plus'),
        check: (name, actual, expected, meta) => report.checks.push({ name, actual, expected, ...meta }),
        capture: async (_page, name) => { fixture.calls.push(`capture:${name}`); }
    });
    await runtime();
    return { ...fixture, geometryReads };
}

test('actual main native dispatch rejects failed session proof before geometry, captures or inspect', async () => {
    const result = await executeActualNativeMain({ rejectSessionProof: true });
    assert.equal(result.geometryReads, 0);
    assert.equal(result.contexts.length, 1); assert.equal(result.contexts[0].closes, 1);
    assert.equal(result.calls.some(value => value.startsWith('capture:') || value.startsWith('native:')), false);
    assert.ok(result.calls.includes('verify-session')); assert.ok(result.calls.includes('finish'));
    assert.equal(result.driver.report.errors.length, 1);
});

for (const geometryFailure of ['initial200', 'reset100']) test(`actual main stops later native groups after failed ${geometryFailure} and still cleans up`, async () => {
    const result = await executeActualNativeMain({ geometryFailure });
    assert.equal(result.contexts.length, 1); assert.equal(result.contexts[0].closes, 1);
    assert.equal(result.driver.report.errors.length, 1);
    assert.ok(result.calls.includes('finish')); assert.ok(result.calls.includes('os-reset'));
    if (geometryFailure === 'reset100') {
        assert.ok(result.calls.includes(`capture:final-native-${finalNativeGroups[0]}-100-reset`), 'failed reset evidence is retained before throwing');
        assert.ok(result.driver.report.checks.some(item => item.name === 'final native group reset restored100%' && item.actual === false));
    } else assert.equal(result.calls.some(value => value.startsWith('native:')), false);
});

test('actual native main proceeds through five verified groups with valid zoom and reset', async () => {
    const result = await executeActualNativeMain();
    assert.equal(result.contexts.length, 5); assert.ok(result.contexts.every(context => context.closes === 1));
    assert.equal(result.driver.report.errors.length, 0);
    assert.equal(Object.keys(result.driver.report.finalNativeSessions).length, 5);
    for (const group of finalNativeGroups) assert.ok(result.calls.includes(`native:${group}`));
});


test('owner receipt file content must bind the same final release before launch', async () => {
    const fixture = setup(), trace = [];
    await assert.rejects(loadVerifiedFinalHooks({ release: fixture.declaration, verification: { syntheticUnitOnly: true }, adapterUrl: 'file:///synthetic/scenes.mjs',
        loadModule: async () => ({ createFinalSceneHooks: async () => fixture.hooks }),
        verifyArtifact: async () => JSON.stringify({ marker: 'theme_audit', status: 'verified', releaseId: 'wrong-release', sourceCommit: commit })
    }).then(() => { trace.push('browser-launch'); }), /receipt content must bind/);
    assert.deepEqual(trace, []);
});

test('native inspection requires a validated current-source actual-server-role proof', async () => {
    const changes = [proof => { proof.sourceReleaseId = 'wrong-release'; }, proof => { delete proof.proofs.source; },
        proof => { proof.proofs.role.kind = 'capability-fixture'; }, proof => { proof.environment.role = 'kiwi-view'; },
        proof => { proof.environment.native = false; }, proof => { proof.environment.zoom = 200; },
        proof => { proof.environment.hasTouch = true; }];
    for (const change of changes) {
        const fixture = setup(), original = fixture.hooks.verifySession;
        fixture.hooks.verifySession = async (...args) => { const proof = await original(...args); change(proof); return proof; };
        const context = await fixture.driver.newFinalContext({ ...descriptor(), native: true });
        const native = await fixture.bridge.prepareNative(await context.newPage(), context, finalNativeGroups[0], contract());
        assert.throws(() => native.inspect({ contract: contract() }), /session proof must precede/);
        await assert.rejects(native.login());
        assert.throws(() => native.inspect({ contract: contract() }), /session proof must precede/);
        assert.equal(fixture.calls.some(value => value.startsWith('native:')), false);
        await native.finish(); await context.close();
    }
});

test('viewport preserves the exact measured contract unless a verified native DATE classification is supplied', async () => {
    for (const verification of [undefined, {}, { nativeDateFocus: { syntheticUnitClassification: true } }]) {
        const { bridge, driver } = setup({ verification }), measured = contract();
        await bridge.viewport({ width: 1440, height: 1000 }, measured);
        if (verification?.nativeDateFocus) {
            assert.notEqual(driver.contract, measured);
            assert.equal(driver.contract.nativeDateFocus, verification.nativeDateFocus);
            for (const key of Object.keys(measured)) assert.equal(driver.contract[key], measured[key]);
            assert.equal(Object.hasOwn(measured, 'nativeDateFocus'), false, 'The measured reference remains untouched.');
        } else assert.equal(driver.contract, measured, 'Legacy owners must receive the original measured contract object.');
    }
});

test('native DATE classification requires the exact proved area and width in the existing baseline matrix', async () => {
    const stop = { id: 'subStartDate', tag: 'INPUT', type: 'date', focused: false, focusVisible: false, focusWithin: true };
    const proof = area => ({ area, width: 1440, height: 1000, step: 3, applicationStop: stop });
    async function run({ entries, area = 'A08', width = 1440, extraFocusLoss = false, unreachable = false }) {
        let step = -1, paintedStep = -2; const checks = [], captures = [];
        const page = { locator: () => ({ focus: async () => {} }), keyboard: { press: async key => {
            assert.equal(key, 'Tab');
            if (unreachable && step === 4) assert.ok(captures.some(capture => capture.step === 4
                && capture.name === 'after-subscription-unreachable-focus-step-4'), 'Capture the failed whole frame before the next Tab.');
            step++;
        } },
            evaluate: async probe => {
                assert.equal(paintedStep, step, 'Measure only after painting the current Tab stop.');
                const date = step === 3, cancel = step === 6;
                const hostFocused = !date && !(extraFocusLoss && step === 2);
                const node = { id: step === 0 ? 'werfsleutelInput' : date ? 'subStartDate' : 'unit-' + step,
                    tagName: 'INPUT', type: date ? 'date' : 'text', getAttribute: () => null, closest: () => ({}),
                    getBoundingClientRect: () => ({ width: 30, height: 20, x: unreachable && step === 4 ? -5 : 0, right: 30, y: 0, bottom: 20 }),
                    matches(selector) {
                        if (selector === ':focus-within') return true;
                        if (selector === ':focus-visible' || selector === ':focus') return hostFocused;
                        return selector === '#subscriptionForm .form-actions [data-action="close-form"]' && cancel;
                    } };
                return runInNewContext('(' + probe.toString() + ')()', {
                    document: { activeElement: node }, innerWidth: width, innerHeight: 1000, devicePixelRatio: 1,
                    visualViewport: { scale: 1 }, getComputedStyle: () => ({ outline: 'none', outlineWidth: '0px', outlineStyle: 'none' })
                });
            } };
        const driver = { browserName: 'chromium', contract: { nativeDateFocus: { sourceCommit: commit, browserVersion: 'synthetic-browser', entries } },
            report: { slice: 10, phase: 'after', application: { commit }, environment: { browserVersion: 'synthetic-browser' }, subscriptionAcceptance: { interactions: [] } },
            // The test source supplies synthetic capture bytes, never visual evidence.
            capture: async (actualPage, name) => { assert.equal(actualPage, page); captures.push({ step, name }); return fileURLToPath(import.meta.url); },
            painted: async actualPage => { assert.equal(actualPage, page); paintedStep = step; },
            check: (name, actual, expected, detail) => {
                checks.push({ name, actual, detail });
                if (unreachable) {
                    assert.deepEqual({ ...detail.path[4].bounds }, { x: -5, y: 0, width: 30, height: 20, right: 30, bottom: 20 });
                    assert.deepEqual({ ...detail.path[4].viewport }, { width, height: 1000 });
                    assert.equal(detail.path[4].reachable, false);
                }
                assert.equal(actual, expected, name);
            } };
        await inspectSubscriptionKeyboard(page, driver, { native: false, locale: 'nl', prefix: `${area}-chromium-${width}x1000-` });
        return { check: checks[0], interaction: driver.report.subscriptionAcceptance.interactions[0] };
    }
    const result = await run({ entries: [{ ...proof('A05'), step: 2 }, proof('A08')] });
    assert.equal(result.check.detail.legacyHostFocusPassed, false);
    assert.equal(result.check.detail.nativeInternalFocus.actual.focusVisible, false);
    assert.equal(result.interaction.keyboardPath[3].focused, false);
    assert.match(result.check.detail.nativeInternalFocus.independentCurrentWholeImageReview, /^not reviewed/);
    await run({ entries: [proof('A05')], area: 'A05' });
    for (const options of [
        { entries: [proof('A05')] },
        { entries: [proof('A08')], area: 'A05' },
        { entries: [proof('A07')], area: 'A07' },
        { entries: [proof('A08')], width: 390 },
        { entries: [proof('A08')], extraFocusLoss: true },
        { entries: [proof('A08')], unreachable: true }
    ]) await assert.rejects(run(options), /final-only Tab route/);
});


function actualNativeFailureDiagnostic() {
    const source = readFileSync(new URL('../../scripts/compose-smoke-theme-audit.mjs', import.meta.url), 'utf8');
    const declaration = source.match(/function nativeFailureDiagnostic\(error\) \{[\s\S]*?\n\}/)?.[0];
    assert.ok(declaration, 'The existing main must expose its actual safe diagnostic helper to this VM seam.');
    return runInNewContext('(' + declaration + ')');
}
function privateNativeFailureFixture() {
    const marker = 'synthetic-private-marker-never-export';
    const error = new Error(marker);
    error.name = 'TimeoutError';
    error.actual = { customer: marker }; error.expected = { authorization: marker }; error.headers = { authorization: marker };
    error.stack = `TimeoutError: ${marker} at /private/${marker}/compose-smoke-theme-audit.mjs:999:99\n`
        + `    at privateFunction_${marker} (file:///private/${marker}/compose-smoke-theme-audit-operational-feedback.mjs:150:71)\n`
        + `    at secret_${marker} (file:///private/${marker}/not-an-allowed-source.mjs:12:9)\n`
        + `    at runArea (file:///private/${marker}/compose-smoke-theme-audit-final-scenes.mjs:594:3)\n`
        + `Authorization: ${marker}\n`;
    return { marker, error };
}

test('actual native diagnostic emits only enum and allowlisted source coordinates, never error text or private paths', () => {
    const diagnostic = actualNativeFailureDiagnostic(), { marker, error } = privateNativeFailureFixture();
    const observed = JSON.parse(JSON.stringify(diagnostic(error)));
    assert.deepEqual(observed, { name: 'TimeoutError', frames: [
        { file: 'compose-smoke-theme-audit-operational-feedback.mjs', line: 150, column: 71 },
        { file: 'compose-smoke-theme-audit-final-scenes.mjs', line: 594, column: 3 }
    ] });
    const withCallLog = { ...error, stack: error.stack.split('\n')[0] + '\n'
        + Array.from({ length: 30 }, () => '  waiting for the existing locator; no source metadata').join('\n')
        + '\n' + error.stack.split('\n').slice(1).join('\n') };
    assert.deepEqual(JSON.parse(JSON.stringify(diagnostic(withCallLog))), observed, 'Playwright call-log lines cannot hide the actual safe source frame.');
    const serialized = JSON.stringify(observed);
    for (const privatePart of [marker, 'file://', '/private/', 'Authorization', 'actual', 'expected', 'headers', 'privateFunction', 'not-an-allowed-source']) {
        assert.equal(serialized.includes(privatePart), false, 'Only safe public frame fields may be exported.');
    }
    error.name = marker;
    assert.equal(diagnostic(error).name, 'Error', 'Unrecognized names cannot carry private text.');
    for (const value of [null, undefined, marker, { name: marker, stack: {} }]) {
        assert.deepEqual(JSON.parse(JSON.stringify(diagnostic(value))), { name: 'Error', frames: [] });
    }
    error.stack = `at /private/compose-smoke-theme-audit.mjs:999:99\n`
        + `    at unknown (/private/not-an-allowed-source.mjs:3:4)\n`
        + `    at zero (/private/compose-smoke-theme-audit.mjs:0:4)\n`
        + `    at huge (/private/compose-smoke-theme-audit.mjs:4:1000001)\n`
        + Array.from({ length: 8 }, (_, index) => `    at known (/private/compose-smoke-theme-audit.mjs:${index + 1}:2)`).join('\n');
    const bounded = JSON.parse(JSON.stringify(diagnostic(error)));
    assert.equal(bounded.frames.length, 5);
    assert.deepEqual(bounded.frames.map(frame => frame.line), [1, 2, 3, 4, 5], 'First-line, unknown-file and invalid-coordinate frames stay excluded.');
});

test('actual native main failure keeps safe diagnostic only and still stops later groups and closes its context', async () => {
    const { marker, error } = privateNativeFailureFixture();
    const result = await executeActualNativeMain({ nativeError: error });
    assert.equal(result.contexts.length, 1); assert.equal(result.contexts[0].closes, 1);
    assert.equal(result.calls.filter(value => value.startsWith('native:')).length, 1);
    assert.ok(result.calls.includes('finish')); assert.ok(result.calls.includes('os-reset'));
    assert.equal(result.driver.report.errors.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(result.driver.report.errors[0].diagnostic)), { name: 'TimeoutError', frames: [
        { file: 'compose-smoke-theme-audit-operational-feedback.mjs', line: 150, column: 71 },
        { file: 'compose-smoke-theme-audit-final-scenes.mjs', line: 594, column: 3 }
    ] });
    const serialized = JSON.stringify(result.driver.report);
    for (const privatePart of [marker, 'Authorization', '/private/', 'privateFunction']) assert.equal(serialized.includes(privatePart), false);
});


test('actual native diagnostic snapshots changing name and stack getters once before validation', () => {
    const diagnostic = actualNativeFailureDiagnostic(), marker = 'synthetic-private-getter-marker';
    let nameReads = 0, stackReads = 0;
    const error = {
        get name() { nameReads++; return nameReads === 1 ? 'TimeoutError' : marker; },
        get stack() {
            stackReads++;
            return stackReads === 1
                ? `TimeoutError: ${marker}\n    at private_${marker} (file:///private/${marker}/compose-smoke-theme-audit-operational-feedback.mjs:150:71)`
                : `Error: ${marker}\n    at private_${marker} (file:///private/${marker}/not-an-allowed-source.mjs:12:9)`;
        }
    };
    const observed = JSON.parse(JSON.stringify(diagnostic(error)));
    assert.deepEqual(observed, { name: 'TimeoutError', frames: [
        { file: 'compose-smoke-theme-audit-operational-feedback.mjs', line: 150, column: 71 }
    ] });
    assert.equal(nameReads, 1); assert.equal(stackReads, 1);
    assert.equal(JSON.stringify(observed).includes(marker), false);
});

test('optional nativeOS200 proof binds release identity and preserves legacy native contract identity when absent', async () => {
    const measured = contract(), group = 'subscription-service-native-date';
    for (const verified of [undefined, { nativeDateFocus: { entries: [] } },
        { nativeDateFocus: { entries: [], nativeOS200: { group, syntheticUnitOnly: true } } }]) {
        const h = setup({ verification: verified });
        let preparedContract;
        const prepare = h.hooks.prepareSession;
        h.hooks.prepareSession = async (...args) => { preparedContract = h.driver.contract; return prepare(...args); };
        h.hooks.inspectNative = async (_handle, { geometry }) => {
            if (verified?.nativeDateFocus?.nativeOS200) {
                assert.equal(h.driver.contract.nativeDateFocus, verified.nativeDateFocus);
                for (const key of Object.keys(geometry.contract)) assert.equal(h.driver.contract[key], geometry.contract[key]);
            } else assert.equal(h.driver.contract, geometry.contract);
        };
        const context = await h.driver.newFinalContext({ ...descriptor(), native: true });
        const native = await h.bridge.prepareNative(await context.newPage(), context, group, measured);
        if (verified?.nativeDateFocus?.nativeOS200) {
            assert.notEqual(preparedContract, measured);
            assert.equal(preparedContract.nativeDateFocus, verified.nativeDateFocus);
        } else assert.equal(preparedContract, measured, 'No optional OS200 proof means exact old contract object.');
        await native.login();
        await native.inspect({ contract: measured });
        if (verified?.nativeDateFocus?.nativeOS200) assert.equal(h.driver.contract.nativeDateFocus, verified.nativeDateFocus);
        else assert.equal(h.driver.contract, measured);
        assert.equal(Object.hasOwn(measured, 'nativeDateFocus'), false);
        await native.finish(); await context.close();
    }
});

test('physical nativeOS200 verifier retains exact metadata, source, focus, geometry and image boundaries', async () => {
    // Actual verifier body with synthetic artifact I/O seams, never physical or visual acceptance.
    const source = readFileSync(new URL('../../scripts/compose-smoke-theme-audit-final-driver.mjs', import.meta.url), 'utf8');
    const start = source.indexOf('export async function verifyFinalNativeOS200DateFocus(');
    const end = source.indexOf('\nexport async function verifyFinalRelease(', start);
    const body = source.slice(start, end).replace('export ', '');
    const digest = bytes => createHash('sha256').update(bytes).digest('hex');
    function model() {
        const before = { innerWidth: 1050, innerHeight: 1093, outerWidth: 1050, outerHeight: 1180, dpr: 1, pinchScale: 1 };
        const zoomed = { innerWidth: 525, innerHeight: 546, outerWidth: 1050, outerHeight: 1180, dpr: 2, pinchScale: 1 };
        const geometry = { before, zoomed, increments: 5, nativeRatioVerified: true, reset: before, resetVerified: true };
        const pin = name => ({ path: '/synthetic-native-unit/' + name, sha256: hash });
        const proof = { paired: pin('pair'), review: pin('review') };
        const observedPin = { ...pin('source'), sha256: '519893b7821d607f8d71efe35d5bbbf3aef9dc0cd53a231e1d0e05670ac1b3d4' };
        const browser = { name: 'chromium', version: '158.0.8127.36', executable: '/usr/bin/google-chrome' };
        const image = pin('application.png'), referenceImage = pin('reference.png');
        const appReport = pin('application'), refReport = pin('reference');
        const path = Array.from({ length: 58 }, (_, index) => ({ id: index === 0 ? 'werfsleutelInput' : index === 55 ? 'subStartDate' : 'unit-' + index,
            tag: 'INPUT', type: index === 55 ? 'date' : 'text', focused: index !== 55, focusVisible: index !== 55, focusWithin: true,
            withinForm: true, reachable: true, cancel: index === 57, outlineStyle: index === 55 ? 'none' : 'solid', outlineWidth: index === 55 ? 3 : 2 }));
        const stop = path[55];
        const observed = { head: '7b0f734f71a38ae8363ecdef27bc829f8d774a7b', productionCount: 216,
            referenceSha256: release().reference.refined.sha256,
            source: Array.from({ length: 216 }, (_, index) => {
                const bytes = Buffer.from('Synthetic source body ' + index);
                return { path: 'assets/unit-' + index, sha256: digest(bytes), bytes: bytes.length };
            }) };
        const prefix = 'subscription-service-native-date-';
        const capture = { name: prefix + 'native-200-subscription-native-date-focus-step-55', filename: 'application.png',
            captureMethod: 'actual 1600x1200 Xvfb desktop via ffmpeg x11grab',
            geometry: { viewportWidth: 525, viewportHeight: 546, devicePixelRatio: 2, visualViewportScale: 1 } };
        const application = { environment: { browser: browser.name, browserVersion: browser.version }, application: { commit: observed.head },
            checks: [{ name: 'native 200% browser zoom verified', actual: true, expected: true, status: 'verified', before, zoomed, increments: 5 },
                { name: prefix + 'actual native Tab traverses subscription controls to Cancel within the visible viewport', actual: false, expected: true,
                    status: 'deviation', native: true, locale: 'nl', prefix, viewport: { width: 525, height: 546 }, path }], captures: [capture] };
        const referenceStop = { index: 3, state: { active: { id: 'demo-start-date', tag: 'INPUT', type: 'date' },
            host: { focused: false, focusVisible: false, focusWithin: true, outlineStyle: 'none' },
            viewport: { width: 525, height: 546, dpr: 2, pinchScale: 1 } }, image: referenceImage };
        const reference = { browser, reference: release().reference.refined, referenceSha256After: release().reference.refined.sha256,
            status: 'observed-awaiting-physical-pair-and-independent-classification', errors: [], initialFormValues: [], finalFormValues: [], geometry,
            steps: [null, null, null, referenceStop], internalStops: [referenceStop],
            captures: [{ name: 'reference-date-stop-3', image: referenceImage, geometry: zoomed,
                captureMethod: 'Actual1600x1200wholeX11desktop, no crop or protocolzoom substitution.' }] };
        const pair = { marker: 'theme_audit', application: { report: appReport, image, browserVersion: browser.version,
            sourceCommit: observed.head, rawDateStop55: stop, beforeGeometry: before, zoomedGeometry: zoomed }, referenceReport: refReport,
            resetVerified: true, internalStops: [referenceStop] };
        const review = { marker: 'theme_audit', status: 'MATCHED_REFERENCE_NATIVE_OS200_INTERNAL_FOCUS_BEHAVIOR; ORIGINAL_A05_GATE_REMAINS_FAILED',
            reviewer: 'Synthetic unit reviewer', pairedArtifact: proof.paired, applicationArea: 'A05', nativeGroup: 'subscription-service-native-date',
            applicationReport: appReport, referenceReport: refReport, observedApplicationSource: observedPin, browser,
            applicationStopIndex: 55, referenceStopIndex: 3, rawApplicationStop: stop, nativeGeometry: geometry,
            personallyViewedWholeImages: [image, referenceImage] };
        const png = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(png); png.writeUInt32BE(1600, 16); png.writeUInt32BE(1200, 20);
        const artifacts = new Map([[proof.paired.path, pair], [proof.review.path, review], [observedPin.path, observed],
            [appReport.path, application], [refReport.path, reference], [image.path, png], [referenceImage.path, png],
            [reference.reference.path, Buffer.from('Synthetic immutable reference I/O seam')]]);
        const state = { proof, observed, application, reference, pair, review, png, source: { worktree: '/synthetic-ui', source: structuredClone(observed.source) } };
        state.run = async () => {
            const realmAssert = { ...assert, deepEqual(a, b, message) { assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), message); } };
            const verify = runInNewContext('(' + body + ')', { assert: realmAssert, path: nodePath, Buffer,
                refinedReference: release().reference.refined.sha256, sha256: digest,
                canonical: entries => entries.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })).sort((a, b) => a.path.localeCompare(b.path)),
                physicalFile: async filename => Buffer.from('Synthetic source body ' + filename.split('unit-')[1]),
                artifact: async item => {
                    assert.ok(artifacts.has(item.path));
                    const declared = item.path === observedPin.path ? observedPin.sha256 : item.path === reference.reference.path ? reference.reference.sha256 : hash;
                    assert.equal(item.sha256, declared, 'Exact artifact pin must be passed to physical I/O.');
                    const value = artifacts.get(item.path); return Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
                } });
            return verify(state.proof, state.source, commit);
        };
        return state;
    }
    const good = await model().run();
    assert.equal(good.step, 55); assert.equal(good.applicationStop.focusVisible, false);
    const negatives = [
        m => { m.proof.extra = true; }, m => { m.proof.review.sha256 = 'c'.repeat(64); },
        m => { m.review.status = 'accepted'; }, m => { m.review.reviewer = ''; }, m => { m.review.applicationArea = 'A08'; },
        m => { m.review.nativeGroup = 'article-cart-custom-calendar'; }, m => { m.observed.head = commit; },
        m => { m.source.source[0].sha256 = hash; }, m => { m.observed.productionCount = 215; },
        m => { m.application.environment.browserVersion = '157.0.8103.38'; }, m => { m.application.application.commit = commit; },
        m => { m.reference.browser = { ...m.reference.browser, name: 'firefox' }; },
        m => { m.reference.geometry = { ...m.reference.geometry, resetVerified: false }; },
        m => { m.reference.geometry = { ...m.reference.geometry, nativeRatioVerified: false }; },
        m => { m.reference.finalFormValues.push('Changed source value'); },
        m => { m.reference.steps[3].state.viewport.dpr = 1; }, m => { m.reference.steps[3].state.viewport.pinchScale = 2; },
        m => { m.application.checks[1].path[2].focused = false; }, m => { m.application.checks[1].path[2].focusVisible = false; },
        m => { m.application.checks[1].path[2].reachable = false; }, m => { m.application.checks[1].path.at(-1).cancel = false; },
        m => { m.application.checks[1].path[55].focusWithin = false; }, m => { m.application.checks[1].path[55].focused = true; },
        m => { m.application.captures[0].captureMethod = 'browser protocol screenshot'; },
        m => { m.png.writeUInt32BE(1599, 16); }, m => { m.pair.application.image.sha256 = 'd'.repeat(64); }
    ];
    for (const mutate of negatives) { const state = model(); mutate(state); await assert.rejects(state.run()); }
});

test('current nativeOS200 classification admits only the single exact DATE internal stop with wholeX11 capture', async () => {
    const before = { innerWidth: 1050, innerHeight: 1093, outerWidth: 1050, outerHeight: 1180, dpr: 1, pinchScale: 1 };
    const zoomed = { innerWidth: 525, innerHeight: 546, outerWidth: 1050, outerHeight: 1180, dpr: 2, pinchScale: 1 };
    const bounds = { x: 33, y: 253.2578125, width: 443, height: 40, right: 476, bottom: 293.2578125 };
    const stop = { id: 'subStartDate', tag: 'INPUT', type: 'date', name: null, withinForm: true, focusVisible: false, offerToggle: false,
        focused: false, focusWithin: true, outline: 'rgb(15, 23, 42) none 3px', outlineWidth: 3, outlineStyle: 'none', bounds,
        viewport: { width: 525, height: 546 }, reachable: true, cancel: false };
    const directory = await mkdtemp(nodePath.join(tmpdir(), 'theme-audit-native-unit-'));
    const file = nodePath.join(directory, 'synthetic-native-header.png');
    try {
        async function run(change = {}) {
            const png = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
            png.writeUInt32BE(change.badImage ? 100 : 1600, 16); png.writeUInt32BE(1200, 20); await writeFile(file, png);
            let step = -1; const captured = [], checks = [];
            const geometry = { ...zoomed, ...change.geometry };
            const page = { locator: () => ({ focus: async () => {} }), keyboard: { press: async () => { step++; } },
                evaluate: async probe => {
                    const date = step === 55, cancel = step === 57;
                    const focused = date ? Boolean(change.hostFocused) : !(change.otherFocusLoss && step === 2);
                    const node = { id: step === 0 ? 'werfsleutelInput' : date ? change.control || 'subStartDate' : 'unit-' + step,
                        tagName: 'INPUT', type: date ? 'date' : 'text', getAttribute: () => null, closest: () => step > 57 ? null : {},
                        getBoundingClientRect: () => ({ ...bounds, ...(change.unreachable && step === 2 ? { x: -8 } : {}) }),
                        matches(selector) {
                            if (selector === ':focus-within') return !(date && change.noFocusWithin);
                            if (selector === ':focus-visible') return date ? false : !(change.otherFocusLoss && step === 2);
                            if (selector === ':focus') return focused;
                            return selector === '#subscriptionForm .form-actions [data-action="close-form"]' && cancel && !change.noCancel;
                        } };
                    return runInNewContext('(' + probe.toString() + ')()', { document: { activeElement: node },
                        innerWidth: geometry.innerWidth, innerHeight: geometry.innerHeight, outerWidth: geometry.outerWidth, outerHeight: geometry.outerHeight,
                        devicePixelRatio: geometry.dpr, visualViewport: { scale: geometry.pinchScale },
                        getComputedStyle: () => ({ outline: date ? stop.outline : 'solid', outlineWidth: date ? '3px' : '2px', outlineStyle: date ? 'none' : 'solid' }) });
                } };
            const nativeOS200 = { area: change.area || 'A05', group: 'subscription-service-native-date', sourceCommit: commit,
                browserVersion: '158.0.8127.36', step: change.proofStep ?? 55, applicationStop: stop, geometry: { before, zoomed, reset: before } };
            const driver = { browserName: change.browser || 'chromium', contract: change.noProof ? {} : { nativeDateFocus: {
                sourceCommit: commit, browserVersion: '157.0.8103.38', entries: [], nativeOS200 } },
                report: { slice: 10, phase: 'after', application: { commit: change.sourceCommit || commit },
                    environment: { native: true, browserVersion: change.version || nativeOS200.browserVersion }, captures: captured,
                    subscriptionAcceptance: { interactions: [] } },
                painted: async () => {}, capture: async (actualPage, name) => {
                    assert.equal(actualPage, page); captured.push({ name: (change.prefix || 'subscription-service-native-date-') + name,
                        captureMethod: change.protocolImage ? 'browser protocol screenshot' : 'actual 1600x1200 Xvfb desktop via ffmpeg x11grab',
                        geometry: { viewportWidth: geometry.innerWidth, viewportHeight: geometry.innerHeight, devicePixelRatio: geometry.dpr, visualViewportScale: geometry.pinchScale } });
                    return file;
                }, check(name, actual, expected, detail) { checks.push({ name, actual, expected, detail }); assert.equal(actual, expected, name); } };
            await inspectSubscriptionKeyboard(page, driver, { native: true, locale: change.locale || 'nl', prefix: change.prefix || 'subscription-service-native-date-' });
            return checks[0];
        }
        const accepted = await run(); assert.equal(accepted.detail.legacyHostFocusPassed, false);
        assert.equal(accepted.detail.nativeInternalFocus.actual.focusVisible, false);
        assert.equal(accepted.detail.nativeInternalFocus.image.sha256, createHash('sha256').update(readFileSync(file)).digest('hex'));
        assert.match(accepted.detail.nativeInternalFocus.independentCurrentWholeImageReview, /^not reviewed/);
        for (const options of [{ noProof: true }, { area: 'A08' }, { prefix: 'article-cart-custom-calendar-' }, { browser: 'firefox' },
            { version: '157.0.8103.38' }, { sourceCommit: 'c'.repeat(40) }, { locale: 'en' }, { geometry: { dpr: 1 } },
            { geometry: { pinchScale: 2 } }, { geometry: { innerWidth: 526 } }, { geometry: { outerWidth: 1051 } },
            { otherFocusLoss: true }, { unreachable: true }, { noCancel: true }, { noFocusWithin: true }, { hostFocused: true },
            { control: 'other-date' }, { proofStep: 54 }, { badImage: true }, { protocolImage: true }]) await assert.rejects(run(options));
    } finally { await rm(directory, { recursive: true, force: true }); }
});
