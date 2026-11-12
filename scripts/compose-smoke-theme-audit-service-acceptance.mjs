import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionInputPixelProof } from './compose-smoke-theme-audit-customer-acceptance.mjs';
import { fileURLToPath } from 'node:url';
import { serviceCustomer, serviceOffers, prepareServiceCustomer, closeService, observeService } from './compose-smoke-theme-audit-service.mjs';

const modulePath = fileURLToPath(import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keysEqual = (actual, expected) => equal(Object.keys(actual).sort(), Object.keys(expected).sort());
const objectEqual = (actual, expected) => keysEqual(actual, expected) && Object.keys(expected).every(key => actual[key] === expected[key]);
const near = (a, b) => Math.abs(parseFloat(a) - parseFloat(b)) <= 1;
const inside = (node, parent) => node.x >= parent.x - 1 && node.right <= parent.right + 1;

async function register(driver) {
    driver.report.serviceAcceptance ||= { module: { path: modulePath, sha256: hash(await readFile(modulePath)) }, states: [], interactions: [], privacy: [] };
}

export async function checkServiceState(page, driver, meta, state, id, data) {
    await register(driver);
    const check = (name, value, detail = data) => driver.check(name, value, true, { ...meta, state, detail }, 7);
    check('service card and visible controls remain horizontally contained', data.documentWidth <= data.viewport.width + 1
        && data.card.x >= -1 && data.card.right <= data.viewport.width + 1 && !data.card.overflow
        && data.fields.every(field => inside(field, data.card)) && data.actions.every(action => inside(action, data.card)));
    check('service uses the flat reference surface and shared insets/title', data.card.radius === '0px' && data.card.shadow === 'none'
        && near(data.card.padding, data.viewport.width <= 768 ? 16 : 20)
        && near(data.title.fontSize, driver.contract.subscriptionTitle.fontSize));
    const textFields = data.fields.filter(field => !['checkbox', 'radio'].includes(field.type));
    check('service fields retain persistent labels and standard text/control geometry', textFields.every(field => field.labelled
        && field.height >= 39 && near(field.fontSize, driver.contract.subscriptionInput.fontSize)
        && field.labels.every(label => near(label.fontSize, driver.contract.subscriptionCaption.fontSize))));
    check('service native choices remain visible and keyboard reachable', data.fields.filter(field => ['checkbox', 'radio'].includes(field.type))
        .every(field => field.width >= 18 && field.height >= 18 && field.labelled));
    if (data.offers.length) {
        check('actual offer wrappers retain the measured square reference choice shape', data.offers.every(offer => offer.radius === driver.contract.choice.borderRadius
            && offer.shadow === 'none'), { offers: data.offers, reference: driver.contract.choice });
        const checked = data.offers.find(offer => offer.checked), hovered = data.offers.find(offer => !offer.checked && offer.hovered);
        if (checked && hovered) check('unchecked offer hover uses the declared quiet hover token and remains distinct from the checked selection', Boolean(data.quietHoverBackground)
            && hovered.background === data.quietHoverBackground && hovered.background !== checked.background,
        { checked, hovered, quietHoverBackground: data.quietHoverBackground });
    }
    if (id === 'restitutionTransferForm') check('restitution recipient identity fields have usable intrinsic width', data.fields
        .filter(field => ['restitutionTransferFirstName', 'restitutionTransferLastName'].includes(field.id)).every(field => field.width >= 120));
    const step = data.steps[0];
    if (step) {
        const current = await page.evaluate(() => {
            const indicator = document.querySelector('#winbackFlow .steps-indicator');
            return { visible: Boolean(indicator.getClientRects().length) && getComputedStyle(indicator).visibility !== 'hidden',
                current: [...indicator.querySelectorAll('[aria-current="step"]')].map(node => node.dataset.step) };
        });
        const ordinary = /^winbackStep[123]$/.test(step);
        check('step presentation matches the actual ordinary or deceased branch', ordinary
            ? current.visible && current.current.includes(step.slice(-1)) : !current.visible, current);
    }
    driver.report.serviceAcceptance.states.push({ ...meta, state, id, data });
}

async function settleToasts(page) {
    await page.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 10000 });
}

async function fieldsSnapshot(page, root) {
    return page.locator(root).evaluate(node => [...node.querySelectorAll('input,select,textarea')].map(field => ({
        id: field.id, name: field.name, value: field.value, checked: field.checked, selectedIndex: field.selectedIndex,
        required: field.required, readonly: Boolean(field.readOnly), disabled: field.disabled })));
}

async function waitForNodeCondition(condition) {
    const deadline = Date.now() + 5000;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('Expected locally intercepted service request did not arrive.');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

async function resetServiceCase(page, controls) {
    controls.expectedMutation = null;
    controls.queuedAck = null;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.kiwiCustomerDetailSlice && window.kiwiCustomerWorkSession);
    await prepareServiceCustomer(page);
    await page.evaluate(() => window.kiwiCustomerDetailSlice.selectCustomer(990701));
}

async function pendingState(page, id) {
    return page.locator('#' + id).evaluate(root => {
        const visible = node => Boolean(node.getClientRects().length) && getComputedStyle(node).visibility !== 'hidden';
        const commits = [...root.querySelectorAll('[data-service-commit]')];
        return {
            commits: commits.map(button => ({ disabled: button.disabled, busy: button.getAttribute('aria-busy') })),
            statuses: [...root.querySelectorAll('[data-service-status]')].filter(visible).map(node => ({
                text: node.textContent.trim(), role: node.getAttribute('role'), live: node.getAttribute('aria-live') })),
            navigation: [...root.querySelectorAll('[data-action=close-form],[data-action=winback-prev-step]')].filter(visible).map(button => ({ action: button.dataset.action, disabled: button.disabled }))
        };
    });
}

