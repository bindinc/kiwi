import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEditorDocument } from '../support/editor-dom.mjs';
import { createSubscriptionStartDates, localCalendarDate } from '../../../assets/js/app/subscription-start-dates.js';

function fixture(fetchDate) {
    const document = createEditorDocument();
    const nodes = {};
    for (const id of ['subscriptionStartDates', 'membershipStartDate', 'subStartDate']) {
        nodes[id] = document.createElement('div');
        nodes[id].id = id;
        document.body.append(nodes[id]);
    }
    document.getElementById = (id) => {
        const find = (node) => node.id === id ? node : node.children.map(find).find(Boolean);
        return find(document.body);
    };
    let context = 'customer-a';
    const dates = createSubscriptionStartDates({ document, fetchDate, getContext: () => context, translate: (key) => key });
    return { dates, nodes, document, setContext: (value) => { context = value; } };
}

const guide = (salesCode = 'GUIDE-A', variantCodes = ['STANDARD']) => ({
    salesCode, title: 'Synthetic guide', productCode: salesCode, credentialKey: 'mandant-a', subscriptionKind: 'guide', variantCodes
});
const selections = (...offers) => offers.map((selectedKey) => ({ selectedKey }));
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('single edition uses provider date and keeps different product dates separate', async () => {
    const a = guide(); const b = guide('GUIDE-B');
    const { dates, nodes } = fixture(async (code, variantCode) => ({ variantCode, startDate: code === a.salesCode ? '2035-03-26' : '2035-03-27' }));
    await dates.sync(selections(a, b));
    assert.deepEqual(dates.read(a), { variantCode: 'STANDARD', startDate: '2035-03-26' });
    assert.equal(dates.read(b).startDate, '2035-03-27');
    assert.equal(nodes.membershipStartDate.hidden, true);
    assert.equal(nodes.subStartDate.required, false);
});

test('membership retains its editable date without a source request, including mixed orders', async () => {
    let calls = 0;
    const { dates, nodes } = fixture(async (_code, variantCode) => { calls += 1; return { variantCode, startDate: '2035-03-26' }; });
    const member = { salesCode: 'MEMBER', subscriptionKind: 'membership' };
    nodes.subStartDate.value = '2035-03-25';
    await dates.sync(selections(member));
    assert.equal(calls, 0);
    assert.equal(dates.read(member).startDate, '2035-03-25');
    assert.equal(nodes.membershipStartDate.hidden, false);
    assert.equal(nodes.subStartDate.required, true);
    await dates.sync(selections(member, guide()));
    assert.equal(calls, 1);
    assert.equal(dates.read(member).startDate, '2035-03-25');
});

test('multiple editions wait for explicit selection and correction restores the stored edition', async () => {
    const calls = [];
    const { dates, document } = fixture(async (_code, variantCode) => { calls.push(variantCode); return { variantCode, startDate: '2035-03-26' }; });
    const offer = guide('GUIDE', ['NORTH', 'SOUTH']);
    await dates.sync(selections(offer));
    assert.equal(calls.length, 0);
    assert.throws(() => dates.read(offer), /chooseEdition/);
    const select = document.getElementById('subscription-edition-GUIDE');
    select.value = 'SOUTH'; select.emit('change');
    await tick();
    assert.equal(dates.read(offer).variantCode, 'SOUTH');
    await dates.sync(selections(offer), true);
    await dates.restore({ ...offer, variantCode: 'SOUTH' });
    assert.deepEqual(calls, ['SOUTH', 'SOUTH']);
});

test('out of order edition responses cannot overwrite the latest selection', async () => {
    const pending = [];
    const { dates, document } = fixture((_code, variantCode) => new Promise((resolve) => pending.push({ variantCode, resolve })));
    const offer = guide('GUIDE', ['NORTH', 'SOUTH']);
    await dates.sync(selections(offer));
    let select = document.getElementById('subscription-edition-GUIDE');
    select.value = 'NORTH'; select.emit('change');
    select = document.getElementById('subscription-edition-GUIDE');
    select.value = 'SOUTH'; select.emit('change');
    pending[1].resolve({ variantCode: 'SOUTH', startDate: '2035-03-27' }); await tick();
    pending[0].resolve({ variantCode: 'NORTH', startDate: '2035-03-26' }); await tick();
    assert.deepEqual(dates.read(offer), { variantCode: 'SOUTH', startDate: '2035-03-27' });
});

test('changing customer context rejects a pending result and invalidates ready dates', async () => {
    let resolve;
    const { dates, setContext } = fixture(() => new Promise((done) => { resolve = done; }));
    const offer = guide();
    const loading = dates.sync(selections(offer));
    assert.throws(() => dates.read(offer), /loading/);
    setContext('customer-b');
    resolve({ variantCode: 'STANDARD', startDate: '2035-03-26' }); await loading;
    assert.throws(() => dates.read(offer), /changed/);
});

test('removed or replaced offer cannot reuse a pending source date', async () => {
    let resolve;
    const { dates } = fixture(() => new Promise((done) => { resolve = done; }));
    const offer = guide();
    const loading = dates.sync(selections(offer));
    await dates.sync([]);
    resolve({ variantCode: 'STANDARD', startDate: '2035-03-26' }); await loading;
    assert.throws(() => dates.read(offer), /changed/);
});

