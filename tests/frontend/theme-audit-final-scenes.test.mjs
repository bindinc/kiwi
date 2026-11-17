import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { createFinalSceneHooks, createFinalTransport, selectFinalRequestOwner, serverRoleEvidence,
    validateFinalSceneInputs, validateOwnerVerification, nativeTaskIdentity, finishFinalSceneSession, trackFinalServedSources, withCallControlReadiness } from '../../scripts/compose-smoke-theme-audit-final-scenes.mjs';
import { finalAuditAreas } from '../../scripts/compose-smoke-theme-audit-final.mjs';

const base = new URL('https://bdc.rtvmedia.org.local:9444/kiwi/');
const token = digit => digit.repeat(64);
const artifact = digit => ({ path: '/synthetic-unit-only/' + digit + '.json', sha256: token(digit) });
function release() {
    return { marker: 'theme_audit', slice: 10, phase: 'after', source: { commit: 'a'.repeat(40), manifest: artifact('1'), runtime: artifact('2'), helpers: artifact('3') },
        slice09: { phase: 'after', status: 'accepted', evidence: artifact('4') }, icons: { status: 'accepted', evidence: artifact('5') },
        operationalAfter: { phase: 'after', sourceCommit: 'a'.repeat(40), evidence: artifact('6') },
        sdk: { ...artifact('7'), sha256: '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c' },
        accountPages: { path: 'scripts/theme-audit-icon-accounts.mjs', sha256: token('c') }, fixtures: { serviceAck: artifact('b') }, reference: { original: { ...artifact('8'), sha256: '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4' }, refined: { ...artifact('9'), sha256: '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb' } }, ownerVerification: artifact('0') };
}
const env = Object.fromEntries(['SHELL', 'CUSTOMER', 'SUBSCRIPTION', 'ARTICLE', 'SERVICE', 'OVERLAY', 'OPERATIONAL'].map(name => ['KIWI_THEME_AUDIT_' + name + '_PHASE', 'after']));
const verification = { sourceCommit: 'a'.repeat(40), productionFiles: 216, helperFiles: 37 };
function ownerProof(value) {
    return { marker: 'theme_audit', status: 'verified', kind: 'owner-verified-final-environment', reviewer: 'Synthetic unit fixture only', releaseId: 'unit-release', sourceCommit: value.source.commit,
        bindings: { source: value.source.manifest.sha256, runtime: value.source.runtime.sha256, helpers: value.source.helpers.sha256,
            accepted09: value.slice09.evidence.sha256, accepted155: value.icons.evidence.sha256, operationalAfter: value.operationalAfter.evidence.sha256,
            sdk: value.sdk.sha256, originalReference: value.reference.original.sha256, refinedReference: value.reference.refined.sha256, fixtures: { serviceAck: value.fixtures.serviceAck.sha256 }, accountsHelper: value.accountPages.sha256 },
        effectiveConfiguration: { status: 'verified', sourceCommit: value.source.commit, artifact: artifact('0') },
        health: { status: 'healthy', httpStatus: 200, runtimeProofSha256: value.source.runtime.sha256, project: 'unit-only', baseUrl: base.href, observedUtc: '2026-11-17T00:00:00Z' } };
}
function route(url, method = 'GET') {
    const outcomes = [];
    const request = { url: () => url, method: () => method };
    return { outcomes, request: () => request, abort: async reason => outcomes.push(['abort', reason]),
        continue: async () => outcomes.push(['network']), fulfill: async payload => outcomes.push(['local', payload]) };
}

