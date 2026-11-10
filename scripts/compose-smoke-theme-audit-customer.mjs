#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';

const modulePath = fileURLToPath(import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const phase = process.env.KIWI_THEME_AUDIT_CUSTOMER_PHASE || 'before';
const files = ['js/app/slices/customer-search-slice.js', 'js/app/slices/customer-detail-slice.js',
    'js/app/customer-editor.js', 'js/app/address-fields.js', 'js/app/address-completion.js', 'js/app/lightbox-drafts.js'];

async function trackBehavior(page, driver, context) {
    const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(path.join(driver.sourceRoot, 'assets', file), 'utf8')])));
    driver.report.customerEvidence.sourceBehavior = Object.fromEntries(files.map(file => [file, hash(sources[file])]));
    const pending = [], seen = new Set();
    page.on('response', response => {
        const url = new URL(response.url());
        const file = files.find(file => {
            const expected = new URL('assets/' + file, driver.baseUrl);
            const stem = path.posix.basename(expected.pathname, '.js');
            return url.origin === expected.origin && path.posix.dirname(url.pathname) === path.posix.dirname(expected.pathname)
                && new RegExp('^' + stem + '(?:-[\\w-]{7})?\\.js$').test(path.posix.basename(url.pathname));
        });
        if (!file) return;
        pending.push((async () => {
            const body = await response.body().catch(() => null); if (!body) return;
            const source = sources[file], sourceUrl = new URL('assets/' + file, driver.baseUrl);
            const sourceHash = hash(normalizeKnownJsImports(source, source, sourceUrl));
            const servedHash = hash(normalizeKnownJsImports(body.toString('utf8'), source, sourceUrl));
            driver.report.customerEvidence.loadedBehavior.push({ file, pathname: url.pathname, sourceHash, servedHash, context });
            driver.check(file + ' customer source matches served behavior', servedHash, sourceHash, context, 4); seen.add(file);
        })());
    });
    return async () => {
        await Promise.all(pending);
        for (const file of files) driver.check(file + ' actual customer behavior loaded', seen.has(file), true, context, 4);
    };
}

async function observe(page, driver, meta, state, selector) {
    await driver.painted(page);
    const observed = await page.evaluate(() => {
        const rect = node => {
            const r = node.getBoundingClientRect(), s = getComputedStyle(node);
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
                display: s.display, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
                padding: s.padding, background: s.backgroundColor, color: s.color, radius: s.borderRadius,
                borderBottom: s.borderBottom, shadow: s.boxShadow, outline: s.outline, outlineOffset: s.outlineOffset,
                hovered: node.matches(':hover'), focusVisible: node.matches(':focus-visible') };
        };
        const ids = [...document.querySelectorAll('.customer-editor [id]')].map(node => node.id);
        const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
        return { viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, scrollX, scrollY,
            documentWidth: document.documentElement.scrollWidth,
            filter: rect(document.querySelector('#additionalFiltersToggle')),
            rows: [...document.querySelectorAll('.result-row')].map(row => ({ bounds: rect(row),
                cells: [...row.cells].map(rect), actions: [...row.querySelectorAll('button')].map(button => ({ className: button.className, disabled: button.disabled, bounds: rect(button) })) })),
            editors: [...document.querySelectorAll('.customer-editor')].map(dialog => ({ open: dialog.open, heading: dialog.getAttribute('aria-labelledby'),
                ownHeadingCount: dialog.querySelectorAll('h2[id]').length, bounds: rect(dialog),
                markedNames: dialog.querySelectorAll('[data-feedback-sensitive="name"]').length,
                markedIds: dialog.querySelectorAll('[data-feedback-sensitive="id"]').length,
                fields: [...dialog.querySelectorAll('input,select,textarea')].map(field => ({ id: field.id, name: field.name, readonly: field.readOnly, disabled: field.disabled,
                    hasLabel: Boolean(field.labels?.length || field.getAttribute('aria-label') || field.getAttribute('aria-labelledby')), bounds: rect(field) })),
                addresses: [...dialog.querySelectorAll('[data-address-prefix]')].map(node => ({ prefix: node.dataset.addressPrefix,
                    choices: node.querySelectorAll('option').length, statusRegions: node.querySelectorAll('[role="status"]').length })) })),
            duplicateEditorIds: duplicates };
    });
    driver.report.customerEvidence.observations.push({ ...meta, state, observed });
    await driver.capture(page, meta.prefix + state, selector, meta.kind);
}

