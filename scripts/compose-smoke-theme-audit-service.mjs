import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';
import { loadServiceAckFixtures, buildServiceQueuedAck } from './compose-smoke-theme-audit-service-ack-fixtures.mjs';

// theme_audit: controlled UI fixtures; real workflows run but baseline never submits.
const phase = process.env.KIWI_THEME_AUDIT_SERVICE_PHASE || 'before';
const suite = process.env.KIWI_THEME_AUDIT_SERVICE_SUITE || 'full';
if (!['full', 'provider', 'winback', 'complaint'].includes(suite) || (suite !== 'full' && phase !== 'after')) throw new Error('Scoped service provider and callback checks require the after phase.');
const modulePath = fileURLToPath(import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const behaviorFiles = ['js/app/slices/subscription-workflow-slice.js', 'js/app/slices/winback-slice.js',
    'js/app/subscription-role-runtime.js', 'js/app/lightbox-drafts.js', 'js/app/address-completion.js',
    ...(phase === 'after' ? ['js/app/service-form-context.js', 'js/app/service-form-feedback.js'] : [])];
export const serviceCustomer = {
    id: 990701, salutation: 'Mevr.', firstName: 'Synthetic', middleName: 'van de',
    lastName: 'Long Customer Name With Multiple Parts', birthday: '1982-06-17',
    email: 'synthetic.service07@example.invalid', phone: '0612347890',
    postalCode: '2468ZX', houseNumber: '28', houseNumberAddition: 'B', addressExtension: 'Synthetic floor',
    street: 'Syntheticstraat', address: 'Syntheticstraat 28 B', city: 'SYNTHETIC CITY',
    subscriptions: [
        { id: 990711, magazine: 'Avrobode', status: 'active', duration: '2-jaar', startDate: '2025-03-12', lastEdition: '2026-10-12' },
        { id: 990712, magazine: 'Synthetic second long magazine title with edition and subscription context', status: 'active', duration: '1-jaar', startDate: '2025-04-18', lastEdition: '2026-10-19' },
        { id: 990713, magazine: 'Synthetic restituted magazine with a long title', status: 'restituted', startDate: '2024-04-18', lastEdition: '2026-10-05', refundInfo: { email: 'synthetic.refund07@example.invalid' } }
    ]
};
export const serviceOffers = [
    { offerId: 'THEME07-ALPHA', title: 'Synthetic long retention offer with customer and publication context',
        description: 'Synthetic explanatory offer details that wrap naturally across narrow screens without changing the actual offer contract.', price: 38.5 },
    { offerId: 'THEME07-BETA', title: 'Synthetic alternative retention offer', description: 'A second controlled offer for selection and back navigation.', price: 24 }
];

export async function trackServiceBehavior(page, driver, meta) {
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
            const body = await response.body().catch(() => null); if (!body) return;
            const source = sources[file], sourceUrl = new URL('assets/' + file, driver.baseUrl);
            const sourceHash = hash(normalizeKnownJsImports(source, source, sourceUrl));
            const servedHash = hash(normalizeKnownJsImports(body.toString('utf8'), source, sourceUrl));
            driver.report.serviceEvidence.loadedBehavior.push({ file, sourceHash, servedHash, ...meta });
            driver.check(file + ' service source matches actual served behavior', servedHash, sourceHash, meta, 7); seen.add(file);
        })());
    });
    return async () => {
        await Promise.all(pending);
        for (const file of behaviorFiles) driver.check(file + ' service behavior actually loaded', seen.has(file), true, meta, 7);
    };
}