function processingText(test) {
    if (test.id === 'editSubscriptionForm') return 'Wijzigingen opslaan…';
    if (test.id === 'resendMagazineForm') return 'Editie aanvragen…';
    if (test.id === 'editorialComplaintForm') return 'Redactie-item registreren…';
    if (test.id === 'restitutionTransferForm') return 'Overdracht verwerken…';
    return test.case.startsWith('deceased-') ? 'Abonnementen verwerken…' : 'Resultaat verwerken…';
}

async function reopenService(page, id) {
    await page.evaluate(id => {
        if (id === 'editSubscriptionForm') window.editSubscription(990711);
        else if (id === 'resendMagazineForm') window.showResendMagazine();
        else if (id === 'editorialComplaintForm') window.showEditorialComplaintForm();
        else if (id === 'winbackFlow') window.kiwiWinbackSlice.showWinbackFlow();
        else window.kiwiWinbackSlice.showRestitutionTransferForm(window.kiwiLegacyCustomerSearchBridge.getCurrentCustomer().subscriptions.find(item => item.id === 990713));
    }, id);
    await page.locator('#' + id).waitFor({ state: 'visible' });
}

async function invokeDuplicate(page, test) {
    await page.evaluate(id => {
        if (id === 'editSubscriptionForm') return window.saveSubscriptionEdit();
        if (id === 'resendMagazineForm') return window.resendMagazine();
        if (id === 'editorialComplaintForm') return window.submitEditorialComplaint();
        if (id === 'restitutionTransferForm') return window.kiwiWinbackSlice.completeRestitutionTransfer();
        return document.querySelector('#winbackStep3').getClientRects().length
            ? window.kiwiWinbackSlice.completeWinback() : window.kiwiWinbackSlice.completeAllDeceasedActions();
    }, test.id);
}

function containsProjection(actual, expected) {
    if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => containsProjection(actual[index], value));
    if (expected && typeof expected === 'object') return actual && typeof actual === 'object' && Object.keys(expected).every(key => containsProjection(actual[key], expected[key]));
    return actual === expected;
}

