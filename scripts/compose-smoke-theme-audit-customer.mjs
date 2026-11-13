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
const finalSource = process.env.KIWI_THEME_AUDIT_FINAL_SOURCE === '1';
if (finalSource && phase !== 'after') throw new Error('Final record navigation requires explicit AFTER mode.');
const lookupOnly = process.env.KIWI_THEME_AUDIT_CUSTOMER_LOOKUP_ONLY === '1';
const lookupFiles = ['js/app/subscription-role-runtime.js'];
if (phase === 'after') lookupFiles.push('js/app/slices/subscription-role-slice.js');
const files = lookupOnly ? lookupFiles : ['js/app/slices/customer-search-slice.js', 'js/app/slices/customer-detail-slice.js',
    'js/app/customer-editor.js', 'js/app/address-fields.js', 'js/app/address-completion.js', 'js/app/lightbox-drafts.js',
    ...(phase === 'after' ? ['js/app/subscription-role-runtime.js', 'js/app/slices/subscription-role-slice.js', 'js/app/contextual-feedback/screenshot-redaction.js', 'js/app/contextual-feedback/screenshot.js', 'js/app/contextual-feedback/screenshot-form-state.js'] : [])];

export async function trackCustomerBehavior(page, driver, context) {
    await prepareCustomerEvidence(driver.report);
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
    const editorState = state.startsWith('source-') || state.includes('retained-');
    if (phase === 'after' && editorState) {
        const editor = page.locator('.customer-editor[open]');
        if (state === 'source-editor-lower-fields') await editor.locator('section').last().scrollIntoViewIfNeeded();
        else if (state.startsWith('source-address-')) {
            const status = editor.locator('[id$="AddressStatus"]');
            if (await status.isVisible()) await status.scrollIntoViewIfNeeded();
            else await editor.locator('[id$="PostalCode"]').scrollIntoViewIfNeeded();
        } else if (state === 'retained-editor-reopened-draft') await editor.locator('[id$="AdditionalExtension"]').scrollIntoViewIfNeeded();
        else await editor.locator('h2').scrollIntoViewIfNeeded();
        selector = undefined;
    }
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
    if (phase === 'after') {
        const { checkCustomerState } = await import('./compose-smoke-theme-audit-customer-acceptance.mjs');
        await checkCustomerState(page, driver, meta, state);
    }
    await driver.capture(page, meta.prefix + state, selector, meta.kind);
}

async function selectSourceRecord(section) {
    if (finalSource) {
        await section.locator('.customer-editor-record-action[data-customer-record-index="0"]').click();
        return;
    }
    await section.locator('select').first().selectOption('0');
}

async function expandSourceSections(dialog) {
    if (finalSource) {
        for (const section of await dialog.locator('section[data-customer-section]').all()) {
            const action = section.locator('.customer-editor-record-action[data-customer-record-index="0"]');
            if (await action.count()) await action.click();
        }
        return;
    }
    for (const section of await dialog.locator('section').all()) {
        const select = section.locator('select').first();
        if (await select.locator('option[value="0"]').count() && await select.inputValue() === '') await select.selectOption('0');
    }
}

