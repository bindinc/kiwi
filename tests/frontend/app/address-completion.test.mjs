import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAddressCompletion, endAddressSessions, normalizeAddressInput } from '../../../assets/js/app/address-completion.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
afterEach(() => endAddressSessions());
function fixture(options = {}) {
    const fields = Object.fromEntries(Object.entries({ postalCode: '1231 aa', houseNumber: '1', addition: '', street: '', city: '' }).map(([key, value]) => [key, { value }]));
    const requests = [];
    const reports = [];
    const timers = new Map();
    let id = 0;
    let uuidCount = 0;
    const pending = [];
    const form = createAddressCompletion({ fields, report: (value) => reports.push(value),
        uuid: () => `form-${++uuidCount}`,
        schedule(fn, delay) { assert.equal(delay, 350); timers.set(++id, fn); return id; },
        cancel(timer) { timers.delete(timer); },
        request(path, data) {
            requests.push({ path, ...data, payload: data.body ? JSON.parse(data.body) : null });
            return data.method === 'DELETE' ? Promise.resolve(null) : new Promise((resolve, reject) => pending.push({ resolve, reject }));
        }, ...options
    });
    return { form, fields, requests, reports, pending, flush() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((fn) => fn()); } };
}
const matched = (street = 'Rembrandtlaan', addition = '', number = '1') => ({ status: 'matched', candidates: [{ street, city: 'Loosdrecht', postalCode: '1231AA', houseNumber: number, houseNumberAddition: addition }] });

test('normalizes Dutch input without looking up incomplete values', () => {
    assert.deepEqual(normalizeAddressInput('1231 aa', '1a', '2'), { postalCode: '1231AA', houseNumber: '1' });
    assert.equal(normalizeAddressInput('123', '1'), null);
    const f = fixture();
    assert.equal(f.requests.length, 0);
    f.fields.houseNumber.value = '';
    f.form.input(); f.flush();
    assert.equal(f.requests.length, 0);
});

test('debounces, deduplicates in-flight calls and reuses one session', async () => {
    const f = fixture();
    f.form.input(); f.form.input(); f.flush();
    f.form.input(); f.flush();
    assert.equal(f.requests.length, 1);
    f.pending[0].resolve(matched()); await tick(); f.form.select(0);
    assert.equal(f.fields.street.value, 'Rembrandtlaan');
    f.fields.houseNumber.value = '2'; f.form.input();
    assert.equal(f.fields.street.value, '');
    f.flush(); f.pending[1].resolve(matched('Rembrandtlaan', '', '2')); await tick(); f.form.select(0);
    assert.equal(f.requests[0].payload.formSessionId, f.requests[1].payload.formSessionId);
});

test('ignores stale results after edits and session termination', async () => {
    const f = fixture();
    f.form.input(); f.flush();
    f.fields.houseNumber.value = '2'; f.form.input(); f.flush();
    f.pending[1].resolve(matched('New', '', '2')); await tick(); f.form.select(0);
    f.pending[0].resolve(matched('Old')); await tick(); f.form.select(0);
    assert.equal(f.fields.street.value, 'New');
    f.fields.houseNumber.value = '3'; f.form.input(); f.flush();
    f.form.destroy(); f.pending[2].resolve(matched('Closed')); await tick(); f.form.select(0);
    assert.equal(f.fields.street.value, '');
    assert.equal(f.requests.at(-1).method, 'DELETE');
});

test('preserves manual correction even when changed back during the request', async () => {
    const f = fixture();
    f.form.input(); f.flush();
    f.fields.street.value = 'Handmatig'; f.form.manualInput();
    f.fields.street.value = ''; f.form.manualInput();
    f.pending[0].resolve(matched()); await tick(); f.form.select(0);
    assert.equal(f.fields.street.value, '');
});

test('failure remains editable and retry retains the form session', async () => {
    const f = fixture();
    f.form.input(); f.flush(); f.pending[0].reject(new Error('offline')); await tick(); f.form.select(0);
    assert.equal(f.reports.at(-1), 'unavailable');
    f.form.retry(); f.flush();
    assert.equal(f.requests[1].payload.formSessionId, f.requests[0].payload.formSessionId);
    f.pending[1].resolve({ status: 'ambiguous' }); await tick(); f.form.select(0);
    assert.equal(f.fields.street.value, '');
    assert.equal(f.reports.at(-1), 'ambiguous');
});

