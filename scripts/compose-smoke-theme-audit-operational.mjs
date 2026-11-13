#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';

// theme_audit: an opt-in observational09 runner. No previous runner/default is changed.
const sha256 = value => createHash('sha256').update(value).digest('hex');
const modulePath = fileURLToPath(import.meta.url);
const screenshotSdkUrl = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm';
const screenshotSdkSha256 = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';
const screenshotSdkFile = '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-04/privacy-serialization-fix/dom-to-image-more-3.10.1-esm.js';
const b4Head = 'b4cca0c940f0ac328911ec0f844c5c2725830887';
const afterReference = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const categoryNames = [
    'call_started_anonymous', 'call_started_identified', 'call_identified', 'call_ended_by_agent',
    'call_ended_by_customer', 'call_disposition', 'call_hold', 'call_resumed', 'recording_started',
    'acw_completed', 'follow_up_scheduled', 'agent_status_change', 'subscription_created',
    'subscription_changed', 'subscription_cancelled', 'article_sold', 'magazine_resent',
    'notification_success', 'notification_info', 'notification_warning', 'notification_error', 'synthetic_unknown'
];
const statuses = ['pending', 'paused', 'ready', 'processing', 'completed', 'failed', 'uncertain', 'cancelled', 'synthetic_unknown'];
const behaviorFiles = [
    'assets/js/api-client.js', 'assets/js/app/index.js', 'assets/js/app/legacy-app-state.js',
    'assets/js/app/call-agent-runtime.js', 'assets/js/app/slices/call-session-slice.js',
    'assets/js/app/slices/acw-disposition-slice.js', 'assets/js/app/slices/contact-history-slice.js',
    'assets/js/app/slices/customer-detail-slice.js', 'assets/js/app/slices/customer-work-session-slice.js',
    'assets/js/app/session-outbox.js', 'assets/js/app/outbox-presentation.js', 'assets/js/app/disposition-categories.js'
];
const cssFiles = ['styles.css', 'session-outbox.css', 'contextual-feedback.css', 'article-search.css', 'delivery-date-picker.css'].map(name => 'assets/css/' + name);
const feedbackBehaviorFiles = ['assets/js/app/customer-editor.js', 'assets/js/app/slices/customer-search-slice.js',
    'assets/js/app/slices/subscription-workflow-slice.js', 'assets/js/app/contextual-feedback/index.js',
    'assets/js/app/contextual-feedback/button.js', 'assets/js/app/contextual-feedback/dialog.js',
    'assets/js/app/contextual-feedback/settings-modal.js', 'assets/js/app/contextual-feedback/modal-surface.js',
    'assets/js/app/lightbox-drafts.js', 'assets/js/i18n/nl.js', 'assets/js/i18n/en.js'];
const fixtureId = 990901;
const longName = 'Synthetic Operational customer with a deliberately long family name and complete caller identity';
const longText = 'Synthetische operationele toelichting met een lange omschrijving. Controleer volledige klantcontext, leesbare status en alle bereikbare vervolgacties zonder gegevens weg te laten.\nTweede regel met aanvullende informatie voor de medewerker.';

function stable(value) {
    if (Array.isArray(value)) return JSON.stringify(value.map(item => JSON.parse(stable(item))));
    if (value && typeof value === 'object') return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(stable(value[key]))])));
    return JSON.stringify(value);
}

export function selectedNativeLoginAccount(state) {
    return state.phase === 'after' && state.suite === 'actual-view' && state.report?.requestedSuite === 'input-gates'
        ? 'kiwi-view' : 'kiwi-admin';
}

export function nativeLoginExpectation(snapshot) {
    if (!snapshot || typeof snapshot.submitterDisabled !== 'boolean' || !Array.isArray(snapshot.entries)) return null;
    const pairsAreStrings = snapshot.entries.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(value => typeof value === 'string'));
    if (!pairsAreStrings) return null;
    const fields = new URLSearchParams(snapshot.entries);
    const exactUsername = fields.getAll('username').length === 1 && fields.get('username') === 'kiwi-admin';
    const exactPassword = fields.getAll('password').length === 1 && fields.get('password') === 'kiwi-local-dev-password';
    if (!exactUsername || !exactPassword) return null;
    return [...fields.entries()].sort();
}

export function createNativeLoginReceiver(page, frame) {
    let armed = true, resolveSnapshot;
    const ready = new Promise(resolve => { resolveSnapshot = resolve; });
    return {
        receive(source, snapshot) {
            if (!armed || source.page !== page || source.frame !== frame) return false;
            armed = false;
            resolveSnapshot(snapshot);
            return true;
        },
        async wait(timeoutMs = 2000) {
            let timer;
            try {
                const snapshot = await Promise.race([ready, new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); })]);
                if (snapshot === null) armed = false;
                return snapshot;
            }
            finally { clearTimeout(timer); }
        }
    };
}

export function finishOperationalQueueFixture(scope = globalThis) {
    scope.callQueue.enabled = false;
    scope.callQueue.queue = [];
    scope.kiwiCallAgentRuntime.updateQueueDisplay();
    scope.kiwiCallAgentRuntime.stopQueueWaitTimeUpdate();
}

export function createSettingsEnableGate(baseUrl) {
    const expected = { feedbackEnabled: true, publicBaseUrl: baseUrl.href.replace(/\/$/, ''), imageTtlDays: 14,
        maxImageBytes: 3145728, clearWebhookUrl: false, clearOriginalDataWebhookUrl: false };
    let armed = false, used = false;
    return {
        arm() { assert.equal(used, false, 'Only one local settings UI enablement is permitted.'); armed = true; },
        take({ method, pathname, search, payload, csrfPresent, contentType }) {
            const exactRequest = method === 'PUT' && pathname === new URL('api/v1/development-feedback/settings', baseUrl).pathname
                && !search && csrfPresent && contentType.startsWith('application/json');
            if (!armed || used || !exactRequest || stable(payload) !== stable(expected)) return false;
            used = true; armed = false;
            return true;
        },
        used() { return used; }
    };
}

// The queue is an exact finite allowlist. It cannot authorize an arbitrary business request.
export function createOperationalWriteGate() {
    const expected = [];
    return {
        arm(method, pathname, payload, response) {
            const callWrite = (method === 'PUT' && pathname === '/kiwi/api/v1/call-session')
                || (method === 'POST' && ['/kiwi/api/v1/call-session/hold', '/kiwi/api/v1/call-session/resume',
                    '/kiwi/api/v1/call-session/end', '/kiwi/api/v1/agent-status'].includes(pathname));
            assert.ok(callWrite, 'Only the reviewed call/status fixture endpoints can be armed.');
            expected.push({ method, pathname, payload: structuredClone(payload), response: structuredClone(response) });
        },
        take({ method, pathname, search, payload, csrfPresent, contentType }) {
            if (search || !csrfPresent || !contentType.startsWith('application/json')) return null;
            const index = expected.findIndex(item => item.method === method && item.pathname === pathname && stable(item.payload) === stable(payload));
            if (index < 0) return null;
            return expected.splice(index, 1)[0];
        },
        pending() { return expected.map(({ method, pathname }) => ({ method, pathname })); }
    };
}

// Separate from source-policy evidence: an exact component fixture can exercise renderer error/draft handling.
export function createRecordMutationGate() {
    let expected = null, used = false;
    return {
        arm({ pathname, credentialKey, expectedVersion, changes }) {
            assert.equal(expected, null); assert.equal(used, false, 'One component mutation per fresh context.');
            assert.match(pathname, /^\/kiwi\/api\/v1\/persons\/990970\/(profile|emails\/synthetic-email-a)$/);
            assert.match(credentialKey, /^theme-audit-records-component-(2|12)$/);
            assert.equal(expectedVersion, 'theme-audit-component-only');
            const person = pathname.endsWith('/profile');
            assert.deepEqual(changes, person ? { salutation: 'Geachte mevrouw' } : { emailAddress: 'changed@example.invalid' });
            expected = { pathname, payload: { credentialKey, expectedVersion, changes } };
        },
        take({ method, pathname, search, payload, csrfPresent, idempotencyPresent, contentType }) {
            if (!expected || used || method !== 'PATCH' || pathname !== expected.pathname || search || !csrfPresent
                || !idempotencyPresent || !contentType.startsWith('application/json') || stable(payload) !== stable(expected.payload)) return false;
            used = true; expected = null;
            return true;
        },
        used() { return used; },
        pending() { return expected !== null; }
    };
}

export function operationalJobs(phase, requestedSuite, viewports) {
    assert.ok(['before', 'after'].includes(phase));
    const permitted = phase === 'before' ? ['operational', 'feedback', 'records-b4'] : ['preflight', 'matrix', 'matrix-remaining', 'matrix-firefox-short', 'summary-focus', 'summary-correction', 'input-gates', 'coarse-touch-retry', 'coarse-menu', 'coarse-menu-correction', 'native-operational', 'editor-privacy', 'async-outbox', 'correction-carry', 'held-readability', 'short-call', 'anonymous-short', 'outbox-editor', 'outbox-fallback-narrow', 'feedback-after', 'outbox-focus', 'records-after', 'records-component'];
    assert.ok(permitted.includes(requestedSuite), 'Unknown phase/suite combination.');
    return viewports.flatMap(viewport => {
        if (phase === 'before') return [{ viewport, suite: requestedSuite }];
        if (requestedSuite === 'correction-carry') return [{ viewport, suite: viewport.width === 390 ? 'outbox-fallback-narrow' : 'outbox-editor' }];
        if (requestedSuite === 'feedback-after') return [{ viewport, suite: 'feedback' }];
        if (requestedSuite === 'outbox-focus') return [{ viewport, suite: 'outbox-focus' }];
        if (requestedSuite === 'async-outbox') return [{ viewport, suite: 'async-outbox' }];
        if (requestedSuite === 'summary-focus' || requestedSuite === 'summary-correction') return [{ viewport, suite: requestedSuite }];
        if (requestedSuite === 'coarse-menu' || requestedSuite === 'coarse-menu-correction') return [{ viewport, suite: requestedSuite }];
        if (requestedSuite === 'coarse-touch-retry') return [{ viewport, suite: 'coarse-touch', recordCount: 12 }];
        if (requestedSuite === 'input-gates') return viewport.height === 320
            ? [{ viewport, suite: 'coarse-touch', recordCount: 12 }]
            : [{ viewport, suite: 'motion-no-preference' }, { viewport, suite: 'locale-en', recordCount: 12 }, { viewport, suite: 'actual-view' }];
        if (requestedSuite === 'editor-privacy') return [{ viewport, suite: 'editor-privacy' }];
        if (requestedSuite === 'native-operational') return [{ viewport, suite: 'native-operational', recordCount: 2 }];
        if (requestedSuite === 'short-call') return [{ viewport, suite: 'short-call' }];
        if (['anonymous-short', 'outbox-editor', 'outbox-fallback-narrow'].includes(requestedSuite)) return [{ viewport, suite: requestedSuite }];
        if (requestedSuite === 'held-readability') return [{ viewport, suite: 'held-readability' }];
        if (['matrix', 'matrix-remaining', 'matrix-firefox-short'].includes(requestedSuite)) return [{ viewport, suite: 'operational' }, { viewport, suite: 'feedback' },
            ...[2, 12].map(recordCount => ({ viewport, suite: 'records-after', recordCount }))];
        if (requestedSuite === 'records-after') return [2, 12].map(recordCount => ({ viewport, suite: 'records-after', recordCount }));
        if (requestedSuite === 'records-component') return ['person', 'email'].map(mutationSection => ({ viewport,
            suite: 'records-after-component', recordCount: 2, mutationSection }));
        return ['operational', 'feedback'].map(suite => ({ viewport, suite }));
    });
}

export function validateAfterViewportPlan(requestedSuite, browser, viewports) {
    if (requestedSuite === 'coarse-touch-retry' || requestedSuite === 'coarse-menu' || requestedSuite === 'coarse-menu-correction') {
        assert.equal(browser, 'chromium'); assert.deepEqual(viewports, [{ width: 390, height: 320 }]);
        return;
    }
    if (requestedSuite === 'editor-privacy') {
        assert.ok(['chromium', 'firefox'].includes(browser));
        assert.deepEqual(viewports, [{ width: 1440, height: 1000 }]);
        return;
    }
    if (requestedSuite === 'input-gates' || requestedSuite === 'native-operational') {
        assert.ok(['chromium', 'firefox'].includes(browser));
        assert.deepEqual(viewports, requestedSuite === 'input-gates'
            ? [{ width: 1440, height: 1000 }, { width: 390, height: 320 }] : [{ width: 1440, height: 1000 }]);
        return;
    }
    if (requestedSuite === 'summary-focus' || requestedSuite === 'summary-correction') {
        assert.equal(browser, 'firefox'); assert.deepEqual(viewports, [{ width: 390, height: 1000 }]);
        return;
    }
    if (requestedSuite === 'matrix-firefox-short') {
        assert.equal(browser, 'firefox'); assert.deepEqual(viewports, [{ width: 390, height: 320 }]);
        return;
    }
    if (requestedSuite === 'correction-carry') {
        assert.equal(browser, 'chromium');
        assert.deepEqual(viewports, [{ width: 390, height: 1000 }, { width: 1440, height: 1000 }]);
        return;
    }
    if (requestedSuite === 'held-readability') {
        assert.equal(browser, 'chromium');
        assert.deepEqual(viewports, [{ width: 390, height: 1000 }, { width: 320, height: 1000 }]);
        return;
    }
    if (requestedSuite === 'short-call' || requestedSuite === 'anonymous-short') {
        assert.equal(browser, 'chromium'); assert.deepEqual(viewports, [{ width: 390, height: 320 }]);
        return;
    }
    if (requestedSuite === 'outbox-editor' || requestedSuite === 'outbox-fallback-narrow') {
        assert.equal(browser, 'chromium'); assert.deepEqual(viewports, [{ width: 320, height: 1000 }]);
        return;
    }
    if (!['matrix', 'matrix-remaining'].includes(requestedSuite)) {
        assert.equal(browser, 'chromium');
        assert.deepEqual(viewports, [{ width: 1440, height: 1000 }]);
        return;
    }
    assert.ok(['chromium', 'firefox'].includes(browser));
    const narrow = [{ width: 390, height: 1000 }, { width: 320, height: 1000 }, { width: 390, height: 320 }];
    const expected = browser === 'chromium' ? (requestedSuite === 'matrix-remaining' ? [narrow[2]] : narrow) : [{ width: 1440, height: 1000 }, ...narrow];
    assert.deepEqual(viewports, expected, 'The matrix is limited to the declared engine/viewport tuples; accepted Chromium desktop is carried forward.');
}

export function validateLegacyAdoption(adoption, original) {
    const changedMembers = ['scripts/compose-smoke-theme-audit-customer.mjs', 'scripts/compose-smoke-theme-audit-controls.mjs',
        'scripts/compose-smoke-theme-audit-customer-acceptance.mjs', 'scripts/compose-smoke-theme-audit.mjs'];
    const allowedPaths = [...changedMembers, 'scripts/compose-smoke-shared-addresses.mjs'].sort();
    assert.equal(adoption.phase, 'after');
    assert.equal(adoption.independentReview, '69c981b5ac932400a460e34a82e921894b976fe08ea43592f7c9d2997529721b');
    assert.deepEqual(adoption.allowedChanges.map(entry => entry.path).sort(), allowedPaths);
    const before = new Map(original.toolingOriginals.map(entry => [entry.path, entry]));
    const current = new Map(adoption.toolingOriginals.map(entry => [entry.path, entry]));
    assert.equal(original.toolingOriginals.length, 20); assert.equal(before.size, 20);
    assert.equal(adoption.toolingOriginals.length, 20); assert.equal(current.size, 20);
    assert.deepEqual([...current.keys()].sort(), [...before.keys()].sort());
    assert.equal(adoption.changedOriginalMembers, 4); assert.equal(adoption.unchangedOriginalMembers, 16);
    for (const [filename, entry] of current) {
        const old = before.get(filename), change = adoption.allowedChanges.find(item => item.path === filename);
        const adopted = changedMembers.includes(filename);
        assert.equal(entry.adopted, adopted, filename);
        assert.equal(entry.originalSha256, old.sha256, filename);
        if (adopted) {
            assert.equal(change.beforeSha256, old.sha256, filename);
            assert.equal(entry.sha256, change.afterSha256, filename);
        } else assert.equal(entry.sha256, old.sha256, filename);
    }
    return current;
}

export function validateSecondLegacyAdoption(adoption, original) {
    const root = '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/';
    const changedMembers = ['scripts/compose-smoke-theme-audit-customer.mjs', 'scripts/compose-smoke-theme-audit-controls.mjs',
        'scripts/compose-smoke-theme-audit-customer-acceptance.mjs', 'scripts/compose-smoke-theme-audit.mjs',
        'scripts/compose-smoke-theme.mjs', 'scripts/compose-smoke-theme-audit-overlays-acceptance.mjs'];
    const allowedPaths = [...changedMembers, 'scripts/compose-smoke-shared-addresses.mjs'].sort();
    assert.equal(adoption.phase, 'after');
    assert.equal(adoption.independentReview, '69c981b5ac932400a460e34a82e921894b976fe08ea43592f7c9d2997529721b');
    assert.deepEqual(adoption.allowedChanges.map(entry => entry.path).sort(), allowedPaths);
    assert.deepEqual(adoption.previousAdoption, { path: root + 'legacy-helper-adoption-01.json',
        sha256: 'bd353358221c62736cdfd49ba8a863a2e9412068ca65ea54b79fb275a357aa4e' });
    assert.deepEqual(adoption.candidateManifests, [
        { path: root + 'legacy-adapter-candidate-01/manifest.json', sha256: '6520562c7e1e37583968391f738fd9bed558db2626e20c9be2938902a89bd530' },
        { path: root + 'legacy-reference-bridge-candidate-01/manifest.json', sha256: 'e863d0662726462e7b07a41277a9715c49336b4620913e424b7ae4eda6df8fb0' },
        { path: root + 'legacy-theme-focus-candidate-01/manifest.json', sha256: '67770266875de998fe21dd1f14b603d0df5c6e2fbea161ce46029ae83784cb1a' },
        { path: root + 'privacy-current-source-candidate-02/manifest.json', sha256: '3cd4a2e8fcaf76655b876a1c4f05a7ecf6f5698f07fe0f8f95f62cb7f04dcad7' }
    ]);
    assert.deepEqual(adoption.additionalIndependentReviews, [
        { path: root + 'independent-review/legacy-normal-theme-focus-candidate01-review-01.json', sha256: '4654df9335a8355ca8cda3689edda6cca25c54fd5080160fd32353fa1b288f0f' },
        { path: root + 'independent-review/privacy-current-source-candidate02-review-01.json', sha256: '9aeae74ad3faf1066e6df81d191beeba46130fde6a7741802b1daa4fb8529da6' }
    ]);
    assert.deepEqual(adoption.newMembers, [
        { path: 'scripts/compose-smoke-theme-audit-operational-privacy.mjs', afterSha256: '8cc734b54744777c313a2a87c0c780a6de920175fc8637923c2dcf5b2857bbf0', bytes: 23009 },
        { path: 'tests/frontend/theme-audit-operational-privacy.test.mjs', afterSha256: '53c34024c3f6924464b864431b253d5d945ac8059a49d57b2b7c644eefc12ee5', bytes: 12112 }
    ]);
    const before = new Map(original.toolingOriginals.map(entry => [entry.path, entry]));
    const current = new Map(adoption.toolingOriginals.map(entry => [entry.path, entry]));
    assert.equal(original.toolingOriginals.length, 20); assert.equal(before.size, 20);
    assert.equal(adoption.toolingOriginals.length, 20); assert.equal(current.size, 20);
    assert.deepEqual([...current.keys()].sort(), [...before.keys()].sort());
    assert.equal(adoption.changedOriginalMembers, 6); assert.equal(adoption.unchangedOriginalMembers, 14);
    for (const [filename, entry] of current) {
        const old = before.get(filename), change = adoption.allowedChanges.find(item => item.path === filename);
        const adopted = changedMembers.includes(filename);
        assert.equal(entry.adopted, adopted, filename); assert.equal(entry.originalSha256, old.sha256, filename);
        if (adopted) {
            assert.equal(change.beforeSha256, old.sha256, filename); assert.equal(entry.sha256, change.afterSha256, filename);
        } else assert.equal(entry.sha256, old.sha256, filename);
    }
    return current;
}