async function sourceEditorFixtures(page, driver, meta, fixtures) {
    const kind = 'Controlled actual source-editor renderer with synthetic read model; no server permission or save acceptance.';
    const compact = Boolean(meta.compact || meta.native);
    await page.evaluate(async settings => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/customer-editor.js'));
        if (!key) throw new Error('Actual customer editor import is required.');
        const { openCustomerEditor } = await import(imports[key]);
        const model = readonly => ({ version: 'theme-audit-synthetic', capabilities: { roleCanWrite: !readonly,
            operations: Object.fromEntries(['person.update', 'address.update', 'email.update'].map(key => [key, { enabled: !readonly }])) },
            sections: { person: [{ id: 'person', fields: { firstName: 'Synthetic', initials: 'S.', surName: '', lastName: 'Retained editor with a deliberately long family name', salutation: 'Mevr.', birthDay: '1980-07-22' } }],
                address: [{ id: 'address', fields: { postCode: '', housenumber: '', street: '', city: '', isoCountryCode: 'NL', extension: '310', additionalExtension: 'Desk' } }],
                email: [{ id: 'email', fields: { emailAddress: 'synthetic-long-address@example.invalid' } }],
                phone: settings.after ? [{ id: 'phone', fields: { areaCode: '020', number: '9462718' } }] : [],
                mobile: settings.after ? [{ id: 'mobile', fields: { areaCode: '06', number: '68593127' } }] : [],
                bank: settings.after ? [{ id: 'bank', maskedIban: 'NL** **** **** 7492', fields: {} }] : [] } });
        let firstLoaded = settings.compact, failedSecondOnce = settings.compact;
        window.themeAuditEditorReadCounts = {};
        window.themeAuditOpenSourceEditor = mode => openCustomerEditor({ id: 'fixture04', personId: 'fixture04',
            credentialKey: 'synthetic-source-' + mode, mandant: mode === 'a' ? 'TROS' : 'AVROTROS',
            firstName: 'Synthetic', lastName: 'Retained editor ' + mode }, { api: { get: async () => {
                    window.themeAuditEditorReadCounts[mode] = (window.themeAuditEditorReadCounts[mode] || 0) + 1;
                    if (mode === 'a' && !firstLoaded) return new Promise(resolve => {
                        window.themeAuditReleaseEditor = () => { firstLoaded = true; resolve(model(false)); };
                    });
                    if (mode === 'b' && !failedSecondOnce) { failedSecondOnce = true; throw new Error('Synthetic read-model lookup failure.'); }
                    return model(mode === 'readonly');
                }, request: async () => { throw new Error('theme_audit fixture forbids customer writes.'); } }, refresh: async () => {} });
        void window.themeAuditOpenSourceEditor('a');
    }, { compact, after: phase === 'after' });
    const dialog = () => page.locator('.customer-editor[open]');
    await dialog().waitFor({ state: 'visible' });
    if (!compact) {
        await observe(page, driver, { ...meta, kind }, 'source-editor-loading', '.customer-editor[open]');
        await page.evaluate(() => window.themeAuditReleaseEditor());
    }
    await dialog().locator('section').first().waitFor();
    const person = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Persoonsgegevens', exact: true }) });
    await selectSourceRecord(person);
    const address = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Adres', exact: true }) });
    await selectSourceRecord(address);
    if (phase === 'after') await expandSourceSections(dialog());
    await observe(page, driver, { ...meta, kind }, 'source-editor-fields', '.customer-editor[open]');
    if (phase === 'after' && meta.native) await inspectLiveNativeDate(page, driver, meta);
    if (phase === 'after') await observe(page, driver, { ...meta, kind }, 'source-editor-lower-fields');
    const prefix = await address.locator('[data-address-prefix]').getAttribute('data-address-prefix');
    if (phase === 'after' && !compact) fixtures.lookupMode = 'loading';
    await address.locator(`[id="${prefix}HouseNumber"]`).fill('2A');
    await address.locator(`[id="${prefix}PostalCode"]`).fill('1223CK');
    if (phase === 'after' && !compact) {
        await page.waitForFunction(prefix => document.getElementById(prefix + 'AddressStatus')?.dataset.state === 'loading', prefix);
        await observe(page, driver, { ...meta, kind }, 'source-address-loading', '.customer-editor[open]');
        let timeout;
        try { await Promise.race([fixtures.heldLookup, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Synthetic address route was not held within10seconds.')), 10000); })]); }
        finally { clearTimeout(timeout); }
        fixtures.lookupMode = 'matched'; fixtures.releaseLookup();
    }
    await address.locator(`[id="${prefix}AddressChoices"]`).waitFor({ state: 'visible' });
    await observe(page, driver, { ...meta, kind }, 'source-address-candidates', '.customer-editor[open]');
    await address.locator(`[id="${prefix}AddressChoices"]`).selectOption('0');
    await observe(page, driver, { ...meta, kind }, 'source-address-selected', '.customer-editor[open]');
    if (phase === 'after') {
        const validated = await address.evaluate(node => window.kiwiAddressCompletion.validate(node));
        fixtures.firstSession = await address.locator(`[id="${prefix}PostalCode"]`).getAttribute('data-address-form-session-id');
        driver.check('actual address validator accepts selected controlled candidate without saving', validated, true, { ...meta, kind }, 4);
        await observe(page, driver, { ...meta, kind }, 'source-address-confirmed', '.customer-editor[open]');
        await address.locator(`[id="${prefix}AdditionalExtension"]`).fill('theme_audit retained local address draft');
        if (!compact) {
            fixtures.lookupMode = 'not_found';
            await address.locator(`[id="${prefix}PostalCode"]`).fill('9999ZZ');
            await page.waitForFunction(prefix => document.getElementById(prefix + 'AddressStatus')?.dataset.state === 'not_found', prefix);
            await observe(page, driver, { ...meta, kind }, 'source-address-no-results', '.customer-editor[open]');
            const invalid = await address.evaluate(node => window.kiwiAddressCompletion.validate(node));
            driver.check('actual address validator rejects unconfirmed input without a person save', invalid, false, { ...meta, kind }, 4);
            await observe(page, driver, { ...meta, kind }, 'source-address-invalid', '.customer-editor[open]');
            fixtures.lookupMode = 'ambiguous';
            await address.locator(`[id="${prefix}PostalCode"]`).fill('9997ZZ');
            await page.waitForFunction(prefix => document.getElementById(prefix + 'AddressStatus')?.dataset.state === 'ambiguous', prefix);
            await observe(page, driver, { ...meta, kind }, 'source-address-ambiguous', '.customer-editor[open]');
            fixtures.lookupMode = 'error';
            await address.locator(`[id="${prefix}PostalCode"]`).fill('9998ZZ');
            await page.waitForFunction(prefix => document.getElementById(prefix + 'AddressStatus')?.dataset.state === 'unavailable', prefix);
            await observe(page, driver, { ...meta, kind }, 'source-address-unavailable', '.customer-editor[open]');
            fixtures.lookupMode = 'matched';
            await address.locator(`[id="${prefix}AddressStatus"] button`).press('Enter');
            await address.locator(`[id="${prefix}AddressChoices"]`).waitFor({ state: 'visible' });
            await observe(page, driver, { ...meta, kind }, 'source-address-retry', '.customer-editor[open]');
            await address.locator(`[id="${prefix}AddressChoices"]`).selectOption('0');
        }
    }

    await dialog().locator('.btn-close').press('Enter');
    await page.evaluate(() => window.themeAuditOpenSourceEditor('b'));
    await dialog().waitFor({ state: 'visible' });
    if (!compact) {
        await observe(page, driver, { ...meta, kind }, 'source-editor-lookup-failed', '.customer-editor[open]');
        await dialog().locator('.btn-close').press('Enter');
        await page.evaluate(() => window.themeAuditOpenSourceEditor('b'));
    }
    const secondAddress = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Adres', exact: true }) });
    await selectSourceRecord(secondAddress);
    await observe(page, driver, { ...meta, kind }, 'two-retained-editable-addresses', '.customer-editor[open]');
    if (phase === 'after') {
        const secondPrefix = await secondAddress.locator('[data-address-prefix]').getAttribute('data-address-prefix');
        await secondAddress.locator(`[id="${secondPrefix}HouseNumber"]`).fill('2A');
        await secondAddress.locator(`[id="${secondPrefix}PostalCode"]`).fill('1223CK');
        await secondAddress.locator(`[id="${secondPrefix}AddressChoices"]`).waitFor({ state: 'visible' });
        await secondAddress.locator(`[id="${secondPrefix}AddressChoices"]`).selectOption('1');
        const isolation = await page.evaluate(({ first, second, previousSession }) => {
            const firstPostal = document.getElementById(first + 'PostalCode'), secondPostal = document.getElementById(second + 'PostalCode');
            return { distinctPrefixes: first !== second, ownFields: firstPostal !== secondPostal,
                firstDraft: document.getElementById(first + 'AdditionalExtension')?.value === 'theme_audit retained local address draft',
                secondAddition: document.getElementById(second + 'HouseExt')?.value === '2',
                secondSession: Boolean(secondPostal?.dataset.addressFormSessionId),
                independentSessions: Boolean(previousSession) && previousSession !== secondPostal?.dataset.addressFormSessionId };
        }, { first: prefix, second: secondPrefix, previousSession: fixtures.firstSession });
        driver.check('retained source identities keep independent address fields buffers and draft', Object.values(isolation).every(Boolean), true, { ...meta, kind, isolation }, 4);
        await observe(page, driver, { ...meta, kind }, 'retained-address-session-isolation', '.customer-editor[open]');
    }

    await dialog().locator('.btn-close').press('Enter');
    await page.evaluate(() => window.themeAuditOpenSourceEditor('readonly'));
    await dialog().waitFor({ state: 'visible' });
    const readonlyAddress = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Adres', exact: true }) });
    await selectSourceRecord(readonlyAddress);
    await observe(page, driver, { ...meta, kind }, 'retained-editors-readonly-address', '.customer-editor[open]');
    if (phase === 'after') {
        const readonlyPerson = dialog().locator('section').filter({ has: page.getByRole('heading', { name: 'Persoonsgegevens', exact: true }) });
        await selectSourceRecord(readonlyPerson);
        await expandSourceSections(dialog());
        const longField = readonlyPerson.locator('input[name="lastName"]');
        await longField.focus(); await longField.press('End');
        const longValue = await longField.evaluate(node => ({ overflows: node.scrollWidth > node.clientWidth, end: node.scrollLeft, value: node.value }));
        await longField.press('Home');
        const recovered = await longField.evaluate((node, previous) => ({ valueRetained: node.value === previous.value,
            startVisible: node.scrollLeft === 0, endRecoverable: !previous.overflows || previous.end > 0 }), longValue);
        driver.check('long readonly identity remains keyboard-recoverable without editing', Object.values(recovered).every(Boolean), true, { ...meta, kind, recovered }, 4);
        if (!meta.native && !compact) await (await import('./compose-smoke-theme-audit-customer-acceptance.mjs')).inspectEditorPrivacy(page, driver, { ...meta, kind });
    }

    await dialog().locator('.btn-close').press('Enter');
    if (phase === 'after') {
        const beforeReads = await page.evaluate(() => window.themeAuditEditorReadCounts.a);
        await page.evaluate(() => window.themeAuditOpenSourceEditor('a'));
        await dialog().waitFor({ state: 'visible' });
        const reopened = await dialog().evaluate((node, prefix) => ({ prefixRetained: Boolean(node.querySelector(`[data-address-prefix="${prefix}"]`)),
            draftRetained: node.querySelector(`[id="${prefix}AdditionalExtension"]`)?.value === 'theme_audit retained local address draft',
            reads: window.themeAuditEditorReadCounts.a }), prefix);
        driver.check('actual source editor reopen preserves the first draft and identity without a new read', reopened.prefixRetained && reopened.draftRetained && reopened.reads === beforeReads, true, { ...meta, kind, reopened, beforeReads }, 4);
        await observe(page, driver, { ...meta, kind }, 'retained-editor-reopened-draft', '.customer-editor[open]');
        await dialog().locator('.btn-close').press('Enter');
    }
}

async function prepareCustomerEvidence(report) {
    report.customerEvidence ||= { marker: 'theme_audit', phase, scope: phase === 'before' ? 'Observed BEFORE defects and component fixtures, not parity acceptance.' : 'Required focused customer presentation checks with independent visual evidence.',
        companion: { path: modulePath, sha256: hash(await readFile(modulePath)) },
        normalizationHelper: { path: fileURLToPath(new URL('./compose-smoke-theme-audit-shell-acceptance.mjs', import.meta.url)), sha256: hash(await readFile(new URL('./compose-smoke-theme-audit-shell-acceptance.mjs', import.meta.url))) }, observations: [], loadedBehavior: [], interceptedFixtureRequests: [] };
}

export async function installCustomerFixtures(page, driver) {
    const fixtures = { rows: null, addresses: false, lookupMode: 'matched', releaseLookup: null };
    fixtures.heldLookup = new Promise(resolve => { fixtures.markLookupHeld = resolve; });
    const report = driver.report;
    const apiPath = driver.baseUrl.pathname.replace(/\/$/, '') + '/api/v1/';
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== driver.baseUrl.origin) return route.fallback();
        if (fixtures.personDetails && request.method() === 'GET' && url.pathname === apiPath + 'persons/' + fixtures.personDetails.id) return route.fulfill({ json: fixtures.personDetails });
        if (fixtures.rows && request.method() === 'GET' && url.pathname === apiPath + 'persons') {
            fixtures.personSearchRequests = (fixtures.personSearchRequests || 0) + 1;
            return route.fulfill({ json: { items: fixtures.rows } });
        }
        const isLookup = fixtures.addresses && request.method() === 'POST' && ['addresses/search', 'addresses/validate'].some(suffix => url.pathname === apiPath + suffix);
        const isCleanup = fixtures.addresses && request.method() === 'DELETE' && new RegExp('^' + apiPath + 'addresses/sessions/[a-zA-Z0-9-]+$').test(url.pathname);
        if (!isLookup && !isCleanup) return route.fallback();
        report.customerEvidence.interceptedFixtureRequests.push({ method: request.method(), path: url.pathname, kind: 'Synthetic address protocol response; never sent upstream.' });
        if (isCleanup) return route.fulfill({ status: 204 });
        const payload = request.postDataJSON();
        if (fixtures.lookupMode === 'loading') await new Promise(resolve => { fixtures.releaseLookup = resolve; fixtures.markLookupHeld(); });
        if (fixtures.lookupMode === 'error') return route.fulfill({ status: 503, json: { message: 'Synthetic provider unavailable' } });
        const candidates = ['1', '2'].map(houseNumberAddition => ({ postalCode: '1223CK', houseNumber: '2A', houseNumberAddition, street: 'Synthetic street', city: 'HILVERSUM', countryCode: 'NL', verified: true }));
        if (url.pathname.endsWith('/validate') && fixtures.lookupMode !== 'matched') return route.fulfill({ json: { status: 'unconfirmed' } });
        if (url.pathname.endsWith('/search') && fixtures.lookupMode !== 'matched') return route.fulfill({ json: { status: fixtures.lookupMode, candidates: [], complete: true } });
        return route.fulfill({ json: url.pathname.endsWith('/search') ? { status: 'matched', candidates, complete: true } : { status: 'confirmed', address: { ...payload, verified: true } } });
    });
    return fixtures;
}

