#!/usr/bin/env node
// Run only in an isolated Compose project with prepare-address-smoke.py fixtures.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const baseUrl = process.env.KIWI_SMOKE_ORIGIN || 'https://bdc.rtvmedia.org.local:9443';
const evidence = process.env.KIWI_SUBSCRIPTION_EVIDENCE_DIR || '/tmp/sc-203201-evidence';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome',
    args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'] });

async function prepareCustomers(page) {
    await page.evaluate(async () => {
        // Clear only earlier runs for these synthetic customers in this isolated project.
        const existing = await window.kiwiApi.get('/api/v1/outbox-sessions', { skipCustomerContext: true });
        for (const item of existing.items) {
            if (!['1', '2'].includes(item.customerReference.personId) || !item.capabilities.delete) continue;
            await window.kiwiApi.post(`/api/v1/outbox-sessions/${item.id}/cancel`, {}, { skipCustomerContext: true,
                headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Kiwi-Outbox-Revision': String(item.revision) } });
        }
        await window.kiwiOutbox.refreshOutbox();
        for (const id of [1, 2]) {
            await window.kiwiApi.patch(`/api/v1/persons/${id}`, {
                postalCode: '1231AA', houseNumber: '1A', houseNumberAddition: '', street: 'Rembrandtlaan',
                city: 'LOOSDRECHT', email: `fixture${id}-${Date.now()}@example.invalid`
            }, { skipCustomerContext: true });
        }
        await window.kiwiCustomerDetailSlice.selectCustomer(1);
        window.kiwiWerfsleutelSlice.getSelections = () => [{
            selectedKey: { divisionId: '14', salesCode: 'SC203201', title: 'Test subscription' },
            selectedChannel: 'OL', selectedChannelMeta: { key: 'OL' }
        }];
        window.showNewSubscription();
    });
}

try {
    for (const prefix of ['kiwi', 'kiwi-preview']) {
        const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(`${baseUrl}/${prefix}/`);
            await page.fill('input[name="username"]', 'kiwi-admin');
            await page.fill('input[name="password"]', 'kiwi-local-dev-password');
            await Promise.all([page.waitForURL(new RegExp(`/${prefix}/?$`)), page.click('input[type="submit"],button[type="submit"]')]);
            await page.waitForFunction(() => window.kiwiOutbox && window.kiwiCustomerDetailSlice);
            await page.click('#agentProfileTrigger');
            await page.click('[data-locale-option="nl"]');
            await prepareCustomers(page);
            console.log(`${prefix}: logged in and prepared existing customers`);
            await page.locator('#subRecipientAddress').waitFor({ state: 'visible' });
            assert.equal(await page.inputValue('#subRecipientAddress'), 'Rembrandtlaan');
            assert.equal(await page.locator('#subRecipientAddress').isEditable(), true);
            await page.locator('#requesterSameAsRecipient').uncheck();
            await page.evaluate(async () => {
                const person = await window.kiwiApi.get('/api/v1/persons/2', { skipCustomerContext: true });
                subscriptionRoleState.requester.searchResults = [person];
                selectSubscriptionRolePerson('requester', 2);
            });
            await page.fill('#subRecipientHouseNumber', '2');
            await page.fill('#subRecipientPostalCode', '1223CK');
            await page.fill('#subRecipientAddress', 'Kometenstraat');
            await page.fill('#subRecipientCity', 'HILVERSUM');
            assert.equal(await page.evaluate(() => window.kiwiAddressCompletion.validate(document.getElementById('recipientCreateForm'))), true);
            await page.fill('#subRecipientAddressExtension', 'Ontvanger');
            await page.fill('#subRequesterAddressExtension', 'Betaler');
            assert.equal(await page.evaluate(() => window.kiwiAddressCompletion.validate(document.getElementById('requesterCreateForm'))), true);
            await page.locator('label[for="subPaymentInstruction"]').click();
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: 1100 });
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                const screenshotTarget = width < 768 ? '#recipientCreateForm .address-fields' : '#recipientRolePanel';
                await page.locator(screenshotTarget).screenshot({ path: `${evidence}/${prefix}-${width}.png` });
            }
            await page.setViewportSize({ width: 1440, height: 1100 });
            const responsePromise = page.waitForResponse(response => response.url().includes('/workflows/subscription') && response.request().method() === 'POST');
            await page.locator('#subscriptionForm button[type="submit"]').click();
            const response = await responsePromise;
            assert.equal(response.status(), 202, await response.text());
            const body = await response.json();
            const details = await page.evaluate(async id => window.kiwiApi.get(`/api/v1/outbox-sessions/${id}`, { skipCustomerContext: true }), body.outbox.id);
            const saved = details.changes.filter(change => change.operation === 'subscription.create').at(-1).arguments[0];
            assert.equal(saved.recipient.person.address, 'Kometenstraat 2');
            assert.equal(saved.recipient.person.addressExtension, 'Ontvanger');
            assert.equal(saved.requester.person.address, 'Rembrandtlaan 1A');
            assert.equal(saved.requester.person.addressExtension, 'Betaler');
            assert.equal(saved.recipient.personId, 1);
            assert.equal(saved.requester.personId, 2);
            assert.deepEqual(errors, []);
            console.log(`${prefix}: independent validated addresses, responsive form and persisted outbox passed`);
        } catch (error) {
            await page.screenshot({ path: `${evidence}/${prefix}-failure.png` });
            console.error(await page.locator('#toast').textContent().catch(() => ''));
            throw error;
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