async function exerciseActualAction(page, driver, meta, controls, test) {
    await settleToasts(page);
    const outcome = test.outcome || 'queued';
    if (outcome === 'queued' && !controls.ackFixtures) throw new Error('Explicit reviewed source-derived queued fixtures are required for successful callback checks.');
    const before = await fieldsSnapshot(page, '#' + test.id), count = controls.mutations.length;
    controls.expectedMutation = { ...test, outcome, mode: test.held ? 'held' : 'immediate' };
    await test.action();
    await waitForNodeCondition(() => controls.mutations.length > count);
    const entry = controls.mutations.at(-1);
    if (test.held) {
        const pending = await pendingState(page, test.id);
        driver.report.serviceAcceptance.interactions.push({ ...meta, case: test.case, state: 'held', pending,
            boundary: 'Actual local per-form owner and visible announcement; no global backend lock or persistence claim.' });
        const cue = data => data.commits.length > 0 && data.commits.every(button => button.disabled && button.busy === 'true')
            && data.statuses.length > 0 && data.statuses.every(status => status.text === processingText(test) && status.role === 'status' && status.live === 'polite')
            && data.navigation.every(button => !button.disabled);
        driver.check('held service commit has truthful visible progress, busy commit controls and available navigation', cue(pending), true, { ...meta, case: test.case, pending }, 7);
        driver.check('held service request preserves the entered draft', equal(await fieldsSnapshot(page, '#' + test.id), before), true, { ...meta, case: test.case }, 7);
        const commit = page.locator('#' + test.id + ' [data-service-commit]:visible').first();
        await commit.scrollIntoViewIfNeeded();
        const box = await commit.boundingBox();
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const unobscured = await commit.evaluate((button, point) => {
            const hit = document.elementFromPoint(point.x, point.y);
            return hit === button || button.contains(hit);
        }, point);
        driver.check('pending commit center remains an actual unobscured pointer target', unobscured, true, { ...meta, case: test.case, point }, 7);
        if (!unobscured) throw new Error('Pending commit pointer center is obscured; no forced click is permitted.');
        const errors = driver.report.errors.length;
        await page.mouse.click(point.x, point.y);
        await invokeDuplicate(page, test);
        driver.check('physical disabled control and direct controller retry do not duplicate a pending service request', controls.mutations.length === count + 1
            && driver.report.errors.length === errors && cue(await pendingState(page, test.id)), true, { ...meta, case: test.case }, 7);
        if (test.case === 'winback-accepted') {
            await page.locator('#winbackStep3 [data-action=winback-prev-step]').press('Enter');
            await page.locator('#winbackStep2 input[name=winbackOffer]:checked').waitFor({ state: 'visible' });
            await page.locator('#winbackStep2 [data-arg-step="3"]').press('Enter');
            driver.check('Back provider reload and Present preserve the independent pending final commit', cue(await pendingState(page, test.id))
                && controls.mutations.length === count + 1 && equal(await fieldsSnapshot(page, '#' + test.id), before), true, { ...meta, case: test.case }, 7);
        }
        await closeService(page, test.id); await reopenService(page, test.id);
        driver.check('close and reopen retain the same pending owner and entered draft', equal(await fieldsSnapshot(page, '#' + test.id), before)
            && cue(await pendingState(page, test.id)) && controls.mutations.length === count + 1, true, { ...meta, case: test.case }, 7);
        await observeService(page, driver, meta, test.case + '-held', test.id, test.target);
        if (meta.viewport.width < 1000) {
            const layout = await page.locator('#' + test.id).evaluate(root => {
                const nodes = [...root.querySelectorAll('[data-service-status], .form-actions')].filter(node => node.getClientRects().length);
                return nodes.map(node => { const box = node.getBoundingClientRect();
                    return { kind: node.hasAttribute('data-service-status') ? 'status' : 'actions',
                        contained: box.x >= 0 && box.right <= innerWidth && box.y >= 0 && box.bottom <= innerHeight,
                        textFits: node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1 }; });
            });
            driver.check('narrow pending status and action row remain visible without clipping', layout.some(node => node.kind === 'status')
                && layout.some(node => node.kind === 'actions') && layout.every(node => node.contained && node.textFits), true, { ...meta, case: test.case, layout }, 7);
        }
        controls.heldMutations.splice(0).forEach(resolve => resolve());
    }
    await page.locator('.toast.show').waitFor({ state: 'visible' });
    await driver.painted(page);
    driver.check('actual service controller sends the declared existing branch payload once', controls.mutations.length === count + 1
        && test.validate(entry.payload), true, { ...meta, case: test.case, entry }, 7);
    if (outcome === 'queued') {
        await page.locator('#' + test.id).waitFor({ state: 'hidden' });
        await page.waitForFunction(() => window.kiwiLegacyCustomerSearchBridge.getCurrentCustomer()?.provisional === true);
        await page.waitForFunction(id => [...document.getElementById(id).querySelectorAll('[data-service-status]')].every(node => !node.textContent.trim())
            && [...document.getElementById(id).querySelectorAll('[data-service-commit]')].every(node => !node.disabled && !node.hasAttribute('aria-busy')), test.id);
        const current = await page.evaluate(() => window.kiwiLegacyCustomerSearchBridge.getCurrentCustomer());
        const notice = await page.locator('.toast.show').textContent();
        driver.check('successful local acknowledgement closes its form and reloads the source-derived provisional customer', containsProjection(current, controls.queuedAck.customer)
            && Number(current.id) === 990701, true, { ...meta, case: test.case, current, expectedCustomer: controls.queuedAck.customer }, 7);
        driver.check('successful local acknowledgement is visibly queued rather than claimed processed', notice.includes('outbox') && notice.includes('Nog niet verwerkt'),
            true, { ...meta, case: test.case, notice }, 7);
        driver.check('queued change identifiers match the actual prepared request', entry.ack.preparedRequestChangeId === entry.ack.changeId
            && entry.ack.changeId === controls.queuedAck.response.outbox.changes[0].id,
            true, { ...meta, case: test.case, ack: entry.ack }, 7);
        driver.report.serviceAcceptance.interactions.push({ ...meta, case: test.case, state: 'queued', entry,
            boundary: 'Real frontend success callback on a local source-derived provisional acknowledgement; no database or upstream persistence.' });
        await driver.capture(page, 'service-' + test.case + '-queued', undefined, 'Actual callback closes the service form and displays the provisional outbox notice; local fixture only.');
        controls.expectedMutation = null;
        return entry.payload;
    }
    driver.check('local service rejection retains the same form data and active branch', equal(await fieldsSnapshot(page, '#' + test.id), before)
        && await page.locator('#' + test.id).isVisible(), true, { ...meta, case: test.case }, 7);
    driver.report.serviceAcceptance.interactions.push({ ...meta, case: test.case, state: 'rejected', entry });
    if (meta.viewport.width < 1000) {
        const errorNotice = await page.locator('.toast.show').evaluate(node => {
            const box = node.getBoundingClientRect();
            return { text: node.textContent, error: node.classList.contains('error'),
                contained: box.x >= 0 && box.right <= innerWidth && box.y >= 0 && box.bottom <= innerHeight,
                textFits: node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1 };
        });
        const retry = await pendingState(page, test.id);
        driver.check('narrow rejected service shows its complete error and restores retry controls', errorNotice.error
            && errorNotice.text === 'Synthetic service request was rejected; retain this draft.' && errorNotice.contained && errorNotice.textFits
            && retry.commits.length > 0 && retry.commits.every(button => !button.disabled && button.busy === null)
            && retry.statuses.every(status => !status.text), true, { ...meta, case: test.case, errorNotice, retry }, 7);
        await driver.capture(page, 'service-' + test.case + '-visible-error', undefined, 'Actual320px rejected complaint with visible error; locally fulfilled422, no business persistence.');
    }
    await settleToasts(page);
    await observeService(page, driver, meta, test.case + '-rejected', test.id, test.target);
    controls.expectedMutation = null;
    return entry.payload;
}

async function startWinback(page, driver, controls) {
    if (driver && controls) await resetServiceCase(page, controls);
    else await prepareServiceCustomer(page);
    await page.evaluate(() => {
        for (const name of ['cancelReason', 'winbackResult']) document.querySelectorAll('input[name="' + name + '"]').forEach(input => { input.checked = false; });
        window.kiwiWinbackSlice.cancelSubscription(990711);
    });
}

