import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const requests = [];
let changed = 0;
const window = {
    kiwiBasePath: '/kiwi',
    kiwiCustomerWorkSession: {
        markChanged() { changed++; },
        getRequestHeaders() { return { 'X-Kiwi-Workflow-Session-Id': 'session-a' }; }
    }
};
vm.runInNewContext(await readFile(new URL('../../../assets/js/api-client.js', import.meta.url), 'utf8'), {
    window,
    fetch: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, status: 200, headers: {get: () => 'application/json'}, json: async () => ({}) };
    }
});

for (const [method, url] of [
    ['get', '/api/v1/persons?name=Example'],
    ['get', '/api/v1/persons/1'],
    ['post', '/api/v1/persons/subscription-summaries'],
    ['post', '/api/v1/customer-work-sessions/reset'],
    ['post', '/api/v1/catalog/article-order-quote'],
    ['post', '/api/v1/call-sessions']
]) {
    await window.kiwiApi[method](url, {});
    assert.equal(changed, 0, url);
}

for (const [method, url] of [
    ['patch', '/api/v1/persons/1'],
    ['post', '/api/v1/persons/1/contact-history'],
    ['put', '/api/v1/persons/state'],
    ['post', '/api/v1/subscriptions/1/2/complaint'],
    ['post', '/api/v1/workflows/subscription'],
    ['post', '/api/v1/workflows/article-order']
]) {
    const before = changed;
    await window.kiwiApi[method](url, {});
    assert.equal(changed, before + 1, url);
    assert.equal(requests.at(-1).options.headers['X-Kiwi-Workflow-Session-Id'], 'session-a');
}
console.log('API client customer session tests passed');