async function stableCustomerView(page, selector) {
    await page.waitForFunction(state => {
        const bounds = document.querySelector(state.selector)?.getBoundingClientRect();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) { state.previous = null; state.frames = 0; return false; }
        const current = [bounds.x, bounds.y, bounds.width, bounds.height, scrollY];
        state.frames = JSON.stringify(current) === JSON.stringify(state.previous) ? state.frames + 1 : 0;
        state.previous = current;
        return state.frames >= 2;
    }, { selector, previous: null, frames: 0 }, { polling: 'raf', timeout: 12000 });
}

export async function runCustomerScenarios(page, driver, meta, fixtures) {
    await observe(page, driver, meta, 'filter-default', '.search-card');
    if (!meta.native) {
        await page.locator('#additionalFiltersToggle').hover();
        await observe(page, driver, meta, 'filter-hover', '.search-card');
    }
    if (phase === 'after') {
        await page.locator('#additionalFiltersToggle').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        await observe(page, driver, meta, 'filter-keyboard-focus');
    }
    if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').press('Enter');
    if (phase === 'after') await observe(page, driver, meta, 'filter-expanded', '.search-card');
    await page.locator('#searchName').fill('Jansen');
    await page.locator('button[data-action="search-customer"]').press('Enter');
    await page.locator('.result-row').first().waitFor();
    await stableCustomerView(page, '#searchResultsView');
    if (!meta.native) await page.mouse.move(0, 0);
    await observe(page, driver, meta, 'actual-results', '#searchResultsView');
    const view = page.locator('.result-row-actions button[data-action="select-customer"]').first();
    if (!meta.native) { await view.hover(); await observe(page, driver, meta, 'actual-view-hover', '#searchResultsView'); }
    if (phase === 'after') {
        const sort = page.locator('.sort-select');
        await sort.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        await observe(page, driver, meta, 'sort-keyboard-focus');
    }
    if (phase === 'after') await focusViewThroughTable(page, driver, meta, view);
    else { await view.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); }
    await observe(page, driver, meta, 'actual-view-keyboard-focus');
    await view.press('Enter'); await page.locator('#customerDetail').waitFor({ state: 'visible' });
    await stableCustomerView(page, '#customerDetail');
    await observe(page, driver, meta, 'actual-record', '#customerDetail');
    if (phase === 'after' && meta.native) await inspectNativeRecordFrames(page, driver, meta);
    else if (phase === 'after' && meta.viewport.width <= 768) await revealRecordHeading(page, driver, meta);
    if (phase === 'after' && !meta.sentinel) await inspectSubscriptionStates(page, driver, meta);
    if (phase === 'after') {
        await page.locator('button[data-action="search-customer"]').press('Enter');
        await page.locator('.result-row').first().waitFor(); await stableCustomerView(page, '#searchResultsView');
        await observe(page, driver, meta, 'actual-selected-results', '#searchResultsView');
        await page.locator('.result-row-actions button[data-action="select-customer"]').first().press('Enter');
        await page.locator('#customerDetail').waitFor({ state: 'visible' }); await stableCustomerView(page, '#customerDetail');
    }

    await page.locator('#editCustomerBtn').press('Enter'); await page.locator('#editCustomerForm').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'legacy-editor', '#editCustomerForm');
    await page.locator('#editCustomerForm [data-action="close-form"]').first().press('Enter');
    fixtures.rows = Array.from({ length: 3 }, (_, index) => ({ id: 990040 + index, firstName: 'Synthetic', initials: 'S. ' + String.fromCharCode(65 + index) + '.',
        lastName: index === 1 ? 'Long family name with several visible components' : 'Table example ' + (index + 1),
        address: index === 1 ? 'Synthetic long street name 123 with an additional address line' : 'Example street ' + (index + 1),
        postalCode: ['3333CC', '1111AA', '2222BB'][index], city: 'SYNTHETIC CITY', subscriptions: index === 2 ? [] : index === 1 ? [{ magazine: 'Ended example', status: 'ended' }] : [{ magazine: 'Active example A', status: 'active' }, { magazine: 'Active example B', status: 'active' }] }));
    const originalCallGetter = await page.evaluateHandle(() => window.kiwiLegacyCustomerSearchBridge.getCallSession);
    try {
        await page.evaluate(() => { window.kiwiLegacyCustomerSearchBridge.getCallSession = () => ({ active: true, callerType: 'anonymous' }); });
        await page.locator('#searchName').fill('Synthetic'); await page.locator('button[data-action="search-customer"]').press('Enter');
        await page.waitForFunction(() => document.querySelectorAll('.result-row').length === 3);
        await stableCustomerView(page, '#searchResultsView');
        if (!meta.native) await page.mouse.move(0, 0);
        await observe(page, driver, { ...meta, kind: 'Controlled GET search fixture and read-only call-context getter through actual three-row renderer; no call/identify/selection action.' }, 'mixed-table', '#searchResultsView');
    if (phase === 'after') await inspectTableSurfaces(page, driver, meta);
    } finally {
        await page.evaluate(original => { window.kiwiLegacyCustomerSearchBridge.getCallSession = original; }, originalCallGetter);
        await originalCallGetter.dispose(); fixtures.rows = null;
    }
    fixtures.addresses = true;
    if (phase === 'after') await inspectTableInteractions(page, driver, meta, fixtures);
    if (!meta.sentinel) await sourceEditorFixtures(page, driver, meta, fixtures);
    if (phase === 'after' && !meta.native && !meta.sentinel && !meta.compact) await inspectReusablePersonLookup(page, driver, meta, fixtures);
}