async function enterOffers(page) {
    await page.locator('input[name="cancelReason"][value="price"]').press('Space');
    await page.locator('#winbackStep1 [data-arg-step="2"]').press('Enter');
    await page.locator('#winbackStep2 .offer-card input[type=radio]').first().waitFor({ state: 'visible' });
}

async function chooseOffer(page, driver, meta, controls) {
    const first = page.locator('#winbackOffers .offer-card input[type=radio]').first();
    const second = page.locator('#winbackOffers .offer-card input[type=radio]').nth(1);
    const before = controls.mutations.length;
    await page.locator('#winbackFlow .form-header button').focus(); await page.keyboard.press('Tab');
    driver.check('native service Tab reaches the first offer in sequential order', await first.evaluate(node => document.activeElement === node), true, meta, 7);
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
    driver.check('native offer Arrow navigation updates exclusive checked selection without navigation or submission', await second.isChecked()
        && !await first.isChecked() && await page.locator('#winbackStep2').isVisible() && controls.mutations.length === before, true, meta, 7);
    await page.evaluate(offer => {
        const card = [...document.querySelectorAll('#winbackOffers .offer-card')].find(node => node.dataset.argOfferId === offer.offerId
            || node.querySelector('input')?.dataset.argOfferId === offer.offerId || node.querySelector('input')?.value === offer.offerId);
        window.kiwiWinbackSlice.selectOffer(offer.offerId, offer.title, offer.description, card);
    }, serviceOffers[0]);
    driver.check('programmatic offer compatibility keeps the native checked selection aligned', await first.isChecked() && !await second.isChecked(), true, meta, 7);
    await page.locator('#winbackStep2 [data-arg-step="3"]').press('Enter');
    driver.check('actual offer state builds the selected script with unchanged title and description',
        (await page.locator('#winbackScript').textContent()).includes(serviceOffers[0].title)
        && (await page.locator('#winbackScript').textContent()).includes(serviceOffers[0].description), true, meta, 7);
    const script = await page.locator('#winbackScript').textContent();
    await page.locator('#winbackStep3 [data-action=winback-prev-step]').press('Enter');
    await page.locator('#winbackStep2 .offer-card input[type=radio]').first().waitFor({ state: 'visible' });
    driver.check('actual Back regenerates offers with the retained exclusive selection', await first.isChecked() && !await second.isChecked() && controls.mutations.length === before, true, meta, 7);
    await page.locator('#winbackStep2 [data-arg-step="3"]').press('Enter');
    driver.check('returning from Back retains the selected script and does not submit', await page.locator('#winbackScript').textContent() === script && controls.mutations.length === before, true, meta, 7);
}

async function enterDeceased(page, branch, driver, meta, controls) {
    await startWinback(page, driver, controls);
    await page.locator('input[name="cancelReason"][value="deceased"]').press('Space');
    await page.locator('#winbackStep1 [data-arg-step="2"]').press('Enter');
    if (branch === 'refund') {
        const count = controls.mutations.length;
        await page.locator('#winbackStep1b [data-action=process-deceased-subscriptions]').press('Enter');
        await page.locator('.toast.show').waitFor({ state: 'visible' });
        driver.check('deceased processing requires an action for each active subscription', await page.locator('#winbackStep1b').isVisible() && controls.mutations.length === count, true, meta, 7);
        await settleToasts(page);
    }
    const selections = branch === 'refund' ? ['cancel_refund', 'cancel_refund'] : branch === 'transfer' ? ['transfer', 'transfer'] : ['transfer', 'cancel_refund'];
    for (const [index, value] of selections.entries()) await page.locator('input[name="action_' + serviceCustomer.subscriptions[index].id + '"][value="' + value + '"]').press('Space');
    await page.locator('#winbackStep1b [data-action="process-deceased-subscriptions"]').press('Enter');
    return { step: branch === 'refund' ? '1c' : branch === 'transfer' ? '1d' : '1e', prefix: branch === 'combined' ? 'transfer2' : 'transfer' };
}

async function fillTransfer(page, prefix) {
    const fields = { Initials: 'S.Q.', MiddleName: 'van', LastName: 'Synthetic Private Recipient07',
        Email: 'private.transfer07@example.invalid', Phone: '0209462718' };
    for (const [suffix, value] of Object.entries(fields)) await page.locator('#' + prefix + suffix).fill(value);
    await page.locator('#' + prefix + 'BirthdayDay').selectOption('28');
    await page.locator('#' + prefix + 'BirthdayMonth').selectOption('12');
    await page.locator('#' + prefix + 'BirthdayYear').selectOption('1980');
    await page.locator('#' + prefix + 'SameAddress').check();
}

const transferExpected = { salutation: 'Dhr.', firstName: 'S.Q.', middleName: 'van', lastName: 'Synthetic Private Recipient07', birthday: '1980-12-28',
    email: 'private.transfer07@example.invalid', phone: '0209462718', postalCode: serviceCustomer.postalCode, houseNumber: serviceCustomer.houseNumber,
    address: serviceCustomer.address, city: serviceCustomer.city, houseNumberAddition: serviceCustomer.houseNumberAddition, addressExtension: serviceCustomer.addressExtension };
const refundExpected = { email: 'private.refund07@example.invalid', notes: 'Synthetic private refund note07 with retained payment/contact context.' };

