import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNativeLoginReceiver, nativeLoginExpectation } from './compose-smoke-theme-audit-operational.mjs';

// theme_audit: a current09 registration/transport adapter; the original privacy assertions execute unchanged.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const modulePath = fileURLToPath(import.meta.url);
const referenceHash = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const privacyScriptHash = 'f3e58cf266794c156f10d90cd5ae5c71c884c5844bf2d7eb4a3aff85b8f6fc9d';
const sdkHash = '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c';
const sdkUrl = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm';
const syntheticPerson = '990990';
const syntheticCredential = 'theme-audit-privacy09';

function requireCondition(condition, message) {
    if (!condition) throw new Error(message);
}

export function validatePrivacy09Url(value) {
    const url = new URL(value);
    const local = ['bdc.rtvmedia.org.local', 'localhost', '127.0.0.1'].includes(url.hostname);
    requireCondition(local && ['http:', 'https:'].includes(url.protocol)
        && !url.username && !url.password && !url.search && !url.hash
        && /^\/kiwi(?:-preview)?\/$/.test(url.pathname), 'Privacy09 requires the explicit credential-free local application URL.');
    return url;
}

export function validatePrivacy09Output(value) {
    requireCondition(typeof value === 'string' && path.isAbsolute(value), 'Privacy09 requires an explicit durable evidence directory.');
    const resolved = path.resolve(value);
    requireCondition(!/^\/(?:var\/)?tmp(?:\/|$)/.test(resolved), 'Privacy09 evidence cannot use a temporary directory.');
    return resolved;
}

export function validatePrivacy09Release(release) {
    requireCondition(release?.marker === 'theme_audit' && release.slice === 9 && release.phase === 'after',
        'Privacy09 requires an explicit reviewed slice09/after release.');
    requireCondition(/^[a-f0-9]{40}$/.test(release.applicationHead || ''), 'Privacy09 release needs a source commit.');
    for (const name of ['sourceProof', 'runtimeProof', 'healthProof', 'operationalHelper']) {
        const entry = release[name];
        requireCondition(entry && path.isAbsolute(entry.path) && /^[a-f0-9]{64}$/.test(entry.sha256 || ''),
            'Privacy09 release is missing a pinned proof or helper.');
    }
    requireCondition(release.referenceSha256 === referenceHash && release.privacyScriptSha256 === privacyScriptHash
        && release.sdk?.sha256 === sdkHash && release.sdk.bytes === 26113,
        'Privacy09 must preserve the approved reference, original privacy script and original screenshot SDK.');
    validatePrivacy09Url(release.baseUrl);
}

export function validatePrivacy09Membership(paths, entries) {
    requireCondition(Array.isArray(paths) && Array.isArray(entries) && paths.length >= 200
        && paths.length === entries.length, 'Privacy09 requires the complete production inventory.');
    const validPath = value => typeof value === 'string' && /^(assets|templates|src)\//.test(value)
        && !value.endsWith('.md') && !value.split('/').some(part => part === '..' || part === '.')
        && !value.includes('\\') && !value.includes('\0');
    const expected = new Set(paths);
    requireCondition(expected.size === paths.length && paths.every(validPath), 'Invalid current production path set.');
    const seen = new Set();
    for (const entry of entries) {
        requireCondition(validPath(entry.path) && expected.has(entry.path) && !seen.has(entry.path)
            && /^[a-f0-9]{64}$/.test(entry.sha256 || '') && Number.isInteger(entry.bytes) && entry.bytes >= 0,
            'Invalid or incomplete reviewed production inventory.');
        seen.add(entry.path);
    }
}

function readGit(sourceRoot, args) {
    return execFileSync('git', ['-C', sourceRoot, ...args]);
}

async function readPinnedJson(entry) {
    const raw = await readFile(entry.path);
    requireCondition(hash(raw) === entry.sha256, 'Privacy09 pinned proof changed.');
    return JSON.parse(raw);
}