async function focusViewThroughTable(page, driver, meta, view) {
    const path = [];
    const read = async step => path.push({ step, ...await page.evaluate(() => ({ tag: document.activeElement.tagName,
        className: document.activeElement.className, focusVisible: document.activeElement.matches(':focus-visible') })) });
    await page.locator('.results-table-wrapper').focus(); await read('named table group focused');
    await page.keyboard.press('Tab'); await read('actual forward Tab');
    const reached = await view.evaluate(node => document.activeElement === node && node.matches(':focus-visible'));
    driver.check('actual forward Tab from the named table group reaches VIEW with visible focus', reached, true, { ...meta, path }, 4);
    driver.report.customerEvidence.keyboard ||= [];
    driver.report.customerEvidence.keyboard.push({ ...meta, kind: 'Actual native forward Tab from named table group to VIEW; no selection yet.', path });
}

async function inspectNativeRecordFrames(page, driver, meta) {
    for (const [selector, name] of [['.customer-heading', 'heading-actions'], ['.customer-meta', 'contact-band']]) {
        const target = page.locator(selector); await target.scrollIntoViewIfNeeded(); await driver.painted(page);
        const bounds = () => target.evaluate(node => {
            const rect = node.getBoundingClientRect(), header = document.querySelector('.header');
            const clipTop = getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0;
            return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: innerWidth, height: innerHeight, clipTop };
        });
        let visible = await bounds();
        for (let step = 0; visible.top < visible.clipTop && step < 4; step++) {
            await page.keyboard.press('ArrowUp'); await driver.painted(page); visible = await bounds();
        }
        driver.check('native record ' + name + ' is visible in the actual uncropped viewport after scrolling', visible.top >= visible.clipTop - 1
            && visible.bottom <= visible.height + 1 && visible.left >= 0 && visible.right <= visible.width + 1, true, { ...meta, visible }, 4);
        await driver.capture(page, meta.prefix + 'record-revealed-' + name, undefined,
            'Actual native OS200% record region after explicit browser scrolling; natural record frame retained separately; uncropped X11 desktop.');
    }
}

