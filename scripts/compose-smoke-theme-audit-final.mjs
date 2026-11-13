// theme_audit: pure evidence bookkeeping. Importing this module performs no I/O.
// Browser, source, role, native zoom and privacy verification belong to reviewed injected hooks.
const originalReference = '478a652ec6da827c7e15f839ba77352585bd53eb561bc2dd09535339665bd4c4';
const refinedReference = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const originalSdk = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';

function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

export const finalAuditAreas = freeze([
    { id: 'A01', name: 'Shell, profile and session', criteria: ['empty-and-selected-context', 'profile-exit-and-focus'],
        helpers: ['shell-acceptance.checkShellGeometry', 'shell-acceptance.inspectProfileAppearance', 'shell-acceptance.inspectProfileInteractions'] },
    { id: 'A02', name: 'Search, filters, results and summary', criteria: ['filters-table-sort-and-page', 'summary-zero-one-three', 'summary-live-nl-en-nl'],
        helpers: ['customer.installCustomerFixtures', 'customer-acceptance.checkCustomerState'] },
    { id: 'A03', name: 'Customer and editor', criteria: ['long-record-and-editable-editor', 'readonly-editor', 'exact-gender-aliases-and-controls'],
        helpers: ['customer-acceptance.readCustomerPresentation', 'customer-acceptance.checkCustomerState'] },
    { id: 'A04', name: 'Address and bank', criteria: ['wrapped-address-selection', 'confirmed-address-and-masked-bank'],
        helpers: ['customer.installCustomerFixtures', 'customer.inspectReusablePersonLookup'] },
    { id: 'A05', name: 'New subscription', criteria: ['products-edition-and-source-dates', 'recipient-payer-payment-and-consent', 'lower-actions-and-quiet-close'],
        helpers: ['subscription.installSubscriptionFixtures', 'subscription-acceptance.checkSubscriptionState'] },
    { id: 'A06', name: 'Existing subscription service', criteria: ['bounded-multistep-context-and-choice', 'invalid-or-provider-error-and-actions', 'quiet-close-and-return'],
        helpers: ['service.prepareServiceCustomer', 'service.installServiceFixtures', 'service.observeService', 'service.closeService'] },
    { id: 'A07', name: 'Article, catalog and cart', criteria: ['matched-row-paint-and-load-order', 'catalog-long-cart-and-totals', 'coupon-payment-actions-and-close'],
        helpers: ['article.installArticleFixtures', 'article.observeArticle', 'article-acceptance.checkArticleState'] },
    { id: 'A08', name: 'Native subscription dates and article calendar', criteria: ['subscription-native-and-provider-dates', 'article-calendar-states-navigation-and-exit'],
        helpers: ['article-acceptance.inspectArticleCalendar'] },
    { id: 'A09', name: 'Calls, recording, ACW and disposition', criteria: ['separate-queue-and-valid-active-call', 'recording-hold-and-resume', 'actual-end-to-inactive-acw', 'disposition-invalid-followup-and-error'],
        helpers: [], requiresOperationalAfter: true },
    { id: 'A10', name: 'Contact history', criteria: ['empty-long-default-and-highlight', 'native-disclosure-and-focus'],
        helpers: [], requiresOperationalAfter: true },
    { id: 'A11', name: 'Outbox', criteria: ['empty-long-and-restricted', 'menu-disclosure-and-editor', 'real-refresh-focus-and-fallback'],
        helpers: [], requiresOperationalAfter: true },
    { id: 'A12', name: 'Feedback, settings and image review', criteria: ['visible-task-entry-and-ordinary-settings', 'image-annotation-private-error-and-replace', 'quiet-close-and-return'],
        helpers: ['overlays-acceptance.installOverlayTransport'] },
    { id: 'A13', name: 'System and shared overlays', criteria: ['actual-role-denied-and-logged-out', 'toast-inline-error-and-confirmation', 'eligible-dialog-layered-exit-and-return'],
        helpers: ['overlays.accountPage', 'shell-acceptance.inspectRoleShell'] }
]);

