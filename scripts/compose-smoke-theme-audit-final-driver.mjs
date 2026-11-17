// theme_audit: explicit final10 bridge. Import performs no I/O or browser launch.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFinalAuditAdapter, finalAuditAreas, finalReleaseIdentity, summarizeFinalAudit } from './compose-smoke-theme-audit-final.mjs';

const phases = ['SHELL', 'CUSTOMER', 'SUBSCRIPTION', 'ARTICLE', 'SERVICE', 'OVERLAY', 'OPERATIONAL'];
const families = ['CONTROLS', 'SHELL', 'CUSTOMER', 'SUBSCRIPTION', 'ARTICLE', 'SERVICE', 'OVERLAY', 'CUSTOMER_LOOKUP'];
const refinedReference = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const originalReference = '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4';
const originalSdk = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = entries => entries.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })).sort((a, b) => a.path.localeCompare(b.path));

export const finalNativeGroups = Object.freeze([
    'shell-search-customer-history', 'subscription-service-native-date', 'article-cart-custom-calendar',
    'active-call-to-acw-disposition', 'outbox-feedback-image-system'
]);

export function validateFinalMode(env, baseUrl) {
    assert.equal(env.KIWI_THEME_AUDIT_FINAL_ONLY, '1');
    assert.equal(env.KIWI_THEME_AUDIT_SLICE, '10', 'Final-only requires slice10.');
    for (const family of families) assert.notEqual(env[`KIWI_THEME_AUDIT_${family}_ONLY`], '1', 'Final-only cannot combine legacy family modes.');
    assert.notEqual(env.KIWI_THEME_AUDIT_FINAL_SOURCE, '1', 'The bounded legacy source bridge is a separate mode.');
    for (const family of phases) assert.equal(env[`KIWI_THEME_AUDIT_${family}_PHASE`], 'after', 'Every imported family phase must explicitly be AFTER before import.');
    const native = env.KIWI_THEME_AUDIT_NATIVE_ZOOM_ONLY === '1';
    assert.ok(env.KIWI_THEME_AUDIT_NATIVE_ZOOM !== '1' || native, 'Final native checks run separately in native-only mode.');
    assert.ok(['chromium', 'firefox'].includes(env.KIWI_SMOKE_BROWSER || 'chromium'));
    assert.ok(['localhost', '127.0.0.1', 'bdc.rtvmedia.org.local'].includes(baseUrl.hostname));
    assert.ok(['http:', 'https:'].includes(baseUrl.protocol) && !baseUrl.username && !baseUrl.password && !baseUrl.search && !baseUrl.hash);
    assert.ok(['/kiwi/', '/kiwi-preview/'].includes(baseUrl.pathname), 'Use an exact local application base.');
    assert.ok(env.KIWI_THEME_APP_ROOT && env.KIWI_THEME_FINAL_RELEASE && /^[a-f0-9]{64}$/.test(env.KIWI_THEME_FINAL_RELEASE_SHA256 || ''), 'Explicit final worktree and frozen release path/hash are required.');
    return { native };
}

export function finalContextOptions(descriptor) {
    assert.ok(['nl', 'en'].includes(descriptor.locale));
    assert.ok(['kiwi-admin', 'kiwi-dev', 'kiwi-supervisor', 'kiwi-user', 'kiwi-view', 'donny'].includes(descriptor.role));
    assert.equal(typeof descriptor.hasTouch, 'boolean');
    assert.ok(['reduce', 'no-preference'].includes(descriptor.reducedMotion));
    assert.equal(typeof descriptor.native, 'boolean');
    const { width, height } = descriptor.viewport || {};
    assert.ok(Number.isInteger(width) && width >= 320 && Number.isInteger(height) && height >= 240);
    return { ignoreHTTPSErrors: true, serviceWorkers: 'block', locale: descriptor.locale === 'nl' ? 'nl-NL' : 'en-GB',
        timezoneId: 'Europe/Amsterdam', hasTouch: descriptor.hasTouch, reducedMotion: descriptor.reducedMotion,
        ...(descriptor.native ? { viewport: null } : { viewport: { width, height }, deviceScaleFactor: 1 }) };
}

