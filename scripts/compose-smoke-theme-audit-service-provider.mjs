import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareServiceCustomer, closeService, serviceOffers } from './compose-smoke-theme-audit-service.mjs';

// theme_audit: observe actual provider state without changing service or eligibility policy.
const modulePath = fileURLToPath(import.meta.url);

async function settleToasts(page) {
    await page.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 10000 });
}

async function start(page) {
    await settleToasts(page);
    if (await page.locator('#winbackFlow').isVisible()) await closeService(page, 'winbackFlow');
    await prepareServiceCustomer(page);
    await page.evaluate(() => {
        document.querySelectorAll('input[name=cancelReason],input[name=winbackResult]').forEach(node => { node.checked = false; });
        window.kiwiWinbackSlice.cancelSubscription(990711);
    });
    await page.locator('input[name=cancelReason][value=price]').press('Space');
}

async function snapshot(page) {
    return page.evaluate(() => {
        const root = document.getElementById('winbackFlow');
        const visible = node => Boolean(node.getClientRects().length) && getComputedStyle(node).visibility !== 'hidden';
        const next = root.querySelector('#winbackStep1 [data-arg-step="2"]');
        const providerStatus = root.querySelector('#winbackOffersStatus');
        return {
            visibleSteps: [...root.querySelectorAll('.winback-step')].filter(visible).map(node => node.id),
            status: [...root.querySelectorAll('[role=status],[role=alert],[aria-live]')].filter(visible).map(node => node.textContent.trim()).filter(Boolean),
            busy: [...root.querySelectorAll('[aria-busy=true]')].filter(visible).map(node => node.id || node.dataset.action || node.tagName),
            nextVisible: visible(next), nextDisabled: next.disabled, nextBusy: next.getAttribute('aria-busy'),
            providerStatus: providerStatus ? { visible: visible(providerStatus), text: providerStatus.textContent.trim(),
                role: providerStatus.getAttribute('role'), live: providerStatus.getAttribute('aria-live') } : null,
            offers: [...root.querySelectorAll('#winbackOffers input[name=winbackOffer]')].map(node => ({ id: node.value, checked: node.checked })),
            toast: document.querySelector('.toast.show')?.textContent.trim() || '',
            reason: root.querySelector('input[name=cancelReason]:checked')?.value || ''
        };
    });
}

async function waitForRequest(controls, count) {
    const deadline = Date.now() + 5000;
    while (controls.offers.requests.length <= count) {
        if (Date.now() > deadline) throw new Error('The locally intercepted provider request did not arrive.');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

export async function inspectServiceProvider(page, driver, meta, controls) {
    const report = driver.report.serviceProvider = {
        module: { path: modulePath, sha256: createHash('sha256').update(await readFile(modulePath)).digest('hex') },
        states: [], boundary: 'GET20 fixtures exercise the actual controller. No service save, no real provider availability or backend policy claim.'
    };
    const record = async name => {
        const data = await snapshot(page);
        report.states.push({ name, ...meta, data });
        await driver.capture(page, 'service-provider-' + name, undefined, 'Actual local provider state with declared GET20 fixture; no service submission.');
        return data;
    };
    const next = () => page.locator('#winbackStep1 [data-arg-step="2"]').press('Enter');
    const initialMutations = controls.mutations.length;
    const heldCue = data => data.visibleSteps.includes('winbackStep1') && data.nextVisible && data.nextDisabled && data.nextBusy === 'true'
        && data.providerStatus?.visible && data.providerStatus.text === 'Aanbiedingen laden…'
        && data.providerStatus.role === 'status' && data.providerStatus.live === 'polite';
    const checkCleared = (data, state) => driver.check('completed provider request clears its cue and restores its own Next control', !data.nextDisabled
        && data.nextBusy === null && data.providerStatus?.text === '', true, { ...meta, state }, 7);

    await start(page);
    controls.offers.mode = 'held';
    const heldBefore = controls.offers.requests.length;
    await next();
    await waitForRequest(controls, heldBefore);
    let held = await snapshot(page);
    driver.check('pending offers lookup gives a truthful visible processing cue and owns its Next control', heldCue(held),
        true, { ...meta, state: 'provider-held', observation: held }, 7);
    const nextControl = page.locator('#winbackStep1 [data-arg-step="2"]');
    const bounds = await nextControl.boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.evaluate(() => { void window.kiwiWinbackSlice.winbackNextStep(2); });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    driver.check('duplicate provider Next neither repeats the GET nor advances the held step', controls.offers.requests.length === heldBefore + 1
        && heldCue(await snapshot(page)), true, { ...meta, state: 'provider-held-duplicate' }, 7);
    await closeService(page, 'winbackFlow');
    await page.evaluate(() => window.kiwiWinbackSlice.showWinbackFlow());
    held = await record('held');
    driver.check('hidden reopening retains the active provider owner and chosen reason', heldCue(held) && held.reason === 'price'
        && controls.offers.requests.length === heldBefore + 1, true, { ...meta, state: 'provider-held-reopen' }, 7);
    controls.offers.releases.splice(0).forEach(resolve => resolve());
    await page.locator('#winbackStep2 input[name=winbackOffer]').first().waitFor({ state: 'visible' });
    const released = await record('released');
    checkCleared(released, 'provider-released');
    driver.check('released offers lookup preserves the existing query and returned options', released.offers.length === serviceOffers.length
        && released.offers.every((offer, index) => offer.id === serviceOffers[index].offerId), true, { ...meta, state: 'provider-released' }, 7);

    await start(page);
    controls.offers.mode = 'empty';
    await next();
    await page.locator('#winbackStep2').waitFor({ state: 'visible' });
    await page.locator('.toast.show').waitFor({ state: 'visible' });
    const empty = await record('empty');
    checkCleared(empty, 'provider-empty');
    driver.check('empty provider response exposes no invented offer and keeps an explicit message', empty.offers.length === 0 && Boolean(empty.toast || empty.status.length),
        true, { ...meta, state: 'provider-empty' }, 7);
    await settleToasts(page);
    await page.locator('#winbackStep2 [data-arg-step="3"]').press('Enter');
    await page.locator('.toast.show').waitFor({ state: 'visible' });
    driver.check('empty provider response retains the original no-selected-offer guard', await page.locator('#winbackStep2').isVisible()
        && controls.mutations.length === initialMutations, true, { ...meta, state: 'provider-empty-guard' }, 7);

    await start(page);
    controls.offers.mode = 'error';
    await next();
    await page.locator('#winbackStep2').waitFor({ state: 'visible' });
    await page.locator('.toast.show').waitFor({ state: 'visible' });
    const failed = await record('error');
    checkCleared(failed, 'provider-error');
    driver.check('provider failure is visible without a service mutation', Boolean(failed.toast || failed.status.length)
        && controls.mutations.length === initialMutations, true, { ...meta, state: 'provider-error' }, 7);
    await settleToasts(page);
    await page.locator('#winbackStep2 [data-action=winback-prev-step]').press('Enter');
    controls.offers.mode = 'normal';
    await next();
    await page.locator('#winbackStep2 input[name=winbackOffer]').first().waitFor({ state: 'visible' });
    const recovered = await record('recovered');
    checkCleared(recovered, 'provider-recovered');
    driver.check('existing Back retry recovers actual provider options and preserves the selected reason', recovered.offers.length === serviceOffers.length
        && recovered.reason === 'price' && controls.mutations.length === initialMutations, true, { ...meta, state: 'provider-recovered' }, 7);
    controls.offers.mode = 'normal';
    await closeService(page, 'winbackFlow');
}
