import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';

const modulePath = fileURLToPath(import.meta.url);
const phase = process.env.KIWI_THEME_AUDIT_ARTICLE_PHASE || 'before';
const hash = value => createHash('sha256').update(value).digest('hex');
const behaviorFiles = ['js/app/slices/article-search-slice.js', 'js/app/slices/order.js',
    'js/app/slices/delivery-date-picker-slice.js', 'js/app/lightbox-drafts.js'];
const articles = [
    { id: 990601, name: 'Synthetic long article title with descriptive edition and delivery context', code: 'THEME06-ALPHA',
        magazine: 'Synthetic magazine Alpha', category: 'Synthetic print', price: 12.5, popular: true },
    { id: 990602, name: 'Synthetic second article with a different long publication and product name', code: 'THEME06-BETA',
        magazine: 'Synthetic magazine Beta', category: 'Synthetic gift', price: 7.25, popular: false }
];

export async function trackArticleBehavior(page, driver, meta) {
    const sources = Object.fromEntries(await Promise.all(behaviorFiles.map(async file => [file, await readFile(path.join(driver.sourceRoot, 'assets', file), 'utf8')])));
    const pending = [], seen = new Set();
    page.on('response', response => {
        const url = new URL(response.url());
        const file = behaviorFiles.find(file => {
            const expected = new URL('assets/' + file, driver.baseUrl), stem = path.posix.basename(expected.pathname, '.js');
            return url.origin === expected.origin && path.posix.dirname(url.pathname) === path.posix.dirname(expected.pathname)
                && new RegExp('^' + stem + '(?:-[\\w-]{7})?\\.js$').test(path.posix.basename(url.pathname));
        });
        if (!file) return;
        pending.push((async () => {
            const body = await response.body().catch(() => null);
            if (!body) return;
            const source = sources[file], sourceUrl = new URL('assets/' + file, driver.baseUrl);
            const sourceHash = hash(normalizeKnownJsImports(source, source, sourceUrl));
            const servedHash = hash(normalizeKnownJsImports(body.toString('utf8'), source, sourceUrl));
            driver.report.articleEvidence.loadedBehavior.push({ file, sourceHash, servedHash, ...meta });
            driver.check(file + ' article source matches served behavior', servedHash, sourceHash, meta, 6);
            seen.add(file);
        })());
    });
    return async () => {
        await Promise.all(pending);
        for (const file of behaviorFiles) driver.check(file + ' actual article behavior loaded', seen.has(file), true, meta, 6);
    };
}

function calendarFixture(year, month, today) {
    const minimum = new Date(today + 'T12:00:00Z'); minimum.setUTCDate(minimum.getUTCDate() + 2);
    while (minimum.getUTCDay() === 0) minimum.setUTCDate(minimum.getUTCDate() + 1);
    const minimumDate = minimum.toISOString().slice(0, 10);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { year, month, monthLabel: `${year}-${String(month).padStart(2, '0')}`, today,
        minimumDate, recommendedDate: minimumDate, days: Array.from({ length: count }, (_, index) => {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
            const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
            return { date, day: index + 1, available: date >= minimumDate && weekday !== 0, past: date < today,
                recommended: date === minimumDate, title: `Synthetic delivery date ${date}` };
        }) };
}

