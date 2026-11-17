import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { readFile, writeFile, mkdir, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFinalDriver, finalNativeGroups } from '../../scripts/compose-smoke-theme-audit-final-driver.mjs';
import { finalAuditAreas, finalReleaseIdentity } from '../../scripts/compose-smoke-theme-audit-final.mjs';
import { finalScenePlan, createFinalTransport, finishFinalSceneSession, verifiedCriterionChecks,
    attachObservationEvidence, returnToSearchResults } from '../../scripts/compose-smoke-theme-audit-final-scenes.mjs';

const sourceFilename = process.env.KIWI_THEME_SCENE_REGRESSION_SOURCE
    || fileURLToPath(new URL('../../scripts/compose-smoke-theme-audit-final-scenes.mjs', import.meta.url));
const source = await readFile(sourceFilename, 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const baseUrl = new URL('https://bdc.rtvmedia.org.local:9444/kiwi/');
const original = '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4';
const refined = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const sdk = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';
const artifact = name => ({ path: '/synthetic-lifecycle-unit-only/' + name, sha256: '1'.repeat(64) });
const knownLegacySource = { path: 'scripts/compose-smoke-theme-audit-operational.mjs',
    sha256: '6d312cd304824f9117434ed7e84ba2bc437883d0b87963b826e3b94b092f05a9', verified: true };

// Execute the actual private function body. No browser/controller implementation is
// replaced in production; these finite VM seams isolate orchestration regressions.
function declaration(name) {
    const expression = new RegExp('^(?:export )?(?:async )?function ' + name + '\\(', 'm');
    const start = expression.exec(source); assert.ok(start, 'Actual source function: ' + name);
    const remainder = source.slice(start.index + start[0].length);
    const next = /\n(?:export )?(?:async )?function \w+\(/.exec(remainder);
    const end = next ? start.index + start[0].length + next.index : source.length;
    return source.slice(start.index, end).replace(/^export /, '');
}
function actualFunction(name, globals) {
    const realmAssert = { ...assert, deepEqual(actual, expected, message) {
        assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
    } };
    const context = vm.createContext({ assert: realmAssert, path, Buffer, URL, ...globals });
    vm.runInContext(declaration(name) + '\nglobalThis.actual = ' + name + ';', context);
    return context.actual;
}
function lifecycleRelease() {
    return { source: { commit: 'a'.repeat(40), manifest: artifact('manifest'), runtime: artifact('runtime'), helpers: artifact('helpers') },
        slice09: { phase: 'after', status: 'accepted', evidence: artifact('09') }, icons: { status: 'accepted', evidence: artifact('155') },
        reference: { original: { ...artifact('original'), sha256: original }, refined: { ...artifact('refined'), sha256: refined } },
        sdk: { ...artifact('sdk'), sha256: sdk }, operationalAfter: { phase: 'after', sourceCommit: 'a'.repeat(40), evidence: artifact('operational') } };
}
function fakePage() {
    return { address: 'about:blank', closed: false, url() { return this.address; }, isClosed() { return this.closed; },
        async close() { this.closed = true; }, on() {}, off() {} };
}
function setupHarness() {
    const sessions = [], contexts = [];
    const familyFor = actualFunction('familyFor', {});
    const nativeAreas = {
        'shell-search-customer-history': ['A01', 'A02', 'A03', 'A10'], 'subscription-service-native-date': ['A05', 'A06'],
        'article-cart-custom-calendar': ['A07'], 'active-call-to-acw-disposition': ['A09'], 'outbox-feedback-image-system': ['A11', 'A12', 'A13']
    };
    const install = owner => async page => { await page.route('**/*', route => route.fulfill({ json: { owner } })); return { owner, release() {} }; };
    const helpers = {
        operational: { installOperationalTransport: async context => {
            await context.route('**/*', route => route.fulfill({ json: { owner: 'operational' } }));
            return { release() {}, releaseRecordMutation() {} };
        } },
        feedback: { readonlySourceFixtures: () => [], recordListAfterFixture: (root, count, component) => ({ recordCount: count, componentOnly: component }), checkAfterObservation() {} },
        customer: { trackCustomerBehavior: async () => async () => {}, installCustomerFixtures: install('customer') },
        subscription: { installSubscriptionFixtures: install('subscription'), releaseSubscriptionFixtures() {} },
        article: { prepareArticleEvidence: async () => {}, installArticleFixtures: install('article'), releaseArticleFixtures() {} },
        service: { prepareServiceEvidence: async () => {}, installServiceFixtures: install('service'), releaseServiceFixtures() {} },
        overlays: { installOverlayTransport: install('overlays') }
    };
    const prepare = actualFunction('prepareOwnedSession', { familyFor, finalScenePlan, nativeAreas, refinedReferenceSha256: refined,
        mkdir: async () => {}, readFile: async () => Buffer.alloc(0), createFinalTransport, finishFinalSceneSession,
        scopedDriver: (driver, descriptor, directory) => ({ ...driver, evidenceDir: directory,
            report: { application: {}, checks: [], captures: [], observations: [], deniedRequests: [], errors: [], sourceErrors: [] }, saveReport: async () => {} }),
        registerFinalOverlays: async handle => { handle.child.report.overlayAcceptance = { registration: 'unit setup only' }; },
        trackFinalServedSources: () => async () => artifact('source') });
    const release = lifecycleRelease(), owner = { proof: { health: { baseUrl: baseUrl.href } },
        source: { head: release.source.commit, worktree: '/synthetic-lifecycle-unit-only/checkout', referenceSha256: refined, source: [] }, sdk: Buffer.alloc(0) };
    const driver = { browserName: 'chromium', sourceRoot: owner.source.worktree, baseUrl,
        evidenceDir: '/synthetic-lifecycle-unit-only/.kiwi-theme-audit/evidence/run', report: { captures: [] },
        check() {}, capture() {}, painted() {}, trackStylesheets() {}, saveReport: async () => {},
        newFinalContext: async descriptor => {
            const context = { descriptor, closed: false, async route() {}, async unroute() {},
                async newPage() { return fakePage(); }, async close() { this.closed = true; } };
            contexts.push(context); return context;
        } };
    const required = { A01: 'customer', A02: 'customer', A04: 'subscription', A05: 'subscription', A06: 'service', A07: 'article', A08: 'subscription' };
    const hooks = {
        operationalAfter: release.operationalAfter,
        prepareSession: async input => {
            const handle = await prepare(input, owner, helpers, { sourceCommit: release.source.commit }); sessions.push(handle); return handle;
        },
        loginSession: async session => {
            const handle = session.owned, area = session.descriptor.id.split('/')[0];
            if (required[area]) assert.equal(handle[required[area]]?.owner, required[area], 'Actual full-cell preparation installed its family before login.');
            if (['A03', 'A04'].includes(area)) assert.equal(handle.recordMode, true, 'Actual full-cell preparation installed records.');
            if (['A12', 'A13'].includes(area)) assert.equal(handle.overlay?.owner, 'overlays', 'Actual full-cell preparation installed overlays.');
            session.page.address = baseUrl.href;
        },
        verifySession: async (session, { cell, releaseId }) => ({ sourceReleaseId: releaseId,
            environment: { ...cell.environment, browserVersion: 'synthetic lifecycle unit, not browser acceptance' },
            proofs: { source: artifact('unit-source'), environment: artifact('unit-environment'),
                role: { kind: 'actual-oidc-server-render', artifact: artifact('unit-role-schema-only') } } }),
        finishSession: session => finishFinalSceneSession(session.owned),
        scenes: Object.fromEntries(finalAuditAreas.map(area => [area.id, async (session, { cell }) => area.criteria.map(criterionId => ({
            id: cell.id + '/' + criterionId, criterionId, state: 'Synthetic lifecycle sequencing only; no actual UI evidence', kind: 'intercepted-fixture-flow', outcome: 'verified',
            report: artifact('unit-report'), checkRefs: ['unit-check'], images: [{ id: cell.id + '/' + criterionId, ...artifact('unit-image-schema-only') }]
        }))]))
    };
    return { driver, release, owner, helpers, prepare, hooks, sessions, contexts };
}

test('F01 real driver full-cell-ID lifecycle prepares all13 fixture owners before login and cleans every context', async () => {
    const h = setupHarness(), receipt = { releaseId: finalReleaseIdentity(h.release), evidence: artifact('unit-owner-schema-only') };
    const driver = createFinalDriver({ release: h.release, hooks: h.hooks, ownerVerification: receipt }, h.driver);
    const contract = Object.fromEntries(['shell','customer','subscription','subscriptionTitle','subscriptionHeading','subscriptionInput','subscriptionCaption','inputFocus','selectFocus'].map(name => [name, {}]));
    const summary = await driver.viewport({ width: 1440, height: 1000 }, contract);
    assert.equal(h.sessions.length, 13); assert.equal(h.contexts.every(context => context.closed), true);
    assert.deepEqual(h.sessions.map(handle => handle.descriptor.id), finalAuditAreas.map(area => area.id + '/chromium/1440x1000'));
    assert.equal(h.sessions.find(handle => handle.areaId === 'A03').state.recordFixture.componentOnly, true);
    assert.equal(h.sessions.find(handle => handle.areaId === 'A04').state.recordFixture.componentOnly, false);
    assert.equal(h.sessions.find(handle => handle.areaId === 'A08').article.owner, 'article');
    assert.equal(summary.finalAcceptance, false, 'Synthetic lifecycle metadata never accepts application visuals.');
});

test('F01 canonical identity rejects mismatched baseline browser/viewport and keeps native group preparation distinct', async () => {
    assert.throws(() => finalScenePlan({ id: 'A01', native: false, viewport: { width: 1440, height: 1000 } }, 'chromium'));
    assert.throws(() => finalScenePlan({ id: 'A01/firefox/1440x1000', native: false, viewport: { width: 1440, height: 1000 } }, 'chromium'));
    assert.throws(() => finalScenePlan({ id: 'A01/chromium/1440x1000', native: false, viewport: { width: 390, height: 1000 } }, 'chromium'));
    for (const group of finalNativeGroups) {
        const h = setupHarness(), page = fakePage(), context = { route: async () => {}, unroute: async () => {} };
        const descriptor = { id: group, native: true, role: 'kiwi-admin', locale: 'nl', viewport: { width: 1440, height: 1000 } };
        const handle = await h.prepare({ page, context, descriptor, driver: h.driver, release: h.release }, h.owner, h.helpers, {});
        assert.equal(handle.areaId, null); assert.equal(handle.nativeGroup, group);
        if (group === 'outbox-feedback-image-system') assert.equal(handle.overlay.owner, 'overlays');
        await finishFinalSceneSession(handle);
    }
});

function searchHandle() {
    let view = 'customer'; const actions = [], query = [{ id: 'searchPostalCode', value: '1231AA', checked: false }];
    const page = { keyboard: { press: async () => {} }, locator(selector) {
        assert.notEqual(selector, '[data-action="close-customer-detail"]', 'Removed close X is not an installed action.');
        const element = { first() { return this; }, async isVisible() { return selector === '#searchName' || view === 'results'; },
            async waitFor() { assert.equal(view, 'results'); }, async focus() {},
            async press() { actions.push(selector); if (selector === 'button[data-action="search-customer"]') view = 'results'; },
            async evaluateAll() { return structuredClone(query); },
            async evaluate() { return { active: true, visible: true, width: '2px', offset: '0px' }; } };
        return element;
    } };
    const handle = { page, descriptor: { id: 'A02/chromium/1440x1000', viewport: { width: 1440, height: 1000 } },
        child: { contract: { selectFocus: { outlineWidth: '2px', outlineOffset: '0px' } }, report: { observations: [] }, check: (name, actual, expected) => assert.deepEqual(actual, expected, name) },
        helpers: { customerAcceptance: { checkCustomerState: async () => assert.equal(view, 'results') } }, actions };
    return handle;
}

test('F02 actual search-scene orchestration returns through installed search, preserving query without removed close', async () => {
    const handle = searchHandle();
    const run = actualFunction('searchScene', { metaFor: () => ({}), returnToSearchResults,
        selectCustomer: async () => {}, criterion: async (h, id, state, action) => { if (id === 'filters-table-sort-and-page') await action(); } });
    await run(handle);
    assert.deepEqual(handle.actions, ['button[data-action="search-customer"]']);
});

async function criterionModel(checks, action = async () => {}, extra = {}) {
    const written = new Map();
    const report = { checks: [], errors: [], deniedRequests: [], sourceErrors: [], captures: [], observations: [] };
    const handle = { child: { evidenceDir: '/synthetic-criterion-unit-only', report }, descriptor: { id: 'A11/chromium/1440x1000' },
        release: { source: { commit: 'a'.repeat(40) } }, observations: [], reusedEvidence: [], legacyFocusSource: knownLegacySource, ...extra };
    const run = actualFunction('criterion', { verifiedCriterionChecks, hash: sha,
        checkpoint: async h => h.child.report.captures.push({ absolute: '/synthetic-criterion-unit-only/current.png' }),
        collectedImages: actualFunction('collectedImages', {}), readFile: async () => Buffer.from('Synthetic unit bytes, not rendered image acceptance'),
        writeArtifact: async (filename, value) => { written.set(filename, value); return { path: filename, sha256: sha(JSON.stringify(value)) }; } });
    const observation = await run(handle, 'unit-criterion', 'Synthetic criterion dataflow only', async () => { report.checks.push(...checks); await action(handle); });
    return { observation, report: written.get(observation.report.path) };
}

test('F03 actual criterion accepts only the exact already-asserted legacy focus shape from frozen source', async () => {
    const focus = { name: 'Actual five-second first trigger focus is retained and visible', matches: true, visible: true };
    const result = await criterionModel([focus]);
    assert.equal(result.report.checks[0].evidenceType, 'reviewed-legacy-focus-assertion');
    for (const record of [{ ...focus, visible: false }, { ...focus, matches: false }, { ...focus, matches: 1 },
        { name: 'Unknown missing-pass record', matches: true, visible: true }, { ...focus, extra: true }, { ...focus, passed: undefined }]) {
        await assert.rejects(criterionModel([record]));
    }
    for (const proof of [null, { ...knownLegacySource, sha256: '0'.repeat(64) }, { ...knownLegacySource, verified: false }]) {
        await assert.rejects(criterionModel([focus], async () => {}, { legacyFocusSource: proof }));
    }
    await assert.rejects(criterionModel([{ name: 'Explicit failed check', passed: false }]));
});

const reuseCases = [
    { prior: 'summary-zero-one-three', names: ['feedback-search-summary-1', 'feedback-search-summary-1-en', 'feedback-search-summary-1-nl'] },
    { prior: 'long-record-and-editable-editor', names: ['records-after-email-1', 'records-after-bank-create-readonly'] }
];
test('F04 reused locale/readonly evidence carries exact prior PNGs and original check IDs through the actual criterion', async () => {
    const parent = fileURLToPath(new URL('./.theme-audit-final-regression-unit/', import.meta.url)); await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(path.join(parent, 'reuse-'));
    try {
        for (const example of reuseCases) {
            const images = [], checks = [], observations = [];
            for (const [index, name] of example.names.entries()) {
                const filename = name + '.png', location = path.join(directory, filename), bytes = Buffer.from('Synthetic immutable image fixture: ' + name);
                await writeFile(location, bytes); images.push({ id: name, path: location, sha256: sha(bytes) });
                checks.push({ id: example.prior + '/' + index, state: name, name: 'Original actual observation check fixture', passed: true });
                observations.push({ name, filename, syntheticUnitOnly: true });
            }
            const priorValue = { marker: 'theme_audit', sourceCommit: 'a'.repeat(40), criterionId: example.prior, checks, images };
            const priorFile = path.join(directory, example.prior + '.json'); await writeFile(priorFile, JSON.stringify(priorValue));
            const prior = { criterionId: example.prior, report: { path: priorFile, sha256: sha(await readFile(priorFile)) }, checkRefs: checks.map(check => check.id), images };
            const result = await criterionModel([{ name: 'Current evidence linkage fixture', passed: true }], async h => {
                h.child.evidenceDir = directory; h.child.report.observations.push(...observations); h.observations.push(prior);
                await attachObservationEvidence(h, example.prior, example.names);
            });
            assert.equal(result.observation.images.filter(image => images.some(prior => prior.path === image.path)).length, images.length);
            assert.equal(result.report.sourceObservations[0].report.sha256, prior.report.sha256);
            assert.deepEqual(result.report.sourceObservations[0].checkRefs, prior.checkRefs);
            assert.ok(result.report.checks.some(check => check.origin?.report.sha256 === prior.report.sha256 && prior.checkRefs.includes(check.origin.checkRef)));
        }
    } finally { await rm(directory, { recursive: true, force: true }); await rmdir(parent); }
});

test('F04 actual A02/A03 scene bodies explicitly request their matching prior scopes without replay', async () => {
    const attached = [];
    const attach = async (handle, prior, names) => attached.push({ prior, names });
    const search = searchHandle(); search.customer = { personSearchRequests: 1 };
    search.child.report.observations = [1,3].flatMap(count => ['en','nl'].map(locale => ({ name: `feedback-search-summary-${count}-${locale}`, actualSummary: { queryUnchanged: true } })));
    await actualFunction('searchScene', { metaFor: () => ({}), attachObservationEvidence: attach,
        criterion: async (h, id, state, action) => { if (id === 'summary-live-nl-en-nl') await action(); } })(search);
    const customer = { child: { report: { observations: [{ name: 'records-after-bank-create-readonly', sourceBankCreateRemainsDisabled: true }, { readonly: true }] },
        check: (name, actual, expected) => assert.deepEqual(actual, expected, name) } };
    await actualFunction('customerScene', { attachObservationEvidence: attach, metaFor: () => ({}), restoreEditableCustomer: async () => {},
        criterion: async (h, id, state, action) => { if (id === 'readonly-editor') await action(); } })(customer);
    assert.deepEqual(attached.map(item => item.prior), ['summary-zero-one-three', 'long-record-and-editable-editor']);
    assert.ok(attached[0].names.includes('feedback-search-summary-1-en') && attached[1].names.includes('records-after-email-1'));
});

test('A10 establishes keyboard modality before Enter and keeps actual disclosure and exact focus checks', async () => {
    let keyboardFocused = false, expanded = false;
    const events = [], checks = [];
    const button = {
        first() { return this; },
        async scrollIntoViewIfNeeded() { events.push('scroll'); },
        async getAttribute(name) { assert.equal(name, 'aria-expanded'); return String(expanded); },
        async press(key) { assert.equal(key, 'Enter'); assert.equal(keyboardFocused, true); events.push('Enter'); expanded = !expanded; },
        async evaluate(probe) {
            const node = { matches: selector => keyboardFocused && selector === ':focus-visible' };
            return vm.runInNewContext('(' + probe.toString() + ')(node)', {
                node, document: { activeElement: node }, getComputedStyle: () => ({ outlineWidth: '3px' })
            });
        }
    };
    const page = { locator: selector => { assert.equal(selector, '.timeline-header'); return button; }, evaluate: async () => {} };
    const handle = { page, helpers: { operational: { operationalCustomerFixture: () => ({}) } }, child: {
        keyboardFocus: async (actualPage, selector) => {
            assert.equal(actualPage, page); assert.equal(selector, '.timeline-header'); events.push('keyboard'); keyboardFocused = true;
        },
        check: (name, actual, expected) => { assert.equal(actual, expected, name); checks.push(name); }
    } };
    const run = actualFunction('historyScene', { metaFor: () => ({}),
        criterion: async (h, id, state, action) => { if (id === 'native-disclosure-and-focus') await action(); } });
    await run(handle);
    assert.deepEqual(events, ['scroll', 'keyboard', 'Enter']);
    assert.deepEqual(checks, ['Native timeline Enter changes actual aria-expanded', 'Native history action retains exact3px focus']);
});

test('A11 composes closed-panel helpers and restores only initial intercepted read fixtures before fallback', async () => {
    let queueOpen = true, changesOpen = false;
    const events = [], initialItems = [
        { id: 1, revision: 3, capabilities: { edit: true }, customerReference: { personId: 'synthetic-1' } },
        { id: 2, revision: 7, capabilities: { edit: true } }
    ];
    const expectedItems = structuredClone(initialItems), control = { items: initialItems };
    const report = { observations: [], captures: [], outboxReads: [], deniedRequests: [] };
    const page = { locator(selector) {
        if (selector === '[data-action="toggle-subscription-queue-info"]') return {
            async getAttribute(name) { assert.equal(name, 'aria-expanded'); return String(queueOpen); },
            async press(key) { assert.equal(key, 'Enter'); queueOpen = !queueOpen; events.push('close-queue'); }
        };
        if (selector === '#customerSessionChanges') return { async evaluate(read) { return read({ open: changesOpen }); } };
        assert.equal(selector, '#customerSessionChanges > summary');
        return { async press(key) { assert.equal(key, 'Enter'); changesOpen = !changesOpen; events.push('close-changes'); } };
    } };
    const enterHelper = name => {
        assert.equal(queueOpen, false, name + ' starts with a closed queue'); queueOpen = true; events.push(name);
    };
    const handle = { page, control, state: {}, child: { report,
        check: (name, actual, expected) => assert.equal(actual, expected, name) }, helpers: { operational: {
        initialOutbox: async () => { queueOpen = false; events.push('initial'); },
        inspectOperationalOutbox: async () => {
            enterHelper('operational'); changesOpen = true;
            control.items[0].capabilities.edit = false;
            report.outboxReads.push({ locallyFulfilled: true });
            report.observations.push({ name: 'outbox-native-editor' }, { name: 'outbox-native-editor-escape' });
        },
        inspectAsyncOutbox: async () => {
            enterHelper('async'); assert.equal(changesOpen, false, 'Native summary must open its customer changes'); changesOpen = true;
            control.items = [{ id: 992910, revision: 99, capabilities: { edit: false, pause: false, resume: false, delete: false } }];
        },
        inspectOutboxFallbackFocus: async () => {
            enterHelper('fallback'); assert.deepEqual(control.items, expectedItems);
            assert.notEqual(control.items, initialItems); assert.notEqual(control.items[0].capabilities, initialItems[0].capabilities);
        }
    } } };
    const run = actualFunction('outboxScene', { structuredClone, metaFor: () => ({}),
        criterion: async (h, id, state, action) => { if (id !== 'menu-disclosure-and-editor') await action(); } });
    await run(handle);
    assert.deepEqual(events, ['initial', 'operational', 'close-queue', 'close-changes', 'async', 'close-queue', 'fallback']);
    assert.equal(changesOpen, true, 'Fallback composition leaves the actual async customer disclosure state intact');
});