test('accepted lineage and explicit AFTER phases are required before imports/navigation', () => {
    const value = release(); validateFinalSceneInputs(value, verification, env);
    for (const mutate of [r => { r.icons.status = 'pending'; }, r => { r.slice09.status = 'pending'; },
        r => { delete r.ownerVerification; }, r => { r.operationalAfter.sourceCommit = 'b'.repeat(40); }]) {
        const bad = release(); mutate(bad); assert.throws(() => validateFinalSceneInputs(bad, verification, env));
    }
    assert.throws(() => validateFinalSceneInputs(value, verification, { ...env, KIWI_THEME_AUDIT_CUSTOMER_PHASE: 'before' }));
    assert.throws(() => validateFinalSceneInputs(value, verification, { ...env, KIWI_THEME_AUDIT_FINAL_SOURCE: '1' }));
});

test('owner receipt binds source/runtime/helpers/09/155/reference/SDK and actual health/config evidence', () => {
    const value = release(), good = ownerProof(value); validateOwnerVerification(good, value, 'unit-release');
    for (const change of [p => { p.bindings.accepted155 = token('f'); }, p => { p.bindings.helpers = token('f'); },
        p => { p.health.httpStatus = 503; }, p => { p.effectiveConfiguration.status = 'claimed'; },
        p => { p.sourceCommit = 'b'.repeat(40); }, p => { p.releaseId = 'another-release'; }]) {
        const bad = structuredClone(good); change(bad); assert.throws(() => validateOwnerVerification(bad, value, 'unit-release'));
    }
});

test('all13 hooks exist but an unverified session or another release object cannot execute them', async () => {
    const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env);
    try {
        const hooks = await createFinalSceneHooks({ release: release(), verification });
        assert.deepEqual(Object.keys(hooks.scenes).sort(), finalAuditAreas.map(area => area.id).sort());
        await assert.rejects(hooks.prepareSession({}), /verification must complete/);
        for (const action of Object.values(hooks.scenes)) await assert.rejects(action({}), /authenticated source/);
        await assert.rejects(hooks.verifyRelease({ release: release(), releaseId: 'unit-release' }));
    } finally { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; }
});

test('outbox stays operational when overlays also own settings/feedback', () => {
    assert.equal(selectFinalRequestOwner(new URL('api/v1/outbox-sessions?limit=20&offset=0', base), base, 'article', { overlay: true }), 'operational');
    assert.equal(selectFinalRequestOwner(new URL('api/v1/development-feedback/settings', base), base, 'article', { overlay: true }), 'overlays');
});

test('wrong origin, credentials and alternate Kiwi base have no owner', () => {
    const credentialed = new URL(base); credentialed.username = 'synthetic-unit-user';
    for (const url of [new URL('https://unexpected.invalid/kiwi/api/v1/persons'), credentialed, new URL('/kiwi-preview/api/v1/persons', base)]) {
        assert.equal(selectFinalRequestOwner(url, base, 'customer'), null);
    }
});

test('non-article calendar bootstrap uses the source-generated local owner and permits at most four GETs', async () => {
    const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
    const report = { deniedRequests: [] };
    const transport = createFinalTransport(base, 'customer', report, { calendarSourceRoot: sourceRoot });
    for (let index = 0; index < 4; index++) {
        const intercepted = route(new URL('api/v1/catalog/delivery-calendar?year=2026&month=11', base).href);
        await transport.dispatch(intercepted);
        assert.equal(intercepted.outcomes.length, 1); assert.equal(intercepted.outcomes[0][0], 'local');
        const payload = intercepted.outcomes[0][1].json;
        assert.equal(payload.year, 2026); assert.equal(payload.month, 11); assert.equal(payload.days.length, 30);
        assert.equal(payload.days[0].date, '2026-11-01'); assert.equal(typeof payload.minimumDate, 'string');
    }
    const exceeded = route(new URL('api/v1/catalog/delivery-calendar?year=2026&month=11', base).href);
    await transport.dispatch(exceeded); assert.deepEqual(exceeded.outcomes, [['abort', 'blockedbyclient']]);
    assert.equal(report.publicCalendarReads.length, 4); assert.equal(report.deniedRequests.length, 1);
    assert.ok(report.publicCalendarReads.every(read => read.sourceGenerated && read.locallyFulfilled));
});

