import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    validatePrivacy09Url, validatePrivacy09Output, validatePrivacy09Release, validatePrivacy09Membership,
    privacy09SummaryMatches, privacy09SettingsMatch, privacy09NativeFormMatches, createPrivacy09Fixture, installPrivacy09Guard, privacy09CalendarQuery, createPrivacy09Calendar, retainPrivacy09NativeClip
} from '../../scripts/compose-smoke-theme-audit-operational-privacy.mjs';

let checks = 0;
function good(condition) { assert.equal(Boolean(condition), true); checks++; }
function rejected(run) { assert.throws(run); checks++; }
const base = new URL('https://bdc.rtvmedia.org.local:9444/kiwi/');
const digest = 'a'.repeat(64);
const release = { marker: 'theme_audit', slice: 9, phase: 'after', applicationHead: 'b'.repeat(40),
    sourceProof: { path: '/durable/source.json', sha256: digest }, runtimeProof: { path: '/durable/runtime.json', sha256: digest },
    healthProof: { path: '/durable/health.json', sha256: digest }, operationalHelper: { path: '/worktree/helper.mjs', sha256: digest },
    referenceSha256: '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb',
    privacyScriptSha256: 'f3e58cf266794c156f10d90cd5ae5c71c884c5844bf2d7eb4a3aff85b8f6fc9d',
    sdk: { sha256: '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c', bytes: 26113 }, baseUrl: base.href };
for (const prefix of ['/kiwi/', '/kiwi-preview/']) {
    const api = prefix + 'api/v1/';
    assert.deepEqual(privacy09CalendarQuery(new URL(api + 'catalog/delivery-calendar?year=2026&month=11', base), api), { year: 2026, month: 11 }); checks++;
    for (const suffix of ['?year=2026', '?year=2026&month=0', '?year=2026&month=13', '?year=2026&month=01',
        '?year=1899&month=1', '?year=2201&month=1', '?year=2026&month=1&extra=1',
        '?year=2026&year=2026', '?year=2026&month=1&month=2', '?year=2026x&month=1']) {
        assert.equal(privacy09CalendarQuery(new URL(api + 'catalog/delivery-calendar' + suffix, base), api), null); checks++;
    }
    assert.equal(privacy09CalendarQuery(new URL(api + 'catalog/delivery-calendar/extra?year=2026&month=1', base), api), null); checks++;
}
const calendarSourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const calendarFixture = createPrivacy09Calendar(calendarSourceRoot, { year: 2026, month: 2 });
assert.equal(calendarFixture.days.length, 28); checks++;
assert.equal(calendarFixture.days[0].date, '2026-02-01'); checks++;
assert.deepEqual(Object.keys(calendarFixture).sort(), ['days', 'minimumDate', 'month', 'monthLabel', 'recommendedDate', 'today', 'year']); checks++;

validatePrivacy09Release(release); checks++;
for (const patch of [{ slice: 8 }, { phase: 'before' }, { applicationHead: 'uncommitted' }, { sourceProof: null },
    { runtimeProof: { path: '/durable/runtime.json', sha256: 'wrong' } }, { referenceSha256: digest },
    { privacyScriptSha256: digest }, { sdk: { sha256: release.sdk.sha256, bytes: 1 } }]) {
    rejected(() => validatePrivacy09Release({ ...release, ...patch }));
}
for (const value of ['https://example.org/kiwi/', 'https://user:fixture@localhost/kiwi/', base.href + '?unexpected=1', base.href + '#fragment']) {
    rejected(() => validatePrivacy09Url(value));
}
good(validatePrivacy09Url(base.href).href === base.href);
for (const value of ['/tmp/evidence', '/var/tmp/evidence', '/durable/../tmp/evidence', 'relative']) rejected(() => validatePrivacy09Output(value));
good(validatePrivacy09Output('/durable/evidence') === '/durable/evidence');
const paths = Array.from({ length: 214 }, (_, index) => 'assets/js/synthetic-' + index + '.js');
const entries = paths.map(path => ({ path, sha256: digest, bytes: 1 }));
validatePrivacy09Membership(paths, entries); checks++;
for (const invalid of [entries.slice(1), [...entries.slice(1), entries[1]], [...entries.slice(1), { ...entries[0], path: 'assets/../outside' }],
    [...entries.slice(1), { ...entries[0], sha256: 'wrong' }], [...entries.slice(1), { ...entries[0], bytes: -1 }]]) {
    rejected(() => validatePrivacy09Membership(paths, invalid));
}
const settings = { feedbackEnabled: true, publicBaseUrl: base.href.replace(/\/$/, ''), imageTtlDays: 14,
    maxImageBytes: 3145728, clearWebhookUrl: false, clearOriginalDataWebhookUrl: false };
