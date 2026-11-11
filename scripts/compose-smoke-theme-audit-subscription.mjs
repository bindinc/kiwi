#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';

const modulePath = fileURLToPath(import.meta.url);
const phase = process.env.KIWI_THEME_AUDIT_SUBSCRIPTION_PHASE || 'before';
const hash = value => createHash('sha256').update(value).digest('hex');
const files = ['js/app/subscription-role-runtime.js', 'js/app/slices/subscription-role-slice.js',
    'js/app/slices/subscription-workflow-slice.js', 'js/app/slices/werfsleutel.js', 'js/app/subscription-payment.js',
    'js/app/subscription-start-dates.js', ...(phase === 'after' ? ['js/app/contextual-feedback/screenshot.js',
        'js/app/contextual-feedback/screenshot-form-state.js', 'js/app/contextual-feedback/screenshot-redaction.js'] : [])];
const offerSource = { credentialKey: 'theme-audit05-source', sourceSystem: 'subscription-api', supportsPersonLookup: true,
    mandant: 'HMC', divisionId: '14', allowedChannels: ['TM/IB', 'OL'], isActive: true };
const offers = [
    { ...offerSource, offerId: 990501, salesCode: 'THEME05-ALPHA', title: 'Synthetic long subscription product with a deliberately descriptive title',
        magazine: 'Synthetic guide Alpha', price: 10, productCode: 'GIDS', subscriptionKind: 'guide', variantCodes: ['STANDARD'] },
    { ...offerSource, offerId: 990502, salesCode: 'THEME05-BETA', title: 'Synthetic second subscription product for the same source and division',
        magazine: 'Synthetic guide Beta', price: 12, productCode: 'GIDS2', subscriptionKind: 'guide', variantCodes: ['NORTH', 'SOUTH'] },
    { ...offerSource, offerId: 990503, salesCode: 'THEME05-MEMBER', title: 'Synthetic membership with its own editable start date',
        magazine: 'Synthetic membership', price: 8, productCode: 'ATV', subscriptionKind: 'membership', variantCodes: [] }
];
const recipient = { id: 99051, personId: '99051', firstName: 'Synthetic', initials: 'S.R.', lastName: 'Recipient with a deliberately long family name',
    salutation: 'Dhr.', birthday: '1980-03-02', postalCode: '1234AB', houseNumber: '10', address: 'Synthetic street 10', city: 'SYNTHETIC CITY',
    email: 'recipient05@example.invalid', credentialKey: 'theme-audit05-source', mandant: 'HMC', divisionId: '14', sourceSystem: 'subscription-api',
    optinEmail: 'yes', optinPhone: 'no', optinPost: 'no' };
const payer = { ...recipient, id: 99052, personId: '99052', initials: 'S.P.', lastName: 'Payer with a different long family name', email: 'payer05@example.invalid' };

export async function prepareSubscriptionEvidence(report) {
    report.subscriptionEvidence ||= { marker: 'theme_audit', phase,
        scope: phase === 'before' ? 'Observational subscription BEFORE; no layout or business acceptance from counters.' : 'Focused subscription AFTER; actual presentation and preserved interactions, explicitly bounded fixtures.',
        companion: { path: modulePath, sha256: hash(await readFile(modulePath)) }, fixtures: { offers, persons: [recipient, payer] },
        loadedBehavior: [], fixtureRequests: [], observations: [], limitations: [
            'Guide editions/provider dates/retry/rejection recovery and a separate membership date are inherited behavior, not slice05 changes.',
            'All transaction outcomes are exact intercepted fixtures; no workflow, outbox, person, consent or feedback write reaches the backend.' ] };
}

export async function trackSubscriptionBehavior(page, driver, meta) {
    await prepareSubscriptionEvidence(driver.report);
    const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(path.join(driver.sourceRoot, 'assets', file), 'utf8')])));
    driver.report.subscriptionEvidence.sourceBehavior = Object.fromEntries(files.map(file => [file, hash(sources[file])]));
    const pending = [], seen = new Set();
    page.on('response', response => {
        const url = new URL(response.url());
        const file = files.find(file => {
            const expected = new URL('assets/' + file, driver.baseUrl), stem = path.posix.basename(expected.pathname, '.js');
            return url.origin === expected.origin && path.posix.dirname(url.pathname) === path.posix.dirname(expected.pathname)
                && new RegExp('^' + stem + '(?:-[\\w-]{7})?\\.js$').test(path.posix.basename(url.pathname));
        });
        if (!file) return;
        pending.push((async () => {
            const body = await response.body().catch(() => null); if (!body) return;
            const source = sources[file], sourceUrl = new URL('assets/' + file, driver.baseUrl);
            const sourceHash = hash(normalizeKnownJsImports(source, source, sourceUrl));
            const servedHash = hash(normalizeKnownJsImports(body.toString('utf8'), source, sourceUrl));
            driver.report.subscriptionEvidence.loadedBehavior.push({ file, pathname: url.pathname, sourceHash, servedHash, ...meta });
            driver.check(file + ' subscription source matches served behavior', servedHash, sourceHash, meta, 5); seen.add(file);
        })());
    });
    return async () => {
        await Promise.all(pending);
        for (const file of files) driver.check(file + ' actual subscription behavior loaded', seen.has(file), true, meta, 5);
    };
}

