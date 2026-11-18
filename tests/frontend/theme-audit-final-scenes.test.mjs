import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { createFinalSceneHooks, createFinalTransport, selectFinalRequestOwner, serverRoleEvidence,
    validateFinalSceneInputs, validateOwnerVerification, nativeTaskIdentity, finishFinalSceneSession, trackFinalServedSources, withCallControlReadiness, verifiedCriterionChecks, inspectRetainedCaptureInFreshDocument } from '../../scripts/compose-smoke-theme-audit-final-scenes.mjs';
import { inspectSubscriptionKeyboard } from '../../scripts/compose-smoke-theme-audit-subscription-acceptance.mjs';
import { finalAuditAreas, finalReleaseIdentity } from '../../scripts/compose-smoke-theme-audit-final.mjs';

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

test('optional native DATE proof is an exact owner binding and cannot be added, removed or substituted', () => {
    const value = release(), legacy = ownerProof(value);
    assert.equal(Object.hasOwn(legacy.bindings, 'nativeDateFocus'), false);
    validateOwnerVerification(legacy, value, legacy.releaseId);
    value.reference.nativeDateFocus = {
        observedSource: artifact('a'), entries: [{ paired: artifact('b'), review: artifact('c') }]
    };
    const bound = ownerProof(value); bound.releaseId = finalReleaseIdentity(value);
    bound.bindings.nativeDateFocus = structuredClone(value.reference.nativeDateFocus);
    validateOwnerVerification(bound, value, bound.releaseId);
    assert.throws(() => validateOwnerVerification(legacy, value, legacy.releaseId), /bind every/);
    for (const mutate of [
        r => { r.reference.nativeDateFocus.observedSource.sha256 = token('d'); },
        r => { r.reference.nativeDateFocus.observedSource.path += '.changed'; },
        r => { r.reference.nativeDateFocus.entries[0].paired.sha256 = token('d'); },
        r => { r.reference.nativeDateFocus.entries[0].paired.path += '.changed'; },
        r => { r.reference.nativeDateFocus.entries[0].review.sha256 = token('d'); },
        r => { r.reference.nativeDateFocus.entries[0].review.path += '.changed'; },
        r => { r.reference.nativeDateFocus.entries.pop(); },
        r => { r.reference.nativeDateFocus.entries.push(structuredClone(r.reference.nativeDateFocus.entries[0])); },
        r => { delete r.reference.nativeDateFocus; }
    ]) {
        const changed = structuredClone(value); mutate(changed);
        assert.throws(() => validateOwnerVerification(bound, changed, finalReleaseIdentity(changed)));
        assert.throws(() => validateOwnerVerification(bound, changed, bound.releaseId), /bind every/,
            'Reusing the old release ID cannot bypass the owner binding.');
    }
    const missing = structuredClone(bound); delete missing.bindings.nativeDateFocus;
    assert.throws(() => validateOwnerVerification(missing, value, bound.releaseId), /bind every/);
});

// Executes the real browser probe against synthetic nodes; no browser or visual acceptance.
function subscriptionKeyboardFixture(image, { classification = true, extraFocusLoss = false } = {}) {
    const nodes = Array.from({ length: 7 }, (_, step) => {
        const date = step === 3, cancel = step === 6;
        const hostFocused = !date && !(extraFocusLoss && step === 2);
        return { id: step === 0 ? 'werfsleutelInput' : date ? 'subStartDate' : 'unit-control-' + step,
            tagName: 'INPUT', type: date ? 'date' : 'text',
            getAttribute: () => null, closest: () => ({}),
            getBoundingClientRect: () => ({ width: 100, height: 30, x: 0, right: 100, y: 0, bottom: 30 }),
            matches(selector) {
                if (selector === ':focus-within') return true;
                if (selector === ':focus-visible' || selector === ':focus') return hostFocused;
                return selector === '#subscriptionForm .form-actions [data-action="close-form"]' && cancel;
            } };
    });
    const realm = vm.createContext({ document: { activeElement: null }, innerWidth: 1440, innerHeight: 1000,
        devicePixelRatio: 1, visualViewport: { scale: 1 },
        getComputedStyle: () => ({ outline: 'none', outlineWidth: '0px', outlineStyle: 'none' }) });
    let step = -1;
    const page = { locator: () => ({ focus: async () => {} }),
        keyboard: { press: async key => { assert.equal(key, 'Tab'); realm.document.activeElement = nodes[++step]; } },
        evaluate: async probe => vm.runInContext('(' + probe.toString() + ')()', realm) };
    const checks = [], nativeDateFocus = { sourceCommit: 'a'.repeat(40), browserVersion: 'synthetic-unit-browser',
        entries: [{ width: 1440, height: 1000, step: 3, applicationStop: {
            id: 'subStartDate', tag: 'INPUT', type: 'date', focused: false, focusVisible: false, focusWithin: true } }] };
    const driver = { browserName: 'chromium', contract: classification ? { nativeDateFocus } : {},
        report: { slice: 10, phase: 'after', application: { commit: 'a'.repeat(40) }, environment: { browserVersion: 'synthetic-unit-browser' },
            subscriptionAcceptance: { interactions: [] } },
        capture: async () => image,
        painted: async actualPage => assert.equal(actualPage, page),
        check: (name, actual, expected, detail) => { checks.push({ name, actual, detail }); assert.equal(actual, expected, name); } };
    return { driver, checks, run: () => inspectSubscriptionKeyboard(page, driver, { native: false, prefix: 'A05-chromium-1440x1000-', locale: 'nl' }) };
}

