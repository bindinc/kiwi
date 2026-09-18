#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const root = new URL('../', import.meta.url);
const template = await readFile(new URL('templates/base/index.html.twig', root), 'utf8');
const sessionBar = template.slice(template.indexOf('<section id="customerWorkSessionBar"'), template.indexOf('<div class="header-right">'));
const forms = template.slice(template.indexOf('<!-- New Subscription Form -->'), template.indexOf('<!-- Debug Mode Modal -->'))
    .replaceAll(/\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g, '');
const evidence = process.env.KIWI_LIGHTBOX_EVIDENCE_DIR || '/tmp/kiwi-lightbox-drafts';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome' });
const page = await browser.newPage();
page.setDefaultTimeout(7000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://drafts.test') return route.abort();
    const path = url.pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/css/styles.css"><link rel="stylesheet" href="/assets/css/contextual-feedback.css"><title>Lightbox drafts — synthetic test data</title><header class="header"><div class="header-content"><div class="header-top"><h1>KIWI</h1>${sessionBar}<div class="header-right">Testomgeving</div></div></div></header><main><button id="source">Klantgegevens</button><button id="feedback">Feedback</button><button id="contextualFeedbackSettingsButton" data-contextual-feedback-settings-url="/settings">Instellingen</button>${forms}</main><script type="module">
        import * as shell from '/assets/js/app/slices/app-shell-slice.js';
        import * as workflow from '/assets/js/app/slices/subscription-workflow-slice.js';
        import * as orders from '/assets/js/app/slices/order.js';
        import * as remarks from '/assets/js/app/slices/delivery-remarks-slice.js';
        import * as articles from '/assets/js/app/slices/article-search-slice.js';
        import * as winback from '/assets/js/app/slices/winback-slice.js';
        import * as sessions from '/assets/js/app/slices/customer-work-session-slice.js';
        import { createActionRouter } from '/assets/js/app/actions.js';
        import { openCustomerEditor } from '/assets/js/app/customer-editor.js';
        import { openFeedbackDialog } from '/assets/js/app/contextual-feedback/dialog.js';
        import { initContextualFeedbackSettings } from '/assets/js/app/contextual-feedback/settings-modal.js';
        window.customer = null;
        window.orderItems = [];
        window.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => window.customer, getCustomers: () => [window.customer] };
        window.kiwiApi = { get: async () => ({ items: [] }) };
        window.closeForm = shell.closeForm;
        const router = createActionRouter({ root: document });
        shell.configureAppShellSliceDependencies(() => ({ setCurrentCustomer: value => window.customer = value }));
        orders.configureOrderSliceDependencies(() => ({ getCurrentCustomer: () => window.customer, closeForm: shell.closeForm, resetOrderItems: () => window.orderItems = [] }));
        remarks.configureDeliveryRemarksSliceDependencies(() => ({ getCurrentCustomer: () => window.customer }));
        sessions.configureCustomerWorkSessionSliceDependencies(() => ({ resetCustomerBoundState: shell.resetCustomerWorkspace }));
        shell.registerAppShellSlice(router);
        workflow.registerSubscriptionWorkflowSlice(router);
        orders.registerOrderActions(router);
        remarks.registerDeliveryRemarksSlice(router);
        articles.registerArticleSearchSlice(router);
        winback.registerWinbackSlice(router);
        sessions.registerCustomerWorkSessionSlice(router);
        router.install();
        window.test = { shell, workflow, orders, remarks, articles, winback, sessions };
        window.sourceModel = { capabilities: { roleCanWrite: true, operations: { 'person.update': { enabled: true } } }, version: 'test', sections: { person: [{ id: '1', fields: { firstName: 'Alex', lastName: 'Testklant' } }] } };
        document.querySelector('#source').onclick = () => openCustomerEditor({ id: '1', credentialKey: 'test', firstName: 'Alex', lastName: 'Testklant' }, { api: { get: async () => window.sourceModel }, refresh: async () => {} });
        document.querySelector('#feedback').onclick = () => openFeedbackDialog({ onSubmit: async () => {} });
        initContextualFeedbackSettings();
        window.ready = true;
    </script></html>` });
    if (path === '/settings') return route.fulfill({ json: { allowedRoles: ['admin'], feedbackEnabled: true, publicBaseUrl: 'https://example.org', imageTtlDays: 7, maxImageBytes: 1024 } });
    if (path.startsWith('/assets/') && /\.(js|css)$/.test(path)) return route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: await readFile(new URL(path.slice(1), root), 'utf8') });
    return route.fulfill({ json: { items: [] } });
});
async function dismiss(selector, method) {
    if (method === 'escape') await page.keyboard.press('Escape');
    else if (method === 'backdrop') {
        const point = await page.locator(selector).evaluate(node => {
            const rect = node.getBoundingClientRect();
            for (const [x, y] of [[2, 2], [innerWidth - 2, innerHeight - 2], [2, innerHeight - 2]]) {
                if (document.elementFromPoint(x, y) === node) return { x: x - rect.x, y: y - rect.y };
            }
            throw Error('No exposed backdrop for ' + node.id);
        });
        await page.locator(selector).click({ position: point });
    }
    else await page.locator(`${selector} .btn-close, ${selector} .modal-close`).first().click();
    await page.locator(selector).waitFor({ state: 'hidden' });
}
try {
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('http://drafts.test/');
        await page.waitForFunction(() => window.ready);
        assert.equal(await page.locator('#endCustomerWorkSessionButton').isVisible(), true);
        assert.equal(await page.locator('#customerWorkSessionIdentity').isVisible(), false);
        await page.locator('header').screenshot({ path: `${evidence}/reset-without-customer-${width}.png` });
        for (const method of ['close', 'backdrop', 'escape']) {
            await page.evaluate(() => window.test.workflow.showNewSubscription());
            const submissionId = await page.inputValue('#subscriptionSubmissionId');
            await page.fill('#subStartDate', '2026-12-17');
            await page.click('label[for="subPaymentInstruction"]');
            await dismiss('#newSubscriptionForm', method);
            await page.evaluate(() => window.test.workflow.showNewSubscription());
            assert.equal(await page.inputValue('#subStartDate'), '2026-12-17');
            assert.equal(await page.inputValue('#subscriptionSubmissionId'), submissionId);
            assert.equal(await page.isChecked('input[name="subPayment"][value="AC"]'), true);
            await dismiss('#newSubscriptionForm', 'close');
        }
        await page.click('#endCustomerWorkSessionButton');
        await page.evaluate(() => window.test.workflow.showNewSubscription());
        assert.notEqual(await page.inputValue('#subStartDate'), '2026-12-17');
        await dismiss('#newSubscriptionForm', 'close');
        await page.evaluate(() => { window.customer = { id: 5, firstName: 'Alex', lastName: 'Testklant', deliveryRemarks: { default: 'Original' }, subscriptions: [{ id: 9, magazine: 'Testgids', status: 'active', startDate: '2026-01-01' }] }; });
        const cases = [
            ['editCustomerForm', 'editLastName', 'Familieconcept', () => window.test.workflow.editCustomer()],
            ['editSubscriptionForm', 'editSubStartDate', '2026-11-23', () => window.test.workflow.editSubscription(9)],
            ['editDeliveryRemarksModal', 'editCustomerDeliveryRemarks', 'Bezorgconcept', () => window.test.remarks.editDeliveryRemarks()],
            ['articleSaleForm', 'articleLastName', 'Bestelconcept', () => window.test.orders.showArticleSale()],
            ['editorialComplaintForm', 'editorialComplaintDescription', 'Klachtconcept', () => window.test.workflow.showEditorialComplaintForm()]
        ];
        for (const [id, field, value, open] of cases) {
            await page.evaluate(open);
            await page.fill('#' + field, value);
            await dismiss('#' + id, 'backdrop');
            await page.evaluate(open);
            assert.equal(await page.inputValue('#' + field), value);
            await dismiss('#' + id, 'escape');
        }
        await page.evaluate(() => window.test.workflow.showResendMagazine());
        await page.selectOption('#resendSubscription', '9');
        await dismiss('#resendMagazineForm', 'close');
        await page.evaluate(() => window.test.workflow.showResendMagazine());
        assert.equal(await page.inputValue('#resendSubscription'), '9');
        await dismiss('#resendMagazineForm', 'escape');
        await page.evaluate(async () => {
            window.test.winback.cancelSubscription(9);
            document.querySelector('input[name="cancelReason"][value="price"]').checked = true;
            await window.test.winback.winbackNextStep(2);
        });
        await dismiss('#winbackFlow', 'close');
        await page.evaluate(() => window.test.winback.cancelSubscription(9));
        assert.equal(await page.locator('#winbackStep2').isVisible(), true);
        await dismiss('#winbackFlow', 'escape');
        await page.evaluate(() => {
            window.test.orders.showArticleSale();
            window.orderItems.push({ articleId: 'test-article', quantity: 2 });
        });
        await dismiss('#articleSaleForm', 'close');
        await page.evaluate(() => window.test.orders.showArticleSale());
        assert.equal(await page.evaluate(() => window.orderItems.length), 1);
        await dismiss('#articleSaleForm', 'escape');
        await page.evaluate(() => window.test.articles.showAllArticles());
        await page.fill('#modalArticleSearch', 'Gids');
        await dismiss('#allArticlesModal', 'close');
        await page.evaluate(() => window.test.articles.showAllArticles());
        assert.equal(await page.inputValue('#modalArticleSearch'), 'Gids');
        await dismiss('#allArticlesModal', 'escape');
        await page.click('#source');
        await page.fill('.customer-editor input[name="firstName"]', 'Bewaard concept');
        await dismiss('.customer-editor', 'close');
        await page.click('#source');
        assert.equal(await page.inputValue('.customer-editor input[name="firstName"]'), 'Bewaard concept');
        await page.locator('.customer-editor section').first().screenshot({ path: `${evidence}/retained-customer-draft-${width}.png` });
        await dismiss('.customer-editor', 'backdrop');
        await page.click('#source');
        assert.equal(await page.inputValue('.customer-editor input[name="firstName"]'), 'Bewaard concept');
        await dismiss('.customer-editor', 'escape');
        await page.click('#feedback');
        await page.fill('[name="comment"]', 'Bewaard feedbackconcept');
        await page.locator('[data-feedback-close]').click();
        await page.click('#feedback');
        assert.equal(await page.inputValue('[name="comment"]'), 'Bewaard feedbackconcept');
        await page.keyboard.press('Escape');
        await page.click('#contextualFeedbackSettingsButton');
        await page.fill('[name="imageTtlDays"]', '9');
        await page.locator('[data-feedback-settings-close]').first().click();
        await page.click('#contextualFeedbackSettingsButton');
        assert.equal(await page.inputValue('[name="imageTtlDays"]'), '9');
        await page.locator('.contextual-feedback-settings-modal').click({ position: { x: 2, y: 2 } });
        await page.click('#endCustomerWorkSessionButton');
        assert.equal(await page.locator('.customer-editor').count(), 0);
        assert.equal(await page.evaluate(() => window.orderItems.length), 0);
        assert.equal(await page.locator('.contextual-feedback-modal').count(), 0);
        assert.equal(await page.locator('.contextual-feedback-settings-modal').count(), 0);
        await page.click('#source');
        assert.equal(await page.inputValue('.customer-editor input[name="firstName"]'), 'Alex');
        await dismiss('.customer-editor', 'close');
        console.log('Draft retention, all dismissal methods, reset and responsive visibility passed: ' + width + 'px');
    }
    assert.deepEqual(errors, []);
} catch (error) {
    await page.screenshot({ path: evidence + '/failure.png' });
    console.error('Browser errors:', errors);
    throw error;
} finally { await browser.close(); }
