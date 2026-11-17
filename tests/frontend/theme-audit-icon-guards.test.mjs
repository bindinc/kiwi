import assert from 'node:assert/strict';
import test from 'node:test';
import { createIconApiGuard, pinIconLoginAction, isIconLoginNavigation, nativeNoRoleLoginFormMatches } from '../../scripts/theme-audit-icon-guards.mjs';

const baseUrl = new URL('https://bdc.rtvmedia.org.local:9444/kiwi/');
const read = '/kiwi/api/v1/bootstrap';
const write = '/kiwi/api/v1/call-session/hold';

test('only exact GET fixtures and declared command tuples delegate; HEAD and both-base unknown APIs abort', async () => {
    const deniedRequests = [], guard = createIconApiGuard({ baseUrl, knownReads: new Set([read]),
        knownWrites: new Set(['POST ' + write]), deniedRequests });
    async function run(method, suffix, origin = baseUrl.origin) {
        const actions = [];
        await guard({ request: () => ({ method: () => method, url: () => origin + suffix }),
            fallback: async () => { actions.push('delegate'); }, abort: async () => { actions.push('abort'); },
            continue: async () => { throw new Error('The outer guard must never forward an API request.'); } });
        return actions;
    }
    assert.deepEqual(await run('GET', read), ['delegate']);
    assert.deepEqual(await run('POST', write), ['delegate']);
    for (const [method, suffix, origin] of [
        ['HEAD', read], ['POST', read], ['PUT', write], ['OPTIONS', read], ['GET', read + '?unexpected=1'],
        ['POST', write + '?unexpected=1'], ['GET', '/kiwi-preview/api/v1/bootstrap'],
        ['GET', '/kiwi/api/v1/persons/unknown'], ['DELETE', '/kiwi-preview/api/v1/persons/unknown'],
        ['GET', read, 'https://untrusted.invalid'], ['GET', read, 'https://credentials@bdc.rtvmedia.org.local:9444']
    ]) assert.deepEqual(await run(method, suffix, origin), ['abort']);
    assert.equal(deniedRequests.length, 11);
    assert.deepEqual(await run('GET', '/kiwi/assets/public.js'), ['delegate']);
});

test('native login pins the local authenticate action before the browser can submit', () => {
    const path = '/kiwi-oidc/realms/kiwi-local/login-actions/authenticate';
    assert.doesNotThrow(() => pinIconLoginAction(baseUrl.origin + path + '?synthetic=1', baseUrl));
    for (const action of ['https://untrusted.invalid' + path, baseUrl.origin + '/wrong',
        'https://credentials@bdc.rtvmedia.org.local:9444' + path,
        baseUrl.origin + '/kiwi-oidc/realms/different/login-actions/authenticate']) {
        assert.throws(() => pinIconLoginAction(action, baseUrl), /exact local OIDC/);
    }
});

test('native login requests must be a main-frame document POST, independently of their full-body fixture gate', () => {
    const frame = {}, request = overrides => ({ method: () => 'POST', isNavigationRequest: () => true,
        resourceType: () => 'document', frame: () => frame, ...overrides });
    assert.equal(isIconLoginNavigation(request(), frame), true);
    for (const override of [{ method: () => 'GET' }, { isNavigationRequest: () => false },
        { resourceType: () => 'fetch' }, { frame: () => ({}) }]) {
        assert.equal(isIconLoginNavigation(request(override), frame), false);
    }
});

test('no-role login accepts only the exact native one-account form body', () => {
    const entries = [['username', 'donny'], ['password', 'kiwi-local-dev-password'], ['opaque-local-field', 'fictional-native-value'], ['login', 'Sign In']];
    const snapshot = { entries, submitterDisabled: false };
    const body = new URLSearchParams(entries).toString();
    assert.equal(nativeNoRoleLoginFormMatches(snapshot, body), true);
    const disabledEntries = entries.filter(([key]) => key !== 'login');
    assert.equal(nativeNoRoleLoginFormMatches({ entries: disabledEntries, submitterDisabled: true }, new URLSearchParams(disabledEntries).toString()), true);
    assert.equal(nativeNoRoleLoginFormMatches({ entries: disabledEntries, submitterDisabled: true }, body), false);
    for (const candidate of [null, { entries },
        { ...snapshot, entries: [...entries, ['username', 'donny']] },
        { ...snapshot, entries: entries.map(([key, value]) => [key, key === 'username' ? 'kiwi-admin' : value]) },
        { ...snapshot, entries: entries.map(([key, value]) => [key, key === 'password' ? 'fictional-wrong-value' : value]) },
        { ...snapshot, entries: [[12, 'donny']] }]) {
        assert.equal(nativeNoRoleLoginFormMatches(candidate, body), false);
    }
    assert.equal(nativeNoRoleLoginFormMatches(snapshot, body + '&unexpected=fictional'), false);
    assert.equal(nativeNoRoleLoginFormMatches(snapshot, new URLSearchParams(entries.slice(0, -1)).toString()), false);
    assert.equal(nativeNoRoleLoginFormMatches(snapshot, body.replace('fictional-native-value', 'changed-native-value')), false);
});
import { redactIconProcessOutput } from '../../scripts/theme-audit-icon-log-redaction.mjs';

test('process logs redact complete auth headers and quoted token assignments before output', () => {
    const canary = 'fictional-canary-value';
    const inputs = [
        `Authorization: Bearer ${canary}`,
        `authorization=Basic ${canary}`,
        `Cookie: session=${canary}; other=${canary}`,
        JSON.stringify({ access_token: canary, refresh_token: canary, id_token: canary, client_secret: canary, session_code: canary }),
        `{'access_token': '${canary}'}`,
        `access_token=${canary}; refresh_token=${canary}`,
        `https://local.invalid/login?session_code=${canary}`
    ];
    for (const input of inputs) assert.ok(!redactIconProcessOutput(input).includes(canary));
    assert.equal(redactIconProcessOutput('73 checks passed; ratio 0.012'), '73 checks passed; ratio 0.012');
    assert.equal(redactIconProcessOutput(null), '');
});
