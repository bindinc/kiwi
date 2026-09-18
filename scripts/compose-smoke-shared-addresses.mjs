#!/usr/bin/env node
// Real local UI and login, synthetic browser-only address/source responses. No upstream writes.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const baseUrl = process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:8443/kiwi/';
const evidence = process.env.KIWI_ADDRESS_EVIDENCE_DIR || '/tmp/kiwi-shared-addresses';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
const searches = [];
const closed = [];
let unavailable = false;
const candidates = ['1', '2'].map(houseNumberAddition => ({ postalCode: '1223CK', houseNumber: '2A', houseNumberAddition, street: 'Kometenstraat', city: 'HILVERSUM', countryCode: 'NL', verified: true }));
await page.route('**/api/v1/addresses/**', async route => {
    const request = route.request();
    assert.ok(request.headers()['x-csrf-token']);
    if (request.method() === 'DELETE') { closed.push(request.url()); return route.fulfill({ status: 204 }); }
    const payload = request.postDataJSON();
    if (request.url().endsWith('/search')) {
        searches.push(payload);
        return route.fulfill({ json: unavailable ? { status: 'unavailable' } : { status: 'matched', candidates, complete: true } });
    }
    const match = candidates.find(candidate => ['postalCode', 'houseNumber', 'houseNumberAddition', 'street', 'city'].every(key => candidate[key] === payload[key]));
    return route.fulfill({ status: match ? 200 : 422, json: match ? { status: 'confirmed', address: match } : { error: { code: 'address_not_found' } } });
});
async function load() {
    await page.goto(baseUrl);
    if (await page.locator('input[name="username"]').count()) {
        await page.fill('input[name="username"]', 'kiwi-admin');
        await page.fill('input[name="password"]', 'kiwi-local-dev-password');
        await Promise.all([page.waitForURL(/\/kiwi(?:-preview)?\/?$/), page.click('input[type="submit"], button[type="submit"]')]);
    }
    await page.waitForFunction(() => window.kiwiAddressCompletion && window.kiwiCustomerDetailSlice);
    await page.click('#agentProfileTrigger');
    await page.click('[data-locale-option="nl"]');
    await page.evaluate(() => {
        window.currentCustomer = { id: 999001, firstName: 'Test', lastName: 'Adrescontrole', postalCode: '', houseNumber: '', address: '', city: '', subscriptions: [] };
    });
}
async function open(prefix) {
    await page.evaluate(async prefix => {
        if (prefix.startsWith('sub')) {
            window.kiwiWerfsleutelSlice.getSelections = () => [{ selectedKey: { divisionId: '14', salesCode: 'TEST' } }];
            window.showNewSubscription();
            if (prefix === 'subRequester') {
                const same = document.querySelector('#requesterSameAsRecipient');
                same.checked = false;
                same.dispatchEvent(new Event('change', { bubbles: true }));
            }
            window.setSubscriptionRoleMode(prefix === 'subRecipient' ? 'recipient' : 'requester', 'create');
        } else if (prefix === 'edit') window.editCustomer();
        else if (prefix === 'article') document.querySelector('[data-action="open-article-sale-form"]').click();
        else if (prefix === 'restitutionTransfer') {
            window.kiwiWinbackSlice.showRestitutionTransferForm({ id: 1, magazine: 'Test' });
            const same = document.querySelector('#restitutionTransferSameAddress');
            same.checked = false;
            same.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (prefix === 'transfer' || prefix === 'transfer2') {
            document.querySelector('#winbackFlow').style.display = 'flex';
            if (prefix === 'transfer') window.kiwiWinbackSlice.showDeceasedTransferForm();
            else window.kiwiWinbackSlice.showDeceasedCombinedForm();
        } else {
            const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
            const path = Object.keys(imports).find(key => key.endsWith('/customer-editor.js'));
            const { openCustomerEditor } = await import(imports[path]);
            window.sourceWrites = [];
            window.sourceModel = { version: 'synthetic', capabilities: { roleCanWrite: true, operations: { 'address.update': { enabled: true } } }, sections: {
                address: [{ id: 'a1', fields: { postCode: '', housenumber: '', street: '', city: '', isoCountryCode: 'NL', extension: '310', additionalExtension: 'Desk' } },
                    { id: 'a2', fields: { postCode: '1223CK', housenumber: '2A2', street: 'Kometenstraat', city: 'HILVERSUM', isoCountryCode: 'NL', extension: 'Other', additionalExtension: '' } }]
            } };
            window.openSourceTest = () => openCustomerEditor(window.currentCustomer, { api: {
                get: async () => window.sourceModel,
                request: async (method, path, body) => { window.sourceWrites.push({ method, path, body }); }
            }, refresh: async () => {} });
            await window.openSourceTest();
        }
    }, prefix);
    if (prefix === 'customerEditorAddress') await page.selectOption('.customer-editor select[aria-label="Adres kiezen"]', '0');
    await page.locator(`#${prefix}PostalCode`).waitFor({ state: 'visible' });
}
async function complete(prefix) {
    await page.fill(`#${prefix}AddressExtension`, '310');
    assert.equal(await page.locator(`#${prefix}HouseExt`).isEditable(), false);
    await page.fill(`#${prefix}HouseNumber`, '2a');
    await page.fill(`#${prefix}PostalCode`, '1223 ck');
    await page.locator(`#${prefix}AddressChoices`).waitFor({ state: 'visible' });
    const count = searches.length;
    await page.selectOption(`#${prefix}AddressChoices`, '0');
    await page.selectOption(`#${prefix}HouseExtChoices`, '2');
    assert.equal(searches.length, count, 'addition selection reuses the buffer');
    assert.equal(await page.inputValue(`#${prefix}HouseNumber`), '2A');
    assert.equal(await page.inputValue(`#${prefix}HouseExt`), '2');
    assert.equal(await page.inputValue(`#${prefix}Address`), 'Kometenstraat');
    assert.equal(await page.inputValue(`#${prefix}City`), 'HILVERSUM');
    assert.equal(await page.inputValue(`#${prefix}AddressExtension`), '310');
    assert.equal(await page.locator(`#${prefix}AddressChoices`).isVisible(), false);
    const address = await page.evaluate(prefix => window.kiwiAddressCompletion.getSubmission(prefix), prefix);
    assert.equal(address.houseNumberAddition, '2');
    assert.equal(address.addressExtension, '310');
    assert.ok(address.formSessionId);
    assert.equal(await page.evaluate(prefix => window.kiwiAddressCompletion.validate(document.querySelector(`#${prefix}PostalCode`).closest('.address-fields').parentElement), prefix), true);
    return address.formSessionId;
}
try {
    for (const prefix of (process.env.KIWI_ADDRESS_PREFIXES || 'subRecipient,subRequester,article,edit,restitutionTransfer,transfer,transfer2,customerEditorAddress').split(',')) {
        await load();
        await open(prefix);
        const firstSession = await complete(prefix);
        const component = page.locator(`[data-address-prefix="${prefix}"]`);
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1100 });
            assert.equal(await component.evaluate(node => node.scrollWidth <= node.clientWidth), true);
            const columns = await component.locator('.customer-address-row').first().evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
            assert.equal(columns, width > 768 ? 2 : 1);
            await component.screenshot({ path: `${evidence}/${prefix}-${width}.png` });
        }
        await page.setViewportSize({ width: 1440, height: 1100 });
        if (prefix === 'customerEditorAddress') {
            await page.getByRole('button', { name: 'Wijzigingen herstellen', exact: true }).click();
            assert.equal(await page.inputValue('#customerEditorAddressPostalCode'), '');
            assert.equal(await page.inputValue('#customerEditorAddressAdditionalExtension'), 'Desk');
            assert.notEqual(await complete(prefix), firstSession);
            await page.getByRole('button', { name: 'Adres opslaan', exact: true }).click();
            await page.waitForFunction(() => window.sourceWrites.length === 1);
            const write = await page.evaluate(() => window.sourceWrites[0]);
            assert.equal(write.body.changes.housenumber, '2A 2');
            assert.equal(write.body.changes.extension, undefined);
            assert.equal(write.body.changes.additionalExtension, undefined);
            await page.selectOption('.customer-editor select[aria-label="Adres kiezen"]', '1');
            assert.equal(await page.inputValue('#customerEditorAddressHouseExt'), '2');
            assert.equal(await page.inputValue('#customerEditorAddressAddressExtension'), 'Other');
            await page.locator('.customer-editor .btn-close').click();
            await page.locator('.customer-editor').waitFor({ state: 'detached' });
            assert.ok(closed.some(url => url.endsWith(firstSession)));
            await page.evaluate(async () => { window.sourceModel.capabilities.operations = {}; await window.openSourceTest(); });
            await page.selectOption('.customer-editor select[aria-label="Adres kiezen"]', '1');
            assert.equal(await page.locator('#customerEditorAddressPostalCode').isEditable(), false);
            assert.equal(await page.getByRole('button', { name: 'Adres opslaan', exact: true }).isEnabled(), false);
        }
        console.log(`PASS ${prefix}: common layout, completion, buffered additions, separate internal value, validation and responsive layout`);
    }
    await load(); await open('edit');
    unavailable = true;
    await page.fill('#editHouseNumber', '2A'); await page.fill('#editPostalCode', '1223CK');
    await page.locator('#editAddressStatus button').waitFor({ state: 'visible' });
    unavailable = false;
    await page.locator('#editAddressStatus button').click();
    await page.locator('#editAddressChoices').waitFor({ state: 'visible' });
    await page.locator('#editAddressChoices').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#editAddressStatus').isVisible(), false);
    console.log('PASS failure/retry and keyboard dismissal');
} finally { await browser.close(); }