async function verifyRelease(sourceRoot, baseUrl) {
    requireCondition(process.env.KIWI_THEME_AUDIT_SLICE === '9'
        && process.env.KIWI_THEME_AUDIT_OVERLAY_PHASE === 'after'
        && process.env.KIWI_THEME_AUDIT_OVERLAY_PRIVACY === '1'
        && process.env.KIWI_THEME_AUDIT_OPERATIONAL_PRIVACY === '1',
        'Current privacy checks require explicit slice09/after/operational-privacy mode.');
    const filename = process.env.KIWI_THEME_AUDIT_PRIVACY09_RELEASE;
    const expectedHash = process.env.KIWI_THEME_AUDIT_PRIVACY09_RELEASE_SHA256;
    requireCondition(filename && path.isAbsolute(filename) && /^[a-f0-9]{64}$/.test(expectedHash || ''),
        'Provide the reviewed, hash-pinned Privacy09 release.');
    const release = await readPinnedJson({ path: filename, sha256: expectedHash });
    validatePrivacy09Release(release);
    requireCondition(release.baseUrl === baseUrl.href, 'Privacy09 release URL differs from the actual target.');
    const head = readGit(sourceRoot, ['rev-parse', 'HEAD']).toString().trim();
    requireCondition(head === release.applicationHead, 'Privacy09 source commit changed.');
    const proof = await readPinnedJson(release.sourceProof);
    const runtime = await readPinnedJson(release.runtimeProof);
    const health = await readPinnedJson(release.healthProof);
    requireCondition(proof.head === head && proof.worktree === sourceRoot && proof.referenceSha256 === referenceHash,
        'Privacy09 source proof does not identify this application worktree.');
    const paths = readGit(sourceRoot, ['ls-files', '-z', 'assets', 'templates', 'src']).toString().split('\0')
        .filter(name => name && !name.endsWith('.md')).sort();
    validatePrivacy09Membership(paths, proof.source);
    requireCondition(proof.productionCount === paths.length && runtime.productionCount === paths.length
        && runtime.hostCommittedHead === head && runtime.sourceWorktree === sourceRoot
        && runtime.candidateProofSha256 === release.sourceProof.sha256 && runtime.mismatches === 0,
        'Privacy09 runtime/source proof binding differs.');
    validatePrivacy09Membership(paths, runtime.source);
    const runtimeByPath = new Map(runtime.source.map(entry => [entry.path, entry]));
    const realRoot = await realpath(sourceRoot);
    for (const entry of proof.source) {
        const filename = path.join(sourceRoot, entry.path);
        const actualPath = await realpath(filename);
        requireCondition(actualPath.startsWith(realRoot + path.sep), 'Privacy09 source path leaves the public worktree.');
        const current = await readFile(filename);
        const committed = readGit(sourceRoot, ['show', head + ':' + entry.path]);
        const actualRuntime = runtimeByPath.get(entry.path);
        requireCondition(hash(current) === entry.sha256 && current.length === entry.bytes
            && hash(committed) === entry.sha256 && actualRuntime.sha256 === entry.sha256
            && actualRuntime.bytes === entry.bytes, 'Privacy09 public source changed.');
    }
    requireCondition(health.applicationHead === head && health.url === baseUrl.href
        && health.httpStatus?.kiwiStatus === 200 && health.project === runtime.project
        && health.runtimeSourceProof?.sha256 === release.runtimeProof.sha256
        && health.candidateSourceProof?.sha256 === release.sourceProof.sha256,
        'Privacy09 health proof differs from the reviewed runtime.');
    requireCondition(['app', 'fallback-oidc', 'kiwi-postgres', 'dev-certs'].every(name => health.health?.[name] === 'running healthy')
        && health.health?.gateway === 'running', 'Privacy09 health attestation is not ready.');
    const reference = await readFile(path.join(sourceRoot, 'plans/kiwi-light-and-shadow-theme-palette-showcase.html'));
    requireCondition(hash(reference) === referenceHash, 'Privacy09 reference changed.');
    const original = await readFile(new URL('./compose-smoke-feedback-privacy.mjs', import.meta.url));
    requireCondition(hash(original) === privacyScriptHash, 'Original privacy implementation changed.');
    const helperPath = fileURLToPath(new URL('./compose-smoke-theme-audit-operational.mjs', import.meta.url));
    requireCondition(path.resolve(release.operationalHelper.path) === helperPath
        && hash(await readFile(helperPath)) === release.operationalHelper.sha256, 'Privacy09 native-form helper changed.');
    const sdkFile = process.env.KIWI_THEME_OVERLAY_SDK_FILE;
    requireCondition(sdkFile && path.basename(sdkFile) === 'dom-to-image-more-3.10.1-esm.js',
        'Provide the retained original public SDK artifact.');
    const sdk = await readFile(sdkFile);
    requireCondition(sdk.length === 26113 && hash(sdk) === sdkHash, 'Original screenshot SDK changed.');
    return { filename, sha256: expectedHash, candidateSource: head, files: paths.length,
        referenceSha256: referenceHash, originalPrivacySha256: privacyScriptHash, sdkSha256: sdkHash };
}

