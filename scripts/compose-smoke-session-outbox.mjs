#!/usr/bin/env node
// Requires the public fixtures from prepare-address-smoke.py in an isolated Compose project.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const evidence = process.env.KIWI_OUTBOX_EVIDENCE_DIR || '/tmp/sc202851-evidence';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'] });
async function captureOutbox(page, path) {
    const clip = await page.locator('#subscriptionQueuePanel').boundingBox();
    const menu = await page.locator('.session-outbox-menu:popover-open').first().boundingBox().catch(() => null);
    if (menu) clip.height = Math.max(clip.height, menu.y + menu.height - clip.y + 8);
    await page.screenshot({path, clip});
}
try {
    for (const prefix of ['kiwi', 'kiwi-preview']) {
        const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: {width:1440,height:1100} });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`https://bdc.rtvmedia.org.local:9443/${prefix}/`);
        await page.fill('input[name="username"]', 'kiwi-admin');
        await page.fill('input[name="password"]', 'kiwi-local-dev-password');
        await Promise.all([page.waitForURL(new RegExp(`/${prefix}/?$`)), page.click('input[type="submit"], button[type="submit"]')]);
        await page.waitForFunction(() => window.kiwiOutbox && window.kiwiCustomerDetailSlice);
        await page.evaluate(async () => {
            // Only reset the synthetic customer used by this isolated smoke project.
            const existing = await window.kiwiApi.get('/api/v1/outbox-sessions', {skipCustomerContext:true});
            for (const item of existing.items) {
                if (item.customerReference.personId === '1' && item.capabilities.delete) {
                    await window.kiwiApi.post(`/api/v1/outbox-sessions/${item.id}/cancel`, {}, {skipCustomerContext:true, headers:{
                        'Idempotency-Key':crypto.randomUUID(), 'X-Kiwi-Outbox-Revision':String(item.revision)
                    }});
                }
            }
            await window.kiwiOutbox.refreshOutbox();
            await window.kiwiCustomerDetailSlice.selectCustomer(1);
        });
        await page.reload();
        await page.waitForFunction(() => window.kiwiOutbox && window.kiwiCustomerDetailSlice);
        await page.evaluate(() => window.kiwiCustomerDetailSlice.selectCustomer(1));
        const saved = await page.evaluate(async () => {
            const result = await window.kiwiApi.patch('/api/v1/persons/1', {
                postalCode:'1231AA',houseNumber:'1A',houseNumberAddition:'',street:'Rembrandtlaan',city:'LOOSDRECHT',addressExtension:'310',
                email:`outbox-${Date.now()}@example.invalid`
            });
            await window.kiwiCustomerDetailSlice.selectCustomer(1);
            await window.kiwiApi.post('/api/v1/persons/1/contact-history', {type:'Vraag', description:'Vraag over het lopende abonnement.'});
            await window.kiwiApi.put('/api/v1/persons/1/delivery-remarks', {default:'Bij de voordeur bezorgen'});
            return {id:result.outbox.id,revision:result.outbox.revision,provisional:result.provisional};
        });
        assert.equal(saved.provisional, true);
        await page.locator('[data-action="toggle-subscription-queue-info"]').click();
        await page.waitForSelector('#subscriptionQueuePanel:not([hidden]) .session-outbox-item');
        const row = page.locator('.session-outbox-item').first();
        await row.getByRole('button', {name:/Acties voor/}).click();
        await row.getByRole('button', {name:'Bewerken',exact:true}).click();
        await page.waitForFunction(() => document.querySelector('#sessionOutboxStatus').textContent.includes('heropend')).catch(async error => {
            console.error(await page.locator('#sessionOutboxStatus').textContent());
            throw error;
        });
        await page.waitForFunction(() => document.querySelector('.session-outbox-item').textContent.includes('Gepauzeerd'));
        assert.match(await row.textContent(), /Gepauzeerd/);
        await page.locator('#customerSessionChanges > summary').click();
        await page.locator('.session-outbox-change').first().hover();
        await page.locator('#sessionOutboxChanges button').first().click();
        await page.waitForSelector('#editCustomerForm', {state:'visible'});
        await page.fill('#editEmail', `corrected-${prefix}@example.invalid`);
        await page.locator('#customerEditForm button[type="submit"]').click();
        await page.waitForSelector('#editCustomerForm', {state:'hidden'});
        await page.waitForFunction(() => document.querySelector('#sessionOutboxStatus').textContent.includes('Opgeslagen'));
        const current = await page.evaluate(async id => await window.kiwiApi.get(`/api/v1/outbox-sessions/${id}`), saved.id);
        assert.equal(current.status,'paused');
        assert.equal(current.id,saved.id);
        assert.equal(current.changes.length,3);
        assert.equal(await page.locator('#subscriptionQueuePanel #sessionOutboxChanges').count(),0);
        assert.equal(current.customers[0].email,`corrected-${prefix}@example.invalid`);
        await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show'));
        await page.locator('#subscriptionQueuePanel').screenshot({path:`${evidence}/${prefix}-outbox.png`});
        await page.setViewportSize({width:390,height:844});
        await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show'));
        await page.locator('#subscriptionQueuePanel').screenshot({path:`${evidence}/${prefix}-outbox-narrow.png`});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
        await page.setViewportSize({width:1440,height:1100});
        await row.getByRole('button',{name:/Acties voor/}).click();
        await captureOutbox(page, `${evidence}/${prefix}-outbox-menu.png`);
        await page.keyboard.press('Escape');
        await row.getByRole('button',{name:/Acties voor/}).press('Enter');
        await row.getByRole('button',{name:'Hervatten',exact:true}).click();
        await page.waitForFunction(() => document.querySelector('.session-outbox-item').textContent.includes('Wacht op verzending'));
        await row.getByRole('button',{name:/Acties voor/}).press('Enter');
        await captureOutbox(page, `${evidence}/${prefix}-outbox-pause-menu.png`);
        await row.getByRole('button',{name:'Pauzeren',exact:true}).focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.session-outbox-item').textContent.includes('Gepauzeerd'));
        await page.reload();
        await page.waitForFunction(() => window.kiwiOutbox);
        const persisted = await page.evaluate(async id => await window.kiwiApi.get(`/api/v1/outbox-sessions/${id}`), saved.id);
        assert.equal(persisted.status,'paused');
        assert.deepEqual(errors,[]);
        console.log(`PASS ${prefix}: save, reopen, correct, resume, keyboard pause, reload, desktop/narrow`);
        await page.close();
    }
} finally { await browser.close(); }