export function validateThirdLegacyAdoption(adoption, original, previous) {
    const current = validateSecondLegacyAdoption(previous, original);
    const root = '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/';
    assert.equal(adoption.phase, 'after');
    assert.equal(adoption.independentReview, previous.independentReview);
    assert.deepEqual(adoption.originalManifest, previous.originalManifest);
    assert.deepEqual(adoption.previousAdoption, { path: root + 'legacy-helper-adoption-02.json',
        sha256: '2741b4be7c424c9d98937f083c7e202e17bb49999e056179ec3b5bc6a24c8501' });
    assert.deepEqual(adoption.allowedChanges, previous.allowedChanges, 'All seven existing adopted bodies remain exact.');
    assert.deepEqual(adoption.toolingOriginals, previous.toolingOriginals, 'All twenty current/original hashes and membership remain exact.');
    assert.equal(adoption.changedOriginalMembers, 6); assert.equal(adoption.unchangedOriginalMembers, 14);
    assert.deepEqual(adoption.candidateManifests, [...previous.candidateManifests,
        { path: root + 'privacy-baseline-candidate-05/manifest.json', sha256: '6bf7abf8f2125e4b9e7751d211f3429946ba0eb1df33bb78d965eaf60845f00c' }]);
    assert.deepEqual(adoption.additionalIndependentReviews, [...previous.additionalIndependentReviews,
        { path: root + 'independent-review/privacy-calendar03-and-launcher03-review-01.json', sha256: '3e72671cfd4075f5e47898866a38c6e9e099c5462b615ed8e747cab9646690ad' },
        { path: root + 'independent-review/privacy-baseline05-recorder-source-review-01.json', sha256: '2835f74a5792ca53a1035a965e22234fdbac28fbed04b83758e6908217012d91' }]);
    assert.deepEqual(adoption.newMembers, [
        { path: 'scripts/compose-smoke-theme-audit-operational-privacy.mjs', afterSha256: '778a5a7cc12565a59f42a51d85b5284a9223fe75c38070be66a09baa9133d35b',
            bytes: 26598, previousSha256: '8cc734b54744777c313a2a87c0c780a6de920175fc8637923c2dcf5b2857bbf0' },
        { path: 'tests/frontend/theme-audit-operational-privacy.test.mjs', afterSha256: 'ab4f93c5c95ad3233228998bb8a90d8853eae1439670889e5aecd45935d6e275',
            bytes: 16589, previousSha256: '53c34024c3f6924464b864431b253d5d945ac8059a49d57b2b7c644eefc12ee5' }
    ]);
    return current;
}

export function validateFourthLegacyAdoption(adoption, original, previous, second) {
    const current = validateThirdLegacyAdoption(previous, original, second);
    const root = '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/';
    assert.equal(adoption.phase, 'after'); assert.equal(adoption.independentReview, previous.independentReview);
    assert.deepEqual(adoption.originalManifest, previous.originalManifest);
    assert.deepEqual(adoption.previousAdoption, { path: root + 'legacy-helper-adoption-03.json',
        sha256: '324ebfbfd1ed6da038e886992e8d63a18ae8b42c64d04875ed78c5c43fb4ed79' });
    assert.deepEqual(adoption.allowedChanges, previous.allowedChanges);
    assert.deepEqual(adoption.toolingOriginals, previous.toolingOriginals);
    assert.equal(adoption.changedOriginalMembers, 6); assert.equal(adoption.unchangedOriginalMembers, 14);
    assert.deepEqual(adoption.candidateManifests, [...previous.candidateManifests,
        { path: root + 'privacy-missing-resource-candidate-06/manifest.json', sha256: '59e346381d349ca1ef6ed63eef441504fad5059d4b147596656b2cd6ac841336' }]);
    assert.deepEqual(adoption.additionalIndependentReviews, [...previous.additionalIndependentReviews,
        { path: root + 'independent-review/privacy-missing-resource06-source-review-01.json', sha256: '3f39dc8f3bbee5d120fded84e08a98b0ce4937b5cc44c5c246ca71e5dba03595' }]);
    assert.deepEqual(adoption.newMembers, [
        { path: 'scripts/compose-smoke-theme-audit-operational-privacy.mjs', afterSha256: 'c7bfa2fa7c104ddaae3232ccc38b30f4ec20acbccbaad03e0ed7e319da70d84f',
            bytes: 27453, previousSha256: '778a5a7cc12565a59f42a51d85b5284a9223fe75c38070be66a09baa9133d35b' },
        { path: 'tests/frontend/theme-audit-operational-privacy.test.mjs', afterSha256: '9c0b1808cd8c65c730b51cb05431af9b592277c6f0b230d409bf6e8b2f30d2fe',
            bytes: 20779, previousSha256: 'ab4f93c5c95ad3233228998bb8a90d8853eae1439670889e5aecd45935d6e275' }
    ]);
    return current;
}

async function verifyAfterLegacyAdoption() {
    const filename = '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/legacy-helper-adoption-04.json';
    const raw = await readFile(filename), expected = '6ee8aa4e7e4bc75126b7f0cc1ba58974ebe7364eeb80d7152c4d0b66641cc5a3';
    assert.equal(sha256(raw), expected, 'Exact authorized AFTER helper adoption manifest.');
    const adoption = JSON.parse(raw), toolingRoot = path.dirname(path.dirname(modulePath));
    assert.equal(adoption.worktree, toolingRoot);
    const originalRaw = await readFile(adoption.originalManifest.path);
    assert.equal(adoption.originalManifest.sha256, '18bcfc0420519a0c64681898be5edbc5ced27d69df95172fa992c9c9c8ba52f6');
    assert.equal(sha256(originalRaw), adoption.originalManifest.sha256);
    const original = JSON.parse(originalRaw);
    const previousRaw = await readFile(adoption.previousAdoption.path);
    assert.equal(sha256(previousRaw), adoption.previousAdoption.sha256);
    const previous = JSON.parse(previousRaw);
    const secondRaw = await readFile(previous.previousAdoption.path);
    assert.equal(sha256(secondRaw), previous.previousAdoption.sha256);
    const second = JSON.parse(secondRaw), current = validateFourthLegacyAdoption(adoption, original, previous, second);
    const firstRaw = await readFile(second.previousAdoption.path);
    assert.equal(sha256(firstRaw), second.previousAdoption.sha256);
    validateLegacyAdoption(JSON.parse(firstRaw), original);
    for (const manifest of adoption.candidateManifests) assert.equal(sha256(await readFile(manifest.path)), manifest.sha256);
    for (const review of adoption.additionalIndependentReviews) assert.equal(sha256(await readFile(review.path)), review.sha256);
    for (const [file, entry] of current) {
        const bytes = await readFile(path.join(toolingRoot, file));
        assert.equal(sha256(bytes), entry.sha256, file); assert.equal(bytes.length, entry.bytes, file);
    }
    for (const entry of adoption.allowedChanges) assert.equal(sha256(await readFile(path.join(toolingRoot, entry.path))), entry.afterSha256, entry.path);
    for (const entry of adoption.newMembers) {
        const bytes = await readFile(path.join(toolingRoot, entry.path));
        assert.equal(sha256(bytes), entry.afterSha256, entry.path); assert.equal(bytes.length, entry.bytes, entry.path);
    }
    return { filename, sha256: expected, originalManifest: adoption.originalManifest, previousAdoption: adoption.previousAdoption,
        changedOriginalMembers: 6, unchangedOriginalMembers: 14, newMembers: adoption.newMembers,
        boundary: 'Exact seven reviewed existing bodies and two exact privacy replacements; six original replacements and fourteen immutable originals. Historical18bc/adoption01/adoption02/adoption03 remain unchanged.' };
}

function idleSession() {
    return { active: false, callerType: 'anonymous', customerId: null, customerName: null, serviceNumber: null,
        waitTime: 0, startTime: null, pendingIdentification: null,
        recordingActive: false, totalHoldTime: 0, holdStartTime: null, onHold: false };
}

function fixtureCustomer(phase = 'before') {
    return { id: fixtureId, personId: String(fixtureId), firstName: 'Synthetic', lastName: 'Operational customer',
        sourceSystem: 'theme-audit-local', email: 'operational@example.invalid', phone: '',
        postalCode: '1231AA', houseNumber: '1', street: 'Fixturestraat', city: 'Testplaats', countryCode: 'NL',
        addressValidation: { status: 'confirmed' }, subscriptions: [], articles: [], contactHistory: [],
        ...(phase === 'after' ? { address: 'Fixturestraat 1', initials: 'S.', middleName: '', houseNumberAddition: '', salutation: 'Geachte heer' } : {}) };
}

function outboxItems(phase = 'before') {
    const now = new Date().toISOString();
    return statuses.map((status, index) => ({ id: 990910 + index, revision: 7, status,
        serverTime: now, availableAt: new Date(Date.parse(now) + 45000).toISOString(),
        customerReference: { personId: String(fixtureId + index), credentialKey: '', sourceSystem: 'theme-audit-local', divisionId: '', mandant: '' },
        summary: { customer: index === 0 ? longName : `Synthetic ${status} customer`, changeCount: index === 0 ? 128 : 1 },
        contributors: index === 0 ? ['synthetic-agent-long-label', 'synthetic-second-agent'] : ['synthetic-agent'],
        contributorLabels: { 'synthetic-agent-long-label': 'Synthetic contributor with a deliberately long display label', 'synthetic-second-agent': 'Second synthetic contributor' },
        capabilities: { edit: index < 2, pause: status === 'pending', resume: status === 'paused', delete: index < 2 },
        customers: [fixtureCustomer(phase)], changes: [{ id: 'synthetic-contact-change', operation: 'createContactHistoryEntry',
            arguments: [fixtureId, { type: 'call_disposition', description: longText }] }]
    }));
}