good(privacy09SettingsMatch(settings, base));
good(!privacy09SettingsMatch({ ...settings, teamsWebhookUrl: 'unrecognized-property' }, base));
good(!privacy09SettingsMatch({ ...settings, feedbackEnabled: false }, base));
const summary = { persons: [{ personId: '990990', credentialKey: 'theme-audit-privacy09' }] };
good(privacy09SummaryMatches(summary));
good(!privacy09SummaryMatches({ persons: [{ ...summary.persons[0], personId: '42' }] }));
good(!privacy09SummaryMatches({ persons: [...summary.persons, ...summary.persons] }));
const action = new URL('/kiwi-oidc/realms/kiwi-local/login-actions/authenticate?synthetic=1', base).href;
// Public fallback fixture credentials already published in AGENTS.md; no real authentication values are used in this unit test.
const native = { action, submitterDisabled: true,
    entries: [['username', 'kiwi-admin'], ['password', 'kiwi-local-dev-password'], ['credentialId', ''], ['synthetic-field', 'local-fixture']] };
const post = new URLSearchParams(native.entries).toString();
good(privacy09NativeFormMatches(native, post, action, base.origin));
good(!privacy09NativeFormMatches(native, post + '&synthetic-field=duplicate', action, base.origin));
good(!privacy09NativeFormMatches(native, post, action + 'x', base.origin));
good(!privacy09NativeFormMatches({ ...native, action: 'not a URL' }, post, action, base.origin));
good(!privacy09NativeFormMatches(null, post, action, base.origin));
good(!privacy09NativeFormMatches({ ...native, entries: native.entries.filter(([name]) => name !== 'credentialId') }, post, action, base.origin));

const sourceRoot = process.env.KIWI_THEME_PRIVACY_UNIT_SOURCE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const fixture = createPrivacy09Fixture(sourceRoot);
for (const model of [fixture.search, fixture.detail]) {
    good(model.sourceSystem === 'subscription-api' && model.personId === '990990' && model.credentialKey === 'theme-audit-privacy09');
    for (const value of ['Jansen', 'maria.jansen@email.nl', 'Wijnhaven', '3011BD', '06-87654321']) good(JSON.stringify(model).includes(value));
}
good(fixture.detail.addressValidation.status === 'confirmed');
const frame = {}, report = { blockedWrites: [], localReads: [], nativeFormLifecycle: [], authentications: [] };
const page = { mainFrame: () => frame, exposeBinding: async (name, callback) => { page.binding = callback; },
    addInitScript: async observer => { page.observer = observer; }, route: async (pattern, handler) => { page.handler = handler; } };