async function inspectLiveNativeDate(page, driver, meta) {
    const date = page.locator('.customer-editor[open] input[type="date"]').first();
    const state = await date.evaluateHandle(node => ({ node, value: node.value }));
    try {
        await date.focus(); await date.scrollIntoViewIfNeeded(); await driver.painted(page);
        const result = await state.evaluate(({ node, value }) => {
            const rect = node.getBoundingClientRect();
            return { valuePresent: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value), valueRetained: node.value === value,
                actualType: node.type, focused: document.activeElement === node, labeled: Boolean(node.labels?.length),
                top: rect.top, bottom: rect.bottom, height: innerHeight };
        });
        driver.check('live native DATE remains populated and unchanged independently of SVG capture rendering', result.valuePresent && result.valueRetained
            && result.actualType === 'date' && result.focused && result.labeled && result.top >= 0 && result.bottom <= result.height + 1,
            true, { ...meta, result }, 4);
        await driver.capture(page, meta.prefix + 'live-native-date', undefined,
            'Actual live native DATE control at OS200%; synthetic value retained, no edit/save, uncropped desktop. This is separate from Firefox SVG date-renderer limitations.');
    } finally { await state.dispose(); }
}

async function revealRecordHeading(page, driver, meta) {
    const before = await page.evaluate(() => ({ title: document.querySelector('.customer-info h2').getBoundingClientRect().top,
        header: document.querySelector('.header').getBoundingClientRect().bottom, scroll: scrollY }));
    const delta = before.title - before.header - 12;
    await page.mouse.wheel(0, delta);
    await driver.painted(page);
    await stableCustomerView(page, '#customerDetail');
    const after = await page.evaluate(() => ({ title: document.querySelector('.customer-info h2').getBoundingClientRect().top,
        titleBottom: document.querySelector('.customer-info h2').getBoundingClientRect().bottom,
        header: document.querySelector('.header').getBoundingClientRect().bottom, height: innerHeight, scroll: scrollY }));
    driver.check('record heading is reachable below the current header through actual scrolling', after.title >= after.header - 1
        && after.titleBottom <= after.height + 1, true, { ...meta, before, after, kind: 'Additional manually revealed heading after preserving natural app/element capture; actual wheel only.' }, 4);
    await driver.capture(page, meta.prefix + 'record-heading-manually-revealed', undefined,
        'Actual narrow record heading/actions after a bounded real scroll; original natural-state capture is retained separately.');
}

async function inspectSubscriptionStates(page, driver, meta) {
    const state = await page.evaluateHandle(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/slices/customer-detail-slice.js'));
        const module = await import(imports[key]);
        const customer = window.kiwiLegacyCustomerSearchBridge.getCurrentCustomer();
        return { customer, subscriptions: customer.subscriptions, render: module.displaySubscriptions };
    });
    const kind = 'Controlled local subscription arrays rendered by actual customer-detail module on actual selected record; no server writes.';
    try {
        for (const mode of ['mixed', 'readonly', 'empty']) {
            await state.evaluate((state, mode) => {
                state.customer.subscriptions = mode === 'empty' ? [] : ['active', 'ended', 'restituted', 'transferred'].map((status, index) => ({
                    id: 990400 + index, magazine: 'Synthetic long subscription title ' + status, status,
                    sourceSystem: mode === 'readonly' ? 'subscription-api' : 'kiwi', startDate: '2025-01-01', endDate: '2026-01-01', lastEdition: '2025-12-31',
                    refundInfo: { email: 'refund@example.invalid' }, transferredTo: { firstName: 'Synthetic', lastName: 'Recipient', email: 'recipient@example.invalid' }
                })); state.render();
            }, mode);
            const rendered = await page.locator('#subscriptionsList').evaluate(node => ({
                groups: node.querySelectorAll('.subscription-group').length, rows: node.querySelectorAll('.subscription-item').length,
                statuses: [...node.querySelectorAll('.subscription-status')].map(item => item.textContent.trim()),
                actionCount: node.querySelectorAll('button').length, empty: Boolean(node.querySelector('.empty-state-small')),
                rowsFlat: [...node.querySelectorAll('.subscription-item')].every(item => getComputedStyle(item).boxShadow === 'none' && getComputedStyle(item).borderRadius === '0px')
            }));
            driver.check('actual record subscription renderer preserves ' + mode + ' states', mode === 'empty' ? rendered.empty && rendered.rows === 0
                : rendered.groups === 4 && rendered.rows === 4 && rendered.statuses.length === 4 && rendered.rowsFlat && (mode !== 'readonly' || rendered.actionCount === 0), true, { ...meta, mode, kind, rendered }, 4);
            await observe(page, driver, { ...meta, kind }, 'record-subscriptions-' + mode, '#customerDetail');
            if (meta.compact || meta.native) break;
        }
    } finally {
        await state.evaluate(state => { state.customer.subscriptions = state.subscriptions; state.render(); }); await state.dispose();
    }
}

