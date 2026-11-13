#!/usr/bin/env node
// Real local UI and login, synthetic browser-only address/source responses. No upstream writes.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const baseUrl = process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:8443/kiwi/';
const localUrl = new URL(baseUrl);
assert.ok(['http:', 'https:'].includes(localUrl.protocol)
    && ['bdc.rtvmedia.org.local', 'localhost', '127.0.0.1'].includes(localUrl.hostname)
    && !localUrl.username && !localUrl.password, 'Use an isolated local Compose URL.');
const evidence = process.env.KIWI_ADDRESS_EVIDENCE_DIR;
assert.ok(evidence && isAbsolute(evidence) && !/^\/(?:var\/)?tmp(?:\/|$)/.test(resolve(evidence)),
    'Set KIWI_ADDRESS_EVIDENCE_DIR to an absolute durable evidence directory.');
const blockedWrites = [];
let completed = false;
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
const searches = [];
const closed = [];
const finalSource = process.env.KIWI_THEME_AUDIT_FINAL_SOURCE === '1';
let unavailable = false;
const candidates = ['1', '2'].map(houseNumberAddition => ({ postalCode: '1223CK', houseNumber: '2A', houseNumberAddition, street: 'Kometenstraat', city: 'HILVERSUM', countryCode: 'NL', verified: true }));
await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.includes('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
    blockedWrites.push({ method: request.method(), path: url.pathname });
    return route.abort('blockedbyclient');
});
await page.route('**/api/v1/addresses/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== localUrl.origin || !url.pathname.startsWith(new URL('api/v1/addresses/', baseUrl).pathname)) return route.fallback();
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
async function selectSourceAddress(index, actionName) {
    const section = page.locator('.customer-editor[open] section[data-customer-section="address"]');
    const action = section.getByRole('button', { name: `Adres ${index + 1} ${actionName}`, exact: true });
    assert.equal(await action.getAttribute('data-customer-record-index'), String(index));
    await action.click();
}
async function sourceAddressPrefix() {
    const prefix = await page.locator('.customer-editor[open] [data-address-prefix]').getAttribute('data-address-prefix');
    assert.match(prefix, /^customerEditorAddress\d+$/);
    return prefix;
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
    if (prefix === 'customerEditorAddress') {
        if (finalSource) {
            await selectSourceAddress(0, 'Bewerken');
            prefix = await sourceAddressPrefix();
        } else await page.selectOption('.customer-editor select[aria-label="Adres kiezen"]', '0');
    }
    await page.locator(`#${prefix}PostalCode`).waitFor({ state: 'visible' });
    return prefix;
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
    for (const requestedPrefix of (process.env.KIWI_ADDRESS_PREFIXES || 'subRecipient,subRequester,article,edit,restitutionTransfer,transfer,transfer2,customerEditorAddress').split(',')) {
        await load();
        const prefix = await open(requestedPrefix);
        const firstSession = await complete(prefix);
        const component = page.locator(`[data-address-prefix="${prefix}"]`);
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1100 });
            assert.equal(await component.evaluate(node => node.scrollWidth <= node.clientWidth), true);
            const columns = await component.locator('.customer-address-row').first().evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
            assert.equal(columns, width > 768 ? 2 : 1);
            await component.screenshot({ path: `${evidence}/${requestedPrefix}-${width}.png` });
        }
        await page.setViewportSize({ width: 1440, height: 1100 });
        if (requestedPrefix === 'customerEditorAddress') {
            await page.getByRole('button', { name: 'Wijzigingen herstellen', exact: true }).click();
            assert.equal(await page.inputValue(`#${prefix}PostalCode`), '');
            assert.equal(await page.inputValue(`#${prefix}AdditionalExtension`), 'Desk');
            assert.notEqual(await complete(prefix), firstSession);
            await page.getByRole('button', { name: 'Adres opslaan', exact: true }).click();
            await page.waitForFunction(() => window.sourceWrites.length === 1);
            const write = await page.evaluate(() => window.sourceWrites[0]);
            assert.equal(write.body.changes.housenumber, '2A 2');
            assert.equal(write.body.changes.extension, undefined);
            assert.equal(write.body.changes.additionalExtension, undefined);
            if (finalSource) await selectSourceAddress(1, 'Bewerken');
            else await page.selectOption('.customer-editor select[aria-label="Adres kiezen"]', '1');
            assert.equal(await page.inputValue(`#${prefix}HouseExt`), '2');
            assert.equal(await page.inputValue(`#${prefix}AddressExtension`), 'Other');
            await page.locator('.customer-editor[open] .btn-close').click();
            if (finalSource) {
                await page.locator('.customer-editor').waitFor({ state: 'hidden' });
                assert.equal(await page.locator('.customer-editor').count(), 1, 'The editable draft remains retained.');
            } else await page.locator('.customer-editor').waitFor({ state: 'detached' });
            assert.ok(closed.some(url => url.endsWith(firstSession)));
            await page.evaluate(async finalSource => {
                window.sourceModel.capabilities.operations = {};
                if (finalSource) window.currentCustomer = { ...window.currentCustomer, id: 999002 };
                await window.openSourceTest();
            }, finalSource);
            if (finalSource) await selectSourceAddress(1, 'Bekijken');
            else await page.selectOption('.customer-editor select[aria-label="Adres kiezen"]', '1');
            const readonlyPrefix = finalSource ? await sourceAddressPrefix() : prefix;
            if (finalSource) {
                assert.notEqual(readonlyPrefix, prefix, 'Readonly source identity must not reuse the retained writable editor.');
                assert.equal(await page.locator('.customer-editor').count(), 2);
            }
            assert.equal(await page.locator(`#${readonlyPrefix}PostalCode`).isEditable(), false);
            assert.equal(await page.locator('.customer-editor[open]').getByRole('button', { name: 'Adres opslaan', exact: true }).isEnabled(), false);
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
    completed = true;
} finally {
    await browser.close();
    await writeFile(`${evidence}/guard-report.json`, JSON.stringify({ marker: 'theme_audit', completed, blockedWrites,
        prefixes: (process.env.KIWI_ADDRESS_PREFIXES || 'subRecipient,subRequester,article,edit,restitutionTransfer,transfer,transfer2,customerEditorAddress').split(','),
        trailingScope: 'The original edit unavailable/retry/Escape regression always runs after the selected prefixes.',
        boundary: 'Local synthetic address transport only; unexpected API mutations abort. No upstream or business persistence claim.',
        searches: searches.length, closedAddressSessions: closed.length }, null, 2) + '\n');
    assert.equal(blockedWrites.length, 0, 'Unexpected API writes were blocked; this run is not accepted.');
}