export async function installSubscriptionFixtures(page, driver) {
    await prepareSubscriptionEvidence(driver.report);
    const state = { dateMode: 'ready', providerFresh: false, workflowRequests: [], workflowMode: 'forbidden' };
    const api = new URL('api/v1/', driver.baseUrl).pathname;
    const detailPaths = new Map([recipient, payer].map(person => [api + 'persons/' + person.id, person]));
    const channelPaths = new Set(offers.map(offer => api + 'webabo/offers/' + offer.salesCode + '/salescodecombinations'));
    const datePaths = new Map(offers.map(offer => [api + 'webabo/offers/' + offer.salesCode + '/start-date', offer]));
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== driver.baseUrl.origin) return route.fallback();
        const method = request.method();
        const syntheticCleanup = method === 'DELETE' && new RegExp('^' + api + 'addresses/sessions/[a-zA-Z0-9-]+$').test(url.pathname);
        if (syntheticCleanup) {
            driver.report.subscriptionEvidence.fixtureRequests.push({ method, path: url.pathname,
                kind: 'Local synthetic form address-session cleanup; never sent upstream.' });
            return route.fulfill({ status: 204 });
        }
        if (method !== 'GET') return route.fallback();
        let json;
        if (url.pathname === api + 'webabo/offers') json = { total: offers.length, items: offers };
        else if (channelPaths.has(url.pathname)) json = { items: [
            { key: 'TM/IB', codes: ['TM', 'IB'], label: 'Synthetic telephone channel', detail: 'Controlled GET fixture' },
            { key: 'OL', codes: ['OL'], label: 'Synthetic online channel', detail: 'Controlled GET fixture' }
        ] };
        else if (detailPaths.has(url.pathname)) json = detailPaths.get(url.pathname);
        else if (datePaths.has(url.pathname)) {
            const offer = datePaths.get(url.pathname), variantCode = url.searchParams.get('variantCode');
            const validGuideRequest = offer.subscriptionKind === 'guide' && offer.variantCodes.includes(variantCode);
            if (!validGuideRequest) {
                driver.report.errors.push({ scenario: 'subscription BEFORE fixture boundary', path: url.pathname, query: url.search,
                    message: 'Unexpected membership or unavailable edition provider request; synthetic request never forwarded.' });
                return route.fulfill({ status: 422, json: { error: { code: 'edition_required', message: 'Synthetic edition unavailable' } } });
            }
            if (offer.salesCode === 'THEME05-BETA' && state.dateMode === 'held') await holdFixture(state, 'date');
            if (offer.salesCode === 'THEME05-BETA' && state.dateMode === 'unavailable') {
                driver.report.subscriptionEvidence.fixtureRequests.push({ method, path: url.pathname, query: url.search,
                    kind: 'Exact synthetic unavailable source-date GET; fulfilled503 locally, never upstream.' });
                return route.fulfill({ status: 503, json: { error: { code: 'start_date_unavailable', message: 'Synthetic provider unavailable' } } });
            }
            json = { subscriptionKind: 'guide', variantCode, startDate: offer.salesCode === 'THEME05-ALPHA' ? '2035-03-26'
                : state.providerFresh ? '2035-03-28' : '2035-03-27' };
        }
        else if (url.pathname === api + 'persons') {
            const name = (url.searchParams.get('name') || '').toLowerCase();
            if (name === 'held') await holdFixture(state, 'lookup');
            if (name === 'error') {
                driver.report.subscriptionEvidence.fixtureRequests.push({ method, path: url.pathname, query: url.search,
                    kind: 'Exact synthetic person GET error; fulfilled503 locally, never upstream.' });
                return route.fulfill({ status: 503, json: { error: { code: 'synthetic_lookup_unavailable', message: 'Synthetic lookup unavailable' } } });
            }
            json = { items: name === 'recipient' ? [recipient] : name === 'payer' ? [payer] : [] };
        } else return route.fallback();
        driver.report.subscriptionEvidence.fixtureRequests.push({ method, path: url.pathname, query: url.search,
            kind: 'Exact synthetic product/channel/person/source-date fixture; never sent upstream.' });
        return route.fulfill({ json });
    });
    if (phase === 'after') await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const addressFixture = url.origin === driver.baseUrl.origin && request.method() === 'POST'
            && ['addresses/search', 'addresses/validate'].some(suffix => url.pathname === api + suffix);
        if (addressFixture) {
            const value = request.postDataJSON();
            const newAddress = value.postalCode === '1223CK' && (url.pathname.endsWith('/search')
                ? String(value.houseNumber) === '2' : String(value.houseNumber) === '2A');
            const existingAddress = url.pathname.endsWith('/validate') && value.postalCode === recipient.postalCode
                && String(value.houseNumber) === recipient.houseNumber;
            if (!newAddress && !existingAddress) return route.fallback();
            const candidates = ['1', '2'].map(houseNumberAddition => ({ postalCode: '1223CK', houseNumber: '2A', houseNumberAddition,
                street: 'Synthetic street', city: 'HILVERSUM', countryCode: 'NL', verified: true }));
            driver.report.subscriptionEvidence.fixtureRequests.push({ method: 'POST', path: url.pathname,
                address: { postalCode: value.postalCode, houseNumber: String(value.houseNumber), countryCode: value.countryCode },
                kind: 'Exact synthetic address protocol fixture; never sent upstream or saved.' });
            return route.fulfill({ json: url.pathname.endsWith('/search') ? { status: 'matched', candidates, complete: true }
                : { status: 'confirmed', address: { ...value, street: existingAddress ? 'Synthetic street' : value.street,
                    city: existingAddress ? recipient.city : value.city, countryCode: 'NL', verified: true } } });
        }
        const workflow = url.origin === driver.baseUrl.origin && request.method() === 'POST' && url.pathname === api + 'workflows/subscription';
        if (!workflow || state.workflowMode === 'forbidden') return route.fallback();
        const payload = request.postDataJSON();
        const knownOrder = payload.offer?.salesCode === 'THEME05-BETA' && payload.offer?.credentialKey === offerSource.credentialKey
            && String(payload.recipient?.personId) === String(recipient.id) && String(payload.requester?.personId) === String(payer.id)
            && payload.subscription?.variantCode === 'SOUTH' && payload.subscription?.startDate === '2035-03-27'
            && payload.subscription?.paymentMethod === 'AC';
        if (!knownOrder) return route.fallback();
        state.workflowRequests.push(payload);
        driver.report.subscriptionEvidence.fixtureRequests.push({ method: 'POST', path: url.pathname,
            kind: state.workflowRequests.length > 1 ? 'Unexpected duplicate synthetic workflow fulfilled422 immediately; never upstream.'
                : 'Exact synthetic workflow held thenfulfilled422 locally; never forwarded or queued.' });
        if (state.workflowRequests.length > 1) return route.fulfill({ status: 422,
            json: { error: { code: 'synthetic_duplicate_request', message: 'Synthetic unexpected duplicate request' } } });
        await holdFixture(state, 'workflow');
        return route.fulfill({ status: 422, json: { error: { code: 'start_date_changed', message: 'Synthetic source date changed; fetch a fresh date.' } } });
    });
    return state;
}