// These are required external gates, not implemented or accepted by the baseline registry.
export const finalAuditSupplements = freeze([
    'english-all-13-areas', 'actual-roles-and-short-role-actions', 'coarse-pointer-390-and-320',
    'short-viewport', 'intermediate-and-changed-boundaries', 'motion-preferences',
    'genuine-os-200-percent-five-groups', 'original-guarded-and-integrated-privacy',
    'coexistence-active-task-feedback', 'coexistence-inactive-acw', 'coexistence-outbox-overlays'
]);

const environments = ['chromium', 'firefox'].flatMap(browser => [1440, 390, 320].map(width => ({
    browser, width, height: 1000, locale: 'nl', role: 'kiwi-admin',
    input: 'keyboard-and-pointer', zoom: 100, reducedMotion: 'reduce'
})));
const environmentKeys = Object.keys(environments[0]);
const evidenceKinds = ['actual-application-flow', 'intercepted-fixture-flow'];

function requireCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function requireText(value, name) {
    requireCondition(typeof value === 'string' && value.trim().length > 0, `${name} is required.`);
}

function artifact(value, name) {
    requireText(value?.path, `${name} path`);
    requireCondition(value.path.startsWith('/') && !value.path.split('/').includes('..'), `${name} needs an absolute artifact path.`);
    requireCondition(/^[a-f0-9]{64}$/.test(value.sha256), `${name} SHA-256 is required.`);
}

function environmentMatches(actual, expected) {
    return environmentKeys.every(key => actual?.[key] === expected[key]);
}

function cellId(areaId, environment) {
    return `${areaId}/${environment.browser}/${environment.width}x${environment.height}`;
}

export function createFinalAuditRegistry() {
    return freeze({ marker: 'theme_audit', scope: 'final baseline evidence; no automatic visual acceptance',
        cells: finalAuditAreas.flatMap(area => environments.map(environment => ({
            id: cellId(area.id, environment), areaId: area.id, environment: { ...environment },
            status: 'not reviewed', evidence: [], review: null
        }))), release: null, releaseVerification: null, errors: [] });
}

function validateRegistry(registry) {
    const expected = createFinalAuditRegistry().cells;
    requireCondition(Array.isArray(registry?.cells) && registry.cells.length === expected.length, 'All 78 baseline cells are mandatory.');
    const ids = registry.cells.map(cell => cell.id);
    requireCondition(new Set(ids).size === ids.length, 'Duplicate baseline cell.');
    for (const cell of registry.cells) {
        const original = expected.find(item => item.id === cell.id);
        requireCondition(original && original.areaId === cell.areaId, `Unknown baseline cell: ${cell.id}.`);
        requireCondition(environmentMatches(cell.environment, original.environment), `Unknown environment for ${cell.id}.`);
        requireCondition(['not reviewed', 'accepted', 'deviation', 'blocked'].includes(cell.status), `Unknown review status for ${cell.id}.`);
        requireCondition(Array.isArray(cell.evidence), `Evidence collection missing for ${cell.id}.`);
        requireCondition(cell.status === 'not reviewed' ? cell.review === null : cell.review?.status === cell.status, `Review record missing or inconsistent for ${cell.id}.`);
    }
    if (!registry.releaseVerification) {
        requireCondition(!registry.release && registry.cells.every(cell => !cell.evidence.length && cell.status === 'not reviewed'), 'Evidence cannot precede verified source release.');
        return;
    }
    validateRelease(registry.release);
    const identity = releaseId(registry.release);
    requireCondition(registry.releaseVerification.releaseId === identity, 'Stored source verification differs from the declared release.');
    artifact(registry.releaseVerification.evidence, 'Stored release verification');
    const knownIds = new Set(), imageArtifacts = new Map();
    for (const cell of registry.cells) {
        const area = finalAuditAreas.find(item => item.id === cell.areaId);
        for (const observation of cell.evidence) {
            validateObservation(observation, area, cell.id, knownIds, imageArtifacts);
            validateSession({ handle: 'stored evidence', environment: observation.provenance?.environment,
                sourceReleaseId: observation.provenance?.releaseId, proofs: observation.provenance?.proofs }, cell, identity);
        }
        if (cell.review) validateReview(registry, cell, cell.review);
    }
}

