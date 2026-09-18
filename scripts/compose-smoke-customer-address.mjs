#!/usr/bin/env node

import {
    createRequire
} from "node:module";
const require = createRequire(import.meta.url);
const {
    chromium
} = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const assert = require('node:assert/strict');
// Run only against the isolated Compose fixtures prepared by prepare-address-smoke.py.
(async () => {
    await require('node:fs/promises').mkdir('/tmp/sc-200162-smoke', {
        recursive: true
    });
    const browser = await chromium.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--ignore-certificate-errors',
            '--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'
        ]
    });
    const page = await browser.newPage({
        ignoreHTTPSErrors: true
    });
    page.setDefaultTimeout(15000);

    try {
        await page.goto(process.env.KIWI_SMOKE_BASE_URL ||
            'https://bdc.rtvmedia.org.local:9443/kiwi-preview/');
        await page.fill('input[name="username"]', 'kiwi-admin');
        await page.fill('input[name="password"]', 'kiwi-local-dev-password');
        await Promise.all([page.waitForURL(/\/kiwi(?:-preview)?\/?$/), page.click(
            'input[type="submit"], button[type="submit"]')]);

        const customer = await page.evaluate(async () => await (await fetch(window.kiwiBasePath +
            '/api/v1/persons/1')).json());
        await page.click('#agentProfileTrigger');
        await page.click('[data-locale-option="nl"]');
        await page.fill('#searchPostalCode', customer.postalCode);
        await page.fill('#searchHouseNumber', customer.houseNumber);
        await page.click('[data-action="search-customer"]:not(input)');
        await page.waitForTimeout(400);

        await page.locator('button[data-action="select-customer"]').first().click();
        await page.waitForSelector('#customerAddressGate:not([hidden])');
        assert.equal(await page.locator('#editCustomerBtn').isEnabled(), true);
        await page.locator('#customerAddressGate').screenshot({
            path: '/tmp/sc-200162-smoke/existing-person-address-warning.png'
        });
        await page.setViewportSize({
            width: 390,
            height: 844
        });
        await page.locator('#customerAddressGate').screenshot({
            path: '/tmp/sc-200162-smoke/existing-person-address-warning-narrow.png'
        });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.setViewportSize({
            width: 1440,
            height: 1100
        });
        await page.click('[data-action="customer-address.correct"]');
        await page.fill('#editEmail', 'edited-profile@example.invalid');
        assert.equal(await page.inputValue('#editEmail'), 'edited-profile@example.invalid');
        let writes = 0;
        page.on('request', r => {
            if (r.method() === 'PATCH' && r.url().includes('/persons/1')) writes++;
        });
        await page.locator('#customerEditForm button[type="submit"]').click();
        await page.waitForTimeout(500);
        assert.equal(writes, 0);
        assert.equal(await page.inputValue('#editEmail'), 'edited-profile@example.invalid');
        assert.equal(await page.locator('#editCustomerForm').isVisible(), true);
        console.log(
            'PASS: invalid existing address warns on load; profile edits remain possible and survive failed save'
            );
        await page.fill('#editPostalCode', '1231AA');
        await page.fill('#editHouseNumber', '1');
        await page.waitForSelector('#editAddressChoices:not([hidden])');
        await page.selectOption('#editAddressChoices', '1');
        assert.equal(await page.inputValue('#editEmail'), 'edited-profile@example.invalid');
        const saved = page.waitForResponse(r => r.url().endsWith('/persons/1') && r.request().method() ===
            'PATCH');
        await page.locator('#customerEditForm button[type="submit"]').click();
        assert.equal((await saved).status(), 200);
        await page.waitForSelector('#editCustomerForm', {
            state: 'hidden'
        });
        await page.waitForSelector('#customerAddressGate', {
            state: 'hidden'
        });
        const permitted = await page.evaluate(async () => {
            const r = await fetch(window.kiwiBasePath + '/api/v1/persons/1/delivery-remarks', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...window.kiwiCustomerWorkSession.getRequestHeaders()
                },
                body: JSON.stringify({
                    default: 'Local confirmed address test'
                })
            });
            return r.status
        });
        assert.equal(permitted, 200);
        console.log(
            'PASS: correcting address saves other profile changes and unlocks subsequent mutations');
        await page.screenshot({
            path: '/tmp/sc-200162-smoke/existing-person-confirmed.png'
        });
        await page.click('#endCustomerWorkSessionButton');
        await page.waitForSelector('#customerWorkSessionBar', {
            state: 'hidden'
        });
        const external = {
            id: 123,
            personId: '123',
            credentialKey: 'fixture',
            sourceSystem: 'subscription-api',
            firstName: 'T.',
            lastName: 'External fixture',
            postalCode: '1231AA',
            houseNumber: '1',
            houseNumberAddition: '',
            street: 'Wrong street',
            address: 'Wrong street 1',
            city: 'WRONG CITY',
            email: 'fixture@example.invalid',
            subscriptions: [],
            addressValidation: {
                status: 'blocked'
            }
        };
        let correction;
        await page.route(/\/api\/v1\/persons(?:\?|\/123(?:\?|\/address))/, async route => {
            const req = route.request();
            const url = new URL(req.url());
            let body;
            if (req.method() === 'PATCH') {
                correction = req.postDataJSON();
                Object.assign(external, correction, {
                    addressValidation: {
                        status: 'confirmed'
                    }
                });
                body = external;
            } else if (url.pathname.endsWith('/123')) body = external;
            else body = {
                items: [external],
                total: 1,
                page: 1,
                pageSize: 20,
                totalPages: 1
            };
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body)
            });
        });
        await page.fill('#searchPostalCode', '1231AA');
        await page.fill('#searchHouseNumber', '1');
        await page.click('[data-action="search-customer"]:not(input)');
        await page.locator('button[data-action="select-customer"][data-arg-customer-id="123"]').click();
        await page.waitForSelector('#customerAddressGate:not([hidden])');
        await page.click('[data-action="customer-address.correct"]');
        assert.equal(await page.locator('#editEmail').isDisabled(), true);
        assert.equal(await page.locator('#editPostalCode').isEnabled(), true);
        assert.equal(await page.locator('#externalAddressCorrectionNote').isVisible(), true);
        await page.fill('#editPostalCode', '1231aa');
        await page.waitForSelector('#editAddressChoices:not([hidden])');
        await page.selectOption('#editAddressChoices', '1');
        await page.locator('#customerEditForm button[type="submit"]').click();
        await page.waitForSelector('#editCustomerForm', {
            state: 'hidden'
        });
        assert.equal(correction.houseNumber, '1A');
        assert.equal(correction.email, undefined);
        assert.equal(external.email, 'fixture@example.invalid');
        console.log(
            'PASS: external-person UI submits only corrected address fields; other profile data is preserved (controlled API response)'
            );

    } catch (e) {
        await page.screenshot({
            path: '/tmp/sc-200162-smoke/existing-person-failure.png'
        });
        throw e;
    } finally {
        await browser.close();
    }
})().catch(e => {
    console.error(e);
    process.exit(1)
});