export async function verifyAfterSource(sourceRoot, currentBefore = false) {
    assert.equal(sourceRoot, '/home/bartdeijkers/_worktrees/align-theme-operational-states');
    const afterHead = currentBefore ? b4Head : 'eafef7ef2d114bcc33c747eed3ba32840155ca43';
    const specifications = currentBefore ? [
        ['candidate', process.env.KIWI_THEME_OPERATIONAL_AFTER_SOURCE_PROOF, 'ff62ed381759739acdb5f6b6a20159c03de64a2efd2abe2d3e78cc777572db39'],
        ['runtime', process.env.KIWI_THEME_OPERATIONAL_AFTER_RUNTIME_PROOF, '122feaf37b4bf987cb840f3f45a888bc6488e0f4288ee1915162e49e60cdae5b'],
        ['handoff', process.env.KIWI_THEME_OPERATIONAL_AFTER_HANDOFF_PROOF, '9a819b156eacb41d8b4e382b17979f41d0a2daba169da6574d6c469292ddc439']
    ] : [
        ['candidate', process.env.KIWI_THEME_OPERATIONAL_AFTER_SOURCE_PROOF, '26a9312bbe208cfbeabff3141ed524db2dca46210d608b9f6666341c1e6aea8e'],
        ['runtime', process.env.KIWI_THEME_OPERATIONAL_AFTER_RUNTIME_PROOF, '381bbb51e88f6329c08544965d6978aa4d6e171322821029260a41989f946e2d'],
        ['handoff', process.env.KIWI_THEME_OPERATIONAL_AFTER_HANDOFF_PROOF, '8c0dfe5dd45c235162ea4ed7c6bf49b2d90ccfbf29afe2fc03270a152fa2aec1']
    ];
    const proofs = {};
    for (const [name, filename, expected] of specifications) {
        const bytes = await readFile(filename); assert.equal(sha256(bytes), expected, name + ' exact AFTER proof');
        proofs[name] = { filename, sha256: expected, data: JSON.parse(bytes) };
    }
    const candidate = proofs.candidate.data, runtime = proofs.runtime.data, handoff = proofs.handoff.data;
    assert.equal(candidate.head, afterHead); assert.equal(candidate.worktree, sourceRoot); assert.equal(candidate.referenceSha256, afterReference);
    assert.equal(runtime.hostCommittedHead, afterHead); assert.equal(runtime.sourceWorktree, sourceRoot);
    assert.equal(runtime.referenceSha256, afterReference); assert.equal(runtime.mismatches, 0); assert.equal(runtime.project, 'kiwi-theme-audit-09');
    assert.equal(runtime.candidateProofSha256, proofs.candidate.sha256);
    assert.equal(handoff.applicationHead, afterHead); assert.equal(handoff.project, runtime.project);
    assert.equal(handoff.url, 'https://bdc.rtvmedia.org.local:9444/kiwi/'); assert.equal(handoff.runtimeSourceProof.sha256, proofs.runtime.sha256);
    if (!currentBefore) {
        assert.equal(handoff.candidateSourceProof.sha256, proofs.candidate.sha256);
        assert.equal(handoff.referenceSha256, afterReference); assert.equal(handoff.httpStatus.kiwiStatus, 200);
        assert.deepEqual(handoff.health, { gateway: 'Up 6 hours', 'feedback-cleanup': 'Up 6 hours',
            app: 'Up 6 hours (healthy)', 'dev-certs': 'Up 6 hours (healthy)',
            'fallback-oidc': 'Up 6 hours (healthy)', 'kiwi-postgres': 'Up 6 hours (healthy)' });
    }
    assert.equal(candidate.productionCount, 214); assert.equal(runtime.productionCount, 214);
    if (!currentBefore) {
        assert.equal(candidate.previousHead, 'ac26a020eac29be6a86e83bca6047b8be2e682c3');
        assert.equal(candidate.unchangedProductionBodies, 213);
        assert.deepEqual(candidate.changedProduction, ['assets/css/session-outbox.css']);
        assert.deepEqual(candidate.previousSourceProof, {
            path: '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/summary-candidate-source-proof-01.json',
            sha256: 'eef21bbf47e78ea3507887e153ecf3562cb23d913fd547eb81dcdc71880a1658' });
        assert.equal(candidate.candidateManifestSha256, '9f0e1e77b853e47a0be10a5c2b588c9b6a1050396a5ddddc6a4620dacd400eb0');
        assert.deepEqual(candidate.independentSourceReview, { marker: 'theme_audit', status: 'PASS',
            reviewPath: '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/independent-review/outbox-menu-viewport-css-source-review-01.json',
            reviewSha256: '7aaaac126abe0d32993e3cfc35fecb43cbd755c89a1074da4a3670c4dcb1b49e' });
    }
    const canonical = entries => entries.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })).sort((left, right) => left.path.localeCompare(right.path));
    assert.deepEqual(canonical(runtime.source), canonical(candidate.source));
    const actualHead = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(actualHead, afterHead);
    const paths = execFileSync('git', ['-C', sourceRoot, 'ls-files', 'assets', 'templates', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(file => !file.endsWith('.md'));
    assert.deepEqual(paths.sort(), candidate.source.map(entry => entry.path).sort(), 'Fresh complete AFTER production path inventory.');
    assert.equal(new Set(paths).size, 214);
    for (const entry of candidate.source) {
        assert.ok(/^(assets|templates|src)\//.test(entry.path) && !entry.path.split('/').includes('..') && /^[a-f0-9]{64}$/.test(entry.sha256));
        const working = await readFile(path.join(sourceRoot, entry.path));
        const committed = execFileSync('git', ['-C', sourceRoot, 'show', afterHead + ':' + entry.path]);
        assert.equal(working.length, entry.bytes, entry.path); assert.equal(sha256(working), entry.sha256, entry.path);
        assert.equal(sha256(committed), entry.sha256, entry.path + ' committed');
    }
    return { files: 214, actualCaptureWorktree: sourceRoot, actualCaptureGitHead: actualHead, candidateSource: afterHead,
        changedProductionFiles: currentBefore ? candidate.changedProductionCount : candidate.changedProduction.length, referenceSha256: afterReference,
        captureClassification: currentBefore ? 'Supplemental observational BEFORE b4/ref67; separate from original08/ref478.' : 'AFTER viewport-safe menu correction eafef7/ref67; finite explicitly named scope only.',
        proofs: Object.fromEntries(Object.entries(proofs).map(([name, { filename, sha256 }]) => [name, { filename, sha256 }])),
        boundary: 'Fresh complete candidate Git/working set equals independently supplied actual09 container set. Targeted served body checks remain mandatory.' };
}

async function verifyOriginals(sourceRoot, filename) {
    const raw = await readFile(filename), proof = JSON.parse(raw);
    assert.equal(proof.files, 214); assert.equal(proof.mismatches, 0);
    assert.equal(proof.scaffoldSource, 'f1c489fc140193832835ee1b592620159546f793');
    assert.equal(sourceRoot, '/home/bartdeijkers/_worktrees/align-theme-overlays-and-feedback');
    const captureGitHead = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(captureGitHead, 'e036b49a2aedf11109642fa93cf738d61e83eefc');
    const runtimeFilename = process.env.KIWI_THEME_OPERATIONAL_BASELINE_PROOF;
    const runtimeRaw = await readFile(runtimeFilename), runtime = JSON.parse(runtimeRaw);
    assert.equal(sha256(runtimeRaw), '0715a4081a38823aa37f492342ffa3af814e1bb30ef1077d2a7ecb93d019281b');
    assert.equal(runtime.runtimeWorktree, sourceRoot); assert.equal(runtime.runtimeGitHead, captureGitHead);
    assert.equal(runtime.originalFreezeSha256, sha256(raw));
    assert.deepEqual(runtime.sourceSha256, proof.sourceSha256.map(({ path, sha256 }) => ({ path, sha256 })));
    const bridgeFilename = process.env.KIWI_THEME_OPERATIONAL_READ_SOURCE_PROOF;
    const bridgeRaw = await readFile(bridgeFilename), bridge = JSON.parse(bridgeRaw);
    assert.equal(sha256(bridgeRaw), 'fa2ef27bdefe23d38eae6af564d89e5c9e0d9ba5d530f577d72771e4cb40fabb');
    assert.equal(bridge.readOnlySourceRoot, sourceRoot); assert.equal(bridge.requiredReadSourceHead, captureGitHead);
    assert.equal(bridge.original09Scaffold, proof.scaffoldSource);
    assert.deepEqual(bridge.productionFilesSha256, runtime.sourceSha256);
    const paths = execFileSync('git', ['-C', sourceRoot, 'ls-files', 'assets', 'templates', 'src'], { encoding: 'utf8' })
        .trim().split('\n').filter(name => !name.endsWith('.md'));
    assert.deepEqual(paths.sort(), proof.sourceSha256.map(entry => entry.path).sort(), 'The complete freshly enumerated source set must match.');
    for (const entry of proof.sourceSha256) {
        assert.ok(/^(assets|templates|src)\//.test(entry.path) && !entry.path.split('/').includes('..'));
        assert.equal(sha256(await readFile(path.join(sourceRoot, entry.path))), entry.sha256, entry.path + ' original source changed');
    }
    return { filename, sha256: sha256(raw), files: paths.length, baselineSource: proof.baselineSource,
        originalScaffoldSource: proof.scaffoldSource, actualCaptureWorktree: sourceRoot, actualCaptureGitHead: captureGitHead,
        runtimeProof: { filename: runtimeFilename, sha256: sha256(runtimeRaw) },
        readSourceBridge: { filename: bridgeFilename, sha256: sha256(bridgeRaw) },
        equivalence: 'All214 immutable accepted08 working/Git/container files equal original09f1 and main861. BEFORE reads accepted08 physical source exclusively; no current09 application source is read.' };
}

function normalizeCss(body, source, sourceUrl) {
    const urls = /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g;
    const known = [...source.matchAll(urls)].map(match => match[2]);
    return body.replace(urls, (statement, _quote, value) => {
        const original = known.find(raw => {
            const expected = new URL(raw, sourceUrl), actual = new URL(value, sourceUrl);
            if (actual.href === expected.href) return true;
            const extension = path.posix.extname(expected.pathname), basename = path.posix.basename(expected.pathname, extension);
            return actual.origin === expected.origin && path.posix.dirname(actual.pathname) === path.posix.dirname(expected.pathname)
                && actual.search === expected.search && actual.hash === expected.hash
                && new RegExp('^' + basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-[\\w-]{7}' + extension.replace('.', '\\.') + '$').test(path.posix.basename(actual.pathname));
        });
        return original ? 'url(kiwi-asset:' + new URL(original, sourceUrl).href + ')' : statement;
    });
}

async function trackSources(page, state) {
    const coreFiles = [...behaviorFiles, ...cssFiles];
    const files = [...new Set([...coreFiles, ...(state.suite === 'feedback' || state.suite === 'records-b4' || state.phase === 'after' ? feedbackBehaviorFiles : []),
        ...(state.phase === 'after' ? ['assets/js/app/slices/localization-slice.js', 'assets/js/app/slices/app-shell-slice.js'] : []),
        ...(state.phase === 'after' && state.suite === 'editor-privacy' ? ['screenshot.js', 'screenshot-redaction.js', 'screenshot-crop.js', 'screenshot-form-state.js', 'i18n.js'].map(name => 'assets/js/app/contextual-feedback/' + name) : [])])], sources = new Map();
    for (const file of files) sources.set(file, await readFile(path.join(state.sourceRoot, file), 'utf8'));
    const pending = [], seen = new Set();
    page.on('response', response => {
        const url = new URL(response.url());
        const file = files.find(file => {
            const expected = new URL(file.replace(/^assets\//, 'assets/'), state.baseUrl);
            const extension = path.posix.extname(expected.pathname), stem = path.posix.basename(expected.pathname, extension);
            return url.origin === expected.origin && path.posix.dirname(url.pathname) === path.posix.dirname(expected.pathname)
                && new RegExp('^' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:-[\\w-]{7})?' + extension.replace('.', '\\.') + '$').test(path.posix.basename(url.pathname));
        });
        if (!file) return;
        const tracked = (async () => {
            const body = await response.body(), source = sources.get(file), sourceUrl = new URL(file, state.baseUrl);
            const normalize = file.endsWith('.css') ? normalizeCss : normalizeKnownJsImports;
            const actual = sha256(normalize(body.toString('utf8'), source, sourceUrl)), expected = sha256(normalize(source, source, sourceUrl));
            state.report.servedSources.push({ file, responseSha256: sha256(body), normalizedServedSha256: actual, normalizedSourceSha256: expected });
            assert.equal(actual, expected, file + ' served source differs');
            seen.add(file);
        })().catch(error => {
            state.report.sourceErrors.push({ file, message: error.message.slice(0, 500) });
        });
        pending.push(tracked);
    });
    return async ({ requireExtras = true } = {}) => {
        await Promise.all(pending);
        assert.equal(state.report.sourceErrors.length, 0, 'Served-source failures stop the finite gate.');
        for (const file of requireExtras ? files : coreFiles) assert.ok(seen.has(file), 'Actual installed asset must load: ' + file);
    };
}

export async function installOperationalTransport(context, state) {
    const api = new URL('api/v1/', state.baseUrl).pathname;
    const gate = createOperationalWriteGate();
    const control = { gate, auth: null, authAttempts: 0, authCount: 0, authReceiver: null, sourceEditorReads: new Map(), recordReads: new Set(),
        settingsGate: createSettingsEnableGate(state.baseUrl), settingsEnabled: false, recordMutationGate: createRecordMutationGate(),
        items: outboxItems(state.phase), mode: 'held', reads: 0, held: [], recordMutationResponse: null,
        releaseRecordMutation() { this.recordMutationResponse?.(); this.recordMutationResponse = null; },
        release() { this.held.splice(0).forEach(resolve => resolve()); } };
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        const denied = reason => {
            state.report.deniedRequests.push({ method, pathname: url.pathname, reason });
            return route.abort('blockedbyclient');
        };
        if (url.username || url.password) return denied('Credential-bearing URL.');
        if (method === 'GET' && url.href === screenshotSdkUrl) {
            state.report.sdkReads.push({ method, url: screenshotSdkUrl, sha256: screenshotSdkSha256, bytes: state.sdkBytes.length,
                boundary: 'Eager source-declared bootstrap dependency; unchanged preserved original bytes, no substitute behavior.' });
            return route.fulfill({ contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: state.sdkBytes });
        }
        if (url.origin !== state.baseUrl.origin) return denied('Unexpected external origin.');
        if (method === 'POST' && control.auth && url.href === control.auth.url && control.authAttempts === 0
            && request.isNavigationRequest() && request.resourceType() === 'document'
            && request.headers()['content-type']?.startsWith('application/x-www-form-urlencoded')) {
            // Reserve before awaiting the browser-channel handoff: a duplicate cannot share this authorization.
            control.authAttempts += 1;
            state.report.authLifecycle.push({ interceptedExactLoginAttempt: true, attempt: control.authAttempts });
            const body = new URLSearchParams(request.postData() || '');
            const snapshot = await control.authReceiver.wait();
            if (!snapshot) return denied('Native submit-time form snapshot was not received within the bounded Node wait.');
            const selectedAccount = selectedNativeLoginAccount(state);
            const expected = selectedAccount === 'kiwi-view' ? nativeViewLoginExpectation(snapshot) : nativeLoginExpectation(snapshot);
            if (!expected) return denied('Native login snapshot differs from independently pinned fixture credentials.');
            const actual = [...body.entries()].sort();
            if (stable(actual) !== stable(expected)) {
                const actualNames = [...new Set(actual.map(([name]) => name))].sort();
                const expectedNames = [...new Set(expected.map(([name]) => name))].sort();
                state.report.authDiagnostics.push({ actualFieldNames: actualNames, expectedFieldNames: expectedNames,
                    fields: [...new Set([...actualNames, ...expectedNames])].sort().map(name => ({ name,
                        presentInActual: body.has(name), presentInExpected: expected.some(([field]) => field === name),
                        valuesEqual: stable(body.getAll(name)) === stable(expected.filter(([field]) => field === name).map(([, value]) => value)) })) });
                return denied('Login payload differs from exact selected fixture form.');
            }
            control.authCount += 1;
            state.report.authentications.push({ pathname: url.pathname, selectedRole: selectedAccount, exactFormVerified: true,
                bodyMatchesNativeSnapshot: true, submitterDisabled: snapshot.submitterDisabled,
                fieldNames: [...new Set(expected.map(([name]) => name))].sort(), attempt: control.authCount });
            return route.continue();
        }
        if (!['GET', 'HEAD'].includes(method)) {
            let payload = null; try { payload = request.postDataJSON(); } catch { /* A non-JSON write cannot match. */ }
            if (state.phase === 'after' && state.suite === 'records-after-component' && control.recordMutationGate.take({ method,
                pathname: url.pathname, search: url.search, payload, csrfPresent: Boolean(request.headers()['x-csrf-token']),
                idempotencyPresent: Boolean(request.headers()['idempotency-key']), contentType: request.headers()['content-type'] || '' })) {
                state.report.recordMutations.push({ method, pathname: url.pathname, exactPayloadVerified: true,
                    rawSalutationPreserved: payload.changes.salutation === 'Geachte mevrouw',
                    changedFieldNames: Object.keys(payload.changes), csrfPresent: true, idempotencyPresent: true,
                    boundary: 'Explicit synthetic writable component model only;503 locally fulfilled, no upstream write or source capability activation.' });
                await new Promise(resolve => { control.recordMutationResponse = resolve; });
                return route.fulfill({ status: 503, json: { error: { code: 'theme_audit_component_unavailable', message: 'Synthetic local failure' } } });
            }
            if (state.phase === 'after' && state.suite === 'feedback' && control.settingsGate.take({ method, pathname: url.pathname,
                search: url.search, payload, csrfPresent: Boolean(request.headers()['x-csrf-token']), contentType: request.headers()['content-type'] || '' })) {
                control.settingsEnabled = true;
                state.report.settingsFixtures.push({ method, pathname: url.pathname, exactSixKeyPayloadVerified: true,
                    payloadKeys: Object.keys(payload).sort(), csrfPresent: true, secretPropertiesAbsent: true,
                    boundary: 'One real settings UI enablement locally fulfilled only; no server setting persisted.' });
                return route.fulfill({ json: settingsReadModel(state.baseUrl, true) });
            }
            const match = gate.take({ method, pathname: url.pathname, search: url.search, payload,
                csrfPresent: Boolean(request.headers()['x-csrf-token']), contentType: request.headers()['content-type'] || '' });
            if (!match) return denied('Unrecognized write; no request forwarded.');
            state.report.localCallWrites.push({ method, pathname: url.pathname, payloadKeys: Object.keys(payload).sort(),
                exactSyntheticPayloadVerified: true, csrfPresent: true, outcome: 'Locally fulfilled; no server/session/customer persistence.' });
            return route.fulfill({ json: match.response });
        }
        if (method === 'GET' && url.pathname === api + 'bootstrap' && !url.search) return route.fulfill({ json: {
            customers: [], call_session: idleSession(), last_call_session: null,
            call_queue: { enabled: false, queue: [], currentPosition: 0, autoAdvance: true },
            catalog: { serviceNumbers: { AVROBODE: { label: 'AVROBODE SERVICE' }, SYNTHETIC: { label: 'Synthetic long service label for operational wrapping inspection' } } }
        } });
        if (method === 'GET' && url.pathname === api + 'call-queue' && !url.search) return route.fulfill({ json: { enabled: false, queue: [], currentPosition: 0, autoAdvance: true } });
        if (method === 'GET' && url.pathname === api + 'call-session' && !url.search) return route.fulfill({ json: { call_session: idleSession(), last_call_session: null } });
        if (method === 'GET' && url.pathname === api + 'agent-status' && !url.search) return route.fulfill({ json: { status: 'ready', teams_sync: null } });
        if ((['records-b4', 'records-after', 'records-after-component'].includes(state.suite) || state.phase === 'after' && ['coarse-touch', 'locale-en', 'native-operational'].includes(state.suite)) && url.pathname.startsWith(api + 'persons/')) {
            const fixture = state.recordFixture;
            const reads = new Map([[api + fixture.detailSuffix, fixture.customer], [api + fixture.suffix, fixture.model]]);
            const exactUrl = url.pathname + url.search;
            if (method !== 'GET' || !reads.has(exactUrl) || control.recordReads.has(exactUrl)) return denied('Record supplement permits only its two exact one-use synthetic GETs.');
            control.recordReads.add(exactUrl);
            state.report.readonlySourceReads.push({ method, pathname: url.pathname, syntheticId: fixture.id, exactQueryVerified: true,
                boundary: 'Source-serialized b4 synthetic read fixture; no upstream read, write or actual role/policy proof.' });
            return route.fulfill({ json: reads.get(exactUrl) });
        }
        if (state.phase === 'after' && state.suite === 'editor-privacy' && url.pathname === api + 'catalog/delivery-calendar') {
            const { privacy09CalendarQuery, createPrivacy09Calendar } = await import('./compose-smoke-theme-audit-operational-privacy.mjs');
            const query = method === 'GET' ? privacy09CalendarQuery(url, api) : null;
            control.privacyCalendarReads ||= 0;
            if (!query || control.privacyCalendarReads >= 4) return denied('Only the bounded exact source-generated public calendar GET is permitted.');
            control.privacyCalendarReads++;
            state.report.privacyCalendarReads ||= [];
            state.report.privacyCalendarReads.push({ method, pathname: url.pathname, exactQueryVerified: true, sourceGeneratedCalendar: true, noUpstreamRequest: true });
            return route.fulfill({ json: createPrivacy09Calendar(state.sourceRoot, query) });
        }
        if (state.phase === 'after' && state.suite === 'editor-privacy' && url.pathname.startsWith(api + 'persons/')) {
            const fixture = state.privacyFixtures.find(fixture => url.pathname + url.search === api + fixture.suffix);
            if (method !== 'GET' || !fixture || control.recordReads.has(url.pathname + url.search)) {
                return denied('Affected-record privacy permits only two exact source-shaped editing GETs once; no detail or business writes.');
            }
            control.recordReads.add(url.pathname + url.search);
            state.report.readonlySourceReads.push({ method, pathname: url.pathname, syntheticId: fixture.id, recordCount: fixture.recordCount,
                exactQueryVerified: true, boundary: 'New affected-record privacy supplement only; exact readonly serializer-derived fixture.' });
            return route.fulfill({ json: fixture.model });
        }
        if (state.phase === 'after' && ['summary-focus', 'summary-correction'].includes(state.suite) && url.pathname.startsWith(api + 'persons/')) {
            const fixture = state.feedbackFixtures[2];
            if (method !== 'GET' || url.pathname + url.search !== api + fixture.suffix || control.sourceEditorReads.has(fixture.id)) {
                return denied('Canonical summary setup permits only its one exact readonly source-editor GET once.');
            }
            control.sourceEditorReads.set(fixture.id, true);
            state.report.readonlySourceReads.push({ method, pathname: url.pathname, syntheticId: fixture.id, exactQueryVerified: true,
                boundary: 'Canonical previous readonly dialog lifecycle for summary-scroll reproduction; disabled fixture capabilities are component evidence, no role/policy proof.' });
            return route.fulfill({ json: fixture.model });
        }
        const sourceFixture = state.suite === 'feedback' && state.feedbackFixtures.find(fixture => url.pathname === api + `persons/${fixture.id}/editing`);
        if (method === 'GET' && sourceFixture) {
            if (url.pathname + url.search !== api + sourceFixture.suffix || control.sourceEditorReads.has(sourceFixture.id)) return denied('Readonly source fixture URL or finite read count differs.');
            control.sourceEditorReads.set(sourceFixture.id, true);
            state.report.readonlySourceReads.push({ method, pathname: url.pathname, syntheticId: sourceFixture.id, exactQueryVerified: true,
                boundary: 'Actual source-editor GET locally fulfilled with exact synthetic identity and readonly capability read model; no actual role/policy claim.' });
            return route.fulfill({ json: sourceFixture.model });
        }
        if (method === 'GET' && url.pathname === api + 'outbox-sessions' && url.search === '?limit=20&offset=0') {
            const read = { number: ++control.reads, mode: control.mode, at: new Date().toISOString() };
            state.report.outboxReads.push(read);
            if (control.mode === 'held') await new Promise(resolve => control.held.push(resolve));
            if (control.mode === 'error') return route.fulfill({ status: 503, json: { error: { code: 'synthetic_operational_unavailable', message: longText } } });
            const items = control.mode === 'empty' ? [] : control.items;
            return route.fulfill({ json: { items, total: items.length } });
        }
        if (method === 'GET' && url.pathname === api + 'workflows/subscription' && url.search === '?limit=20') return route.fulfill({ json: { items: [] } });
        if (method === 'GET' && url.pathname === api + 'webabo/offers' && url.search === '?limit=250') return route.fulfill({ json: { items: [], total: 0 } });
        if (method === 'GET' && url.pathname === api + 'development-feedback/settings' && !url.search) {
            if (state.phase === 'after') state.report.settingsFixtures.push({ method, pathname: url.pathname, enabled: control.settingsEnabled,
                boundary: 'Consistent safe synthetic settings read, no webhook or credential values.' });
            return route.fulfill({ json: settingsReadModel(state.baseUrl, control.settingsEnabled) });
        }
        if (method === 'GET' && url.pathname === api + 'persons/' + fixtureId) return route.fulfill({ json: fixtureCustomer(state.phase) });
        const affectedRecordPrivacy = state.phase === 'after' && state.suite === 'editor-privacy';
        const knownKiwiApi = ['/kiwi/api', '/kiwi-preview/api'].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'));
        if (affectedRecordPrivacy && knownKiwiApi) return denied('Affected-record privacy denies every other Kiwi API request; no upstream reads or writes.');
        return route.continue();
    });
    return control;
}

function settingsReadModel(baseUrl, enabled) {
    return { feedbackEnabled: enabled, allowedRoles: ['admin', 'dev', 'supervisor'], teamsWebhookConfigured: false,
        teamsWebhookSource: 'none', originalDataWebhookConfigured: false, originalDataWebhookSource: 'none',
        publicBaseUrl: baseUrl.href.replace(/\/$/, ''), imageTtlDays: 14, maxImageBytes: 3145728, updatedAt: null };
}

async function login(page, control, state) {
    control.authReceiver = createNativeLoginReceiver(page, page.mainFrame());
    await page.exposeBinding('__themeAuditReceiveNativeLogin', (source, snapshot) => {
        const received = control.authReceiver.receive(source, snapshot);
        state.report.authLifecycle.push({ nativeSnapshotReceived: received, sourcePageMatches: source.page === page,
            sourceMainFrameMatches: source.frame === page.mainFrame() });
        return received;
    });
    await page.goto(state.baseUrl.href);
    await page.locator('[name=username]').fill(selectedNativeLoginAccount(state));
    await page.locator('[name=password]').fill('kiwi-local-dev-password');
    control.auth = await page.locator('[name=password]').evaluate(input => {
        const form = input.form;
        // The existing inline submit handler is registered first. Observe its resulting native successful controls.
        form.addEventListener('submit', event => {
            void window.__themeAuditReceiveNativeLogin({ entries: [...new FormData(form, event.submitter).entries()],
                submitterDisabled: Boolean(event.submitter?.disabled) });
        }, { once: true });
        return { url: form.action };
    });
    const action = new URL(control.auth.url);
    assert.equal(action.origin, state.baseUrl.origin);
    assert.equal(action.pathname, '/kiwi-oidc/realms/kiwi-local/login-actions/authenticate');
    await Promise.all([page.waitForURL(url => url.pathname === state.baseUrl.pathname), page.locator('input[type=submit],button[type=submit]').click()]);
    control.auth = null;
    await page.waitForFunction(() => window.kiwiCallAgentRuntime && window.kiwiCallSessionSlice && window.kiwiContactHistorySlice && window.kiwiOutbox);
    await page.locator('#agentProfileTrigger').click();
    await page.locator('[data-locale-option=nl]').click();
}

async function painted(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function save(state) {
    await writeFile(path.join(state.evidenceDir, 'report.json'), JSON.stringify(state.report, null, 2) + '\n');
}

async function observe(page, state, name, selectors, detail = {}) {
    await painted(page);
    assert.equal(state.report.sourceErrors.length, 0, 'Source mismatch stops observation before capturing another state.');
    const after = state.phase === 'after';
    if (after) assert.equal(await page.evaluate(() => document.body.innerText.includes('undefined')), false, 'Visible undefined indicates incomplete fixture or application content before capture.');
    const data = await page.evaluate(({ selectors, after }) => {
        const box = node => {
            const r = node.getBoundingClientRect(), s = getComputedStyle(node);
            const securityValue = node.type === 'hidden' || /csrf|token|idempotency|submission|session|credential|webhook|password/i.test([node.id, node.name].filter(Boolean).join(' '));
            return { tag: node.tagName, id: node.id, text: node.textContent?.trim(), x: r.x, y: r.y, width: r.width,
                height: r.height, right: r.right, bottom: r.bottom, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
                scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, display: s.display, color: s.color,
                background: s.backgroundColor, opacity: s.opacity, font: s.font, lineHeight: s.lineHeight,
                padding: s.padding, gap: s.gap, border: s.border, radius: s.borderRadius, shadow: s.boxShadow,
                overflow: s.overflow, transform: s.transform, animationName: s.animationName, outline: s.outline, outlineOffset: s.outlineOffset,
                focusVisible: node.matches(':focus-visible'), visible: Boolean(node.getClientRects().length) && s.visibility !== 'hidden',
                disabled: node.disabled, readOnly: node.readOnly, nativeModal: node.matches(':modal'), value: node.type === 'password' || (after && securityValue) ? undefined : node.value,
                checked: node.checked, role: node.getAttribute('role'), ariaExpanded: node.getAttribute('aria-expanded'),
                ariaLabel: node.getAttribute('aria-label'), tabIndex: node.tabIndex,
                sensitive: node.getAttribute('data-feedback-sensitive'),
                ...(after ? { className: typeof node.className === 'string' ? node.className : '', inputType: node.type,
                    valuePresent: 'value' in node ? Boolean(node.value) : undefined, securityValueRedacted: securityValue,
                    fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight,
                    outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, borderTopWidth: s.borderTopWidth,
                    popoverOpen: node.matches(':popover-open'), svgCount: node.querySelectorAll('svg').length } : {}) };
        };
        return { viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, scrollX, scrollY,
            documentWidth: document.documentElement.scrollWidth, active: { id: document.activeElement?.id, tag: document.activeElement?.tagName,
                text: document.activeElement?.textContent?.trim(), connected: document.activeElement?.isConnected },
            media: { coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches,
                hover: matchMedia('(hover: hover)').matches, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches },
            roots: selectors.map(selector => ({ selector, nodes: [...document.querySelectorAll(selector)].map(box) })),
            controls: selectors.flatMap(selector => [...document.querySelectorAll(selector + ' button,' + selector + ' input,' + selector + ' select,' + selector + ' textarea')].map(box)) };
    }, { selectors, after });
    const prefix = `${state.viewport.width}x${state.viewport.height}`;
    const filename = `${prefix}-${after ? 'after-' : ''}${name}.png`;
    if (state.nativeKernel) await state.nativeKernel.captureWholeDesktop(filename);
    else await page.screenshot({ path: path.join(state.evidenceDir, filename) });
    state.report.observations.push({ name, filename, evidenceKind: after
        ? 'Actual installed candidate09 renderer/controller with declared synthetic fixtures; finite explicitly declared AFTER scope, independent whole-image review and remaining gates required.'
        : 'Actual installed application renderer/controller with explicit synthetic in-memory/read fixtures; observational BEFORE only.', captureMethod: state.nativeKernel ? 'Actual1600x1200wholeX11desktop' : 'Browserprotocolscreenshot', ...detail, data });
    await save(state);
    assert.equal(state.report.deniedRequests.length, 0, 'Unexpected request stops the finite gate.');
    assert.equal(state.report.errors.length, 0, 'Runtime error stops the finite gate.');
    if (after) {
        state.checkAfterObservation(name, data, detail, state);
        await save(state);
    }
    return data;
}

async function flushCalls(page, control) {
    await page.waitForFunction(() => window.kiwiCallAgentRuntime && window.kiwiOutbox);
    for (let attempt = 0; attempt < 100 && control.gate.pending().length; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(control.gate.pending(), [], 'Every exact armed renderer-side call write must be observed.');
}

async function startCall(page, state, control, options) {
    const session = { ...idleSession(), active: true, serviceNumber: 'AVROBODE', waitTime: 187, startTime: Date.now() - 125000, ...options };
    const expected = { ...session, recordingActive: true }; delete expected.durationInterval;
    control.gate.arm('POST', state.api + 'agent-status', { status: 'in_call' }, { status: 'in_call', teams_sync: null });
    control.gate.arm('PUT', state.api + 'call-session', expected, expected);
    await page.evaluate(session => {
        const previous = window.callSession;
        if (previous.durationInterval) clearInterval(previous.durationInterval);
        window.callSession = session;
        window.kiwiCallSessionSlice.startCallSession();
        window.kiwiCallAgentRuntime.updateQueueDisplay();
    }, session);
    await flushCalls(page, control);
}

async function measureShortCallState(page, includeIdentity) {
    return page.evaluate(diagnostic => {
        const toast = document.querySelector('#toast'), tr = toast.getBoundingClientRect();
        const overlap = r => Math.min(r.right, tr.right) > Math.max(r.left, tr.left) && Math.min(r.bottom, tr.bottom) > Math.max(r.top, tr.top);
        const selectors = ['#recordingIndicator .rec-text', '#holdCallBtn', '#endCallBtn', ...(diagnostic ? ['#sessionServiceNumber', '#sessionCallerName'] : [])];
        const controls = selectors.map(selector => {
            const node = document.querySelector(selector), r = node.getBoundingClientRect(), style = getComputedStyle(node);
                const active = node === document.activeElement, focusVisible = node.matches(':focus-visible');
                const ring = active && focusVisible ? Math.max(0, Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset)) : 0;
            const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                const s = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
                if (/hidden|clip|auto|scroll/.test(s.overflowX)) {
                    clip.left = Math.max(clip.left, bounds.left + parent.clientLeft);
                    clip.right = Math.min(clip.right, bounds.left + parent.clientLeft + parent.clientWidth);
                }
                if (/hidden|clip|auto|scroll/.test(s.overflowY)) {
                    clip.top = Math.max(clip.top, bounds.top + parent.clientTop);
                    clip.bottom = Math.min(clip.bottom, bounds.top + parent.clientTop + parent.clientHeight);
                }
            }
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                const perimeter = { left: r.left - ring, top: r.top - ring, right: r.right + ring, bottom: r.bottom + ring };
                return { selector, text: node.textContent.trim(), active, focusVisible,
                bounds: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, clip,
                fullControlAndFocusInsideAllClips: r.width > 0 && r.height > 0 && r.left - ring >= clip.left && r.top - ring >= clip.top
                    && r.right + ring <= clip.right && r.bottom + ring <= clip.bottom,
                    overlapsToast: overlap(r), paintedFocusPerimeter: active && focusVisible ? perimeter : null,
                    focusPerimeterOverlapsToast: active && focusVisible && overlap(perimeter), naturalPointerTarget: hit === node || node.contains(hit) };
        });
        const header = document.querySelector('.header'), session = document.querySelector('#sessionInfo');
        return { toastVisible: toast.classList.contains('show') && tr.width > 0 && tr.height > 0 && tr.top >= 0 && tr.bottom <= innerHeight,
                    authenticResumedMessage: toast.textContent.includes('Gesprek hervat'), toastText: toast.textContent.trim(), toastClassShown: toast.classList.contains('show'),
            scrollY, documentHeight: document.documentElement.scrollHeight, headerPosition: getComputedStyle(header).position,
            headerBounds: { top: header.getBoundingClientRect().top, bottom: header.getBoundingClientRect().bottom },
            sessionScrollTop: session.scrollTop, controls };
    }, includeIdentity);
}

export function shortCallControlsAreReachable(controls, { requireKeyboardFocus = true } = {}) {
    const required = ['#recordingIndicator .rec-text', '#holdCallBtn', '#endCallBtn'];
    const nodes = required.map(selector => controls.filter(control => control.selector === selector));
    if (nodes.some(matches => matches.length !== 1)) return false;
    const actual = nodes.flat();
    const focusedAction = actual.find(control => control.active && control.selector !== required[0]);
    const focusMatchesInputPhase = Boolean(focusedAction) && (!requireKeyboardFocus || focusedAction.focusVisible);
    return focusMatchesInputPhase && actual.every(control => control.fullControlAndFocusInsideAllClips
        && !control.overlapsToast && !control.focusPerimeterOverlapsToast && control.naturalPointerTarget);
}

async function observeAnonymousShort(page, state, stage, { requireReachability = false } = {}) {
    const steps = [];
    for (const key of ['initial', 'Tab', 'Shift+Tab']) {
        if (key !== 'initial') await page.keyboard.press(key);
        await painted(page);
        const sentinel = await measureShortCallState(page, true);
        steps.push({ key, sentinel });
        await observe(page, state, `anonymous-short-${stage}-${key}`, ['#sessionInfo', '#recordingIndicator', '#toast'],
            { sentinel, boundary: 'Actual anonymous hold/resume toast; initial state and native Tab/ShiftTab only. Geometry/hit/overlap observed without focus/scroll/CSS/timer repair.' });
        if (requireReachability) {
            const authentic = stage === 'held' ? sentinel.toastText === 'Gesprek in wacht gezet' : sentinel.authenticResumedMessage;
            const passed = sentinel.toastVisible && authentic && shortCallControlsAreReachable(sentinel.controls, { requireKeyboardFocus: key !== 'initial' });
            state.report.checks.push({ name: 'Anonymous short ' + stage + ' full controls/focus remain unobscured under authentic toast', key, passed });
            await save(state);
            assert.ok(passed, 'Actual anonymous short controls and painted focus must remain fully unobscured under the unmodified hold/resume toast.');
        }
    }
    state.report.anonymousShortDiagnostic ||= [];
    state.report.anonymousShortDiagnostic.push({ stage, steps });
}

async function calls(page, state, control) {
    await page.evaluate(name => {
        window.callSession.active = false;
        window.callQueue = { enabled: true, queue: [
            { id: 'synthetic-queue-1', callerType: 'anonymous', customerId: null, customerName: name, serviceNumber: 'SYNTHETIC', waitTime: 187 },
            { id: 'synthetic-queue-2', callerType: 'anonymous', customerId: null, customerName: 'Anonieme Beller', serviceNumber: 'AVROBODE', waitTime: 61 }
        ], currentPosition: 0, autoAdvance: true, waitTimeInterval: null };
        window.kiwiCallAgentRuntime.updateQueueDisplay();
    }, longName);
    await observe(page, state, 'queue-long', ['#queueInfo'], { boundary: 'Independent actual queue renderer fixture. Its in-memory fixture ends before active-call setup; no queue-to-call continuity or persisted queue claim.' });
    await page.evaluate(finishOperationalQueueFixture);
    await startCall(page, state, control, {});
    await observe(page, state, 'call-anonymous-recording', ['#sessionInfo', '#recordingIndicator']);
    const held = await page.evaluate(() => { const held = { ...window.callSession, onHold: true, holdStartTime: Date.now() }; delete held.durationInterval; return held; });
    control.gate.arm('POST', state.api + 'call-session/hold', {}, held);
    await page.locator('#holdCallBtn').press('Enter');
    await flushCalls(page, control);
    await observe(page, state, 'call-hold-recording', ['#sessionInfo', '#recordingIndicator', '#holdIndicator']);
    if (state.suite === 'held-readability') {
        const held = await page.locator('#holdIndicator').evaluate(node => {
            const r = node.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node);
            const textRects = [...range.getClientRects()].map(rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }));
            const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                const s = getComputedStyle(parent), b = parent.getBoundingClientRect();
                if (/hidden|clip|auto|scroll/.test(s.overflowX)) { clip.left = Math.max(clip.left, b.left + parent.clientLeft); clip.right = Math.min(clip.right, b.left + parent.clientLeft + parent.clientWidth); }
                if (/hidden|clip|auto|scroll/.test(s.overflowY)) { clip.top = Math.max(clip.top, b.top + parent.clientTop); clip.bottom = Math.min(clip.bottom, b.top + parent.clientTop + parent.clientHeight); }
            }
            return { text: node.textContent.trim(), width: r.width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, flexBasis: getComputedStyle(node).flexBasis,
                bounds: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, textRects, clip,
                completeTextInsideAllClips: textRects.every(rect => rect.left >= clip.left && rect.right <= clip.right && rect.top >= clip.top && rect.bottom <= clip.bottom) };
        });
        await observe(page, state, 'held-label-complete-readable', ['#sessionInfo', '#holdIndicator'], { held,
            boundary: 'Actual held controller and unchanged source label, measured at each declared narrow width; no fabricated label/width or source scroll/CSS repair.' });
        const passed = held.text === '🎵 Klant in wacht' && held.flexBasis === '100%' && held.clientWidth > 0
            && held.scrollWidth <= held.clientWidth + 1 && held.completeTextInsideAllClips;
        state.report.checks.push({ name: 'Complete held label fits its actual full-row region and all clipping ancestors', passed });
        await save(state); assert.ok(passed, 'Actual held label must remain completely readable in its source full-row layout.');
        return;
    }
    const checkAnonymousShort = state.suite === 'anonymous-short' || (state.phase === 'after' && state.viewport.height === 320 && state.suite === 'operational');
    if (checkAnonymousShort) await observeAnonymousShort(page, state, 'held', { requireReachability: true });
    const resumed = { ...held, onHold: false, holdStartTime: null, totalHoldTime: 12 };
    control.gate.arm('POST', state.api + 'call-session/resume', {}, resumed);
    await page.locator('#holdCallBtn').press('Enter');
    await flushCalls(page, control);
    await observe(page, state, 'call-resumed', ['#sessionInfo', '#recordingIndicator']);
    if (checkAnonymousShort) await observeAnonymousShort(page, state, 'resumed', { requireReachability: true });
    if (state.suite === 'anonymous-short') return;
    await startCall(page, state, control, { callerType: 'identified', customerId: fixtureId, customerName: longName,
        serviceNumber: state.phase === 'after' ? 'Synthetic service line with a deliberately long operational label' : 'SYNTHETIC' });
    await observe(page, state, 'call-identified-long', ['#sessionInfo', '#recordingIndicator']);
    if (state.phase === 'after' && state.viewport.height === 320) {
        const diagnostic = state.suite === 'short-call';
        const actions = diagnostic ? ['initial', 'Tab', 'Shift+Tab', 'wheel', 'Tab', 'Shift+Tab', 'expiry'] : ['initial', 'Tab', 'Shift+Tab'];
        const steps = [];
        for (const [index, key] of actions.entries()) {
            if (key === 'Tab' || key === 'Shift+Tab') await page.keyboard.press(key);
            if (key === 'wheel') { await page.mouse.move(190, 150); await page.mouse.wheel(0, 180); }
            if (key === 'expiry') await page.waitForFunction(() => {
                const node = document.querySelector('#toast'), r = node.getBoundingClientRect(), s = getComputedStyle(node);
                return !node.classList.contains('show') && (r.top >= innerHeight || r.bottom <= 0 || s.visibility === 'hidden' || s.opacity === '0');
            }, null, { timeout: 5000 });
            await painted(page);
            const sentinel = await measureShortCallState(page, diagnostic);
            steps.push({ key, sentinel });
            await observe(page, state, 'short-active-long-resumed-toast-' + (diagnostic ? index + '-' : '') + key, ['#sessionInfo', '#recordingIndicator', '#toast'],
                { sentinel, boundary: diagnostic
                    ? 'Authentic resumed toast/long call with native Tab/ShiftTab, one real wheel and natural visual expiry; no DOM scroll/focus repair, timer/text/CSS change or new business write.'
                    : 'Authentic existing resumed toast and current long identified call; no timer suppression, new contact write, CSS change or forced focus. Tab/ShiftTab only.' });
            if (diagnostic) continue;
            if (key === 'initial') continue;
            const passed = sentinel.toastVisible && sentinel.authenticResumedMessage && shortCallControlsAreReachable(sentinel.controls);
            state.report.checks.push({ name: 'Short active-long recording/actions/focus are fully reachable while authentic resumed toast is visible', passed, key });
            await save(state);
            assert.ok(passed, 'Actual short REC and essential actions/focus must remain reachable while the unmodified resumed toast is visible.');
        }
        if (diagnostic) {
            state.report.shortCallDiagnostic = { steps, boundary: 'Four genuine Tab/ShiftTab events, one actual180px wheel, then natural existing toast expiry; initial full-viewport fit is observational, not an asserted prerequisite.' };
            await save(state);
            return;
        }
    }
    await startCall(page, state, control, {});
    const lastCall = await page.evaluate(() => ({ customerId: null, customerName: null, serviceNumber: window.callSession.serviceNumber,
        startTime: window.callSession.startTime, callDuration: Math.floor((Date.now() - window.callSession.startTime) / 1000), waitTime: window.callSession.waitTime, totalHoldTime: window.callSession.totalHoldTime }));
    control.gate.arm('POST', state.api + 'call-session/end', { forcedByCustomer: false }, { last_call_session: lastCall, call_session: idleSession() });
    control.gate.arm('POST', state.api + 'agent-status', { status: 'ready' }, { status: 'ready', teams_sync: null });
    await page.evaluate(() => window.kiwiCallAgentRuntime.endCallSession());
    await flushCalls(page, control);
    await observe(page, state, 'acw-disposition-empty', ['#acwBar', '#dispositionModal']);
    await page.locator('[data-action="disposition.save"]').press('Enter');
    await observe(page, state, 'disposition-invalid', ['#dispositionModal', '#toast']);
    const category = await page.locator('#dispCategory option').evaluateAll(nodes => nodes.find(node => node.value)?.value);
    assert.ok(category, 'Source-installed disposition categories are available.');
    await page.locator('#dispCategory').selectOption(category);
    const outcome = await page.locator('#dispOutcome option').evaluateAll(nodes => nodes.find(node => node.value)?.value);
    assert.ok(outcome, 'Source-installed conditional outcomes are available.');
    await page.locator('#dispOutcome').selectOption(outcome);
    await page.locator('#dispNotes').fill(longText);
    await page.locator('#dispFollowUpRequired').check();
    await page.locator('#dispFollowUpNotes').fill(longText);
    await page.locator('#dispFollowUpDate').fill('2026-12-01');
    await page.locator('#dispFollowUpDate').scrollIntoViewIfNeeded();
    await observe(page, state, 'disposition-followup', ['#dispositionModal', '#followUpSection']);
    if (state.phase === 'after') {
        const steps = [];
        for (let attempt = 0; attempt <= 10; attempt += 1) {
            await painted(page);
            const geometry = await page.evaluate(() => {
                const node = document.activeElement, rect = node.getBoundingClientRect(), style = getComputedStyle(node);
                const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, ancestors = [];
                for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                    const s = getComputedStyle(parent), r = parent.getBoundingClientRect();
                    const clipsX = /hidden|clip|auto|scroll/.test(s.overflowX), clipsY = /hidden|clip|auto|scroll/.test(s.overflowY);
                    if (!clipsX && !clipsY) continue;
                    const bounds = { left: r.left + parent.clientLeft, top: r.top + parent.clientTop,
                        right: r.left + parent.clientLeft + parent.clientWidth, bottom: r.top + parent.clientTop + parent.clientHeight };
                    ancestors.push({ id: parent.id, className: parent.className, overflowX: s.overflowX, overflowY: s.overflowY,
                        scrollTop: parent.scrollTop, scrollHeight: parent.scrollHeight, clientHeight: parent.clientHeight, bounds });
                    if (clipsX) { clip.left = Math.max(clip.left, bounds.left); clip.right = Math.min(clip.right, bounds.right); }
                    if (clipsY) { clip.top = Math.max(clip.top, bounds.top); clip.bottom = Math.min(clip.bottom, bounds.bottom); }
                }
                const ring = Number.parseFloat(style.outlineWidth) + Math.max(0, Number.parseFloat(style.outlineOffset));
                return { id: node.id, tag: node.tagName, text: node.tagName === 'BUTTON' ? node.textContent.trim() : undefined,
                    footerAction: Boolean(node.closest('#dispositionModal .modal-actions')), focusVisible: node.matches(':focus-visible'),
                    bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, clip, ancestors,
                    ringWidth: Number.parseFloat(style.outlineWidth), ringOffset: Number.parseFloat(style.outlineOffset),
                    fullyVisibleWithRing: rect.left - ring >= clip.left && rect.right + ring <= clip.right
                        && rect.top - ring >= clip.top && rect.bottom + ring <= clip.bottom };
            });
            steps.push({ nativeTabCount: attempt, ...geometry });
            if (geometry.footerAction) break;
            if (attempt < 10) await page.keyboard.press('Tab');
        }
        const final = steps.at(-1);
        await observe(page, state, 'disposition-followup-footer-natural-focus', ['#dispositionModal', '#dispositionModal .modal-actions'],
            { naturalTabSteps: steps, boundary: 'Actual native Tab from the focused date; no focus call, forced click, CSS or scroll mutation. Clipping includes every overflow ancestor and the actual focus perimeter.' });
        const passed = final.footerAction && final.focusVisible && final.fullyVisibleWithRing;
        state.report.checks.push({ name: 'Natural follow-up footer focus and complete ring remain inside all clipping ancestors', passed, final });
        await save(state);
        assert.ok(passed, 'Actual follow-up footer must be naturally reachable with a fully visible focus perimeter.');
    }
    const cancelSelector = state.phase === 'after' ? '#dispositionModal .modal-actions [data-action="disposition.cancel"]' : '[data-action="disposition.cancel"]';
    await page.locator(cancelSelector).press('Enter');
    await observe(page, state, 'acw-after-cancel', ['#acwBar', '#dispositionModal']);
    await page.evaluate(() => window.kiwiCallAgentRuntime.showDispositionModal());
    await page.keyboard.press('Escape');
    await observe(page, state, 'disposition-escape', ['#acwBar', '#dispositionModal']);
    await page.evaluate(() => { window.kiwiCallAgentRuntime.endACW(); window.kiwiCallAgentRuntime.stopQueueWaitTimeUpdate(); });
}