async function inspectTableSurfaces(page, driver, meta) {
    const kind = 'Bounded disabled VIEW presentation fixture on actual result rows; DOM disabled/current flags restored and no identity action invoked.';
    const original = await page.locator('.result-row').evaluateAll(rows => rows.map(row => ({ selected: row.classList.contains('is-selected'), current: row.getAttribute('aria-current'), disabled: row.querySelector('[data-action="select-customer"]').disabled })));
    try {
        if (!meta.native && !meta.sentinel && !meta.compact) {
            await page.locator('.result-row').nth(2).evaluate(row => { row.classList.add('is-selected'); row.setAttribute('aria-current', 'true'); });
            for (const [index, surface] of ['white', 'stripe', 'selected'].entries()) {
                const action = page.locator('.result-row').nth(index).locator('[data-action="select-customer"]');
                await action.hover();
                await observe(page, driver, { ...meta, kind: 'Actual enabled VIEW hover on ' + surface + ' result surface; third-row selected class is a bounded restored presentation fixture.' }, 'mixed-table-view-' + surface + '-hover', '#searchResultsView');
                await page.mouse.down();
                try { await observe(page, driver, { ...meta, kind: 'Actual pointer pressed VIEW on ' + surface + ' result surface; released outside to avoid a customer action.' }, 'mixed-table-view-' + surface + '-pressed', '#searchResultsView'); }
                finally { await page.mouse.move(0, 0); await page.mouse.up(); }
            }
        }
        await page.locator('.result-row').evaluateAll(rows => rows.forEach((row, index) => {
            row.querySelector('[data-action="select-customer"]').disabled = true;
            if (index === 2) { row.classList.add('is-selected'); row.setAttribute('aria-current', 'true'); }
        }));
        if (!meta.native) await page.locator('.result-row').first().hover();
        await observe(page, driver, { ...meta, kind }, 'mixed-table-disabled-secondary', '#searchResultsView');
    } finally {
        await page.locator('.result-row').evaluateAll((rows, original) => rows.forEach((row, index) => {
            row.querySelector('[data-action="select-customer"]').disabled = original[index].disabled;
            row.classList.toggle('is-selected', original[index].selected);
            if (original[index].current === null) row.removeAttribute('aria-current'); else row.setAttribute('aria-current', original[index].current);
        }), original);
    }
    if (meta.native || meta.viewport.width < 1440) return;
    await page.mouse.move(0, 0); await page.locator('.results-table-wrapper').scrollIntoViewIfNeeded(); await driver.painted(page);
    const points = await page.locator('.result-row').evaluateAll(rows => rows.slice(0, -1).flatMap((row, rowIndex) => [...row.cells].map((cell, column) => {
        const rect = cell.getBoundingClientRect(); return { row: rowIndex, column, x: Math.floor(rect.x + rect.width / 2), bottom: rect.bottom, originalY: Math.floor(rect.bottom - 0.5), y: Math.floor(rect.bottom), expected: getComputedStyle(cell).borderBottomColor };
    })));
    const image = await page.screenshot();
    const pixels = await page.evaluate(async ({ image, points }) => {
        const bitmap = new Image(); bitmap.src = image; await bitmap.decode();
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
        return points.map(point => ({ ...point, visible: point.x >= 0 && point.x < bitmap.width && point.y >= 3 && point.y + 3 < bitmap.height,
            samples: [-1, 0, 1].map(offset => ({ y: point.y + offset, color: [...context.getImageData(point.x, point.y + offset, 1, 1).data] })),
            above: [...context.getImageData(point.x, point.y - 3, 1, 1).data], below: [...context.getImageData(point.x, point.y + 3, 1, 1).data] }));
    }, { image: 'data:image/png;base64,' + image.toString('base64'), points });
    const rowLines = [0, 1].map(row => {
        const points = pixels.filter(point => point.row === row);
        const candidates = points[0].samples.map(sample => sample.y);
        const chosenY = candidates.find(y => {
            const color = points[0].samples.find(sample => sample.y === y).color.join(',');
            return points.every(point => {
                const sample = point.samples.find(sample => sample.y === y);
                return point.visible && sample?.color[3] === 255 && sample.color.join(',') === color
                    && color !== point.above.join(',') && color !== point.below.join(',');
            });
        });
        return { row, candidates, chosenY: chosenY ?? null };
    });
    const consistent = pixels.length === 12 && rowLines.every(line => line.chosenY !== null);
    driver.check('actual screenshot separator pixels continue across all six columns of mixed-height rows', consistent, true,
        { ...meta, pixels, rowLines, kind: 'Unmodified screenshot pixels: one common raster Y within1px of each native border must form the same opaque line across all six columns, distinct from both adjacent row backgrounds. Original single-pixel coordinates remain recorded.' }, 4);
}

async function inspectTableInteractions(page, driver, meta, fixtures) {
    const kind = 'Actual results keyboard sorting, paging and local table scrolling; synthetic GET rows only for deterministic pagination.';
    const wrapper = page.locator('.results-table-wrapper');
    await wrapper.scrollIntoViewIfNeeded(); await wrapper.focus();
    const initial = await wrapper.evaluate(node => ({ x: node.scrollLeft, maxScroll: node.scrollWidth - node.clientWidth, overflow: node.scrollWidth > node.clientWidth, documentX: scrollX }));
    const key = initial.x > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.press(key); await driver.painted(page);
    if (initial.overflow) await page.waitForFunction(({ x, key }) => {
        const current = document.querySelector('.results-table-wrapper').scrollLeft;
        return key === 'ArrowLeft' ? current < x : current > x;
    }, { x: initial.x, key }, { timeout: 5000 });
    const scrolled = await wrapper.evaluate(node => ({ x: node.scrollLeft, documentX: scrollX, focused: document.activeElement === node }));
    driver.check('results table supports local keyboard scrolling without page drift', scrolled.focused && scrolled.documentX === initial.documentX
        && (!initial.overflow || (key === 'ArrowLeft' ? scrolled.x < initial.x : scrolled.x > initial.x)), true, { ...meta, kind, key, initial, scrolled }, 4);
    await page.keyboard.press('Home');
    const sort = page.locator('#sortBy'); await sort.focus(); await sort.press('s'); await sort.press('Enter');
    await sort.selectOption('postal');
    const sortedIds = await page.locator('.result-row').evaluateAll(rows => rows.map(row => row.dataset.argCustomerId));
    driver.check('actual results sorting orders fixture postal codes and retains native selection', await sort.inputValue() === 'postal'
        && JSON.stringify(sortedIds) === JSON.stringify(['990041', '990042', '990040']), true, { ...meta, kind, sortedIds }, 4);
    await sort.selectOption('name');
    await observe(page, driver, { ...meta, kind }, 'table-keyboard-scroll-sort', '#searchResultsView');
    if (meta.sentinel || meta.compact || meta.native) return;
    fixtures.rows = Array.from({ length: 21 }, (_, index) => ({ id: 994000 + index, firstName: 'Synthetic', initials: 'S.', lastName: 'Page ' + String(index + 1).padStart(2, '0'), address: 'Example street ' + index, postalCode: '1234AB', city: 'SYNTHETIC', subscriptions: [] }));
    try {
        await page.locator('button[data-action="search-customer"]').press('Enter');
        await page.locator('#pagination [data-arg-page="2"]').first().waitFor();
        await page.locator('#pagination [data-arg-page="2"]').first().press('Enter');
        await page.waitForFunction(() => document.querySelectorAll('.result-row').length === 1 && document.querySelector('#pagination [aria-current="page"]')?.dataset.argPage === '2');
        driver.check('actual keyboard pagination changes page and retains semantic current page', true, true, { ...meta, kind }, 4);
        await observe(page, driver, { ...meta, kind }, 'table-keyboard-page-two', '#searchResultsView');
        fixtures.rows = [];
        await page.locator('button[data-action="search-customer"]').press('Enter');
        await page.locator('#searchResultsView').waitFor({ state: 'hidden' });
        await page.locator('#welcomeMessage').waitFor({ state: 'visible' });
        await observe(page, driver, { ...meta, kind: 'Controlled empty GET response through actual search renderer; query retained; previous row nodes stay hidden by existing app behavior.' }, 'search-no-results', '#welcomeMessage');
        driver.check('no-results search preserves the entered query', await page.locator('#searchName').inputValue(), 'Synthetic', meta, 4);
    } finally { fixtures.rows = null; }
}

