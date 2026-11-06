#!/usr/bin/env node
// Use an isolated Compose project with the public address fixtures; never a live customer service.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH);
const origin = process.env.KIWI_SMOKE_ORIGIN;
const evidence = process.env.KIWI_MARKETING_EVIDENCE_DIR || 'var/marketing-preferences';
const runId = Date.now().toString(36);
assert.ok(origin, 'Set KIWI_SMOKE_ORIGIN to the isolated Compose gateway');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });

async function preferences(page) {
    return page.evaluate(() => ['Email', 'Phone', 'Post'].map(channel =>
        document.querySelector(`input[name="subOptin${channel}"]:checked`)?.value ?? null));
}

async function fillPerson(page, prefix, initials) {
    const identity = `${initials}${runId}${page.url().includes('preview') ? 'Preview' : 'Active'}`;
    for (const [suffix, value] of Object.entries({ Initials: initials, LastName: `Fixture${identity}`,
        PostalCode: '1231AA', HouseNumber: '1', Address: 'Rembrandtlaan', City: 'LOOSDRECHT',
        Email: `${identity.toLowerCase()}@example.invalid` })) {
        await page.locator(`#${prefix}${suffix}`).fill(value);
    }
}

async function saveAndRead(page) {
    const responsePromise = page.waitForResponse(response =>
        response.url().includes('/workflows/subscription') && response.request().method() === 'POST');
    await page.locator('#subscriptionForm button[type="submit"]').click();
    const response = await responsePromise;
    assert.equal(response.status(), 202, await response.text());
    const body = await response.json();
    const details = await page.evaluate(id => window.kiwiApi.get(`/api/v1/outbox-sessions/${id}`,
        { skipCustomerContext: true }), body.outbox.id);
    return { sent: response.request().postDataJSON(),
        saved: details.changes.find(change => change.operation === 'subscription.create').arguments[0] };
}