async function history(page, state) {
    const customer = fixtureCustomer(state.phase);
    customer.contactHistory = categoryNames.map((type, index) => ({ id: 'synthetic-history-' + index, type,
        date: new Date(Date.UTC(2026, 10, 12, 10, 59 - index)).toISOString(), description: `${type}: ${longText}` }));
    await page.evaluate(customer => { window.currentCustomer = customer; window.customers = [customer]; window.contactHistoryState = { currentPage: 1, itemsPerPage: 6, highlightId: null, lastEntry: null }; window.kiwiContactHistorySlice.displayContactHistory(); }, customer);
    await page.locator('#contactHistory').scrollIntoViewIfNeeded();
    for (let number = 1; number <= 4; number++) {
        await page.evaluate(number => window.kiwiContactHistorySlice.changeContactHistoryPage(number), number);
        await page.locator('.timeline-item').first().scrollIntoViewIfNeeded();
        await observe(page, state, 'history-rest-page-' + number, ['#contactHistory'], { sourceCategories: categoryNames.slice((number - 1) * 6, number * 6) });
        const ids = await page.locator('.timeline-item').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.contactId, tone: [...node.classList].find(name => /^timeline-item--(warning|info|success|muted|danger|group)$/.test(name)) })));
        for (const item of ids) {
            const detailed = state.viewport.width === 1440;
            if (detailed) {
                await page.evaluate(() => { window.contactHistoryState.highlightId = null; window.kiwiContactHistorySlice.displayContactHistory(); });
                await page.locator('[data-contact-id="' + item.id + '"]').scrollIntoViewIfNeeded();
                await observe(page, state, 'history-rest-' + item.id, ['[data-contact-id="' + item.id + '"]'], { boundary: 'Each actual desktop category/rest row is scrolled into the whole frame; offscreen DOM nodes do not substitute for category visual evidence.', tone: item.tone });
            }
            if (!detailed && state.report.highlightTones.includes(item.tone)) continue;
            await page.evaluate(id => { window.contactHistoryState.highlightId = id; window.kiwiContactHistorySlice.displayContactHistory(); }, item.id);
            await page.locator('[data-contact-id="' + item.id + '"]').scrollIntoViewIfNeeded();
            await observe(page, state, 'history-highlight-' + item.id, ['[data-contact-id="' + item.id + '"]'], { highlightSetup: 'Source-derived installed highlightId state; no synthetic history event or persistence. Duration/insert invariants are not claimed.', tone: item.tone });
            if (!state.report.highlightTones.includes(item.tone)) state.report.highlightTones.push(item.tone);
        }
        await page.evaluate(() => { window.contactHistoryState.highlightId = null; window.kiwiContactHistorySlice.displayContactHistory(); });
    }
    await page.evaluate(() => { window.currentCustomer.contactHistory = []; window.kiwiContactHistorySlice.displayContactHistory(); });
    await observe(page, state, 'history-empty', ['#contactHistory']);
    await page.evaluate(() => { window.currentCustomer = null; window.customers = []; });
}

async function refresh(page) { await page.evaluate(() => window.kiwiOutbox.refreshOutbox()); }