function holdFixture(state, name) {
    return new Promise(resolve => { state[name + 'Held'] = true; state[name + 'Release'] = resolve; });
}

async function awaitFixture(state, name) {
    const started = Date.now();
    while (!state[name + 'Held']) {
        if (Date.now() - started > 10000) throw new Error('Exact synthetic ' + name + ' request was not held within10seconds.');
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

async function observe(page, driver, meta, state, selector, kind) {
    await page.locator(selector).first().scrollIntoViewIfNeeded(); await driver.painted(page);
    const data = await page.evaluate(() => {
        const bounds = node => {
            if (!node) return null;
            const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
            return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
                visible: Boolean(node.getClientRects().length), display: css.display, grid: css.gridTemplateColumns,
                padding: css.padding, gap: css.gap, background: css.backgroundColor, radius: css.borderRadius, shadow: css.boxShadow,
                fontSize: css.fontSize, fontWeight: css.fontWeight, lineHeight: css.lineHeight };
        };
        const form = document.querySelector('#newSubscriptionForm'), input = id => document.getElementById(id);
        const status = id => {
            const node = input(id);
            return node ? { ...bounds(node), role: node.getAttribute('role'), text: node.textContent } : null;
        };
        return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
            card: bounds(form.querySelector('.onepager-container')), product: bounds(form.querySelector('.werfsleutel-fieldset')),
            title: bounds(form.querySelector('h2')), rolePanels: [...form.querySelectorAll('.party-role-panel')].map(bounds),
            selectedOffers: window.kiwiWerfsleutelSlice.getSelections().map(selection => ({ code: selection.selectedKey?.salesCode, channel: selection.selectedChannel,
                divisionId: selection.selectedKey?.divisionId, mandant: selection.selectedKey?.mandant, credentialKey: selection.selectedKey?.credentialKey,
                productCode: selection.selectedKey?.productCode, kind: selection.selectedKey?.subscriptionKind, variants: selection.selectedKey?.variantCodes })),
            selectedPeople: Object.fromEntries(['recipient', 'requester'].map(role => [role, { mode: subscriptionRoleState[role].mode,
                id: subscriptionRoleState[role].selectedPerson?.id || null, source: subscriptionRoleState[role].selectedPerson?.sourceSystem || null }])),
            requesterSame: input('requesterSameAsRecipient').checked,
            pending: { lookup: ['recipient', 'requester'].map(role => ({ role, status: status(role + 'SearchStatus'),
                busy: input(role + 'SearchButton').getAttribute('aria-busy'), disabled: input(role + 'SearchButton').disabled })),
                workflow: { status: status('subscriptionSubmitStatus'), busy: form.querySelector('button[type="submit"]').getAttribute('aria-busy'),
                    disabled: form.querySelector('button[type="submit"]').disabled } },
            payment: [...form.querySelectorAll('input[name="subPayment"]')].map(node => ({ value: node.value, checked: node.checked, disabled: node.disabled })),
            iban: { ...bounds(input('subIBAN')), required: input('subIBAN').required, populated: Boolean(input('subIBAN').value) },
            dates: [...form.querySelectorAll('#subscriptionStartDates input,#subscriptionStartDates select,#subStartDate')].map(node => ({
                ...bounds(node), id: node.id, value: node.value, disabled: node.disabled, readonly: node.readOnly, required: node.required,
                label: Boolean(node.labels?.length), described: node.getAttribute('aria-describedby') })),
            dateStatuses: [...form.querySelectorAll('#subscriptionStartDates [role="status"]')].map(node => ({ id: node.id, text: node.textContent })),
            addressStatuses: [...form.querySelectorAll('[id$="AddressStatus"]')].map(node => ({ id: node.id, state: node.dataset.state,
                visible: Boolean(node.getClientRects().length), text: node.textContent })),
            consent: [...form.querySelectorAll('.optin-row')].map(row => ({ ...bounds(row), choices: [...row.querySelectorAll('input')].map(node => ({ value: node.value, checked: node.checked, disabled: node.disabled })) })),
            fields: [...form.querySelectorAll('input:not([type="hidden"]),select,textarea')].map(node => ({ ...bounds(node), id: node.id, type: node.type,
                disabled: node.disabled, readonly: Boolean(node.readOnly), label: Boolean(node.labels?.length || node.getAttribute('aria-label') || node.getAttribute('aria-labelledby')) })),
            actions: [...form.querySelectorAll('.form-actions button')].map(node => ({ ...bounds(node), type: node.type, disabled: node.disabled })) };
    });
    driver.report.subscriptionEvidence.observations.push({ ...meta, state, kind, data });
    if (phase === 'after') await (await import('./compose-smoke-theme-audit-subscription-acceptance.mjs')).checkSubscriptionState(page, driver, meta, state);
    await driver.capture(page, (meta.native ? 'native-200-' : phase + '-') + 'subscription-' + state, undefined, kind);
}