export async function inspectReusablePersonLookup(page, driver, meta, fixtures) {
    const check = phase === 'after' ? driver.check : () => {};
    const kind = 'Bounded actual reusable-person lookup renderer inside subscription shell; synthetic selected-product getter and GET fixtures only, no select-person action or workflow submission.';
    const person = { id: 990499, personId: '990499', firstName: 'Synthetic', initials: 'S.',
        lastName: 'Long lookup family name with several visible components', address: 'Synthetic long street name and additional address context 123',
        postalCode: '1234AB', houseNumber: '123', city: 'SYNTHETIC CITY', email: 'lookup@example.invalid',
        credentialKey: 'theme-audit-lookup', mandant: 'HMC', divisionId: '14', sourceSystem: 'subscription-api' };
    fixtures.personDetails = person;
    const original = await page.evaluateHandle(person => {
        const state = { customer: currentCustomer, getSelections: window.kiwiWerfsleutelSlice.getSelections,
            role: structuredClone(subscriptionRoleState) };
        currentCustomer = person;
        window.kiwiWerfsleutelSlice.getSelections = () => [{ selectedKey: { salesCode: 'THEME-AUDIT-FIXTURE', mandant: 'HMC', divisionId: '14' }, selectedChannel: 'OL', selectedChannelMeta: { key: 'OL' } }];
        window.showNewSubscription();
        return state;
    }, person);
    try {
        await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
        const search = page.locator('#recipientPersonSearch');
        if (!await search.evaluate(node => node.open)) {
            const summary = search.locator(':scope > summary');
            if (phase === 'after') await summary.press('Enter'); else await summary.click();
        }
        const more = search.locator('details').first();
        if (!await more.evaluate(node => node.open)) {
            const summary = more.locator(':scope > summary');
            if (phase === 'after') await summary.press('Enter'); else await summary.click();
        }
        await page.locator('#recipientSearchQuery').fill('Synthetic');
        await more.waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.querySelector('#recipientPersonSearch details')?.open === true);
        await search.locator('.subscription-person-search').scrollIntoViewIfNeeded();
        await driver.capture(page, meta.prefix + 'reusable-person-lookup-expanded-fields', undefined, kind + (phase === 'after' ? ' Actual native Enter disclosure; search keyboard uses its action control.' : ' Actual pointer disclosure; no keyboard acceptance claim.'));
        fixtures.rows = [person, { ...person, id: 990498, personId: '990498', lastName: 'Second lookup result' }];
        await page.locator('#recipientSearchButton').press('Enter');
        await page.locator('#recipientSearchResults .party-search-result').first().waitFor();
        await page.locator('#recipientSearchResults').scrollIntoViewIfNeeded(); await driver.painted(page);
        const data = await page.locator('#recipientRolePanel').evaluate(panel => {
            const style = node => { const bounds = node.getBoundingClientRect(), css = getComputedStyle(node); return { x: bounds.x, right: bounds.right, width: bounds.width, height: bounds.height,
                background: css.backgroundColor, border: css.borderTopColor, radius: css.borderRadius, shadow: css.boxShadow,
                fontSize: css.fontSize, fontWeight: css.fontWeight, lineHeight: css.lineHeight }; };
            const search = panel.querySelector('.subscription-person-search');
            return { panel: style(panel), expanded: panel.querySelector('#recipientPersonSearch details').open, gap: getComputedStyle(search).gap,
                fields: [...search.querySelectorAll('input')].map(field => ({ ...style(field), label: Boolean(field.labels?.length) })),
                rows: [...panel.querySelectorAll('.party-search-result')].map(row => ({ ...style(row),
                    ownPrivateName: Boolean(row.querySelector('[data-feedback-sensitive="name"]')),
                    ownPrivateId: Boolean(row.querySelector('[data-feedback-sensitive="id"]')),
                    ownPrivateAddress: Boolean(row.querySelector('[data-feedback-sensitive="address"]')),
                    action: style(row.querySelector('[data-action="select-subscription-role-person"]')) })) };
        });
        check('actual reusable lookup preserves expanded labeled fields and deliberate spacing', data.expanded && data.gap === '12px'
            && data.fields.every(field => field.label && field.height >= 40 && field.x >= data.panel.x - 1 && field.right <= data.panel.right + 1), true, { ...meta, kind, data }, 4);
        check('actual reusable lookup results remain flat with private identity and outlined Select actions', data.rows.length === 2 && data.rows.every(row => row.radius === '0px' && row.shadow === 'none'
            && row.ownPrivateName && row.ownPrivateId && row.ownPrivateAddress && row.action.height >= 40 && row.action.radius === '0px'
            && row.action.background === driver.contract.secondary.backgroundColor && row.action.border === driver.contract.secondary.borderTopColor), true, { ...meta, kind, data }, 4);
        driver.report.customerEvidence.observations.push({ ...meta, state: 'reusable-person-lookup-expanded-results', phase, kind, data });
        await driver.capture(page, meta.prefix + 'reusable-person-lookup-expanded-results', undefined, kind);
        fixtures.rows = [];
        await page.locator('#recipientSearchButton').press('Enter');
        await page.waitForFunction(() => !document.querySelector('#recipientSearchResults .party-search-result') && Boolean(document.querySelector('#recipientSearchResults')?.textContent.trim()));
        await page.locator('#recipientSearchResults').scrollIntoViewIfNeeded();
        check('actual reusable lookup no-results status preserves query and recovery controls', await page.locator('#recipientSearchQuery').inputValue() === 'Synthetic'
            && await page.locator('#recipientSearchButton').isEnabled(), true, { ...meta, kind }, 4);
        await driver.capture(page, meta.prefix + 'reusable-person-lookup-no-results', undefined, kind);
        await page.evaluate(person => { subscriptionRoleState.recipient.selectedPerson = person; window.kiwiSubscriptionRoleRuntime.renderSubscriptionRoleSelectedPerson('recipient'); }, person);
        await page.locator('#recipientSelectedPerson').scrollIntoViewIfNeeded();
        const selected = await page.locator('#recipientSelectedPerson').evaluate(node => ({ populated: !node.classList.contains('empty'), width: node.getBoundingClientRect().width,
            fits: node.scrollWidth <= node.clientWidth + 1, privateRegions: node.querySelectorAll('[data-feedback-sensitive]').length, border: getComputedStyle(node).borderInlineStartWidth }));
        check('actual selected-person summary preserves wrapped private identity and its selection marker', selected.populated && selected.fits && selected.privateRegions === 3 && selected.border === '2px', true, { ...meta, kind, selected }, 4);
        await driver.capture(page, meta.prefix + 'reusable-person-selected-summary', undefined, kind + ' Selected summary is a local renderer fixture, not a selection or order acceptance claim.');
        if (phase === 'after') await inspectLookupKeyboard(page, driver, meta, fixtures, person, more);
    } finally {
        fixtures.rows = null; fixtures.personDetails = null;
        if (await page.locator('#newSubscriptionForm').isVisible()) await page.locator('#newSubscriptionForm [data-action="close-form"]').first().press('Enter');
        await original.evaluate(state => { currentCustomer = state.customer; window.kiwiWerfsleutelSlice.getSelections = state.getSelections; Object.assign(subscriptionRoleState, state.role); });
        await original.dispose();
    }
}