async function sourceEditorFixtures(page, driver, meta) {
    const kind = 'Controlled actual source-editor renderer with synthetic read model; no server permission or save acceptance.';
    await page.evaluate(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/customer-editor.js'));
        if (!key) throw new Error('Actual customer editor import is required.');
        const { openCustomerEditor } = await import(imports[key]);
        const model = readonly => ({ version: 'theme-audit-synthetic', capabilities: { roleCanWrite: !readonly,
            operations: Object.fromEntries(['person.update', 'address.update', 'email.update'].map(key => [key, { enabled: !readonly }])) },
            sections: { person: [{ id: 'person', fields: { firstName: 'Synthetic', initials: 'S.', surName: '', lastName: 'Retained editor with a deliberately long family name', salutation: 'Mevr.', birthDay: '1980-07-22' } }],
                address: [{ id: 'address', fields: { postCode: '', housenumber: '', street: '', city: '', isoCountryCode: 'NL', extension: '310', additionalExtension: 'Desk' } }],
                email: [{ id: 'email', fields: { emailAddress: 'synthetic-long-address@example.invalid' } }], phone: [], mobile: [], bank: [] } });
        let firstLoaded = false, failedSecondOnce = false;
        window.themeAuditOpenSourceEditor = mode => openCustomerEditor({ id: 'fixture04', personId: 'fixture04',
            credentialKey: 'synthetic-source-' + mode, mandant: mode === 'a' ? 'TROS' : 'AVROTROS',
            firstName: 'Synthetic', lastName: 'Retained editor ' + mode }, { api: { get: async () => {
                    if (mode === 'a' && !firstLoaded) return new Promise(resolve => {
                        window.themeAuditReleaseEditor = () => { firstLoaded = true; resolve(model(false)); };
                    });
                    if (mode === 'b' && !failedSecondOnce) { failedSecondOnce = true; throw new Error('Synthetic read-model lookup failure.'); }
                    return model(mode === 'readonly');
                }, request: async () => { throw new Error('theme_audit fixture forbids customer writes.'); } }, refresh: async () => {} });
        void window.themeAuditOpenSourceEditor('a');
    });
    const dialog = () => page.locator('.customer-editor[open]');
    await dialog().waitFor({ state: 'visible' });
    await observe(page, driver, { ...meta, kind }, 'source-editor-loading', '.customer-editor[open]');
    await page.evaluate(() => window.themeAuditReleaseEditor());
    await dialog().locator('section').first().waitFor();
    const person = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Persoonsgegevens', exact: true }) });
    await person.locator('select').first().selectOption('0');
    const address = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Adres', exact: true }) });
    await address.locator('select').first().selectOption('0');
    await observe(page, driver, { ...meta, kind }, 'source-editor-fields', '.customer-editor[open]');
    const prefix = await address.locator('[data-address-prefix]').getAttribute('data-address-prefix');
    await address.locator(`[id="${prefix}HouseNumber"]`).fill('2A');
    await address.locator(`[id="${prefix}PostalCode"]`).fill('1223CK');
    await address.locator(`[id="${prefix}AddressChoices"]`).waitFor({ state: 'visible' });
    await observe(page, driver, { ...meta, kind }, 'source-address-candidates', '.customer-editor[open]');
    await address.locator(`[id="${prefix}AddressChoices"]`).selectOption('0');
    await observe(page, driver, { ...meta, kind }, 'source-address-selected', '.customer-editor[open]');
    await dialog().locator('.btn-close').press('Enter');
    await page.evaluate(() => window.themeAuditOpenSourceEditor('b'));
    await dialog().waitFor({ state: 'visible' });
    await observe(page, driver, { ...meta, kind }, 'source-editor-lookup-failed', '.customer-editor[open]');
    await dialog().locator('.btn-close').press('Enter');
    await page.evaluate(() => window.themeAuditOpenSourceEditor('b'));
    const secondAddress = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Adres', exact: true }) });
    await secondAddress.locator('select').first().selectOption('0');
    await observe(page, driver, { ...meta, kind }, 'two-retained-editable-addresses', '.customer-editor[open]');
    await dialog().locator('.btn-close').press('Enter');
    await page.evaluate(() => window.themeAuditOpenSourceEditor('readonly'));
    await dialog().waitFor({ state: 'visible' });
    const readonlyAddress = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Adres', exact: true }) });
    await readonlyAddress.locator('select').first().selectOption('0');
    await observe(page, driver, { ...meta, kind }, 'retained-editors-readonly-address', '.customer-editor[open]');
    await dialog().locator('.btn-close').press('Enter');
}