async function selectPerson(page, role, query, id) {
    await page.locator(`input[name="${role}Mode"][value="existing"]`).check();
    const details = page.locator('#' + role + 'PersonSearch');
    if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').press('Enter');
    await page.locator('#' + role + 'SearchQuery').fill(query);
    await page.locator('#' + role + 'SearchButton').press('Enter');
    await page.locator(`#${role}SearchResults [data-arg-person-id="${id}"]`).press('Enter');
    await page.waitForFunction(({ role, id }) => subscriptionRoleState[role].selectedPerson?.id === id, { role, id });
}

export async function runSubscriptionScenarios(page, driver, meta, fixtures) {
    const actual = 'Actual local initial subscription form; synthetic catalogue is available but no product/person is selected.';
    const controlled = 'Actual subscription renderers with exact synthetic GET product/channel/person/source-date fixtures and local form-session cleanup; no transaction or server-permission acceptance.';
    const focused = phase === 'after' && !meta.native && !meta.sentinel && !meta.privacyDiagnostic && !meta.pointerSupplement;
    await page.locator('[data-action="show-new-subscription"]').first().press('Enter');
    await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'initial-top', '#newSubscriptionForm h2', actual);
    if (!meta.sentinel) {
        await observe(page, driver, meta, 'initial-payment', '#newSubscriptionForm .payment-methods', actual);
        await observe(page, driver, meta, 'initial-consent-actions', '#newSubscriptionForm .form-actions', actual);
    }
    for (const offer of offers) {
        await page.locator('#werfsleutelInput').fill(offer.salesCode);
        await page.locator(`.werfsleutel-suggestion[data-code="${offer.salesCode}"]`).press('Enter');
        await page.locator(`.channel-chip[data-arg-sales-code="${offer.salesCode}"][data-arg-combination-key="OL"]`).press('Enter');
    }
    await observe(page, driver, meta, 'selected-products', '#werfsleutelSummary', controlled);
    await observe(page, driver, meta, 'guide-awaiting-edition', '#subscriptionStartDates', controlled);
    if (phase === 'after') driver.check('multiple-edition guide waits for explicit choice without a source date',
        await page.locator('#subscription-edition-THEME05-BETA').inputValue() === ''
        && await page.locator('#subscription-date-THEME05-BETA').inputValue() === '', true, meta, 5);
    if (focused) fixtures.dateMode = 'held';
    await page.locator('#subscription-edition-THEME05-BETA').selectOption('SOUTH');
    if (focused) await inspectProviderStates(page, driver, meta, fixtures, controlled);
    await page.waitForFunction(() => document.getElementById('subscription-date-THEME05-ALPHA')?.value === '2035-03-26'
        && document.getElementById('subscription-date-THEME05-BETA')?.value === '2035-03-27');
    await page.locator('#subStartDate').fill('2035-03-25');
    await observe(page, driver, meta, 'mixed-guide-membership-dates', '#subscriptionStartDates', controlled);
    if (meta.native) {
        await page.locator('#subStartDate').focus();
        await observe(page, driver, meta, 'membership-date-native-focus', '#subStartDate', controlled);
        const live = await page.locator('#subStartDate').evaluate(node => {
            const rect = node.getBoundingClientRect();
            return { focused: document.activeElement === node, value: node.value, label: Boolean(node.labels?.length),
                reachable: rect.x >= 0 && rect.right <= innerWidth + 1 && rect.y >= 0 && rect.bottom <= innerHeight + 1 };
        });
        driver.check('actual native membership DATE stays populated labelled and reachable', live.focused && live.value === '2035-03-25'
            && live.label && live.reachable, true, { ...meta, live }, 5);
    }
    if (phase === 'after') driver.check('mixed guide dates remain readonly and membership date editable required', await page.evaluate(() =>
        ['THEME05-ALPHA', 'THEME05-BETA'].every(code => document.getElementById('subscription-date-' + code).readOnly)
        && !document.getElementById('subStartDate').disabled && document.getElementById('subStartDate').required
        && !document.getElementById('subStartDate').readOnly), true, meta, 5);
    if (focused) await inspectLookupStates(page, driver, meta, fixtures, controlled);
    await selectPerson(page, 'recipient', 'recipient', recipient.id);
    await observe(page, driver, meta, 'selected-recipient', '#recipientSelectedPerson', controlled);
    if (!meta.sentinel) {
        await page.locator('#recipientPersonSearch > summary').press('Enter');
        await observe(page, driver, meta, 'open-recipient-lookup', '#recipientPersonSearch .subscription-person-search', controlled);
    }
    await page.locator('#requesterSameAsRecipient').press('Space');
    await selectPerson(page, 'requester', 'payer', payer.id);
    await observe(page, driver, meta, 'different-payer', '#requesterSelectedPerson', controlled);
    await page.locator('#subPaymentAuto').press('ArrowRight');
    await observe(page, driver, meta, 'payment-instruction', '#newSubscriptionForm .payment-methods', controlled);
    await observe(page, driver, meta, 'existing-consent-actions', '#newSubscriptionForm .form-actions', controlled);
    if (meta.pointerSupplement) {
        await page.locator('#recipientSearchQuery').fill('error');
        await page.locator('#recipientSearchButton').press('Enter');
        await page.locator('.toast.show').filter({ hasText: 'Synthetic lookup unavailable' }).last().waitFor({ state: 'visible' });
    }
    if (focused || meta.pointerSupplement) await inspectRejectedWorkflow(page, driver, meta, fixtures, controlled);
    if (meta.pointerSupplement) return;
    await page.locator('input[name="recipientMode"][value="existing"]').press('ArrowRight');
    await page.locator('#subRecipientInitials').fill('S.B.');
    await observe(page, driver, meta, 'create-recipient', '#recipientCreateForm', controlled);
    if (focused || meta.privacyDiagnostic) await inspectNewAddress(page, driver, meta, controlled);
    await page.locator('input[name="requesterMode"][value="existing"]').press('ArrowRight');
    await page.locator('#subRequesterInitials').fill('P.B.');
    await observe(page, driver, meta, 'create-payer', '#requesterCreateForm', controlled);
    await page.locator('#subPaymentInstruction').press('ArrowLeft');
    await observe(page, driver, meta, 'create-payment-consent', '#newSubscriptionForm .payment-methods', controlled);
    await observe(page, driver, meta, 'create-consent-actions', '#newSubscriptionForm .form-actions', controlled);
    if (phase === 'after') {
        driver.check('new-person consent starts unset and editable', await page.locator('#subscriptionForm .optin-row input').evaluateAll(nodes =>
            nodes.every(node => !node.checked && !node.disabled)), true, meta, 5);
        await page.locator('input[name="subOptinEmail"][value="yes"]').press('Space');
        await page.locator('input[name="subOptinPhone"][value="no"]').press('Space');
        await page.locator('input[name="subOptinPost"][value="no"]').press('Space');
        await observe(page, driver, meta, 'set-consent-actions', '#newSubscriptionForm .form-actions', controlled);
        await inspectRetainedDraft(page, driver, meta, controlled);
        const acceptance = await import('./compose-smoke-theme-audit-subscription-acceptance.mjs');
        await acceptance.inspectSubscriptionKeyboard(page, driver, meta);
        if (focused) {
            await inspectDuplicatePresentation(page, driver, meta, controlled);
        }
        if (focused || meta.privacyDiagnostic) await acceptance.inspectSubscriptionPrivacy(page, driver, meta);
        if (meta.native || meta.viewport.width === 1440) await inspectProfileDraftSentinel(page, driver, meta, controlled);
    }
}