function releaseId(release) {
    // A deterministic identity of the declared proofs; it does not verify their files or contents.
    return [release.source.commit, release.source.manifest.sha256, release.source.runtime.sha256,
        release.source.helpers.sha256, release.slice09.evidence.sha256,
        release.reference.original.sha256, release.reference.refined.sha256, release.sdk.sha256].join(':');
}

function validateRelease(release) {
    requireCondition(release?.slice09?.phase === 'after' && release.slice09.status === 'accepted', 'Accepted slice 09 AFTER evidence is required.');
    requireCondition(/^[a-f0-9]{40}$/.test(release.source?.commit), 'An exact application source commit is required.');
    for (const name of ['manifest', 'runtime', 'helpers']) artifact(release.source[name], `Source ${name}`);
    artifact(release.slice09.evidence, 'Slice 09 acceptance');
    artifact(release.reference?.original, 'Original reference');
    artifact(release.reference?.refined, 'Refined reference');
    artifact(release.sdk, 'Original SDK');
    requireCondition(release.reference.original.sha256 === originalReference, 'The original reference must remain immutable.');
    requireCondition(release.reference.refined.sha256 === refinedReference, 'The approved refined reference is required.');
    requireCondition(release.sdk.sha256 === originalSdk, 'The unchanged original SDK is required.');
}

function validateSession(session, cell, expectedReleaseId) {
    requireCondition(session?.handle !== undefined && session.handle !== null, 'An actual session handle is required.');
    requireCondition(environmentMatches(session.environment, cell.environment), 'Session environment differs from its baseline cell.');
    requireText(session.environment.browserVersion, 'Actual browser version');
    requireCondition(session.sourceReleaseId === expectedReleaseId, 'Session source differs from the verified release.');
    artifact(session.proofs?.source, 'Actual served source proof');
    artifact(session.proofs?.environment, 'Actual environment proof');
    requireCondition(session.proofs?.role?.kind === 'actual-oidc-server-render', 'Actual authenticated server role proof is required; capability fixtures cannot replace it.');
    artifact(session.proofs.role.artifact, 'Actual role proof');
}

function validateObservation(observation, area, id, knownIds, imageArtifacts) {
    requireText(observation?.id, 'Evidence ID');
    requireCondition(!knownIds.has(observation.id), `Duplicate evidence ID: ${observation.id}.`);
    knownIds.add(observation.id);
    requireCondition(area.criteria.includes(observation.criterionId), `Unknown criterion in ${id}: ${observation.criterionId}.`);
    requireText(observation.state, 'Observed application state');
    requireCondition(evidenceKinds.includes(observation.kind), 'An actual application or explicit intercepted fixture flow is required.');
    requireCondition(['verified', 'deviation', 'unverified'].includes(observation.outcome), 'Evidence needs an explicit check outcome.');
    artifact(observation.report, 'Observation report');
    requireCondition(Array.isArray(observation.checkRefs) && observation.checkRefs.length > 0
        && observation.checkRefs.every(ref => typeof ref === 'string' && ref.trim())
        && new Set(observation.checkRefs).size === observation.checkRefs.length, 'Unique actual report check references are required.');
    requireCondition(Array.isArray(observation.images) && observation.images.length > 0, 'Actual image evidence is required.');
    const imageIds = new Set();
    for (const image of observation.images) {
        requireText(image.id, 'Image ID'); artifact(image, 'Actual image');
        requireCondition(!imageIds.has(image.id), `Duplicate image in an observation: ${image.id}.`);
        imageIds.add(image.id);
        const previous = imageArtifacts.get(image.id);
        requireCondition(!previous || (previous.path === image.path && previous.sha256 === image.sha256), `Conflicting image identity: ${image.id}.`);
        imageArtifacts.set(image.id, image);
    }
}