async function inspectLookupKeyboard(page, driver, meta, fixtures, person, more) {
    const listener = await page.evaluateHandle(() => {
        const events = [];
        const listener = event => {
            if (event.target.closest?.('#recipientPersonSearch')) events.push({ key: event.key, tag: event.target.tagName, defaultPrevented: event.defaultPrevented });
        };
        document.addEventListener('keydown', listener);
        return { events, listener };
    });
    const outcomes = [];
    fixtures.rows = [person];
    try {
        for (const key of ['Enter', 'Space']) {
            const before = await more.evaluate(node => node.open), requestsBefore = fixtures.personSearchRequests || 0;
            await more.locator(':scope > summary').press(key); await driver.painted(page);
            const after = await more.evaluate(node => node.open), events = await listener.evaluate(state => state.events.splice(0));
            const outcome = { target: 'native disclosure summary', key, before, after, requests: (fixtures.personSearchRequests || 0) - requestsBefore, events };
            outcomes.push(outcome);
            driver.check('reusable lookup native summary ' + key + ' toggles without searching or preventing its default', before !== after && outcome.requests === 0
                && events.length > 0 && events.every(event => !event.defaultPrevented), true, { ...meta, outcome }, 4);
        }
        for (const [selector, target, prevented] of [['#recipientSearchQuery', 'search input', true], ['#recipientSearchButton', 'search button', false]]) {
            const requestsBefore = fixtures.personSearchRequests || 0;
            await page.locator(selector).press('Enter'); await driver.painted(page);
            const events = await listener.evaluate(state => state.events.splice(0));
            const outcome = { target, key: 'Enter', requests: (fixtures.personSearchRequests || 0) - requestsBefore, events };
            outcomes.push(outcome);
            driver.check('reusable lookup ' + target + ' Enter performs one intended search with native semantics', outcome.requests === 1
                && events.length > 0 && events.every(event => event.defaultPrevented === prevented), true, { ...meta, outcome }, 4);
        }
        driver.report.customerEvidence.keyboard ||= [];
        driver.report.customerEvidence.keyboard.push({ ...meta, outcomes, kind: 'Actual summary Enter/Space and input/button Enter; all searches intercepted, no person selection or form submission.' });
        await driver.capture(page, meta.prefix + 'reusable-person-keyboard', undefined, 'Actual native disclosure and search keyboard outcomes; report records default prevention and exact intercepted search counts.');
    } finally {
        await listener.evaluate(state => document.removeEventListener('keydown', state.listener)); await listener.dispose();
    }
}

export async function inspectCustomerShellSentinel(page, driver, meta) {
    await page.locator('#agentProfileTrigger').press('Enter'); await page.keyboard.press('Escape');
    const shell = await page.evaluate(() => {
        const reset = document.querySelector('#endCustomerWorkSessionButton').getBoundingClientRect();
        const identity = document.querySelector('#customerWorkSessionIdentity').getBoundingClientRect();
        return { documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
            profileClosed: document.querySelector('#agentStatusMenu').hidden,
            focusRestored: document.activeElement === document.querySelector('#agentProfileTrigger'),
            resetBeforeIdentity: reset.x <= identity.x && reset.right <= identity.right,
            contextPresent: Boolean(document.querySelector('#customerWorkSessionName').textContent.trim()) };
    });
    driver.check('current customer flow preserves shell containment context reset and profile dismissal', Object.values(shell).every(Boolean), true, { ...meta, shell }, 3);
    await driver.capture(page, meta.prefix + 'shell-sentinel', undefined, 'Small current-source slice03 shell/context/profile sentinel after customer scenarios.');
}

export async function inspectCustomer(driver, viewport, contract) {
    if (!['before', 'after'].includes(phase)) throw new Error('Use customer phase before or after.');
    driver = { ...driver, contract };
    if (phase === 'after') await (await import('./compose-smoke-theme-audit-customer-acceptance.mjs')).registerCustomerAcceptance(driver.report);
    const report = driver.report;
    await prepareCustomerEvidence(report);
    const locales = !lookupOnly && viewport.width === 390 && viewport.height > 540 ? ['nl', 'en'] : ['nl'];
    for (const locale of locales) {
        const context = await driver.newContext(viewport), page = await context.newPage();
        const meta = { viewport, locale, prefix: phase + '-' + locale + '-customer-',
            sentinel: phase === 'after' && [2048, 1024, 768].includes(viewport.width),
            compact: phase === 'after' && (viewport.width <= 320 || viewport.height <= 540 || locale === 'en'),
            kind: phase === 'before' ? 'Actual local customer application BEFORE flow; no parity acceptance.' : 'Actual customer application AFTER state; required guards and independent visual review.' };
        const finishCss = driver.trackStylesheets(page, meta), finishBehavior = await trackCustomerBehavior(page, driver, meta);
        page.on('pageerror', error => report.errors.push({ scenario: 'customer ' + phase + ' runtime', viewport, locale, message: error.message }));
        const fixtures = await installCustomerFixtures(page, driver);
        try {
            await driver.login(page);
            if (locale === 'en') { await page.locator('#agentProfileTrigger').press('Enter'); await page.locator('[data-locale-option="en"]').press('Enter'); }
            driver.check('actual requested customer locale', await page.locator('html').getAttribute('lang'), locale, meta, 4);
            if (lookupOnly) await inspectReusablePersonLookup(page, driver, meta, fixtures);
            else await runCustomerScenarios(page, driver, meta, fixtures);
            if (phase === 'after' && !lookupOnly) await inspectCustomerShellSentinel(page, driver, meta);
        } catch (error) {
            report.errors.push({ scenario: 'customer ' + phase + ' setup', viewport, locale, message: error.message });
            await driver.capture(page, meta.prefix + 'failure', undefined, 'Incomplete actual customer ' + phase + ' scenario').catch(() => {});
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