export function createPrivacy09Fixture(sourceRoot) {
    const rawSearch = { personId: syntheticPerson, firstName: 'Maria', name: 'Jansen', postCode: '3011BD',
        houseNo: '15', street: 'Wijnhaven', city: 'Rotterdam', eMail: ['maria.jansen@email.nl'],
        phone: ['06-87654321'], divisionId: '14' };
    const rawDetail = { rId: syntheticPerson, personNumber: syntheticPerson, firstName: 'Maria', initials: 'M.',
        surName: '', lastName: 'Jansen', birthDay: '1980-01-01', addressType: { name: 'mevrouw' },
        division: { rId: '14' }, contacts: {
            addresses: [{ address: { street: 'Wijnhaven', housenumber: { housenumber: '15' },
                postCode: '3011BD', city: 'Rotterdam', isoCountryCode: 'NL' }, extension: '' }],
            emails: [{ emailAddress: 'maria.jansen@email.nl' }], phones: [{ number: '06-87654321' }]
        } };
    const php = 'require $argv[1]."/src/Webabo/HupApiCredential.php";'
        + 'require $argv[1]."/src/SubscriptionApi/PersonSearchResultNormalizer.php";'
        + '$c=new \\App\\Webabo\\HupApiCredential($argv[2],"Synthetic privacy09","SYNTHETIC","14",true,null,null,null);'
        + '$n=new \\App\\SubscriptionApi\\PersonSearchResultNormalizer();'
        + 'echo json_encode(["search"=>$n->normalizePerson(json_decode($argv[3],true),$c),'
        + '"detail"=>$n->normalizeDetailPerson(json_decode($argv[4],true),$c,$argv[5])],JSON_THROW_ON_ERROR);';
    const normalized = JSON.parse(execFileSync('php', ['-r', php, sourceRoot, syntheticCredential,
        JSON.stringify(rawSearch), JSON.stringify(rawDetail), syntheticPerson], { encoding: 'utf8' }));
    // This is a declared synthetic address gate result, not a supplier validation or write-policy claim.
    normalized.detail.addressValidation = { status: 'confirmed' };
    const summary = { personId: syntheticPerson, credentialKey: syntheticCredential, state: 'loaded',
        activeCount: 0, activeSubscriptions: [], inactiveSubscription: null };
    return { ...normalized, summary, personId: syntheticPerson, credentialKey: syntheticCredential };
}

export function privacy09CalendarQuery(url, apiPath) {
    if (url.pathname !== apiPath + 'catalog/delivery-calendar' || url.searchParams.size !== 2) return null;
    const yearText = url.searchParams.get('year');
    const monthText = url.searchParams.get('month');
    if (!/^[0-9]{4}$/.test(yearText || '') || !/^(?:[1-9]|1[0-2])$/.test(monthText || '')) return null;
    const year = Number(yearText), month = Number(monthText);
    return year >= 1900 && year <= 2200 ? { year, month } : null;
}

export function createPrivacy09Calendar(sourceRoot, { year, month }) {
    const php = 'require $argv[1]."/src/Service/PocCatalogService.php";'
        + '$catalog=new \\App\\Service\\PocCatalogService($argv[1]);'
        + 'echo json_encode($catalog->getDeliveryCalendar((int)$argv[2],(int)$argv[3]),JSON_THROW_ON_ERROR);';
    return JSON.parse(execFileSync('php', ['-r', php, sourceRoot, String(year), String(month)], { encoding: 'utf8' }));
}

export function privacy09SummaryMatches(payload) {
    return payload && Object.keys(payload).length === 1 && Array.isArray(payload.persons) && payload.persons.length === 1
        && Object.keys(payload.persons[0] || {}).sort().join(',') === 'credentialKey,personId'
        && payload.persons[0].personId === syntheticPerson && payload.persons[0].credentialKey === syntheticCredential;
}

export function privacy09SettingsMatch(payload, baseUrl) {
    const expected = { feedbackEnabled: true, publicBaseUrl: baseUrl.href.replace(/\/$/, ''), imageTtlDays: 14,
        maxImageBytes: 3145728, clearWebhookUrl: false, clearOriginalDataWebhookUrl: false };
    return payload && Object.keys(payload).sort().join(',') === Object.keys(expected).sort().join(',')
        && Object.entries(expected).every(([key, value]) => payload[key] === value);
}

