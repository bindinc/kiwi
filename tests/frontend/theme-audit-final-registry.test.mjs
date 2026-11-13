import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    createFinalAuditRegistry, createFinalAuditAdapter, finalAuditAreas,
    finalAuditSupplements, reviewFinalAuditCell, summarizeFinalAudit
} from '../../scripts/compose-smoke-theme-audit-final.mjs';

// These are pure synthetic receipts. No test below claims source, browser or image verification.
const hash = 'a'.repeat(64);
const artifact = name => ({ path: `/synthetic-unit-evidence/${name}`, sha256: hash });
const release = () => ({
    slice09: { phase: 'after', status: 'accepted', evidence: artifact('accepted09.json') },
    source: { commit: 'b'.repeat(40), manifest: artifact('source.json'), runtime: artifact('runtime.json'), helpers: artifact('helpers.json') },
    reference: {
        original: { ...artifact('original.html'), sha256: '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4' },
        refined: { ...artifact('refined.html'), sha256: '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb' }
    },
    sdk: { ...artifact('original-sdk.js'), sha256: '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c' }
});
const driver = Object.fromEntries(['check', 'capture', 'painted', 'saveReport', 'trackStylesheets'].map(name => [name, () => {}]));

function observations({ cell, area }) {
    return area.criteria.map(criterionId => ({
        id: `${cell.id}/${criterionId}`, criterionId, state: 'synthetic-unit-state',
        kind: 'intercepted-fixture-flow', outcome: 'verified', report: artifact(`${cell.id}/report.json`),
        checkRefs: [`synthetic-check:${criterionId}`], images: [{ id: `${cell.id}/frame`, ...artifact(`${cell.id}/frame.png`) }]
    }));
}

function setup() {
    const calls = [];
    const hooks = {
        operationalAfter: { phase: 'after', sourceCommit: 'b'.repeat(40), evidence: artifact('owner-after-hooks.json') },
        verifyRelease: async ({ releaseId }) => { calls.push('verify'); return { releaseId, evidence: artifact('verification.json') }; },
        openSession: async ({ cell, releaseId }) => {
            calls.push(`open:${cell.id}`);
            return { handle: { id: cell.id }, environment: { ...cell.environment, browserVersion: 'unit-not-a-browser' }, sourceReleaseId: releaseId,
                proofs: { source: artifact('served-source.json'), environment: artifact('environment.json'),
                    role: { kind: 'actual-oidc-server-render', artifact: artifact('role.json') } } };
        },
        closeSession: async handle => { calls.push(`close:${handle.id}`); },
        scenes: Object.fromEntries(finalAuditAreas.map(area => [area.id, async (_handle, context) => observations(context)]))
    };
    return { calls, hooks, options: { release: release(), driver, hooks } };
}

function acceptedReview(cell) {
    const images = new Map(cell.evidence.flatMap(item => item.images).map(image => [image.id, image]));
    return { status: 'accepted', reviewer: 'Synthetic independent unit reviewer', decision: 'Synthetic metadata-only test decision.',
        images: [...images.values()].map(image => ({ id: image.id, sha256: image.sha256, status: 'accepted' })) };
}

const firstId = 'A01/chromium/1440x1000';

test('safe import ignores runner environment and works with filesystem writes/process spawning denied', () => {
    const moduleUrl = new URL('../../scripts/compose-smoke-theme-audit-final.mjs', import.meta.url);
    const stdout = execFileSync(process.execPath, ['--permission', `--allow-fs-read=${fileURLToPath(moduleUrl)}`, '--input-type=module', '-e',
        `const m = await import(${JSON.stringify(moduleUrl.href)}); console.log(m.createFinalAuditRegistry().cells.length);`], {
        encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_MODULE_PATH: '/no-playwright-allowed', KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY: '1',
            KIWI_THEME_APP_ROOT: '/no-source-read-allowed', KIWI_THEME_EVIDENCE_DIR: '/no-output-write-allowed' }
    });
    assert.equal(stdout.trim(), '78');
});