export async function installArticleFixtures(page, driver) {
    const api = new URL('api/v1/catalog/', driver.baseUrl), requests = driver.report.articleEvidence.fixtureRequests;
    const controls = { searchRequests: [], heldSearches: [], quoteMode: 'normal', quoteVariant: 'normal', heldQuotes: [], workflowMode: null, workflowRequests: [], heldWorkflows: [], addressSessions: new Set(), addressEnabled: false };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    driver.report.articleEvidence.calendarFixture = { today, eligibility: 'Declared synthetic calendar: two-day minimum, Sunday unavailable. Not a server-policy acceptance claim.' };
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        try {
            if (url.origin !== api.origin) return route.fallback();
            if (request.method() === 'GET' && url.pathname === api.pathname + 'articles') {
                const keys = [...url.searchParams.keys()];
                if (keys.some(key => !['query', 'popular', 'limit', 'tab'].includes(key))) throw new Error('Unexpected synthetic article query shape.');
                requests.push({ method: 'GET', path: url.pathname, query: url.search, kind: 'Exact synthetic catalogue response; actual renderer, no upstream request.' });
                const query = url.searchParams.get('query') || '';
                controls.searchRequests.push(query);
                if (query === 'held06') await new Promise(resolve => controls.heldSearches.push(resolve));
                if (query === 'error06') return route.fulfill({ status: 503, json: { error: { code: 'synthetic_catalog_unavailable', message: 'Synthetic catalogue is temporarily unavailable.' } } });
                const popular = url.searchParams.get('popular') === 'true';
                const items = query === 'empty06' ? [] : popular ? articles.filter(article => article.popular) : articles;
                return route.fulfill({ json: { items, total: items.length } });
            }
            const article = articles.find(article => url.pathname === api.pathname + 'articles/' + article.id);
            if (request.method() === 'GET' && article) {
                requests.push({ method: 'GET', path: url.pathname, kind: 'Exact synthetic article detail.' });
                return route.fulfill({ json: article });
            }
            if (request.method() === 'GET' && url.pathname === api.pathname + 'delivery-calendar') {
                const year = Number(url.searchParams.get('year')), month = Number(url.searchParams.get('month'));
                if ([...url.searchParams.keys()].sort().join(',') !== 'month,year' || !Number.isInteger(year) || month < 1 || month > 12)
                    throw new Error('Unexpected synthetic calendar query shape.');
                requests.push({ method: 'GET', path: url.pathname, query: url.search, kind: 'Declared synthetic calendar eligibility; actual calendar widget.' });
                return route.fulfill({ json: calendarFixture(year, month, today) });
            }
            const addressApi = new URL('api/v1/addresses/', driver.baseUrl);
            if (controls.addressEnabled && url.pathname.startsWith(addressApi.pathname)) {
                if (request.method() === 'DELETE' && controls.addressSessions.has(url.pathname.slice((addressApi.pathname + 'sessions/').length))
                    && url.pathname.startsWith(addressApi.pathname + 'sessions/')) {
                    requests.push({ method: 'DELETE', path: url.pathname, kind: 'Exact synthetic local address-session cleanup, no upstream mutation.' });
                    return route.fulfill({ status: 204 });
                }
                if (request.method() === 'POST' && ['search', 'validate'].some(name => url.pathname === addressApi.pathname + name)) {
                    const payload = request.postDataJSON();
                    if (!payload || typeof payload.formSessionId !== 'string' || !/^[\w-]+$/.test(payload.formSessionId)
                        || payload.postalCode !== '2468ZX' || payload.houseNumber !== '12'
                        || (payload.street !== undefined && payload.street !== 'Syntheticstraat')
                        || (payload.city !== undefined && payload.city !== 'SYNTHETIC CITY')) throw new Error('Unexpected synthetic article address payload.');
                    controls.addressSessions.add(payload.formSessionId);
                    const address = { postalCode: '2468ZX', houseNumber: '12', houseNumberAddition: '', street: 'Syntheticstraat', city: 'SYNTHETIC CITY', countryCode: 'NL', verified: true };
                    requests.push({ method: 'POST', path: url.pathname, payload, kind: 'Declared synthetic address confirmation, original address controller; no upstream request.' });
                    return route.fulfill({ json: url.pathname.endsWith('/validate') ? { status: 'confirmed', address }
                        : { status: 'ambiguous', candidates: [address], complete: true } });
                }
            }
            const workflowPath = new URL('api/v1/workflows/article-order', driver.baseUrl).pathname;
            if (request.method() === 'POST' && url.pathname === workflowPath && controls.workflowMode) {
                const payload = request.postDataJSON();
                const customer = payload?.customer, order = payload?.order;
                const knownTopLevel = Object.keys(payload || {}).sort().join(',') === 'contactEntry,customer,order';
                const knownCustomerShape = Object.keys(customer || {}).sort().join(',')
                    === 'address,addressExtension,articles,birthday,city,contactHistory,email,firstName,formSessionId,houseNumber,houseNumberAddition,lastName,middleName,phone,postalCode,salutation,street,subscriptions';
                const knownCustomer = knownCustomerShape && customer.firstName === 'S.Q.' && customer.lastName === 'Synthetic private family06'
                    && customer.birthday === '1980-12-28' && customer.email === 'private06@example.invalid' && customer.phone === '0209462718';
                const knownAddress = knownCustomerShape && controls.addressSessions.has(customer.formSessionId)
                    && customer.postalCode === '2468ZX' && customer.houseNumber === '12'
                    && customer.street === 'Syntheticstraat' && customer.city === 'SYNTHETIC CITY';
                const knownOrderState = order?.paymentMethod === 'Bankoverschrijving' && order.deliveryStatus === 'ordered'
                    && order.paymentStatus === 'paid' && /^3SABCD[0-9]+NL$/.test(order.trackingNumber || '');
                const knownItems = order?.items?.length === 2
                    && order.items.every(item => articles.some(article => article.id === Number(item.articleId)));
                const knownContact = payload?.contactEntry?.type === 'Artikel bestelling';
                const known = knownTopLevel && knownCustomer && knownAddress && knownOrderState && knownItems && knownContact;
                if (!known) throw new Error('Unexpected synthetic article-order workflow payload.');
                controls.workflowRequests.push(payload);
                requests.push({ method: 'POST', path: url.pathname, payload, kind: 'Actual article-order request held/rejected entirely locally; never upstream or staged.' });
                if (controls.workflowMode === 'held') await new Promise(resolve => controls.heldWorkflows.push(resolve));
                return route.fulfill({ status: 422, json: { error: { code: 'synthetic_article_rejected', message: 'Synthetic article order is temporarily unavailable.' } } });
            }
            if (request.method() !== 'POST' || url.pathname !== api.pathname + 'article-order-quote') return route.fallback();
            const payload = request.postDataJSON();
            const exactKeys = payload && Object.keys(payload).sort().join(',') === 'couponCode,items';
            const knownItems = exactKeys && Array.isArray(payload.items) && payload.items.length > 0 && payload.items.every(item => {
                const source = articles.find(article => article.id === Number(item.articleId));
                return source && Object.keys(item).sort().join(',') === 'articleId,code,magazine,name,quantity,unitPrice' && item.code === source.code && item.name === source.name && item.magazine === source.magazine
                    && Number(item.unitPrice) === source.price && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 5;
            });
            if (!knownItems || ![null, 'THEME06', 'BAD06'].includes(payload.couponCode)) throw new Error('Unexpected read-only synthetic quote contract.');
            const items = payload.items.map(item => ({ ...item }));
            if (controls.quoteVariant === 'unknown-title') items[0].name = 'Synthetic private custom title06';
            const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
            const discounts = items.filter(item => item.quantity >= 5).map(item => ({ type: 'Stapelkorting', itemName: item.name,
                description: `10% korting op ${item.name} (${item.quantity}x)`, amount: item.unitPrice * item.quantity * 0.1, isCoupon: false }));
            if (controls.quoteVariant === 'unknown-description' && discounts.length) discounts[0].description = 'Synthetic private discount note06';
            const coupon = payload.couponCode === 'THEME06' ? { valid: true, code: 'THEME06', type: 'fixed', amount: 2.5, description: 'Synthetic coupon quote fixture' }
                : payload.couponCode === 'BAD06' ? { valid: false, code: 'BAD06', message: 'Synthetic coupon is unavailable for this order.' } : null;
            if (coupon?.valid) discounts.push({ type: 'Kortingscode', description: `${coupon.description} (${coupon.code})`, amount: 2.5, isCoupon: true });
            const totalDiscount = discounts.reduce((sum, discount) => sum + discount.amount, 0);
            const response = { items, subtotal, discounts, totalDiscount, total: subtotal - totalDiscount, couponCode: coupon?.valid ? coupon.code : null, coupon };
            if (controls.quoteMode === 'held') await new Promise(resolve => controls.heldQuotes.push(resolve));
            requests.push({ method: 'POST', path: url.pathname, payload, response, kind: 'Exact read-only quote intercepted locally; no workflow submission or upstream mutation.' });
            return route.fulfill({ json: response });
        } catch (error) {
            driver.report.errors.push({ scenario: 'article fixture contract', method: request.method(), path: url.pathname, message: error.message });
            return route.abort('blockedbyclient');
        }
    });
    return controls;
}