try {
    for (const prefix of ['kiwi', 'kiwi-preview']) {
        const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(20000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
        try {
            await page.goto(`${origin}/${prefix}/`);
            await page.locator('#username').fill('kiwi-admin');
            await page.locator('#password').fill('kiwi-local-dev-password');
            await page.locator('#kc-login').click();
            await page.waitForFunction(() => window.kiwiSubscriptionRoleRuntime && window.kiwiAddressCompletion && window.kiwiApi,
                null, { timeout: 60000 });
            await page.evaluate(() => {
                // Use a synthetic offer, retaining the actual form, role runtime and backend save path.
                window.kiwiWerfsleutelSlice.getSelections = () => [{
                    selectedKey: { divisionId: 'HMC', mandant: 'HMC', salesCode: 'SC203457', title: 'Marketing fixture' },
                    selectedChannel: 'OL', selectedChannelMeta: { label: 'Online' }
                }];
                window.showNewSubscription();
            });
            assert.deepEqual(await preferences(page), [null, null, null]);
            await page.locator('[name="subOptinPost"][value="no"]').scrollIntoViewIfNeeded();
            const clip = await page.locator('#subscriptionForm .optin-row, #subscriptionForm h3[data-i18n*="marketing_voorkeuren"]')
                .evaluateAll(elements => {
                    const boxes = elements.map(element => element.getBoundingClientRect());
                    const x = Math.min(...boxes.map(box => box.x));
                    const y = Math.min(...boxes.map(box => box.y));
                    return { x, y, width: Math.max(...boxes.map(box => box.right)) - x,
                        height: Math.max(...boxes.map(box => box.bottom)) - y };
                });
            await page.screenshot({ path: `${evidence}/${prefix}-empty.png`, clip });
            await page.locator('[name="subOptinEmail"][value="yes"]').check();
            await page.locator('[name="subOptinPhone"][value="no"]').check();
            await page.evaluate(() => {
                document.getElementById('newSubscriptionForm').style.display = 'none';
                window.showNewSubscription();
            });
            assert.deepEqual(await preferences(page), ['yes', 'no', null], 'reopen preserves the current draft');
            await page.evaluate(() => document.getElementById('subscriptionForm').reset());
            assert.deepEqual(await preferences(page), [null, null, null], 'native reset has no consent defaults');
            await page.evaluate(() => {
                window.kiwiSubscriptionRoleRuntime.setSubscriptionRoleMode('recipient', 'create');
                document.getElementById('subStartDate').value = new Date().toISOString().slice(0, 10);
            });

            await fillPerson(page, 'subRecipient', 'A');
            await page.locator('label[for="subPaymentInstruction"]').click();
            let result = await saveAndRead(page);
            for (const role of ['recipient', 'requester']) {
                assert.equal(result.saved[role].person.optinEmail, null);
                assert.equal(result.saved[role].person.optinPhone, null);
                assert.equal(result.saved[role].person.optinPost, null);
            }
            assert.equal(result.sent.recipient.person.optinEmail, null);

            await page.evaluate(async () => {
                await window.kiwiCustomerWorkSession.endCustomerWorkSession();
                window.showNewSubscription();
            });
            assert.deepEqual(await preferences(page), [null, null, null]);
            await fillPerson(page, 'subRecipient', 'B');
            await page.locator('[name="subOptinEmail"][value="yes"]').check();
            await page.locator('[name="subOptinPhone"][value="no"]').check();
            await page.locator('#requesterSameAsRecipient').uncheck();
            await page.evaluate(() => window.kiwiSubscriptionRoleRuntime.setSubscriptionRoleMode('requester', 'create'));
            await fillPerson(page, 'subRequester', 'P');
            assert.deepEqual(await preferences(page), ['yes', 'no', null], 'payer edits do not affect recipient choices');
            await page.locator('label[for="subPaymentInstruction"]').click();
            result = await saveAndRead(page);
            assert.equal(result.saved.recipient.person.optinEmail, 'yes');
            assert.equal(result.saved.recipient.person.optinPhone, 'no');
            assert.equal(result.saved.recipient.person.optinPost, null);
            assert.equal(result.saved.requester.person.optinEmail, null);
            assert.equal(result.saved.requester.person.optinPhone, null);
            assert.equal(result.saved.requester.person.optinPost, null);
            await page.evaluate(saved => {
                window.showNewSubscription();
                window.kiwiSubscriptionRoleRuntime.restoreOutboxSubscriptionRoles(saved);
            }, result.saved);
            assert.deepEqual(await preferences(page), ['yes', 'no', null], 'stored choices survive rebuilding the role editors');

            await page.evaluate(async () => {
                await window.kiwiCustomerWorkSession.endCustomerWorkSession();
                window.showNewSubscription();
                const person = { id: 1, firstName: 'E.', lastName: 'Fixture', address: 'Rembrandtlaan 1',
                    postalCode: '1231AA', houseNumber: '1', city: 'LOOSDRECHT', email: 'existing@example.invalid',
                    sourceSystem: 'kiwi', mandant: 'HMC', optinEmail: 'no', optinPhone: 'yes', optinPost: null };
                subscriptionRoleState.recipient.searchResults = [person];
                window.kiwiSubscriptionRoleRuntime.setSubscriptionRoleMode('recipient', 'existing');
                window.kiwiSubscriptionRoleRuntime.selectSubscriptionRolePerson('recipient', 1);
            });
            assert.deepEqual(await preferences(page), ['no', 'yes', null]);
            assert.equal(await page.locator('[name="subOptinEmail"][value="yes"]').isDisabled(), true);
            await page.evaluate(() => window.kiwiSubscriptionRoleRuntime.setSubscriptionRoleMode('recipient', 'create'));
            assert.deepEqual(await preferences(page), [null, null, null], 'new recipient does not inherit existing preferences');
            assert.equal(await page.locator('[name="subOptinEmail"][value="yes"]').isEnabled(), true);
            assert.deepEqual(errors, []);
            console.log(`${prefix}: empty defaults, explicit yes/no, reset, reopen, recipient/payer isolation and persisted payloads passed`);
        } catch (error) {
            await page.screenshot({ path: `${evidence}/${prefix}-failure.png` });
            console.error(await page.locator('#toast').textContent().catch(() => ''));
            console.error('Browser errors:', errors);
            console.error('Runtime readiness:', await page.evaluate(() => ({
                roles: !!window.kiwiSubscriptionRoleRuntime, address: !!window.kiwiAddressCompletion, api: !!window.kiwiApi
            })));
            throw error;
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