test('public calendar rejects malformed query, method, alternate location and every other catalog endpoint without network', async () => {
    const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
    const report = { deniedRequests: [] }, transport = createFinalTransport(base, 'customer', report, { calendarSourceRoot: sourceRoot });
    const calendar = 'api/v1/catalog/delivery-calendar';
    const malformed = ['?year=2026', '?year=2026&month=0', '?year=2026&month=13', '?year=1899&month=11',
        '?year=2026&month=11&extra=1', '?year=2026&month=11&month=11', '?year=2026&month=11#fragment'];
    const cases = malformed.map(query => [new URL(calendar + query, base).href, 'GET']);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) cases.push([new URL(calendar + '?year=2026&month=11', base).href, method]);
    cases.push(['https://unexpected.invalid/kiwi/' + calendar + '?year=2026&month=11', 'GET'],
        [new URL('/kiwi-preview/' + calendar + '?year=2026&month=11', base).href, 'GET'],
        [new URL('api/v1/catalog/articles', base).href, 'GET']);
    const credentialed = new URL(calendar + '?year=2026&month=11', base); credentialed.username = 'unit-only'; cases.push([credentialed.href, 'GET']);
    for (const [url, method] of cases) {
        const intercepted = route(url, method); await transport.dispatch(intercepted);
        assert.deepEqual(intercepted.outcomes, [['abort', 'blockedbyclient']], method + ' ' + url);
    }
    assert.equal(report.publicCalendarReads, undefined); assert.equal(report.deniedRequests.length, cases.length);
});

test('article calendar retains its declared article owner and never consumes public calendar allowance', async () => {
    const report = { deniedRequests: [] }, transport = createFinalTransport(base, 'article', report, { calendarSourceRoot: '/unused-unit-only' });
    await transport.collect({}, 'article').route('**/*', intercepted => intercepted.fulfill({ json: { declaredArticleCalendar: true } }));
    const intercepted = route(new URL('api/v1/catalog/delivery-calendar?year=2026&month=11', base).href);
    await transport.dispatch(intercepted);
    assert.deepEqual(intercepted.outcomes, [['local', { json: { declaredArticleCalendar: true } }]]);
    assert.equal(report.publicCalendarReads, undefined); assert.deepEqual(report.deniedRequests, []);
});

test('existing fixture fallthrough stays inside one owner in reverse registration order', async () => {
    const report = { deniedRequests: [] }, transport = createFinalTransport(base, 'subscription', report), calls = [];
    const owner = transport.collect({}, 'subscription');
    await owner.route('**/*', async route => { calls.push('first'); await route.fulfill({ status: 200, json: { local: true } }); });
    await owner.route('**/*', async route => { calls.push('second'); await route.fallback(); });
    const intercepted = route(new URL('api/v1/webabo/offers?limit=250', base).href); await transport.dispatch(intercepted);
    assert.deepEqual(calls, ['second', 'first']); assert.deepEqual(report.deniedRequests, []);
    assert.equal(intercepted.outcomes[0][0], 'local'); assert.equal(intercepted.outcomes.some(entry => entry[0] === 'network'), false);
});

test('API continue and unmatched API fallthrough abort instead of contacting a server', async () => {
    for (const fallback of [false, true]) {
        const report = { deniedRequests: [] }, transport = createFinalTransport(base, 'customer', report);
        await transport.collect({}, 'customer').route('**/*', route => fallback ? route.fallback() : route.continue());
        const intercepted = route(new URL('api/v1/persons?name=unknown', base).href); await transport.dispatch(intercepted);
        assert.equal(intercepted.outcomes[0][0], 'abort'); assert.equal(report.deniedRequests.length, 1);
        assert.equal(intercepted.outcomes.some(entry => entry[0] === 'network'), false);
    }
});