test('form reset ends UUID; failed submit does not end UUID', async () => {
    const f = fixture();
    f.form.input(); f.flush(); f.pending[0].resolve(matched()); await tick(); f.form.select(0);
    // Failed submits leave the visible form in place and do not call reset/destroy.
    f.fields.houseNumber.value = '2'; f.form.input(); f.flush();
    assert.equal(f.requests[1].payload.formSessionId, 'form-1');
    f.form.reset(); f.form.input(); f.flush();
    assert.equal(f.requests.at(-1).payload.formSessionId, 'form-2');
});

test('restitution preserves street and number format', async () => {
    const f = fixture({ includeNumber: true });
    f.fields.houseNumber.value = '1A'; f.fields.addition.value = '2';
    f.form.input(); f.flush(); f.pending[0].resolve(matched('Rembrandtlaan', 'A 2')); await tick(); f.form.select(0);
    assert.equal(f.fields.street.value, 'Rembrandtlaan 1 A 2');
    f.fields.addition.value = 'B'; f.form.manualInput('addition'); f.flush();
    assert.equal(f.fields.street.value, 'Rembrandtlaan 1 B');
    assert.equal(f.requests.length, 1);
});

test('expiry rotates the session and customer switch closes every form', async () => {
    let time = Date.parse('2026-09-17T23:59:00Z');
    const f = fixture({ now: () => time });
    f.form.input(); f.flush(); f.pending[0].resolve(matched()); await tick(); f.form.select(0);
    time += 120000;
    f.fields.houseNumber.value = '2'; f.form.input(); f.flush();
    assert.equal(f.requests[1].method, 'DELETE');
    assert.equal(f.requests[2].payload.formSessionId, 'form-2');
    endAddressSessions();
    assert.equal(f.requests.at(-1).method, 'DELETE');
});

test('invalidates only provider-owned fields after a manual street correction', async () => {
    const f = fixture();
    f.form.input(); f.flush(); f.pending[0].resolve(matched()); await tick(); f.form.select(0);
    f.fields.street.value = 'Handmatige straat'; f.form.manualInput('street');
    f.fields.houseNumber.value = '2'; f.form.input();
    assert.equal(f.fields.street.value, 'Handmatige straat');
    assert.equal(f.fields.city.value, '');
});


test('waits for selection and never sends or filters on a manually edited addition', async () => {
    const f = fixture();
    f.fields.addition.value = 'OLD';
    f.form.input(); f.flush();
    assert.equal('houseNumberAddition' in f.requests[0].payload, false);
    f.fields.addition.value = 'MANUAL'; f.form.manualInput('addition');
    f.pending[0].resolve({ status: 'ambiguous', candidates: [matched().candidates[0], matched('Rembrandtlaan', 'A').candidates[0]] });
    await tick();
    assert.equal(f.fields.street.value, '');
    assert.equal(f.fields.addition.value, 'MANUAL');
    assert.equal(f.reports.at(-1), 'results');
    f.form.select(1);
    assert.equal(f.fields.addition.value, 'A');
    assert.equal(f.fields.street.value, 'Rembrandtlaan');
    f.fields.addition.value = 'B'; f.form.manualInput('addition'); f.flush();
    assert.equal(f.requests.length, 1);
    f.form.select(0);
    assert.equal(f.fields.addition.value, '');
});

test('unknown Webabo addition preserves manual input and old choices cannot be selected', async () => {
    const f = fixture();
    f.fields.addition.value = 'A';
    f.form.input(); f.flush(); f.pending[0].resolve(matched('Rembrandtlaan', null)); await tick();
    f.form.select(0);
    assert.equal(f.fields.addition.value, 'A');
    f.fields.houseNumber.value = '2'; f.form.input(); f.form.select(0);
    assert.equal(f.fields.street.value, '');
    assert.equal(f.fields.addition.value, 'A');
});