test('native DATE classification retains raw false host focus and requires current image review', async () => {
    const parent = fileURLToPath(new URL('./.theme-audit-final-scenes-unit/', import.meta.url)); await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, 'keyboard-')), image = path.join(directory, 'synthetic-capture.txt');
    try {
        await writeFile(image, 'Synthetic capture fixture, contains no pixels.');
        const fixture = subscriptionKeyboardFixture(image); await fixture.run();
        const check = fixture.checks[0], interaction = fixture.driver.report.subscriptionAcceptance.interactions[0];
        assert.equal(check.actual, true);
        assert.equal(check.detail.legacyHostFocusPassed, false);
        assert.equal(check.detail.path[3].focusVisible, false);
        assert.equal(check.detail.nativeInternalFocus.actual.focused, false);
        assert.match(check.detail.nativeInternalFocus.independentCurrentWholeImageReview, /^not reviewed/);
        assert.equal(interaction.legacyHostFocusPassed, false);
        assert.equal(interaction.keyboardPath[3].focusVisible, false);
        await assert.rejects(subscriptionKeyboardFixture(image, { classification: false }).run(), /actual native Tab/);
        await assert.rejects(subscriptionKeyboardFixture(image, { extraFocusLoss: true }).run(), /final-only Tab route/);
        await assert.rejects(subscriptionKeyboardFixture(undefined).run(), /final-only Tab route/);
    } finally {
        await rm(directory, { recursive: true, force: true });
        await rmdir(parent).catch(error => { if (error.code !== 'ENOTEMPTY') throw error; });
    }
});

test('legacy focus checks require either exact reviewed helper body and preserve all strict assertions', () => {
    const record = { name: 'Actual five-second first trigger focus is retained and visible', matches: true, visible: true };
    const hashes = [
        '6d312cd304824f9117434ed7e84ba2bc437883d0b87963b826e3b94b092f05a9',
        '6d92de17eec977297856200774f70f1abfed45ba37aee703c31d7afd6e342287'
    ];
    for (const sha256 of hashes) {
        const source = { path: 'scripts/compose-smoke-theme-audit-operational.mjs', sha256, verified: true };
        const [check] = verifiedCriterionChecks([record], source);
        assert.equal(check.passed, true);
        assert.equal(check.evidenceType, 'reviewed-legacy-focus-assertion');
        assert.deepEqual(check.assertionSource, { path: source.path, sha256 });
        assert.equal(Object.hasOwn(record, 'passed'), false, 'The raw source assertion stays unchanged.');
        for (const invalid of [{ ...record, matches: false }, { ...record, visible: false },
            { ...record, matches: 1 }, { ...record, visible: 1 }, { ...record, extra: true },
            { ...record, name: 'Another assertion' }, { ...record, passed: false }]) {
            assert.throws(() => verifiedCriterionChecks([invalid], source));
        }
        for (const invalid of [{ ...source, sha256: '0'.repeat(64) }, { ...source, verified: false },
            { ...source, path: 'scripts/another-helper.mjs' }, null]) {
            assert.throws(() => verifiedCriterionChecks([record], invalid));
        }
    }
});


