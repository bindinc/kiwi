#!/usr/bin/env node
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH
    || '/home/bartdeijkers/emailtemplates/node_modules/playwright';
const { chromium } = require(playwrightPath);
const evidenceDir = process.env.KIWI_SESSION_EVIDENCE_DIR || '/tmp/kiwi-customer-session-smoke';
const baseUrl = process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:8443/kiwi/';

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    args: [
        '--ignore-certificate-errors',
        '--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'
    ]
});
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
await mkdir(evidenceDir, { recursive: true });

async function search(name) {
    if (!await page.locator('#searchName').isVisible()) {
        await page.click('#additionalFiltersToggle');
    }
    await page.fill('#searchName', name);
    await page.click('button[data-action="search-customer"]');
    await page.waitForSelector('#paginatedResults .result-row');
}

async function openFirstResult() {
    await page.locator('#paginatedResults .result-row').first().click();
    await page.waitForSelector('#customerDetail', { state: 'visible' });
}

async function readContext() {
    return page.evaluate(() => window.kiwiCustomerWorkSession.getRequestContext());
}

try {
    await page.goto(baseUrl);
    if (await page.locator('input[name="username"]').count()) {
        await page.fill('input[name="username"]', 'kiwi-admin');
        await page.fill('input[name="password"]', 'kiwi-local-dev-password');
        await Promise.all([
            page.waitForURL(/\/kiwi\/?$/),
            page.click('input[type="submit"], button[type="submit"]')
        ]);
    }
    await page.waitForFunction(() => window.kiwiCustomerWorkSession && window.kiwiCustomerDetailSlice);
    await page.click('#agentProfileTrigger');
    await page.click('[data-locale-option="nl"]');
    await page.waitForFunction(() => document.documentElement.lang === 'nl');

    await search('Jansen');
    await openFirstResult();
    const firstContext = await readContext();

    await search('Bakker');
    await openFirstResult();
    const secondContext = await readContext();
    assert.notEqual(secondContext.workflowSessionId, firstContext.workflowSessionId);
    assert.notEqual(secondContext.customerReference.personId, firstContext.customerReference.personId);
    await page.locator('#customerWorkSessionBar').screenshot({ path: `${evidenceDir}/automatic-switch.png` });
    console.log('Automatic A to B passed');

    await search('Bakker');
    await openFirstResult();
    assert.equal((await readContext()).workflowSessionId, secondContext.workflowSessionId);
    console.log('Same-customer session retained');

    await page.click('#editCustomerBtn');
    await page.fill('#editInitials', 'Test concept');
    await page.click('#editCustomerForm [data-action="close-form"]');
    await search('Jansen');
    await page.locator('#paginatedResults .result-row').first().click();
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('Beëindig eerst'));
    assert.equal((await readContext()).workflowSessionId, secondContext.workflowSessionId);
    assert.equal(await page.inputValue('#editInitials'), 'Test concept');
    console.log('Retained draft blocks switching');

    await page.click('#endCustomerWorkSessionButton');
    await page.waitForSelector('#customerWorkSessionIdentity', { state: 'hidden' });
    assert.equal(await page.locator('#endCustomerWorkSessionButton').isVisible(), true);
    await search('Jansen');
    await openFirstResult();
    assert.equal((await readContext()).customerReference.personId, firstContext.customerReference.personId);
    console.log('Explicit reset restores switching');
} catch (error) {
    await page.screenshot({ path: `${evidenceDir}/failure.png` });
    throw error;
} finally {
    await browser.close();
}