async function initialOutbox(page, state, control) {
    await page.locator('[data-action="toggle-subscription-queue-info"]').press('Enter');
    for (let attempt = 0; attempt < 100 && !control.held.length; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(control.held.length, 1, 'Actual initial outbox GET is held.');
    await observe(page, state, 'outbox-initial-loading', ['#subscriptionQueuePanel'], { boundary: 'Initial installed controller awaiting real intercepted GET; no fabricated spinner or loading class.' });
    control.mode = 'error'; control.release();
    await page.waitForFunction(() => document.querySelector('#sessionOutboxStatus').textContent.includes('Outbox niet vernieuwd'));
    await observe(page, state, 'outbox-initial-error', ['#subscriptionQueuePanel']);
    control.mode = 'empty'; await refresh(page);
    await observe(page, state, 'outbox-initial-empty', ['#subscriptionQueuePanel']);
    control.mode = 'ready'; await refresh(page);
    await page.locator('[data-action="toggle-subscription-queue-info"]').press('Enter');
}

async function inspectOutboxFallbackFocus(page, state, control, { fromOutside = false } = {}) {
    control.mode = 'ready'; control.release();
    await page.locator('[data-action="toggle-subscription-queue-info"]').press('Enter');
    await refresh(page);
    const title = page.locator('.session-outbox-item').first().locator('button.session-outbox-customer');
    if (fromOutside) {
        await page.locator('#agentProfileTrigger').focus();
        const outsideBefore = await page.evaluate(() => ({ profileFocused: document.activeElement?.id === 'agentProfileTrigger', scrollY }));
        await refresh(page);
        const outsideAfter = await page.evaluate(() => ({ profileFocused: document.activeElement?.id === 'agentProfileTrigger', scrollY }));
        assert.ok(outsideBefore.profileFocused && outsideAfter.profileFocused, 'The separate outside-focus refresh control must not steal focus.');
        state.report.outboxOutsideFocusControl = { outsideBefore, outsideAfter };
        await title.focus();
    } else { await title.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); }
    const measure = async () => {
        await painted(page);
        return page.evaluate(() => {
            const active = document.activeElement, list = document.querySelector('#subscriptionQueueList'), row = list.firstElementChild;
            const bounds = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
            const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, ancestors = [];
            for (let parent = active.parentElement; parent; parent = parent.parentElement) {
                const s = getComputedStyle(parent), r = parent.getBoundingClientRect();
                const clipsX = /hidden|clip|auto|scroll/.test(s.overflowX), clipsY = /hidden|clip|auto|scroll/.test(s.overflowY);
                if (!clipsX && !clipsY) continue;
                const inner = { left: r.left + parent.clientLeft, top: r.top + parent.clientTop,
                    right: r.left + parent.clientLeft + parent.clientWidth, bottom: r.top + parent.clientTop + parent.clientHeight };
                ancestors.push({ id: parent.id, className: parent.className, overflowX: s.overflowX, overflowY: s.overflowY,
                    bounds: bounds(parent), clip: inner, scrollTop: parent.scrollTop, scrollHeight: parent.scrollHeight, clientHeight: parent.clientHeight });
                if (clipsX) { clip.left = Math.max(clip.left, inner.left); clip.right = Math.min(clip.right, inner.right); }
                if (clipsY) { clip.top = Math.max(clip.top, inner.top); clip.bottom = Math.min(clip.bottom, inner.bottom); }
            }
            const style = getComputedStyle(active), r = bounds(active), width = Number.parseFloat(style.outlineWidth), offset = Number.parseFloat(style.outlineOffset);
            const perimeter = Math.max(0, width + offset), inside = box => box.left >= clip.left && box.top >= clip.top && box.right <= clip.right && box.bottom <= clip.bottom;
            const ring = { left: r.left - perimeter, top: r.top - perimeter, right: r.right + perimeter, bottom: r.bottom + perimeter };
            return { active: { tag: active.tagName, id: active.id, className: active.className,
                text: active.tagName === 'BUTTON' ? active.textContent.trim() : undefined, bounds: r, firstRow: active === row, insideFirstRow: active === row || row.contains(active),
                focusVisible: active.matches(':focus-visible'), outlineWidth: width, outlineOffset: offset, outlineColor: style.outlineColor,
                borderBoxInsideAllClips: inside(r), completeFocusPerimeterInsideAllClips: inside(ring), perimeter: ring },
                firstRow: bounds(row), list: { bounds: bounds(list), scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight },
                clip, ancestors };
        });
    };
    const before = await measure();
    assert.equal(before.active.focusVisible, true);
    assert.equal(before.active.insideFirstRow, true, 'The old first-row control must actually own focus before its capabilities disappear.');
    control.items = control.items.map((item, index) => index ? item : { ...item, capabilities: { edit: false, pause: false, resume: false, delete: false } });
    await refresh(page);
    const fallback = await measure();
    assert.equal(fallback.active.firstRow, true, 'The actual refreshed controller must select its no-action row fallback.');
    await observe(page, state, 'outbox-fallback-perimeter', ['#subscriptionQueuePanel', '#subscriptionQueueList'],
        { before, fallback, fromOutside, boundary: 'Actual synthetic GET removes all first-row capabilities; installed refresh chooses its fallback. Geometry distinguishes row border box from outward focus perimeter; no CSS/scroll/focus repair.' });
    await page.keyboard.press('Tab');
    const next = await measure();
    await observe(page, state, 'outbox-fallback-next-natural-tab', ['#subscriptionQueuePanel', '#subscriptionQueueList'], { next,
        boundary: 'One genuine subsequent Tab; no forced pointer or focus/scroll mutation.' });
    state.report.outboxFallbackDiagnostic = { before, fallback, next,
        sourceFinding: !fallback.active.completeFocusPerimeterInsideAllClips,
        classification: fallback.active.borderBoxInsideAllClips ? 'Row border box is contained; classify outward focus perimeter against actual clipping ancestors.' : 'The actual focused fallback border box itself is outside a clipping ancestor.' };
    await save(state);
    const passed = fallback.active.borderBoxInsideAllClips && fallback.active.completeFocusPerimeterInsideAllClips
        && next.active.focusVisible && next.active.completeFocusPerimeterInsideAllClips;
    state.report.checks.push({ name: 'Restored fallback row and subsequent natural keyboard control have complete visible focus perimeters', passed });
    await save(state); assert.ok(passed, 'Corrected fallback focus must remain fully inside viewport and every clipping ancestor.');
}

async function inspectOutboxEditorHeader(page, state, control, { retainRecordCustomer = false } = {}) {
    control.mode = 'ready'; control.release();
    if (!retainRecordCustomer) {
        await page.evaluate(async customer => window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer }), fixtureCustomer('after'));
    } else {
        const sameCustomer = await page.evaluate(customer => String(window.currentCustomer?.personId) === customer.personId
            && window.currentCustomer?.credentialKey === customer.credentialKey, state.recordFixture.customer);
        assert.equal(sameCustomer, true, 'Native records and generic editor must share the original selected customer; no reset POST or second customer selection.');
    }
    const saved = { ...control.items[1], customerReference: control.items[0].customerReference, summary: { customer: longName, changeCount: 1 } };
    if (retainRecordCustomer) {
        const customer = state.recordFixture.customer;
        saved.customerReference = { ...saved.customerReference, personId: customer.personId, credentialKey: customer.credentialKey,
            sourceSystem: customer.sourceSystem, mandant: customer.mandant };
        saved.customers = [customer];
        saved.summary.customer = [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ');
        saved.changes = saved.changes.map(change => ({ ...change, arguments: [Number(customer.personId), change.arguments[1]] }));
        control.items = [saved];
    }
    await page.evaluate(item => window.kiwiOutbox.acceptWrite('POST', '/api/v1/persons/' + item.customerReference.personId + '/contact-history',
        item.changes[0].arguments[1], { outbox: item }), saved);
    await page.locator('#customerSessionChanges').waitFor({ state: 'visible' });
    await page.locator('#customerSessionChanges > summary').press('Enter');
    await page.locator('#sessionOutboxChanges button').first().press('Enter');
    const dialog = page.locator('#sessionOutboxEditor');
    await dialog.waitFor({ state: 'visible' });
    const steps = [];
    for (const key of ['initial', 'Tab', 'Shift+Tab']) {
        if (key !== 'initial') await page.keyboard.press(key);
        await painted(page);
        const geometry = await dialog.evaluate(node => {
            const title = node.querySelector('#sessionOutboxEditorTitle'), header = node.querySelector('.form-header');
            const close = header.querySelector('[data-session-outbox-editor-close]');
            const box = element => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return {
                left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
                display: s.display, font: s.font, padding: s.padding, gap: s.gap, overflow: s.overflow,
                scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
                focusVisible: element.matches(':focus-visible'), active: element === document.activeElement,
                outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset }; };
            const range = document.createRange(); range.selectNodeContents(title);
            const text = range.getBoundingClientRect(), closeRect = close.getBoundingClientRect();
            const intersection = { width: Math.max(0, Math.min(text.right, closeRect.right) - Math.max(text.left, closeRect.left)),
                height: Math.max(0, Math.min(text.bottom, closeRect.bottom) - Math.max(text.top, closeRect.top)) };
            return { titleText: title.textContent, title: box(title), titleGlyphBounds: { left: text.left, top: text.top, right: text.right, bottom: text.bottom },
                close: box(close), header: box(header), card: box(node.querySelector('.card')), dialog: box(node),
                actualGlyphCloseIntersection: intersection, titleTouchesOrOverlapsClose: text.right >= closeRect.left && intersection.height > 0,
                active: { tag: document.activeElement.tagName, id: document.activeElement.id }, nativeModal: node.matches(':modal') };
        });
        steps.push({ key, geometry });
        await observe(page, state, 'outbox-editor-header-' + key, ['#sessionOutboxEditor', '#sessionOutboxEditor .form-header', '#sessionOutboxEditor .card'],
            { geometry, boundary: 'Installed acceptWrite with synthetic local read model opens actual native editor; no network business write, input edit or CSS/focus/scroll repair. Actual heading text Range vs close geometry plus native Tab/ShiftTab.' });
        const ring = geometry.close.focusVisible ? Math.max(0, Number.parseFloat(geometry.close.outlineWidth) + Number.parseFloat(geometry.close.outlineOffset)) : 0;
        const passed = geometry.nativeModal && geometry.titleText === 'Contactregistratie' && geometry.header.gap === '12px'
            && geometry.header.scrollWidth <= geometry.header.clientWidth + 1 && geometry.close.width >= 40 && geometry.close.height >= 40
            && geometry.titleGlyphBounds.right < geometry.close.left - ring
            && geometry.close.left - ring >= geometry.card.left && geometry.close.right + ring <= geometry.card.right;
        state.report.checks.push({ name: 'Native editor reserves header gap and complete close target/focus without touching title text', key, passed });
        await save(state); assert.ok(passed, 'Actual native editor heading and close target/focus require separate contained regions.');
    }
    state.report.outboxEditorHeaderDiagnostic = { steps };
    await dialog.locator('.form-header [data-session-outbox-editor-close]').press('Enter');
    await dialog.waitFor({ state: 'hidden' });
}

async function outbox(page, state, control) {
    await page.locator('[data-action="toggle-subscription-queue-info"]').press('Enter');
    await refresh(page);
    control.mode = 'held';
    const geometryRead = refresh(page);
    try {
        for (let attempt = 0; attempt < 140 && !control.held.length; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(control.held.length, 1, 'One real outbox GET must be pending before stable geometry observation.');
        state.report.stableGeometryRead = { actualReadNumber: control.reads, pendingRead: true, releasedAndDrained: false,
            boundary: 'One declared GET is held for status/menu geometry only. Production polling is unchanged; these stable frames do not prove refresh behavior.' };
        for (const status of statuses) {
            const row = page.locator('.session-outbox-item[data-status="' + status + '"]');
            await row.scrollIntoViewIfNeeded();
            await observe(page, state, 'outbox-status-' + status, ['#subscriptionQueuePanel', '.session-outbox-item[data-status="' + status + '"]'], { boundary: state.report.stableGeometryRead.boundary });
        }
        const menuTrigger = page.locator('.session-outbox-item').first().locator('[aria-controls]');
        await menuTrigger.press('Enter');
        await page.locator('.session-outbox-menu:popover-open').waitFor();
        await observe(page, state, 'outbox-native-menu-keyboard', ['.session-outbox-menu:popover-open', '.session-outbox-item:first-child'], { boundary: state.report.stableGeometryRead.boundary });
        await page.keyboard.press('Escape');
        await observe(page, state, 'outbox-native-menu-escape', ['.session-outbox-item:first-child'], { boundary: state.report.stableGeometryRead.boundary });
    } finally {
        if (control.held.length) {
            const response = page.waitForResponse(response => {
                const url = new URL(response.url());
                return response.request().method() === 'GET' && url.origin === state.baseUrl.origin
                    && url.pathname === state.api + 'outbox-sessions' && url.search === '?limit=20&offset=0';
            }, { timeout: 3000 });
            control.mode = 'ready'; control.release();
            await (await response).finished();
        }
        await geometryRead;
        await painted(page);
        if (state.report.stableGeometryRead) state.report.stableGeometryRead.releasedAndDrained = true;
    }
    const trigger = page.locator('.session-outbox-item').first().locator('[aria-controls]');
    await trigger.focus();
    const reads = control.reads;
    const before = await trigger.evaluate(node => { window.__themeAuditFocusedTrigger = node; return { connected: node.isConnected, focused: node === document.activeElement, name: node.getAttribute('aria-label') }; });
    await page.waitForFunction(() => document.visibilityState === 'visible');
    for (let attempt = 0; attempt < 130 && control.reads === reads; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(control.reads > reads, 'An actual five-second polling GET must occur.');
    await painted(page);
    const original = await page.evaluate(() => ({ connected: window.__themeAuditFocusedTrigger.isConnected, focused: window.__themeAuditFocusedTrigger === document.activeElement }));
    await observe(page, state, 'outbox-real-refresh-focused-trigger', ['#subscriptionQueuePanel'], { before, originalAfter: original, readBefore: reads, readAfter: control.reads,
        boundary: 'Observed actual polling/focus outcome. The existing detached-trigger failure is not accepted.' });
    if (state.phase === 'after') {
        const focus = await trigger.evaluate(node => { const r = node.getBoundingClientRect(), list = node.closest('#subscriptionQueueList').getBoundingClientRect();
            return { matches: node === document.activeElement, visible: r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= innerWidth && r.y >= Math.max(0, list.y) && r.bottom <= Math.min(innerHeight, list.bottom) }; });
        state.report.checks.push({ name: 'Actual five-second first trigger focus is retained and visible', ...focus });
        assert.ok(focus.matches && focus.visible, 'Actual polling must retain visible trigger focus.');
    }
    const title = page.locator('.session-outbox-item').first().locator('button.session-outbox-customer');
    await title.focus();
    await refresh(page);
    await observe(page, state, 'outbox-refresh-focused-customer-title', ['#subscriptionQueuePanel']);
    await title.focus();
    control.mode = 'held';
    const pending = refresh(page);
    for (let attempt = 0; attempt < 100 && !control.held.length; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(control.held.length, 1);
    await observe(page, state, 'outbox-refresh-held', ['#subscriptionQueuePanel'], { boundary: 'Source has no explicit loading indicator; held GET records actual retained presentation.' });
    await page.locator('#agentProfileTrigger').focus();
    control.mode = 'ready'; control.release(); await pending;
    await observe(page, state, 'outbox-refresh-focus-moved-outside', ['#subscriptionQueuePanel', '#agentProfileTrigger'], { boundary: 'The user moved focus outside while GET was pending; record whether refresh steals it.' });
    await title.focus();
    const originalItems = control.items;
    control.items = control.items.map((item, index) => index ? item : { ...item, capabilities: { edit: false, pause: false, resume: false, delete: false } });
    await refresh(page);
    await observe(page, state, 'outbox-refresh-focused-capability-removed', ['#subscriptionQueuePanel']);
    control.items = originalItems; await refresh(page);
    await trigger.focus();
    control.items = control.items.slice(1); await refresh(page);
    await observe(page, state, 'outbox-refresh-focused-item-removed', ['#subscriptionQueuePanel']);
    control.items = originalItems; await refresh(page);
    control.mode = 'error'; await refresh(page);
    await observe(page, state, 'outbox-refresh-stale-error', ['#subscriptionQueuePanel']);
    control.mode = 'empty'; await refresh(page);
    await observe(page, state, 'outbox-empty-after-recovery', ['#subscriptionQueuePanel']);
    control.mode = 'ready'; await refresh(page);
    await observe(page, state, 'outbox-restored', ['#subscriptionQueuePanel']);
    await page.evaluate(async customer => { await window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer }); }, fixtureCustomer(state.phase));
    const saved = { ...control.items[1], customerReference: control.items[0].customerReference, summary: { customer: longName, changeCount: 1 } };
    await page.evaluate(item => {
        window.kiwiOutbox.acceptWrite('POST', '/api/v1/persons/990901/contact-history', item.changes[0].arguments[1], { outbox: item });
    }, saved);
    await page.locator('#customerSessionChanges').waitFor({ state: 'visible' });
    await page.locator('#customerSessionChanges > summary').press('Enter');
    await page.locator('#sessionOutboxChanges').scrollIntoViewIfNeeded();
    await observe(page, state, 'outbox-actual-changes-controller', ['#customerSessionChanges'], { boundary: 'Direct installed acceptWrite with explicitly synthetic response; no network write, reopen or server/persistence success claim. Starts clean; unsaved protection not exercised.' });
    await page.locator('#sessionOutboxChanges button').first().press('Enter');
    await page.locator('#sessionOutboxEditor').waitFor({ state: 'visible' });
    await observe(page, state, 'outbox-native-editor', state.phase === 'after' ? ['#sessionOutboxEditor', '#sessionOutboxEditor .card'] : ['#sessionOutboxEditor']);
    await page.keyboard.press('Escape');
    await observe(page, state, 'outbox-native-editor-escape', ['#sessionOutboxEditor', '#customerSessionChanges']);
}

async function measureAsyncOutboxFocus(page, expectedSelector) {
    await painted(page);
    return page.evaluate(selector => {
        const active = document.activeElement, rect = active.getBoundingClientRect(), style = getComputedStyle(active);
        const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        for (let parent = active.parentElement; parent; parent = parent.parentElement) {
            const bounds = parent.getBoundingClientRect(), css = getComputedStyle(parent);
            if (/hidden|clip|auto|scroll/.test(css.overflowX)) {
                clip.left = Math.max(clip.left, bounds.left + parent.clientLeft);
                clip.right = Math.min(clip.right, bounds.left + parent.clientLeft + parent.clientWidth);
            }
            if (/hidden|clip|auto|scroll/.test(css.overflowY)) {
                clip.top = Math.max(clip.top, bounds.top + parent.clientTop);
                clip.bottom = Math.min(clip.bottom, bounds.top + parent.clientTop + parent.clientHeight);
            }
        }
        const focusVisible = active.matches(':focus-visible');
        const extent = focusVisible ? Math.max(0, Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset)) : 0;
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { expectedOwnsFocus: active === document.querySelector(selector), focusVisible,
            outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset,
            bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, clip,
            fullPaintedPerimeterInsideAllClips: rect.width > 0 && rect.height > 0
                && rect.left - extent >= clip.left && rect.top - extent >= clip.top
                && rect.right + extent <= clip.right && rect.bottom + extent <= clip.bottom,
            pointerTarget: active === hit || active.contains(hit),
            scrollY, listScrollTop: document.querySelector('#subscriptionQueueList').scrollTop };
    }, expectedSelector);
}