export async function inspectComplaintCallbacks(page, driver, meta, controls) {
    await register(driver);
    await resetServiceCase(page, controls);
    await page.evaluate(() => window.showEditorialComplaintForm());
    const complaintExpected = { magazine: 'Avrobode', type: 'klacht', category: 'inhoud', description: 'Synthetic private editorial note07: retain this complete complaint and follow-up choice.', edition: 'Synthetic edition07', followup: true };
    await page.locator('#editorialComplaintMagazine').selectOption(complaintExpected.magazine);
    await page.locator('#editorialComplaintDescription').fill(complaintExpected.description);
    await page.locator('#editorialComplaintEdition').fill(complaintExpected.edition); await page.locator('#editorialComplaintFollowup').check();
    const complaintTest = { case: 'complaint', id: 'editorialComplaintForm', method: 'POST', suffix: 'persons/990701/editorial-complaints', held: true, limit: 2,
        validate: payload => objectEqual(payload, complaintExpected), action: () => page.locator('[data-action=submit-editorial-complaint]').press('Enter'), target: '#editorialComplaintForm .form-actions' };
    await exerciseActualAction(page, driver, meta, controls, { ...complaintTest, outcome: 'reject' });
    const firstComplaint = controls.mutations.at(-1).payload;
    const retryComplaint = await exerciseActualAction(page, driver, meta, controls, { ...complaintTest, case: 'complaint-retry', projectionCase: 'complaint', held: false });
    driver.check('explicit complaint retry preserves the complete rejected payload', objectEqual(firstComplaint, retryComplaint), true, meta, 7);
}

export async function inspectWinbackCallbacks(page, driver, meta, controls) {
    await register(driver);
    for (const result of ['accepted', 'declined']) {
        await startWinback(page, driver, controls);
        const initialCount = controls.mutations.length;
        await page.locator('#winbackStep1 [data-arg-step="2"]').press('Enter');
        await page.locator('.toast.show').waitFor({ state: 'visible' });
        driver.check('winback requires a reason before advancing', await page.locator('#winbackStep1').isVisible() && controls.mutations.length === initialCount, true, { ...meta, result }, 7);
        await settleToasts(page); await enterOffers(page);
        await page.locator('#winbackStep2 [data-arg-step="3"]').press('Enter');
        await page.locator('.toast.show').waitFor({ state: 'visible' });
        driver.check('winback requires a selected offer before confirmation', await page.locator('#winbackStep2').isVisible() && controls.mutations.length === initialCount, true, { ...meta, result }, 7);
        await settleToasts(page); await chooseOffer(page, driver, meta, controls);
        await page.locator('[data-action=complete-winback]').press('Enter');
        await page.locator('.toast.show').waitFor({ state: 'visible' });
        driver.check('winback requires an explicit result before mutation', await page.locator('#winbackStep3').isVisible() && controls.mutations.length === initialCount, true, { ...meta, result }, 7);
        await settleToasts(page); await page.locator('input[name=winbackResult][value=' + result + ']').press('Space');
        await exerciseActualAction(page, driver, meta, controls, { case: 'winback-' + result, id: 'winbackFlow', method: 'POST', suffix: 'subscriptions/990701/990711', held: true,
            validate: payload => keysEqual(payload, { result, offer: null }) && payload.result === result && objectEqual(payload.offer, { id: serviceOffers[0].offerId, title: serviceOffers[0].title, description: serviceOffers[0].description }),
            action: () => page.locator('[data-action=complete-winback]').press('Enter'), target: '#winbackStep3 .form-actions' });
    }
}