export async function installServiceFixtures(page, driver) {
    const api = new URL('api/v1/', driver.baseUrl), requests = driver.report.serviceEvidence.fixtureRequests;
    const controls = { expectedMutation: null, mutations: [], heldMutations: [], addressMode: 'normal',
        offers: { mode: 'normal', requests: [], releases: [] },
        ackFixtures: phase === 'after' ? await loadServiceAckFixtures(driver.sourceRoot, process.env.KIWI_THEME_SERVICE_ACK_FIXTURES) : null,
        queuedAck: null, outboxReads: [] };
    if (controls.ackFixtures) driver.report.serviceEvidence.ackFixtures = {
        ...controls.ackFixtures.artifact, backendSourceSha256: controls.ackFixtures.backendSourceSha256,
        boundary: 'Actual in-memory PHP projection shapes with a declared local transport envelope; no database, consumer or upstream write.'
    };
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        if (url.origin !== api.origin) return route.fallback();
        if (phase === 'after' && method === 'GET' && [990701, 990702].some(id => url.pathname === api.pathname + 'persons/' + id)) {
            if (controls.queuedAck && url.pathname.endsWith('/990701')) {
                requests.push({ method, path: url.pathname, kind: 'Declared source-derived provisional customer reload, local only.' });
                return route.fulfill({ json: controls.queuedAck.customer });
            }
            const person = { ...serviceCustomer, addressValidation: { status: 'confirmed' }, contactHistory: [], articles: [],
                ...(url.pathname.endsWith('/990702') ? { id: 990702, lastName: 'Synthetic second customer' } : {}) };
            requests.push({ method, path: url.pathname, kind: 'Declared synthetic customer read; never upstream.' });
            return route.fulfill({ json: person });
        }
        if (controls.ackFixtures && method === 'GET' && [api.pathname + 'outbox-sessions', api.pathname + 'outbox-sessions/990799'].includes(url.pathname)) {
            const entry = { method, path: url.pathname, kind: 'Declared in-memory outbox transport read; no live outbox state.' };
            controls.outboxReads.push(entry); requests.push(entry);
            if (url.pathname.endsWith('/990799')) return route.fulfill({ status: controls.queuedAck ? 200 : 404,
                json: controls.queuedAck?.response.outbox || { error: { code: 'synthetic_outbox_not_found' } } });
            return route.fulfill({ json: { items: controls.queuedAck ? [controls.queuedAck.listItem] : [], total: controls.queuedAck ? 1 : 0 } });
        }
        if (phase === 'after' && method === 'POST' && ['addresses/search', 'addresses/validate'].some(suffix => url.pathname === api.pathname + suffix)) {
            const payload = request.postDataJSON();
            const known = ['2468ZX', '1223CK'].includes(String(payload.postalCode).replace(/\s/g, '').toUpperCase());
            if (!known) return route.fallback();
            const address = { ...payload, postalCode: String(payload.postalCode).replace(/\s/g, '').toUpperCase(),
                houseNumber: String(payload.houseNumber), houseNumberAddition: payload.houseNumberAddition || '',
                street: payload.street || 'Syntheticstraat', city: payload.city || 'SYNTHETIC CITY', countryCode: 'NL', verified: true };
            requests.push({ method, path: url.pathname, payload, kind: 'Local synthetic address protocol, no upstream request.' });
            return route.fulfill({ json: url.pathname.endsWith('/search') ? { status: 'matched', candidates: [address], complete: true } : { status: 'confirmed', address } });
        }
        if (phase === 'after' && method === 'POST' && url.pathname === api.pathname + 'customer-work-sessions/reset') {
            const payload = request.postDataJSON();
            if (![990701, 990702].includes(Number(payload.customerReference?.personId))) return route.fallback();
            requests.push({ method, path: url.pathname, kind: 'Declared synthetic customer-session reset audit, locally fulfilled only.' });
            return route.fulfill({ status: 204 });
        }
        const expected = controls.expectedMutation;
        if (phase === 'after' && expected && method === expected.method && url.pathname === api.pathname + expected.suffix) {
            const payload = request.postDataJSON();
            const valid = expected.validate(payload) && controls.mutations.filter(item => item.case === expected.case).length < (expected.limit || 1);
            if (!valid) {
                driver.report.errors.push({ scenario: 'service mutation fixture', method, path: url.pathname, case: expected.case, message: 'Unexpected synthetic payload or duplicate request.' });
                return route.abort('blockedbyclient');
            }
            const entry = { method, path: url.pathname, payload, case: expected.case, mode: expected.mode || 'reject', outcome: expected.outcome || 'reject',
                kind: 'Actual controller mutation intercepted entirely locally; never upstream or staged.' };
            controls.mutations.push(entry); requests.push(entry);
            if (expected.mode === 'held') await new Promise(resolve => controls.heldMutations.push(resolve));
            if (expected.outcome === 'queued') {
                const names = ['idempotency-key', 'x-kiwi-change-id', 'x-kiwi-outbox-id', 'x-kiwi-outbox-revision', 'x-kiwi-customer-person-id', 'x-kiwi-customer-credential-key',
                    'x-kiwi-customer-source-system', 'x-kiwi-customer-division-id', 'x-kiwi-customer-mandant'];
                const pairs = await Promise.all(names.map(async name => [name, await request.headerValue(name)]));
                const headers = Object.fromEntries(pairs.filter(([, value]) => value !== null));
                try {
                    controls.queuedAck = buildServiceQueuedAck(controls.ackFixtures, expected.projectionCase || expected.case, payload, headers);
                } catch (error) {
                    driver.report.errors.push({ scenario: 'service queued acknowledgement fixture', case: expected.case, message: error.message });
                    return route.abort('blockedbyclient');
                }
                entry.ack = { changeId: controls.queuedAck.response.outbox.changeId,
                    preparedRequestChangeId: headers['x-kiwi-change-id'] ?? headers['idempotency-key'],
                    outboxNormalization: controls.queuedAck.outboxNormalization,
                    nonceReconciliation: controls.queuedAck.nonceReconciliation, projectionCase: controls.queuedAck.projectionCase };
                return route.fulfill({ status: 200, json: controls.queuedAck.response });
            }
            return route.fulfill({ status: 422, json: { error: { code: 'synthetic_service_rejected', message: 'Synthetic service request was rejected; retain this draft.' } } });
        }
        if (method === 'GET' && url.pathname === api.pathname + 'webabo/offers') {
            if (!['?limit=20', '?limit=250'].includes(url.search)) {
                driver.report.errors.push({ scenario: 'service fixture', message: 'Unexpected offers query', query: url.search });
                return route.abort('blockedbyclient');
            }
            const mode = phase === 'after' && url.search === '?limit=20' ? controls.offers.mode : 'normal';
            const entry = { method, path: url.pathname, query: url.search, mode, kind: 'Declared catalogue GET fixture, no upstream request.' };
            requests.push(entry);
            if (url.search === '?limit=20') controls.offers.requests.push(entry);
            if (mode === 'held') await new Promise(resolve => controls.offers.releases.push(resolve));
            if (mode === 'error') return route.fulfill({ status: 503, json: { error: {
                code: 'synthetic_provider_unavailable', message: 'Synthetic provider lookup failed; use the existing Back action to retry.' } } });
            if (mode === 'empty') return route.fulfill({ json: { items: [], total: 0 } });
            return route.fulfill({ json: { items: serviceOffers, total: serviceOffers.length } });
        }
        const cleanup = method === 'DELETE' && new RegExp('^' + api.pathname + 'addresses/sessions/[a-zA-Z0-9-]+$').test(url.pathname);
        if (cleanup) {
            requests.push({ method, path: url.pathname, kind: 'Local synthetic form-session cleanup, never upstream.' });
            return route.fulfill({ status: 204 });
        }
        return route.fallback();
    });
    return controls;
}