export function privacy09NativeFormMatches(snapshot, postData, actionUrl, origin) {
    const expected = nativeLoginExpectation(snapshot);
    if (!expected || typeof snapshot.action !== 'string') return false;
    let url;
    try { url = new URL(snapshot.action); } catch { return false; }
    if (url.origin !== origin || url.pathname !== '/kiwi-oidc/realms/kiwi-local/login-actions/authenticate'
        || snapshot.action !== actionUrl) return false;
    const actual = [...new URLSearchParams(postData || '').entries()].sort();
    return JSON.stringify(actual) === JSON.stringify(expected);
}

function idleSession() {
    return { active: false, callerType: 'anonymous', customerId: null, customerName: null, serviceNumber: null,
        waitTime: 0, startTime: null, pendingIdentification: null, recordingActive: false,
        totalHoldTime: 0, holdStartTime: null, onHold: false };
}

export async function installPrivacy09Guard(page, driver, fixture) {
    const report = driver.report;
    const baseUrl = driver.baseUrl;
    const api = new URL('api/v1/', baseUrl).pathname;
    const receiver = createNativeLoginReceiver(page, page.mainFrame());
    let authAttempts = 0, settingsPuts = 0, summaries = 0, apiReads = 0, missingResources = 0;
    await page.exposeBinding('__themeAuditPrivacy09NativeForm', (source, snapshot) => {
        const received = receiver.receive(source, snapshot);
        report.nativeFormLifecycle.push({ received, sourcePageMatches: source.page === page,
            sourceMainFrameMatches: source.frame === page.mainFrame() });
        return received;
    });
    await page.addInitScript(() => {
        if (window.top !== window) return;
        document.addEventListener('submit', event => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement) || !form.querySelector('[name=password]')) return;
            void window.__themeAuditPrivacy09NativeForm({ action: form.action,
                entries: [...new FormData(form, event.submitter).entries()], submitterDisabled: Boolean(event.submitter?.disabled) });
        });
    });
    const reads = new Map([
        ['bootstrap', { customers: [], call_session: idleSession(), last_call_session: null,
            call_queue: { enabled: false, queue: [], currentPosition: 0, autoAdvance: true },
            catalog: { serviceNumbers: {}, werfsleutelChannels: {}, werfsleutelCatalog: [] } }],
        ['call-queue', { enabled: false, queue: [], currentPosition: 0, autoAdvance: true }],
        ['call-session', { call_session: idleSession(), last_call_session: null }],
        ['agent-status', { status: 'ready', teams_sync: null }],
        ['workflows/subscription?limit=20', { items: [] }],
        ['outbox-sessions?limit=20&offset=0', { items: [], total: 0 }],
        ['webabo/offers?limit=250', { items: [], total: 0 }],
        ['persons?name=jansen&sortBy=name&page=1&pageSize=200', { items: [fixture.search], total: 1 }],
        ['persons/' + fixture.personId + '?credentialKey=' + fixture.credentialKey + '&sourceSystem=subscription-api', fixture.detail]
    ]);
    await page.route('**/*', async route => {
        const request = route.request(), method = request.method(), url = new URL(request.url());
        const deny = reason => {
            report.blockedWrites.push({ method, pathname: url.origin === baseUrl.origin ? url.pathname : '<external>', reason });
            return route.abort('blockedbyclient');
        };
        if (url.username || url.password) return deny('Credential-bearing URL is forbidden.');
        if (['data:', 'blob:', 'about:'].includes(url.protocol)) return route.fallback();
        if (method === 'GET' && url.href === sdkUrl) return route.fallback();
        if (url.origin !== baseUrl.origin) return deny('Unexpected external request.');
        const missingImagePath = '/kiwi/feedback-fixture-does-not-exist.png';
        const exactMissingImage = url.pathname === missingImagePath
            && url.href === url.origin + missingImagePath + url.search;
        const missingImageQuery = url.search === '' || /^\?[0-9]{13}$/.test(url.search);
        if (method === 'GET' && exactMissingImage && missingImageQuery && !request.isNavigationRequest()
            && ['image', 'xhr'].includes(request.resourceType())) {
            if (missingResources >= 10) return deny('The finite local missing-resource limit was exceeded.');
            missingResources += 1;
            report.localReads.push({ pathname: url.pathname, kind: request.resourceType(), count: missingResources });
            return route.fulfill({ status: 404, body: '' });
        }
        const login = method === 'POST' && url.pathname === '/kiwi-oidc/realms/kiwi-local/login-actions/authenticate';
        if (login && authAttempts === 0 && request.isNavigationRequest() && request.resourceType() === 'document'
            && request.frame() === page.mainFrame()
            && request.headers()['content-type']?.startsWith('application/x-www-form-urlencoded')) {
            authAttempts += 1;
            const snapshot = await receiver.wait();
            if (!privacy09NativeFormMatches(snapshot, request.postData(), url.href, baseUrl.origin)) {
                return deny('Native submit-time successful form proof differs.');
            }
            report.authentications.push({ pathname: url.pathname, selectedRole: 'kiwi-admin', exactFormVerified: true,
                submitterDisabled: snapshot.submitterDisabled,
                fieldNames: [...new Set(snapshot.entries.map(([name]) => name))].sort() });
            return route.continue();
        }
        const loginNavigation = method === 'GET' && request.isNavigationRequest()
            && request.resourceType() === 'document' && request.frame() === page.mainFrame()
            && [new URL('login', baseUrl).pathname, new URL('auth/callback', baseUrl).pathname].includes(url.pathname);
        if (loginNavigation) return route.fallback();
        if (url.pathname.startsWith(api)) {
            const suffix = url.pathname.slice(api.length) + url.search;
            const calendarQuery = method === 'GET' ? privacy09CalendarQuery(url, api) : null;
            if (calendarQuery) {
                if (++apiReads > 200) return deny('The finite local privacy read limit was exceeded.');
                const calendar = createPrivacy09Calendar(driver.sourceRoot, calendarQuery);
                report.localReads.push({ method, pathname: url.pathname, exactQueryVerified: true,
                    sourceGeneratedCalendar: true, noUpstreamRequest: true });
                return route.fulfill({ json: calendar });
            }
            if (method === 'GET' && reads.has(suffix)) {
                if (++apiReads > 200) return deny('The finite local privacy read limit was exceeded.');
                report.localReads.push({ method, pathname: url.pathname, exactQueryVerified: true,
                    sourceShapedSyntheticResponse: true, noUpstreamRequest: true });
                return route.fulfill({ json: reads.get(suffix) });
            }
            if (method === 'GET' && suffix === 'development-feedback/settings') return route.fallback();
            const contentType = request.headers()['content-type'] || '';
            const csrfPresent = Boolean(request.headers()['x-csrf-token']);
            let payload = null;
            if (method === 'POST' || method === 'PUT') { try { payload = request.postDataJSON(); } catch { /* Unmatched payload is denied. */ } }
            if (method === 'PUT' && suffix === 'development-feedback/settings' && settingsPuts < 2 && csrfPresent
                && contentType.startsWith('application/json') && privacy09SettingsMatch(payload, baseUrl)) {
                settingsPuts += 1;
                return route.fallback();
            }
            if (method === 'POST' && suffix === 'persons/subscription-summaries' && summaries < 2 && csrfPresent
                && contentType.startsWith('application/json') && privacy09SummaryMatches(payload)) {
                summaries += 1;
                report.localReads.push({ method, pathname: url.pathname, exactSyntheticIdentityVerified: true,
                    noUpstreamRequest: true, boundary: 'Read-summary POST locally fulfilled only.' });
                return route.fulfill({ json: { items: [fixture.summary] } });
            }
            return deny('Unexpected API request; no business request forwarded.');
        }
        const publicRead = ['GET', 'HEAD'].includes(method)
            && (url.pathname === baseUrl.pathname || url.pathname === baseUrl.pathname.replace(/\/$/, '')
                || url.pathname.startsWith(baseUrl.pathname + 'assets/') || url.pathname.startsWith('/kiwi-oidc/'));
        return publicRead ? route.fallback() : deny('Unexpected request outside the explicit local fixture.');
    });
    return { counts: () => ({ authAttempts, settingsPuts, summaries, apiReads, missingResources }) };
}

