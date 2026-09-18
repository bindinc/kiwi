#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const root = new URL('../', import.meta.url);
const template = await readFile(new URL('templates/base/index.html.twig', root), 'utf8');
const subscription = template.split('<!-- New Subscription Form -->')[1].split('<!-- Article')[0];
const evidence = process.env.KIWI_LIGHTBOX_EVIDENCE_DIR || '/tmp/kiwi-lightbox-smoke';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome' });
const page = await browser.newPage();
await page.route('http://lightbox.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/css/styles.css"><title>Lightbox test — synthetic data</title><button id="open">Klantgegevens bekijken</button>${subscription}<script type="module">
        import { openCustomerEditor } from '/assets/js/app/customer-editor.js';
        window.model = { capabilities: { roleCanWrite: true, operations: {} }, version: 'test', sections: { person: [{ id: 'test', fields: { firstName: 'Alex', lastName: 'Testklant' } }] } };
        document.querySelector('#open').onclick = () => openCustomerEditor({ id: 'test', credentialKey: 'test', firstName: 'Alex', lastName: 'Testklant', mandant: 'TEST' }, {
            api: { get: async () => { if (window.loadError) throw Error('test'); return window.model; } }, refresh: async () => {}
        });
    </script></html>` });
    if (!['/assets/css/styles.css', '/assets/js/app/customer-editor.js', '/assets/js/app/address-fields.js', '/assets/js/app/address-completion.js', '/assets/js/app/lightbox-drafts.js'].includes(path)) return route.abort();
    return route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: await readFile(new URL(path.slice(1), root), 'utf8') });
});
async function geometry(selector) {
    return page.locator(selector).evaluate(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { x: rect.x, y: rect.y, width: rect.width, padding: style.padding, background: style.backgroundColor, border: style.border, radius: style.borderRadius, shadow: style.boxShadow };
    });
}
try {
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('http://lightbox.test/');
        await page.evaluate(() => document.querySelector('#newSubscriptionForm').style.display = 'flex');
        const expected = await geometry('#newSubscriptionForm .card');
        const backdrop = await page.locator('#newSubscriptionForm').evaluate(node => getComputedStyle(node).backgroundColor);
        await page.evaluate(() => document.querySelector('#newSubscriptionForm').style.display = 'none');
        await page.click('#open');
        await page.locator('.customer-editor section').first().waitFor();
        assert.deepEqual(await geometry('.customer-editor .card'), expected);
        assert.equal(await page.locator('.customer-editor').evaluate(node => getComputedStyle(node).backgroundColor), backdrop);
        assert.equal(await page.locator('.customer-editor').evaluate(node => node.scrollWidth <= node.clientWidth), true);
        await page.screenshot({ path: `${evidence}/customer-${width}.png`, clip: { x: expected.x, y: expected.y, width: expected.width, height: 1000 - expected.y } });
        for (let tab = 0; tab < 20; tab++) {
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.querySelector('.customer-editor').matches(':modal') && (document.activeElement === document.body || document.querySelector('.customer-editor').contains(document.activeElement))), true);
        }
        await page.keyboard.press('Escape');
        await page.locator('.customer-editor').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => document.activeElement.id), 'open');
        console.log(`Matching subscription geometry, backdrop, overflow and keyboard checks: ${width}px`);
    }
    await page.evaluate(async () => {
        const { resetLightboxDrafts } = await import('/assets/js/app/lightbox-drafts.js');
        resetLightboxDrafts(document);
        window.model.capabilities.operations['person.update'] = { enabled: true };
    });
    await page.click('#open');
    await page.locator('input[name="firstName"]').fill('Changed');
    await page.locator('.customer-editor .btn-close').click();
    assert.equal(await page.locator('.customer-editor').isVisible(), false);
    await page.click('#open');
    assert.equal(await page.inputValue('input[name="firstName"]'), 'Changed');
    await page.locator('.customer-editor .form-actions button').click();
    await page.locator('.customer-editor').waitFor({ state: 'hidden' });
    await page.evaluate(async () => {
        const { resetLightboxDrafts } = await import('/assets/js/app/lightbox-drafts.js');
        resetLightboxDrafts(document);
        window.loadError = true;
    });
    await page.click('#open');
    await page.getByText('Klantgegevens konden niet worden geladen.', { exact: false }).waitFor();
    await page.locator('.customer-editor .btn-close').click();
    await page.locator('.customer-editor').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.loadError = false);
    await page.click('#open');
    await page.locator('input[name="firstName"]').waitFor();
    console.log('Draft retention, both close controls and load-error recovery passed');
} finally {
    await browser.close();
}
