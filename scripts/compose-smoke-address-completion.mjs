#!/usr/bin/env node
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const baseUrl = process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:9443/kiwi/';
const evidence = process.env.KIWI_ADDRESS_EVIDENCE_DIR || '/tmp/sc-200162-smoke';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--ignore-certificate-errors', '--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
const requests = [];
page.on('request', (request) => {
    if (request.url().includes('/api/v1/addresses/search')) {
        assert.equal(request.headers().apikey, undefined);
        assert.equal(request.headers().authorization, undefined);
        requests.push(request.postDataJSON());
    }
});
async function fill(prefix, postcode, number = '1') {
    const addition = page.locator(`#${prefix}HouseExt`);
    if (await addition.count()) assert.equal(await addition.isEditable(), false);
    const row = page.locator(`#${prefix}City`).locator('..');
    const before = await row.boundingBox();
    const completed = page.waitForResponse((response) => response.url().endsWith('/addresses/search') && response.request().method() === 'POST');
    await page.fill(`#${prefix}HouseNumber`, number);
    await page.fill(`#${prefix}PostalCode`, postcode);
    const response = await completed;
    assert.equal(response.status(), 200);
    await page.waitForFunction((id) => {
        const text = document.getElementById(id)?.textContent || '';
        return text && !text.includes('opzoeken…') && !text.includes('Looking up');
    }, `${prefix}AddressStatus`);
    const choices = page.locator(`#${prefix}AddressChoices`);
    if (await choices.isVisible()) {
        const after = await row.boundingBox();
        const panel = await page.locator(`#${prefix}AddressStatus`).boundingBox();
        assert.ok(Math.abs(after.height - before.height) < 1, 'choices must not change row height');
        assert.ok(panel.y >= after.y + after.height, 'choices must appear below street and city');
        await choices.selectOption('0');
        assert.equal(await choices.isVisible(), false);
    }
}