test('all thirteen finite areas start at six fixed environments with no acceptance or fabricated evidence', () => {
    const registry = createFinalAuditRegistry();
    assert.equal(finalAuditAreas.length, 13);
    assert.equal(registry.cells.length, 78);
    assert.equal(new Set(registry.cells.map(cell => cell.id)).size, 78);
    assert.ok(registry.cells.every(cell => cell.status === 'not reviewed' && cell.review === null && !cell.evidence.length));
    assert.throws(() => { registry.cells[0].status = 'accepted'; }, TypeError);
    assert.throws(() => { finalAuditAreas[0].criteria.push('invented'); }, TypeError);
    const summary = summarizeFinalAudit(registry);
    assert.equal(summary.baselineAccepted, false);
    assert.equal(summary.finalAcceptance, false);
    assert.equal(summary.sourceVerified, false);
    assert.equal(summary.unreviewed.length, 78);
    assert.deepEqual(summary.pendingExternalGates, finalAuditSupplements);
    const dates = finalAuditAreas.find(area => area.id === 'A08');
    assert.ok(dates.criteria.includes('subscription-native-and-provider-dates'));
    assert.ok(dates.helpers.includes('article-acceptance.inspectArticleCalendar'));
});

test('missing, duplicate, unknown and changed-environment cells cannot be summarized as accepted', () => {
    const changes = [
        r => r.cells.pop(),
        r => { r.cells[1] = structuredClone(r.cells[0]); },
        r => { r.cells[0].id = 'A99/chromium/1440x1000'; },
        r => { r.cells[0].environment.locale = 'en'; },
        r => { r.cells[0].environment.zoom = 200; },
        r => { r.cells[0].environment.role = 'kiwi-view'; },
        r => { r.cells[0].status = 'passed'; },
        r => { r.cells[0].status = 'accepted'; }
    ];
    for (const change of changes) {
        const registry = structuredClone(createFinalAuditRegistry()); change(registry);
        assert.throws(() => summarizeFinalAudit(registry));
    }
});

test('missing or premature source/09/reference/SDK proofs reject before any hook runs', () => {
    const changes = [
        r => { r.slice09.phase = 'before'; }, r => { r.slice09.status = 'pending'; },
        r => { delete r.slice09.evidence; }, r => { delete r.source.manifest; },
        r => { delete r.source.runtime; }, r => { delete r.source.helpers; },
        r => { r.source.commit = 'short-sha'; }, r => { r.reference.refined.sha256 = hash; },
        r => { r.reference.original.sha256 = hash; }, r => { r.sdk.sha256 = hash; }
    ];
    for (const change of changes) {
        const { options, calls } = setup(); change(options.release);
        assert.throws(() => createFinalAuditAdapter(options)); assert.deepEqual(calls, []);
    }
});

test('all required actual-scene and owner-released operational AFTER hooks are mandatory', () => {
    for (const name of ['verifyRelease', 'openSession', 'closeSession']) {
        const { options, hooks } = setup(); delete hooks[name];
        assert.throws(() => createFinalAuditAdapter(options), /hook missing/);
    }
    const { options, hooks } = setup(); delete hooks.scenes.A09;
    assert.throws(() => createFinalAuditAdapter(options), /A09.*09 AFTER/);
    hooks.scenes.A09 = async () => []; hooks.operationalAfter.phase = 'before';
    assert.throws(() => createFinalAuditAdapter(options), /operational AFTER/);
    hooks.operationalAfter.phase = 'after'; hooks.operationalAfter.sourceCommit = 'c'.repeat(40);
    assert.throws(() => createFinalAuditAdapter(options), /match the final source/);
    hooks.operationalAfter.sourceCommit = 'b'.repeat(40); hooks.scenes.A99 = async () => [];
    assert.throws(() => createFinalAuditAdapter(options), /extra final scene/);
    delete hooks.scenes.A99;
    assert.throws(() => createFinalAuditAdapter({ ...options, driver: {} }), /driver method required/);
});