async function inspectAsyncOutbox(page, state, control) {
    const row = index => '#subscriptionQueueList > .session-outbox-item:nth-child(' + index + ')';
    const secondTitle = row(2) + ' [data-outbox-control="customer"]';
    const secondTrigger = row(2) + ' [data-outbox-control="actions"]';
    const originalItems = structuredClone(control.items);
    const disabledCapabilities = { edit: false, pause: false, resume: false, delete: false };
    const reachable = focus => focus.expectedOwnsFocus && focus.focusVisible
        && focus.fullPaintedPerimeterInsideAllClips && focus.pointerTarget;
    const capture = async (name, detail, passed) => {
        await observe(page, state, 'async-' + name, ['#subscriptionQueuePanel', '#sessionOutboxEditor'], detail);
        state.report.checks.push({ name: 'Async outbox ' + name, passed });
        await save(state);
        assert.ok(passed, 'Async outbox ' + name + ' must preserve the actual focused target, visible perimeter and declared state.');
    };
    const focusWithKeyboard = async selector => {
        await page.locator(selector).focus();
        await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        return measureAsyncOutboxFocus(page, selector);
    };
    const waitForPoll = async () => {
        const before = control.reads;
        for (let attempt = 0; attempt < 160 && control.reads === before; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
        assert.ok(control.reads > before, 'The actual five-second interval must consume a fresh exact GET.');
        await page.waitForFunction(() => document.querySelector('#subscriptionQueueList').getAttribute('aria-busy') === 'false');
        return { before, after: control.reads, boundary: 'Real installed five-second timer; no manual refresh or timer replacement.' };
    };
    const mapProbe = expected => page.evaluate(({ expected, reference }) => {
        const headers = window.kiwiOutbox.prepareWrite('POST', '/api/v1/persons/990901/contact-history',
            { type: 'call_disposition', description: 'Synthetic asynchronous probe' }, { customerReference: reference });
        return { membershipMatches: expected ? headers['X-Kiwi-Outbox-Id'] === String(expected.id) : !Object.hasOwn(headers, 'X-Kiwi-Outbox-Id'),
            revisionMatches: expected ? headers['X-Kiwi-Outbox-Revision'] === String(expected.revision) : !Object.hasOwn(headers, 'X-Kiwi-Outbox-Revision'),
            hasIdempotency: typeof headers['Idempotency-Key'] === 'string' && headers['Idempotency-Key'].length > 0,
            boundary: 'Pure installed prepareWrite only; evidence contains booleans, no header or idempotency values and no network request.' };
    }, { expected, reference: originalItems[0].customerReference });
    const correctMap = probe => probe.membershipMatches && probe.revisionMatches && probe.hasIdempotency;

    control.mode = 'ready'; control.release();
    await page.locator('[data-action="toggle-subscription-queue-info"]').press('Enter');
    await page.waitForFunction(() => document.querySelector('#subscriptionQueueList').getAttribute('aria-busy') === 'false');
    await refresh(page);
    for (const [name, selector] of [['second-trigger', secondTrigger], ['second-title', secondTitle]]) {
        const before = await focusWithKeyboard(selector);
        await capture(name + '-before-poll', { focus: before }, reachable(before));
        const read = await waitForPoll(), after = await measureAsyncOutboxFocus(page, selector);
        await capture(name + '-after-poll', { before, focus: after, read }, reachable(after)
            && before.scrollY === after.scrollY && before.listScrollTop === after.listScrollTop);
    }

    control.mode = 'held';
    const pending = refresh(page);
    for (let attempt = 0; attempt < 100 && !control.held.length; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(control.held.length, 1, 'The exact GET must actually be held before focus moves.');
    const outsideBefore = await focusWithKeyboard('#agentProfileTrigger');
    control.mode = 'ready'; control.release(); await pending;
    const outsideAfter = await measureAsyncOutboxFocus(page, '#agentProfileTrigger');
    await capture('pending-user-moved-outside', { before: outsideBefore, focus: outsideAfter }, reachable(outsideAfter)
        && outsideBefore.scrollY === outsideAfter.scrollY && outsideBefore.listScrollTop === outsideAfter.listScrollTop);

    await focusWithKeyboard(secondTitle);
    control.items = control.items.map((item, index) => index === 1 ? { ...item, capabilities: disabledCapabilities } : item);
    await refresh(page);
    const removedCapability = await measureAsyncOutboxFocus(page, row(2));
    await capture('capability-removed-row', { focus: removedCapability }, reachable(removedCapability));
    control.items = control.items.filter((item, index) => index !== 1); await refresh(page);
    const removedRow = await measureAsyncOutboxFocus(page, row(2));
    await capture('item-removed-surviving-row', { focus: removedRow }, reachable(removedRow));
    control.items = []; await refresh(page);
    const empty = await measureAsyncOutboxFocus(page, '#sessionOutboxTitle');
    await capture('removed-all-empty-heading', { focus: empty }, reachable(empty));

    const menuItem = { ...originalItems[0], status: 'paused' };
    control.items = structuredClone(originalItems); control.items[0] = menuItem; await refresh(page);
    const firstTrigger = row(1) + ' [data-outbox-control="actions"]';
    await focusWithKeyboard(firstTrigger); await page.keyboard.press('Enter');
    await page.locator('.session-outbox-menu:popover-open').waitFor({ state: 'visible' });
    await page.evaluate(() => { window.__themeAuditAsyncMenu = document.querySelector('.session-outbox-menu:popover-open');
        window.__themeAuditAsyncMenuFocus = document.activeElement; });
    const beforeMap = await mapProbe(menuItem);
    await capture('open-menu-before-read', { map: beforeMap,
        boundary: 'Explicit paused first-session read fixture avoids depending on a pending deadline while testing membership; no pause action or write.' }, correctMap(beforeMap));
    control.items = []; await refresh(page);
    const menu = await page.evaluate(() => ({ sameMenu: window.__themeAuditAsyncMenu === document.querySelector('.session-outbox-menu:popover-open'),
        sameFocusedNode: window.__themeAuditAsyncMenuFocus === document.activeElement,
        focusedInsideMenu: window.__themeAuditAsyncMenu.contains(document.activeElement), rowCount: document.querySelector('#subscriptionQueueList').children.length }));
    const duringMap = await mapProbe(menuItem);
    await capture('open-menu-read-preserves-map', { menu, map: duringMap }, menu.sameMenu && menu.sameFocusedNode
        && menu.focusedInsideMenu && menu.rowCount === originalItems.length && correctMap(duringMap));
    await page.keyboard.press('Escape'); await refresh(page);
    const clearedMap = await mapProbe(null);
    await capture('closed-menu-read-clears-map', { map: clearedMap }, correctMap(clearedMap)
        && await page.locator('#subscriptionQueueList > .session-outbox-item').count() === 0);
    const latest = { ...originalItems[0], id: 991910, revision: 31, status: 'paused' };
    control.items = [latest, originalItems[0]]; await refresh(page);
    const latestMap = await mapProbe(latest);
    await capture('latest-session-revision-map', { map: latestMap }, correctMap(latestMap));

    const saved = { ...originalItems[1], id: 992910, revision: 7, customerReference: originalItems[0].customerReference,
        summary: { customer: 'Synthetic asynchronous customer', changeCount: 1 },
        changes: [{ id: 'synthetic-async-contact-change', operation: 'createContactHistoryEntry',
            arguments: [fixtureId, { type: 'call_disposition', description: 'Synthetic retained note' }] }] };
    control.items = [saved]; await refresh(page);
    await page.evaluate(async customer => window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer }), fixtureCustomer('after'));
    await page.evaluate(item => window.kiwiOutbox.acceptWrite('POST', '/api/v1/persons/990901/contact-history',
        item.changes[0].arguments[1], { outbox: item }), saved);
    await page.waitForFunction(() => document.querySelector('#subscriptionQueueList').getAttribute('aria-busy') === 'false');
    await page.locator('#customerSessionChanges > summary').press('Enter');
    await page.locator('#sessionOutboxChanges button').first().press('Enter');
    const input = page.locator('#sessionOutboxEditor').getByLabel('Omschrijving', { exact: true });
    await input.fill('Retained synthetic asynchronous input');
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    await input.evaluate(node => { window.__themeAuditAsyncDraft = node; });
    const draftBefore = await measureAsyncOutboxFocus(page, '#sessionOutboxEditorFields label:last-child input');
    const draftMap = await mapProbe(saved);
    await capture('dirty-native-editor-before-poll', { focus: draftBefore, map: draftMap,
        boundary: 'Installed acceptWrite with an explicit synthetic response, then actual generic native editor input; no submission or network business write.' }, reachable(draftBefore) && correctMap(draftMap));
    control.items = [{ ...saved, revision: 99, capabilities: disabledCapabilities }];
    const dirtyRead = await waitForPoll();
    const draftAfter = await measureAsyncOutboxFocus(page, '#sessionOutboxEditorFields label:last-child input');
    const draft = await page.evaluate(() => ({ sameNode: window.__themeAuditAsyncDraft === document.querySelector('#sessionOutboxEditorFields label:last-child input'),
        retainsValue: window.__themeAuditAsyncDraft.value === 'Retained synthetic asynchronous input',
        ownsFocus: window.__themeAuditAsyncDraft === document.activeElement,
        nativeModal: document.querySelector('#sessionOutboxEditor').matches(':modal') }));
    const retainedMap = await mapProbe(saved);
    await capture('dirty-native-editor-after-poll', { focus: draftAfter, draft, map: retainedMap, read: dirtyRead }, reachable(draftAfter)
        && draft.sameNode && draft.retainsValue && draft.ownsFocus && draft.nativeModal && correctMap(retainedMap));
    await page.keyboard.press('Escape');
    assert.equal(state.report.localCallWrites.length, 0);
    assert.equal(state.report.recordMutations.length, 0);
}

export function remainingOperationalGatePlan(browser) {
    assert.ok(['chromium', 'firefox'].includes(browser));
    return [
        { suite: 'coarse-touch', browser, viewport: { width: 390, height: 320 },
            context: { hasTouch: true, reducedMotion: 'reduce', locale: 'nl-NL' }, role: 'kiwi-admin',
            expectedMedia: { coarse: true, hoverNone: true },
            boundary: '44px onlyactualoutboxiconbuttons; ordinaryactions/recordbuttons keep40px reference.' },
        { suite: 'motion-no-preference', browser, viewport: { width: 1440, height: 1000 },
            context: { hasTouch: false, reducedMotion: 'no-preference', locale: 'nl-NL' }, role: 'kiwi-admin' },
        { suite: 'locale-en', browser, viewport: { width: 1440, height: 1000 },
            context: { hasTouch: false, reducedMotion: 'reduce', locale: 'en-GB' }, role: 'kiwi-admin',
            boundary: 'Actualnativeprofile EN thenNL; newrecordlabels/actions/unknownvalidity translated, legacyuntranslatedstrings recorded ratherthan claimedEnglish.' },
        { suite: 'actual-view', browser, viewport: { width: 1440, height: 1000 },
            context: { hasTouch: false, reducedMotion: 'reduce', locale: 'nl-NL' }, role: 'kiwi-view',
            expectedSsrRole: 'KIWI view',
            boundary: 'Actualnativeviewlogin+SSRprofile/feedbackaffordances, separatefromsyntheticdisabledDTOcapabilities; no serverwrite-policyclaim.' }
    ];
}

export function nativeViewLoginExpectation(snapshot) {
    if (!snapshot || typeof snapshot.submitterDisabled !== 'boolean' || !Array.isArray(snapshot.entries)) return null;
    const pairsAreStrings = snapshot.entries.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(value => typeof value === 'string'));
    if (!pairsAreStrings) return null;
    const fields = new URLSearchParams(snapshot.entries);
    const exactUsername = fields.getAll('username').length === 1 && fields.get('username') === 'kiwi-view';
    const exactPassword = fields.getAll('password').length === 1 && fields.get('password') === 'kiwi-local-dev-password';
    if (!exactUsername || !exactPassword) return null;
    return [...fields.entries()].sort();
}

export function nativeZoomRatiosMatch(browser, before, zoomed) {
    assert.ok(['chromium', 'firefox'].includes(browser));
    const normalizedOuter = geometry => browser === 'firefox' ? geometry.outerWidth * geometry.dpr : geometry.outerWidth;
    const normalizedHeight = geometry => browser === 'firefox' ? geometry.outerHeight * geometry.dpr : geometry.outerHeight;
    return Math.abs(zoomed.dpr / before.dpr - 2) < 0.03
        && Math.abs(zoomed.innerWidth / before.innerWidth - 0.5) < 0.03
        && Math.abs(zoomed.innerHeight / before.innerHeight - 0.5) < 0.03
        && Math.abs(normalizedOuter(zoomed) - normalizedOuter(before)) <= 2
        && Math.abs(normalizedHeight(zoomed) - normalizedHeight(before)) <= 2
        && Math.abs(zoomed.pinchScale - 1) < 0.01;
}

export function createNativeOperationalKernel(browser, evidenceDir, report) {
    assert.ok(['chromium', 'firefox'].includes(browser));
    const displayName = browser === 'chromium' ? ':95' : ':96';
    const launchEnvironment = { ...process.env, DISPLAY: displayName, MOZ_ENABLE_WAYLAND: '0', GDK_BACKEND: 'x11', WAYLAND_DISPLAY: '' };
    const sha256 = value => createHash('sha256').update(value).digest('hex');
    let displayProcess = null;
    report.captures ||= [];
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

    return {
        launchEnvironment,
        async start() {
            assert.equal(displayProcess, null);
            assert.equal(canOpenDisplay(displayName), false, 'The fixed dedicated native display must be unused.');
            displayProcess = spawn('/usr/bin/Xvfb', [displayName, '-screen', '0', '1600x1200x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'ignore', 'ignore'] });
            for (let attempt = 0; attempt < 50 && !canOpenDisplay(displayName); attempt++) await new Promise(resolve => setTimeout(resolve, 100));
            assert.ok(canOpenDisplay(displayName), 'The owned Xvfb display must become available.');
        },
        zoomIn() { sendNativeZoomKey(); },
        resetZoom() { sendNativeZoomKey(true); },
        dismissBrowserPopup: dismissNativeBrowserPopup,
        waitForHeaderUncovered: waitForNativeHeaderUncovered,
        async captureWholeDesktop(filename) {
            assert.match(filename, /^[A-Za-z0-9+-]+\.png$/);
            const file = path.join(evidenceDir, filename);
            execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-video_size', '1600x1200', '-i', displayName,
                '-frames:v', '1', '-update', '1', file], { env: launchEnvironment });
            return { filename, captureMethod: 'Actual1600x1200wholeX11desktop, no crop or protocolzoom substitution.' };
        },
        close() { displayProcess?.kill('SIGTERM'); displayProcess = null; }
    };
}

async function measureCoarseOutboxMenu(page) {
    return page.evaluate(() => {
        const menu = document.querySelector('.session-outbox-menu:popover-open');
        if (!menu) throw new Error('Actual source popover must remain open during the diagnostic.');
        const rect = node => { const bounds = node.getBoundingClientRect(); return { left: bounds.left, top: bounds.top,
            right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height }; };
        const inspect = node => {
            const bounds = rect(node), css = getComputedStyle(node), focused = document.activeElement === node;
            const focusVisible = node.matches(':focus-visible');
            const extent = focusVisible ? Math.max(0, parseFloat(css.outlineWidth) + parseFloat(css.outlineOffset)) : 0;
            const perimeter = { left: bounds.left - extent, top: bounds.top - extent, right: bounds.right + extent, bottom: bounds.bottom + extent };
            const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, ancestors = [];
            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                if (node === menu) break; // A native top-layer popover is not clipped by the underlying list.
                const box = rect(parent), style = getComputedStyle(parent);
                const clipsX = /hidden|clip|auto|scroll/.test(style.overflowX), clipsY = /hidden|clip|auto|scroll/.test(style.overflowY);
                if (!clipsX && !clipsY) continue;
                ancestors.push({ tag: parent.tagName, className: parent.className, bounds: box,
                    overflowX: style.overflowX, overflowY: style.overflowY, scrollTop: parent.scrollTop, scrollHeight: parent.scrollHeight, clientHeight: parent.clientHeight });
                if (clipsX) { clip.left = Math.max(clip.left, box.left + parent.clientLeft); clip.right = Math.min(clip.right, box.left + parent.clientLeft + parent.clientWidth); }
                if (clipsY) { clip.top = Math.max(clip.top, box.top + parent.clientTop); clip.bottom = Math.min(clip.bottom, box.top + parent.clientTop + parent.clientHeight); }
                if (parent === menu) break;
            }
            const inside = box => box.left >= clip.left && box.top >= clip.top && box.right <= clip.right && box.bottom <= clip.bottom;
            const hits = [bounds.top + 1, bounds.top + bounds.height / 2, bounds.bottom - 1].map(y => {
                const x = bounds.left + bounds.width / 2, hit = document.elementFromPoint(x, y);
                return { x, y, ownTarget: Boolean(hit && (node === hit || node.contains(hit))) };
            });
            return { text: node.textContent.trim(), focused, focusVisible, bounds, outlineWidth: css.outlineWidth,
                outlineOffset: css.outlineOffset, paintedPerimeter: focusVisible ? perimeter : null, clip, ancestors,
                fullBorderInsideAllClips: inside(bounds), fullPaintedPerimeterInsideAllClips: inside(perimeter), hits };
        };
        const actions = [...menu.querySelectorAll('button')], trigger = document.querySelector('.session-outbox-item:first-child [data-outbox-control=actions]');
        return { viewport: { width: innerWidth, height: innerHeight }, scrollX, scrollY,
            menu: inspect(menu), actions: actions.map(inspect), trigger: inspect(trigger),
            menuScrollTop: menu.scrollTop, menuScrollHeight: menu.scrollHeight, menuClientHeight: menu.clientHeight,
            availableAboveTrigger: rect(trigger).top, availableBelowTrigger: innerHeight - rect(trigger).bottom,
            active: { tag: document.activeElement.tagName, text: document.activeElement.textContent.trim(),
                menuActionIndex: actions.indexOf(document.activeElement), trigger: document.activeElement === trigger },
            input: { coarse: matchMedia('(pointer:coarse)').matches, touchPoints: navigator.maxTouchPoints } };
    });
}

export function coarseMenuGeometryUnchanged(before, after) {
    return stable(before) === stable(after);
}

export function coarseMenuTargetsAreClear(geometry, expectedFocusIndex = -1) {
    if (!geometry.menu.fullBorderInsideAllClips || geometry.actions.length !== 3) return false;
    const actionsClear = geometry.actions.every(action => action.bounds.width >= 44 && action.bounds.height >= 44
        && action.fullBorderInsideAllClips && action.fullPaintedPerimeterInsideAllClips && action.hits.length === 3
        && action.hits.every(hit => hit.ownTarget));
    if (!actionsClear) return false;
    if (expectedFocusIndex === -1) return geometry.active.trigger;
    const focused = geometry.actions[expectedFocusIndex];
    return geometry.active.menuActionIndex === expectedFocusIndex && focused.focused && focused.focusVisible
        && focused.outlineWidth === '3px' && focused.outlineOffset === '2px';
}

async function inspectCoarseOutboxMenuDiagnostic(page, state, control, { requireContainment = false } = {}) {
    await inspectCompactCall(page, state, control, { touch: true });
    control.mode = 'ready'; control.release();
    await page.locator('[data-action="toggle-subscription-queue-info"]').tap(); await refresh(page);
    await page.locator('.session-outbox-item').first().locator('[data-outbox-control=actions]').tap();
    const menu = page.locator('.session-outbox-menu:popover-open'); await menu.waitFor({ state: 'visible' });
    state.report.coarseMenuDiagnostic = { stages: [], acceptance: false, requireContainment,
        boundary: 'Same source coarse call→closed ACW→outbox lifecycle as the actual finding. Only genuine native keys and one real wheel event; no menu command activation, forced scroll/focus, CSS or timer changes.' };
    const capture = async (stage, expectedFocusIndex = -1) => {
        const started = Date.now(); let geometry = await measureCoarseOutboxMenu(page), stableSince = Date.now();
        while (Date.now() - stableSince < 180 && Date.now() - started < 2000) {
            await new Promise(resolve => setTimeout(resolve, 40));
            const next = await measureCoarseOutboxMenu(page);
            if (!coarseMenuGeometryUnchanged(geometry, next)) stableSince = Date.now();
            geometry = next;
        }
        const stableForMs = Date.now() - stableSince;
        await observe(page, state, 'coarse-menu-' + stage, ['.session-outbox-menu:popover-open', ':focus'], { geometry, stableForMs });
        const after = await measureCoarseOutboxMenu(page), unchanged = coarseMenuGeometryUnchanged(geometry, after);
        state.report.coarseMenuDiagnostic.stages.push({ stage, geometry, afterImageGeometry: after, stableForMs, screenshotGeometryEqual: unchanged });
        await save(state);
        assert.ok(stableForMs >= 180 && unchanged, 'Natural menu geometry must settle and match its whole image; no manual repair.');
        assert.equal(geometry.actions.length, 3);
        assert.deepEqual(geometry.actions.map(action => action.text), ['Bewerken', 'Pauzeren', 'Verwijderen']);
        if (requireContainment) {
            const passed = coarseMenuTargetsAreClear(geometry, expectedFocusIndex);
            state.report.checks.push({ name: 'Corrected menu keeps all complete44px actions, actual3/+2 keyboard rings and own hits inside all clips', stage, passed });
            await save(state);
            assert.ok(passed, 'Initial and every native menu stage must retain complete targets and actual painted rings before proceeding.');
        }
        return geometry;
    };
    await capture('initial');
    for (const [index, key] of ['Tab', 'Tab', 'Tab', 'Shift+Tab'].entries()) {
        await page.keyboard.press(key); await capture('native-' + (index + 1) + '-' + key, [0, 1, 2, 1][index]);
    }
    const bounds = await menu.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, Math.min(state.viewport.height - 8, bounds.y + bounds.height / 2));
    await page.mouse.wheel(0, 180); await capture('real-wheel180', 1);
    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' });
    assert.equal(state.report.localCallWrites.length, 6, 'Only the existing exact six locally fulfilled call/status requests are used.');
    assert.equal(state.report.recordMutations.length, 0);
}