export async function observeArticle(page, driver, meta, state, selector) {
    if (selector) await page.locator(selector).first().scrollIntoViewIfNeeded();
    await driver.painted(page);
    const data = await page.evaluate(() => {
        const root = document.querySelector('#articleSaleForm .onepager-container'), form = document.getElementById('articleForm');
        const read = node => { if (!node) return null; const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
            return { id: node.id, x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom,
                radius: css.borderRadius, padding: css.padding, fontSize: css.fontSize, shadow: css.boxShadow, display: css.display, overflow: node.scrollWidth > node.clientWidth + 1 }; };
        return { root: read(root), form: read(form), columns: [...form.querySelectorAll('.article-sale-left,.article-sale-right')].map(read),
            fields: [...form.querySelectorAll('input:not([type="hidden"]),select,textarea')].map(node => ({ ...read(node), readonly: node.readOnly,
                labelled: Boolean(node.labels?.length || node.getAttribute('aria-labelledby')), value: node.value })),
            actions: [...form.querySelectorAll('button')].map(node => ({ ...read(node), type: node.type, action: node.dataset.action, text: node.textContent.trim() })),
            cart: window.orderItems, subtotal: document.getElementById('orderSubtotal').textContent, total: document.getElementById('orderTotal').textContent,
            couponMessage: document.getElementById('couponMessage').textContent, deliveryDate: document.getElementById('articleDesiredDelivery').value,
            catalog: { root: read(document.getElementById('allArticlesModal')), cards: [...document.querySelectorAll('#allArticlesModal .article-card')].map(read) },
            calendar: read(document.getElementById('deliveryCalendar')), documentWidth: document.documentElement.scrollWidth, viewport: { width: innerWidth, height: innerHeight }, scrollX, scrollY };
    });
    driver.report.articleEvidence.observations.push({ ...meta, state, data });
    if (phase === 'after') await (await import('./compose-smoke-theme-audit-article-acceptance.mjs')).checkArticleState(page, driver, meta, state);
    await driver.capture(page, (meta.native ? 'native-200' : phase) + '-article-' + state, undefined,
        'Actual article/catalog/cart/calendar UI with declared synthetic catalogue/calendar and locally intercepted read-only quotes; source-bound ' + phase + ', no submission.');
}