await installPrivacy09Guard(page, { baseUrl: base, report, sourceRoot: calendarSourceRoot }, fixture);
async function request(pathname, options = {}) {
    let outcome;
    const url = pathname.startsWith('https:') ? pathname : new URL(pathname, base).href;
    const method = options.method || 'GET';
    await page.handler({
        request: () => ({ url: () => url, method: () => method, resourceType: () => options.navigation ? 'document' : 'xhr',
            isNavigationRequest: () => Boolean(options.navigation), frame: () => options.frame || frame,
            headers: () => options.headers || {}, postDataJSON: () => options.payload, postData: () => options.post || '' }),
        fulfill: async response => { outcome = { kind: 'local', response }; },
        fallback: async () => { outcome = { kind: 'fallback' }; },
        continue: async () => { outcome = { kind: 'network-auth' }; },
        abort: async () => { outcome = { kind: 'abort' }; }
    });
    return outcome;
}
good((await request('api/v1/persons?name=jansen&sortBy=name&page=1&pageSize=200')).kind === 'local');
good((await request('api/v1/persons/990990?credentialKey=theme-audit-privacy09&sourceSystem=subscription-api')).kind === 'local');
good((await request('api/v1/persons/42')).kind === 'abort');
good((await request('api/v1/persons?name=another')).kind === 'abort');
good((await request('api/v1/persons/990990', { method: 'PATCH', payload: {} })).kind === 'abort');
good((await request('https://example.invalid/asset?synthetic-private-marker=1')).kind === 'abort');
good(!JSON.stringify(report).includes('synthetic-private-marker'));
good((await request('assets/synthetic.js')).kind === 'fallback');
good((await request('api/v1/unknown')).kind === 'abort');
const nativeBuffer = Buffer.from('synthetic-png-bytes');
const screenshotCalls = [], retainedClips = [];
const screenshotPage = { async screenshot(...args) {
    assert.equal(this, screenshotPage); screenshotCalls.push(args); return nativeBuffer;
} };
let declaredEnglishAppScene = false, sceneChecks = 0;
const originalScreenshot = screenshotPage.screenshot;
const restoreScreenshot = retainPrivacy09NativeClip(screenshotPage,
    async () => { sceneChecks++; return declaredEnglishAppScene; },
    async (bytes, clip) => { retainedClips.push({ bytes, clip }); });
const nativeOptions = { clip: { x: 12, y: 34, width: 320, height: 180 }, animations: 'allow' };
good(await screenshotPage.screenshot() === nativeBuffer);
good(retainedClips.length === 0 && sceneChecks === 0);
good(await screenshotPage.screenshot(nativeOptions) === nativeBuffer);
good(retainedClips.length === 0 && sceneChecks === 1);
good(screenshotCalls[0].length === 0 && screenshotCalls[1][0] === nativeOptions);
declaredEnglishAppScene = true;
good(await screenshotPage.screenshot(nativeOptions) === nativeBuffer);
good(retainedClips.length === 1 && retainedClips[0].bytes === nativeBuffer);
assert.deepEqual(retainedClips[0].clip, nativeOptions.clip); checks++;
good(await screenshotPage.screenshot(nativeOptions) === nativeBuffer);
good(retainedClips.length === 1 && screenshotCalls.length === 4 && sceneChecks === 2);
restoreScreenshot();
good(screenshotPage.screenshot === originalScreenshot);
good(await screenshotPage.screenshot(nativeOptions) === nativeBuffer && retainedClips.length === 1);
const laterOwner = async () => nativeBuffer;
const cleanupSecondRecorder = retainPrivacy09NativeClip(screenshotPage, async () => true, async () => {});
screenshotPage.screenshot = laterOwner;
cleanupSecondRecorder();
good(screenshotPage.screenshot === laterOwner);

const concurrentApprovals = [];
let concurrentCalls = 0, concurrentSaves = 0;
const concurrentPage = { async screenshot() { concurrentCalls++; return nativeBuffer; } };
const restoreConcurrent = retainPrivacy09NativeClip(concurrentPage,
    () => new Promise(resolve => concurrentApprovals.push(resolve)),
    async () => { concurrentSaves++; });
const concurrentFirst = concurrentPage.screenshot(nativeOptions);
const concurrentSecond = concurrentPage.screenshot(nativeOptions);
await Promise.resolve();
await Promise.resolve();
good(concurrentApprovals.length === 2);
for (const approve of concurrentApprovals) approve(true);
const concurrentResults = await Promise.all([concurrentFirst, concurrentSecond]);
good(concurrentResults.every(bytes => bytes === nativeBuffer));
good(concurrentCalls === 2 && concurrentSaves === 1);
restoreConcurrent();

const calendarRoute = 'api/v1/catalog/delivery-calendar?year=2026&month=11';
good((await request(calendarRoute)).kind === 'local');
good((await request(calendarRoute, { method: 'POST' })).kind === 'abort');
good((await request(calendarRoute, { method: 'HEAD' })).kind === 'abort');
good((await request(calendarRoute + '&extra=1')).kind === 'abort');
good((await request('https://example.invalid/kiwi/' + calendarRoute)).kind === 'abort');