async function inspectCompactCall(page, state, control, { touch = false, waitForToastExpiry = false } = {}) {
    const captureCall = async (name, selectors, detail = {}) => {
        await painted(page);
        const sentinel = await measureShortCallState(page, false);
        await observe(page, state, name, selectors, { ...detail, sentinel });
        const pointerGeometry = sentinel.controls.length === 3 && sentinel.controls.every(node => node.fullControlAndFocusInsideAllClips
            && node.naturalPointerTarget && !node.overlapsToast && !node.focusPerimeterOverlapsToast);
        const passed = pointerGeometry && (touch || shortCallControlsAreReachable(sentinel.controls));
        state.report.checks.push({ name: 'Profile recording and essential actions retain unobscured actual input-phase focus geometry', state: name, passed,
            boundary: touch ? 'Actual coarse touch/painted geometry; no unpainted keyboard ring required.' : 'Genuine native keyboard focus and full painted perimeter required.' });
        await save(state); assert.ok(passed, 'Actual REC/hold/end targets and any painted focus must remain fully reachable.');
    };
    await page.evaluate(name => {
        window.callQueue = { enabled: true, queue: [{ id: 'synthetic-profile-queue', callerType: 'anonymous', customerId: null,
            customerName: name, serviceNumber: 'SYNTHETIC', waitTime: 187 }], currentPosition: 0, autoAdvance: true, waitTimeInterval: null };
        window.kiwiCallAgentRuntime.updateQueueDisplay();
    }, longName);
    await observe(page, state, 'profile-queue-long', ['#queueInfo'], { boundary: 'Independent actual source queue renderer fixture; finished before active call, no queue-to-call continuity or persistence claim.' });
    await page.evaluate(finishOperationalQueueFixture);
    await startCall(page, state, control, {});
    if (!touch) { await page.locator('#holdCallBtn').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); }
    await captureCall('profile-call-recording', ['#sessionInfo', '#recordingIndicator', ':focus']);
    const held = await page.evaluate(() => { const value = { ...window.callSession, onHold: true, holdStartTime: Date.now() }; delete value.durationInterval; return value; });
    control.gate.arm('POST', state.api + 'call-session/hold', {}, held);
    const started = Date.now();
    if (touch) await page.locator('#holdCallBtn').tap(); else await page.locator('#holdCallBtn').press('Enter');
    await flushCalls(page, control);
    await page.waitForFunction(() => {
        const toast = document.querySelector('#toast');
        return toast.classList.contains('show') && toast.textContent.trim() === 'Gesprek in wacht gezet';
    }, null, { timeout: 2000 });
    const toast = await page.locator('#toast').evaluate(node => ({ text: node.textContent.trim(), shown: node.classList.contains('show'),
        transitionDuration: getComputedStyle(node).transitionDuration, animationDuration: getComputedStyle(node).animationDuration }));
    await captureCall('profile-call-held-authentic-toast', ['#sessionInfo', '#recordingIndicator', '#holdIndicator', '#toast', ':focus'], { toast });
    assert.equal(toast.text, 'Gesprek in wacht gezet'); assert.equal(toast.shown, true);
    if (waitForToastExpiry) {
        await page.waitForFunction(() => { const node = document.querySelector('#toast'), r = node.getBoundingClientRect(), css = getComputedStyle(node);
            return !node.classList.contains('show') && (r.top >= innerHeight || r.bottom <= 0 || css.opacity === '0' || css.visibility === 'hidden'); }, null, { timeout: 5000 });
        const elapsedMs = Date.now() - started;
        await observe(page, state, 'profile-toast-natural-expiry', ['#toast', '#sessionInfo'], { elapsedMs,
            boundary: 'Original source timeout/transition observed naturally, no timer, message, CSS or animation override.' });
        assert.ok(elapsedMs >= 2500 && elapsedMs <= 5000);
    }
    const resumed = { ...held, onHold: false, holdStartTime: null, totalHoldTime: 12 };
    control.gate.arm('POST', state.api + 'call-session/resume', {}, resumed);
    if (touch) await page.locator('#holdCallBtn').tap(); else await page.locator('#holdCallBtn').press('Enter');
    await flushCalls(page, control);
    await captureCall('profile-call-resumed', ['#sessionInfo', '#recordingIndicator', '#toast', ':focus']);
    const lastCall = await page.evaluate(() => ({ customerId: null, customerName: null, serviceNumber: window.callSession.serviceNumber,
        startTime: window.callSession.startTime, callDuration: Math.floor((Date.now() - window.callSession.startTime) / 1000), waitTime: window.callSession.waitTime, totalHoldTime: window.callSession.totalHoldTime }));
    control.gate.arm('POST', state.api + 'call-session/end', { forcedByCustomer: false }, { last_call_session: lastCall, call_session: idleSession() });
    control.gate.arm('POST', state.api + 'agent-status', { status: 'ready' }, { status: 'ready', teams_sync: null });
    if (touch) await page.locator('#endCallBtn').tap(); else await page.locator('#endCallBtn').press('Enter');
    await flushCalls(page, control);
    await page.locator('#dispositionModal').waitFor({ state: 'visible' });
    await observe(page, state, 'profile-call-acw-cancel', ['#dispositionModal', '#dispositionModal .modal-actions']);
    await page.locator('#dispositionModal .modal-actions [data-action="disposition.cancel"]').press('Enter');
    await page.locator('#dispositionModal').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => { const node = document.querySelector('#toast'), r = node.getBoundingClientRect(), css = getComputedStyle(node);
        return !node.classList.contains('show') && (r.top >= innerHeight || r.bottom <= 0 || css.opacity === '0' || css.visibility === 'hidden'); }, null, { timeout: 5000 });
}

async function inspectProfileOutboxMenu(page, state, control, touch = false) {
    control.mode = 'ready'; control.release();
    const toggle = page.locator('[data-action="toggle-subscription-queue-info"]');
    if (touch) await toggle.tap(); else await toggle.press('Enter');
    await refresh(page);
    const trigger = page.locator('.session-outbox-item').first().locator('[data-outbox-control=actions]');
    if (touch) await trigger.tap(); else await trigger.press('Enter');
    const menu = page.locator('.session-outbox-menu:popover-open');
    await menu.waitFor({ state: 'visible' });
    const targets = await page.locator('.session-outbox-item:first-child .session-outbox-icon-button').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { width: r.width, height: r.height, text: node.getAttribute('aria-label') }; }));
    const coarseGeometry = touch ? await measureCoarseOutboxMenu(page) : null;
    await observe(page, state, 'profile-outbox-native-menu', ['.session-outbox-menu:popover-open', '.session-outbox-item:first-child'], { targets, coarseGeometry,
        boundary: touch ? 'Actual touch tap, coarse icon-button44px only; no menu action or business request.' : 'Actual native Enter opens source popover, no action request.' });
    if (touch) {
        const afterImageGeometry = await measureCoarseOutboxMenu(page);
        const passed = targets.length > 0 && targets.every(target => target.width >= 44 && target.height >= 44)
            && coarseMenuGeometryUnchanged(coarseGeometry, afterImageGeometry) && coarseMenuTargetsAreClear(coarseGeometry);
        state.report.checks.push({ name: 'Actual coarse menu has full44px targets and own hits inside viewport with matching whole-image geometry', passed, afterImageGeometry });
        await save(state); assert.ok(passed, 'Coarse action size alone cannot establish full actual menu containment.');
    }
    await page.keyboard.press('Escape');
    await observe(page, state, 'profile-outbox-native-menu-escape', ['.session-outbox-item:first-child', ':focus']);
    await toggle.press('Enter');
}

async function inspectInputProfile(page, state, control, feedbackModule) {
    const profile = remainingOperationalGatePlan(state.report.environment.browser).find(item => item.suite === state.suite);
    assert.ok(profile, 'Only one declared input/locale/role profile may run in this context.');
    const media = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches,
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, noPreference: matchMedia('(prefers-reduced-motion: no-preference)').matches }));
    state.report.inputProfile = { suite: profile.suite, media, boundary: profile.boundary };
    if (state.suite === 'actual-view') {
        const roles = await page.locator('.profile-menu-role').allTextContents();
        const roleProof = { roles: roles.map(role => role.trim()), settingsAbsent: await page.locator('#contextualFeedbackSettingsButton').count() === 0,
            feedbackAbsent: await page.locator('#contextualFeedbackButton').count() === 0, nativeLoginRole: state.report.authentications[0]?.selectedRole };
        await page.locator('#agentProfileTrigger').press('Enter');
        await observe(page, state, 'actual-view-ssr-profile', ['.agent-profile-menu', '#agentProfileTrigger'], { roleProof,
            boundary: 'Actual fallback kiwi-view native authentication and server-rendered role/feedback affordances. No synthetic record capability or server write-policy acceptance.' });
        assert.deepEqual(roleProof.roles, ['KIWI view']); assert.equal(roleProof.nativeLoginRole, 'kiwi-view');
        assert.ok(roleProof.settingsAbsent && roleProof.feedbackAbsent);
        await page.keyboard.press('Escape');
        assert.equal(state.report.localCallWrites.length, 0); assert.equal(state.report.readonlySourceReads.length, 0);
        return;
    }
    const touch = state.suite === 'coarse-touch';
    if (touch) { assert.equal(media.coarse, true); assert.equal(media.hoverNone, true); }
    if (state.suite === 'motion-no-preference') { assert.equal(media.reduced, false); assert.equal(media.noPreference, true); }
    if (state.suite !== 'locale-en') {
        await inspectCompactCall(page, state, control, { touch, waitForToastExpiry: state.suite === 'motion-no-preference' });
        await inspectProfileOutboxMenu(page, state, control, touch);
    }
    if (state.suite === 'motion-no-preference') {
        await inspectOutboxEditorHeader(page, state, control);
        return;
    }
    if (state.suite === 'locale-en') {
        await page.locator('#agentProfileTrigger').click(); await page.locator('[data-locale-option=en]').click();
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    }
    await feedbackModule.inspectRecordListsAfter(page, state, { observe, control, touch,
        validityLabel: state.suite === 'locale-en' ? 'Validity unavailable' : 'Geldigheid niet beschikbaar' });
    const dialog = page.locator('.customer-editor[open]');
    if (state.suite === 'locale-en') {
        const headings = await dialog.locator('[data-customer-section] > h3').allTextContents();
        const person = dialog.locator('[data-customer-section=person]');
        await person.locator('input[name=salutation]').scrollIntoViewIfNeeded();
        const gender = await person.locator('input[name=salutation]').evaluate(node => ({ value: node.value,
            label: node.closest('label').childNodes[0].textContent.trim(), readOnly: node.readOnly,
            summary: node.closest('section').querySelector('.customer-editor-record-summary').textContent }));
        const newBankLabel = await dialog.locator('[data-customer-record-index=new]').innerText();
        const viewActions = await dialog.locator('.customer-editor-record-action[data-customer-record-index="0"]').evaluateAll(nodes => nodes.every(node => node.textContent.trim() === 'View'));
        await observe(page, state, 'locale-en-record-role-labels', ['.customer-editor[open]'], { headings,
            gender, newBankLabel, viewActions,
            boundary: 'Actual new record headings/actions/unknown-validity translated; existing Dutch editor labels and requested Geslacht/Man/Vrouw/Anders remain explicitly limited. Source raw phrase is unchanged; no whole-modal translation claim.' });
        assert.deepEqual(headings, ['Personal details', 'Address', 'Email', 'Landline', 'Mobile', 'Bank accounts']);
        assert.equal(newBankLabel, 'New bank account'); assert.equal(viewActions, true);
        assert.equal(gender.label, 'Geslacht'); assert.equal(gender.value, 'Man'); assert.equal(gender.readOnly, true);
        assert.ok(gender.summary.includes('Man') && !gender.summary.includes('Geachte heer'));
    }
    if (touch) await dialog.locator('.form-header .btn-close').tap(); else await dialog.locator('.form-header .btn-close').press('Enter');
    await dialog.waitFor({ state: 'hidden' });
    const selected = await page.evaluate(() => ({ person: window.kiwiCustomerWorkSession.getRequestContext().customerReference.personId === String(window.currentCustomer.personId),
        source: window.kiwiCustomerWorkSession.getRequestContext().customerReference.credentialKey === window.currentCustomer.credentialKey }));
    assert.ok(selected.person && selected.source);
    if (state.suite === 'locale-en') {
        await page.locator('#agentProfileTrigger').click(); await page.locator('[data-locale-option=nl]').click();
        assert.equal(await page.locator('html').getAttribute('lang'), 'nl');
        await observe(page, state, 'locale-en-native-reset-nl', ['#customerWorkSessionBar', '#customerDetail .customer-header'], { selected });
    }
    assert.equal(state.report.recordMutations.length, 0);
}

export function physicalClientPoint(windowBox, viewport, point) {
    for (const value of [windowBox.x, windowBox.y, windowBox.width, windowBox.height, viewport.innerWidth, viewport.innerHeight, viewport.dpr, point.x, point.y]) assert.ok(Number.isFinite(value));
    assert.equal(viewport.dpr, 2); assert.equal(viewport.pinchScale, 1);
    assert.ok(point.x >= 0 && point.x < viewport.innerWidth && point.y >= 0 && point.y < viewport.innerHeight);
    const borderWidth = windowBox.width - viewport.innerWidth * viewport.dpr;
    const chromeHeight = windowBox.height - viewport.innerHeight * viewport.dpr;
    assert.ok(borderWidth >= 0 && borderWidth <= 16 && chromeHeight > 0 && chromeHeight < 200);
    return { x: Math.round(windowBox.x + borderWidth / 2 + point.x * viewport.dpr),
        y: Math.round(windowBox.y + chromeHeight + point.y * viewport.dpr),
        origin: { x: windowBox.x + borderWidth / 2, y: windowBox.y + chromeHeight } };
}

function nativePointerComparison(kernel, action, parameters) {
    assert.ok(['query', 'move', 'click'].includes(action));
    const script = `import ctypes, json, sys, time
x = ctypes.CDLL('libX11.so.6'); t = ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.argtypes=[ctypes.c_char_p]; x.XOpenDisplay.restype=ctypes.c_void_p
x.XDefaultRootWindow.argtypes=[ctypes.c_void_p]; x.XDefaultRootWindow.restype=ctypes.c_ulong
x.XQueryTree.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.POINTER(ctypes.c_ulong),ctypes.POINTER(ctypes.c_ulong),ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)),ctypes.POINTER(ctypes.c_uint)]
x.XGetGeometry.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.POINTER(ctypes.c_ulong),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_uint),ctypes.POINTER(ctypes.c_uint),ctypes.POINTER(ctypes.c_uint),ctypes.POINTER(ctypes.c_uint)]
x.XTranslateCoordinates.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_ulong)]
x.XQueryPointer.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.POINTER(ctypes.c_ulong),ctypes.POINTER(ctypes.c_ulong),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(ctypes.c_uint)]
x.XFree.argtypes=[ctypes.c_void_p]; x.XFlush.argtypes=[ctypes.c_void_p]; x.XCloseDisplay.argtypes=[ctypes.c_void_p]
t.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
t.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
d=x.XOpenDisplay(None)
if not d: raise RuntimeError('Owned display unavailable')
try:
 mode=sys.argv[1]; p=json.loads(sys.argv[2]); root=x.XDefaultRootWindow(d)
 rr=ctypes.c_ulong(); parent=ctypes.c_ulong(); children=ctypes.POINTER(ctypes.c_ulong)(); count=ctypes.c_uint()
 if not x.XQueryTree(d,root,ctypes.byref(rr),ctypes.byref(parent),ctypes.byref(children),ctypes.byref(count)): raise RuntimeError('Window query failed')
 boxes=[]
 try:
  for index in range(count.value):
   win=children[index]; gx=ctypes.c_int(); gy=ctypes.c_int(); w=ctypes.c_uint(); h=ctypes.c_uint(); border=ctypes.c_uint(); depth=ctypes.c_uint()
   if not x.XGetGeometry(d,win,ctypes.byref(rr),ctypes.byref(gx),ctypes.byref(gy),ctypes.byref(w),ctypes.byref(h),ctypes.byref(border),ctypes.byref(depth)): continue
   if abs(w.value-p['expectedWidth'])>2 or abs(h.value-p['expectedHeight'])>2: continue
   child=ctypes.c_ulong(); sx=ctypes.c_int(); sy=ctypes.c_int()
   if not x.XTranslateCoordinates(d,win,root,0,0,ctypes.byref(sx),ctypes.byref(sy),ctypes.byref(child)): continue
   boxes.append({'windowId':win,'x':sx.value,'y':sy.value,'width':w.value,'height':h.value})
 finally:
  if children: x.XFree(children)
 if len(boxes)!=1: raise RuntimeError('Exactly one matching physical browser window is required')
 box=boxes[0]
 def pointer():
  child=ctypes.c_ulong(); rx=ctypes.c_int(); ry=ctypes.c_int(); wx=ctypes.c_int(); wy=ctypes.c_int(); mask=ctypes.c_uint()
  if not x.XQueryPointer(d,root,ctypes.byref(rr),ctypes.byref(child),ctypes.byref(rx),ctypes.byref(ry),ctypes.byref(wx),ctypes.byref(wy),ctypes.byref(mask)): raise RuntimeError('Pointer query failed')
  return {'x':rx.value,'y':ry.value}
 if mode!='query':
  px=int(p['point']['x']); py=int(p['point']['y'])
  if not (box['x']<=px<box['x']+box['width'] and box['y']<=py<box['y']+box['height']): raise RuntimeError('Physical point must stay inside owned browser')
  if mode=='move':
   t.XTestFakeMotionEvent(d,-1,px,py,0); x.XFlush(d); time.sleep(0.1)
  elif mode=='click':
   if pointer()!={'x':px,'y':py}: raise RuntimeError('Observed physical pointer changed before button press')
   t.XTestFakeButtonEvent(d,1,1,0); t.XTestFakeButtonEvent(d,1,0,0); x.XFlush(d); time.sleep(0.2)
 print(json.dumps({'action':mode,'window':box,'pointer':pointer()}))
finally: x.XCloseDisplay(d)
`;
    return JSON.parse(execFileSync('python3', ['-', action, JSON.stringify(parameters)], { input: script, env: kernel.launchEnvironment, encoding: 'utf8' }));
}

export function nativeReadonlyEditorOpeningAllowed(state, selector) {
    const proof = state.report?.nativeProof, fixture = state.recordFixture;
    if (state.phase !== 'after' || state.suite !== 'native-operational' || state.report?.requestedSuite !== 'native-operational'
        || state.report?.environment?.browser !== 'firefox' || state.report?.environment?.role !== 'kiwi-admin'
        || selector !== '#editCustomerBtn' || state.nativeKernel?.launchEnvironment?.DISPLAY !== ':96') return false;
    if (!proof?.before || !proof?.zoomed || proof.zoomed.innerWidth !== 640 || proof.zoomed.innerHeight !== 478
        || proof.zoomed.dpr !== 2 || proof.zoomed.pinchScale !== 1 || !nativeZoomRatiosMatch('firefox', proof.before, proof.zoomed)) return false;
    return fixture?.id === 990970 && fixture.recordCount === 2 && fixture.componentOnly === false && fixture.model?.version === null
        && Object.keys(fixture.model?.capabilities?.operations || {}).length === 8
        && ['person.update', 'address.update', 'email.update', 'phone.update', 'mobile.update', 'bank.update', 'bank.create', 'bank.delete']
            .every(operation => fixture.model.capabilities.operations[operation]?.enabled === false);
}

export function nativeReadonlyMotionOwnsTarget(event, point) {
    return event?.type === 'pointermove' && event.trusted === true && event.ownsExpectedTarget === true
        && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
        && Math.abs(event.clientX - point.x) < 1 && Math.abs(event.clientY - point.y) < 1;
}

async function openFirefoxNativeReadonlyEditor(page, state) {
    assert.ok(nativeReadonlyEditorOpeningAllowed(state, '#editCustomerBtn'));
    assert.equal(state.report.nativeReadonlyOpening, undefined, 'Only one explicit native readonly opening is allowed.');
    const result = state.report.nativeReadonlyOpening = { method: 'GenuineXTestphysicalpointer', selector: '#editCustomerBtn', physicalPressAttempts: 0, confirmedPhysicalPresses: 0 };
    const identity = await page.evaluateHandle(() => {
        const read = () => { const context = window.kiwiCustomerWorkSession.getRequestContext(), customer = window.currentCustomer;
            return JSON.stringify({ customer: [customer?.personId, customer?.credentialKey, customer?.sourceSystem], reference: context.customerReference,
                workflow: context.workflowSessionId, generation: context.contextGeneration }); };
        return { read, before: read() };
    });
    await page.evaluate(() => {
        window.__themeAuditReadonlyNativeTarget = document.querySelector('#editCustomerBtn');
        window.__themeAuditReadonlyNativeEvents = [];
        window.__themeAuditReadonlyNativeAbort = new AbortController();
        for (const type of ['pointermove', 'pointerdown', 'pointerup', 'click']) addEventListener(type, event => {
            const button = event.target.closest?.('button');
            window.__themeAuditReadonlyNativeEvents.push({ type, targetId: event.target.id,
                targetClass: typeof event.target.className === 'string' ? event.target.className : '', buttonId: button?.id || '',
                ownsExpectedTarget: Boolean(button && button === window.__themeAuditReadonlyNativeTarget), trusted: event.isTrusted,
                clientX: event.clientX, clientY: event.clientY, screenX: event.screenX, screenY: event.screenY });
        }, { capture: true, signal: window.__themeAuditReadonlyNativeAbort.signal });
    });
    const measure = () => page.evaluate(() => {
        const target = window.__themeAuditReadonlyNativeTarget, bounds = target.getBoundingClientRect();
        return { connected: target.isConnected, sameTarget: target === document.querySelector('#editCustomerBtn'),
            bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height },
            viewport: { innerWidth, innerHeight, outerWidth, outerHeight, dpr: devicePixelRatio, pinchScale: visualViewport?.scale }, scrollX, scrollY,
            hits: [bounds.top + 1, bounds.top + bounds.height / 2, bounds.bottom - 1].map(y => {
                const x = bounds.left + bounds.width / 2, hit = document.elementFromPoint(x, y);
                return { x, y, ownsExpectedTarget: Boolean(hit && (hit === target || target.contains(hit))), hitId: hit?.id || '' };
            }) };
    });
    try {
        let pre = await measure(), stableSince = Date.now(); const started = Date.now();
        while (Date.now() - stableSince < 180 && Date.now() - started < 2000) {
            await new Promise(resolve => setTimeout(resolve, 40)); const next = await measure();
            if (stable(pre) !== stable(next)) stableSince = Date.now(); pre = next;
        }
        assert.ok(Date.now() - stableSince >= 180 && pre.connected && pre.sameTarget && pre.hits.every(hit => hit.ownsExpectedTarget));
        assert.ok(pre.bounds.width >= 40 && pre.bounds.height >= 40 && pre.bounds.left >= 0 && pre.bounds.top >= 0
            && pre.bounds.right <= pre.viewport.innerWidth && pre.bounds.bottom <= pre.viewport.innerHeight);
        result.before = pre;
        await observe(page, state, 'native-readonly-opening-ready', ['#customerDetail .customer-header', '#editCustomerBtn'], { opening: result });
        assert.equal(stable(await measure()), stable(pre), 'Native target geometry must match its uncropped wholeOS image.');
        const parameters = { expectedWidth: pre.viewport.outerWidth * pre.viewport.dpr, expectedHeight: pre.viewport.outerHeight * pre.viewport.dpr };
        result.windowQuery = nativePointerComparison(state.nativeKernel, 'query', parameters);
        const point = { x: pre.bounds.left + pre.bounds.width / 2, y: pre.bounds.top + pre.bounds.height / 2 };
        result.physicalPoint = physicalClientPoint(result.windowQuery.window, pre.viewport, point);
        result.motion = nativePointerComparison(state.nativeKernel, 'move', { ...parameters, point: result.physicalPoint });
        await page.waitForFunction(() => window.__themeAuditReadonlyNativeEvents.some(event => event.type === 'pointermove'), null, { timeout: 1000 });
        result.motionEvents = await page.evaluate(() => window.__themeAuditReadonlyNativeEvents);
        const event = result.motionEvents.filter(event => event.type === 'pointermove').at(-1);
        await observe(page, state, 'native-readonly-opening-motion', ['#editCustomerBtn'], { opening: result });
        assert.ok(nativeReadonlyMotionOwnsTarget(event, point), 'Genuine physical motion must own the intended source target before any button press.');
        assert.equal(stable(await measure()), stable(pre), 'No scroll/layout/target change is allowed before native activation.');
        assert.equal(await identity.evaluate(value => value.before === value.read()), true);
        result.physicalPressAttempts = 1;
        result.click = nativePointerComparison(state.nativeKernel, 'click', { ...parameters, point: result.physicalPoint });
        result.confirmedPhysicalPresses = 1;
        await page.locator('.customer-editor[open] [data-customer-section=bank] .customer-editor-record-action').first().waitFor({ timeout: 2000 });
        result.clickEvents = await page.evaluate(() => window.__themeAuditReadonlyNativeEvents);
        assert.ok(result.clickEvents.some(event => event.type === 'click' && event.trusted && event.ownsExpectedTarget));
        result.sameCanonicalIdentity = await identity.evaluate(value => value.before === value.read()); assert.equal(result.sameCanonicalIdentity, true);
        await observe(page, state, 'native-readonly-opening-editor', ['.customer-editor[open]'], { opening: result });
    } finally {
        await page.evaluate(() => window.__themeAuditReadonlyNativeAbort?.abort()).catch(() => {});
        await identity.dispose();
    }
}

