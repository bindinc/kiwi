#!/usr/bin/env node
// Run against an isolated Compose project using fallback OIDC and synthetic people.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const origin = process.env.KIWI_SMOKE_ORIGIN || 'https://bdc.rtvmedia.org.local:9539';
const evidence = process.env.KIWI_INITIALS_EVIDENCE_DIR || 'var/sc203539/evidence';
await mkdir(evidence, { recursive: true });

const recipient = {
    id: 73, personId: '73', firstName: 'Alex', initials: 'A.B.', lastName: 'Fixture',
    salutation: 'Dhr.', birthday: '1980-03-02', postalCode: '1234AB', houseNumber: '10',
    address: 'Teststraat 10', city: 'Teststad', email: 'recipient@example.invalid',
    credentialKey: 'fixture', mandant: 'HMC', sourceSystem: 'subscription-api'
};
const payer = { ...recipient, id: 74, personId: '74', firstName: '', initials: 'R.S.', email: 'payer@example.invalid' };
const browser = await chromium.launch({ channel: process.env.KIWI_SMOKE_BROWSER_CHANNEL || 'chrome', headless: true });
try {
    for (const track of ['kiwi', 'kiwi-preview']) {
        const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(20000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // Exercise the browser's detail hydration with the existing normalized provider shape.
        await page.route('**/api/v1/persons/7*', async route => {
            const id = new URL(route.request().url()).pathname.split('/').at(-1);
            const person = id === '73' ? recipient : payer;
            await route.fulfill({ json: person });
        });
        try {
            await page.goto(`${origin}/${track}/`);
            await page.locator('input[name="username"]').fill('kiwi-admin');
            await page.locator('input[name="password"]').fill('kiwi-local-dev-password');
            await page.locator('input[type="submit"],button[type="submit"]').click();
            await page.waitForFunction(() => window.kiwiSubscriptionRoleRuntime && window.kiwiApi);
            await page.evaluate(person => {
                currentCustomer = person;
                window.kiwiWerfsleutelSlice.getSelections = () => [{
                    selectedKey: { salesCode: 'SC203539', mandant: 'HMC', divisionId: '14' },
                    selectedChannel: 'OL', selectedChannelMeta: { key: 'OL' }
                }];
                window.showNewSubscription();
            }, recipient);
            assert.equal(await page.inputValue('#subRecipientInitials'), 'A.B.');
            await page.locator('#requesterSameAsRecipient').uncheck();
            await page.evaluate(person => {
                subscriptionRoleState.requester.searchResults = [{ ...person, initials: '' }];
                window.kiwiSubscriptionRoleRuntime.selectSubscriptionRolePerson('requester', person.id);
            }, payer);
            await page.waitForFunction(() => document.getElementById('subRequesterInitials').value === 'R.S.');
            await page.locator('#recipientCreateForm .form-row').first().screenshot({ path: path.join(evidence, `${track}-recipient.png`) });
            await page.locator('#requesterCreateForm .form-row').first().screenshot({ path: path.join(evidence, `${track}-payer.png`) });

            const payloads = await page.evaluate(() => ({
                recipient: window.kiwiSubscriptionRoleRuntime.buildSubscriptionRolePayload('recipient'),
                payer: window.kiwiSubscriptionRoleRuntime.buildSubscriptionRolePayload('requester')
            }));
            assert.equal(payloads.recipient.personEdits.firstName, 'A.B.');
            assert.equal(payloads.payer.personEdits.firstName, 'R.S.');
            assert.equal(payloads.recipient.personId, 73);
            assert.equal(payloads.payer.personId, 74);

            await page.evaluate(person => {
                subscriptionRoleState.recipient.searchResults = [{ ...person, initials: '' }];
                window.kiwiSubscriptionRoleRuntime.selectSubscriptionRolePerson('recipient', person.id);
            }, payer);
            await page.waitForFunction(() => document.getElementById('subRecipientInitials').value === 'R.S.');
            await page.evaluate(() => {
                const blankPerson = { id: 75, firstName: '', initials: '', lastName: 'Blank fixture', sourceSystem: 'kiwi' };
                subscriptionRoleState.recipient.searchResults = [blankPerson];
                window.kiwiSubscriptionRoleRuntime.selectSubscriptionRolePerson('recipient', blankPerson.id);
            });
            assert.equal(await page.inputValue('#subRecipientInitials'), '');
            assert.deepEqual(errors, []);
            console.log(`${track}: initial selection, payer hydration, independent payloads and person switching passed`);
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