async function physicalFile(filename) {
    assert.ok(path.isAbsolute(filename) && path.normalize(filename) === filename, 'Use canonical absolute proof paths.');
    let current = path.parse(filename).root;
    for (const segment of filename.slice(current.length).split('/')) {
        current = path.join(current, segment);
        assert.equal((await lstat(current)).isSymbolicLink(), false, 'No symlink proof or source paths.');
    }
    assert.ok((await lstat(filename)).isFile(), 'Expected a regular proof/source file.');
    return readFile(filename);
}

async function artifact(item, label) {
    assert.ok(item && /^[a-f0-9]{64}$/.test(item.sha256), `${label}: exact artifact hash required.`);
    const bytes = await physicalFile(item.path);
    assert.equal(sha256(bytes), item.sha256, `${label}: artifact changed.`);
    return bytes;
}

async function listFiles(root, relative = '') {
    const result = [];
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
        const name = path.posix.join(relative, entry.name);
        assert.equal(entry.isSymbolicLink(), false, 'No symlinks in source inventories.');
        if (entry.isDirectory()) result.push(...await listFiles(root, name));
        else { assert.ok(entry.isFile()); result.push(name); }
    }
    return result;
}

async function verifyEntries(root, entries, expectedPaths, committedHead) {
    assert.ok(Array.isArray(entries) && entries.length > 0);
    assert.equal(new Set(entries.map(entry => entry.path)).size, entries.length, 'Duplicate source inventory entry.');
    assert.deepEqual(entries.map(entry => entry.path).sort(), expectedPaths.sort(), 'Complete dynamic source membership differs.');
    for (const entry of entries) {
        assert.ok(!entry.path.split('/').includes('..') && !path.isAbsolute(entry.path) && /^[a-f0-9]{64}$/.test(entry.sha256));
        const bytes = await physicalFile(path.join(root, entry.path));
        assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256, 'Working source changed.');
        if (committedHead) {
            const committed = execFileSync('git', ['-C', root, 'show', `${committedHead}:${entry.path}`]);
            assert.equal(sha256(committed), entry.sha256, 'Committed and working source differ.');
        }
    }
}

export function validateFinalSourceInventory(source, runtime, diskPaths, trackedPaths) {
    assert.ok(Array.isArray(source.source) && source.source.length > 0);
    assert.equal(new Set(source.source.map(entry => entry.path)).size, source.source.length, 'Duplicate production entry.');
    assert.deepEqual([...diskPaths].sort(), [...trackedPaths].sort(), 'Untracked or missing production source cannot enter the final release.');
    assert.deepEqual(source.source.map(entry => entry.path).sort(), [...trackedPaths].sort(), 'Incomplete final source membership.');
    assert.equal(source.productionCount, source.source.length);
    assert.equal(runtime.productionCount, source.source.length);
    assert.deepEqual(canonical(runtime.source), canonical(source.source), 'Runtime must include every final source body.');
    return source.source.length;
}

// This bridge deliberately accepts no historical file count or pre-icon application head.
// The root must issue a NEW final release after09 acceptance and accepted icon integration.
// The final release owns these existing helper families, including their PHP projection
// generator. Keep this explicit inventory separate from the immutable historical20 set.
export function finalOwnedHelperPath(filename) {
    return [
        /^scripts\/compose-smoke[^/]*\.mjs$/,
        /^scripts\/theme-audit-[^/]*\.mjs$/,
        /^scripts\/run-theme-audit-[^/]*\.mjs$/,
        /^scripts\/prepare-theme-audit-[^/]*\.(?:mjs|php)$/
    ].some(pattern => pattern.test(filename));
}

export async function verifyFinalHelperFiles(toolingRoot, helpers) {
    const paths = (await listFiles(path.join(toolingRoot, 'scripts')))
        .map(name => `scripts/${name}`).filter(finalOwnedHelperPath);
    assert.equal(helpers.worktree, toolingRoot);
    await verifyEntries(toolingRoot, helpers.files, paths);
    return paths;
}