export async function inspectServiceInteractions(page, driver, meta, controls) {
    await register(driver);
    const { inspectServiceProvider } = await import('./compose-smoke-theme-audit-service-provider.mjs');
    await inspectServiceProvider(page, driver, meta, controls);
    await resetServiceCase(page, controls);
    driver.check('actual customer work session owns the declared synthetic service customer', Number(await page.evaluate(() => window.kiwiCustomerWorkSession.getRequestContext()?.customerReference?.personId)) === 990701, true, meta, 7);
    await page.evaluate(() => window.editSubscription(990711));
    await page.locator('#editSubMagazine').selectOption('Mikrogids');
    await page.locator('#editSubDuration').selectOption('3-jaar');
    await page.locator('#editSubStatus').selectOption('paused');
    const nativeEditValid = await page.locator('#subscriptionEditForm').evaluate(form => form.checkValidity());
    const invalidEditCount = controls.mutations.length;
    await page.locator('#editSubStartDate').fill(''); await page.locator('#subscriptionEditForm button[type=submit]').press('Enter');
    driver.check('native required edit fields block submission independently of hidden service branches', nativeEditValid && !await page.locator('#subscriptionEditForm').evaluate(form => form.checkValidity()) && controls.mutations.length === invalidEditCount, true, meta, 7);
    await page.locator('#editSubStartDate').fill('2025-03-12'); await page.locator('#editSubStartDate').press('Tab');
    const editExpected = { magazine: 'Mikrogids', duration: '3-jaar', startDate: '2025-03-12', status: 'paused' };
    await exerciseActualAction(page, driver, meta, controls, { case: 'edit', id: 'editSubscriptionForm', method: 'PATCH', suffix: 'subscriptions/990701/990711', held: true,
        validate: payload => objectEqual(payload, editExpected), action: () => page.locator('#subscriptionEditForm button[type=submit]').press('Enter'), target: '#subscriptionEditForm .form-actions' });
    await resetServiceCase(page, controls);
    await page.evaluate(() => window.showResendMagazine());
    const countBeforeInvalid = controls.mutations.length;
    await page.locator('#resendSubscription').selectOption('');
    await page.locator('[data-action=resend-magazine]').press('Enter');
    await page.locator('.toast.show').waitFor({ state: 'visible' });
    driver.check('resend requires a selected subscription before any API mutation', controls.mutations.length === countBeforeInvalid && await page.locator('#resendMagazineForm').isVisible(), true, meta, 7);
    await settleToasts(page);
    await page.locator('#resendSubscription').selectOption('990711'); await page.locator('#resendReason').selectOption('damaged');
    await exerciseActualAction(page, driver, meta, controls, { case: 'resend', id: 'resendMagazineForm', method: 'POST', suffix: 'subscriptions/990701/990711/complaint', held: true,
        validate: payload => objectEqual(payload, { reason: 'damaged' }), action: () => page.locator('[data-action=resend-magazine]').press('Enter'), target: '#resendMagazineForm .form-actions' });
    await inspectComplaintCallbacks(page, driver, meta, controls);
    await inspectWinbackCallbacks(page, driver, meta, controls);
    for (const branch of ['refund', 'transfer', 'combined']) {
        const { step, prefix } = await enterDeceased(page, branch, driver, meta, controls);
        if (branch !== 'refund') await fillTransfer(page, prefix);
        if (branch !== 'transfer') {
            const suffix = branch === 'combined' ? '2' : '';
            await page.locator('#refundEmail' + suffix).fill(refundExpected.email); await page.locator('#refundNotes' + suffix).fill(refundExpected.notes);
        }
        if (branch !== 'refund') {
            const validAddress = await page.evaluate(step => window.kiwiAddressCompletion.validate(document.getElementById('winbackStep' + step)), step);
            driver.check('actual shared address controller confirms the synthetic service address before submission', validAddress, true, { ...meta, branch }, 7);
        }
        if (branch === 'combined') await inspectServicePrivacy(page, driver, meta);
        const invalidField = branch === 'refund' ? '#refundEmail' : '#' + prefix + 'Email';
        const validEmail = branch === 'refund' ? refundExpected.email : transferExpected.email;
        const invalidCount = controls.mutations.length;
        await page.locator(invalidField).fill('invalid07');
        await page.locator('#winbackStep' + step + ' [data-action=complete-all-deceased-actions]').press('Enter');
        await page.locator('.toast.show').waitFor({ state: 'visible' });
        driver.check('deceased branch rejects invalid recipient/refund email without a service mutation', controls.mutations.length === invalidCount && await page.locator('#winbackStep' + step).isVisible(), true, { ...meta, branch }, 7);
        await page.locator(invalidField).fill(validEmail); await settleToasts(page);
        const validate = payload => {
            if (!keysEqual(payload, { actions: [] }) || !Array.isArray(payload.actions) || payload.actions.length !== 2) return false;
            const transferIds = branch === 'refund' ? [] : branch === 'transfer' ? [990711, 990712] : [990711];
            const refundIds = branch === 'transfer' ? [] : branch === 'refund' ? [990711, 990712] : [990712];
            return payload.actions.every((action, index) => index < transferIds.length
                ? keysEqual(action, { subscriptionId: 0, action: '', transferData: {} }) && action.subscriptionId === transferIds[index] && action.action === 'transfer' && objectEqual(action.transferData, transferExpected)
                : keysEqual(action, { subscriptionId: 0, action: '', refundData: {} }) && action.subscriptionId === refundIds[index - transferIds.length] && action.action === 'cancel_refund' && objectEqual(action.refundData, refundExpected));
        };
        await exerciseActualAction(page, driver, meta, controls, { case: 'deceased-' + branch, id: 'winbackFlow', method: 'POST', suffix: 'subscriptions/990701/deceased-actions', held: true,
            validate, action: () => page.locator('#winbackStep' + step + ' [data-action=complete-all-deceased-actions]').press('Enter'), target: '#winbackStep' + step + ' .form-actions' });
    }
    await resetServiceCase(page, controls); await page.evaluate(() => window.kiwiWinbackSlice.revertRestitution(990713));
    const restitution = { salutation: 'Dhr.', firstName: 'Synthetic', middleName: 'van', lastName: 'Private Restitution Recipient07', email: 'private.restitution07@example.invalid', phone: '0209462718',
        postalCode: serviceCustomer.postalCode, houseNumber: serviceCustomer.houseNumber, houseNumberAddition: serviceCustomer.houseNumberAddition,
        addressExtension: serviceCustomer.addressExtension, address: serviceCustomer.address, city: serviceCustomer.city };
    for (const [suffix, value] of Object.entries({ FirstName: restitution.firstName, MiddleName: restitution.middleName, LastName: restitution.lastName, Email: restitution.email, Phone: restitution.phone })) await page.locator('#restitutionTransfer' + suffix).fill(value);
    await exerciseActualAction(page, driver, meta, controls, { case: 'restitution-transfer', id: 'restitutionTransferForm', method: 'POST', suffix: 'subscriptions/990701/990713/restitution-transfer', held: true,
        validate: payload => keysEqual(payload, { transferData: {} }) && typeof payload.transferData.formSessionId === 'string' && /^[a-f0-9-]{36}$/.test(payload.transferData.formSessionId)
            && objectEqual(Object.fromEntries(Object.entries(payload.transferData).filter(([key]) => key !== 'formSessionId')), restitution),
        action: () => page.locator('#restitutionTransferForm button[type=submit]').press('Enter'), target: '#restitutionTransferForm .form-actions' });
    await inspectServiceDrafts(page, driver, meta, controls);
}

