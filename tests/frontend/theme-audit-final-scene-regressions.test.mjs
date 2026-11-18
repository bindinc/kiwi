import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync as runLocal } from 'node:child_process';
import path from 'node:path';
import { readFile, writeFile, mkdir, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCustomerWorkSession } from '../../assets/js/app/customer-work-session.js';
import { physicalClientPoint, nativeReadonlyMotionOwnsTarget } from '../../scripts/compose-smoke-theme-audit-operational.mjs';
import { createPrivacy09Fixture } from '../../scripts/compose-smoke-theme-audit-operational-privacy.mjs';
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
function declaration(name, body = source) {
    const expression = new RegExp('^(?:export )?(?:async )?function ' + name + '\\(', 'm');
    const start = expression.exec(body); assert.ok(start, 'Actual source function: ' + name);
    const remainder = body.slice(start.index + start[0].length);
    const next = /\n(?:export )?(?:async )?function \w+\(/.exec(remainder);
    const end = next ? start.index + start[0].length + next.index : body.length;
    return body.slice(start.index, end).replace(/^export /, '');
}
function actualFunction(name, globals, body = source) {
    const realmAssert = { ...assert, deepEqual(actual, expected, message) {
        assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
    } };
    const context = vm.createContext({ assert: realmAssert, path, Buffer, URL, ...globals });
    vm.runInContext(declaration(name, body) + '\nglobalThis.actual = ' + name + ';', context);
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
        feedback: { readonlySourceFixtures: () => [], recordListAfterFixture: (root, count, component) => ({ recordCount: count, componentOnly: component,
            customer: { personId: '990970', credentialKey: 'theme-audit-records-component-2' } }), checkAfterObservation() {} },
        customer: { trackCustomerBehavior: async () => async () => {}, installCustomerFixtures: install('customer') },
        subscription: { installSubscriptionFixtures: install('subscription'), releaseSubscriptionFixtures() {} },
        article: { prepareArticleEvidence: async () => {}, installArticleFixtures: install('article'), releaseArticleFixtures() {} },
        service: { prepareServiceEvidence: async () => {}, installServiceFixtures: install('service'), releaseServiceFixtures() {} },
        overlays: { installOverlayTransport: install('overlays') }
    };
    const prepare = actualFunction('prepareOwnedSession', { familyFor, finalScenePlan, nativeAreas, refinedReferenceSha256: refined,
        mkdir: async () => {}, readFile: async () => Buffer.alloc(0), createFinalTransport, finishFinalSceneSession,
        createPrivacy09Fixture: () => ({ summary: { personId: '990990', credentialKey: 'theme-audit-privacy09', state: 'loaded',
            activeCount: 0, activeSubscriptions: [], inactiveSubscription: null } }),
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

const shellSource = await readFile(new URL('../../scripts/compose-smoke-theme-audit-shell-acceptance.mjs', import.meta.url), 'utf8');
const operationalSource = await readFile(new URL('../../scripts/compose-smoke-theme-audit-operational.mjs', import.meta.url), 'utf8');

function profileClickHarness(width, { covered = true, workControl = false, blocked = false } = {}) {
    const checks = [], captures = [], clicks = [];
    const rect = (left, top, right, bottom) => ({ x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top });
    const element = (id, tagName, bounds) => ({ id, tagName, disabled: false,
        getBoundingClientRect: () => bounds, contains(other) { return other === this; }, closest: () => null });
    const menu = element('agentStatusMenu', 'DIV', rect(covered ? 8 : width - 328, 60, covered ? Math.min(width - 8, 328) : width - 8, 760));
    const trigger = element('agentProfileTrigger', 'BUTTON', rect(width - 150, 12, width - 110, 52));
    const postal = element('searchPostalCode', 'INPUT', covered ? rect(33, 311, 281, 351) : rect(37, 160, 160, 200));
    const house = element('searchHouseNumber', 'INPUT', rect(width - 50, 311, width - 20, 351));
    const workspace = element('', 'DIV', rect(16, 80, width - 16, 1100));
    const body = element('', 'BODY', rect(0, 0, width, 1000));
    menu.hidden = true;
    trigger.getAttribute = () => String(!menu.hidden);
    workspace.querySelectorAll = selector => selector === '.card' ? [] : workControl ? [postal, house] : [postal];
    const nodes = { '.main-content': workspace, '#agentStatusMenu': menu, '#agentProfileTrigger': trigger, '#searchPostalCode': postal };
    const inside = (node, x, y) => { const r = node.getBoundingClientRect(); return x >= r.left && x < r.right && y >= r.top && y < r.bottom; };
    const document = { activeElement: trigger, querySelector: selector => nodes[selector],
        elementFromPoint(x, y) {
            if (blocked || !menu.hidden && inside(menu, x, y)) return menu;
            if (inside(postal, x, y)) return postal;
            if (workControl && inside(house, x, y)) return house;
            return inside(workspace, x, y) ? workspace : body;
        } };
    const evaluate = (probe, argument) => vm.runInNewContext('(' + probe.toString() + ')(argument)', {
        document, argument, innerWidth: width, innerHeight: 1000
    });
    const page = { evaluate, viewportSize: () => ({ width, height: 1000 }),
        locator(selector) {
            return { async press() { assert.equal(selector, '#agentProfileTrigger'); menu.hidden = false; },
                async waitFor() { assert.equal(menu.hidden, false); },
                async evaluate(probe, argument) { return vm.runInNewContext('(' + probe.toString() + ')(node, argument)', { node: postal, argument, document }); } };
        },
        keyboard: { async press(key) { if (key === 'Escape') { menu.hidden = true; document.activeElement = trigger; } } },
        mouse: { async click(x, y) {
            const hit = document.elementFromPoint(x, y); assert.notEqual(hit, menu, 'Never click a point covered by the profile menu');
            clicks.push({ x, y, id: hit.id, tag: hit.tagName }); menu.hidden = true;
            document.activeElement = hit.tagName === 'INPUT' ? hit : body;
        } } };
    const report = { shellAcceptance: { interactions: [] } };
    let focusReads = 0;
    const run = actualFunction('inspectProfileInteractions', {
        checkMenuGeometry: async () => ({ ...menu.getBoundingClientRect(), scrollHeight: 700, clientHeight: 700 }),
        menuBounds: async () => ({}), withinBounds: () => true,
        focusState: async () => {
            focusReads++;
            return { inMenu: focusReads <= 10, logout: focusReads === 9, locale: 'en', focusVisible: true,
                outlineWidth: '3px', outlineColor: focusReads <= 10 ? 'blue' : 'white' };
        },
        captureAfter: async (page, driver, name) => { captures.push(name); },
        profileOutsideTarget: actualFunction('profileOutsideTarget', {}, shellSource)
    }, shellSource);
    const driver = { report, check: (name, actual, expected, detail) => checks.push({ name, passed: actual === expected, detail }) };
    return { run: () => run(page, driver, { primary: { backgroundColor: 'blue', color: 'white' } }, { prefix: 'unit-' }), report, checks, captures, clicks };
}

test('A01 retains the exact desktop postcode click and fails if that desktop point is covered', async () => {
    const desktop = profileClickHarness(1440, { covered: false }); await desktop.run();
    assert.deepEqual(desktop.clicks, [{ x: 45, y: 168, id: 'searchPostalCode', tag: 'INPUT' }]);
    assert.ok(desktop.checks.every(check => check.passed));
    assert.equal(desktop.report.shellAcceptance.interactions[0].outsideClick.clicked.active, 'searchPostalCode');
    const covered = profileClickHarness(1440);
    await assert.rejects(covered.run(), /No verified outside input point/);
    assert.equal(covered.clicks.length, 0);
});

test('A01 narrow outside click prefers an actual uncovered work input and otherwise records only background closure', async () => {
    const control = profileClickHarness(390, { workControl: true }); await control.run();
    assert.ok(control.checks.every(check => check.passed));
    const focused = control.report.shellAcceptance.interactions[0].outsideClick;
    assert.equal(focused.kind, 'work-control'); assert.equal(focused.target.id, 'searchHouseNumber');
    assert.equal(focused.clicked.active, 'searchHouseNumber');
    assert.equal(control.clicks[0].id, 'searchHouseNumber');
    const background = profileClickHarness(320); await background.run();
    assert.ok(background.checks.every(check => check.passed));
    const closed = background.report.shellAcceptance.interactions[0].outsideClick;
    assert.equal(closed.kind, 'workspace-background'); assert.equal(closed.clicked.activeTag, 'BODY');
    assert.equal(closed.clicked.closed, true); assert.equal(closed.clicked.focusInMenu, false);
    assert.ok(background.checks.some(check => check.detail.focusClaim === 'Background closure only; no work-control focus claim.'));
    assert.ok(background.captures.some(name => name.endsWith('profile-outside-click-workspace-background')));
    const blocked = profileClickHarness(320, { blocked: true });
    await assert.rejects(blocked.run(), /No verified narrow outside work point/);
    assert.equal(blocked.clicks.length, 0);
});

function asyncOutboxHarness({ freshPoll = true, loseFocusAfterPoll = false } = {}) {
    const stop = new Error('Stop after the first complete actual poll observation');
    const state = { report: { observations: [], checks: [] } }, reads = [], control = {
        reads: 0, items: [{ id: 1, customerReference: {} }, { id: 2 }], release() {}
    };
    let active = '', keyboardModality = false, manualRefreshes = 0, measurements = 0;
    const page = {
        keyboard: { async press(key) { keyboardModality = true; active = key === 'Shift+Tab' ? 'second-title' : 'another keyboard stop'; } },
        locator: selector => ({ async focus() { active = selector; }, async press() {} }),
        async waitForFunction() {}, async evaluate() { throw new Error('No write-map probe belongs before this failure boundary'); }
    };
    const run = actualFunction('inspectAsyncOutbox', {
        structuredClone,
        measureAsyncOutboxFocus: async (actualPage, selector) => {
            assert.equal(actualPage, page);
            if (selector.endsWith('[data-outbox-control="customer"]')) throw stop;
            measurements++;
            return { expectedOwnsFocus: active === selector && !(loseFocusAfterPoll && measurements > 1), focusVisible: keyboardModality,
                fullPaintedPerimeterInsideAllClips: true, pointerTarget: true, scrollY: 0, listScrollTop: 0 };
        },
        observe: async (actualPage, actualState, name, selectors, detail) => { state.report.observations.push({ name, ...detail }); },
        save: async () => {}, refresh: async () => { manualRefreshes++; control.reads++; },
        setTimeout: resolve => { reads.push(control.reads); if (freshPoll) control.reads++; resolve(); }
    }, operationalSource);
    return { run: () => run(page, state, control), stop, state, reads, get manualRefreshes() { return manualRefreshes; } };
}

test('A11 actual async helper establishes the exact action focus before observing a fresh timer read', async () => {
    const h = asyncOutboxHarness(); await assert.rejects(h.run(), error => error === h.stop);
    assert.deepEqual(h.state.report.checks.map(check => check.passed), [true, true]);
    const [before, after] = h.state.report.observations;
    assert.equal(before.focus.expectedOwnsFocus, true); assert.equal(before.focus.focusVisible, true);
    assert.equal(after.name, 'async-second-trigger-after-poll'); assert.ok(after.read.after > after.read.before);
    assert.equal(h.manualRefreshes, 1, 'The poll boundary cannot be replaced by a second manual refresh');
});

test('A11 actual async helper still rejects a missing timer GET and lost focus after a fresh GET', async () => {
    const stale = asyncOutboxHarness({ freshPoll: false });
    await assert.rejects(stale.run(), /actual five-second interval must consume a fresh exact GET/);
    assert.equal(stale.state.report.observations.length, 1); assert.equal(stale.manualRefreshes, 1);
    const lost = asyncOutboxHarness({ loseFocusAfterPoll: true });
    await assert.rejects(lost.run(), /Async outbox second-trigger-after-poll must preserve/);
    assert.equal(lost.state.report.checks.at(-1).passed, false);
});


test('native shell group prepares the later record fixture without routing initial customer search as records', async () => {
    const h = setupHarness();
    const descriptor = { id: 'shell-search-customer-history', native: true, locale: 'nl', role: 'kiwi-admin',
        viewport: { width: 1440, height: 1000 }, hasTouch: false, reducedMotion: 'reduce' };
    const context = await h.driver.newFinalContext(descriptor), page = await context.newPage();
    const handle = await h.prepare({ page, context, descriptor, driver: h.driver, release: h.release }, h.owner, h.helpers,
        { sourceCommit: h.release.source.commit });
    assert.equal(handle.state.recordFixture.componentOnly, true);
    assert.equal(handle.state.recordFixture.recordCount, 2);
    assert.equal(handle.state.suite, 'feedback', 'Initial shell/search setup must keep its existing fixture owner.');
    assert.equal(handle.recordMode, false);
    assert.equal(handle.activeFamily, 'customer');
    assert.equal(handle.customer.subscriptionSummary.personId, handle.state.recordFixture.customer.personId);
    assert.equal(handle.customer.subscriptionSummary.credentialKey, handle.state.recordFixture.customer.credentialKey);
    assert.deepEqual(handle.customer.subscriptionSummary.activeSubscriptions, []);
    assert.equal(handle.customer.subscriptionSummary.activeCount, 0);
    await finishFinalSceneSession(handle);
});

test('actual native shell selection keeps the record identity across the later fresh A03 read', async () => {
    const longCustomer = actualFunction('syntheticCustomer', {})();
    const recordCustomer = { ...longCustomer, id: 990970, personId: '990970', credentialKey: 'theme-audit-records-component-2',
        sourceSystem: 'subscription-api', mandant: 'SYNTHETIC', lastName: 'Multiple records' };
    for (const nativeGroup of ['shell-search-customer-history', null]) {
        let sequence = 0;
        const workSession = createCustomerWorkSession({ createSessionId: () => 'synthetic-unit-session-' + (++sequence) });
        const handle = { nativeGroup, state: { recordFixture: { customer: recordCustomer } }, customer: {},
            child: { check: (name, actual, expected) => assert.deepEqual(actual, expected, name) } };
        const transitions = [];
        handle.page = { locator(selector) { return { first() { return this; }, async fill() {}, async press(key) {
            assert.equal(key, 'Enter');
            if (selector.includes('select-customer')) {
                const customer = handle.customer.personDetails, selection = workSession.startCustomerSelection(customer);
                transitions.push(selection.previousContext);
                assert.equal(workSession.confirmCustomer(selection, customer), true);
            }
        } }; }, async evaluate() { return String(workSession.getSnapshot().customerReference.personId); } };
        const run = actualFunction('selectCustomer', { syntheticCustomer: () => structuredClone(longCustomer),
            visible: async () => {}, metaFor: () => ({}) });
        await run(handle); await run(handle);
        const current = handle.customer.personDetails;
        assert.equal(current.lastName, longCustomer.lastName, 'The original long-label presentation remains exercised.');
        assert.deepEqual(transitions, [null, null]);
        const recordRead = workSession.startCustomerSelection(recordCustomer);
        if (nativeGroup) {
            assert.equal(current.id, recordCustomer.id);
            assert.equal(current.credentialKey, recordCustomer.credentialKey);
            assert.equal(current.sourceSystem, recordCustomer.sourceSystem);
            assert.equal(recordRead.previousContext, null, 'The real session model requires no reset POST for the native A03 fresh read.');
        } else {
            assert.equal(current.id, 990701, 'Every ordinary baseline keeps its original synthetic fixture.');
            assert.equal(recordRead.previousContext.customerReference.personId, '990701', 'The regression still detects the historical cross-customer transition.');
        }
    }
});

const nativeFeedbackSource = await readFile(process.env.KIWI_THEME_FEEDBACK_REGRESSION_SOURCE
    || fileURLToPath(new URL('../../scripts/compose-smoke-theme-audit-operational-feedback.mjs', import.meta.url)), 'utf8');
for (const native of [false, true]) test('actual search summary keeps NL-EN-NL assertions with ' + (native ? 'native keyboard' : 'ordinary pointer') + ' locale activation', async () => {
    let count = 0, locale = 'nl', menuOpen = false;
    const activations = [], observations = [], inputs = [{ id: 'searchPostalCode', value: '' }, { id: 'searchHouseNumber', value: '' }];
    const summaryLabel = () => locale === 'en' ? (count === 1 ? 'customer found' : 'customers found') : (count === 1 ? 'klant gevonden' : 'klanten gevonden');
    const document = { querySelector(selector) {
        if (selector === '#resultsTitle') return { textContent: (locale === 'en' ? 'Search results' : 'Zoekresultaten') + ': "1231AA 1"' };
        if (selector === '#resultsRange') return { textContent: (locale === 'en' ? 'Showing' : 'Toont') + ' 1-' + count + (locale === 'en' ? ' of ' : ' van ') + count };
        throw new Error('Unexpected synthetic summary selector: ' + selector);
    }, querySelectorAll(selector) {
        if (selector === '#paginatedResults .result-row') return Array.from({ length: count }, () => ({}));
        assert.equal(selector, '.search-card input'); return inputs;
    } };
    const window = { displaySearchResults(customers) { count = customers.length; } };
    const summary = { get innerText() { return count + ' ' + summaryLabel(); }, querySelector(selector) {
        if (selector === '#resultCount') return { textContent: String(count) };
        if (selector === '#resultCountLabel') return { textContent: summaryLabel(), getAttribute(name) {
            assert.equal(name, 'data-i18n'); return count === 1 ? 'search.resultSummaryOne' : 'search.resultSummaryMany'; } };
        throw new Error('Unexpected synthetic summary child: ' + selector);
    } };
    const activate = (selector, kind) => {
        activations.push({ selector, kind });
        if (native && kind === 'click') throw new Error('Native pointer setup cannot replace the declared keyboard path.');
        if (selector === '#agentProfileTrigger') { menuOpen = !menuOpen; return; }
        const chosen = /^\[data-locale-option=(en|nl)\]$/.exec(selector);
        assert.ok(chosen && menuOpen, 'Only a genuinely opened locale choice may activate.');
        locale = chosen[1]; menuOpen = false;
    };
    const page = { async evaluate(callback, argument) { return callback(argument); }, locator(selector) { return {
        async fill(value) { const input = inputs.find(item => '#' + item.id === selector); assert.ok(input); input.value = value; },
        async scrollIntoViewIfNeeded() {}, async isVisible() { return selector === '#searchSummary' && count > 0; },
        async evaluate(callback) { return callback(summary); }, async click() { activate(selector, 'click'); },
        async press(key) { assert.equal(key, 'Enter'); activate(selector, 'Enter'); },
        async waitFor(options) { assert.equal(options.state, 'visible'); assert.equal(menuOpen, true); }
    }; } };
    const state = { phase: 'after', ...(native ? { nativeKernel: {} } : {}) };
    const run = actualFunction('searchSummaries', { document, window, keyboardFocus: async () => ({ focused: true }) }, nativeFeedbackSource);
    await run(page, state, async (page, state, name, selectors, detail) => observations.push({ name, ...detail }));
    assert.equal(locale, 'nl'); assert.equal(menuOpen, false);
    assert.equal(activations.length, 8);
    assert.ok(activations.every(item => item.kind === (native ? 'Enter' : 'click')));
    assert.deepEqual(inputs.map(item => item.value), ['1231AA', '1']);
    for (const resultCount of [1, 3]) for (const language of ['en', 'nl']) {
        const observed = observations.find(item => item.name === `feedback-search-summary-${resultCount}-${language}`);
        assert.equal(observed.actualSummary.queryUnchanged, true);
        assert.equal(observed.actualSummary.countText, String(resultCount));
    }
});


const customerFixtureSource = await readFile(process.env.KIWI_THEME_CUSTOMER_REGRESSION_SOURCE
    || fileURLToPath(new URL('../../scripts/compose-smoke-theme-audit-customer.mjs', import.meta.url)), 'utf8');
async function summaryReadHarness({ family = 'customer', enabled = true, selected = true, records = false } = {}) {
    const report = { deniedRequests: [], customerEvidence: { interceptedFixtureRequests: [] } };
    const transport = createFinalTransport(baseUrl, family, report, { records });
    const install = actualFunction('installCustomerFixtures', {}, customerFixtureSource);
    const fixtures = await install(transport.collect({}, 'customer'), { baseUrl, report });
    const customer = { id: 990970, personId: '990970', credentialKey: 'theme-audit-records-component-2' };
    const projection = { ...createPrivacy09Fixture(fileURLToPath(new URL('../../', import.meta.url))).summary,
        personId: customer.personId, credentialKey: customer.credentialKey };
    if (enabled) fixtures.subscriptionSummary = projection;
    if (selected) fixtures.personDetails = customer;
    const expectedPayload = { persons: [{ personId: customer.personId, credentialKey: customer.credentialKey }] };
    async function request({ method = 'POST', suffix = 'api/v1/persons/subscription-summaries',
        headers = { 'content-type': 'application/json', 'x-csrf-token': 'synthetic-present' }, payload = expectedPayload,
        malformed = false } = {}) {
        const observed = { kind: null };
        const request = { url: () => new URL(suffix, baseUrl).href, method: () => method, headers: () => headers,
            postDataJSON() { if (malformed) throw new Error('Malformed synthetic unit JSON.'); return payload; } };
        await transport.dispatch({ request: () => request,
            async fulfill(value) { observed.kind = 'local'; observed.value = structuredClone(value); },
            async abort() { observed.kind = 'abort'; }, async continue() { observed.kind = 'upstream'; } });
        return observed;
    }
    return { report, fixtures, projection, expectedPayload, request, transport };
}

test('native selected customer summary reuses the declared read projection and permits only the three canonical native search reads', async () => {
    const h = await summaryReadHarness();
    for (let index = 0; index < 3; index++) {
        const response = await h.request();
        assert.equal(response.kind, 'local');
        assert.deepEqual(response.value.json, { items: [h.projection] });
    }
    assert.equal((await h.request()).kind, 'abort', 'A fourth read is outside the three declared native search renders.');
    assert.equal(h.report.customerEvidence.interceptedFixtureRequests.length, 3);
    assert.ok(h.report.customerEvidence.interceptedFixtureRequests.every(item => item.exactSyntheticIdentityVerified));
    assert.equal(h.fixtures.personDetails.credentialKey, h.projection.credentialKey, 'Real source identity is retained instead of suppressing hydration.');
    assert.equal(h.projection.state, 'loaded'); assert.equal(h.projection.activeCount, 0);
});

test('native summary read denies wrong payload, method, identity, headers, query and selected owner', async () => {
    const person = { personId: '990970', credentialKey: 'theme-audit-records-component-2' };
    const negatives = [
        { name: 'wrong person', request: { payload: { persons: [{ ...person, personId: '990971' }] } } },
        { name: 'wrong source key', request: { payload: { persons: [{ ...person, credentialKey: 'theme-audit-other-source' }] } } },
        { name: 'numeric person ID', request: { payload: { persons: [{ ...person, personId: 990970 }] } } },
        { name: 'empty persons', request: { payload: { persons: [] } } },
        { name: 'duplicate persons', request: { payload: { persons: [person, person] } } },
        { name: 'extra body key', request: { payload: { persons: [person], unexpected: true } } },
        { name: 'extra person key', request: { payload: { persons: [{ ...person, unexpected: true }] } } },
        { name: 'malformed JSON', request: { malformed: true } },
        { name: 'missing CSRF', request: { headers: { 'content-type': 'application/json' } } },
        { name: 'wrong content type', request: { headers: { 'content-type': 'text/plain', 'x-csrf-token': 'synthetic-present' } } },
        ...['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE'].map(method => ({ name: method, request: { method } })),
        { name: 'query', request: { suffix: 'api/v1/persons/subscription-summaries?extra=1' } },
        { name: 'other Kiwi base', request: { suffix: '/kiwi-preview/api/v1/persons/subscription-summaries' } },
        { name: 'other origin', request: { suffix: 'https://unexpected.invalid/kiwi/api/v1/persons/subscription-summaries' } },
        { name: 'reset command', request: { suffix: 'api/v1/customer-work-sessions/reset' } },
        { name: 'unarmed ordinary fixture', setup: { enabled: false } },
        { name: 'no selected customer', setup: { selected: false } },
        { name: 'operational owner', setup: { family: 'operational' } },
        { name: 'subscription owner', setup: { family: 'subscription' } },
        { name: 'records owner', setup: { records: true } }
    ];
    for (const scenario of negatives) {
        const h = await summaryReadHarness(scenario.setup);
        assert.equal((await h.request(scenario.request)).kind, 'abort', scenario.name);
        assert.equal(h.report.customerEvidence.interceptedFixtureRequests.length, 0, scenario.name);
    }
    const otherSelected = await summaryReadHarness(); otherSelected.fixtures.personDetails.personId = '990971';
    assert.equal((await otherSelected.request()).kind, 'abort', 'An armed summary cannot match a different current customer.');
    const mismatchedId = await summaryReadHarness(); mismatchedId.fixtures.personDetails.id = 990971;
    assert.equal((await mismatchedId.request()).kind, 'abort', 'The numeric selected source identity must also match.');
    const closed = await summaryReadHarness(); closed.transport.close();
    assert.equal((await closed.request()).kind, 'abort', 'Closed fixture ownership cannot serve a late summary.');
});


test('actual native A01 search, A02 search and A02 results return hydrate the same canonical source identity exactly three times', async () => {
    const h = await summaryReadHarness();
    const longCustomer = actualFunction('syntheticCustomer', {})();
    const canonical = { ...longCustomer, id: 990970, personId: '990970', credentialKey: 'theme-audit-records-component-2',
        sourceSystem: 'subscription-api', mandant: 'SYNTHETIC', lastName: 'Multiple records' };
    const searchSource = await readFile(fileURLToPath(new URL('../../assets/js/app/slices/customer-search-slice.js', import.meta.url)), 'utf8');
    const getRequest = actualFunction('getSubscriptionSummaryRequest', {}, searchSource);
    const inputs = [{ id: 'searchPostalCode', value: '', checked: false }, { id: 'searchHouseNumber', value: '', checked: false }];
    const browserState = { currentCustomer: null }, bodies = [];
    const handle = { nativeGroup: 'shell-search-customer-history', state: { recordFixture: { customer: canonical } }, customer: h.fixtures,
        child: { check: (name, actual, expected) => assert.deepEqual(actual, expected, name) } };
    handle.page = { locator(selector) { return {
        first() { return this; },
        async fill(value) { const field = inputs.find(node => '#' + node.id === selector); assert.ok(field); field.value = value; },
        async evaluateAll(callback) { return callback(inputs); },
        async press(key) {
            assert.equal(key, 'Enter');
            if (selector === 'button[data-action="search-customer"]') {
                const response = await h.request({ method: 'GET', suffix: 'api/v1/persons?postalCode=1231AA&houseNumber=1' });
                assert.equal(response.kind, 'local');
                const persons = response.value.json.items.map(getRequest).filter(Boolean);
                const payload = { persons }; bodies.push(payload);
                assert.equal((await h.request({ payload })).kind, 'local', 'Each of the three installed search renders owns the same exact read protocol.');
            } else if (selector.includes('select-customer')) {
                browserState.currentCustomer = handle.customer.personDetails;
            } else throw new Error('Unexpected synthetic search action: ' + selector);
        }
    }; }, async evaluate(callback) { return callback(); } };
    const globals = { syntheticCustomer: () => structuredClone(longCustomer), visible: async () => {}, metaFor: () => ({}), window: browserState };
    const select = actualFunction('selectCustomer', globals);
    const returnToResults = actualFunction('returnToSearchResults', globals);
    await select(handle); // Existing A01 selected-context search.
    await select(handle); // Existing A02 filter/table search.
    await returnToResults(handle); // Existing A02 installed return-to-results search.
    assert.equal(bodies.length, 3);
    assert.ok(bodies.every(body => JSON.stringify(body) === JSON.stringify(h.expectedPayload)), 'No extra source identity or body field is admitted.');
    assert.equal(h.fixtures.personSearchRequests, 3);
    assert.equal((await h.request()).kind, 'abort', 'A fourth request is outside this finite source path.');
    assert.deepEqual(inputs.map(node => node.value), ['1231AA', '1']);
});

// Actual installed-editor orchestration and browser probes; synthetic nodes are not rendered acceptance.
async function recordEditorOpeningHarness(options = {}) {
    const events = [], observations = [], done = new Error('Synthetic boundary: original record checks continue after opening');
    const rect = { x: 20, y: 40, width: 100, height: 40, right: 120, bottom: 80, ...options.bounds };
    let focused = false, opened = false, disposed = false;
    const listeners = new Map();
    const node = { id: 'editCustomerBtn', tagName: 'BUTTON', isConnected: true, disabled: options.disabled === true, offsetLeft: 20, offsetTop: 40, offsetWidth: 100, offsetHeight: 40,
        getBoundingClientRect: () => rect, matches: selector => selector === ':focus-visible' && focused && !options.hiddenFocus,
        contains: target => target === node,
        addEventListener(type, callback) { listeners.set(type, callback); },
        removeEventListener(type, callback) { assert.equal(listeners.get(type), callback); listeners.delete(type); } };
    const document = { activeElement: null, body: {}, hasFocus: () => options.documentFocused !== false, elementFromPoint: () => options.covered ? {} : node,
        querySelector: selector => { assert.equal(selector, '#customerName'); return { textContent: 'Synthetic990970' }; },
        querySelectorAll: selector => { assert.ok(selector.startsWith('.customer-editor[open]')); return opened ? [{}] : []; } };
    const customer = { id: 990970, personId: '990970', credentialKey: 'theme-audit-records-component-2' };
    const window = { currentCustomer: customer, kiwiCustomerDetailSlice: { selectCustomer: async (id, detail) => {
        assert.equal(id, customer.id); assert.equal(detail.sourceCustomer, customer); assert.equal(detail.requireFresh, true); events.push('fresh-source-read');
    } }, kiwiCustomerWorkSession: { getRequestContext: () => ({ customerReference: customer }) } };
    const mutationEvents = [], mutationNode = { value: options.mutationSection === 'email' ? 'first@example.invalid' : 'Geachte heer' };
    const mutationField = { inputValue: async () => mutationNode.value, fill: async value => { mutationNode.value = value; },
        elementHandle: async () => mutationNode, evaluate: async (callback, original) => callback(mutationNode, original) };
    const mutationAction = { scrollIntoViewIfNeeded: async () => mutationEvents.push('scroll'),
        press: async key => { assert.equal(key, 'Enter'); mutationEvents.push('Enter'); },
        click: async () => { mutationEvents.push('click'); if (options.mutationSection === 'email' && mutationEvents.filter(x => x === 'click').length === 2) throw done; } };
    const mutationRegion = { locator: selector => {
        if (selector === '.customer-editor-record-action') return { first: () => mutationAction };
        if (selector === 'button[type=submit]' && options.completePersonMutation) return {
            press: async key => { assert.equal(key, 'Enter'); mutationEvents.push('submit'); }, isEnabled: async () => false };
        return mutationField;
    } };
    const mutationClose = { isEnabled: async () => false, scrollIntoViewIfNeeded: async () => mutationEvents.push('close-scroll'),
        press: async key => { assert.equal(key, 'Enter'); opened = false; mutationEvents.push('close-Enter'); },
        click: async () => { opened = false; mutationEvents.push('close-click'); } };

    const realm = { document, window, innerWidth: 720, innerHeight: 500 };
    const evaluate = async (callback, argument) => vm.runInNewContext('(' + callback.toString() + ')(argument)', { ...realm, argument });
    const invoker = { async scrollIntoViewIfNeeded() { events.push('scroll-invoker'); }, async boundingBox() { return rect; },
        async focus() { document.activeElement = node; focused = true; events.push('setup-focus'); },
        async evaluate(callback) { return evaluate(callback, node); },
        async evaluateHandle(callback) {
            const value = await evaluate(callback, node);
            return { evaluate: fn => evaluate(fn, value), dispose: async () => { disposed = true; } };
        },
        async press(key) { assert.equal(key, 'Enter'); assert.equal(document.activeElement, node); assert.equal(focused, true); if (options.enterThrows) throw new Error('Synthetic Enter dispatch failure');
            for (const type of ['keydown', 'keyup', 'click']) listeners.get(type)?.({ type, key: options.unrelatedKey ? 'Escape' : 'Enter',
                isTrusted: options.untrustedEnter !== true, target: options.otherTarget ? { textContent: 'Synthetic private marker' } : node });
            opened = true; events.push('Enter'); },
        async click() { events.push('pointer'); if (options.rejectPointer) throw new Error('Synthetic reproduced native Firefox pointer timeout'); opened = true; },
        async tap() { opened = true; events.push('touch'); } };
    const page = { evaluate, keyboard: { async press(key) {
        events.push(key);
        if (key === 'Tab') { document.activeElement = { id: options.activeId || 'resendMagazineBtn', tagName: 'BUTTON', textContent: 'Synthetic private marker must not be projected' }; focused = false; }
        else { assert.equal(key, 'Shift+Tab'); document.activeElement = options.lostFocus ? {} : node; focused = !options.lostFocus; }
    } }, locator(selector) {
        if (selector === '#editCustomerBtn') return invoker;
        if (selector === '#customerDetail') return { waitFor: async () => {} };
        if (selector === '#customerDetail [data-action=close-customer-detail]') return { count: async () => 0 };
        if (selector === '#customerWorkSessionBar') return { isVisible: async () => true };
        if (selector === '#customerDetail .customer-header') return { scrollIntoViewIfNeeded: async () => events.push('scroll-header') };
        if (options.mutationActions && selector === '.customer-editor [id]') return { evaluateAll: async () => [] };
        assert.equal(selector, '.customer-editor[open]'); assert.equal(opened, true, 'Original record assertions run only after genuine invoker activation.');
        if (options.mutationActions) return { locator: selector => {
            if (selector.startsWith('[data-customer-section=bank]')) return { first: () => ({ waitFor: async () => {} }) };
            if (selector === '.form-header .btn-close') return mutationClose;
            if (selector === 'section button:not([disabled])') return { count: async () => 0 };
            return mutationRegion;
        }, waitFor: async ({ state }) => { assert.equal(opened, state === 'visible'); mutationEvents.push('dialog-' + state); } };

        return { locator: () => ({ first: () => ({ waitFor: async () => { throw done; } }) }) };
    } };
    if (options.completePersonMutation) page.waitForFunction = async callback => {
        assert.ok(callback.toString().includes('customer-editor-feedback')); mutationEvents.push('wait-response');
    };
    const state = { phase: 'after', suite: options.legacyReadonly ? 'native-operational' : 'records-after-component',
        recordFixture: { customer, componentOnly: !options.legacyReadonly, ...(options.mutationActions ? { id: 990970, model: { version: 'synthetic-version', sections: {} } } : {}) }, nativeKernel: {},
        report: { environment: { browser: 'firefox', native: true } } };
    if (options.mutationActions) state.api = '/kiwi/api/v1/';
    if (options.changeState) options.changeState(state);
    const keyboardFocus = actualFunction('keyboardFocus', {}, nativeFeedbackSource);
    const run = actualFunction('inspectRecordListsAfter', { keyboardFocus }, nativeFeedbackSource);
    let caught;
    try { await run(page, state, { mutationSection: options.mutationSection || 'person',
        control: options.mutationActions ? { recordMutationGate: { arm: input => { mutationEvents.push('arm'); assert.equal(input.pathname, '/kiwi/api/v1/persons/990970/profile');
            assert.equal(input.credentialKey, customer.credentialKey); assert.equal(input.expectedVersion, 'synthetic-version');
            assert.equal(JSON.stringify(input.changes), JSON.stringify({ salutation: 'Geachte mevrouw' })); if (!options.completePersonMutation) throw done;
        }, used: () => true }, recordMutationResponse: () => {}, releaseRecordMutation: () => mutationEvents.push('release-503'), recordReads: new Set(['source', 'editing']) } : {},
        ...(options.physicalComponent ? { openNativeComponentEditor: async phase => {
            assert.ok(['initial', 'retained'].includes(phase)); opened = true; events.push('original-component-physical-callback');
            if (options.completePersonMutation) mutationEvents.push('physical-' + phase);
        } } : {}), nativeKeyboardOpening: options.keyboard !== false, touch: options.touch === true,
        prepareNativeContent: options.missingNativePrepare ? null : async () => {
            events.push('prepare-public-content');
            if (options.emptyNativePrepare) return null;
            return async key => { events.push('OS-' + key); if (key === 'Enter') await invoker.press(key); else await page.keyboard.press(key); };
        },
        ...(options.legacyReadonly ? { openNativeReadonlyEditor: async () => { opened = true; events.push('original-native-readonly-callback'); } } : {}),
        observe: async (actualPage, actualState, name, selectors, detail) => { assert.equal(actualPage, page); assert.equal(actualState, state);
            observations.push({ name, selectors, detail }); events.push('observe-' + name);
            if (options.afterEnterObservationThrows && name === 'records-after-keyboard-editor-after-enter') throw new Error('Synthetic observation failure'); } }); } catch (error) { caught = error; }
    return { events, observations, opened, caught, done, disposed, listenerCount: listeners.size, mutationEvents, mutationValue: mutationNode.value };
}

test('native Firefox A03 opens installed editor with genuine Tab/Shift+Tab/Enter after actual invoker evidence', async () => {
    const result = await recordEditorOpeningHarness({ rejectPointer: true });
    assert.equal(result.caught, result.done, 'Original post-open source-record assertions remain in the execution path.');
    assert.equal(result.opened, true);
    assert.deepEqual(result.events, ['fresh-source-read', 'scroll-header', 'observe-records-after-header', 'prepare-public-content', 'scroll-invoker',
        'setup-focus', 'observe-records-after-keyboard-editor-setup-focus', 'OS-Tab', 'Tab', 'observe-records-after-keyboard-editor-after-tab',
        'OS-Shift+Tab', 'Shift+Tab', 'observe-records-after-keyboard-editor-after-shift-tab', 'observe-records-after-keyboard-editor-invoker', 'OS-Enter', 'Enter', 'observe-records-after-keyboard-editor-after-enter']);
    const proof = result.observations.find(item => item.name === 'records-after-keyboard-editor-invoker');
    assert.equal(proof.detail.geometry.focused, true); assert.equal(proof.detail.geometry.focusVisible, true);
    assert.equal(proof.detail.geometry.ownedCenter, true); assert.equal(proof.detail.geometry.disabled, false);
    assert.equal(JSON.stringify(proof.detail.focus.layoutBefore), JSON.stringify(proof.detail.focus.layoutAfter));
});

test('native keyboard editor opening rejects other suites/browsers/input/source and unusable actual invokers', async () => {
    for (const changeState of [state => { state.suite = 'feedback'; }, state => { state.report.environment.browser = 'chromium'; },
        state => { state.report.environment.native = false; }, state => { state.nativeKernel = null; },
        state => { state.recordFixture.componentOnly = false; }]) {
        const result = await recordEditorOpeningHarness({ changeState }); assert.equal(result.opened, false); assert.ok(result.caught);
    }
    for (const options of [{ emptyNativePrepare: true }, { missingNativePrepare: true }, { touch: true }, { hiddenFocus: true }, { lostFocus: true }, { covered: true }, { disabled: true },
        { bounds: { x: -1 } }, { bounds: { y: -1 } }, { bounds: { right: 721 } }, { bounds: { bottom: 501 } },
        { bounds: { width: 0 } }, { bounds: { height: 0 } }]) {
        const result = await recordEditorOpeningHarness(options); assert.equal(result.opened, false); assert.ok(result.caught);
    }
});

test('ordinary pointer, coarse touch and existing nativeReadonly opening retain their original branch', async () => {
    for (const [options, expected] of [[{ keyboard: false }, 'pointer'], [{ keyboard: false, touch: true }, 'touch'],
        [{ legacyReadonly: true }, 'original-native-readonly-callback']]) {
        const result = await recordEditorOpeningHarness(options); assert.equal(result.caught, result.done);
        assert.equal(result.events.at(-1), expected); assert.equal(result.events.includes('Tab'), false);
        assert.equal(result.observations.some(item => item.name === 'records-after-keyboard-editor-invoker'), false);
    }
    const original = await recordEditorOpeningHarness({ keyboard: false, rejectPointer: true });
    assert.equal(original.opened, false); assert.match(original.caught.message, /reproduced native Firefox pointer timeout/);
});

test('actual A03 caller opts only genuine native Firefox into the original component physical pointer opening', async () => {
    for (const [native, browserName, expected] of [[true, 'firefox', true], [true, 'chromium', false], [false, 'firefox', false], [false, 'chromium', false]]) {
        const stop = new Error('Synthetic inspect seam'), options = [];
        const handle = { page: {}, state: {}, descriptor: { native }, driver: { browserName }, control: {},
            helpers: { operational: { observeOperational() {} }, feedback: { inspectRecordListsAfter: async (page, state, input) => {
                assert.equal(page, handle.page); assert.equal(state, handle.state); options.push(input); throw stop;
            } } } };
        const run = actualFunction('customerScene', { openFirefoxNativeRecordEditor: async h => assert.equal(h, handle), criterion: async (h, id, state, action) => {
            assert.equal(id, 'long-record-and-editable-editor'); await action();
        } });
        await assert.rejects(run(handle), error => error === stop);
        assert.equal(options.length, 1); assert.equal(options[0].nativeKeyboardOpening, undefined);
        assert.equal(options[0].prepareNativeContent, undefined);
        assert.equal(typeof options[0].openNativeComponentEditor, expected ? 'function' : 'object');
        if (expected) await options[0].openNativeComponentEditor(); else assert.equal(options[0].openNativeComponentEditor, null);
        assert.equal(options[0].mutationSection, 'person'); assert.equal(options[0].control, handle.control);
        assert.equal(options[0].observe, handle.helpers.operational.observeOperational);
    }
});

test('actual complete native hook uses its owned driver and propagates optional contract only for the exact group', async () => {
    const start = source.indexOf('        async inspectNative(handle, { group }) {');
    const end = source.indexOf('\n        }\n    };', start);
    assert.ok(start >= 0 && end > start);
    const method = source.slice(start, end + '\n        }'.length).trim();
    const nativeAreas = vm.runInNewContext('(' + source.match(/const nativeAreas = (\{[\s\S]*?\n\});/)[1] + ')');
    const optionalGroup = 'subscription-service-native-date';
    for (const group of finalNativeGroups) for (const optional of [false, true]) for (const wrapped of [false, true]) {
        const calls = [], original = { syntheticMeasuredReference: true };
        const measured = { syntheticMeasuredReference: true, ...(optional ? { nativeDateFocus: { nativeOS200: { group: optionalGroup } } } : {}) };
        const nativeTaskIdentity = () => {};
        const owned = { driver: { contract: measured }, child: { contract: original }, state: { referenceContract: original },
            observations: [], page: { evaluate: async (callback, operation) => {
                if (callback === nativeTaskIdentity) { assert.equal(operation, 'remember'); calls.push('remember'); return { stored: true }; }
                return vm.runInNewContext('(' + callback.toString() + ')()', { innerWidth: 525, innerHeight: 546 });
            } } };
        const inspect = vm.runInNewContext('({' + method + '}).inspectNative', { assert, nativeAreas, nativeTaskIdentity,
            familyFor: actualFunction('familyFor', {}),
            runArea: async (handle, area) => { assert.equal(handle, owned); calls.push(area); handle.observations.push(area); },
            systemScene: async (handle, options) => { assert.equal(handle, owned); assert.equal(options.accountPages, false);
                assert.equal(handle.recordMode, false); calls.push('A13'); handle.observations.push('A13'); }
        });
        const result = await inspect(wrapped ? { owned } : owned, { group, driver: { contract: { decoyMustNotBeUsed: true } } });
        assert.equal(result, owned.observations);
        assert.deepEqual(calls, [...nativeAreas[group], 'remember']);
        assert.equal(owned.nativeResetPending, true, 'Existing reset/task identity obligation is retained.');
        assert.equal(JSON.stringify(owned.state.viewport), JSON.stringify({ width: 525, height: 546 }));
        assert.equal(owned.child.contract, optional && group === optionalGroup ? measured : original);
        assert.equal(owned.state.referenceContract, optional && group === optionalGroup ? measured : original);
        assert.equal(Object.hasOwn(original, 'nativeDateFocus'), false, 'The original measured reference is never mutated.');
    }
});

test('actual native hook still rejects unknown groups and failed remember identity', async () => {
    const start = source.indexOf('        async inspectNative(handle, { group }) {');
    const end = source.indexOf('\n        }\n    };', start);
    const method = source.slice(start, end + '\n        }'.length).trim();
    const nativeTaskIdentity = () => {}, calls = [];
    const owned = { driver: { contract: {} }, child: {}, state: {}, observations: [], page: { evaluate: async callback =>
        callback === nativeTaskIdentity ? { stored: false } : { width: 525, height: 546 } } };
    const inspect = vm.runInNewContext('({' + method + '}).inspectNative', { assert, nativeTaskIdentity,
        nativeAreas: { 'shell-search-customer-history': ['A01'] }, runArea: async () => calls.push('A01') });
    await assert.rejects(inspect(owned, { group: 'unknown-group' })); assert.deepEqual(calls, []);
    await assert.rejects(inspect({ owned }, { group: 'shell-search-customer-history' }));
    assert.deepEqual(calls, ['A01']); assert.equal(owned.nativeResetPending, undefined);
});

test('native Firefox focus-stage diagnostic is awaited before the unchanged return-focus failure', async () => {
    const result = await recordEditorOpeningHarness({ lostFocus: true, documentFocused: false });
    assert.equal(result.opened, false); assert.match(result.caught.message, /Actual Tab\/Shift\+Tab must return/);
    const stages = result.observations.filter(item => item.name.startsWith('records-after-keyboard-editor-'));
    assert.deepEqual(stages.map(item => item.name), ['records-after-keyboard-editor-setup-focus',
        'records-after-keyboard-editor-after-tab', 'records-after-keyboard-editor-after-shift-tab']);
    assert.deepEqual(stages.map(item => item.detail.focusStage.targetFocused), [true, false, false]);
    assert.equal(stages[0].detail.focusStage.activeId, 'editCustomerBtn');
    assert.equal(stages[1].detail.focusStage.activeId, 'resendMagazineBtn');
    assert.equal(stages[2].detail.focusStage.activeId, null);
    assert.ok(stages.every(item => item.detail.focusStage.documentFocused === false));
    assert.equal(result.events.includes('Enter'), false);
    assert.equal(result.events.at(-1), 'observe-records-after-keyboard-editor-after-shift-tab');
});

test('native focus-stage diagnostic projects only public allowlisted IDs/tags and booleans', async () => {
    const marker = 'synthetic-private-id-never-export';
    const result = await recordEditorOpeningHarness({ activeId: marker });
    assert.equal(result.caught, result.done);
    const stages = result.observations.filter(item => item.detail.focusStage).map(item => item.detail.focusStage);
    assert.equal(stages.length, 3); assert.equal(stages[1].activeId, null); assert.equal(stages[1].activeTag, 'BUTTON');
    assert.equal(JSON.stringify(stages).includes(marker), false);
    assert.equal(JSON.stringify(stages).includes('Synthetic private marker'), false);
    for (const stage of stages) assert.deepEqual(Object.keys(stage).sort(), ['activeId', 'activeIsBody', 'activeTag',
        'documentFocused', 'targetConnected', 'targetFocusVisible', 'targetFocusWithin', 'targetFocused'].sort());
});

async function physicalNativeContentHarness(options = {}) {
    const events = [], observations = [], listeners = {};
    let documentFocused = false, disposed = false, aborted = false;
    const bounds = { left: 40, right: 440, top: 100, bottom: 130, width: 400, height: 30 };
    const target = { isConnected: true, tagName: options.recordEditor ? (options.wrongTag ? 'DIV' : 'BUTTON') : 'H3',
        id: 'editCustomerBtn', type: options.wrongType ? 'submit' : 'button', disabled: options.disabled === true, tabIndex: -1, textContent: 'Abonnementen',
        getBoundingClientRect: () => ({ ...bounds, ...(options.badBounds ? { right: 721 } : {}) }),
        getAttribute: key => options.recordEditor ? (key === 'data-action' ? (options.wrongAction ? 'other-action' : 'edit-customer') : null) : 'indexHtml.text.abonnementen_ba5e4d7c',
        closest: () => options.recordEditor ? (options.outsideHeader ? null : {}) : options.interactive ? {} : null, contains: hit => hit === target };
    const window = { currentCustomer: { personId: '990970', credentialKey: 'synthetic-private-task-marker', sourceSystem: 'subscription-api' },
        kiwiCustomerWorkSession: { getRequestContext: () => ({ customerReference: { personId: '990970', credentialKey: 'synthetic-private-task-marker' } }) } };
    const originalField = { id: 'synthetic-private-field', value: 'synthetic-private-field-value', checked: false, disabled: false, readOnly: false };
    const fields = options.recordEditor ? [originalField] : [];
    const document = { querySelector: () => target, querySelectorAll: () => fields, elementFromPoint: () => options.covered ? {} : target,
        hasFocus: () => documentFocused };
    const realm = { document, window, innerWidth: 720, innerHeight: 500, outerWidth: 720, outerHeight: 543,
        devicePixelRatio: options.dpr || 2, visualViewport: { scale: 1 }, AbortController: class extends AbortController {
            abort() { aborted = true; super.abort(); }
        }, addEventListener: (type, callback) => { listeners[type] = callback; } };
    let proof;
    const page = { locator: selector => ({ scrollIntoViewIfNeeded: async () => events.push('scroll-public-heading') }),
        evaluate: async (callback, argument) => vm.runInNewContext('(' + callback.toString() + ')(argument)', { ...realm, argument }),
        evaluateHandle: async (callback, argument) => {
            const value = vm.runInNewContext('(' + callback.toString() + ')(argument)', { ...realm, argument });
            proof = { value, evaluate: async callback => callback(value), dispose: async () => { disposed = true; } }; return proof;
        }, waitForFunction: async (callback, argument) => { assert.equal(argument, proof); assert.equal(callback(proof.value), true); } };
    const compare = (action, parameters) => {
        events.push(action);
        if (action === 'move' || action === 'click') {
            if (action === 'click') {
                documentFocused = !options.noDocumentFocus;
                if (options.recordEditor) fields.push({ id: 'new-mounted-editor-field', value: 'new-synthetic-value' });
                if (options.mutateTaskAfterClick) window.currentCustomer.credentialKey = 'changed-private-task-marker';
            }
            const type = action === 'move' ? 'pointermove' : 'click';
            listeners[type]({ target: options.wrongClick && action === 'click' ? {} : target,
                isTrusted: !((options.untrustedMotion && action === 'move') || (options.untrustedClick && action === 'click')), clientX: 240, clientY: 115 });
            if (options.mutateTask && action === 'move') window.currentCustomer.credentialKey = 'changed-private-task-marker';
            if (options.mutateField && action === 'move') originalField.value = 'changed-private-field-value';
        }
        return { action, window: { windowId: options.changedWindow && action === 'move' ? 43 : 42, x: 0, y: 0, width: options.badWindow ? 700 : 1440, height: 1086 }, pointer: parameters.point || null };
    };
    const report = { environment: { browserVersion: '150.0.2' } };
    const handle = { sessionVerified: true, nativeGroup: 'shell-search-customer-history', descriptor: { native: true, role: 'kiwi-admin', locale: 'nl' },
        driver: { browserName: 'firefox' }, page, child: { report }, state: { report, suite: 'records-after-component',
            recordFixture: { id: 990970, recordCount: 2, componentOnly: true, customer: { personId: '990970', credentialKey: 'synthetic-private-task-marker', sourceSystem: 'subscription-api' } }, nativeKernel: { pointer: { display: options.display || ':96', compare } } },
        helpers: { operational: { physicalClientPoint, nativeReadonlyMotionOwnsTarget } } };
    if (options.changeHandle) options.changeHandle(handle);
    const run = actualFunction(options.recordEditor ? 'openFirefoxNativeRecordEditor' : 'prepareFirefoxNativeContent', { observeOperational: async (h, name) => {
        assert.equal(h, handle); observations.push(name); events.push(name);
    } });
    let error, press;
    try {
        if (options.recordEditor && options.phases) for (const phase of options.phases) await run(handle, phase);
        else press = await run(handle);
    } catch (caught) { error = caught; }
    return { error, press, events, observations, report, disposed, aborted,
        changeIdentity: () => { window.currentCustomer.credentialKey = 'changed-private-key-marker'; },
        changeLayout: () => { realm.innerWidth = 721; }, changeFocus: () => { documentFocused = false; }, restoreFocus: () => { documentFocused = true; } };
}

test('native Firefox uses the existing physical path only to focus exact public noninteractive content, preserving task and cleanup', async () => {
    const h = await physicalNativeContentHarness(); assert.equal(h.error, undefined);
    assert.deepEqual(h.events, ['scroll-public-heading', 'native-firefox-public-content-ready', 'query', 'move', 'click', 'native-firefox-public-content-focused']);
    assert.equal(h.report.nativeFirefoxContentFocus.sameTaskIdentity, true); assert.equal(h.report.nativeFirefoxContentFocus.documentFocused, true);
    assert.equal(h.disposed, true); assert.equal(h.aborted, true);
    const serialized = JSON.stringify(h.report);
    for (const privateValue of ['synthetic-private-task-marker', 'changed-private-task-marker', 'launchEnvironment', 'credentialKey']) assert.equal(serialized.includes(privateValue), false);
    for (const options of [{ interactive: true }, { covered: true }, { dpr: 1 }, { badWindow: true }, { untrustedMotion: true },
        { wrongClick: true }, { noDocumentFocus: true }, { mutateTask: true }]) {
        const bad = await physicalNativeContentHarness(options); assert.ok(bad.error); assert.equal(bad.disposed, true); assert.equal(bad.aborted, true);
        if (options.untrustedMotion || options.mutateTask || options.badWindow || options.interactive || options.covered || options.dpr) {
            assert.equal(bad.events.includes('click'), false, 'Unproven content target/motion/identity never receives a physical click.');
        }
    }
    for (const changeHandle of [h => { h.sessionVerified = false; }, h => { h.nativeGroup = 'article-cart-custom-calendar'; },
        h => { h.descriptor.native = false; }, h => { h.descriptor.role = 'kiwi-view'; }, h => { h.descriptor.locale = 'en'; },
        h => { h.driver.browserName = 'chromium'; }, h => { h.state.report.environment.browserVersion = '149'; },
        h => { h.state.suite = 'native-operational'; }, h => { h.state.recordFixture.id = 1; },
        h => { h.state.recordFixture.recordCount = 12; }, h => { h.state.recordFixture.componentOnly = false; }]) {
        const bad = await physicalNativeContentHarness({ changeHandle }); assert.ok(bad.error); assert.deepEqual(bad.events, []);
    }
    const display = await physicalNativeContentHarness({ display: ':95' }); assert.ok(display.error); assert.deepEqual(display.events, []);
});

test('native pointer API keeps launch environment inside main closure and leaves other launch modes absent', async () => {
    const main = await readFile(new URL('../../scripts/compose-smoke-theme-audit.mjs', import.meta.url), 'utf8');
    const marker = 'synthetic-private-environment-marker', launchEnvironment = { SYNTHETIC_PRIVATE: marker };
    for (const [nativeZoom, browserName] of [[false, 'firefox'], [true, 'chromium'], [true, 'firefox']]) {
        const calls = [];
        const create = actualFunction('finalNativePointer', { nativeZoom, browserName, displayName: ':96', launchEnvironment,
            nativePointerComparison: (kernel, action, parameters) => {
                assert.equal(kernel.launchEnvironment, launchEnvironment); calls.push(action); return { action, parameters };
            } }, main);
        const pointer = create();
        if (!nativeZoom || browserName !== 'firefox') { assert.equal(pointer, null); continue; }
        assert.deepEqual(Object.keys(pointer).sort(), ['compare', 'display']);
        assert.equal(JSON.stringify(pointer).includes(marker), false); assert.equal(Object.hasOwn(pointer, 'launchEnvironment'), false);
        pointer.compare('query', { expectedWidth: 1440 }); assert.deepEqual(calls, ['query']);
    }
});

test('legacy focus compatibility admits only the exact reviewed native-key extension', async () => {
    const body = await readFile(new URL('../../scripts/compose-smoke-theme-audit-operational.mjs', import.meta.url), 'utf8');
    const oldExported = restoreOriginalPointerModes(body);
    assert.equal(sha(oldExported), '60a1c5ce3f1f3e64b1b7b8dc1a24fbd299b87b035e55085ca81a8138e22fb686');
    const originalBody = oldExported.replace('export function nativePointerComparison(', 'function nativePointerComparison(');
    assert.equal(sha(originalBody), '6d92de17eec977297856200774f70f1abfed45ba37aee703c31d7afd6e342287');
    const pins = vm.runInNewContext(source.match(/const legacyFocusSha256s = (\[[\s\S]*?\n\]);/)[1]);
    assert.deepEqual(Array.from(pins), ['6d312cd304824f9117434ed7e84ba2bc437883d0b87963b826e3b94b092f05a9',
        '6d92de17eec977297856200774f70f1abfed45ba37aee703c31d7afd6e342287', sha(body)]);
    const verify = actualFunction('verifiedCriterionChecks', { legacyFocusPath: knownLegacySource.path, legacyFocusSha256s: pins,
        legacyFocusName: 'Actual five-second first trigger focus is retained and visible' });
    const record = { name: 'Actual five-second first trigger focus is retained and visible', matches: true, visible: true };
    assert.equal(verify([record], { ...knownLegacySource, sha256: sha(body) })[0].passed, true);
    for (const change of [{ matches: false }, { visible: false }, { extra: true }, { passed: false }]) {
        assert.throws(() => verify([{ ...record, ...change }], { ...knownLegacySource, sha256: sha(body) }));
    }
    assert.throws(() => verify([record], { ...knownLegacySource, sha256: '0'.repeat(64) }));
});

test('actual native matched-row rest capture positions the existing row without changing ordinary setup', async () => {
    for (const native of [false, true]) for (const browserName of ['chromium', 'firefox']) {
        const events = [], sheets = ['styles', 'article-search', 'delivery-date-picker', 'contextual-feedback', 'session-outbox'].map(name => '/assets/css/' + name + '.css');
        const row = { scrollIntoViewIfNeeded: async () => events.push('row-scroll'), hover: async () => events.push('hover'),
            evaluate: async () => ({ text: 'Synthetic same matched row', sheets }) };
        const field = { fill: async () => events.push('query'), press: async key => events.push(key) };
        const handle = { descriptor: { native }, driver: { browserName }, page: { locator: selector => selector === '#articleSaleForm' ? { isVisible: async () => true } : field,
            mouse: { move: async () => events.push('mouse-away') } }, child: { report: {}, check: (name, actual, expected) => assert.equal(actual, expected, name) } };
        const run = actualFunction('articleRowPaint', { cssNames: sheets.map(url => url.split('/').at(-1)), metaFor: () => ({}),
            visible: async () => row, checkpoint: async (h, name) => { assert.equal(h, handle); events.push(name); },
            moveFirefoxNativeArticlePointer: async (h, phase) => { assert.equal(h, handle); events.push('physical-' + phase); } });
        await run(handle);
        assert.equal(events.includes('row-scroll'), native);
        const physical = native && browserName === 'firefox';
        assert.ok(events.indexOf('article-matched-row-rest') < events.indexOf(physical ? 'physical-hover' : 'hover'));
        assert.equal(events.includes('physical-rest'), physical); assert.equal(events.includes('mouse-away'), !physical);
        if (native) assert.ok(events.indexOf('row-scroll') < events.indexOf('article-matched-row-rest'));
    }
});

function nativeCartPaintHarness(options = {}) {
    let focused = -1, scrollTop = options.rowsFit ? 0 : 14, tabs = 0;
    const events = [], captures = [], checks = [], values = { orderSubtotal: '€77,00', orderTotal: '€70,75' };
    const window = { orderItems: [{ quantity: 5 }, { quantity: 2 }] };
    const list = { clientLeft: 0, clientTop: 0, clientWidth: 440, clientHeight: 300, scrollHeight: options.rowsFit ? 258 : 314,
        get scrollTop() { return scrollTop; }, getBoundingClientRect: () => ({ left: 20, right: 460, top: 100, bottom: 400, width: 440, height: 300 }),
        querySelectorAll: selector => { assert.equal(selector, '.order-item'); return [{}, {}]; } };
    const firstRowHeight = options.rowsFit ? 137 : 169, secondRowHeight = options.rowsFit ? 113 : 137;
    const secondRowTop = 100 + firstRowHeight + 8;
    const rect = index => {
        const top = index === 0 ? 100 : secondRowTop, height = index === 0 ? firstRowHeight : secondRowHeight;
        return { left: 20, right: 460, top: top - scrollTop, bottom: top + height - scrollTop, width: 440, height };
    };
    const buttons = [0, 1].map(index => ({
        getBoundingClientRect: () => ({ left: 410, right: 450, top: rect(index).bottom - 48, bottom: rect(index).bottom - 8, width: 40, height: 40 }),
        closest: selector => selector === '#orderItemsList' ? list : { getBoundingClientRect: () => rect(index) },
        matches: selector => selector === ':focus-visible' && focused === index && !options.hiddenFocus,
        contains: node => node === buttons[index]
    }));
    const document = { get activeElement() { return buttons[focused] || {}; }, elementFromPoint: () => options.covered ? {} : buttons[focused],
        getElementById: id => ({ textContent: values[id] }) };
    const realm = { document, window, innerWidth: 525, innerHeight: 546, getComputedStyle: () => ({ overflowY: 'auto' }) };
    const evaluate = async (callback, node) => vm.runInNewContext('(' + callback.toString() + ')(node)', { ...realm, node });
    const locators = buttons.map((node, index) => ({ evaluate: callback => evaluate(callback, node), focus: async () => {
        assert.equal(index, 0, 'Only first remove gets setup focus; Beta must be reached by actual Tab.'); focused = 0; scrollTop = 0; events.push('setup-alpha');
    } }));
    const page = { evaluate: callback => evaluate(callback), keyboard: { press: async key => {
        assert.equal(key, 'Tab'); events.push('Tab'); tabs++;
        if (tabs === 2) { focused = options.wrongFocus ? 0 : 1; if (!options.noInnerScroll) scrollTop = options.rowsFit ? 0 : 14;
            if (options.mutateCart) window.orderItems[0].quantity = 6; }
    } }, locator: selector => { assert.equal(selector, '#orderItemsList'); return { scrollIntoViewIfNeeded: async () => events.push('list-scroll'),
        locator: query => { assert.equal(query, '.order-item-remove'); return { first: () => locators[0], nth: index => locators[index] }; } }; } };
    const handle = { descriptor: { native: true }, page, child: { painted: async actualPage => { assert.equal(actualPage, page); events.push('painted'); },
        check: (name, actual, expected, meta) => { checks.push({ name, actual, meta }); assert.equal(actual, expected, name); } } };
    const run = actualFunction('inspectNativeArticleCart', { metaFor: () => ({}), checkpoint: async (h, name) => {
        assert.equal(h, handle); captures.push(name); events.push(name);
    } });
    return { run: () => run(handle), captures, checks, events };
}

test('actual native cart capture uses setup Alpha focus then exactly one Tab to fully visible Beta and preserves quote', async () => {
    const h = nativeCartPaintHarness(); await h.run();
    assert.deepEqual(h.captures, ['native-cart-alpha-actual-keyboard-stop', 'native-cart-beta-actual-keyboard-stop']);
    assert.deepEqual(h.events, ['list-scroll', 'Tab', 'setup-alpha', 'painted', 'native-cart-alpha-actual-keyboard-stop',
        'Tab', 'painted', 'native-cart-beta-actual-keyboard-stop']);
    assert.equal(h.checks.length, 4);
    assert.equal(h.checks[1].meta.measured.scrollTop, 0); assert.equal(h.checks[2].meta.measured.scrollTop, 14);
    const fitting = nativeCartPaintHarness({ rowsFit: true, noInnerScroll: true }); await fitting.run();
    assert.equal(fitting.checks[1].meta.measured.scrollTop, 0); assert.equal(fitting.checks[2].meta.measured.scrollTop, 0);
    assert.deepEqual(fitting.captures, h.captures, 'Two already visible rows need no artificial scrolling to satisfy paint.');
    for (const options of [{ wrongFocus: true }, { hiddenFocus: true }, { covered: true }, { noInnerScroll: true }, { mutateCart: true }]) {
        await assert.rejects(nativeCartPaintHarness(options).run());
    }
});

test('actual cart builder adds capture setup only for native context after the unchanged two source adds', async () => {
    for (const native of [false, true]) {
        const stop = new Error('Synthetic boundary before original coupon flow'), calls = [];
        let selectedId = '990601';
        const page = { locator(selector) {
            const item = { first() { return this; }, async press(key) { calls.push([selector, key]);
                if (selector.includes('990602')) selectedId = '990602'; }, async waitFor() {},
                async fill(value) { if (selector === '#couponCode') throw stop; calls.push([selector, value]); },
                async getAttribute() { return selectedId; } };
            return item;
        }, waitForFunction: async () => {} };
        const handle = { descriptor: { native }, page, child: { check: (name, actual, expected) => assert.equal(actual, expected, name) },
            helpers: { article: { observeArticle: async (p, child, meta, state) => calls.push(['observe', state]) } } };
        const run = actualFunction('buildArticleCart', { metaFor: () => ({}), visible: async () => {},
            inspectNativeArticleCart: async h => { assert.equal(h, handle); calls.push(['native-only-captures']); } });
        await assert.rejects(run(handle), error => error === stop);
        assert.equal(calls.filter(item => item[0] === 'native-only-captures').length, native ? 1 : 0);
        assert.deepEqual(calls.filter(item => item[0] === '#articleQuantity').map(item => item[1]), ['5', 'Tab', '2', 'Tab']);
        assert.equal(calls.filter(item => item[0] === '[data-action=add-article-to-order]').length, 2);
        if (native) assert.ok(calls.findIndex(item => item[0] === 'native-only-captures') > calls.findIndex(item => item[1] === 'populated-quote'));
    }
});

function restoreOriginalPointerModes(body) {
    const captureLine = "    if (state.nativeKernel) await page.locator('#subscriptionQueuePanel').scrollIntoViewIfNeeded();\n";
    assert.equal(body.split(captureLine).length - 1, 3, 'Only three native initial-outbox capture placements changed.');
    body = body.replaceAll(captureLine, '');
    body = body.replace("    assert.ok(['query', 'move', 'click', 'key'].includes(action));\n    if (action === 'key') {\n        assert.ok(['Tab', 'Shift+Tab', 'Enter'].includes(parameters.key));\n        assert.ok(Number.isSafeInteger(parameters.expectedWindowId) && parameters.expectedWindowId > 0);\n    }", "    assert.ok(['query', 'move', 'click'].includes(action));");
    body = body.replace("x.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong]; x.XKeysymToKeycode.restype=ctypes.c_ubyte\nt.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]\n", "");
    body = body.replace(" if mode=='key':\n  if box['windowId']!=p['expectedWindowId']: raise RuntimeError('Native key must stay in the original owned browser window')\n  names={'Tab':[0xff09],'Shift+Tab':[0xffe1,0xff09],'Enter':[0xff0d]}\n  if p['key'] not in names: raise RuntimeError('Only the declared native editor keys are allowed')\n  codes=[x.XKeysymToKeycode(d,keysym) for keysym in names[p['key']]]\n  if not all(codes): raise RuntimeError('Native keycode unavailable')\n  for code in codes: t.XTestFakeKeyEvent(d,code,1,0)\n  for code in reversed(codes): t.XTestFakeKeyEvent(d,code,0,0)\n  x.XFlush(d); time.sleep(0.1)\n elif mode!='query':", " if mode!='query':");
    return body;
}

test('native content press callback enforces the original OS-key order and retains geometry/source guards', async () => {
    const h = await physicalNativeContentHarness(); assert.equal(h.error, undefined); assert.equal(typeof h.press, 'function');
    for (const key of ['Tab', 'Shift+Tab', 'Enter']) await h.press(key);
    assert.deepEqual(Array.from(h.report.nativeFirefoxContentFocus.keys, item => item.key), ['Tab', 'Shift+Tab', 'Enter']);
    assert.equal(h.events.filter(event => event === 'key').length, 3);
    for (const key of ['Space', 'Control+Tab', 'Escape', 'Return', '', null]) {
        const before = h.events.length; await assert.rejects(h.press(key)); assert.equal(h.events.length, before);
    }
    for (const change of ['changeIdentity', 'changeLayout', 'changeFocus']) {
        const bad = await physicalNativeContentHarness(); bad[change]();
        await assert.rejects(bad.press('Tab')); assert.equal(bad.events.includes('key'), false);
    }
    assert.equal(JSON.stringify(h.report).includes('synthetic-private-task-marker'), false);
});

test('existing physical comparison dispatch bounds native keys before OS spawn and preserves all original pointer modes', async () => {
    const body = await readFile(new URL('../../scripts/compose-smoke-theme-audit-operational.mjs', import.meta.url), 'utf8');
    const calls = [], environment = { SYNTHETIC_PRIVATE: 'never-export-private-environment' };
    const compare = actualFunction('nativePointerComparison', { execFileSync: (program, args, options) => {
        assert.equal(program, 'python3'); assert.equal(options.env, environment); calls.push({ args, script: options.input });
        return JSON.stringify({ action: args[1], window: { windowId: 42 }, pointer: { x: 1, y: 1 } });
    } }, body);
    for (const key of ['Tab', 'Shift+Tab', 'Enter']) compare({ launchEnvironment: environment }, 'key', { key, expectedWindowId: 42 });
    const count = calls.length;
    for (const key of ['Space', 'Control+Tab', 'Escape', 'Return', '', null]) assert.throws(() => compare({ launchEnvironment: environment }, 'key', { key, expectedWindowId: 42 }));
    for (const expectedWindowId of [null, 0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => compare({ launchEnvironment: environment }, 'key', { key: 'Tab', expectedWindowId }));
    assert.equal(calls.length, count);
    for (const action of ['query', 'move', 'click']) compare({ launchEnvironment: environment }, action, { expectedWidth: 1440, expectedHeight: 1086 });
    assert.deepEqual(calls.slice(-3).map(item => item.args[1]), ['query', 'move', 'click']);
    runLocal('python3', ['-c', 'import sys; compile(sys.stdin.read(), "existing-native-pointer.py", "exec")'], { input: calls[0].script });
    assert.match(calls[0].script, /box\['windowId'\]!=p\['expectedWindowId'\]/);
    assert.match(calls[0].script, /for code in reversed\(codes\): t.XTestFakeKeyEvent\(d,code,0,0\)/);
    assert.equal(sha(restoreOriginalPointerModes(body)), '60a1c5ce3f1f3e64b1b7b8dc1a24fbd299b87b035e55085ca81a8138e22fb686');
});


test('native Shift+Tab may return from browser chrome only after the original Tab; initial/final focus and strict return policy stay', async () => {
    const h = await physicalNativeContentHarness(); await h.press('Tab'); h.changeFocus();
    await h.press('Shift+Tab');
    assert.deepEqual(Array.from(h.report.nativeFirefoxContentFocus.keys, item => item.key), ['Tab', 'Shift+Tab']);
    h.restoreFocus(); await h.press('Enter');
    for (const sequence of [['Shift+Tab'], ['Enter'], ['Tab', 'Tab'], ['Tab', 'Enter'], ['Tab', 'Shift+Tab', 'Shift+Tab'],
        ['Tab', 'Shift+Tab', 'Enter', 'Enter']]) {
        const bad = await physicalNativeContentHarness();
        for (const key of sequence.slice(0, -1)) await bad.press(key);
        const before = bad.events.filter(event => event === 'key').length;
        await assert.rejects(bad.press(sequence.at(-1)));
        assert.equal(bad.events.filter(event => event === 'key').length, before);
    }
    const final = await physicalNativeContentHarness(); await final.press('Tab'); await final.press('Shift+Tab'); final.changeFocus();
    await assert.rejects(final.press('Enter')); assert.equal(final.report.nativeFirefoxContentFocus.keys.length, 2);
    for (const change of ['changeIdentity', 'changeLayout']) {
        const bad = await physicalNativeContentHarness(); await bad.press('Tab'); bad.changeFocus(); bad[change]();
        await assert.rejects(bad.press('Shift+Tab')); assert.equal(bad.report.nativeFirefoxContentFocus.keys.length, 1);
    }
});

test('native initial outbox positions the existing panel before all three original observations without changing held/error/empty sequencing', async () => {
    for (const native of [false, true]) {
        const events = [], state = { ...(native ? { nativeKernel: {} } : {}) };
        const control = { mode: 'held', held: [true], release() { events.push('release-' + this.mode); this.held = []; } };
        const page = { locator: selector => {
            if (selector === '#subscriptionQueuePanel') return { scrollIntoViewIfNeeded: async () => events.push('scroll-' + control.mode) };
            assert.equal(selector, '[data-action="toggle-subscription-queue-info"]');
            return { press: async key => { assert.equal(key, 'Enter'); events.push('toggle-' + control.mode); } };
        }, waitForFunction: async () => { assert.equal(control.mode, 'error'); events.push('wait-error'); } };
        const run = actualFunction('initialOutbox', { observe: async (actualPage, actualState, name, roots) => {
            assert.equal(actualPage, page); assert.equal(actualState, state); assert.deepEqual(Array.from(roots), ['#subscriptionQueuePanel']);
            events.push('observe-' + name + '-' + control.mode);
        }, refresh: async () => events.push('refresh-' + control.mode) }, operationalSource);
        await run(page, state, control);
        assert.deepEqual(events, ['toggle-held', ...(native ? ['scroll-held'] : []), 'observe-outbox-initial-loading-held',
            'release-error', 'wait-error', ...(native ? ['scroll-error'] : []), 'observe-outbox-initial-error-error',
            'refresh-empty', ...(native ? ['scroll-empty'] : []), 'observe-outbox-initial-empty-empty', 'refresh-ready', 'toggle-ready']);
    }
});

test('native feedback captures the actual image canvas after unchanged strong privacy/control review and before bitmap read', async () => {
    const overlaySource = await readFile(new URL('../../scripts/compose-smoke-theme-audit-overlays-acceptance.mjs', import.meta.url), 'utf8');
    for (const native of [false, true]) {
        const events = [], comment = 'Synthetic unchanged image comment', feedbackSelector = '.contextual-feedback-modal';
        const target = { isVisible: async () => !native, scrollIntoViewIfNeeded: async () => events.push('heading-scroll'),
            boundingBox: async () => ({ x: 10, y: 20, width: 100, height: 24 }),
            evaluate: async callback => callback.constructor.name === 'AsyncFunction' ? { selector: 'public-heading' } : false };
        const page = { locator: selector => {
            if (selector === '#welcomeMessage h2' || selector.startsWith('section.history-card')) return target;
            if (selector === 'textarea[name=comment]') return { fill: async value => { assert.equal(value, comment); events.push('fill-comment'); }, inputValue: async () => comment };
            if (selector === '[data-feedback-add-screenshot]') return { press: async key => { assert.equal(key, 'Enter'); events.push('add-screenshot'); } };
            if (selector === '.contextual-feedback-picker-overlay') return { waitFor: async () => events.push('picker-visible') };
            if (selector === feedbackSelector) return { evaluate: async () => ({ hidden: true, open: false, display: 'none', reviewing: false, ordinary: false }) };
            if (selector === '.contextual-feedback-modal.has-screenshot canvas') return { waitFor: async () => events.push('canvas-ready') };
            assert.equal(selector, '[data-feedback-canvas]'); return { scrollIntoViewIfNeeded: async () => events.push('canvas-scroll'),
                evaluate: async () => { events.push('bitmap-read'); return { width: 100, height: 24, pixels: 'unchanged-synthetic-png' }; } };
        }, mouse: { click: async () => events.push('picker-click') }, waitForFunction: async () => events.push('capture-complete') };
        const driver = { report: { slice: 10 } }, meta = { native, prefix: 'outbox-feedback-image-system-' };
        const run = actualFunction('captureReviewedHeading', { comment, feedbackSelector, openFeedback: async () => events.push('open-feedback'),
            check: (d, m, name, passed) => { assert.equal(passed, true, name); events.push('original-check'); },
            inspectDialog: async () => { events.push('original-control-review'); return { extra: { bodyReviewing: true }, data: {
                root: { background: 'rgba(15, 23, 42, 0.86)', backdropFilter: 'blur(14px)' }, background: { filter: 'blur(18px)', opacity: '0.08' } } }; },
            observe: async (p, d, m, name, selector) => { assert.equal(p, page); assert.equal(d, driver); assert.equal(m, meta);
                if (name === 'image-review-canvas-visible') assert.equal(selector, '[data-feedback-canvas]'); events.push('observe-' + name); }
        }, overlaySource);
        const result = await run(page, driver, meta); assert.equal(result.image.pixels, 'unchanged-synthetic-png');
        assert.deepEqual(events.slice(events.indexOf('original-control-review')), ['original-control-review', 'original-check',
            ...(native ? ['canvas-scroll', 'observe-image-review-canvas-visible'] : []), 'bitmap-read']);
        assert.equal(events.filter(event => event === 'observe-capture-suspended').length, 1);
    }
});

async function actualConfirmationHarness(options = {}) {
    const events = [], checks = [], writes = [], items = [
        { id: 990910, capabilities: { edit: false, pause: false, resume: false, delete: false } },
        { id: 990911, capabilities: { edit: true, pause: false, resume: true, delete: options.noEligible !== true } }
    ];
    const before = JSON.stringify(items); let onDialog;
    const row = item => ({ locator: selector => ({ press: async key => {
        assert.equal(key, 'Enter');
        if (selector === '[data-outbox-control=actions]') {
            assert.equal(item.capabilities.delete, true, 'The actual restricted first row has no action disclosure.');
            events.push('actions-' + item.id); return;
        }
        assert.equal(selector, '.session-outbox-menu .is-destructive'); events.push('delete-' + item.id);
        await onDialog({ type: () => options.promptType || 'confirm', message: () => options.badPrompt ? 'Wrong prompt' : 'Alle 1 wijzigingen verwijderen?',
            dismiss: async () => { events.push('dismiss'); if (options.writeOnCancel) writes.push('unexpected-write'); } });
    } }) });
    const page = { evaluate: async callback => vm.runInNewContext('(' + callback.toString() + ')()', {
        window: { kiwiOutbox: { refreshOutbox: async () => events.push('actual-refresh') } } }),
        locator: selector => {
            if (selector === '#subscriptionQueueToggle') return { getAttribute: async () => 'true' };
            if (selector === '.session-outbox-item') return { first: () => row(items[0]) };
            const match = /^#subscriptionQueueList > \.session-outbox-item\[data-session-id="(\d+)"\]$/.exec(selector);
            assert.ok(match, 'Scope the disclosure to the selected declared session identity.');
            const item = items.find(item => String(item.id) === match[1]); assert.ok(item); return row(item);
        }, once: (type, handler) => { assert.equal(type, 'dialog'); onDialog = handler; } };
    const child = { report: { localCallWrites: writes }, check(name, actual, expected) { checks.push(name); assert.equal(actual, expected, name); } };
    const control = { items, mode: 'held', release() { events.push('release'); } };
    const run = actualFunction('inspectCancelConfirmation', { metaFor: () => ({}) });
    let error; try { await run({ page, control, child }); } catch (caught) { error = caught; }
    assert.equal(JSON.stringify(items), before, 'Existing source capabilities/record identities must remain unchanged.');
    return { error, events, checks, report: child.report };
}

test('A13 confirmation selects the existing delete-eligible session after A11 restricted-first fallback and still cancels without write', async () => {
    const good = await actualConfirmationHarness(); assert.equal(good.error, undefined);
    assert.deepEqual(good.events, ['release', 'actual-refresh', 'actions-990911', 'delete-990911', 'dismiss']);
    assert.equal(good.report.confirmation.decision, 'cancel'); assert.equal(good.report.localCallWrites.length, 0);
    assert.equal(good.checks.length, 2);
    const missing = await actualConfirmationHarness({ noEligible: true }); assert.ok(missing.error);
    assert.equal(missing.events.some(event => /actions|delete/.test(event)), false);
    for (const options of [{ promptType: 'alert' }, { badPrompt: true }, { writeOnCancel: true }]) {
        const bad = await actualConfirmationHarness(options); assert.ok(bad.error, 'Original prompt and no-write assertions remain strict.');
    }
});

test('A13 native-only whole-frame checkpoint retains the actual live inline error before closing its existing form', async () => {
    for (const native of [false, true]) {
        const events = [], handle = { descriptor: { native }, child: { check: (name, actual, expected) => assert.equal(actual, expected) },
            helpers: { overlays: { inspectInlineNotice: async () => events.push('inspect-live-error') } } };
        handle.page = { evaluate: async (callback, argument) => vm.runInNewContext('(' + callback.toString() + ')(argument)', {
            argument, window: { kiwiDeliveryRemarksSlice: { editDeliveryRemarks: () => events.push('open'),
                closeEditRemarksModal: () => events.push('close') }, kiwiAppShellSlice: { showToast: () => events.push('live-error') } } }),
            locator: selector => { assert.equal(selector, '#editDeliveryRemarksModal .overlay-notification.error'); return { isVisible: async () => true }; } };
        const field = { fill: async () => events.push('fill'), focus: async () => events.push('focus') };
        const run = actualFunction('systemScene', { metaFor: () => ({}), restoreEditableCustomer: async () => events.push('restore'),
            visible: async () => field, criterion: async (h, id, title, action) => { if (id === 'toast-inline-error-and-confirmation') await action(); },
            checkpoint: async (h, name) => { assert.equal(h, handle); assert.equal(name, 'system-live-inline-error'); events.push('whole-live-error'); },
            inspectCancelConfirmation: async () => events.push('confirmation') }, source.slice(0, source.indexOf('\nconst implementations =')));
        await run(handle, { accountPages: false });
        assert.deepEqual(events, ['restore', 'open', 'fill', 'focus', 'live-error', 'inspect-live-error',
            ...(native ? ['whole-live-error'] : []), 'close', 'confirmation']);
    }
});


test('native Enter diagnostic records only trusted owned activation and always removes its scoped listeners', async () => {
    const good = await recordEditorOpeningHarness(); assert.equal(good.caught, good.done);
    const receipt = good.observations.at(-1); assert.equal(receipt.name, 'records-after-keyboard-editor-after-enter');
    assert.equal(JSON.stringify(receipt.detail.activationReceipt), JSON.stringify({ enterKeyDown: true, enterKeyUp: true, trustedClick: true,
        documentFocused: true, invokerFocused: true, openEditorCount: 1, bankActionCount: 1 }));
    for (const options of [{ untrustedEnter: true }, { otherTarget: true }, { unrelatedKey: true }]) {
        const run = await recordEditorOpeningHarness(options); assert.equal(run.caught, run.done);
        const actual = run.observations.at(-1).detail.activationReceipt;
        assert.equal(actual.enterKeyDown, false); assert.equal(actual.enterKeyUp, false);
        assert.equal(actual.trustedClick, options.unrelatedKey === true);
        assert.equal(JSON.stringify(actual).includes('Synthetic private marker'), false);
        assert.equal(run.listenerCount, 0); assert.equal(run.disposed, true);
    }
    for (const options of [{ enterThrows: true }, { afterEnterObservationThrows: true }]) {
        const failed = await recordEditorOpeningHarness(options); assert.ok(failed.caught); assert.notEqual(failed.caught, failed.done);
        assert.equal(failed.listenerCount, 0); assert.equal(failed.disposed, true);
    }
    assert.equal(good.listenerCount, 0); assert.equal(good.disposed, true);
    for (const options of [{ keyboard: false }, { keyboard: false, touch: true }, { legacyReadonly: true }]) {
        const ordinary = await recordEditorOpeningHarness(options); assert.equal(ordinary.disposed, false);
        assert.equal(ordinary.observations.some(item => item.name === 'records-after-keyboard-editor-after-enter'), false);
    }
});


test('native catalogue action awaits the installed current search busy owner while ordinary action sequencing is unchanged', async () => {
    const searchSource = await readFile(new URL('../../assets/js/app/slices/article-search-slice.js', import.meta.url), 'utf8');
    for (const native of [false, true]) {
        const events = [], stop = new Error('Synthetic boundary at unchanged catalogue visibility assertion');
        const attrs = () => { const values = new Map(); return { getAttribute: key => values.get(key) ?? null,
            setAttribute: (key, value) => values.set(key, value), removeAttribute: key => values.delete(key) }; };
        const input = attrs(), dropdown = attrs(), status = { textContent: '' };
        const document = { getElementById: id => ({ articleSearch: input, articleDropdown: dropdown, articleSearchStatus: status })[id] || null };
        const context = vm.createContext({ translateArticle: (_key, _values, fallback) => fallback });
        vm.runInContext(['readBusyAttribute', 'restoreBusyAttribute', 'beginArticleSearchFeedback', 'finishArticleSearchFeedback']
            .map(name => declaration(name, searchSource)).join('\n')
            + '\nlet articleSearchFeedback = null; globalThis.busy = { begin: beginArticleSearchFeedback, finish: finishArticleSearchFeedback };', context);
        const busy = context.busy; let currentOwner, olderOwner, readinessWaited = false;
        const page = { locator: selector => ({ first() { return this; }, press: async key => {
            assert.equal(key, 'Enter');
            if (selector === '#articleDropdown .browse-all-link') {
                assert.equal(readinessWaited, native); events.push('browse-original-Enter');
            } else assert.equal(selector, '[data-action=open-article-sale-form]');
        }, fill: async value => { assert.equal(selector, '#articleSearch'); assert.equal(value, 'Synthetic'); events.push('original-fill');
            olderOwner = busy.begin(document); currentOwner = busy.begin(document);
        } }), waitForFunction: async callback => {
            readinessWaited = true; events.push('wait-source-readiness');
            const read = () => vm.runInNewContext('(' + callback.toString() + ')()', { document });
            assert.equal(read(), false);
            busy.finish(olderOwner); assert.equal(read(), false, 'Older response completion cannot clear the current busy owner.');
            busy.finish(currentOwner); assert.equal(read(), true);
            input.setAttribute('aria-busy', 'true'); assert.equal(read(), false); input.removeAttribute('aria-busy');
            dropdown.setAttribute('aria-busy', 'true'); assert.equal(read(), false); dropdown.removeAttribute('aria-busy');
            const missing = vm.runInNewContext('(' + callback.toString() + ')()', { document: { getElementById: () => null } });
            assert.equal(missing, false, 'Missing installed controls cannot masquerade as settled readiness.');
        } };
        const handle = { descriptor: { native }, page, child: {}, helpers: {} };
        const run = actualFunction('buildArticleCart', { metaFor: () => ({}), visible: async (actual, selector) => {
            assert.equal(actual, handle); if (selector === '#allArticlesModal') throw stop; assert.equal(selector, '#articleSaleForm');
        } });
        await assert.rejects(run(handle), error => error === stop);
        assert.deepEqual(events, ['original-fill', ...(native ? ['wait-source-readiness'] : []), 'browse-original-Enter']);
    }
});


test('native component restores the original pointer opening before unchanged record assertions and leaves other paths intact', async () => {
    const good = await recordEditorOpeningHarness({ physicalComponent: true }); assert.equal(good.caught, good.done);
    assert.equal(good.opened, true); assert.ok(good.events.includes('original-component-physical-callback'));
    assert.equal(good.events.some(event => event.startsWith('OS-') || event === 'setup-focus'), false);
    for (const changeState of [s => { s.suite = 'native-operational'; }, s => { s.recordFixture.componentOnly = false; },
        s => { s.report.environment.browser = 'chromium'; }, s => { s.report.environment.native = false; }, s => { s.nativeKernel = null; }]) {
        const bad = await recordEditorOpeningHarness({ physicalComponent: true, changeState }); assert.ok(bad.caught); assert.equal(bad.opened, false);
    }
    const touch = await recordEditorOpeningHarness({ physicalComponent: true, touch: true }); assert.ok(touch.caught); assert.equal(touch.opened, false);
});

test('physical native record button uses existing owned pointer and trusted activation while retaining original fields as editor fields mount', async () => {
    const good = await physicalNativeContentHarness({ recordEditor: true }); assert.equal(good.error, undefined);
    assert.deepEqual(good.events, ['scroll-public-heading', 'native-firefox-record-button-ready', 'query', 'move', 'click', 'native-firefox-record-button-activated']);
    const proof = good.report.nativeFirefoxRecordOpening; assert.equal(proof.before.exactButton, true);
    assert.equal(proof.before.sameCanonicalIdentity, true); assert.equal(proof.sameTaskAndOriginalFields, true);
    assert.equal(proof.clickEvent.trusted, true); assert.equal(proof.clickEvent.ownsExpectedTarget, true);
    assert.equal(good.disposed, true); assert.equal(good.aborted, true);
    const encoded = JSON.stringify(proof);
    for (const value of ['credentialKey', 'synthetic-private-task-marker', 'synthetic-private-field', 'synthetic-private-field-value']) assert.equal(encoded.includes(value), false);
    for (const options of [{ wrongTag: true }, { wrongType: true }, { wrongAction: true }, { outsideHeader: true }, { disabled: true },
        { badBounds: true }, { covered: true }, { dpr: 1 }, { badWindow: true }, { changedWindow: true }, { untrustedMotion: true },
        { mutateTask: true }, { mutateField: true }, { wrongClick: true }, { untrustedClick: true }, { mutateTaskAfterClick: true }, { noDocumentFocus: true }]) {
        const bad = await physicalNativeContentHarness({ recordEditor: true, ...options }); assert.ok(bad.error, JSON.stringify(options));
        assert.equal(bad.disposed, true); assert.equal(bad.aborted, true);
        if (!options.wrongClick && !options.untrustedClick && !options.mutateTaskAfterClick && !options.noDocumentFocus) assert.equal(bad.events.includes('click'), false);
    }
    for (const changeHandle of [h => { h.sessionVerified = false; }, h => { h.nativeGroup = 'article-cart-custom-calendar'; },
        h => { h.descriptor.native = false; }, h => { h.descriptor.role = 'kiwi-view'; }, h => { h.descriptor.locale = 'en'; },
        h => { h.driver.browserName = 'chromium'; }, h => { h.state.report.environment.browserVersion = '149'; },
        h => { h.state.suite = 'native-operational'; }, h => { h.state.recordFixture.id = 1; },
        h => { h.state.recordFixture.recordCount = 12; }, h => { h.state.recordFixture.componentOnly = false; }]) {
        const bad = await physicalNativeContentHarness({ recordEditor: true, changeHandle }); assert.ok(bad.error); assert.deepEqual(bad.events, []);
    }
    const display = await physicalNativeContentHarness({ recordEditor: true, display: ':95' }); assert.ok(display.error); assert.deepEqual(display.events, []);
});


test('native Firefox component person draft selects the same real record twice by scroll and Enter before the original exact write gate', async () => {
    const native = await recordEditorOpeningHarness({ physicalComponent: true, mutationActions: true });
    assert.equal(native.caught, native.done); assert.deepEqual(native.mutationEvents, ['scroll', 'Enter', 'scroll', 'Enter', 'arm']);
    assert.equal(native.mutationValue, 'Geachte mevrouw', 'Raw writable phrase and retained same-field draft remain unchanged.');
    const ordinary = await recordEditorOpeningHarness({ keyboard: false, mutationActions: true });
    assert.equal(ordinary.caught, ordinary.done); assert.deepEqual(ordinary.mutationEvents, ['click', 'click', 'arm']);
    assert.equal(ordinary.mutationValue, 'Geachte mevrouw');
    const email = await recordEditorOpeningHarness({ physicalComponent: true, mutationActions: true, mutationSection: 'email' });
    assert.equal(email.caught, email.done); assert.deepEqual(email.mutationEvents, ['click', 'click']);
    assert.equal(email.mutationValue, 'changed@example.invalid');
});


test('native person scenario preserves the original held503 draft and two source reads through keyboard close and second physical retained opening', async () => {
    const run = await recordEditorOpeningHarness({ physicalComponent: true, mutationActions: true, completePersonMutation: true });
    assert.equal(run.caught, undefined);
    assert.deepEqual(run.mutationEvents, ['physical-initial', 'scroll', 'Enter', 'scroll', 'Enter', 'arm', 'submit',
        'wait-response', 'release-503', 'wait-response', 'close-scroll', 'close-Enter', 'dialog-hidden', 'physical-retained', 'dialog-visible']);
    assert.equal(run.mutationValue, 'Geachte mevrouw');
    assert.deepEqual(run.observations.slice(-3).map(item => item.name), ['records-after-component-pending-person',
        'records-after-component-error-person', 'records-after-component-reopened-person']);
    assert.equal(run.observations.at(-1).detail.sourceReadCount, 2);
});

test('physical component activations admit exactly initial then retained with separate reports and never a third click', async () => {
    const good = await physicalNativeContentHarness({ recordEditor: true, phases: ['initial', 'retained'] });
    assert.equal(good.error, undefined); assert.equal(good.events.filter(event => event === 'click').length, 2);
    assert.deepEqual(Array.from(good.report.nativeFirefoxRecordOpenings, item => item.phase), ['initial', 'retained']);
    assert.equal(good.report.nativeFirefoxRetainedRecordOpening.sameTaskAndOriginalFields, true);
    assert.equal(new Set(good.observations).size, 4, 'Initial and retained whole-frame names cannot overwrite each other.');
    for (const phases of [['retained'], ['initial', 'initial'], ['initial', 'retained', 'retained']]) {
        const bad = await physicalNativeContentHarness({ recordEditor: true, phases }); assert.ok(bad.error);
        assert.equal(bad.events.filter(event => event === 'click').length, phases[0] === 'retained' ? 0 : phases.length - 1);
    }
});


test('native person lookup uses actual existing-radio Space only when needed and preserves original lookup sequence', async () => {
    const body = await readFile(new URL('../../scripts/compose-smoke-theme-audit-subscription.mjs', import.meta.url), 'utf8');
    for (const keyboardChoice of [false, true]) for (const initiallyChecked of [false, true]) {
        const events = []; let checked = initiallyChecked;
        const roleState = { recipient: { selectedPerson: null } };
        const radio = { isChecked: async () => checked, scrollIntoViewIfNeeded: async () => events.push('scroll-radio'),
            check: async () => { checked = true; events.push('original-check'); },
            press: async key => { assert.equal(key, 'Space'); checked = true; events.push('Space'); } };
        const page = { locator: selector => {
            if (selector.startsWith('input[name=')) return radio;
            if (selector === '#recipientPersonSearch') return { evaluate: async () => true };
            if (selector === '#recipientSearchQuery') return { fill: async value => { assert.equal(value, 'recipient'); events.push('fill-query'); } };
            return { press: async key => { assert.equal(key, 'Enter'); events.push(selector === '#recipientSearchButton' ? 'search-Enter' : 'result-Enter');
                if (selector !== '#recipientSearchButton') roleState.recipient.selectedPerson = { id: 990501 }; } };
        }, waitForFunction: async (callback, argument) => {
            assert.equal(vm.runInNewContext('(' + callback.toString() + ')(argument)', { subscriptionRoleState: roleState, argument }), true);
            events.push('verify-original-selected-id');
        } };
        const run = actualFunction('selectPerson', {}, body);
        await run(page, 'recipient', 'recipient', 990501, keyboardChoice);
        assert.deepEqual(events, [...(keyboardChoice ? initiallyChecked ? [] : ['scroll-radio', 'Space'] : ['original-check']),
            'fill-query', 'search-Enter', 'result-Enter', 'verify-original-selected-id']);
    }
    const events = [], page = { locator: () => ({ isChecked: async () => false,
        scrollIntoViewIfNeeded: async () => events.push('scroll'), press: async () => events.push('Space') }) };
    await assert.rejects(actualFunction('selectPerson', {}, body)(page, 'recipient', 'recipient', 990501, true), /requires the actual existing-person choice/);
    assert.deepEqual(events, ['scroll', 'Space'], 'Unchecked or disabled actual radio never proceeds to lookup after an ineffective Space.');
});

test('actual subscription scenario selects keyboard radio setup only for after native Firefox and both original roles', async () => {
    const body = await readFile(new URL('../../scripts/compose-smoke-theme-audit-subscription.mjs', import.meta.url), 'utf8');
    for (const [phase, native, browserName, expected] of [['after', true, 'firefox', true], ['after', true, 'chromium', false],
        ['after', false, 'firefox', false], ['before', true, 'firefox', false]]) {
        const choices = [], stop = new Error('Synthetic boundary after both original person selections');
        const page = { locator: selector => ({ first() { return this; }, waitFor: async () => {}, fill: async () => {}, selectOption: async () => {},
            focus: async () => {}, inputValue: async () => '', press: async () => { if (selector === '#subPaymentAuto') throw stop; },
            evaluate: async () => ({ focused: true, value: '2035-03-25', label: true, reachable: true }) }),
            waitForFunction: async () => {}, evaluate: async () => true };
        const driver = { browserName: 'unrelated-synthetic-engine-field', report: { environment: { browser: browserName } },
            check: (name, actual, expected) => assert.equal(actual, expected, name) };
        const run = actualFunction('runSubscriptionScenarios', { phase, offers: [], recipient: { id: 990501 }, payer: { id: 990502 },
            observe: async () => {}, selectPerson: async (actualPage, role, query, id, choice) => {
                assert.equal(actualPage, page); choices.push({ role, query, id, choice });
            } }, body);
        await assert.rejects(run(page, driver, { native, sentinel: true }, {}), error => error === stop);
        assert.deepEqual(choices, [{ role: 'recipient', query: 'recipient', id: 990501, choice: expected },
            { role: 'requester', query: 'payer', id: 990502, choice: expected }]);
    }
});


async function physicalArticleHoverHarness(options = {}) {
    const calls = [], listeners = {}; let hovered = false, disposed = 0, aborted = 0, currentTarget;
    const input = { id: 'articleSearch', isConnected: true, type: 'text', value: options.wrongQuery ? 'other' : 'Synthetic',
        disabled: options.disabled === true, readOnly: false, contains: hit => hit === input,
        getBoundingClientRect: () => ({ left: 40, right: 440, top: 40, bottom: 80, width: 400, height: 40 }) };
    const row = { isConnected: true, tabIndex: 0, contains: hit => hit === row,
        getBoundingClientRect: () => ({ left: 40, right: options.clipped ? 721 : 440, top: 120, bottom: 180, width: 400, height: 60 }),
        getAttribute: name => ({ 'data-action': 'select-article', 'data-arg-article-id': options.wrongArticle ? '990602' : '990601', role: 'button' })[name],
        closest: () => options.wrongOwner ? null : {}, matches: selector => selector === ':hover' && hovered };
    const privateField = { id: 'synthetic-private-hover-field', value: 'synthetic-private-hover-value' };
    const window = { currentCustomer: { credentialKey: 'synthetic-private-hover-key' }, orderItems: [],
        kiwiCustomerWorkSession: { getRequestContext: () => ({ customerReference: { credentialKey: 'synthetic-private-hover-key' } }) } };
    const document = { getElementById: () => input, querySelector: selector => selector === '#articleSearch' ? input : row,
        querySelectorAll: () => [input, privateField], elementFromPoint: () => options.covered ? {} : currentTarget };
    const realm = { document, window, innerWidth: 720, innerHeight: 500, outerWidth: 720, outerHeight: 543,
        devicePixelRatio: options.dpr || 2, visualViewport: { scale: 1 },
        AbortController: class extends AbortController { abort() { aborted++; super.abort(); } },
        addEventListener: (name, callback) => { listeners[name] = callback; } };
    const page = { evaluateHandle: async (callback, argument) => {
        currentTarget = argument.selector === '#articleSearch' ? input : row;
        const value = vm.runInNewContext('(' + callback.toString() + ')(argument)', { ...realm, argument });
        return { evaluate: async callback => callback(value), dispose: async () => { disposed++; } };
    }, waitForFunction: async (callback, proof) => assert.equal(await proof.evaluate(callback), true) };
    const compare = (action, parameters) => {
        assert.ok(['query', 'move'].includes(action), 'Article hover must never click or dispatch keys.'); calls.push(action);
        if (action === 'move') {
            hovered = currentTarget === row && !options.missingHover;
            const rect = currentTarget.getBoundingClientRect();
            listeners.pointermove({ type: 'pointermove', isTrusted: !options.untrusted, target: options.wrongHit ? {} : currentTarget,
                clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
            if (options.mutateTask) window.orderItems.push({ private: 'changed-synthetic-private-cart' });
            if (options.mutateField) privateField.value = 'changed-synthetic-private-value';
        }
        return { action, window: { windowId: options.changedWindow && action === 'move' ? 43 : 42, x: 0, y: 0,
            width: options.badWindow ? 700 : 1440, height: 1086 }, pointer: parameters.point || null };
    };
    const report = { environment: { browserVersion: '150.0.2' } };
    const handle = { sessionVerified: true, nativeGroup: 'article-cart-custom-calendar', activeFamily: 'article',
        descriptor: { native: true, role: 'kiwi-admin', locale: 'nl' }, driver: { browserName: 'firefox' }, page, child: { report },
        state: { phase: 'after', suite: 'feedback', report, nativeKernel: { pointer: { display: ':96', compare } } },
        helpers: { operational: { physicalClientPoint, nativeReadonlyMotionOwnsTarget } } };
    if (options.changeHandle) options.changeHandle(handle);
    const run = actualFunction('moveFirefoxNativeArticlePointer', {}); let error;
    try { for (const phase of options.phases || ['rest', 'hover']) await run(handle, phase); } catch (caught) { error = caught; }
    return { error, calls, report, disposed, aborted };
}

test('native Firefox original article rest and hover use only owned trusted physical motion with stable task and source row', async () => {
    const good = await physicalArticleHoverHarness(); assert.equal(good.error, undefined);
    assert.deepEqual(good.calls, ['query', 'move', 'query', 'move']); assert.equal(good.disposed, 2); assert.equal(good.aborted, 2);
    assert.deepEqual(Array.from(good.report.nativeFirefoxArticlePointer, item => [item.phase, item.rowHovered, item.sameTaskAndFields]),
        [['rest', false, true], ['hover', true, true]]);
    for (const privateValue of ['synthetic-private-hover-key', 'synthetic-private-hover-field', 'synthetic-private-hover-value', 'credentialKey'])
        assert.equal(JSON.stringify(good.report).includes(privateValue), false);
    for (const options of [{ wrongQuery: true }, { wrongArticle: true }, { wrongOwner: true }, { disabled: true }, { clipped: true }, { covered: true },
        { dpr: 1 }, { badWindow: true }, { changedWindow: true }, { untrusted: true }, { wrongHit: true }, { mutateTask: true }, { mutateField: true }, { missingHover: true }]) {
        const bad = await physicalArticleHoverHarness(options); assert.ok(bad.error, JSON.stringify(options)); assert.equal(bad.disposed, bad.aborted);
    }
    for (const changeHandle of [h => { h.sessionVerified = false; }, h => { h.nativeGroup = 'shell-search-customer-history'; },
        h => { h.descriptor.native = false; }, h => { h.descriptor.role = 'kiwi-view'; }, h => { h.descriptor.locale = 'en'; },
        h => { h.driver.browserName = 'chromium'; }, h => { h.state.report.environment.browserVersion = '149'; },
        h => { h.activeFamily = 'customer'; }, h => { h.state.phase = 'before'; }, h => { h.state.nativeKernel.pointer.display = ':95'; }]) {
        const bad = await physicalArticleHoverHarness({ changeHandle }); assert.ok(bad.error); assert.deepEqual(bad.calls, []);
    }
    for (const phases of [['hover'], ['rest', 'rest'], ['rest', 'hover', 'hover']]) {
        const bad = await physicalArticleHoverHarness({ phases }); assert.ok(bad.error);
        assert.equal(bad.calls.length, phases[0] === 'hover' ? 0 : 2 * (phases.length - 1));
    }
});