// Each entry is an independently classified area/width observation, not a DATE/focus-within policy.
// Missing metadata keeps the historical host-only criterion strict.
export async function verifyFinalNativeDateFocus(release, source) {
    const proof = release.reference.nativeDateFocus;
    if (!proof) return null;
    assert.equal(proof.observedSource.sha256, '5f56e7d3102e3c20ccd1393f7799b8d1fd3709e4ed5bd07175c64fc879db0cc8');
    const observedSource = JSON.parse(await artifact(proof.observedSource, 'Native DATE observed application source'));
    assert.equal(observedSource.head, '754bb51001bb94b7472c8dfdfbce631eda73b2d9');
    // Carry every body, allowing only the confirmed gender alias and two exact selector fixes.
    const cssChanges = [
        { path: 'assets/css/styles.css', sha256: '38e31eb269625d745fc40c9ba7e58c391afd9f237f6a6b17fd6a3958773047ba', bytes: 130111,
            original: '.timeline-header:focus-visible { outline-offset: -3px; }',
            corrected: '.contact-history .timeline-header:focus-visible { outline-offset: -3px; }' },
        { path: 'assets/css/contextual-feedback.css', sha256: 'e62e7a222b8a74942438c41306fe0a69f9ac7cf76f6bc2b193e5580fcbf43ad8', bytes: 19560,
            original: ':is(.modal, div.form-container):not(dialog):not(dialog *) {',
            corrected: ':is(.modal, div.form-container):not(#newSubscriptionForm, #articleSaleForm):not(dialog):not(dialog *) {' }
    ];
    const carriedCss = new Map();
    for (const change of cssChanges) {
        const current = source.source.find(entry => entry.path === change.path);
        if (current?.sha256 !== change.sha256) continue;
        const original = observedSource.source.find(entry => entry.path === change.path);
        const body = await physicalFile(path.join(source.worktree, change.path));
        assert.equal(body.length, change.bytes); assert.equal(sha256(body), change.sha256);
        const text = body.toString('utf8');
        assert.equal(text.split(change.corrected).length, 2, 'Exactly one approved selector may change per CSS body.');
        const originalBody = Buffer.from(text.replace(change.corrected, change.original));
        assert.equal(originalBody.length, original.bytes);
        assert.equal(sha256(originalBody), original.sha256, 'Native DATE CSS carry contains more than its exact approved selector fix.');
        carriedCss.set(change.path, change);
    }
    const expected = observedSource.source.map(entry => {
        if (entry.path === 'assets/js/app/customer-editor.js')
            return { ...entry, sha256: '99f3e6d8cde221ba5c84581c4ce5181d87a99cad971bd022e39b3ce52e6db25b', bytes: 23574 };
        const css = carriedCss.get(entry.path);
        return css ? { ...entry, sha256: css.sha256, bytes: css.bytes } : entry;
    });
    assert.equal(observedSource.productionCount, 216);
    assert.deepEqual(canonical(source.source), canonical(expected), 'Native DATE source carry differs beyond the exact confirmed alias/selector changes.');
    assert.ok(Array.isArray(proof.entries) && proof.entries.length > 0);
    const entries = [];
    for (const entry of proof.entries) {
        const pair = JSON.parse(await artifact(entry.paired, 'Paired native DATE observation'));
        const review = JSON.parse(await artifact(entry.review, 'Independent native DATE classification'));
        assert.equal(pair.marker, 'theme_audit'); assert.equal(review.marker, 'theme_audit');
        const area = pair.applicationArea ?? 'A05';
        assert.ok(['A05', 'A08'].includes(area), 'Native DATE proof requires an explicitly supported area.');
        assert.equal(review.status, `MATCHED_REFERENCE_NATIVE_INTERNAL_FOCUS_BEHAVIOR; ORIGINAL_${area}_GATE_REMAINS_FAILED`);
        assert.ok(typeof review.reviewer === 'string' && review.reviewer.trim());
        assert.deepEqual(review.pairedArtifact, entry.paired);
        for (const key of ['applicationReport', 'referenceReport']) assert.deepEqual(review[key], pair[key]);
        const application = JSON.parse(await artifact(pair.applicationReport, 'Observed application report'));
        const reference = JSON.parse(await artifact(pair.referenceReport, 'Observed reference report'));
        await artifact(reference.reference, 'Native DATE approved reference body');
        assert.equal(reference.reference.sha256, refinedReference);
        const reviewedCommits = [observedSource.head, 'a8d8cce2cb81ef1e985b7dd4273c87401d102964',
            '54d409eb008aaad00de7b62b7345a167bdbe54a7', release.source.commit];
        assert.ok(reviewedCommits.includes(application.application.commit),
            'Native DATE observation must come from an exact reviewed source or the current release.');
        assert.equal(reference.browser.name, 'chromium'); assert.equal(reference.browser.version, '157.0.8103.38');
        assert.equal(application.environment.browser, 'chromium');
        assert.equal(application.environment.browserVersion, reference.browser.version);
        const stop = reference.steps[3];
        assert.deepEqual(stop.state.active, { id: 'demo-start-date', tag: 'INPUT', type: 'date' });
        for (const [key, value] of Object.entries({ focused: false, focusVisible: false, focusWithin: true })) {
            assert.equal(stop.state.host[key], value); assert.equal(pair.applicationStop[0][key], value);
        }
        const { width, height, dpr } = stop.state.viewport;
        assert.ok([1440, 390, 320].includes(width)); assert.equal(height, 1000); assert.equal(dpr, 1);
        assert.ok(!entries.some(item => item.area === area && item.width === width), 'Duplicate native DATE proof area/width.');
        assert.equal(pair.applicationStop.length, 1);
        assert.equal(pair.applicationStop[0].id, 'subStartDate');
        assert.equal(pair.applicationStop[0].tag, 'INPUT'); assert.equal(pair.applicationStop[0].type, 'date');
        const prefix = `${area}-chromium-${width}x1000-`;
        const keyboard = application.checks.find(check => check.name === prefix + 'actual native Tab traverses subscription controls to Cancel within the visible viewport')
            || application.checks.find(check => check.name === prefix + 'final-only Tab route and reference-bound DATE internal-stop classification; current visual review required'
                && check.legacyHostFocusPassed === false && check.nativeInternalFocus === null);
        assert.ok(keyboard && keyboard.actual === false && keyboard.status === 'deviation');
        assert.deepEqual(keyboard.viewport, { width, height });
        const step = keyboard.path.findIndex(item => !item.focusVisible);
        assert.equal(keyboard.path.filter(item => !item.focusVisible).length, 1);
        for (const [key, value] of Object.entries(pair.applicationStop[0])) assert.equal(keyboard.path[step][key], value);
        for (const image of review.personallyViewedWholeImages) await artifact(image, 'Independently viewed native DATE whole image');
        assert.deepEqual(review.personallyViewedWholeImages, [pair.applicationImage, stop.image]);
        const capture = application.captures.find(item => item.filename === path.basename(pair.applicationImage.path));
        assert.ok(capture && capture.captureMethod === 'browser protocol screenshot');
        assert.equal(pair.applicationImage.path, path.join(path.dirname(pair.applicationReport.path), capture.filename));
        assert.equal(capture.name, prefix + 'after-subscription-native-date-focus-step-' + step);
        assert.deepEqual([capture.geometry.viewportWidth, capture.geometry.viewportHeight, capture.geometry.devicePixelRatio,
            capture.geometry.visualViewportScale], [width, height, 1, 1]);
        entries.push({ area, width, height, step, applicationStop: pair.applicationStop[0], paired: entry.paired, review: entry.review });
    }
    return { kind: 'final-only-reference-bound-native-calendar-internal-focus', sourceCommit: release.source.commit,
        referenceSha256: refinedReference, browserVersion: '157.0.8103.38', entries,
        observedSource: proof.observedSource, originalHostGate: 'failed; preserved historical observation',
        visualBoundary: 'Each current native-focus capture still needs independent whole-image review.' };
}