try {
    console.log("Opening isolated application");
    await page.goto(baseUrl);
    if (await page.locator('input[name="username"]').count()) {
        await page.fill('input[name="username"]', 'kiwi-admin');
        await page.fill('input[name="password"]', 'kiwi-local-dev-password');
        await Promise.all([page.waitForURL(/\/kiwi(?:-preview)?\/?$/), page.click('input[type="submit"], button[type="submit"]')]);
    }
    console.log("Logged in");
    await page.waitForFunction(() => window.kiwiCustomerDetailSlice);
    await page.click('#agentProfileTrigger');
    await page.click('[data-locale-option="nl"]');
    // Supply a synthetic customer; this smoke test exercises address providers, not person search.
    await page.evaluate(() => {
        window.currentCustomer = { id: 999001, firstName: 'Test', lastName: 'Adrescontrole', postalCode: '', houseNumber: '', address: '', city: '' };
        window.editCustomer();
    });
    await fill('edit', '1231 aa');
    await page.waitForFunction(() => document.getElementById('editAddress').value === 'Rembrandtlaan');
    assert.equal(await page.inputValue('#editCity'), 'LOOSDRECHT');
    const first = requests.at(-1).formSessionId;
    assert.equal('houseNumberAddition' in requests.at(-1), false);
    const callsBeforeAddition = requests.length;
    assert.equal(await page.locator('#editAddressChoices').isVisible(), false);
    await page.locator('#editHouseExt').focus();
    await page.keyboard.type('MANUAL');
    assert.equal(await page.inputValue('#editHouseExt'), '');
    // Simulate DOM tampering: the backend must still reject an invented addition.
    await page.locator('#editHouseExt').evaluate((field) => {
        field.value = 'MANUAL';
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(450);
    assert.equal(requests.length, callsBeforeAddition);
    assert.match(await page.locator('#editAddressStatus').innerText(), /komt niet voor/);
    const validation = await page.evaluate(async () => {
        const address = window.kiwiAddressCompletion.getSubmission('edit');
        const post = async (path, payload) => {
            const response = await fetch(`${window.kiwiBasePath}/api/v1/${path}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            return response.status;
        };
        return { invalid: await post('addresses/validate', address),
            invalidSave: await post('persons', { ...address, firstName: 'Test', lastName: 'Invalid' }),
            valid: await post('addresses/validate', { ...address, houseNumberAddition: '' }) };
    });
    assert.deepEqual(validation, { invalid: 422, invalidSave: 422, valid: 200 });

    assert.equal(await page.locator('#editAddressChoices').isVisible(), false);
    await page.fill('#editHouseNumber', '3');
    await page.waitForSelector('#editAddressChoices:not([hidden])');
    await page.locator('#editAddressChoices').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#editAddressChoices').isVisible(), false);
    assert.equal(await page.inputValue('#editHouseExt'), '');
    await page.locator('#editCity').locator('..').screenshot({ path: `${evidence}/address-choices-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#editCity').locator('..').screenshot({ path: `${evidence}/address-choices-narrow.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await fill('edit', '1231AA', '2');
    assert.equal(requests.at(-1).formSessionId, first);
    const box = await page.locator('#editPostalCode').boundingBox();
    const bottom = await page.locator('#editCity').locator('..').boundingBox();
    await page.screenshot({ path: `${evidence}/address-completed.png`, clip: { x: box.x - 12, y: box.y - 12, width: (await page.locator('#editPostalCode').locator('..').boundingBox()).width + 24, height: bottom.y + bottom.height - box.y + 24 } });
    await fill('edit', '9998ZZ');
    await page.waitForFunction(() => document.getElementById('editAddress').value === 'Fallbackstraat');
    assert.equal(await page.inputValue('#editCity'), 'TESTSTAD');
    await fill('edit', '9997ZZ');
    await page.waitForSelector('#editAddressStatus button:not([hidden])');
    await page.fill('#editAddress', 'Handmatige straat');
    await page.fill('#editCity', 'Handmatige plaats');
    await page.click('#editCustomerForm [data-action="close-form"]');
    await page.evaluate(() => window.editCustomer());
    await fill('edit', '1231AA');
    await page.waitForFunction(() => document.getElementById('editAddress').value === 'Rembrandtlaan');
    assert.notEqual(requests.at(-1).formSessionId, first);
    // Every pair must trigger lookup; preserve contradictory coupon data until selection.
    for (const pair of [['PostalCode', 'HouseNumber'], ['PostalCode', 'Address'], ['PostalCode', 'City'], ['HouseNumber', 'Address'], ['HouseNumber', 'City'], ['Address', 'City']]) {
        await page.click('#editCustomerForm [data-action="close-form"]');
        await page.evaluate(() => window.editCustomer());
        const values = { PostalCode: '1231AA', HouseNumber: '1', Address: 'Rembrandt', City: 'LOOSDRECHT' };
        for (const field of pair) await page.fill(`#edit${field}`, values[field]);
        await page.waitForSelector('#editAddressChoices:not([hidden])');
        await page.selectOption('#editAddressChoices', '0');
        assert.equal(await page.inputValue('#editPostalCode'), '1231AA');
        assert.equal(await page.inputValue('#editHouseNumber'), '1');
        assert.equal(await page.inputValue('#editAddress'), 'Rembrandtlaan');
    }
    await page.click('#editCustomerForm [data-action="close-form"]');
    await page.evaluate(() => window.editCustomer());
    await page.fill('#editPostalCode', '9999ZZ');
    await page.fill('#editHouseNumber', '1');
    await page.fill('#editAddress', 'Rembrandtlaan');
    await page.fill('#editCity', 'LOOSDRECHT');
    await page.waitForSelector('#editAddressChoices:not([hidden])');
    assert.equal(await page.inputValue('#editPostalCode'), '9999ZZ');
    assert.match(await page.locator('#editAddressStatus').innerText(), /alternatieven/);
    await page.locator('#editAddressStatus').screenshot({ path: `${evidence}/address-alternatives-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#editAddressStatus').screenshot({ path: `${evidence}/address-alternatives-narrow.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.selectOption('#editAddressChoices', '0');
    assert.equal(await page.inputValue('#editPostalCode'), '1231AA');
    console.log('PASS: all six input pairs and explicit postcode correction');
    console.log('PASS: PostNL, Webabo fallback, total failure, manual input, UUID reuse and form reopening');
    await page.click('#editCustomerForm [data-action="close-form"]');
    // Exercise the actual existing form renderers, including dynamic role fields.
    await page.evaluate(() => {
        window.kiwiWerfsleutelSlice.getSelections = () => [{ selectedKey: { divisionId: '14', salesCode: 'TEST' } }];
        window.showNewSubscription();
    });
    await page.evaluate(() => window.setSubscriptionRoleMode('recipient', 'create'));
    await fill('subRecipient', '1231AA');
    await page.waitForFunction(() => document.getElementById('subRecipientAddress').value === 'Rembrandtlaan');
    assert.equal(await page.locator('#subRecipientAddressExtension').isEditable(), true);
    await page.fill('#subRecipientAddressExtension', '310');
    assert.equal(await page.inputValue('#subRecipientAddressExtension'), '310');
    await page.locator('#subRecipientHouseExt').focus();
    await page.keyboard.type('B');
    assert.equal(await page.inputValue('#subRecipientHouseExt'), '');
    await page.locator('#subRecipientHouseExt').locator('..').locator('..').screenshot({ path: `${evidence}/house-number-addition-readonly.png` });
    await page.uncheck('#requesterSameAsRecipient');
    await page.evaluate(() => window.setSubscriptionRoleMode('requester', 'create'));
    await fill('subRequester', '1231AA');
    await page.waitForFunction(() => document.getElementById('subRequesterAddress').value === 'Rembrandtlaan');
    assert.notEqual(requests.at(-1).formSessionId, requests.at(-2).formSessionId);
    await page.evaluate(() => window.closeForm('newSubscriptionForm'));
    await page.click('[data-action="open-article-sale-form"]');
    await fill('article', '1231AA');
    await page.waitForFunction(() => document.getElementById('articleAddress').value === 'Rembrandtlaan');
    await page.evaluate(() => window.closeForm('articleSaleForm'));
    await page.evaluate(() => window.kiwiWinbackSlice.showRestitutionTransferForm({ id: 999, magazine: 'Test' }));
    await page.uncheck('#restitutionTransferSameAddress');
    await fill('restitutionTransfer', '1231AA');
    await page.waitForFunction(() => document.getElementById('restitutionTransferAddress').value === 'Rembrandtlaan 1');
    console.log('PASS: recipient, requester, article and restitution forms; independent form UUIDs');
} catch (error) {
    await page.screenshot({ path: `${evidence}/failure.png` });
    throw error;
} finally {
    await browser.close();
}