async function inspectProfileDraftSentinel(page, driver, meta, kind) {
    const { subscriptionDraftSnapshot } = await import('./compose-smoke-theme-audit-subscription-acceptance.mjs');
    const before = await subscriptionDraftSnapshot(page);
    await page.locator('#newSubscriptionForm [data-action="close-form"]').first().press('Enter');
    await page.locator('#agentProfileTrigger').press('Enter');
    await page.locator('#agentStatusMenu').waitFor({ state: 'visible' });
    await driver.capture(page, (meta.native ? 'native-200-' : 'after-') + 'subscription-profile-sentinel', undefined,
        'Small actual shared profile/header sentinel; no status or preference mutation.');
    await page.keyboard.press('Escape');
    await page.locator('#agentStatusMenu').waitFor({ state: 'hidden' });
    await page.locator('[data-action="show-new-subscription"]').first().press('Enter');
    await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
    driver.check('profile Escape and subscription reopen preserve the entire local workflow draft', JSON.stringify(await subscriptionDraftSnapshot(page)), JSON.stringify(before), meta, 5);
    await observe(page, driver, meta, 'profile-restored-draft', '#recipientCreateForm', kind);
}

async function inspectNewAddress(page, driver, meta, kind) {
    const address = page.locator('#recipientCreateForm [data-address-prefix]'), prefix = await address.getAttribute('data-address-prefix');
    await page.locator(`[id="${prefix}HouseNumber"]`).fill('2A');
    await page.locator(`[id="${prefix}PostalCode"]`).fill('1223CK');
    const choices = page.locator(`[id="${prefix}AddressChoices"]`);
    await choices.waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'create-address-candidates', `[id="${prefix}AddressChoices"]`, kind + ' Exact synthetic shared address protocol, no save.');
    await choices.selectOption('0');
    const countValidation = () => driver.report.subscriptionEvidence.fixtureRequests.filter(request => request.path.endsWith('/addresses/validate')
        && request.address?.postalCode === '1223CK' && request.address?.houseNumber === '2A').length;
    const beforeValidation = countValidation();
    const valid = await page.locator('#recipientCreateForm').evaluate(node => window.kiwiAddressCompletion.validate(node));
    driver.check('new recipient invokes the real shared validator and exact full-address POST', valid && countValidation() > beforeValidation, true, meta, 5);
    await observe(page, driver, meta, 'create-address-confirmed', `[id="${prefix}PostalCode"]`, kind + ' Confirmed status may intentionally be hidden; actual state recorded.');
}

async function inspectProviderStates(page, driver, meta, fixtures, kind) {
    await awaitFixture(fixtures, 'date');
    await observe(page, driver, meta, 'provider-loading', '#subscriptionStartDates', kind + ' Provider GET is actually held locally.');
    fixtures.dateMode = 'unavailable'; fixtures.dateRelease();
    const retry = page.locator('#subscription-date-THEME05-BETA-status + button');
    await retry.waitFor({ state: 'visible' });
    driver.check('unavailable guide provider has no fallback date', await page.locator('#subscription-date-THEME05-BETA').inputValue(), '', meta, 5);
    await observe(page, driver, meta, 'provider-unavailable', '#subscriptionStartDates', kind);
    fixtures.dateMode = 'ready';
    await retry.press('Enter');
    await page.waitForFunction(() => document.getElementById('subscription-date-THEME05-BETA')?.value === '2035-03-27');
    await observe(page, driver, meta, 'provider-retried', '#subscriptionStartDates', kind);
}