const jsonHeaders = { 'content-type': 'application/json', 'x-csrf-token': 'synthetic-present' };
good((await request('api/v1/development-feedback/settings', { method: 'PUT', headers: jsonHeaders, payload: { ...settings, extra: true } })).kind === 'abort');
for (let index = 0; index < 2; index++) good((await request('api/v1/development-feedback/settings', { method: 'PUT', headers: jsonHeaders, payload: settings })).kind === 'fallback');
good((await request('api/v1/development-feedback/settings', { method: 'PUT', headers: jsonHeaders, payload: settings })).kind === 'abort');
good((await request('api/v1/persons/subscription-summaries', { method: 'POST', headers: jsonHeaders, payload: summary })).kind === 'local');
good((await request('api/v1/persons/subscription-summaries', { method: 'POST', headers: jsonHeaders, payload: { persons: [] } })).kind === 'abort');
good((await page.binding({ page, frame: {} }, native)) === false);
good((await page.binding({ page, frame }, native)) === true);
good((await request(action, { method: 'POST', navigation: true, frame: {},
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, post })).kind === 'abort');
good((await request(action, { method: 'POST', navigation: true,
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, post })).kind === 'network-auth');
good((await request(action, { method: 'POST', navigation: true,
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, post })).kind === 'abort');
good(report.authentications.length === 1 && !JSON.stringify(report).includes('kiwi-local-dev-password'));


async function verifyLoginNavigationRoutes(prefix) {
    const navigationBase = new URL(prefix, base.origin);
    const navigationFrame = {};
    const navigationReport = { blockedWrites: [], localReads: [], nativeFormLifecycle: [], authentications: [] };
    const navigationPage = { mainFrame: () => navigationFrame, exposeBinding: async () => {},
        addInitScript: async () => {}, route: async (pattern, handler) => { navigationPage.handler = handler; } };
    await installPrivacy09Guard(navigationPage, { baseUrl: navigationBase, report: navigationReport }, fixture);
    async function navigate(relativePath, options = {}) {
        let result;
        const url = new URL(relativePath, navigationBase);
        if (options.external) url.hostname = 'example.invalid';
        await navigationPage.handler({
            request: () => ({ url: () => url.href, method: () => options.method || 'GET',
                isNavigationRequest: () => options.navigation !== false,
                resourceType: () => options.resourceType || 'document',
                frame: () => options.childFrame ? {} : navigationFrame,
                headers: () => ({}), postDataJSON: () => null }),
            fallback: async () => { result = 'fallback'; },
            fulfill: async () => { result = 'local'; },
            continue: async () => { result = 'network-auth'; },
            abort: async () => { result = 'abort'; }
        });
        return result;
    }
    for (const route of ['login', 'auth/callback']) {
        good(await navigate(route + '?synthetic-native-query=present') === 'fallback');
        good(await navigate(route, { childFrame: true }) === 'abort');
        good(await navigate(route, { resourceType: 'script' }) === 'abort');
        good(await navigate(route, { navigation: false }) === 'abort');
        good(await navigate(route, { method: 'POST' }) === 'abort');
        good(await navigate(route, { method: 'HEAD' }) === 'abort');
        good(await navigate(route, { external: true }) === 'abort');
        good(await navigate(route + '/extra') === 'abort');
        const otherPrefix = prefix === '/kiwi/' ? '/kiwi-preview/' : '/kiwi/';
        good(await navigate(otherPrefix + route) === 'abort');
    }
    good(!JSON.stringify(navigationReport).includes('synthetic-native-query'));
}
await verifyLoginNavigationRoutes('/kiwi/');
await verifyLoginNavigationRoutes('/kiwi-preview/');