export async function runArticleScenarios(page, driver, meta, controls) {
    await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
    await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
    await observeArticle(page, driver, meta, 'initial', '#articleSaleForm h2');
    await page.locator('#articleSearch').fill('Synthetic');
    await page.locator('#articleDropdown [data-arg-article-id="990601"]').waitFor({ state: 'visible' });
    await observeArticle(page, driver, meta, 'search-results', '#articleSearch');
    await page.locator('#articleDropdown .browse-all-link').press('Enter');
    await page.locator('#allArticlesModal [data-arg-article-id="990601"]').waitFor({ state: 'visible' });
    await observeArticle(page, driver, meta, 'catalog', '#allArticlesModal .modal-header h3');
    await page.locator('#allArticlesModal [data-arg-article-id="990601"]').press('Enter');
    await page.locator('#allArticlesModal').waitFor({ state: 'hidden' });
    await page.locator('#articleQuantity').fill('5'); await page.locator('#articleQuantity').press('Tab');
    await observeArticle(page, driver, meta, 'selected-quantity-price', '#articleSearch');
    await page.locator('[data-action="add-article-to-order"]').press('Enter');
    await page.waitForFunction(() => window.orderItems?.length === 1 && document.querySelectorAll('#orderItemsList .order-item').length === 1);
    await page.locator('#articleSearch').fill('Synthetic');
    await page.locator('#articleDropdown [data-arg-article-id="990602"]').press('Enter');
    await page.locator('#articleQuantity').fill('2'); await page.locator('#articleQuantity').press('Tab');
    await page.locator('[data-action="add-article-to-order"]').press('Enter');
    await page.waitForFunction(() => window.orderItems?.length === 2 && document.querySelectorAll('#orderItemsList .order-item').length === 2);
    if (phase === 'after') await page.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 10000 });
    await observeArticle(page, driver, meta, 'populated-quote', '#orderItemsSection');
    await page.locator('#couponCode').fill('THEME06'); await page.locator('#couponCode').press('Enter');
    await page.locator('#couponMessage.success').waitFor({ state: 'visible' });
    await page.locator('.coupon-remove').waitFor({ state: 'visible' });
    if (phase === 'after') await page.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 10000 });
    await observeArticle(page, driver, meta, 'coupon-success-total', '#couponMessage');
    await page.locator('#couponCode').fill('BAD06'); await page.locator('#couponCode').press('Enter');
    await page.locator('#couponMessage.error').waitFor({ state: 'visible' });
    await page.locator('.coupon-remove').waitFor({ state: 'hidden' });
    await observeArticle(page, driver, meta, 'coupon-error', '#couponMessage');
    await page.locator('#articleNotes').fill('Synthetic long delivery note: please use the indicated entrance, keep the package dry, and preserve this complete local draft.');
    await page.locator('#articlePaymentTransfer').press('Space');
    await observeArticle(page, driver, meta, 'payment-notes-actions', '#articleNotes');
    await page.locator('#deliveryDateDisplay').press('Enter');
    await page.locator('#deliveryCalendar .delivery-calendar-grid').waitFor({ state: 'visible' });
    await observeArticle(page, driver, meta, 'calendar', '#deliveryDateDisplay');
    await page.keyboard.press('Escape');
    if (phase === 'after' && meta.suite === 'focused') {
        const acceptance = await import('./compose-smoke-theme-audit-article-acceptance.mjs');
        await acceptance.inspectArticleInteractions(page, driver, meta, controls, observeArticle);
    }
}