test('unexpected writes and requests after cleanup cannot pass through missing ownership', async () => {
    const report = { deniedRequests: [] }, transport = createFinalTransport(base, 'customer', report);
    let intercepted = route(new URL('api/v1/persons/1/profile', base).href, 'PATCH'); await transport.dispatch(intercepted);
    assert.equal(intercepted.outcomes[0][0], 'abort');
    await transport.collect({}, 'customer').route('**/*', route => route.fulfill({ status: 503 }));
    transport.close(); intercepted = route(new URL('api/v1/persons', base).href); await transport.dispatch(intercepted);
    assert.equal(intercepted.outcomes[0][0], 'abort');
});

test('non-API assets continue through the existing operational owner', async () => {
    const report = { deniedRequests: [] }, transport = createFinalTransport(base, 'operational', report);
    await transport.collect({}, 'operational').route('**/*', route => route.continue());
    const intercepted = route(new URL('assets/css/styles-1234567.css', base).href); await transport.dispatch(intercepted);
    assert.deepEqual(intercepted.outcomes, [['network']]); assert.deepEqual(report.deniedRequests, []);
});

test('server role proof requires actual markup/status; readonly fixture capabilities cannot replace it', () => {
    const html = '<div class="profile-menu-role">KIWI view</div>';
    const proof = serverRoleEvidence(html, 'kiwi-view', 200); assert.equal(proof.kind, 'actual-oidc-server-render');
    assert.equal(proof.fixtureCapabilityIsRoleProof, false);
    assert.throws(() => serverRoleEvidence(html, 'kiwi-admin', 200));
    assert.throws(() => serverRoleEvidence('', 'kiwi-view', 200));
    assert.throws(() => serverRoleEvidence(html, 'kiwi-view', 403));
    assert.throws(() => serverRoleEvidence(html, 'donny', 200));
});

test('partial setup cleanup stays idempotent and preserves errors while releasing all owners', async () => {
    await finishFinalSceneSession(null);
    const calls = [], report = { deniedRequests: [], errors: [], sourceErrors: [] };
    const handle = { cleanup: [async () => { calls.push('earlier'); }, async () => { calls.push('later'); throw new Error('Synthetic cleanup failure'); }],
        control: { release: () => calls.push('release') }, page: { isClosed: () => true },
        transport: { close: () => calls.push('close-gate') }, child: { report, saveReport: async () => calls.push('save') } };
    await assert.rejects(finishFinalSceneSession(handle), AggregateError);
    const before = calls.slice(); await finishFinalSceneSession(handle);
    assert.deepEqual(calls, before); assert.deepEqual(calls, ['close-gate', 'release', 'later', 'earlier', 'save']);
});