export function retainPrivacy09NativeClip(page, mayRetain, save) {
    const originalScreenshot = page.screenshot;
    const screenshot = originalScreenshot.bind(page);
    let retained = false;
    const wrappedScreenshot = async (...args) => {
        const bytes = await screenshot(...args);
        const clip = args[0]?.clip;
        const nativeArea = clip?.width === 320 && clip?.height === 180
            && Number.isFinite(clip.x) && Number.isFinite(clip.y) && clip.x >= 0 && clip.y >= 0;
        if (retained || !nativeArea) return bytes;
        const sceneAllowed = await mayRetain();
        // Another screenshot may claim the baseline while the scene check awaits.
        if (!sceneAllowed || retained) return bytes;
        retained = true;
        await save(bytes, { x: clip.x, y: clip.y, width: clip.width, height: clip.height });
        return bytes;
    };
    page.screenshot = wrappedScreenshot;
    return () => {
        if (page.screenshot === wrappedScreenshot) page.screenshot = originalScreenshot;
    };
}

export async function prepareOperationalLegacyPrivacy({ baseUrl, evidenceDir, installLegacyTransport, trackErrors }) {
    const url = validatePrivacy09Url(baseUrl);
    requireCondition(typeof process.env.KIWI_THEME_APP_ROOT === 'string', 'Privacy09 requires the frozen source worktree.');
    const sourceRoot = path.resolve(process.env.KIWI_THEME_APP_ROOT);
    const output = validatePrivacy09Output(process.env.KIWI_FEEDBACK_EVIDENCE_DIR);
    requireCondition(output === path.resolve(evidenceDir), 'Privacy09 output differs from the guarded original script.');
    let existing = [];
    try { existing = await readdir(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    requireCondition(existing.length === 0, 'Privacy09 requires a fresh evidence directory; historical evidence cannot be overwritten.');
    const sourceProof = await verifyRelease(sourceRoot, url);
    const fixture = createPrivacy09Fixture(sourceRoot);
    const report = { marker: 'theme_audit', slice: 9, phase: 'after', errors: [], blockedWrites: [],
        application: { commit: sourceProof.candidateSource }, nativeFormLifecycle: [], authentications: [], localReads: [],
        overlayEvidence: { phase: 'after', observations: [], fixtureRequests: [], loadedBehavior: [] },
        operationalPrivacy: { sourceProof, module: { path: modulePath, sha256: hash(await readFile(modulePath)) },
            fixture: { personId: fixture.personId, credentialKey: fixture.credentialKey,
                generator: 'Actual PHP PersonSearchResultNormalizer', addressGate: 'Declared synthetic confirmed result; no supplier-policy proof.' },
            boundary: 'Original privacy assertions/64-channel/2percent thresholds and full SDK run unchanged; no upstream business read/write.' } };
    const driver = { baseUrl: url, sourceRoot, report };
    let legacy, guard, restoreNativeClip;
    return {
        async attach(page) {
            // The pinned original script creates its context with serviceWorkers:block in explicit overlay-privacy mode.
            trackErrors(page, driver, { width: 1693, height: 1209 });
            legacy = await installLegacyTransport(page, driver, 'legacy-privacy');
            // The last page route owns the strict09 guard; fallback reaches the original SDK/settings fixtures only.
            guard = await installPrivacy09Guard(page, driver, fixture);
            restoreNativeClip = retainPrivacy09NativeClip(page, async () => {
                const current = new URL(page.url());
                if (current.origin !== url.origin || current.pathname !== url.pathname
                    || report.authentications.length !== 1) return false;
                return page.evaluate(() => document.documentElement.lang === 'en'
                    && document.querySelector('#customerName')?.textContent.includes('Jansen'));
            }, async (bytes, clip) => {
                const filename = path.join(output, 'native-custom-area-baseline.png');
                await writeFile(filename, bytes, { flag: 'wx' });
                report.operationalPrivacy.nativeCustomAreaBaseline = { path: filename, sha256: hash(bytes), clip,
                    boundary: 'Exact original page.screenshot return bytes retained once; identical arguments and returned buffer, no extra screenshot or application change.' };
            });
        },
        async finish() {
            restoreNativeClip?.();
            legacy?.release();
            report.summary = { errors: report.errors.length, blockedRequests: report.blockedWrites.length,
                ...guard?.counts(), localSettingsPuts: legacy?.settingsPuts || 0,
                boundary: 'Whole original privacy script remains authoritative; transport success alone is not privacy acceptance.' };
            await writeFile(path.join(output, 'operational-privacy-transport-report.json'), JSON.stringify(report, null, 2) + '\n');
            requireCondition(report.summary.errors === 0 && report.summary.blockedRequests === 0
                && report.authentications.length === 1 && report.summary.authAttempts === 1,
                'Guarded Privacy09 encountered unexpected runtime/network activity or missing native login proof.');
        }
    };
}