export async function inspectArticle(driver, viewport, contract) {
    driver = { ...driver, contract };
    const report = driver.report, meta = { viewport, locale: 'nl', phase, suite: process.env.KIWI_THEME_AUDIT_ARTICLE_SUITE || 'layout' };
    await prepareArticleEvidence(driver);
    const context = await driver.newContext(viewport), page = await context.newPage();
    page.setDefaultTimeout(10000);
    const finishCss = driver.trackStylesheets(page, meta), finishBehavior = await trackArticleBehavior(page, driver, meta);
    page.on('pageerror', error => report.errors.push({ scenario: 'article ' + phase + ' runtime', viewport, message: error.message }));
    let controls;
    try {
        controls = await installArticleFixtures(page, driver); await driver.login(page);
        driver.check('actual requested article locale', await page.locator('html').getAttribute('lang'), 'nl', meta, 6);
        await runArticleScenarios(page, driver, meta, controls);
    } catch (error) {
        report.errors.push({ scenario: 'article ' + phase + ' setup', viewport, message: error.message });
        await driver.capture(page, 'article-before-failure', undefined, 'Incomplete observational article setup; failure retained.').catch(() => {});
    } finally {
        releaseArticleFixtures(controls);
        await finishBehavior(); await finishCss(); await context.close(); await driver.saveReport();
    }
}

export async function prepareArticleEvidence(driver) {
    driver.report.articleEvidence ||= { companion: { path: modulePath, sha256: hash(await readFile(modulePath)) },
        scope: phase === 'before' ? 'Representative observational BEFORE only. Source/locale counters are not layout, calculation, server-policy or workflow acceptance.' : 'Scoped article presentation and preserved interactions; declared fixtures do not prove server pricing or delivery policy.',
        articles, fixtureRequests: [], loadedBehavior: [], observations: [] };
}

export function releaseArticleFixtures(controls) {
    for (const held of [controls?.heldSearches, controls?.heldQuotes, controls?.heldWorkflows]) held?.splice(0).forEach(resolve => resolve());
}