function recordObservations(registry, cell, observations, session) {
    requireCondition(Array.isArray(observations) && observations.length > 0, 'A scene must return actual criterion evidence; empty runs fail.');
    const area = finalAuditAreas.find(item => item.id === cell.areaId);
    const existing = registry.cells.flatMap(item => item.evidence);
    const knownIds = new Set(existing.map(item => item.id));
    const imageArtifacts = new Map(existing.flatMap(item => item.images).map(image => [image.id, image]));
    for (const observation of observations) validateObservation(observation, area, cell.id, knownIds, imageArtifacts);
    const next = structuredClone(registry);
    next.cells.find(item => item.id === cell.id).evidence = observations.map(observation => ({
        ...structuredClone(observation), provenance: { releaseId: session.sourceReleaseId,
            environment: structuredClone(session.environment), proofs: structuredClone(session.proofs) }
    }));
    return freeze(next);
}

/**
 * Hooks are the reviewed I/O boundary, not verification substitutes supplied by this module.
 * verifyRelease must inspect frozen source/runtime/helper/reference/SDK files and accepted09 evidence.
 * openSession installs provenance/transport before navigation and measures actual role/environment.
 * scenes.A01..A13 reuse released page-level helpers; this module imports no runner or controller.
 * closeSession releases fixtures/listeners and closes the context, including failed setup.
 *
 * Artifact = { path: absoluteFile, sha256 }; these declarations require real verification in hooks.
 * verifyRelease({release, releaseId}) -> {releaseId, evidence: Artifact}.
 * openSession({driver, release, releaseId, cell}) -> {handle, sourceReleaseId, environment,
 *   proofs: {source: Artifact, environment: Artifact, role: {kind: 'actual-oidc-server-render', artifact}}}.
 * scenes[areaId](handle, {driver, release, cell, area}) -> observations with criterionId, state,
 *   kind, outcome, report: Artifact, checkRefs, images: [{id, path, sha256}].
 * closeSession(handle, {driver, cell}); it must not leave held requests or shared fixtures alive.
 * Review is a separate immutable ledger operation after all scene execution, never a scene result.
 */
export function createFinalAuditAdapter({ release, driver, hooks }) {
    validateRelease(release);
    for (const name of ['verifyRelease', 'openSession', 'closeSession']) {
        requireCondition(typeof hooks?.[name] === 'function', `Required final hook missing: ${name}.`);
    }
    for (const area of finalAuditAreas) {
        const owner = area.requiresOperationalAfter ? ' (owner-released 09 AFTER)' : '';
        requireCondition(typeof hooks.scenes?.[area.id] === 'function', `Required scene hook missing: ${area.id}${owner}.`);
    }
    requireCondition(Object.keys(hooks.scenes).length === finalAuditAreas.length, 'Unknown or extra final scene hook.');
    requireCondition(hooks.operationalAfter?.phase === 'after' && hooks.operationalAfter.sourceCommit === release.source.commit,
        'Owner-released operational AFTER hooks must match the final source.');
    artifact(hooks.operationalAfter.evidence, 'Operational AFTER hooks');
    for (const name of ['check', 'capture', 'painted', 'saveReport', 'trackStylesheets']) {
        requireCondition(typeof driver?.[name] === 'function', `Existing runner driver method required: ${name}.`);
    }
    const operations = { verifyRelease: hooks.verifyRelease, openSession: hooks.openSession,
        closeSession: hooks.closeSession, scenes: { ...hooks.scenes } };
    const declared = freeze(structuredClone(release)), identity = releaseId(declared);
    let registry = createFinalAuditRegistry(), running = false;
    return {
        snapshot() { return registry; },
        async runCell(id) {
            requireCondition(!running, 'Final scenes run serially; shared fixture ownership cannot overlap.');
            const cell = registry.cells.find(item => item.id === id);
            requireCondition(cell, `Unknown baseline cell: ${id}.`);
            requireCondition(!cell.evidence.length && !registry.errors.some(error => error.cellId === id), 'Use a fresh registry/attempt for a repeated or failed scene.');
            running = true;
            let session;
            try {
                if (!registry.releaseVerification) {
                    const verified = await operations.verifyRelease({ release: declared, releaseId: identity });
                    requireCondition(verified?.releaseId === identity, 'Release verification receipt does not match the declared source.');
                    artifact(verified.evidence, 'Release verification receipt');
                    registry = freeze({ ...registry, release: declared, releaseVerification: structuredClone(verified) });
                }
                session = await operations.openSession({ driver, release: declared, releaseId: identity, cell });
                validateSession(session, cell, identity);
                const area = finalAuditAreas.find(item => item.id === cell.areaId);
                const observations = await operations.scenes[area.id](session.handle, { driver, release: declared, cell, area });
                registry = recordObservations(registry, cell, observations, session);
                return registry;
            } catch (error) {
                registry = freeze({ ...registry, errors: [...registry.errors, { cellId: id, stage: 'session-or-scene', status: 'unverified' }] });
                throw error;
            } finally {
                try {
                    // The owner must clean partial setup before throwing if no handle was returned.
                    if (session?.handle !== undefined && session.handle !== null) await operations.closeSession(session.handle, { driver, cell });
                } catch (error) {
                    registry = freeze({ ...registry, errors: [...registry.errors, { cellId: id, stage: 'cleanup', status: 'unverified' }] });
                    throw error;
                } finally { running = false; }
            }
        }
    };
}