async function inspectNativeOperational(page, state, control, browser, referencePath, feedbackModule, nativeReport) {
    const kernel = state.nativeKernel;
    state.report.nativeKernel = nativeReport;
    const geometry = () => page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight,
        dpr: devicePixelRatio, pinchScale: visualViewport?.scale }));
    const identity = (remember = false) => page.evaluate(remember => {
        const context = window.kiwiCustomerWorkSession.getRequestContext(), customer = window.currentCustomer;
        const fingerprint = JSON.stringify({ selected: customer ? [customer.personId, customer.credentialKey, customer.sourceSystem] : null,
            reference: context.customerReference, workflow: context.workflowSessionId, generation: context.contextGeneration });
        if (remember) window.__themeAuditNativeIdentity = fingerprint;
        return { currentCustomer: Boolean(customer), sameStoredIdentity: fingerprint === window.__themeAuditNativeIdentity,
            personMatchesSession: !customer || String(customer.personId) === context.customerReference?.personId,
            activeCall: Boolean(window.callSession.active) };
    }, remember);
    await page.bringToFront(); kernel.resetZoom();
    const before = await geometry();
    let zoomed = before, increments = 0;
    while (zoomed.dpr < before.dpr * 1.99 && increments < 10) {
        kernel.zoomIn(); zoomed = await geometry(); increments++;
    }
    state.report.nativeProof = { before, zoomed, increments,
        boundary: 'ActualXTestOSbrowser shortcuts on ownedXvfb; noCSSzoom,CDPpinch or deviceScaleFactor emulation.' };
    assert.ok(nativeZoomRatiosMatch(state.report.environment.browser, before, zoomed));
    state.viewport = { width: zoomed.innerWidth, height: zoomed.innerHeight };
    state.report.environment.viewport = state.viewport; state.report.environment.zoom = 'VerifiedactualOS200percent';
    state.referenceContract = await feedbackModule.readAfterReference(browser, referencePath, path.join(state.evidenceDir, 'reference'), state.viewport);
    state.report.reference.computedContract = state.referenceContract;
    await page.bringToFront();
    assert.ok(nativeZoomRatiosMatch(state.report.environment.browser, before, await geometry()), 'File-only reference cannot alter the actual application zoom/window.');
    const emptyBefore = await identity(true);
    assert.equal(emptyBefore.currentCustomer, false); assert.equal(emptyBefore.activeCall, false);
    if (state.report.environment.browser === 'chromium') {
        kernel.dismissBrowserPopup();
        state.report.nativeProof.headerReadiness = await kernel.waitForHeaderUncovered(page);
    }
    assert.deepEqual(await identity(), emptyBefore, 'Browser-UI preparation cannot change application state.');
    await observe(page, state, 'native-200-empty-shell', ['.header']);
    await inspectCompactCall(page, state, control);
    await inspectProfileOutboxMenu(page, state, control);
    const openNativeReadonlyEditor = state.report.environment.browser === 'firefox' ? () => openFirefoxNativeReadonlyEditor(page, state) : null;
    await feedbackModule.inspectRecordListsAfter(page, state, { observe, control, openNativeReadonlyEditor });
    const dialog = page.locator('.customer-editor[open]');
    await dialog.locator('.form-header .btn-close').press('Enter'); await dialog.waitFor({ state: 'hidden' });
    await inspectOutboxEditorHeader(page, state, control, { retainRecordCustomer: true });
    const beforeResetIdentity = await identity(true);
    await page.bringToFront(); kernel.resetZoom();
    const reset = await geometry();
    state.report.nativeProof.reset = reset;
    assert.ok(Math.abs(reset.dpr - before.dpr) < 0.03 && Math.abs(reset.innerWidth - before.innerWidth) < 3
        && Math.abs(reset.innerHeight - before.innerHeight) < 3 && Math.abs(reset.outerWidth - before.outerWidth) < 3
        && Math.abs(reset.outerHeight - before.outerHeight) < 3 && Math.abs(reset.pinchScale - 1) < 0.01,
        'ActualOSCtrl+0 must restore100percent and the same window without pinch.');
    assert.deepEqual(await identity(), beforeResetIdentity, 'ActualOSreset must preserve the same customer/work-session identity.');
    state.report.nativeKernel = nativeReport;
    await kernel.captureWholeDesktop('native-100-reset.png');
    assert.equal(state.report.recordMutations.length, 0);
}

async function main() {
    const phase = process.env.KIWI_THEME_AUDIT_OPERATIONAL_PHASE;
    assert.ok(['before', 'after'].includes(phase), 'Explicit before or after phase is required.');
    const baseUrl = new URL(process.env.KIWI_SMOKE_BASE_URL || '');
    assert.equal(baseUrl.href, 'https://bdc.rtvmedia.org.local:9444/kiwi/');
    const sourceRoot = path.resolve(process.env.KIWI_THEME_APP_ROOT || '');
    const requestedSuite = process.env.KIWI_THEME_AUDIT_OPERATIONAL_SUITE || 'operational';
    operationalJobs(phase, requestedSuite, []);
    const currentBefore = phase === 'before' && requestedSuite === 'records-b4';
    const proof = phase === 'before' && !currentBefore ? await verifyOriginals(sourceRoot, process.env.KIWI_THEME_OPERATIONAL_SOURCE_PROOF) : await verifyAfterSource(sourceRoot, currentBefore);
    if (phase === 'after') proof.legacyAdoption = await verifyAfterLegacyAdoption();
    const sdkBytes = await readFile(screenshotSdkFile);
    assert.equal(sha256(sdkBytes), screenshotSdkSha256, 'The original pinned SDK must match before browser launch.');
    assert.equal(sdkBytes.length, 26113, 'The original pinned SDK byte count must match before browser launch.');
    const feedbackModule = requestedSuite === 'feedback' || currentBefore || phase === 'after' ? await import('./compose-smoke-theme-audit-operational-feedback.mjs') : null;
    const feedbackHelper = feedbackModule ? { path: fileURLToPath(new URL('./compose-smoke-theme-audit-operational-feedback.mjs', import.meta.url)),
        sha256: sha256(await readFile(new URL('./compose-smoke-theme-audit-operational-feedback.mjs', import.meta.url))) } : null;
    const evidenceRoot = path.resolve(process.env.KIWI_THEME_EVIDENCE_DIR || '');
    assert.ok(evidenceRoot.startsWith('/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/' + (currentBefore || phase === 'after' ? '2026-11-13' : '2026-11-12') + '/slice-09/'));
    if (currentBefore) assert.equal(path.basename(evidenceRoot), 'records-b4-before-01');
    if (phase === 'after') assert.ok(path.basename(evidenceRoot).startsWith('after-'), 'AFTER cannot overwrite a BEFORE evidence directory.');
    const browserName = process.env.KIWI_SMOKE_BROWSER;
    assert.ok(['chromium', 'firefox'].includes(browserName));
    const widths = process.env.KIWI_THEME_AUDIT_VIEWPORTS?.split(',') || [];
    assert.ok(widths.length > 0 && widths.length <= 4);
    const viewports = widths.map(item => { const [width, height] = item.split('x').map(Number); assert.ok([[1440,1000],[390,1000],[320,1000],[390,320]].some(pair => pair[0] === width && pair[1] === height)); return { width, height }; });
    if (phase === 'after') validateAfterViewportPlan(requestedSuite, browserName, viewports);
    if (currentBefore) { assert.equal(browserName, 'chromium'); assert.deepEqual(viewports, [{ width: 1440, height: 1000 }, { width: 390, height: 1000 }]); }
    const referencePath = path.join(sourceRoot, 'plans/kiwi-light-and-shadow-theme-palette-showcase.html');
    const referenceSha256 = sha256(await readFile(referencePath));
    assert.equal(referenceSha256, phase === 'after' || currentBefore ? afterReference : '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4', 'Reference checked before browser launch.');
    const require = createRequire(import.meta.url), playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright';
    if (phase === 'after') await mkdir(evidenceRoot, { recursive: false });
    const playwright = require(playwrightPath);
    const native = requestedSuite === 'native-operational';
    const nativeReport = { captures: [] };
    const nativeKernel = native ? createNativeOperationalKernel(browserName,
        path.join(evidenceRoot, browserName, '1440x1000', 'native-operational-2'), nativeReport) : null;
    let browser;
    try {
        if (nativeKernel) await nativeKernel.start();
        browser = await playwright[browserName].launch(browserName === 'firefox'
            ? { headless: !native, ...(native ? { env: nativeKernel.launchEnvironment } : {}) }
            : { headless: !native, executablePath: '/usr/bin/google-chrome',
                args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1', ...(native ? ['--disable-features=Translate,TranslateUI'] : [])],
                ...(native ? { env: nativeKernel.launchEnvironment } : {}) });
        const referenceContracts = new Map();
        const jobs = operationalJobs(phase, requestedSuite, viewports);
        for (const { viewport, suite, recordCount, mutationSection } of jobs) {
            const referenceKey = viewport.width + 'x' + viewport.height;
            const viewportDir = path.join(evidenceRoot, browserName, `${viewport.width}x${viewport.height}`);
            const jobName = recordCount ? suite + '-' + recordCount + (mutationSection ? '-' + mutationSection : '') : suite;
            const evidenceDir = phase === 'after' ? path.join(viewportDir, jobName) : viewportDir;
            await mkdir(evidenceDir, { recursive: true });
            if (phase === 'after' && !native && !referenceContracts.has(referenceKey)) referenceContracts.set(referenceKey,
                await feedbackModule.readAfterReference(browser, referencePath, path.join(viewportDir, 'reference'), viewport));
            const profile = ['input-gates', 'coarse-touch-retry', 'coarse-menu', 'coarse-menu-correction'].includes(requestedSuite) ? remainingOperationalGatePlan(browserName).find(item => item.suite === (['coarse-menu', 'coarse-menu-correction'].includes(suite) ? 'coarse-touch' : suite)) : null;
            const recordFixture = currentBefore ? feedbackModule.currentRecordsFixture(sourceRoot)
                : ['coarse-touch', 'locale-en'].includes(suite) ? feedbackModule.inputProfileRecordsFixture(sourceRoot)
                : recordCount ? feedbackModule.recordListAfterFixture(sourceRoot, recordCount, suite === 'records-after-component') : null;
            const privacyFixtures = suite === 'editor-privacy' ? feedbackModule.affectedRecordPrivacyFixtures(sourceRoot) : null;
            const state = { sourceRoot, baseUrl, sdkBytes, phase, suite, recordFixture, privacyFixtures, nativeKernel, feedbackFixtures: feedbackModule?.readonlySourceFixtures() || [], api: new URL('api/v1/', baseUrl).pathname, viewport, evidenceDir,
                referenceContract: referenceContracts.get(referenceKey), checkAfterObservation: feedbackModule?.checkAfterObservation,
                report: { marker: 'theme_audit', slice: 9, phase, status: 'running', createdUtc: new Date().toISOString(),
                    source: proof, runner: { path: modulePath, sha256: sha256(await readFile(modulePath)) },
                    suite, requestedSuite, recordCount, mutationSection, componentOnly: recordFixture?.componentOnly,
                    feedbackHelper, readonlySourceReads: [], settingsFixtures: [], recordMutations: [], checks: [],
                    originalSdk: { path: screenshotSdkFile, sha256: screenshotSdkSha256, bytes: sdkBytes.length }, sdkReads: [],
                    environment: { browser: browserName, version: browser.version(), playwrightVersion: require(path.join(playwrightPath, 'package.json')).version, viewport,
                        locale: profile?.context.locale || 'nl-NL', timezone: 'Europe/Amsterdam', role: profile?.role || 'kiwi-admin', zoom: native ? 'ActualOSzoom_pendingproof' : '100percent', reducedMotion: profile?.context.reducedMotion || 'reduce', input: profile?.suite === 'coarse-touch' ? 'Actualtouch tap plusnativekeyboard, emulatedcoarse media; nophysicaldeviceclaim.' : 'Actual pointer/native keyboard; no forced clicks.' },
                    reference: { path: referencePath, sha256: referenceSha256, computedContract: referenceContracts.get(referenceKey) },
                    observations: [], servedSources: [], sourceErrors: [], deniedRequests: [], localCallWrites: [], authentications: [], authDiagnostics: [], authLifecycle: [], outboxReads: [], errors: [], highlightTones: [],
                    limitations: [phase === 'before' ? 'Observational BEFORE is not visual acceptance.' : 'Finite explicitly declared AFTER suite only; independent whole-image review and other operational/privacy/final10 gates remain.',
                        'Synthetic fixtures through real installed state/controllers do not prove server policies or persistence.', 'Native200percent/coarse/English/roles/privacy are separately reviewed AFTER gates.'] } };
            const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: native ? null : viewport, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', reducedMotion: 'reduce', ...profile?.context, serviceWorkers: 'block' });
            const control = await installOperationalTransport(context, state), page = await context.newPage();
            const finishSources = await trackSources(page, state);
            page.on('pageerror', error => state.report.errors.push({ message: error.message.replace(/https?:\/\/\S+/g, '[local URL]').slice(0, 500) }));
            try {
                await login(page, control, state);
                await finishSources({ requireExtras: false });
                if (native) {
                    control.mode = 'empty'; control.release();
                    await inspectNativeOperational(page, state, control, browser, referencePath, feedbackModule, nativeReport);
                } else if (suite === 'coarse-menu' || suite === 'coarse-menu-correction') {
                    control.mode = 'empty'; control.release(); await painted(page);
                    await inspectCoarseOutboxMenuDiagnostic(page, state, control, { requireContainment: suite === 'coarse-menu-correction' });
                } else if (profile) {
                    control.mode = 'empty'; control.release(); await painted(page);
                    await inspectInputProfile(page, state, control, feedbackModule);
                } else if (suite === 'editor-privacy') {
                    control.mode = 'empty'; control.release(); await painted(page);
                    await feedbackModule.inspectAffectedRecordPrivacy(page, state, { observe });
                    assert.equal(control.recordReads.size, 2);
                    assert.equal(state.report.localCallWrites.length, 0);
                    assert.equal(state.report.recordMutations.length, 0);
                } else if (suite === 'records-b4') {
                    control.mode = 'empty'; control.release();
                    await painted(page);
                    await feedbackModule.inspectCurrentRecords(page, state, { observe });
                    assert.equal(control.recordReads.size, 2);
                    assert.equal(state.report.localCallWrites.length, 0);
                } else if (suite === 'records-after' || suite === 'records-after-component') {
                    control.mode = 'empty'; control.release();
                    await painted(page);
                    await feedbackModule.inspectRecordListsAfter(page, state, { observe, control, mutationSection });
                    assert.equal(control.recordReads.size, 2);
                    assert.equal(control.recordMutationGate.pending(), false);
                    assert.equal(state.report.recordMutations.length, suite === 'records-after-component' ? 1 : 0);
                    assert.equal(state.report.localCallWrites.length, 0);
                } else if (suite === 'short-call' || suite === 'anonymous-short' || suite === 'held-readability') {
                    control.mode = 'empty'; control.release();
                    await calls(page, state, control);
                } else if (suite === 'outbox-editor') {
                    await inspectOutboxEditorHeader(page, state, control);
                    assert.equal(state.report.localCallWrites.length, 0);
                } else if (suite === 'outbox-fallback-narrow') {
                    await page.evaluate(customer => {
                        window.currentCustomer = customer; window.customers = [customer];
                        window.contactHistoryState = { currentPage: 1, itemsPerPage: 6, highlightId: null, lastEntry: null };
                        window.kiwiContactHistorySlice.displayContactHistory();
                        window.currentCustomer = null; window.customers = [];
                    }, fixtureCustomer('after'));
                    const context = await page.evaluate(() => ({ hasCurrentCustomer: Boolean(window.currentCustomer),
                        hasWorkSessionReference: Boolean(window.kiwiCustomerWorkSession.getRequestContext().customerReference) }));
                    assert.equal(context.hasCurrentCustomer, false); assert.equal(context.hasWorkSessionReference, false);
                    assert.equal(await page.locator('#customerDetail').isVisible(), false);
                    state.report.narrowFallbackContext = { ...context, customerDetailVisible: false,
                        boundary: 'Fresh unselected browser context with the original installed history-empty fixture before its globals are cleared; no canonical selection/reset/write.' };
                    await inspectOutboxFallbackFocus(page, state, control, { fromOutside: true });
                    assert.equal(state.report.localCallWrites.length, 0);
                } else if (suite === 'summary-focus' || suite === 'summary-correction') {
                    control.mode = 'empty'; control.release(); await painted(page);
                    await feedbackModule.inspectSummaryFocusDiagnostic(page, state, observe, { requireReachability: suite === 'summary-correction' });
                } else if (suite === 'async-outbox') {
                    await inspectAsyncOutbox(page, state, control);
                } else if (suite === 'outbox-focus') {
                    await inspectOutboxFallbackFocus(page, state, control);
                    assert.equal(state.report.localCallWrites.length, 0);
                } else if (suite === 'feedback') {
                    control.mode = 'empty'; control.release();
                    await painted(page);
                    await feedbackModule.inspectOperationalFeedback(page, state, { observe, control });
                } else {
                    await initialOutbox(page, state, control);
                    await calls(page, state, control);
                    await history(page, state);
                    await outbox(page, state, control);
                }
                await finishSources();
                assert.deepEqual(control.gate.pending(), []);
                assert.equal(state.report.deniedRequests.length, 0);
                assert.equal(state.report.errors.length, 0);
                state.report.status = phase === 'before' ? 'Observed finite BEFORE states; independent whole-image review pending.' : 'Finite AFTER ' + suite + ' scope checks passed; independent images and remaining gates pending.';
                if (suite === 'outbox-focus') state.report.status = state.report.outboxFallbackDiagnostic.sourceFinding
                    ? 'Diagnostic complete: actual fallback focus perimeter clipping found; source acceptance remains blocked.'
                    : 'Diagnostic complete: fallback focus perimeter contained in this finite state; independent review pending.';
                if (suite === 'short-call') state.report.status = 'Short-call natural keyboard/wheel/expiry diagnostic complete; independent classification required, no source acceptance.';
                if (suite === 'coarse-menu') state.report.status = 'Coarse menu natural keyboard/wheel diagnostic complete; actual whole-image classification required, no acceptance inferred.';
                if (suite === 'coarse-menu-correction') state.report.status = 'Corrected initial and native menu containment checks passed; actual whole-image review pending.';
                if (suite === 'summary-focus') state.report.status = 'Summary natural keyboard diagnostic complete; independent sticky-header/painted-perimeter classification required.';
                if (['anonymous-short', 'outbox-editor', 'outbox-fallback-narrow', 'held-readability'].includes(suite)) state.report.status = 'Finite operational correction geometry/focus checks passed; independent whole-image review pending.';
            } catch (error) {
                state.report.status = 'FAILED; preserved for classification and reviewed retry.';
                state.report.failure = { name: error.name, message: error.message.replace(/https?:\/\/\S+/g, '[local URL]').slice(0, 1000) };
                throw error;
            } finally {
                control.release();
                control.releaseRecordMutation();
                await save(state);
                await context.close();
            }
        }
    } finally {
        try { await browser?.close(); } finally { nativeKernel?.close(); }
    }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    main().catch(error => { console.error('[theme_audit09] ' + error.message.replace(/https?:\/\/\S+/g, '[local URL]').slice(0, 1000)); process.exitCode = 1; });
}