test('provider errors expose an inline retry and never a fallback date', async () => {
    let calls = 0;
    const { dates, nodes } = fixture(async (_code, variantCode) => {
        if (++calls === 1) throw new Error('Provider unavailable');
        return { variantCode, startDate: '2035-03-26' };
    });
    const offer = guide();
    await dates.sync(selections(offer));
    assert.throws(() => dates.read(offer), /unavailable/);
    const retry = nodes.subscriptionStartDates.querySelectorAll('button')[0];
    retry.emit('click'); await tick();
    assert.equal(dates.read(offer).startDate, '2035-03-26');
});

test('save-time rejection clears only the rejected guide and makes its fresh date recoverable', async () => {
    let nextDate = '2035-03-26';
    const { dates, nodes } = fixture(async (_code, variantCode) => ({ variantCode, startDate: nextDate }));
    const offer = guide();
    const other = guide('GUIDE-B');
    const membership = { salesCode: 'MEMBER', subscriptionKind: 'membership' };
    nodes.subStartDate.value = '2035-03-25';
    await dates.sync(selections(offer, other, membership));
    dates.reject(offer, 'STANDARD');
    assert.throws(() => dates.read(offer), /unavailable/);
    assert.equal(dates.read(other).startDate, '2035-03-26');
    assert.equal(dates.read(membership).startDate, '2035-03-25');
    nextDate = '2035-03-27';
    nodes.subscriptionStartDates.querySelectorAll('button')[0].emit('click');
    await tick();
    assert.equal(dates.read(offer).startDate, '2035-03-27');
});

test('a pending response cannot repopulate a date rejected at save time', async () => {
    let resolve;
    const { dates } = fixture(() => new Promise((done) => { resolve = done; }));
    const offer = guide();
    const loading = dates.sync(selections(offer));
    dates.reject(offer, 'STANDARD');
    resolve({ variantCode: 'STANDARD', startDate: '2035-03-26' });
    await loading;
    assert.throws(() => dates.read(offer), /unavailable/);
});

test('a past date, invalid calendar date or mismatched edition cannot be submitted', async () => {
    for (const [startDate, variantCode] of [['2000-01-01', 'STANDARD'], ['2035-02-30', 'STANDARD'], ['2035-03-26', 'OTHER']]) {
        const { dates } = fixture(async () => ({ startDate, variantCode }));
        const offer = guide();
        await dates.sync(selections(offer));
        assert.throws(() => dates.read(offer), /unavailable/);
    }
});

test('membership defaults use local calendar components without a UTC date conversion', () => {
    assert.equal(localCalendarDate({ getFullYear: () => 2035, getMonth: () => 2, getDate: () => 26 }), '2035-03-26');
});


test('a rejection for an earlier submitted edition preserves the current edition date', async () => {
    const { dates } = fixture(async (_code, variantCode) => ({ variantCode, startDate: '2035-03-26' }));
    const offer = guide('GUIDE', ['NORTH', 'SOUTH']);
    await dates.sync(selections(offer));
    await dates.restore({ ...offer, variantCode: 'NORTH' });
    await dates.restore({ ...offer, variantCode: 'SOUTH' });
    dates.reject(offer, 'NORTH');
    assert.equal(dates.read(offer).variantCode, 'SOUTH');
});


test('fixed guide status stays public while source dates, editions and product context stay private', async () => {
    const requests = [];
    const { dates, document, nodes } = fixture(() => new Promise((resolve, reject) => requests.push({ resolve, reject })));
    const offer = guide('PRIVATE-CONTEXT', ['NORTH', 'SOUTH']);
    await dates.sync(selections(offer));
    const assertBoundary = (state) => {
        const status = document.getElementById('subscription-date-PRIVATE-CONTEXT-status');
        assert.equal(status.textContent, `subscriptionStartDates.${state}`);
        assert.equal(status.getAttribute('data-feedback-public'), '');
        assert.equal(status.children.length, 0, 'the public leaf contains only fixed translated status');
        const privateNodes = ['input', 'select', 'option', 'legend'].flatMap(tag => nodes.subscriptionStartDates.querySelectorAll(tag));
        assert.ok(privateNodes.length > 4);
        for (const field of privateNodes) {
            for (let node = field; node; node = node.parentElement) {
                assert.equal(node.getAttribute('data-feedback-public'), null, 'source values, edition choices and product context stay private');
            }
        }
    };
    assertBoundary('chooseEdition');
    let select = document.getElementById('subscription-edition-PRIVATE-CONTEXT');
    select.value = 'SOUTH';
    select.emit('change');
    assertBoundary('loading');
    requests[0].reject(Error('Synthetic provider failure'));
    await tick();
    assertBoundary('unavailable');
    nodes.subscriptionStartDates.querySelectorAll('button')[0].emit('click');
    assertBoundary('loading');
    requests[1].resolve({ variantCode: 'SOUTH', startDate: '2035-03-27' });
    await tick();
    assertBoundary('ready');
    assert.deepEqual(dates.read(offer), { variantCode: 'SOUTH', startDate: '2035-03-27' });
});