test('retained callback fixture owns a fresh authenticated document and preserves the original retained draft', async () => {
    const parent = fileURLToPath(new URL('./.theme-audit-final-scenes-unit/', import.meta.url)); await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, 'fresh-component-'));
    try {
        for (const failure of [null, 'role', 'source', 'callback']) {
            const events = [], listeners = new Map(), drafts = new WeakMap();
            const geometry = { width: 390, height: 1000, dpr: 1, zoom: 1, locale: 'nl' };
            const original = { evaluate: async () => geometry };
            const draft = { comment: 'Synthetic retained application draft' }; drafts.set(original, draft);
            const paths = ['styles.css', 'article-search.css', 'delivery-date-picker.css', 'contextual-feedback.css', 'session-outbox.css'].map(name => 'assets/css/' + name);
            const modules = ['dialog', 'screenshot', 'selector'].map(name => `assets/js/app/contextual-feedback/${name}.js`);
            const bodies = new Map([...paths, ...modules].map(relative => [relative, 'Synthetic source bytes: ' + relative]));
            const emit = relative => listeners.get('response')({ url: () => new URL(relative, base).href,
                body: async () => Buffer.from(failure === 'source' && relative === paths[0] ? 'Changed source bytes' : bodies.get(relative)) });
            const context = { newPage: async () => { events.push('new-page'); return page; } };
            const page = { closed: false, context: () => context, on: (name, callback) => listeners.set(name, callback),
                off: name => { events.push('off-' + name); listeners.delete(name); },
                goto: async url => {
                    assert.equal(url, base.href); events.push('navigate'); paths.forEach(emit);
                    return { url: () => base.href, status: () => 200,
                        text: async () => '<div class="profile-menu-role">KIWI ' + (failure === 'role' ? 'view' : 'admin') + '</div>' };
                },
                waitForFunction: async () => events.push('ready'), evaluate: async () => geometry,
                locator: selector => { assert.equal(selector, '.profile-menu-role'); return { allTextContents: async () => ['KIWI admin'] }; },
                isClosed: () => page.closed, close: async () => { events.push('close'); page.closed = true; } };
            const report = { errors: [] }, child = { evidenceDir: directory, report,
                capture: async actualPage => { assert.equal(actualPage, page); events.push('failure-capture'); } };
            const handle = { page: original, context, child, descriptor: { id: 'A12/chromium/390x1000', viewport: { width: 390, height: 1000 }, locale: 'nl', role: 'kiwi-admin', native: false },
                driver: { baseUrl: base, normalizeMappedCssUrls: value => value },
                source: { source: [...bodies].map(([path, body]) => ({ path, sha256: createHash('sha256').update(body).digest('hex') })) }, sourceBodies: bodies,
                release: { source: { commit: 'a'.repeat(40), runtime: artifact('2') } },
                helpers: { overlays: { inspectRetainedCaptureCallbackError: async (actualPage, actualChild) => {
                    assert.equal(actualPage, page); assert.equal(actualChild, child); assert.equal(drafts.has(page), false);
                    assert.ok(report.retainedCaptureComponent.sourceBefore); assert.ok(report.retainedCaptureComponent.role);
                    assert.ok(events.includes('ready')); events.push('component'); modules.forEach(emit);
                    if (failure === 'callback') throw new Error('Synthetic component rejection');
                } } } };
            if (failure) await assert.rejects(inspectRetainedCaptureInFreshDocument(handle));
            else {
                await inspectRetainedCaptureInFreshDocument(handle);
                assert.ok(report.retainedCaptureComponent.sourceAfter);
                assert.deepEqual(events.slice(0, 4), ['new-page', 'navigate', 'ready', 'component']);
            }
            assert.equal(drafts.get(original), draft); assert.equal(draft.comment, 'Synthetic retained application draft');
            assert.equal(page.closed, true); assert.equal(listeners.size, 0);
            if (failure === 'role' || failure === 'source') assert.equal(events.includes('component'), false);
            if (failure) assert.ok(events.indexOf('failure-capture') < events.indexOf('close'));
        }
    } finally { await rm(directory, { recursive: true, force: true });
        await rmdir(parent).catch(error => { if (error.code !== 'ENOTEMPTY') throw error; }); }
});


test('optional nativeOS200 proof remains an exact owner binding without changing the old absent-field shape', () => {
    const value = release(); value.reference.nativeDateFocus = { observedSource: artifact('a'), entries: [{ paired: artifact('b'), review: artifact('c') }] };
    const old = ownerProof(value); old.releaseId = finalReleaseIdentity(value);
    old.bindings.nativeDateFocus = structuredClone(value.reference.nativeDateFocus);
    validateOwnerVerification(old, value, old.releaseId);
    value.reference.nativeDateFocus.nativeOS200 = { paired: artifact('d'), review: artifact('e') };
    const bound = ownerProof(value); bound.releaseId = finalReleaseIdentity(value);
    bound.bindings.nativeDateFocus = structuredClone(value.reference.nativeDateFocus);
    validateOwnerVerification(bound, value, bound.releaseId);
    assert.throws(() => validateOwnerVerification(old, value, old.releaseId));
    for (const mutate of [proof => { proof.nativeOS200.paired.sha256 = token('f'); },
        proof => { proof.nativeOS200.paired.path += '.changed'; }, proof => { proof.nativeOS200.review.sha256 = token('f'); },
        proof => { proof.nativeOS200.review.path += '.changed'; }, proof => { delete proof.nativeOS200; }]) {
        const changed = structuredClone(value); mutate(changed.reference.nativeDateFocus);
        assert.notEqual(finalReleaseIdentity(changed), bound.releaseId);
        assert.throws(() => validateOwnerVerification(bound, changed, bound.releaseId));
    }
});