export async function verifyFinalRelease(release, { sourceRoot, toolingRoot, baseUrl }) {
    assert.equal(release.marker, 'theme_audit'); assert.equal(release.slice, 10); assert.equal(release.phase, 'after');
    assert.equal(release.slice09?.phase, 'after'); assert.equal(release.slice09?.status, 'accepted');
    assert.equal(release.icons?.status, 'accepted');
    assert.ok(/^[a-f0-9]{40}$/.test(release.source?.commit));
    const source = JSON.parse(await artifact(release.source.manifest, 'Complete final source'));
    const runtime = JSON.parse(await artifact(release.source.runtime, 'Final runtime source'));
    const helpers = JSON.parse(await artifact(release.source.helpers, 'Final helper inventory'));
    const handoff = JSON.parse(await artifact(release.handoff, 'Final runtime handoff'));
    for (const [item, label] of [[release.slice09.evidence, 'Accepted09'], [release.icons.evidence, 'Accepted icon integration']]) {
        const decision = JSON.parse(await artifact(item, label));
        assert.equal(decision.marker, 'theme_audit'); assert.equal(decision.status, 'accepted');
        assert.ok(typeof decision.reviewer === 'string' && decision.reviewer.trim(), 'An explicit independent review decision is required.');
    }
    assert.equal(release.reference.original.sha256, originalReference); await artifact(release.reference.original, 'Immutable original reference');
    assert.equal(release.reference.refined.sha256, refinedReference); await artifact(release.reference.refined, 'Approved refined reference');
    assert.equal(sha256(await physicalFile(path.join(sourceRoot, 'plans/kiwi-light-and-shadow-theme-palette-showcase.html'))), refinedReference);
    assert.equal(release.sdk.sha256, originalSdk); await artifact(release.sdk, 'Original SDK');
    assert.equal(source.head, release.source.commit); assert.equal(source.worktree, sourceRoot);
    assert.equal(source.referenceSha256, refinedReference);
    const head = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(head, release.source.commit);
    const diskPaths = (await Promise.all(['assets', 'templates', 'src'].map(async directory =>
        (await listFiles(path.join(sourceRoot, directory))).filter(name => !name.endsWith('.md')).map(name => `${directory}/${name}`)))).flat();
    const tracked = execFileSync('git', ['-C', sourceRoot, 'ls-files', 'assets', 'templates', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(name => name && !name.endsWith('.md'));
    validateFinalSourceInventory(source, runtime, diskPaths, tracked);
    await verifyEntries(sourceRoot, source.source, tracked, head);
    assert.equal(runtime.hostCommittedHead, head); assert.equal(runtime.sourceWorktree, sourceRoot);
    assert.equal(runtime.referenceSha256, refinedReference); assert.equal(runtime.mismatches, 0);
    assert.equal(runtime.candidateProofSha256, release.source.manifest.sha256);
    assert.equal(handoff.applicationHead, head); assert.equal(handoff.project, runtime.project);
    assert.equal(handoff.url, baseUrl.href); assert.equal(handoff.httpStatus.kiwiStatus, 200);
    assert.equal(handoff.runtimeSourceProof.sha256, release.source.runtime.sha256);
    assert.equal(handoff.candidateSourceProof.sha256, release.source.manifest.sha256);
    const configurations = release.configuration;
    const required = ['composer.json', 'composer.lock', 'symfony.lock', 'docker-compose.yaml', 'infra/docker/app/Dockerfile', 'infra/docker/base/Dockerfile'];
    assert.ok(required.every(name => configurations?.some(entry => entry.path === name)), 'Freeze locks and Compose/runtime configuration.');
    assert.ok(configurations.every(entry => required.includes(entry.path)), 'Only declared public runtime configuration is read.');
    await verifyEntries(sourceRoot, configurations, required, head);
    await verifyFinalHelperFiles(toolingRoot, helpers);
    assert.ok(/^scripts\/compose-smoke-theme-audit-final-scenes\.mjs$/.test(release.adapters.path), 'Only the reviewed final scene entry may be loaded.');
    const adapter = helpers.files.find(entry => entry.path === release.adapters.path);
    assert.ok(adapter && adapter.sha256 === release.adapters.sha256, 'Final scene entry must belong to the frozen helper inventory.');
    assert.equal(release.operationalAfter?.phase, 'after'); assert.equal(release.operationalAfter?.sourceCommit, head);
    await artifact(release.operationalAfter.evidence, 'Owner released operational AFTER bridge');
    const nativeDateFocus = await verifyFinalNativeDateFocus(release, source);
    return { productionFiles: source.source.length, helperFiles: helpers.files.length, sourceCommit: head,
        ...(nativeDateFocus ? { nativeDateFocus } : {}) };
}

function validateArtifactMetadata(value, label) {
    assert.ok(typeof value?.path === 'string' && path.isAbsolute(value.path) && path.normalize(value.path) === value.path, `${label}: canonical artifact path required.`);
    assert.ok(/^[a-f0-9]{64}$/.test(value.sha256), `${label}: artifact SHA-256 required.`);
}

function validateOwnerReceipt(receipt, release) {
    assert.equal(receipt?.releaseId, finalReleaseIdentity(release), 'Owner verification must match the complete final release.');
    validateArtifactMetadata(receipt.evidence, 'Owner release verification');
}

// The importer and receipt reader are injectable I/O seams for synthetic unit tests.
// Production prepareFinalDriver always uses the actual verified module and physical artifact reader.
export async function loadVerifiedFinalHooks({ release, verification, adapterUrl, loadModule = url => import(url), verifyArtifact = artifact }) {
    const module = await loadModule(adapterUrl);
    assert.equal(typeof module.createFinalSceneHooks, 'function', 'Released concrete scene factory is required.');
    const hooks = await module.createFinalSceneHooks({ release, verification });
    for (const name of ['verifyRelease', 'prepareSession', 'loginSession', 'verifySession', 'finishSession', 'inspectNative']) assert.equal(typeof hooks[name], 'function', `Missing released hook: ${name}`);
    assert.deepEqual(Object.keys(hooks.scenes).sort(), finalAuditAreas.map(area => area.id).sort(), 'All13 concrete scene hooks are required before browser launch.');
    for (const scene of Object.values(hooks.scenes)) assert.equal(typeof scene, 'function');
    assert.deepEqual(hooks.operationalAfter, release.operationalAfter);
    const ownerVerification = await hooks.verifyRelease({ release, releaseId: finalReleaseIdentity(release) });
    validateOwnerReceipt(ownerVerification, release);
    const receiptBytes = await verifyArtifact(ownerVerification.evidence, 'Owner full final release verification');
    const receipt = JSON.parse(receiptBytes);
    assert.equal(receipt.marker, 'theme_audit'); assert.equal(receipt.status, 'verified');
    assert.equal(receipt.releaseId, ownerVerification.releaseId, 'Owner receipt content must bind the final release.');
    assert.equal(receipt.sourceCommit, release.source.commit, 'Owner receipt content must bind the application commit.');
    return { release, hooks, verification, ownerVerification };
}

export async function prepareFinalDriver({ env, sourceRoot, toolingRoot, baseUrl, loadModule = url => import(url) }) {
    validateFinalMode(env, baseUrl);
    const release = JSON.parse(await artifact({ path: env.KIWI_THEME_FINAL_RELEASE, sha256: env.KIWI_THEME_FINAL_RELEASE_SHA256 }, 'Final launch release'));
    const verification = await verifyFinalRelease(release, { sourceRoot, toolingRoot, baseUrl });
    return loadVerifiedFinalHooks({ release, verification,
        adapterUrl: pathToFileURL(path.join(toolingRoot, release.adapters.path)).href, loadModule });
}

function validateNativeSession(session, descriptor, browserName, release) {
    assert.equal(session?.sourceReleaseId, finalReleaseIdentity(release), 'Native session source differs from the owner-verified final release.');
    const expected = { browser: browserName, locale: descriptor.locale, role: descriptor.role,
        input: 'keyboard-and-pointer', zoom: 100, reducedMotion: descriptor.reducedMotion, native: true, hasTouch: descriptor.hasTouch };
    for (const [name, value] of Object.entries(expected)) assert.equal(session.environment?.[name], value, `Native session environment differs: ${name}`);
    assert.ok(typeof session.environment.browserVersion === 'string' && session.environment.browserVersion.trim());
    assert.ok(Number.isFinite(session.environment.width) && session.environment.width >= 320
        && Number.isFinite(session.environment.height) && session.environment.height >= 240);
    validateArtifactMetadata(session.proofs?.source, 'Native actual served source');
    validateArtifactMetadata(session.proofs?.environment, 'Native actual environment');
    assert.equal(session.proofs?.role?.kind, 'actual-oidc-server-render', 'Native role needs actual authenticated server evidence.');
    validateArtifactMetadata(session.proofs.role.artifact, 'Native actual role');
}

export function createFinalDriver(configuration, driver) {
    const { release, hooks, ownerVerification } = configuration;
    validateOwnerReceipt(ownerVerification, release);
    let adapter;
    async function preparePage(page, context, descriptor) {
        finalContextOptions(descriptor);
        assert.equal(page.url(), 'about:blank', 'Install provenance and strict transport before navigation.');
        const handle = { page, context, descriptor, owned: null };
        try {
            handle.owned = await hooks.prepareSession({ page, context, descriptor, driver, release });
            assert.equal(page.url(), 'about:blank', 'Preparation must not navigate before authentication is armed.');
            return handle;
        } catch (error) {
            await hooks.finishSession(handle, { driver, release });
            throw error;
        }
    }
    async function finish(handle) {
        try { await hooks.finishSession(handle, { driver, release }); }
        finally { await handle.context.close(); }
    }
    return {
        async viewport(viewport, contract) {
            if (!adapter) adapter = createFinalAuditAdapter({ release, driver, hooks: {
                verifyRelease: async () => ownerVerification, operationalAfter: hooks.operationalAfter, scenes: hooks.scenes,
                openSession: async ({ cell, releaseId }) => {
                    const descriptor = { id: cell.id, locale: cell.environment.locale, role: cell.environment.role,
                        viewport: { width: cell.environment.width, height: cell.environment.height }, hasTouch: false,
                        reducedMotion: cell.environment.reducedMotion, native: false };
                    const context = await driver.newFinalContext(descriptor);
                    let handle;
                    try {
                        const page = await context.newPage();
                        handle = await preparePage(page, context, descriptor);
                        await hooks.loginSession(handle, { driver, release });
                        const proof = await hooks.verifySession(handle, { driver, release, releaseId, cell });
                        return { ...proof, handle };
                    } catch (error) {
                        if (handle) await finish(handle); else await context.close();
                        throw error;
                    }
                }, closeSession: finish
            } });
            const contracts = ['shell', 'customer', 'subscription', 'subscriptionTitle', 'subscriptionHeading', 'subscriptionInput', 'subscriptionCaption', 'inputFocus', 'selectFocus'];
            for (const name of contracts) assert.ok(contract[name], `Missing measured reference contract: ${name}`);
            driver.contract = configuration.verification?.nativeDateFocus
                ? { ...contract, nativeDateFocus: configuration.verification.nativeDateFocus } : contract;
            const cells = adapter.snapshot().cells.filter(cell => cell.environment.browser === driver.browserName
                && cell.environment.width === viewport.width && cell.environment.height === viewport.height);
            assert.equal(cells.length, 13, 'A final viewport must dispatch all13 areas.');
            try {
                for (const cell of cells) {
                    await adapter.runCell(cell.id);
                    const observed = adapter.snapshot().cells.find(item => item.id === cell.id);
                    const area = finalAuditAreas.find(item => item.id === cell.areaId);
                    assert.ok(area.criteria.every(criterion => observed.evidence.some(item => item.criterionId === criterion)), 'Every declared area criterion must be observed.');
                    assert.ok(observed.evidence.every(item => item.outcome === 'verified'), 'Stop on a required scene deviation or missing check.');
                }
            }
            finally { driver.report.finalAudit = adapter.snapshot(); await driver.saveReport(); }
            return summarizeFinalAudit(adapter.snapshot());
        },
        async prepareNative(page, context, group, contract) {
            assert.ok(finalNativeGroups.includes(group));
            assert.ok(contract, 'Native preparation needs its measured reference contract.');
            driver.contract = contract;
            const descriptor = { id: group, locale: 'nl', role: 'kiwi-admin', viewport: { width: 1440, height: 1000 },
                hasTouch: false, reducedMotion: 'reduce', native: true };
            let handle;
            try { handle = await preparePage(page, context, descriptor); }
            catch (error) { await context.close(); throw error; }
            let verified = false;
            return {
                async login() {
                    await hooks.loginSession(handle, { driver, release });
                    const environment = { browser: driver.browserName, locale: descriptor.locale, role: descriptor.role,
                        input: 'keyboard-and-pointer', zoom: 100, reducedMotion: descriptor.reducedMotion,
                        native: true, hasTouch: descriptor.hasTouch };
                    const proof = await hooks.verifySession(handle, { driver, release, releaseId: finalReleaseIdentity(release),
                        cell: { id: group, environment }, native: true, group, descriptor });
                    validateNativeSession(proof, descriptor, driver.browserName, release);
                    driver.report.finalNativeSessions ||= {};
                    driver.report.finalNativeSessions[group] = structuredClone({ sourceReleaseId: proof.sourceReleaseId,
                        environment: proof.environment, proofs: proof.proofs });
                    verified = true;
                },
                inspect(geometry) {
                    assert.equal(verified, true, 'Actual native session proof must precede geometry and scene inspection.');
                    driver.contract = geometry.contract;
                    return hooks.inspectNative(handle, { driver, release, group, geometry });
                },
                finish: () => hooks.finishSession(handle, { driver, release })
            };
        }
    };
}