export async function inspectCustomer(driver, viewport) {
    if (phase !== 'before') throw new Error('Observational customer BEFORE helper cannot accept AFTER states.');
    const report = driver.report;
    report.customerEvidence ||= { marker: 'theme_audit', phase, scope: 'Observed BEFORE defects and component fixtures, not parity acceptance.',
        companion: { path: modulePath, sha256: hash(await readFile(modulePath)) },
        normalizationHelper: { path: fileURLToPath(new URL('./compose-smoke-theme-audit-shell-acceptance.mjs', import.meta.url)), sha256: hash(await readFile(new URL('./compose-smoke-theme-audit-shell-acceptance.mjs', import.meta.url))) }, observations: [], loadedBehavior: [], interceptedFixtureRequests: [] };
    const locales = viewport.width === 390 ? ['nl', 'en'] : ['nl'];
    for (const locale of locales) {
        const context = await driver.newContext(viewport), page = await context.newPage();
        const meta = { viewport, locale, prefix: 'before-' + locale + '-customer-', kind: 'Actual local customer application BEFORE flow; no parity acceptance.' };
        const finishCss = driver.trackStylesheets(page, meta), finishBehavior = await trackBehavior(page, driver, meta);
        page.on('pageerror', error => report.errors.push({ scenario: 'customer BEFORE runtime', viewport, locale, message: error.message }));
        let fixtureRows = null, addressFixtures = false;
        const apiPath = driver.baseUrl.pathname.replace(/\/$/, '') + '/api/v1/';
        await page.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== driver.baseUrl.origin) return route.fallback();
            if (fixtureRows && request.method() === 'GET' && url.pathname === apiPath + 'persons') return route.fulfill({ json: { items: fixtureRows } });
            const isLookup = addressFixtures && request.method() === 'POST' && ['addresses/search', 'addresses/validate'].some(suffix => url.pathname === apiPath + suffix);
            const isCleanup = addressFixtures && request.method() === 'DELETE' && new RegExp('^' + apiPath + 'addresses/sessions/[a-zA-Z0-9-]+$').test(url.pathname);
            if (!isLookup && !isCleanup) return route.fallback();
            report.customerEvidence.interceptedFixtureRequests.push({ method: request.method(), path: url.pathname, kind: 'Synthetic address protocol response; never sent upstream.' });
            if (isCleanup) return route.fulfill({ status: 204 });
            const payload = request.postDataJSON();
            const candidates = ['1', '2'].map(houseNumberAddition => ({ postalCode: '1223CK', houseNumber: '2A', houseNumberAddition, street: 'Synthetic street', city: 'HILVERSUM', countryCode: 'NL', verified: true }));
            return route.fulfill({ json: url.pathname.endsWith('/search') ? { status: 'matched', candidates, complete: true } : { status: 'confirmed', address: { ...payload, verified: true } } });
        });
        try {
            await driver.login(page);
            if (locale === 'en') { await page.locator('#agentProfileTrigger').press('Enter'); await page.locator('[data-locale-option="en"]').press('Enter'); }
            driver.check('actual customer BEFORE locale', await page.locator('html').getAttribute('lang'), locale, meta, 4);
            await observe(page, driver, meta, 'filter-default', '.search-card');
            await page.locator('#additionalFiltersToggle').hover();
            await observe(page, driver, meta, 'filter-hover', '.search-card');
            if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').press('Enter');
            await page.locator('#searchName').fill('Jansen');
            await page.locator('button[data-action="search-customer"]').press('Enter');
            await page.locator('.result-row').first().waitFor();
            await observe(page, driver, meta, 'actual-results', '#searchResultsView');
            const view = page.locator('.result-row-actions button[data-action="select-customer"]').first();
            await view.hover(); await observe(page, driver, meta, 'actual-view-hover', '#searchResultsView');
            await view.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
            await observe(page, driver, meta, 'actual-view-keyboard-focus');
            await view.press('Enter'); await page.locator('#customerDetail').waitFor({ state: 'visible' });
            await observe(page, driver, meta, 'actual-record', '#customerDetail');
            await page.locator('#editCustomerBtn').press('Enter'); await page.locator('#editCustomerForm').waitFor({ state: 'visible' });
            await observe(page, driver, meta, 'legacy-editor', '#editCustomerForm');
            await page.locator('#editCustomerForm [data-action="close-form"]').first().press('Enter');
            fixtureRows = Array.from({ length: 3 }, (_, index) => ({ id: 990040 + index, firstName: 'Synthetic', initials: 'S. ' + String.fromCharCode(65 + index) + '.',
                lastName: index === 1 ? 'Long family name with several visible components' : 'Table example ' + (index + 1),
                address: index === 1 ? 'Synthetic long street name 123 with an additional address line' : 'Example street ' + (index + 1),
                postalCode: '1234AB', city: 'SYNTHETIC CITY', subscriptions: index === 2 ? [] : index === 1 ? [{ magazine: 'Ended example', status: 'ended' }] : [{ magazine: 'Active example A', status: 'active' }, { magazine: 'Active example B', status: 'active' }] }));
            const originalCallGetter = await page.evaluateHandle(() => window.kiwiLegacyCustomerSearchBridge.getCallSession);
            try {
                await page.evaluate(() => { window.kiwiLegacyCustomerSearchBridge.getCallSession = () => ({ active: true, callerType: 'anonymous' }); });
                await page.locator('#searchName').fill('Synthetic'); await page.locator('button[data-action="search-customer"]').press('Enter');
                await page.waitForFunction(() => document.querySelectorAll('.result-row').length === 3);
                await observe(page, driver, { ...meta, kind: 'Controlled GET search fixture and read-only call-context getter through actual three-row renderer; no call/identify/selection action.' }, 'mixed-table', '#searchResultsView');
            } finally {
                await page.evaluate(original => { window.kiwiLegacyCustomerSearchBridge.getCallSession = original; }, originalCallGetter);
                await originalCallGetter.dispose(); fixtureRows = null;
            }
            addressFixtures = true;
            await sourceEditorFixtures(page, driver, meta);
        } catch (error) {
            report.errors.push({ scenario: 'customer BEFORE setup', viewport, locale, message: error.message });
            await driver.capture(page, meta.prefix + 'failure', undefined, 'Incomplete actual customer BEFORE scenario').catch(() => {});
        } finally { await finishBehavior(); await finishCss(); await context.close(); await driver.saveReport(); }
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./compose-smoke-theme-audit.mjs', import.meta.url))], {
        stdio: 'inherit', env: { ...process.env, KIWI_THEME_AUDIT_CUSTOMER_ONLY: '1', KIWI_THEME_AUDIT_SLICE: process.env.KIWI_THEME_AUDIT_SLICE || '4' }
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}