async function inspectLookupStates(page, driver, meta, fixtures, kind) {
    await page.locator('input[name="recipientMode"][value="existing"]').check();
    const disclosure = page.locator('#recipientPersonSearch');
    if (!await disclosure.evaluate(node => node.open)) await disclosure.locator(':scope > summary').press('Enter');
    const query = page.locator('#recipientSearchQuery'), search = page.locator('#recipientSearchButton'), status = page.locator('#recipientSearchStatus');
    await query.fill('held'); await search.press('Enter'); await awaitFixture(fixtures, 'lookup');
    await status.waitFor({ state: 'visible' });
    const lookupMessage = (await status.textContent()).trim();
    driver.check('actual pending lookup has a visible status while a new query remains usable', await status.getAttribute('role') === 'status'
        && lookupMessage.length > 0 && !lookupMessage.startsWith('subscription.')
        && await search.getAttribute('aria-busy') === 'true' && !await search.isDisabled(), true, { ...meta, lookupMessage }, 5);
    await observe(page, driver, meta, 'lookup-held-request', '#recipientPersonSearch', kind + ' Exact person GET held locally; actual status and busy presentation.');
    await query.fill('recipient'); await query.press('Enter');
    await page.locator('#recipientSearchResults [data-arg-person-id="99051"]').waitFor({ state: 'visible' });
    const heldResponse = () => page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === 'GET' && url.origin === driver.baseUrl.origin
            && url.pathname === new URL('api/v1/persons', driver.baseUrl).pathname && url.searchParams.get('name') === 'held';
    }, { timeout: 10000 });
    const oldResponse = heldResponse();
    fixtures.lookupRelease();
    await (await oldResponse).finished(); await driver.painted(page);
    driver.check('late older lookup cannot overwrite the newer Input Enter search', await query.inputValue() === 'recipient'
        && await page.locator('#recipientSearchResults [data-arg-person-id="99051"]').count() === 1, true, meta, 5);
    fixtures.lookupHeld = false;
    await query.fill('held'); await search.press('Enter'); await awaitFixture(fixtures, 'lookup');
    await status.waitFor({ state: 'visible' });
    await query.fill('edited without a new request');
    const editedResponse = heldResponse(); fixtures.lookupRelease();
    await (await editedResponse).finished(); await status.waitFor({ state: 'hidden' }); await driver.painted(page);
    driver.check('filter-only editing clears completed lookup busy ownership without replacing the query', await query.inputValue() === 'edited without a new request'
        && await search.getAttribute('aria-busy') !== 'true' && await page.locator('#recipientSearchResults [data-arg-person-id]').count() === 0, true, meta, 5);
    await query.fill('empty'); await search.press('Enter');
    await page.locator('#recipientSearchResults').filter({ hasText: 'Geen personen gevonden' }).waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'lookup-empty', '#recipientSearchResults', kind);
    await query.fill('error'); await search.press('Enter');
    await page.locator('.toast').filter({ hasText: 'Synthetic lookup unavailable' }).last().waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'lookup-error', '#recipientPersonSearch', kind + ' Actual error toast from a local503 response.');
    await query.fill('recipient'); await query.press('Enter');
    await page.locator('#recipientSearchResults [data-arg-person-id="99051"]').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'lookup-results-recovered', '#recipientSearchResults', kind);
}