async function verifyOriginalMissingImage(prefix) {
    const resourceBase = new URL(prefix, base.origin), resourceFrame = {};
    const resourceReport = { blockedWrites: [], localReads: [], nativeFormLifecycle: [], authentications: [] };
    const resourcePage = { mainFrame: () => resourceFrame, exposeBinding: async () => {}, addInitScript: async () => {},
        route: async (_pattern, handler) => { resourcePage.handler = handler; } };
    const resourceGuard = await installPrivacy09Guard(resourcePage, { baseUrl: resourceBase, report: resourceReport }, fixture);
    let forwarded = 0;
    async function resource(target, options = {}) {
        let outcome;
        const url = new URL(target, resourceBase);
        await resourcePage.handler({
            request: () => ({ url: () => url.href, method: () => options.method || 'GET',
                resourceType: () => options.kind || 'image', isNavigationRequest: () => Boolean(options.navigation),
                frame: () => resourceFrame, headers: () => ({}), postDataJSON: () => null }),
            fulfill: async response => { outcome = { kind: 'local', response }; },
            fallback: async () => { forwarded++; outcome = { kind: 'fallback' }; },
            continue: async () => { forwarded++; outcome = { kind: 'network' }; },
            abort: async () => { outcome = { kind: 'abort' }; }
        });
        return outcome;
    }
    const missing = '/kiwi/feedback-fixture-does-not-exist.png';
    const timestamp = '1700000000000';
    for (const target of [missing + '?', missing + '#query-must-not-persist', missing + '?query-must-not-persist=1',
        missing + '?t=' + timestamp, missing + '?' + timestamp + '&extra=1', missing + '?' + timestamp + '&' + timestamp,
        missing + '?170000000000', missing + '?17000000000000', missing + '?170000000000x', missing + '?%31' + timestamp.slice(1),
        missing + '?' + timestamp + '#query-must-not-persist', missing + '/extra', missing + '/', missing + 'x',
        '/kiwi/%66eedback-fixture-does-not-exist.png', '/kiwi-preview/feedback-fixture-does-not-exist.png',
        '/feedback-fixture-does-not-exist.png', new URL(missing, 'https://example.invalid').href,
        new URL(missing, 'https://bdc.rtvmedia.org.local:9445').href, new URL(missing, 'http://bdc.rtvmedia.org.local:9444').href,
        'https://synthetic@bdc.rtvmedia.org.local:9444' + missing]) good((await resource(target)).kind === 'abort');
    for (const method of ['HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) good((await resource(missing, { method })).kind === 'abort');
    for (const kind of ['document', 'fetch', 'script', 'stylesheet', 'font', 'media', 'other']) good((await resource(missing, { kind })).kind === 'abort');
    good((await resource(missing, { navigation: true })).kind === 'abort');
    assert.equal(resourceReport.localReads.length, 0, 'denied requests cannot become local fixture responses'); checks++;
    for (const kind of ['image', 'xhr']) {
        for (const query of ['', '?' + timestamp]) {
            const result = await resource(missing + query, { kind });
            good(result.kind === 'local');
            assert.deepEqual(result.response, { status: 404, body: '' }); checks++;
        }
    }
    for (let index = 4; index < 10; index++) good((await resource(missing + '?' + String(1700000000000 + index), { kind: index % 2 ? 'image' : 'xhr' })).kind === 'local');
    for (const kind of ['image', 'xhr']) good((await resource(missing + '?' + timestamp, { kind })).kind === 'abort');
    good(resourceGuard.counts().missingResources === 10);
    good(resourceReport.localReads.length === 10 && forwarded === 0);
    resourceReport.localReads.forEach((entry, index) => {
        assert.deepEqual(Object.keys(entry).sort(), ['count', 'kind', 'pathname']); checks++;
        good(entry.pathname === missing && ['image', 'xhr'].includes(entry.kind) && entry.count === index + 1);
    });
    good(!JSON.stringify(resourceReport).includes(timestamp));
    good(!JSON.stringify(resourceReport).includes('query-must-not-persist'));
}
await verifyOriginalMissingImage('/kiwi/');
await verifyOriginalMissingImage('/kiwi-preview/');

const moduleFile = fileURLToPath(new URL('../../scripts/compose-smoke-theme-audit-operational-privacy.mjs', import.meta.url));
execFileSync(process.execPath, ['--permission',
    '--allow-fs-read=' + fileURLToPath(new URL('.', import.meta.url)),
    '--allow-fs-read=' + (process.env.KIWI_THEME_PRIVACY_UNIT_IMPORT_ROOT || fileURLToPath(new URL('../../scripts', import.meta.url))),
    '--allow-fs-read=' + fileURLToPath(new URL('../../scripts', import.meta.url)),
    '--input-type=module', '-e', 'await import(' + JSON.stringify(new URL('file://' + moduleFile).href) + ');'], { stdio: 'pipe' });
checks++;
console.log('PASS ' + checks + ' bounded privacy09 config/source-membership/native-form/strict-route/fixture/safe-import checks; no browser or upstream request.');