export async function prepareServiceCustomer(page, customer = serviceCustomer) {
    await page.evaluate(async customer => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const draftPath = Object.keys(imports).find(key => key.endsWith('/lightbox-drafts.js'));
        const { resetLightboxDrafts } = await import(imports[draftPath]);
        resetLightboxDrafts(document);
        window.kiwiLegacyCustomerSearchBridge.setCurrentCustomer(structuredClone(customer));
    }, customer);
}

export async function closeService(page, id) {
    await page.locator('#' + id + ' [data-action="close-form"]').first().press('Enter');
    await page.locator('#' + id).waitFor({ state: 'hidden' });
}

export async function observeService(page, driver, meta, state, id, target) {
    await page.locator(target || '#' + id + ' h2').first().scrollIntoViewIfNeeded();
    await driver.painted(page);
    const data = await page.evaluate(id => {
        const root = document.getElementById(id), card = root.querySelector('.card');
        const visible = node => Boolean(node.getClientRects().length) && getComputedStyle(node).visibility !== 'hidden';
        const read = node => { const r = node.getBoundingClientRect(), s = getComputedStyle(node);
            return { id: node.id, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
                padding: s.padding, radius: s.borderRadius, shadow: s.boxShadow, fontSize: s.fontSize, lineHeight: s.lineHeight,
                borderWidth: s.borderTopWidth, borderColor: s.borderTopColor, color: s.color, background: s.backgroundColor, overflow: node.scrollWidth > node.clientWidth + 1 }; };
        return { root: read(root), card: read(card), title: read(root.querySelector('h2')), viewport: { width: innerWidth, height: innerHeight },
            canvasBackground: getComputedStyle(document.body).backgroundColor,
            quietHoverBackground: getComputedStyle(root).getPropertyValue('--surface-quiet-hover').trim(),
            offers: [...root.querySelectorAll('.offer-card')].filter(visible).map(node => ({ ...read(node),
                checked: Boolean(node.querySelector('input:checked')), hovered: node.matches(':hover') })),
            documentWidth: document.documentElement.scrollWidth,
            steps: [...root.querySelectorAll('.winback-step')].filter(visible).map(node => node.id),
            fields: [...root.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(visible).map(node => ({ ...read(node),
                type: node.type, name: node.name, value: node.value, checked: node.checked, required: node.required,
                disabled: node.disabled, readonly: Boolean(node.readOnly), labels: [...(node.labels || [])].map(read), labelled: Boolean(node.labels?.length || node.getAttribute('aria-label') || node.getAttribute('aria-labelledby')) })),
            actions: [...root.querySelectorAll('button,[data-action="select-offer"]')].filter(visible).map(node => ({ ...read(node),
                tag: node.tagName, type: node.type, action: node.dataset.action, tabindex: node.tabIndex, text: node.textContent.trim() })),
            active: document.activeElement?.id || document.activeElement?.getAttribute('data-action') };
    }, id);
    driver.report.serviceEvidence.observations.push({ ...meta, state, id, data });
    if (phase === 'after') await (await import('./compose-smoke-theme-audit-service-acceptance.mjs')).checkServiceState(page, driver, meta, state, id, data);
    await driver.capture(page, (meta.native ? 'native-200' : phase) + '-service-' + state, undefined,
        'Actual service UI using declared synthetic customer/subscriptions/offers; ' + phase + '; ' + (meta.native ? 'Native layout/choice subset; no mutation or privacy repetition.' : phase === 'before' ? 'No baseline mutation submitted.' : 'Local controlled mutation outcomes are separately recorded; never forwarded upstream.'));
}

async function setServiceChoice(page, driver, meta, selector, checked = true) {
    const control = page.locator(selector);
    const nativeFirefox = meta.native && driver.report.environment.browser === 'firefox';
    if (!nativeFirefox) {
        if (checked) await control.check();
        else await control.uncheck();
        return;
    }
    const before = await control.isChecked();
    if (!await control.isVisible() || !await control.isEnabled()) throw new Error('Native Firefox choice must be visible and enabled: ' + selector);
    await control.focus();
    const focused = await control.evaluate(node => document.activeElement === node);
    driver.check('native Firefox choice setup focuses the actual native control', focused, true, { ...meta, selector }, 7);
    if (!focused) throw new Error('Native Firefox choice focus was not established: ' + selector);
    if (before !== checked) await page.keyboard.press('Space');
    const actual = await control.isChecked();
    driver.check('native Firefox keyboard choice setup reaches the declared checked state', actual, checked,
        { ...meta, selector, before, input: 'Actual focus and page.keyboard Space; no forced pointer or checked assignment.' }, 7);
    if (actual !== checked) throw new Error('Native Firefox keyboard choice did not reach its declared state: ' + selector);
}

export async function runServiceScenarios(page, driver, meta, controls) {
    if (suite === 'provider') {
        const { inspectServiceProvider } = await import('./compose-smoke-theme-audit-service-provider.mjs');
        await inspectServiceProvider(page, driver, meta, controls);
        return;
    }
    if (suite === 'winback') {
        driver.report.serviceEvidence.selectedCases = ['winback-accepted', 'winback-declined'];
        const { inspectWinbackCallbacks } = await import('./compose-smoke-theme-audit-service-acceptance.mjs');
        await inspectWinbackCallbacks(page, driver, meta, controls);
        return;
    }
    if (suite === 'complaint') {
        driver.report.serviceEvidence.selectedCases = ['complaint', 'complaint-retry'];
        const { inspectComplaintCallbacks } = await import('./compose-smoke-theme-audit-service-acceptance.mjs');
        await inspectComplaintCallbacks(page, driver, meta, controls);
        return;
    }
    await prepareServiceCustomer(page);
    await page.evaluate(() => window.editSubscription(990711));
    await page.locator('#editSubscriptionForm').waitFor({ state: 'visible' });
    await observeService(page, driver, meta, 'edit', 'editSubscriptionForm');
    await closeService(page, 'editSubscriptionForm');
    await page.evaluate(() => window.showResendMagazine());
    await page.locator('#resendSubscription').selectOption('990712');
    await observeService(page, driver, meta, 'resend', 'resendMagazineForm');
    await closeService(page, 'resendMagazineForm');
    await page.evaluate(() => window.showEditorialComplaintForm());
    await page.locator('#editorialComplaintMagazine').selectOption(serviceCustomer.subscriptions[1].magazine);
    await page.locator('#editorialComplaintDescription').fill('Synthetic long editorial note: preserve the full description, selected publication, follow-up choice and edition when this draft is reopened.');
    await setServiceChoice(page, driver, meta, '#editorialComplaintFollowup');
    await observeService(page, driver, meta, 'complaint', 'editorialComplaintForm');
    await closeService(page, 'editorialComplaintForm');
    await prepareServiceCustomer(page);
    await page.evaluate(() => window.kiwiWinbackSlice.cancelSubscription(990711));
    await observeService(page, driver, meta, 'reason', 'winbackFlow');
    await setServiceChoice(page, driver, meta, 'input[name="cancelReason"][value="price"]');
    await page.locator('#winbackStep1 [data-action="winback-next-step"]').press('Enter');
    await page.locator('#winbackStep2 .offer-card').first().waitFor({ state: 'visible' });
    if (phase === 'before') {
        await page.locator('#winbackFlow .form-header button').focus();
        const sequence = [];
        for (let index = 0; index < 5; index++) {
            await page.keyboard.press('Tab');
            sequence.push(await page.evaluate(() => ({ id: document.activeElement?.id, action: document.activeElement?.dataset?.action,
                offer: Boolean(document.activeElement?.closest('#winbackOffers .offer-card')) })));
        }
        driver.report.serviceEvidence.keyboardObservations.push({ ...meta, state: 'offers', kind: 'Actual Tab traversal from native header close; no forced offer focus.', sequence });
    }
    await observeService(page, driver, meta, 'offers', 'winbackFlow', '#winbackStep2 h3');
    const offer = page.locator('#winbackStep2 .offer-card').first();
    if (phase === 'before') await offer.click();
    else {
        const input = offer.locator('input[type=radio]');
        await page.locator('#winbackFlow .form-header button').focus();
        await page.keyboard.press('Tab');
        driver.check('native Tab from header reaches the first offer without forced input focus', await input.evaluate(node => document.activeElement === node), true, meta, 7);
        await page.keyboard.press('Space');
        driver.check('native offer Space updates checked selection without navigating or submitting', await input.isChecked() && await page.locator('#winbackStep2').isVisible() && controls.mutations.length === 0, true, meta, 7);
        const focus = await input.evaluate(node => {
            const rect = node.getBoundingClientRect();
            const ring = [node, node.closest('.offer-card')].some(element => { const css = getComputedStyle(element); return css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0; });
            return document.activeElement === node && ring && rect.x >= 0 && rect.right <= innerWidth && rect.y >= 0 && rect.bottom <= innerHeight;
        });
        driver.check('native selected offer focus has a visible unclipped outline', focus, true, meta, 7);
        if (!meta.native && meta.viewport.width >= 1000) await page.locator('#winbackStep2 .offer-card').nth(1).hover();
        await observeService(page, driver, meta, 'offers-selected-focus', 'winbackFlow', '#winbackStep2 .offer-card');
    }
    await page.locator('#winbackStep2 [data-arg-step="3"]').press('Enter');
    await setServiceChoice(page, driver, meta, 'input[name="winbackResult"][value="accepted"]');
    await observeService(page, driver, meta, 'confirmation', 'winbackFlow', '#winbackStep3 h3');
    await closeService(page, 'winbackFlow');
    await prepareServiceCustomer(page);
    await page.evaluate(() => window.kiwiWinbackSlice.cancelSubscription(990711));
    await setServiceChoice(page, driver, meta, 'input[name="cancelReason"][value="deceased"]');
    await page.locator('#winbackStep1 [data-action="winback-next-step"]').press('Enter');
    await observeService(page, driver, meta, 'deceased-choices', 'winbackFlow', '#winbackStep1b h3');
    for (const [branch, selections, step] of [
        ['refund', ['cancel_refund', 'cancel_refund'], '1c'],
        ['transfer', ['transfer', 'transfer'], '1d'],
        ['combined', ['transfer', 'cancel_refund'], '1e']
    ]) {
        for (const [index, value] of selections.entries()) await setServiceChoice(page, driver, meta, 'input[name="action_' + serviceCustomer.subscriptions[index].id + '"][value="' + value + '"]');
        await page.locator('#winbackStep1b [data-action="process-deceased-subscriptions"]').press('Enter');
        await page.locator('#winbackStep' + step).waitFor({ state: 'visible' });
        if (branch === 'refund') {
            await page.locator('#refundEmail').fill('synthetic.refund07@example.invalid');
            await page.locator('#refundNotes').fill('Synthetic long refund notes with retained contact and account context.');
        } else {
            const prefix = branch === 'combined' ? 'transfer2' : 'transfer';
            await page.locator('#' + prefix + 'Initials').fill('S.');
            await page.locator('#' + prefix + 'LastName').fill('Synthetic Long Transfer Recipient Name');
            await page.locator('#' + prefix + 'Email').fill('synthetic.transfer07@example.invalid');
            await setServiceChoice(page, driver, meta, '#' + prefix + 'SameAddress');
            if (branch === 'combined') {
                await page.locator('#refundEmail2').fill('synthetic.refund07@example.invalid');
                await page.locator('#refundNotes2').fill('Synthetic long combined refund notes remain independent of transfer details.');
            }
        }
        await observeService(page, driver, meta, branch + '-top', 'winbackFlow', '#winbackStep' + step + ' h3');
        await observeService(page, driver, meta, branch + '-actions', 'winbackFlow', '#winbackStep' + step + ' [data-action="complete-all-deceased-actions"]');
        await page.locator('#winbackStep' + step + ' [data-arg-step="1b"]').press('Enter');
    }
    await closeService(page, 'winbackFlow');
    await prepareServiceCustomer(page);
    await page.evaluate(() => window.kiwiWinbackSlice.revertRestitution(990713));
    await page.locator('#restitutionTransferFirstName').fill('Synthetic');
    await page.locator('#restitutionTransferLastName').fill('Long Restitution Recipient Name');
    await observeService(page, driver, meta, 'restitution-same', 'restitutionTransferForm');
    await setServiceChoice(page, driver, meta, '#restitutionTransferSameAddress', false);
    await observeService(page, driver, meta, 'restitution-different', 'restitutionTransferForm', '#restitutionTransferPostalCode');
    await closeService(page, 'restitutionTransferForm');
    if (phase === 'after' && !meta.native && meta.viewport.width >= 1000) await (await import('./compose-smoke-theme-audit-service-acceptance.mjs')).inspectServiceInteractions(page, driver, meta, controls);
}

export async function inspectService(driver, viewport, contract) {
    driver = { ...driver, contract };
    const meta = { viewport, locale: 'nl', phase };
    await prepareServiceEvidence(driver);
    const context = await driver.newContext(viewport), page = await context.newPage();
    page.setDefaultTimeout(12000);
    const finishCss = driver.trackStylesheets(page, meta), finishBehavior = await trackServiceBehavior(page, driver, meta);
    page.on('pageerror', error => driver.report.errors.push({ scenario: 'service runtime', viewport, message: error.message }));
    let controls;
    try {
        controls = await installServiceFixtures(page, driver); await driver.login(page);
        driver.check('actual service locale', await page.locator('html').getAttribute('lang'), 'nl', meta, 7);
        await runServiceScenarios(page, driver, meta, controls);
    } catch (error) {
        driver.report.errors.push({ scenario: 'service setup', viewport, message: error.message });
        await driver.capture(page, 'service-failure', undefined, 'Incomplete service setup, retained failure.').catch(() => {});
    } finally {
        releaseServiceFixtures(controls);
        await finishBehavior(); await finishCss(); await context.close(); await driver.saveReport();
    }
}

export async function prepareServiceEvidence(driver) {
    driver.report.serviceEvidence ||= { companion: { path: modulePath, sha256: hash(await readFile(modulePath)) },
        scope: phase === 'before' ? 'Finite service family/conditional branch observation. BEFORE counters prove source/locale, not design acceptance. No baseline submission.' : suite === 'provider' ? 'Finite winback GET20 held/empty/error/recovery probe; GET250 stays immediate. No service mutation or backend availability policy claim.' : 'Scoped actual service layout and controlled local interactions; independent visual acceptance required, fixtures do not validate upstream policy.',
        customer: serviceCustomer, offers: serviceOffers, fixtureRequests: [], loadedBehavior: [], observations: [], keyboardObservations: [] };
}

export function releaseServiceFixtures(controls) {
    controls?.heldMutations.splice(0).forEach(resolve => resolve());
    controls?.offers.releases.splice(0).forEach(resolve => resolve());
}