async function inspectRejectedWorkflow(page, driver, meta, fixtures, kind) {
    const { subscriptionDraftSnapshot } = await import('./compose-smoke-theme-audit-subscription-acceptance.mjs');
    for (const code of ['THEME05-ALPHA', 'THEME05-MEMBER'])
        await page.locator(`[data-action="remove-subscription-offer"][data-arg-sales-code="${code}"]`).press('Enter');
    await page.locator('#subPaymentInstruction').press('ArrowLeft');
    await page.locator('#subscriptionForm button[type="submit"]').press('Enter');
    driver.check('native empty IBAN validation blocks a transaction and keeps the field reachable', await page.locator('#subIBAN').evaluate(node =>
        node.required && !node.validity.valid && document.activeElement === node) && fixtures.workflowRequests.length === 0, true, meta, 5);
    await observe(page, driver, meta, 'payment-native-validation', '#subIBAN', kind + ' Native HTML validity; no workflow request.');
    await page.locator('#subPaymentAuto').press('ArrowRight');
    const addressesValid = await page.evaluate(() => window.kiwiAddressCompletion.validate(document.getElementById('subscriptionForm')));
    driver.check('real existing-person address validators initialize before the rejection draft checkpoint', addressesValid, true, meta, 5);
    const before = await subscriptionDraftSnapshot(page);
    fixtures.workflowMode = 'held';
    await page.locator('#subscriptionForm button[type="submit"]').press('Enter'); await awaitFixture(fixtures, 'workflow');
    const status = page.locator('#subscriptionSubmitStatus'), submit = page.locator('#subscriptionForm button[type="submit"]');
    await status.waitFor({ state: 'visible' });
    const workflowMessage = (await status.textContent()).trim();
    driver.check('actual owned workflow POST has a visible status and busy disabled submit', await status.getAttribute('role') === 'status'
        && workflowMessage.length > 0 && !workflowMessage.startsWith('subscription.')
        && await submit.isDisabled() && await submit.getAttribute('aria-busy') === 'true', true, { ...meta, workflowMessage }, 5);
    await observe(page, driver, meta, 'workflow-pending', '#subscriptionSubmitStatus', kind + ' Exact synthetic POST held locally; real pending cue and disabled submit.');
    await submit.scrollIntoViewIfNeeded(); await driver.painted(page);
    const point = await submit.boundingBox();
    if (!point) throw new Error('Actual pending submit button is not visible for the duplicate-click probe.');
    const initialTarget = await submit.evaluate((node, point) => {
        const target = document.elementFromPoint(point.x + point.width / 2, point.y + point.height / 2);
        return { observedAtMs: Date.now(), buttonHit: node.contains(target), target: target ? { tag: target.tagName, id: target.id, className: target.className } : null,
            shownToasts: [...document.querySelectorAll('.toast.show')].map(toast => { const rect = toast.getBoundingClientRect();
                return { text: toast.textContent, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }; }) };
    }, point);
    if (!initialTarget.buttonHit) await page.waitForFunction(point => {
        const node = document.querySelector('#subscriptionForm button[type="submit"]'), rect = node.getBoundingClientRect();
        const samePoint = Math.abs(rect.x - point.x) < 0.5 && Math.abs(rect.y - point.y) < 0.5
            && Math.abs(rect.width - point.width) < 0.5 && Math.abs(rect.height - point.height) < 0.5;
        return samePoint && node.contains(document.elementFromPoint(point.x + point.width / 2, point.y + point.height / 2));
    }, point, { timeout: 10000 });
    const readyTarget = await submit.evaluate((node, point) => ({ observedAtMs: Date.now(),
        buttonHit: node.contains(document.elementFromPoint(point.x + point.width / 2, point.y + point.height / 2)),
        shownToasts: [...document.querySelectorAll('.toast.show')].map(toast => ({ text: toast.textContent, className: toast.className })) }), point);
    driver.check('pending duplicate-click probe targets the actual visible submit button', readyTarget.buttonHit, true,
        { ...meta, point, initialTarget, readyTarget, readinessDurationMs: readyTarget.observedAtMs - initialTarget.observedAtMs, readiness: 'Same unchanged button center becomes hit-testable through actual toast expiry; no force click or DOM removal.' }, 5);
    await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2);
    const reentry = await page.evaluate(async () => {
        if (typeof window.createSubscription !== 'function') throw new Error('Actual exported async createSubscription handler is required.');
        let timer;
        try {
            await Promise.race([window.createSubscription({ preventDefault() {} }), new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Owned-POST duplicate handler invocation did not settle within10seconds.')), 10000);
            })]);
            return { actualHandlerSettled: true };
        } finally { clearTimeout(timer); }
    });
    driver.check('disabled pointer activation and settled actual async handler reentry produce one owned POST', fixtures.workflowRequests.length === 1
        && await submit.isDisabled() && await submit.getAttribute('aria-busy') === 'true' && reentry.actualHandlerSettled, true,
    { ...meta, reentry, kind: 'Actual pointer click plus direct awaited exported createSubscription handler while local POST is held; no native event-dispatch or transaction-completion claim.' }, 5);
    await page.locator('#newSubscriptionForm [data-action="close-form"]').first().press('Enter');
    await page.locator('[data-action="show-new-subscription"]').first().press('Enter');
    await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
    driver.check('closing and reopening a pending workflow preserves the full draft and busy owner', JSON.stringify(await subscriptionDraftSnapshot(page)) === JSON.stringify(before)
        && await submit.isDisabled() && await submit.getAttribute('aria-busy') === 'true' && await status.isVisible(), true, meta, 5);
    await observe(page, driver, meta, 'workflow-pending-reopened', '#subscriptionSubmitStatus', kind);
    fixtures.workflowMode = 'forbidden'; fixtures.workflowRelease();
    await page.waitForFunction(() => document.getElementById('subscription-date-THEME05-BETA')?.value === ''
        && Boolean(document.querySelector('#subscription-date-THEME05-BETA-status + button'))
        && !document.querySelector('#subscriptionForm button[type="submit"]').disabled
        && document.querySelector('#subscriptionForm button[type="submit"]').getAttribute('aria-busy') !== 'true');
    await status.waitFor({ state: 'hidden' });
    const after = await subscriptionDraftSnapshot(page);
    const withoutRejectedDate = value => ({ ...value, fields: value.fields.filter(field => field.id !== 'subscription-date-THEME05-BETA') });
    driver.check('locally rejected workflow preserves source identities channels consent and draft', JSON.stringify(withoutRejectedDate(after)),
        JSON.stringify(withoutRejectedDate(before)), meta, 5);
    driver.check('pending workflow is exactly one intercepted synthetic order', fixtures.workflowRequests.length, 1, meta, 5);
    driver.report.subscriptionAcceptance.interactions.push({ ...meta, workflowRequests: fixtures.workflowRequests,
        kind: 'Actual createSubscription path; exact synthetic POST fulfilled422 start_date_changed locally, never upstream or queued.' });
    await observe(page, driver, meta, 'source-rejected-retained', '#subscriptionStartDates', kind);
    fixtures.providerFresh = true;
    await page.locator('#subscription-date-THEME05-BETA-status + button').press('Enter');
    await page.waitForFunction(() => document.getElementById('subscription-date-THEME05-BETA')?.value === '2035-03-28');
    await observe(page, driver, meta, 'source-rejection-recovered', '#subscriptionStartDates', kind);
}