test('the adapter verifies release before opening a session and retains provenance without auto-review', async () => {
    const { options, calls } = setup(), adapter = createFinalAuditAdapter(options);
    assert.deepEqual(calls, [], 'Construction and snapshot do not run hooks.');
    await adapter.runCell(firstId);
    assert.deepEqual(calls, ['verify', `open:${firstId}`, `close:${firstId}`]);
    const registry = adapter.snapshot(), cell = registry.cells.find(item => item.id === firstId);
    assert.equal(cell.evidence.length, finalAuditAreas[0].criteria.length);
    assert.equal(cell.status, 'not reviewed'); assert.equal(cell.review, null);
    assert.equal(cell.evidence[0].provenance.environment.browserVersion, 'unit-not-a-browser');
    assert.equal(cell.evidence[0].provenance.releaseId, registry.releaseVerification.releaseId);
    assert.equal(summarizeFinalAudit(registry).baselineAccepted, false);
    await assert.rejects(adapter.runCell(firstId), /fresh registry/);
    await assert.rejects(adapter.runCell('A99/chromium/1440x1000'), /Unknown baseline/);
});

test('a failed release receipt never opens an application session', async () => {
    const { options, hooks, calls } = setup();
    hooks.verifyRelease = async () => ({ releaseId: 'wrong-source', evidence: artifact('wrong.json') });
    const adapter = createFinalAuditAdapter(options);
    await assert.rejects(adapter.runCell(firstId), /does not match/);
    assert.deepEqual(calls, []);
    assert.equal(summarizeFinalAudit(adapter.snapshot()).sourceVerified, false);
});

test('environment, source and fixture-role substitutions reject and close the returned session', async () => {
    const changes = [
        s => { s.environment.browser = 'firefox'; }, s => { s.environment.width = 320; },
        s => { s.environment.zoom = 200; }, s => { delete s.environment.browserVersion; },
        s => { s.sourceReleaseId = 'different-runtime'; }, s => { delete s.proofs.source; },
        s => { s.proofs.role.kind = 'capability-get-fixture'; }
    ];
    for (const change of changes) {
        const { options, hooks, calls } = setup(), original = hooks.openSession;
        hooks.openSession = async args => { const session = await original(args); change(session); return session; };
        const adapter = createFinalAuditAdapter(options);
        await assert.rejects(adapter.runCell(firstId));
        assert.equal(calls.at(-1), `close:${firstId}`);
        assert.equal(adapter.snapshot().cells[0].evidence.length, 0);
        assert.equal(summarizeFinalAudit(adapter.snapshot()).errors.length, 1);
    }
});

test('empty, duplicate, unknown, isolated-class and conflicting-image observations never pass', async () => {
    const changes = [
        () => [], list => [list[0], list[0]],
        list => [{ ...list[0], criterionId: 'invented' }],
        list => [{ ...list[0], kind: 'isolated-class-fixture' }],
        list => [{ ...list[0], images: [] }], list => [{ ...list[0], checkRefs: [] }],
        list => [{ ...list[0], report: null }],
        list => [list[0], { ...list[1], images: [{ ...list[1].images[0], sha256: 'f'.repeat(64) }] }]
    ];
    for (const change of changes) {
        const { options, hooks, calls } = setup();
        hooks.scenes.A01 = async (_session, context) => change(observations(context));
        const adapter = createFinalAuditAdapter(options);
        await assert.rejects(adapter.runCell(firstId));
        assert.equal(calls.at(-1), `close:${firstId}`);
        assert.equal(summarizeFinalAudit(adapter.snapshot()).baselineAccepted, false);
    }
});