function validateReview(registry, cell, review) {
    const id = cell.id;
    requireCondition(registry.releaseVerification, 'Verified source release is required before review.');
    requireText(review?.reviewer, 'Independent reviewer');
    requireText(review?.decision, 'Review decision');
    requireCondition(['accepted', 'deviation', 'blocked'].includes(review.status), 'Review status must be accepted, deviation or blocked.');
    const area = finalAuditAreas.find(item => item.id === cell.areaId);
    const covered = new Set(cell.evidence.map(item => item.criterionId));
    requireCondition(area.criteria.every(criterion => covered.has(criterion)), 'Missing required criterion evidence.');
    const images = new Map(cell.evidence.flatMap(item => item.images).map(image => [image.id, image]));
    const reviewed = review.images || [];
    requireCondition(reviewed.length === images.size && new Set(reviewed.map(image => image.id)).size === reviewed.length
        && reviewed.every(image => images.has(image.id) && images.get(image.id).sha256 === image.sha256
            && ['accepted', 'deviation', 'blocked'].includes(image.status)),
    'Every actual image needs one explicit review; unknown, duplicate or unreviewed images cannot pass.');
    if (review.status === 'accepted') {
        requireCondition(!registry.errors.some(error => error.cellId === id), 'A failed scene cannot be accepted.');
        requireCondition(cell.evidence.every(item => item.outcome === 'verified'), 'Deviation or unverified checks cannot be accepted.');
        requireCondition(reviewed.every(image => image.status === 'accepted'), 'Unaccepted images cannot pass the cell.');
    }
}

export function reviewFinalAuditCell(registry, id, review) {
    validateRegistry(registry);
    const cell = registry.cells.find(item => item.id === id);
    requireCondition(cell, `Unknown baseline cell: ${id}.`);
    requireCondition(cell.status === 'not reviewed', 'A reviewed cell cannot be silently overwritten; retain the earlier attempt.');
    validateReview(registry, cell, review);
    const next = structuredClone(registry), target = next.cells.find(item => item.id === id);
    target.review = structuredClone(review); target.status = review.status;
    return freeze(next);
}

export function summarizeFinalAudit(registry) {
    validateRegistry(registry);
    const missing = registry.cells.filter(cell => !cell.evidence.length).map(cell => cell.id);
    const unreviewed = registry.cells.filter(cell => cell.status === 'not reviewed').map(cell => cell.id);
    const requiredDeviations = registry.cells.filter(cell => cell.status === 'deviation' || cell.status === 'blocked'
        || cell.evidence.some(item => item.outcome !== 'verified')).map(cell => cell.id);
    return freeze({ baselineCells: registry.cells.length, missing, unreviewed, requiredDeviations,
        sourceVerified: Boolean(registry.releaseVerification), errors: structuredClone(registry.errors),
        baselineAccepted: Boolean(registry.releaseVerification) && !missing.length && !unreviewed.length
            && !requiredDeviations.length && !registry.errors.length,
        finalAcceptance: false, pendingExternalGates: [...finalAuditSupplements],
        limitation: 'This registry cannot accept the full interface, native zoom, privacy or supplemental gates; those require separately reviewed actual evidence.' });
}