async function inspectRetainedDraft(page, driver, meta, kind) {
    const { subscriptionDraftSnapshot, subscriptionDraftPreservation } = await import('./compose-smoke-theme-audit-subscription-acceptance.mjs');
    await page.locator('#subRecipientLastName').fill('Synthetic retained recipient draft');
    await page.evaluate(() => window.kiwiSubscriptionRoleRuntime.evaluateSubscriptionDuplicateRole('recipient'));
    const readCount = () => driver.report.subscriptionEvidence.fixtureRequests.filter(request => request.method === 'GET').length;
    const before = await subscriptionDraftSnapshot(page), requests = readCount();
    await page.locator('#subscriptionForm .form-actions [data-action="close-form"]').press('Enter');
    await page.locator('[data-action="show-new-subscription"]').first().press('Enter');
    await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
    const after = await subscriptionDraftSnapshot(page), preservation = subscriptionDraftPreservation(before, after);
    driver.check('actual close and reopen retain all subscription model values and verified address view ownership', preservation.passed, true,
        { ...meta, before, after, preservation }, 5);
    driver.check('subscription draft reopen performs no new read request', readCount(), requests, meta, 5);
    await observe(page, driver, meta, 'reopened-local-draft', '#recipientCreateForm', kind);
    const payment = page.locator('#subPaymentAuto');
    await payment.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const focused = await page.evaluate(() => ({ id: document.activeElement.id, visible: document.activeElement.matches(':focus-visible'),
        width: parseFloat(getComputedStyle(document.activeElement).outlineWidth), style: getComputedStyle(document.activeElement).outlineStyle }));
    driver.check('native payment Tab traversal retains a visible focus indicator', focused.id === 'subPaymentAuto' && focused.visible
        && focused.width >= 3 && focused.style === 'solid', true, { ...meta, focused }, 5);
    await observe(page, driver, meta, 'payment-keyboard-focus', '#newSubscriptionForm .payment-methods', kind);
}

async function inspectDuplicatePresentation(page, driver, meta, kind) {
    const original = await page.evaluateHandle(() => ({ ...window.kiwiSubscriptionRoleRuntime.getSubscriptionDuplicateRoleState('recipient') }));
    try {
        await page.evaluate(person => {
            const runtime = window.kiwiSubscriptionRoleRuntime, state = runtime.getSubscriptionDuplicateRoleState('recipient');
            state.strongMatches = [person]; state.lastFingerprint = 'theme-audit05-controlled-duplicate';
            state.isChecking = false; state.isExpanded = false; state.acknowledgedFingerprint = '';
            runtime.renderSubscriptionDuplicateCheck('recipient');
        }, recipient);
        const fixture = kind + ' Explicit duplicate renderer fixture; no identity selection or warning acknowledgement.';
        await observe(page, driver, meta, 'duplicate-warning-fixture', '#recipientDuplicateCheck', fixture);
        await page.locator('#recipientDuplicateCheck [data-action="toggle-subscription-duplicate-matches"]').press('Enter');
        await page.locator('#recipientDuplicateCheck [data-action="select-subscription-duplicate-person"]').waitFor({ state: 'visible' });
        await observe(page, driver, meta, 'duplicate-expanded-fixture', '#recipientDuplicateCheck', fixture);
        driver.check('duplicate presentation leaves identity and acknowledgement untouched', await page.evaluate(() =>
            subscriptionRoleState.recipient.selectedPerson === null && window.kiwiSubscriptionRoleRuntime.getSubscriptionDuplicateRoleState('recipient').acknowledgedFingerprint === ''), true, meta, 5);
    } finally {
        await page.evaluate(value => { Object.assign(window.kiwiSubscriptionRoleRuntime.getSubscriptionDuplicateRoleState('recipient'), value);
            window.kiwiSubscriptionRoleRuntime.renderSubscriptionDuplicateCheck('recipient'); }, original);
        await original.dispose();
    }
}

export function releaseSubscriptionFixtures(fixtures) {
    for (const name of ['date', 'lookup', 'workflow']) fixtures[name + 'Release']?.();
}

export async function inspectSubscription(driver, viewport, contract) {
    driver = { ...driver, contract };
    const report = driver.report;
    await prepareSubscriptionEvidence(report);
    const context = await driver.newContext(viewport), page = await context.newPage();
    const meta = { viewport, locale: 'nl', sentinel: process.env.KIWI_THEME_AUDIT_SUBSCRIPTION_SUITE === 'sentinels',
        privacyDiagnostic: process.env.KIWI_THEME_AUDIT_SUBSCRIPTION_PRIVACY_DIAGNOSTIC === '1',
        pointerSupplement: process.env.KIWI_THEME_AUDIT_SUBSCRIPTION_POINTER_SUPPLEMENT === '1' };
    const finishCss = driver.trackStylesheets(page, meta), finishBehavior = await trackSubscriptionBehavior(page, driver, meta);
    page.on('pageerror', error => report.errors.push({ scenario: 'subscription ' + phase + ' runtime', viewport, message: error.message }));
    const fixtures = await installSubscriptionFixtures(page, driver);
    try {
        await driver.login(page);
        driver.check('actual requested subscription locale', await page.locator('html').getAttribute('lang'), 'nl', meta, 5);
        await runSubscriptionScenarios(page, driver, meta, fixtures);
    } catch (error) {
        report.errors.push({ scenario: 'subscription ' + phase + ' setup', viewport, message: error.message });
        await driver.capture(page, phase + '-subscription-failure', undefined, 'Incomplete actual subscription scenario; failure retained.').catch(() => {});
    } finally {
        releaseSubscriptionFixtures(fixtures);
        await finishBehavior(); await finishCss(); await context.close(); await driver.saveReport();
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./compose-smoke-theme-audit.mjs', import.meta.url))], { stdio: 'inherit',
        env: { ...process.env, KIWI_THEME_AUDIT_SUBSCRIPTION_ONLY: '1', KIWI_THEME_AUDIT_SLICE: process.env.KIWI_THEME_AUDIT_SLICE || '5' } });
    if (result.error) throw result.error; process.exitCode = result.status ?? 1;
}
