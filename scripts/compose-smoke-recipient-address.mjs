#!/usr/bin/env node
// Real Compose UI and fallback login; browser-only fixtures reuse the address API contract.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseUrl = process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:9455/kiwi-preview/';
const evidence = process.env.KIWI_ADDRESS_EVIDENCE_DIR || '/tmp/sc203455-address';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(45000);
const address = { postalCode: '1231AA', houseNumber: '1', houseNumberAddition: '', street: 'Rembrandtlaan', city: 'LOOSDRECHT', countryCode: 'NL', verified: true };
const candidates = [address, { ...address, houseNumber: '1A' }];
let mode = 'choices';
let held = [];
const validations = [];
const searches = [];

await page.route('**/api/v1/addresses/**', async route => {
    const request = route.request();
    assert.ok(request.headers()['x-csrf-token']);
    if (request.method() === 'DELETE') return route.fulfill({ status: 204 });
    const payload = request.postDataJSON();
    if (request.url().endsWith('/search')) {
        searches.push(payload);
        if (mode === 'held') {
            await new Promise(resolve => held.push(resolve));
            return route.fulfill({ json: { status: 'not_found', candidates: [], complete: false } });
        }
        if (mode === 'unavailable') return route.fulfill({ json: { status: 'unavailable' } });
        if (mode === 'not_found') return route.fulfill({ json: { status: 'not_found', candidates: [], complete: true } });
        return route.fulfill({ json: { status: 'ambiguous', candidates, complete: true } });
    }
    validations.push(payload);
    if (mode === 'unavailable') return route.fulfill({ status: 503, json: { error: { code: 'address_unconfirmed' } } });
    const match = candidates.find(candidate => ['postalCode', 'houseNumber', 'houseNumberAddition', 'street', 'city'].every(key =>
        candidate[key].toUpperCase() === String(payload[key] || '').toUpperCase()));
    return route.fulfill({ status: match ? 200 : 422, json: match ? { status: 'confirmed', address: match } : { error: { code: 'address_not_found' } } });
});

async function openRecipient() {
    await page.evaluate(() => {
        window.currentCustomer = { id: 999001, firstName: 'Test', lastName: 'Adrescontrole', subscriptions: [] };
        window.kiwiWerfsleutelSlice.getSelections = () => [{ selectedKey: { divisionId: '14', salesCode: 'TEST' } }];
        window.showNewSubscription();
        window.setSubscriptionRoleMode('recipient', 'create');
    });
    await page.locator('#subRecipientPostalCode').waitFor({ state: 'visible' });
}
const validate = () => page.evaluate(() => window.kiwiAddressCompletion.validate(document.querySelector('#subRecipientPostalCode').closest('[data-address-prefix]').parentElement));
const sessionId = () => page.evaluate(() => window.kiwiAddressCompletion.getSubmission('subRecipient').formSessionId);
async function lookup() {
    await page.fill('#subRecipientPostalCode', '1231 aa');
    await page.fill('#subRecipientHouseNumber', '1');
}
async function choose() {
    await page.locator('#subRecipientAddressChoices').waitFor({ state: 'visible' });
    await page.selectOption('#subRecipientAddressChoices', '0');
}

try {
    await page.goto(baseUrl);
    if (await page.locator('input[name="username"]').count()) {
        await page.fill('input[name="username"]', 'kiwi-admin');
        await page.fill('input[name="password"]', 'kiwi-local-dev-password');
        await Promise.all([page.waitForURL(/\/kiwi(?:-preview)?\/?$/, { waitUntil: 'domcontentloaded' }), page.click('input[type="submit"], button[type="submit"]')]);
    }
    await page.waitForFunction(() => window.kiwiAddressCompletion && window.kiwiWerfsleutelSlice);
    await page.click('#agentProfileTrigger');
    await page.click('[data-locale-option="nl"]');
    await openRecipient();

    // Hold an earlier search until after the complete manually entered address is confirmed.
    mode = 'held';
    await lookup();
    await page.waitForFunction(() => document.querySelector('#subRecipientAddressStatus').textContent.includes('opzoeken'));
    await page.fill('#subRecipientAddress', address.street);
    await page.fill('#subRecipientCity', address.city);
    assert.equal(await validate(), true);
    const originalSession = await sessionId();
    const released = held;
    held = [];
    assert.ok(released.length > 0);
    const staleResponses = page.waitForResponse(response => response.url().endsWith('/addresses/search'));
    released.forEach(resolve => resolve());
    await (await staleResponses).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#subRecipientAddressStatus').isVisible(), false);
    // A second gate check also verifies that the late result cannot poison buffered validity.
    assert.equal(await validate(), true);
    assert.equal(await page.locator('#subRecipientAddressStatus').isVisible(), false);
    assert.equal(await sessionId(), originalSession);
    await page.locator('[data-address-prefix="subRecipient"]').screenshot({ path: `${evidence}/recipient-confirmed.png` });
    console.log('PASS late not-found response cannot replace full confirmation; address gate passes in the same session');

    mode = 'choices';
    await page.fill('#subRecipientHouseNumber', '1A');
    await page.locator('#subRecipientAddressChoices').waitFor({ state: 'visible' });
    await page.selectOption('#subRecipientAddressChoices', '1');
    assert.equal(await validate(), true);
    assert.equal(await sessionId(), originalSession);
    console.log('PASS address edit, explicit reselection and revalidation retain the form session');

    mode = 'not_found';
    await page.fill('#subRecipientHouseNumber', '999');
    await page.waitForFunction(() => document.querySelector('#subRecipientAddressStatus').textContent.includes('Geen adres gevonden'));
    assert.equal(await validate(), false);
    mode = 'choices';
    await page.fill('#subRecipientHouseNumber', '1');
    await choose();
    assert.equal(await validate(), true);
    assert.equal(await sessionId(), originalSession);
    console.log('PASS actual not-found address remains blocked; correction recovers without resetting the session');

    mode = 'unavailable';
    await page.fill('#subRecipientHouseNumber', '1A');
    await page.locator('#subRecipientAddressStatus button').waitFor({ state: 'visible' });
    assert.equal(await validate(), false);
    mode = 'choices';
    await page.locator('#subRecipientAddressStatus button').click();
    await choose();
    assert.equal(await validate(), true);
    assert.equal(await sessionId(), originalSession);
    console.log('PASS unavailable provider blocks saving and retry recovers in the same session');

    await page.evaluate(() => window.setSubscriptionRoleMode('recipient', 'create'));
    await lookup();
    await page.locator('#subRecipientAddressChoices').waitFor({ state: 'visible' });
    assert.equal(await validate(), false);
    await choose();
    assert.equal(await validate(), true);
    assert.notEqual(await sessionId(), originalSession);
    console.log('PASS replaced recipient form gets a separate session and ambiguous unselected results cannot pass confirmation');
    assert.ok(validations.every(payload => payload.formSessionId));
    assert.ok(searches.every(payload => payload.formSessionId));
} catch (error) {
    const current = new URL(page.url());
    console.error(`Browser failure at ${current.origin}${current.pathname}: ${await page.title()}`);
    await page.screenshot({ path: `${evidence}/recipient-failure.png` });
    throw error;
} finally {
    held.forEach(resolve => resolve());
    await browser.close();
}