test('criterion coverage and every image require an explicit independent decision', async () => {
    const { options } = setup(), adapter = createFinalAuditAdapter(options);
    await adapter.runCell(firstId);
    const registry = adapter.snapshot(), cell = registry.cells[0], review = acceptedReview(cell);
    assert.throws(() => reviewFinalAuditCell(registry, firstId, { ...review, reviewer: '' }), /reviewer/);
    for (const images of [[], [...review.images, ...review.images], [{ id: 'unknown-image', status: 'accepted' }],
        [{ ...review.images[0], sha256: 'f'.repeat(64) }],
        [{ ...review.images[0], status: 'not reviewed' }], [{ ...review.images[0], status: 'deviation' }]]) {
        assert.throws(() => reviewFinalAuditCell(registry, firstId, { ...review, images }));
    }
    const missing = structuredClone(registry); missing.cells[0].evidence.pop();
    assert.throws(() => reviewFinalAuditCell(missing, firstId, review), /Missing required criterion/);
    const reviewed = reviewFinalAuditCell(registry, firstId, review);
    assert.equal(reviewed.cells[0].status, 'accepted');
    assert.equal(registry.cells[0].status, 'not reviewed', 'Review returns a new immutable ledger.');
    assert.throws(() => reviewFinalAuditCell(reviewed, firstId, review), /silently overwritten/);
    const tampered = structuredClone(reviewed); tampered.cells[0].review.images = [];
    assert.throws(() => summarizeFinalAudit(tampered), /Every actual image/);
});

test('deviations, unverified checks and missing source cannot be laundered through a review', async () => {
    for (const outcome of ['deviation', 'unverified']) {
        const { options, hooks } = setup();
        hooks.scenes.A01 = async (_session, context) => observations(context).map(item => ({ ...item, outcome }));
        const adapter = createFinalAuditAdapter(options); await adapter.runCell(firstId);
        const registry = adapter.snapshot();
        assert.throws(() => reviewFinalAuditCell(registry, firstId, acceptedReview(registry.cells[0])), /cannot be accepted/);
        const review = { ...acceptedReview(registry.cells[0]), status: 'deviation' };
        assert.equal(reviewFinalAuditCell(registry, firstId, review).cells[0].status, 'deviation');
    }
    const { options } = setup(), adapter = createFinalAuditAdapter(options); await adapter.runCell(firstId);
    const changed = structuredClone(adapter.snapshot()); changed.release.source.runtime.sha256 = 'e'.repeat(64);
    assert.throws(() => summarizeFinalAudit(changed), /source verification differs/);
    const absent = structuredClone(adapter.snapshot()); absent.releaseVerification = null;
    assert.throws(() => summarizeFinalAudit(absent), /Evidence cannot precede/);
});

test('shared fixture sessions cannot overlap and cleanup failures block acceptance', async () => {
    const { options, hooks } = setup(); let finish;
    hooks.scenes.A01 = async (_session, context) => {
        await new Promise(resolve => { finish = resolve; }); return observations(context);
    };
    const adapter = createFinalAuditAdapter(options), pending = adapter.runCell(firstId);
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(adapter.runCell('A02/chromium/1440x1000'), /serially/);
    finish(); await pending;
    const failure = setup(); failure.hooks.closeSession = async () => { throw new Error('unit-cleanup-failure'); };
    const failed = createFinalAuditAdapter(failure.options);
    await assert.rejects(failed.runCell(firstId), /unit-cleanup-failure/);
    assert.equal(failed.snapshot().errors[0].stage, 'cleanup');
    assert.throws(() => reviewFinalAuditCell(failed.snapshot(), firstId, acceptedReview(failed.snapshot().cells[0])), /failed scene/);
});

test('even all 78 manually reviewed synthetic baseline cells cannot accept native/privacy/supplemental work', async () => {
    const { options } = setup(), adapter = createFinalAuditAdapter(options);
    for (const cell of adapter.snapshot().cells) await adapter.runCell(cell.id);
    let registry = adapter.snapshot();
    assert.equal(summarizeFinalAudit(registry).baselineAccepted, false, 'Verified counters leave every image unreviewed.');
    for (const cell of registry.cells) registry = reviewFinalAuditCell(registry, cell.id, acceptedReview(cell));
    const summary = summarizeFinalAudit(registry);
    assert.equal(summary.baselineAccepted, true, 'Synthetic metadata exercise only; no browser or actual image was checked.');
    assert.equal(summary.finalAcceptance, false);
    assert.deepEqual(summary.pendingExternalGates, finalAuditSupplements);
});