async function inspectServiceDrafts(page, driver, meta, controls) {
    await resetServiceCase(page, controls);
    await page.evaluate(() => window.showEditorialComplaintForm());
    const text = 'Synthetic retained editorial draft07 independent of resend and customer context.';
    await page.locator('#editorialComplaintDescription').fill(text); await page.locator('#editorialComplaintFollowup').check();
    await closeService(page, 'editorialComplaintForm');
    await page.evaluate(() => window.showResendMagazine());
    await page.locator('#resendReason').selectOption('other'); await closeService(page, 'resendMagazineForm');
    await page.evaluate(() => window.showEditorialComplaintForm());
    driver.check('independent service drafts survive closing and reopening another form', await page.locator('#editorialComplaintDescription').inputValue() === text
        && await page.locator('#editorialComplaintFollowup').isChecked() && await page.locator('#resendReason').inputValue() === 'other', true, meta, 7);
    await closeService(page, 'editorialComplaintForm');
    const before = await page.evaluate(() => window.kiwiCustomerWorkSession.getRequestContext());
    const count = controls.mutations.length;
    await page.evaluate(() => window.kiwiCustomerDetailSlice.selectCustomer(990702));
    const after = await page.evaluate(() => window.kiwiCustomerWorkSession.getRequestContext());
    driver.check('retained service draft blocks another customer without misapplying the draft', equal(before, after)
        && await page.locator('#editorialComplaintDescription').inputValue() === text && controls.mutations.length === count, true, meta, 7);
    await settleToasts(page);
    await page.locator('#endCustomerWorkSessionButton').press('Enter');
    await page.locator('#customerWorkSessionIdentity').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.kiwiCustomerDetailSlice.selectCustomer(990702));
    driver.check('explicit customer session reset permits the new synthetic customer', Number(await page.evaluate(() => window.kiwiCustomerWorkSession.getRequestContext()?.customerReference?.personId)) === 990702, true, meta, 7);
    await prepareServiceCustomer(page, { ...serviceCustomer, id: 990703, sourceSystem: 'subscription-api', credentialKey: 'synthetic07-readonly' });
    await page.evaluate(() => { window.showResendMagazine(); window.showEditorialComplaintForm(); });
    driver.check('existing source-customer restrictions keep resend and editorial forms closed', !await page.locator('#resendMagazineForm').isVisible()
        && !await page.locator('#editorialComplaintForm').isVisible() && controls.mutations.length === count, true, meta, 7);
}

