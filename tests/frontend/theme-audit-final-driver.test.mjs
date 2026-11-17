import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
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

function setup({ fail, outcome = 'verified', omitCriterion = false, navigateDuringPrepare = false } = {}) {
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
    return { calls, contexts, hooks, driver, declaration, ownerVerification, bridge: createFinalDriver({ release: declaration, hooks, ownerVerification }, driver) };
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

async function executeActualNativeMain({ geometryFailure, rejectSessionProof = false } = {}) {
    const fixture = setup({ fail: rejectSessionProof ? 'verify' : undefined });
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
    const runtime = runInNewContext(`(async () => { ${source.slice(helperStart, helperEnd)}; ${source.slice(dispatchStart, dispatchEnd)} })`, {
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