test('elected operational owner keeps actual CSRF/payload/one-use acknowledgement gates', async () => {
    const { installOperationalTransport } = await import('../../scripts/compose-smoke-theme-audit-operational.mjs');
    const report = { deniedRequests: [], localCallWrites: [], settingsFixtures: [], sdkReads: [], authLifecycle: [],
        readonlySourceReads: [], recordMutations: [], outboxReads: [] };
    const transport = createFinalTransport(base, 'operational', report);
    const state = { baseUrl: base, phase: 'after', suite: 'feedback', feedbackFixtures: [], report };
    const control = await installOperationalTransport(transport.collect({}, 'operational'), state);
    function command({ payload = {}, csrf = true, query = '' } = {}) {
        const intercepted = route(new URL('api/v1/call-session/hold' + query, base).href, 'POST');
        const request = intercepted.request(); request.postDataJSON = () => payload;
        request.headers = () => ({ 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': 'unit-fixture-token' } : {}) });
        return intercepted;
    }
    let request = command(); await transport.dispatch(request); assert.equal(request.outcomes[0][0], 'abort');
    control.gate.arm('POST', '/kiwi/api/v1/call-session/hold', {}, { onHold: true });
    for (const wrong of [{ payload: { unexpected: true } }, { csrf: false }, { query: '?unexpected=1' }]) {
        request = command(wrong); await transport.dispatch(request); assert.equal(request.outcomes[0][0], 'abort');
    }
    request = command(); await transport.dispatch(request); assert.equal(request.outcomes[0][0], 'local');
    request = command(); await transport.dispatch(request); assert.equal(request.outcomes[0][0], 'abort');
    assert.equal(report.localCallWrites.length, 1); assert.equal(report.localCallWrites[0].csrfPresent, true);
    assert.equal(report.localCallWrites[0].exactSyntheticPayloadVerified, true); control.release();
});

test('one selected API owner cannot fall through to an overlay handler or rewrite a request', async () => {
    const report = { deniedRequests: [] }, transport = createFinalTransport(base, 'article', report, { overlay: true });
    let overlayCalls = 0;
    await transport.collect({}, 'operational').route('**/*', route => route.fallback());
    await transport.collect({}, 'overlays').route('**/*', route => { overlayCalls++; return route.fulfill({ json: { items: [] } }); });
    const request = route(new URL('api/v1/outbox-sessions?limit=20&offset=0', base).href);
    await transport.dispatch(request); assert.equal(overlayCalls, 0); assert.equal(request.outcomes[0][0], 'abort');
    const rewrite = createFinalTransport(base, 'customer', report);
    await rewrite.collect({}, 'customer').route('**/*', route => route.fallback({ method: 'GET' }));
    await assert.rejects(rewrite.dispatch(route(new URL('api/v1/persons', base).href)), /preserve the original request/);
});

test('actual native identity callback executes without Node closure, retains drafts/roles and never exports them', () => {
    const field = { id: 'notes', name: 'notes', value: 'Synthetic private unit draft', checked: false, disabled: false, readOnly: false };
    const secret = { id: 'csrfToken', name: 'csrf', get value() { throw new Error('Security field must not be read'); } };
    const role = { textContent: 'KIWI admin' };
    const context = { customerReference: { personId: 'unit-1' }, workflowSessionId: 'synthetic-workflow', contextGeneration: 3 };
    const window = { currentCustomer: { personId: 'unit-1', credentialKey: 'synthetic-source', sourceSystem: 'unit' },
        kiwiCustomerWorkSession: { getRequestContext: () => context }, callSession: { active: false, onHold: false, recordingActive: false }, orderItems: [] };
    const browser = vm.createContext({ window, document: { querySelectorAll: selector => selector === '.profile-menu-role' ? [role] : [field, secret] },
        innerWidth: 720, innerHeight: 500, devicePixelRatio: 2, visualViewport: { scale: 1 } });
    const execute = mode => vm.runInContext('(' + nativeTaskIdentity.toString() + ')(' + JSON.stringify(mode) + ')', browser);
    const stored = execute('remember'); assert.equal(stored.stored, true); assert.equal(JSON.stringify(stored).includes(field.value), false);
    browser.innerWidth = 1440; browser.innerHeight = 1000; browser.devicePixelRatio = 1;
    const restored = execute('verify'); assert.equal(restored.equal, true); assert.equal(restored.dpr, 1);
    assert.equal(window.__kiwiThemeFinalResetIdentity, undefined); assert.equal(JSON.stringify(restored).includes(field.value), false);
    for (const mutate of [() => { field.value += '!'; }, () => { role.textContent = 'KIWI view'; }, () => { context.contextGeneration++; }]) {
        execute('remember'); mutate(); assert.equal(execute('verify').equal, false);
    }
    assert.equal(execute('verify').equal, false, 'Missing remembered identity must reject, not assume equivalence.');
});

test('a failed native reset/identity still releases held responses, closes its page and cleans every listener', async () => {
    const calls = [], report = { deniedRequests: [], errors: [], sourceErrors: [] };
    const handle = { descriptor: { id: 'unit-native', viewport: { width: 1440, height: 1000 } }, nativeResetPending: true,
        initialEnvironment: { width: 1440, height: 1000 },
        page: { isClosed: () => false, evaluate: async () => ({ equal: false, dpr: 2, width: 720, height: 500, pinch: 1 }), close: async () => calls.push('close') },
        transport: { close: () => calls.push('deny-further-requests') }, control: { releaseRecordMutation: () => calls.push('release-mutation'), release: () => calls.push('release-reads') },
        cleanup: [async () => calls.push('listener-one'), async () => calls.push('listener-two')],
        child: { report, check: (name, actual, expected) => assert.equal(actual, expected, name), saveReport: async () => calls.push('save') } };
    await assert.rejects(finishFinalSceneSession(handle), AggregateError);
    assert.deepEqual(calls, ['deny-further-requests', 'release-mutation', 'release-reads', 'close', 'listener-two', 'listener-one', 'save']);
    assert.equal(handle.closed, true); assert.deepEqual(handle.cleanup, []);
});

test('actual served-source tracker matches mapped bytes, preserves the initial proof and rejects later query drift', async () => {
    const parent = fileURLToPath(new URL('./.theme-audit-final-scenes-unit/', import.meta.url)); await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, 'served-'));
    const sha = value => createHash('sha256').update(value).digest('hex');
    const body = 'body { color: #496275; }', relative = 'assets/css/styles.css';
    let response;
    const report = { sourceErrors: [], servedSources: [] };
    const handle = { page: { on: (event, callback) => { assert.equal(event, 'response'); response = callback; }, off: () => {} },
        child: { evidenceDir: directory, report }, driver: { baseUrl: base, normalizeMappedCssUrls: value => value },
        source: { source: [{ path: relative, sha256: sha(body) }] }, sourceBodies: new Map([[relative, body]]),
        release: { source: { commit: 'a'.repeat(40), runtime: artifact('2') } }, cleanup: [] };
    try {
        const finish = trackFinalServedSources(handle, { requiredPaths: [relative] });
        const cssResponse = query => ({ url: () => new URL('assets/css/styles-1234567.css' + query, base).href, body: async () => Buffer.from(body) });
        response(cssResponse('')); const first = await finish(); const before = await readFile(first.path);
        response(cssResponse('')); const settled = await finish();
        assert.notEqual(first.path, settled.path); assert.equal(sha(await readFile(first.path)), first.sha256);
        assert.equal(sha(before), first.sha256); assert.equal(sha(await readFile(settled.path)), settled.sha256);
        response(cssResponse('?unexpected=1')); await assert.rejects(finish());
        assert.equal(sha(await readFile(first.path)), first.sha256, 'Rejected drift cannot overwrite earlier proof.');
    } finally { for (const cleanup of handle.cleanup) cleanup(); await rm(directory, { recursive: true, force: true });
        await rmdir(parent).catch(error => { if (error.code !== 'ENOTEMPTY') throw error; }); }
});

test('hold/resume observes both actual model and installed painted glyph before the accepted observer continues', async () => {
    const calls = [], model = { onHold: false };
    const realm = vm.createContext({ window: { callSession: model }, document: { getElementById: () => ({ getClientRects: () => model.onHold ? [{}] : [] }) },
        getComputedStyle: () => ({ visibility: 'visible' }) });
    const ordinary = { press: async () => calls.push('ordinary') };
    const page = { locator: selector => selector === '#holdCallBtn' ? { press: async key => { calls.push(key); model.onHold = !model.onHold; } } : ordinary,
        evaluate: async callback => vm.runInContext('(' + callback.toString() + ')()', realm),
        waitForFunction: async (callback, expected) => { calls.push('wait-' + expected); assert.equal(vm.runInContext('(' + callback.toString() + ')(' + expected + ')', realm), true); } };
    const adapted = withCallControlReadiness(page);
    assert.equal(adapted.locator('#other'), ordinary);
    await adapted.locator('#holdCallBtn').press('Enter'); await adapted.locator('#holdCallBtn').press('Enter');
    assert.deepEqual(calls, ['Enter', 'wait-true', 'Enter', 'wait-false']);
});