export async function inspectServicePrivacy(page, driver, meta) {
    await settleToasts(page); await driver.painted(page);
    const result = await page.evaluate(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js'));
        const { captureElementScreenshot } = await import(imports[key]);
        const domToImage = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default;
        const element = document.querySelector('#winbackFlow .card'), bounds = element.getBoundingClientRect();
        const snapshot = () => ({ html: element.outerHTML, fields: [...element.querySelectorAll('input,select,textarea')].map(node => ({
            id: node.id, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex, readonly: node.readOnly, disabled: node.disabled,
            attributes: Object.fromEntries([...node.attributes].map(attribute => [attribute.name, attribute.value])) })) });
        const visible = node => Boolean(node.getClientRects().length) && getComputedStyle(node).visibility !== 'hidden';
        const captionSelector = '#winbackStep1e label,#winbackStep1e .form-label,#winbackStep1e .form-subtitle';
        const captionCopy = root => [...root.querySelectorAll(captionSelector)].map(node => node.textContent.trim());
        const before = snapshot(), captionsBefore = captionCopy(element);
        const originalPostal = element.querySelector('#transfer2PostalCode').value.replace(/\s+/g, '').toUpperCase();
        const dates = [...element.querySelectorAll('input[type=date]')], originalDates = dates.map(node => node.value);
        const fields = [...element.querySelectorAll('#winbackStep1e input[data-feedback-sensitive],#winbackStep1e textarea[data-feedback-sensitive]')]
            .filter(node => node.type !== 'hidden' && node.value.length > 0 && visible(node)).map(node => {
                const box = node.getBoundingClientRect();
                return { id: node.id, type: node.type, dateOrdinal: dates.indexOf(node), x: box.x - bounds.x, y: box.y - bounds.y, width: box.width, height: box.height };
            });
        const birthdayIds = ['transfer2BirthdayDay', 'transfer2BirthdayMonth', 'transfer2BirthdayYear'];
        const birthdayText = root => birthdayIds.map(id => { const node = root.querySelector('#' + id); return {
            id, text: node.options[node.selectedIndex]?.textContent, value: node.value,
            selectedSerializationMatches: [...node.options].every(option => option.hasAttribute('selected') === option.selected) }; });
        const originalBirthday = birthdayText(element), originalToBlob = domToImage.toBlob;
        const dateCloneStates = [], birthdayClones = [], postalCloneStates = [], captionClones = [], livePhases = [];
        const sample = name => { const current = snapshot(); livePhases.push({ name, htmlExact: current.html === before.html,
            fieldsExact: JSON.stringify(current.fields) === JSON.stringify(before.fields) }); };
        domToImage.toBlob = async (node, options) => {
            sample('toBlob-entry');
            const blob = await originalToBlob.call(domToImage, node, { ...options, onclone(clone) {
                const value = options.onclone(clone);
                dateCloneStates.push([...clone.querySelectorAll('input[type=date]')].map((field, index) => ({
                    liveIso: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(originalDates[index] || ''), valuePresent: Boolean(field.value),
                    valueMatchesOriginal: field.value === originalDates[index], attributeMatchesOriginal: field.getAttribute('value') === originalDates[index],
                    attributeMatchesCurrent: field.getAttribute('value') === field.value })));
                birthdayClones.push(birthdayText(clone));
                const postal = clone.querySelector('#transfer2PostalCode');
                postalCloneStates.push({ present: Boolean(postal.value), normalizedMatchesOriginal: postal.value.replace(/\s+/g, '').toUpperCase() === originalPostal, attributeMatchesCurrent: postal.getAttribute('value') === postal.value });
                const copy = captionCopy(clone);
                captionClones.push({ exact: JSON.stringify(copy) === JSON.stringify(captionsBefore), differences: captionsBefore.flatMap((text, index) =>
                    text === copy[index] ? [] : [{ index, before: text, after: copy[index] }]) });
                sample('normal-onclone-complete'); return value;
            } });
            sample('toBlob-complete'); return blob;
        };
        let capture;
        try { capture = await captureElementScreenshot({ element }); }
        finally { domToImage.toBlob = originalToBlob; }
        sample('after-capture');
        const pixels = async variant => {
            const bitmap = await createImageBitmap(variant.blob), canvas = document.createElement('canvas');
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
            return { context, width: canvas.width, height: canvas.height };
        };
        const original = await pixels(capture.original), pseudo = await pixels(capture.pseudonymized), scale = pseudo.width / bounds.width;
        const fieldPixels = fields.map((field, index) => {
            const x = Math.max(0, Math.round((field.x + 4) * scale)), y = Math.max(0, Math.round((field.y + 4) * scale));
            const width = Math.min(pseudo.width - x, Math.floor((field.width - 8) * scale));
            const height = Math.min(pseudo.height - y, Math.floor((field.height - 8) * scale));
            if (width <= 0 || height <= 0) return { ...field, index, covered: false, changedPixels: 0 };
            const a = original.context.getImageData(x, y, width, height).data, b = pseudo.context.getImageData(x, y, width, height).data;
            let changedPixels = 0, originalUniform = true; const originalColor = [...a.slice(0, 4)];
            for (let offset = 0; offset < a.length; offset += 4) {
                if (originalColor.some((value, component) => a[offset + component] !== value)) originalUniform = false;
                if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2]) changedPixels++;
            }
            return { ...field, index, covered: true, changedPixels, originalUniform, originalColor, pixelWidth: width, pixelHeight: height };
        });
        sample('after-pixels');
        const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(capture.pseudonymized.blob); });
        return { png, privacy: capture.privacySummary, fieldPixels, dateCloneStates, birthdayClones, originalBirthday, postalCloneStates, captionClones, livePhases,
            captureObserverRestored: domToImage.toBlob === originalToBlob, liveEditorExactlyUnchanged: JSON.stringify(snapshot()) === JSON.stringify(before),
            width: pseudo.width, height: pseudo.height, originalWidth: original.width, originalHeight: original.height };
    });
    const { png, ...detail } = result, pixelProof = productionInputPixelProof(result, driver.report.environment.browser);
    driver.check('actual production service capture replaces populated private pixels and restores the exact raw live draft', result.privacy.verified
        && result.privacy.unresolvedValues === 0 && result.privacy.resourceFailures === 0 && pixelProof.passed
        && result.livePhases.every(phase => phase.htmlExact && phase.fieldsExact), true, { ...meta, detail, pixelProof }, 7);
    driver.check('actual service postal pseudonym changes the normalized private value', result.postalCloneStates.length === 2 && result.postalCloneStates[0].normalizedMatchesOriginal && !result.postalCloneStates[1].normalizedMatchesOriginal && result.postalCloneStates.every(value => value.present && value.attributeMatchesCurrent), true, { ...meta, postalCloneStates: result.postalCloneStates, fixture: 'Declared2468ZX is outside all approved pseudonym template postal values.' }, 7);
    driver.check('actual service production capture preserves literal form captions', result.captionClones.length === 2
        && result.captionClones.every(copy => copy.exact), true, { ...meta, captionClones: result.captionClones }, 7);
    driver.check('actual service selected Birthday display changes with consistent option serialization', result.birthdayClones.length === 2
        && result.birthdayClones[0].every((field, index) => field.text === result.originalBirthday[index].text && field.selectedSerializationMatches)
        && result.birthdayClones[1].every((field, index) => field.text !== result.originalBirthday[index].text && field.selectedSerializationMatches), true,
    { ...meta, birthdayClones: result.birthdayClones, originalBirthday: result.originalBirthday,
        boundary: 'Selected display/serialization and exported PNG only; internal unexported option values are not claimed sanitized.' }, 7);
    const filename = `${meta.viewport.width}x${meta.viewport.height}-service-production-pseudonymized.png`;
    await writeFile(path.join(driver.evidenceDir, filename), Buffer.from(png.split(',')[1], 'base64'));
    driver.report.captures.push({ name: 'service-production-pseudonymized', filename, viewport: meta.viewport,
        kind: 'Actual unmodified production screenshot pipeline on declared synthetic combined service form; pseudonymized PNG retained, no upload.',
        captureMethod: 'Production dom-to-image clone/onclone pipeline', geometry: { width: result.width, height: result.height } });
    driver.report.serviceAcceptance.privacy.push({ ...meta, detail, pixelProof });
}
