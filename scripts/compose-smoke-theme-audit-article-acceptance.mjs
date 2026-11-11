import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionInputPixelProof } from './compose-smoke-theme-audit-customer-acceptance.mjs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function registerArticleAcceptance(report) {
    const modulePath = fileURLToPath(import.meta.url);
    report.articleAcceptance ||= { module: { path: modulePath, sha256: createHash('sha256').update(await readFile(modulePath)).digest('hex') },
        states: [], interactions: [], privacy: [] };
}

export async function readArticlePresentation(page) {
    return page.evaluate(() => {
        const root = document.getElementById('articleSaleForm'), form = document.getElementById('articleForm');
        const read = node => {
            if (!node) return null;
            const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
            return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
                visible: rect.width > 0 && rect.height > 0 && css.visibility !== 'hidden', radius: parseFloat(css.borderRadius), shadow: css.boxShadow,
                paddingLeft: parseFloat(css.paddingLeft), paddingRight: parseFloat(css.paddingRight), fontSize: parseFloat(css.fontSize),
                fontWeight: css.fontWeight, lineHeight: parseFloat(css.lineHeight), background: css.backgroundColor, color: css.color,
                borderColor: css.borderColor, overflow: node.scrollWidth > node.clientWidth + 1 };
        };
        const fields = [...form.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(node => read(node).visible).map(node => {
            const bounds = read(node), block = node.closest('.article-form-block'), ancestors = [];
            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                const box = read(parent);
                if (box.visible) ancestors.push(box);
                if (parent === block || parent === form) break;
            }
            const labels = node.labels?.length ? [...node.labels] : (node.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)).filter(Boolean);
            return { ...bounds, id: node.id, type: node.type, readonly: node.readOnly, disabled: node.disabled,
                labels: labels.map(read), ancestors, block: read(block) };
        });
        const summary = form.querySelector('.order-summary');
        const submits = [...form.querySelectorAll('button,input')].filter(node => node.type === 'submit'), submit = submits[0];
        const catalog = document.getElementById('allArticlesModal');
        return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
            root: read(root), card: read(root.querySelector('.onepager-container')), form: read(form), title: read(root.querySelector('h2')),
            columns: [...form.querySelectorAll('.article-sale-left,.article-sale-right')].map(read),
            sections: [...form.querySelectorAll('.article-form-block')].map(read).filter(node => node.visible),
            headings: [...form.querySelectorAll('.form-subtitle')].map(read).filter(node => node.visible), fields,
            rows: [...form.querySelectorAll('.order-item')].map(read), list: read(document.getElementById('orderItemsList')),
            coupon: read(form.querySelector('.coupon-section')), summary: read(summary), submit: read(submit),
            add: read(form.querySelector('[data-action="add-article-to-order"]')), applyCoupon: read(form.querySelector('[data-action="apply-coupon"]')),
            submitCount: submits.length,
            submitFollowsSummary: Boolean(summary && submit && (summary.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING)),
            payment: [...form.querySelectorAll('.payment-option')].map(node => ({ ...read(node), input: read(node.querySelector('input')) })),
            couponAnnouncement: { role: document.getElementById('couponMessage').getAttribute('role'), live: document.getElementById('couponMessage').getAttribute('aria-live'),
                text: document.getElementById('couponMessage').textContent.trim(), described: (document.getElementById('couponCode').getAttribute('aria-describedby') || '').split(/\s+/).includes('couponMessage') },
            catalog: read(catalog), catalogCards: [...document.querySelectorAll('#allArticlesModal .article-card')].map(read) };
    });
}

export function articlePresentationChecks(data, reference, state) {
    const checks = [], add = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
    const near = (a, b) => Math.abs(parseFloat(a) - parseFloat(b)) <= 1;
    const horizontalInside = (node, parent) => node.x >= parent.x - 1 && node.right <= parent.right + 1;
    const flat = node => node.radius === 0 && node.shadow === 'none';
    add('article fields and columns remain horizontally contained without hidden overflow', data.documentWidth <= data.viewport.width + 1
        && !data.card.overflow && !data.form.overflow && data.columns.every(node => !node.overflow && horizontalInside(node, data.card))
        && data.fields.every(node => node.ancestors.every(parent => horizontalInside(node, parent))
            && node.block && node.x >= node.block.x + node.block.paddingLeft - 1 && node.right <= node.block.right - node.block.paddingRight + 1), data);
    if (state === 'initial') {
        const expectedInset = data.viewport.width <= 768 ? 16 : 20;
        add('article uses a flat workspace and the rendered showcase title hierarchy', flat(data.card)
            && near(data.title.fontSize, reference.subscriptionTitle.fontSize), { card: data.card, title: data.title });
        add('article sections retain shared readable insets and flat surfaces', data.sections.length >= 4
            && data.sections.every(node => flat(node) && near(node.paddingLeft, expectedInset) && near(node.paddingRight, expectedInset))
            && data.headings.every(node => near(node.fontSize, reference.subscriptionHeading.fontSize)), { sections: data.sections, headings: data.headings });
        add('one final article submission follows the complete order context in DOM order', data.submitCount === 1 && data.submitFollowsSummary, data.submit);
    }
    if (['initial', 'selected-quantity-price', 'payment-notes-actions'].includes(state)) {
        const textFields = data.fields.filter(node => !['radio', 'checkbox'].includes(node.type));
        add('article fields keep persistent caption roles normal text and usable geometry', textFields.every(node => node.height >= 39
            && near(node.fontSize, reference.subscriptionInput.fontSize) && node.labels.length > 0
            && node.labels.every(label => label.visible && near(label.fontSize, reference.subscriptionCaption.fontSize) && label.fontWeight === reference.subscriptionCaption.fontWeight)), textFields);
        add('article price remains readonly and local actions use the secondary reference role', data.fields.find(node => node.id === 'articlePrice')?.readonly
            && [data.add, data.applyCoupon].every(node => node.background === reference.secondary.backgroundColor
                && node.color === reference.secondary.color && node.borderColor === reference.secondary.borderTopColor), { add: data.add, coupon: data.applyCoupon });
    }
    if (state.includes('quote') || state.includes('coupon')) {
        add('cart rows coupon and totals remain flat readable contained sections', [data.list, data.coupon, data.summary, ...data.rows]
            .filter(node => node?.visible).every(node => flat(node) && !node.overflow && horizontalInside(node, data.card)), data.rows);
    }
    if (state === 'coupon-error') add('visible coupon errors have a persistent programmatic live association', data.couponAnnouncement.text.length > 0
        && (['status', 'alert'].includes(data.couponAnnouncement.role) || ['polite', 'assertive'].includes(data.couponAnnouncement.live))
        && data.couponAnnouncement.described, data.couponAnnouncement);
    if (state === 'catalog') add('catalogue cards stay flat and horizontally contained', data.catalogCards.length > 0
        && data.catalogCards.every(node => flat(node) && !node.overflow && horizontalInside(node, data.catalog)), data.catalogCards);
    return checks;
}

export async function checkArticleState(page, driver, meta, state) {
    await registerArticleAcceptance(driver.report);
    const data = await readArticlePresentation(page);
    for (const check of articlePresentationChecks(data, driver.contract, state)) driver.check(check.name, check.passed, true, { ...meta, state, detail: check.detail }, 6);
    driver.report.articleAcceptance.states.push({ ...meta, state, data });
}

export async function articleDraftSnapshot(page) {
    return page.evaluate(() => ({ fields: [...document.querySelectorAll('#articleForm input,#articleForm select,#articleForm textarea')].map(node => ({
        id: node.id, name: node.name, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex, readonly: node.readOnly, disabled: node.disabled })),
        items: window.orderItems, subtotal: document.getElementById('orderSubtotal').textContent,
        total: document.getElementById('orderTotal').textContent, coupon: document.getElementById('couponMessage').textContent,
        currentCustomer: window.currentCustomer }));
}

async function waitForArticleToasts(page) {
    await page.waitForFunction(() => !document.querySelector('.toast.show'), null, { timeout: 10000 });
}

async function addDeclaredArticle(page, id, quantity) {
    await page.locator('#articleSearch').fill('Synthetic');
    await page.locator(`#articleDropdown [data-arg-article-id="${id}"]`).press('Enter');
    await page.locator('#articleQuantity').fill(String(quantity));
    await page.locator('#articleQuantity').press('Tab');
    await page.locator('[data-action="add-article-to-order"]').press('Enter');
    await page.waitForFunction(({ id, quantity }) => window.orderItems?.some(item => Number(item.articleId) === id && item.quantity === quantity), { id, quantity });
}

async function fillDeclaredRecipient(page, driver, meta, controls) {
    controls.addressEnabled = true;
    const fields = { articleInitials: 'S.Q.', articleLastName: 'Synthetic private family06', articlePostalCode: '2468ZX',
        articleHouseNumber: '12', articleAddress: 'Syntheticstraat', articleCity: 'SYNTHETIC CITY',
        articlePhone: '0209462718', articleEmail: 'private06@example.invalid',
        articleNotes: 'Synthetic private delivery note06: use the indicated side entrance and preserve this complete draft.' };
    for (const [id, value] of Object.entries(fields)) await page.locator('#' + id).fill(value);
    await page.locator('#articleBirthdayDay').selectOption('28');
    await page.locator('#articleBirthdayMonth').selectOption('12');
    await page.locator('#articleBirthdayYear').selectOption('1980');
    const valid = await page.evaluate(() => window.kiwiAddressCompletion.validate(document.getElementById('articleForm')));
    driver.check('actual article address controller confirms the declared full synthetic address', valid, true, meta, 6);
    driver.check('article form retains native required-field validity', await page.locator('#articleForm').evaluate(form => form.checkValidity()), true, meta, 6);
}

export async function inspectArticleCalendar(page, driver, meta, observe) {
    const trigger = page.locator('#deliveryDateDisplay'), hidden = page.locator('#articleDesiredDelivery');
    await trigger.press('Enter');
    await page.locator('#deliveryCalendar.is-open').waitFor({ state: 'visible' });
    const before = await hidden.inputValue();
    const geometry = await page.locator('#deliveryCalendar').evaluate(node => {
        const box = node.getBoundingClientRect(), grid = node.querySelector('.delivery-calendar-grid');
        return { x: box.x, right: box.right, width: box.width, viewportWidth: innerWidth,
            scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
            tracks: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length,
            days: node.querySelectorAll('button.delivery-day-cell').length,
            activeDate: document.activeElement?.dataset.argDate, focusVisible: document.activeElement?.matches(':focus-visible') };
    });
    driver.check('approved delivery calendar retains seven readable columns within the viewport', geometry.tracks === 7
        && geometry.x >= 0 && geometry.right <= geometry.viewportWidth + 1 && geometry.scrollWidth <= geometry.clientWidth + 1
        && geometry.days >= 28, true, { ...meta, geometry }, 6);
    await page.keyboard.press('ArrowRight');
    const right = await page.evaluate(() => document.activeElement.dataset.argDate);
    await page.keyboard.press('ArrowLeft');
    const left = await page.evaluate(() => document.activeElement.dataset.argDate);
    driver.check('real calendar arrow navigation returns to the starting selected date', right !== before && left === before, true, { ...meta, before, right, left }, 6);
    const month = await page.locator('#deliveryCalendar .calendar-month').textContent();
    await page.keyboard.press('PageDown');
    await page.waitForFunction(month => document.querySelector('#deliveryCalendar .calendar-month').textContent !== month, month);
    await page.keyboard.press('PageUp');
    await page.waitForFunction(month => document.querySelector('#deliveryCalendar .calendar-month').textContent === month, month);
    driver.check('real month keyboard navigation preserves the selected delivery model', await hidden.inputValue(), before, meta, 6);
    const unavailable = page.locator('#deliveryCalendar button.delivery-day-cell[aria-disabled="true"]').first();
    await unavailable.focus(); await unavailable.press('Enter'); await unavailable.press('Space');
    driver.check('unavailable calendar days cannot change delivery selection', await hidden.inputValue() === before
        && await trigger.getAttribute('aria-expanded') === 'true', true, meta, 6);
    await observe(page, driver, meta, 'calendar-unavailable-keyboard', '#deliveryCalendar');
    await page.keyboard.press('Escape');
    driver.check('calendar Escape closes the popup and restores actual trigger focus', await trigger.getAttribute('aria-expanded') === 'false'
        && await trigger.evaluate(node => node === document.activeElement), true, meta, 6);
    await trigger.press('Space');
    await page.locator('#deliveryCalendar [data-action="select-recommended-delivery-date"]').press('Enter');
    const recommended = await hidden.inputValue();
    driver.check('calendar earliest action uses the declared API recommendation without changing policy', recommended, before, meta, 6);
}

export async function inspectArticleKeyboard(page, driver, meta) {
    await page.locator('#articleInitials').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const path = [];
    for (let index = 0; index < 70; index++) {
        const step = await page.evaluate(() => {
            const node = document.activeElement, box = node.getBoundingClientRect(), css = getComputedStyle(node);
            return { id: node.id, tag: node.tagName, type: node.type, action: node.dataset.action,
                withinForm: Boolean(node.closest('#articleForm')), focusVisible: node.matches(':focus-visible'),
                outlineStyle: css.outlineStyle, outlineWidth: parseFloat(css.outlineWidth),
                x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height,
                viewportWidth: innerWidth, viewportHeight: innerHeight,
                cancel: node.matches('#articleForm [data-action="close-article-sale-form"]') };
        });
        path.push(step);
        if (step.cancel) break;
        await page.keyboard.press('Tab'); await driver.painted(page);
    }
    const visible = step => step.width > 0 && step.height > 0 && step.right > 0 && step.x < step.viewportWidth
        && step.bottom > 0 && step.y < step.viewportHeight;
    driver.check('actual Tab reaches the final Cancel action through labelled native article controls with visible focus', path[0]?.id === 'articleInitials'
        && path.at(-1)?.cancel && path.every(step => step.withinForm && step.focusVisible && visible(step)), true,
    { ...meta, path, boundary: 'Visible native focus and reachable action, not an assertion that every composite control box is wholly in the viewport immediately after Tab.' }, 6);
    driver.report.articleAcceptance.interactions.push({ ...meta, keyboardPath: path });
    await driver.capture(page, (meta.native ? 'native-200-' : 'after-') + 'article-keyboard-cancel', undefined, 'Actual native Tab path; no activation, synthetic focus reorder or transaction.');
}

export async function inspectArticleInteractions(page, driver, meta, controls, observe) {
    await registerArticleAcceptance(driver.report);
    const totals = await page.evaluate(() => ({ subtotal: document.getElementById('orderSubtotal').textContent, total: document.getElementById('orderTotal').textContent,
        items: window.orderItems.map(item => ({ ...item })) }));
    driver.check('rendered authoritative quote totals and selected quantities survive invalid coupon recovery', totals.subtotal === '€77,00'
        && totals.total === '€70,75' && totals.items.map(item => item.quantity).join(',') === '5,2', true, { ...meta, totals }, 6);
    await page.locator('#couponCode').fill('THEME06'); await page.locator('#couponCode').press('Enter');
    await page.locator('.coupon-remove').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.getElementById('orderTotal').textContent === '€68,25');
    await page.locator('.coupon-remove').press('Enter');
    await page.waitForFunction(() => document.getElementById('orderTotal').textContent === '€70,75' && document.getElementById('couponCode').value === '');
    driver.check('native coupon removal restores the authoritative noncoupon total', await page.locator('.coupon-remove').count(), 0, meta, 6);
    await page.locator('#orderItemsList [data-arg-article-id="990602"]').press('Enter');
    await page.waitForFunction(() => window.orderItems.length === 1 && document.getElementById('orderTotal').textContent === '€56,25');
    await page.locator('#orderItemsList [data-arg-article-id="990601"]').press('Enter');
    await page.waitForFunction(() => window.orderItems.length === 0 && document.getElementById('orderItemsSection').style.display === 'none');
    await fillDeclaredRecipient(page, driver, meta, controls);
    await page.locator('#articleForm button[type="submit"]').press('Enter');
    await page.waitForFunction(() => Boolean(document.querySelector('.toast.error.show')));
    driver.check('empty article order stays blocked without a workflow request', controls.workflowRequests.length, 0, meta, 6);
    await addDeclaredArticle(page, 990601, 5); await addDeclaredArticle(page, 990602, 2);
    await waitForArticleToasts(page);
    await observe(page, driver, meta, 'recovered-cart-total', '#orderTotal');
    await page.locator('#articleSearch').fill('held06');
    await page.waitForFunction(() => document.getElementById('articleSearch').value === 'held06');
    for (let count = 0; count < 100 && !controls.heldSearches.length; count++) await page.waitForTimeout(20);
    if (!controls.heldSearches.length) throw new Error('Declared held catalogue GET did not arrive.');
    const searchPending = await page.evaluate(() => {
        const input = document.getElementById('articleSearch'), dropdown = document.getElementById('articleDropdown'), status = document.getElementById('articleSearchStatus');
        return { inputBusy: input.getAttribute('aria-busy'), dropdownBusy: dropdown.getAttribute('aria-busy'),
            described: (input.getAttribute('aria-describedby') || '').split(/\s+/).includes(status.id),
            statusVisible: status.getBoundingClientRect().width > 0 && status.getBoundingClientRect().height > 0 && getComputedStyle(status).visibility !== 'hidden', statusText: status.textContent.trim(), role: status.getAttribute('role') };
    });
    driver.check('held catalogue search has truthful local busy and associated live feedback', searchPending.inputBusy === 'true'
        && searchPending.dropdownBusy === 'true' && searchPending.described && searchPending.statusVisible
        && searchPending.statusText.length > 0 && searchPending.role === 'status', true, { ...meta, searchPending }, 6);
    await observe(page, driver, meta, 'search-held', '#articleSearch');
    controls.heldSearches.splice(0).forEach(resolve => resolve());
    await page.waitForFunction(() => document.getElementById('articleSearch').getAttribute('aria-busy') !== 'true' && document.getElementById('articleSearchStatus').textContent.trim() === '');
    await page.locator('#articleDropdown [data-arg-article-id="990601"]').waitFor({ state: 'visible' });
    await page.locator('#articleSearch').fill('empty06');
    await page.locator('#articleDropdown .article-no-results').waitFor({ state: 'visible' });
    await observe(page, driver, meta, 'search-empty', '#articleSearch');
    await page.locator('#articleSearch').fill('error06');
    await page.waitForFunction(() => Boolean(document.querySelector('.toast.error.show')));
    await observe(page, driver, meta, 'search-error', '#articleSearch');
    await page.locator('#articleSearch').fill('recovered06');
    await page.locator('#articleDropdown [data-arg-article-id="990601"]').waitFor({ state: 'visible' });
    await page.locator('#articleSearch').press('ArrowDown'); await page.locator('#articleSearch').press('Enter');
    await page.waitForFunction(() => document.getElementById('articleName').dataset.articleId === '990601');
    driver.check('actual search keyboard selection recovers without mutating the existing order', await page.evaluate(() => window.orderItems.map(item => item.quantity).join(',')), '5,2', meta, 6);
    await inspectArticleCalendar(page, driver, meta, observe);
    const paymentBefore = await page.locator('#articlePaymentTransfer').isChecked();
    await page.locator('#articlePaymentTransfer').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
    driver.check('native payment radio navigation preserves the requested bank-transfer value', paymentBefore && await page.locator('#articlePaymentTransfer').isChecked(), true, meta, 6);
    const before = await articleDraftSnapshot(page);
    await page.locator('#articleForm [data-action="close-article-sale-form"]').press('Enter');
    await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
    await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
    driver.check('ordinary article close/reopen preserves all actual fields cart quote coupon and identity', JSON.stringify(await articleDraftSnapshot(page)), JSON.stringify(before), meta, 6);
    await observe(page, driver, meta, 'retained-local-draft', '#articleNotes');
    await inspectArticleKeyboard(page, driver, meta);
    if (!meta.native) {
        await inspectArticleWorkflow(page, driver, meta, controls, observe);
        await inspectArticlePrivacy(page, driver, meta);
        await inspectArticlePrivacyBoundaries(page, driver, meta, controls);
    }
}

async function inspectArticleWorkflow(page, driver, meta, controls, observe) {
    const valid = await page.evaluate(() => window.kiwiAddressCompletion.validate(document.getElementById('articleForm')));
    driver.check('real article submit uses a confirmed retained address before the workflow fixture', valid, true, meta, 6);
    await waitForArticleToasts(page);
    const before = await articleDraftSnapshot(page);
    controls.quoteMode = 'held'; controls.workflowMode = 'held';
    await page.locator('#articleForm button[type="submit"]').press('Enter');
    for (let count = 0; count < 100 && !controls.heldQuotes.length; count++) await page.waitForTimeout(20);
    if (!controls.heldQuotes.length) throw new Error('Actual pre-submit quote request did not reach the declared local hold.');
    const quotePending = await articleOperationState(page);
    driver.check('actual pre-submit quote has local calculating feedback without changing editable fields or close actions',
        pendingArticleStateIsVisible(quotePending) && JSON.stringify(await articleDraftSnapshot(page)) === JSON.stringify(before), true,
        { ...meta, quotePending }, 6);
    const quoteCount = driver.report.articleEvidence.fixtureRequests.filter(request => request.path.endsWith('/article-order-quote')).length;
    const quoteDuplicate = await invokeActualArticleHandler(page);
    driver.check('actual owned quote rejects duplicate handler re-entry before a second quote or workflow', quoteDuplicate.settled
        && controls.heldQuotes.length === 1 && controls.workflowRequests.length === 0
        && driver.report.articleEvidence.fixtureRequests.filter(request => request.path.endsWith('/article-order-quote')).length === quoteCount,
        true, { ...meta, quoteDuplicate }, 6);
    await observe(page, driver, meta, 'pre-submit-quote-held', '#articleForm .form-actions');
    controls.quoteMode = 'normal'; controls.heldQuotes.splice(0).forEach(resolve => resolve());
    for (let count = 0; count < 100 && !controls.heldWorkflows.length; count++) await page.waitForTimeout(20);
    if (!controls.heldWorkflows.length) throw new Error('Actual article-order POST did not reach the declared local hold.');
    await observe(page, driver, meta, 'workflow-post-held', '#articleForm .form-actions');
    const pending = await articleOperationState(page);
    driver.check('actual held workflow switches to creating feedback while preserving fields and close actions', pendingArticleStateIsVisible(pending)
        && pending.statusText !== quotePending.statusText && JSON.stringify(await articleDraftSnapshot(page)) === JSON.stringify(before), true,
    { ...meta, pending, quotePending }, 6);
    const submit = page.locator('#articleForm button[type="submit"]');
    const point = await submit.evaluate(node => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2,
        hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) }; });
    driver.check('disabled submit duplicate probe uses the actual unobscured button center', point.hit, true, { ...meta, point }, 6);
    if (!point.hit) throw new Error('Actual disabled submit center is obstructed; no forced pointer activation is allowed.');
    await page.mouse.click(point.x, point.y);
    const duplicate = await invokeActualArticleHandler(page);
    driver.check('native disabled-pointer activation and awaited real handler produce one held workflow', duplicate.settled
        && controls.workflowRequests.length === 1 && await submit.isDisabled(), true, { ...meta, duplicate }, 6);
    driver.report.articleAcceptance.interactions.push({ ...meta, quotePending, pending, workflowPayloads: controls.workflowRequests,
        kind: 'Actual quote and article-order POST held separately, entirely local; native disabled pointer plus awaited exported handler proves the UI owner.' });
    await page.locator('#articleForm [data-action="close-article-sale-form"]').press('Enter');
    await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
    const reopenedPending = await articleOperationState(page);
    driver.check('closing/reopening a held article workflow preserves entered data and authoritative order', JSON.stringify(await articleDraftSnapshot(page)), JSON.stringify(before), meta, 6);
    driver.check('retained workflow reopening keeps its same truthful busy feedback', pendingArticleStateIsVisible(reopenedPending)
        && reopenedPending.statusText === pending.statusText, true, { ...meta, reopenedPending }, 6);
    controls.workflowMode = 'rejected'; controls.heldWorkflows.splice(0).forEach(resolve => resolve());
    await page.waitForFunction(() => [...document.querySelectorAll('.toast.error.show')].some(node => node.textContent.includes('Synthetic article order')));
    driver.check('rejected article workflow retains the full original draft and one locally intercepted request', controls.workflowRequests.length === 1
        && JSON.stringify(await articleDraftSnapshot(page)) === JSON.stringify(before), true, meta, 6);
    await page.waitForFunction(() => !document.querySelector('#articleForm button[type="submit"]').disabled
        && document.querySelector('#articleForm button[type="submit"]').getAttribute('aria-busy') !== 'true'
        && document.getElementById('articleSubmitStatus').textContent.trim() === '');
    await observe(page, driver, meta, 'workflow-rejected-retained', '#articleForm .form-actions');
    await waitForArticleToasts(page);
    const rejectedAgain = page.waitForResponse(response => response.url() === new URL('api/v1/workflows/article-order', driver.baseUrl).href && response.status() === 422);
    await submit.press('Enter'); await (await rejectedAgain).finished();
    await page.waitForFunction(() => !document.querySelector('#articleForm button[type="submit"]').disabled
        && document.getElementById('articleSubmitStatus').textContent.trim() === '');
    driver.check('a released owner allows one explicit retry and retains the same draft after local rejection', controls.workflowRequests.length === 2
        && controls.workflowRequests[0].order.trackingNumber !== controls.workflowRequests[1].order.trackingNumber
        && JSON.stringify(await articleDraftSnapshot(page)) === JSON.stringify(before), true, meta, 6);
    await observe(page, driver, meta, 'workflow-retry-rejected-retained', '#articleForm .form-actions');
}

async function articleOperationState(page) {
    return page.locator('#articleForm').evaluate(form => {
        const submit = form.querySelector('button[type="submit"]'), status = document.getElementById('articleSubmitStatus');
        const close = document.querySelector('#articleSaleForm > .onepager-container .form-header [data-action="close-article-sale-form"]');
        const cancel = form.querySelector('[data-action="close-article-sale-form"]');
        return { disabled: submit.disabled, busy: submit.getAttribute('aria-busy'), statusText: status.textContent.trim(),
            statusVisible: status.getBoundingClientRect().width > 0 && status.getBoundingClientRect().height > 0 && getComputedStyle(status).visibility !== 'hidden', role: status.getAttribute('role'),
            closeAvailable: !close.disabled && !cancel.disabled };
    });
}

function pendingArticleStateIsVisible(state) {
    return state.disabled && state.busy === 'true' && state.statusVisible && state.statusText.length > 0
        && state.role === 'status' && state.closeAvailable;
}

async function invokeActualArticleHandler(page) {
    return page.evaluate(async () => {
        const handler = window.kiwiOrderSlice?.createArticleSale;
        if (typeof handler !== 'function') throw new Error('The actual exported article handler is required.');
        let timer;
        try {
            await Promise.race([handler({ preventDefault() {} }), new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Owned article handler re-entry did not settle.')), 5000);
            })]);
            return { settled: true };
        } finally { clearTimeout(timer); }
    });
}

export async function inspectArticlePrivacy(page, driver, meta) {
    await waitForArticleToasts(page);
    await page.evaluate(() => window.kiwiAddressCompletion.validate(document.getElementById('articleForm')));
    await driver.painted(page);
    const result = await page.evaluate(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js'));
        if (!key) throw new Error('Production screenshot module is required.');
        const { captureElementScreenshot } = await import(imports[key]);
        const domToImage = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default;
        const element = document.querySelector('#articleSaleForm .onepager-container'), bounds = element.getBoundingClientRect();
        const snapshot = () => ({ html: element.outerHTML, fields: [...element.querySelectorAll('input,select,textarea')].map(node => ({
            id: node.id, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex, readonly: node.readOnly, disabled: node.disabled,
            attributes: Object.fromEntries([...node.attributes].map(attribute => [attribute.name, attribute.value])) })) });
        const publicSelector = 'label,.form-label,.form-subtitle,.order-item-name,.order-item-meta,.discount-type,.discount-description';
        const publicCopy = root => [...root.querySelectorAll(publicSelector)].map(node => node.textContent.trim());
        const before = snapshot(), publicBefore = publicCopy(element);
        const originalPostal = element.querySelector('#articlePostalCode').value.replace(/\s+/g, '').toUpperCase();
        const dates = [...element.querySelectorAll('input[type="date"]')], originalDates = dates.map(node => node.value);
        const fields = [...element.querySelectorAll('input[data-feedback-sensitive],textarea[data-feedback-sensitive]')]
            .filter(node => node.type !== 'hidden' && node.value.length > 0 && node.getBoundingClientRect().width > 0).map(node => {
                const box = node.getBoundingClientRect();
                return { id: node.id, type: node.type, dateOrdinal: dates.indexOf(node), x: box.x - bounds.x, y: box.y - bounds.y, width: box.width, height: box.height };
            });
        const birthdayIds = ['articleBirthdayDay', 'articleBirthdayMonth', 'articleBirthdayYear'];
        const birthdayText = root => birthdayIds.map(id => { const node = root.querySelector('#' + id); return {
            id, selectedIndex: node.selectedIndex, text: node.options[node.selectedIndex]?.textContent, value: node.value,
            selectedSerializationMatches: [...node.options].every(option => option.hasAttribute('selected') === option.selected) }; });
        const originalBirthday = birthdayText(element), originalToBlob = domToImage.toBlob;
        const dateCloneStates = [], birthdayClones = [], postalCloneStates = [], publicClones = [], livePhases = [];
        const sample = name => { const current = snapshot(); livePhases.push({ name, htmlExact: current.html === before.html,
            fieldsExact: JSON.stringify(current.fields) === JSON.stringify(before.fields) }); };
        domToImage.toBlob = async (node, options) => {
            sample('toBlob-entry');
            const blob = await originalToBlob.call(domToImage, node, { ...options, onclone(clone) {
                const value = options.onclone(clone);
                dateCloneStates.push([...clone.querySelectorAll('input[type="date"]')].map((field, index) => ({
                    liveIso: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(originalDates[index] || ''), valuePresent: Boolean(field.value),
                    valueMatchesOriginal: field.value === originalDates[index], attributeMatchesOriginal: field.getAttribute('value') === originalDates[index],
                    attributeMatchesCurrent: field.getAttribute('value') === field.value })));
                birthdayClones.push(birthdayText(clone));
                const postal = clone.querySelector('#articlePostalCode');
                postalCloneStates.push({ valuePresent: Boolean(postal.value),
                    valueMatchesOriginalNormalized: postal.value.replace(/\s+/g, '').toUpperCase() === originalPostal,
                    attributeMatchesCurrent: postal.getAttribute('value') === postal.value });
                const copy = publicCopy(clone);
                publicClones.push({ exact: JSON.stringify(copy) === JSON.stringify(publicBefore), differences: publicBefore.flatMap((text, index) =>
                    text === copy[index] ? [] : [{ index, before: text, after: copy[index] }]) });
                sample('normal-onclone-complete');
                return value;
            } });
            sample('toBlob-complete');
            return blob;
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
            let changedPixels = 0, originalUniform = true;
            const originalColor = [...a.slice(0, 4)];
            for (let offset = 0; offset < a.length; offset += 4) {
                if (originalColor.some((value, component) => a[offset + component] !== value)) originalUniform = false;
                if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2]) changedPixels++;
            }
            return { ...field, index, covered: true, changedPixels, originalUniform, originalColor, pixelWidth: width, pixelHeight: height };
        });
        sample('after-pixels');
        const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(capture.pseudonymized.blob); });
        return { png, privacy: capture.privacySummary, fieldPixels, dateCloneStates, birthdayClones, originalBirthday, postalCloneStates, publicClones, livePhases,
            captureObserverRestored: domToImage.toBlob === originalToBlob, liveEditorExactlyUnchanged: JSON.stringify(snapshot()) === JSON.stringify(before),
            width: pseudo.width, height: pseudo.height, originalWidth: original.width, originalHeight: original.height };
    });
    const { png, ...detail } = result, pixelProof = productionInputPixelProof(result, driver.report.environment.browser);
    driver.check('actual production article capture masks populated private text fields and restores raw live draft', result.privacy.verified
        && result.privacy.unresolvedValues === 0 && result.privacy.resourceFailures === 0 && pixelProof.passed
        && result.livePhases.every(phase => phase.htmlExact && phase.fieldsExact), true, { ...meta, detail, pixelProof }, 6);
    driver.check('actual production article postal replacement changes normalized value rather than formatting alone', result.postalCloneStates.length === 2
        && result.postalCloneStates[0].valueMatchesOriginalNormalized && !result.postalCloneStates[1].valueMatchesOriginalNormalized
        && result.postalCloneStates.every(state => state.valuePresent && state.attributeMatchesCurrent), true,
    { ...meta, postalCloneStates: result.postalCloneStates, fixture: 'Declared synthetic2468ZX differs from all actual pseudo postal templates; original1234AB preflight remains unchanged.' }, 6);
    driver.check('actual production article image preserves fixed captions and public catalogue context', result.publicClones.length === 2
        && result.publicClones.every(copy => copy.exact), true, { ...meta, publicClones: result.publicClones }, 6);
    driver.check('actual selected Birthday display is masked with consistent selection serialization', result.birthdayClones.length === 2
        && result.birthdayClones[0].every((field, index) => field.text === result.originalBirthday[index].text && field.selectedSerializationMatches)
        && result.birthdayClones[1].every((field, index) => field.text !== result.originalBirthday[index].text && field.selectedSerializationMatches), true,
    { ...meta, birthdayClones: result.birthdayClones, boundary: 'Exported PNG/selected text proof; retained internal option values are not claimed sanitized.' }, 6);
    const filename = `${meta.viewport.width}x${meta.viewport.height}-article-production-pseudonymized.png`;
    await writeFile(path.join(driver.evidenceDir, filename), Buffer.from(png.split(',')[1], 'base64'));
    driver.report.captures.push({ name: 'article-production-pseudonymized', filename, viewport: meta.viewport,
        kind: 'Actual production capture on synthetic recipient/cart; unmodified PNG, original stays in memory, no upload.', captureMethod: 'Actual production captureElementScreenshot',
        geometry: { width: result.width, height: result.height } });
    driver.report.articleAcceptance.privacy.push({ ...meta, detail });
    for (const [name, selector] of [['recipient', '.article-form-block:has(#articleInitials)'], ['birthday', '.form-group:has(#articleBirthdayDay)']]) {
        const component = await page.evaluate(async selector => {
            const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
            const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js'));
            const { captureElementScreenshot } = await import(imports[key]), element = document.querySelector('#articleSaleForm ' + selector);
            const snapshot = () => ({ html: element.outerHTML, fields: [...element.querySelectorAll('input,select,textarea')]
                .map(node => ({ value: node.value, checked: node.checked, selectedIndex: node.selectedIndex, readonly: node.readOnly, disabled: node.disabled })) });
            const before = snapshot();
            const capture = await captureElementScreenshot({ element });
            const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(capture.pseudonymized.blob); });
            return { png, width: capture.pseudonymized.width, height: capture.pseudonymized.height, privacy: capture.privacySummary, rawHtmlExact: before.html === element.outerHTML, rawFieldsExact: JSON.stringify(before.fields) === JSON.stringify(snapshot().fields) };
        }, selector);
        driver.check('readable ' + name + ' production capture retains raw live HTML and verified resources', component.rawHtmlExact && component.rawFieldsExact && component.privacy.verified
            && component.privacy.unresolvedValues === 0 && component.privacy.resourceFailures === 0, true, meta, 6);
        const filename = `${meta.viewport.width}x${meta.viewport.height}-article-production-${name}-pseudonymized.png`;
        await writeFile(path.join(driver.evidenceDir, filename), Buffer.from(component.png.split(',')[1], 'base64'));
        driver.report.captures.push({ name: 'article-production-' + name + '-pseudonymized', filename, viewport: meta.viewport,
            kind: 'Actual production component capture for readable privacy/caption review; unchanged PNG, no upload.',
            captureMethod: 'Actual production captureElementScreenshot', geometry: { width: component.width, height: component.height } });
    }
}

export async function inspectArticleSharedSentinel(page, driver, meta) {
    const before = await articleDraftSnapshot(page);
    await page.locator('#articleForm [data-action="close-article-sale-form"]').press('Enter');
    const trigger = page.locator('#agentProfileTrigger');
    await trigger.press('Enter');
    await page.locator('#agentStatusMenu').waitFor({ state: 'visible' });
    await driver.capture(page, 'native-200-article-shared-profile', undefined, 'Small actual shared profile sentinel after article flow; no role change or logout.');
    await page.keyboard.press('Escape');
    driver.check('article styles retain the shared profile Escape focus contract', await trigger.evaluate(node => node === document.activeElement), true, meta, 6);
    await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
    await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
    driver.check('shared profile inspection retains the exact article draft and selection model', JSON.stringify(await articleDraftSnapshot(page)), JSON.stringify(before), meta, 6);
    await driver.capture(page, 'native-200-article-shared-draft-restored', undefined, 'Actual article draft after shared-profile close/reopen; original identities and data retained.');
}

export async function inspectArticlePrivacyBoundaries(page, driver, meta, controls) {
    const originalModel = await page.evaluate(() => JSON.stringify(window.orderItems));
    const cases = [
        { mode: 'unknown-title', selector: '.order-item-name', index: 0, expected: 'Synthetic private custom title06' },
        { mode: 'unknown-description', selector: '.discount-description', index: 0, expected: 'Synthetic private discount note06' },
        { mode: 'coupon-description', selector: '.discount-description', index: 1, expected: 'Synthetic coupon quote fixture (THEME06)' }
    ];
    try {
        for (const item of cases) {
            controls.quoteVariant = item.mode;
            if (item.mode === 'coupon-description') {
                await page.locator('#couponCode').fill('THEME06'); await page.locator('#couponCode').press('Enter');
                await page.locator('.coupon-remove').waitFor({ state: 'visible' });
            } else await page.evaluate(() => window.renderOrderItems());
            await page.waitForFunction(item => document.querySelectorAll('#orderItemsSection ' + item.selector)[item.index]?.textContent.trim() === item.expected, item);
            await waitForArticleToasts(page);
            const result = await page.evaluate(async item => {
                const root = document.getElementById('orderItemsSection'), target = root.querySelectorAll(item.selector)[item.index];
                if (!target || target.textContent.trim() !== item.expected) throw new Error('Declared privacy-boundary text is required.');
                const hasPublicAncestor = Boolean(target.closest('[data-feedback-public]'));
                const snapshot = () => ({ html: root.outerHTML, fields: [...root.querySelectorAll('input,select,textarea')]
                    .map(node => ({ value: node.value, checked: node.checked, selectedIndex: node.selectedIndex, readonly: node.readOnly, disabled: node.disabled })) });
                const before = snapshot(), bounds = root.getBoundingClientRect(), box = target.getBoundingClientRect();
                const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
                const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js'));
                const { captureElementScreenshot } = await import(imports[key]);
                const domToImage = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default;
                const originalToBlob = domToImage.toBlob, texts = [];
                domToImage.toBlob = async (node, options) => originalToBlob.call(domToImage, node, { ...options, onclone(clone) {
                    const value = options.onclone(clone);
                    texts.push(clone.querySelectorAll(item.selector)[item.index].textContent.trim());
                    return value;
                } });
                let capture;
                try { capture = await captureElementScreenshot({ element: root }); }
                finally { domToImage.toBlob = originalToBlob; }
                const toPixels = async variant => {
                    const bitmap = await createImageBitmap(variant.blob), canvas = document.createElement('canvas');
                    canvas.width = bitmap.width; canvas.height = bitmap.height;
                    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
                    return { context, width: canvas.width, height: canvas.height };
                };
                const original = await toPixels(capture.original), pseudo = await toPixels(capture.pseudonymized), scale = pseudo.width / bounds.width;
                const x = Math.max(0, Math.round((box.x - bounds.x + 1) * scale)), y = Math.max(0, Math.round((box.y - bounds.y + 1) * scale));
                const width = Math.min(pseudo.width - x, Math.floor((box.width - 2) * scale));
                const height = Math.min(pseudo.height - y, Math.floor((box.height - 2) * scale));
                if (width <= 0 || height <= 0) throw new Error('Actual private text region must be covered.');
                const a = original.context.getImageData(x, y, width, height).data, b = pseudo.context.getImageData(x, y, width, height).data;
                let changedPixels = 0;
                for (let offset = 0; offset < a.length; offset += 4) if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2]) changedPixels++;
                const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(capture.pseudonymized.blob); });
                return { png, texts, hasPublicAncestor, changedPixels, privacy: capture.privacySummary,
                    rawLiveExact: JSON.stringify(before) === JSON.stringify(snapshot()), observerRestored: domToImage.toBlob === originalToBlob,
                    dimensionsMatch: original.width === pseudo.width && original.height === pseudo.height,
                    width: pseudo.width, height: pseudo.height };
            }, item);
            driver.check('production privacy keeps ' + item.mode + ' outside public marker ancestry and masks actual text pixels', !result.hasPublicAncestor
                && result.texts.length === 2 && result.texts[0] === item.expected && result.texts[1] !== item.expected
                && result.changedPixels > 0 && result.rawLiveExact && result.observerRestored && result.dimensionsMatch
                && result.privacy.verified && result.privacy.unresolvedValues === 0 && result.privacy.resourceFailures === 0,
            true, { ...meta, fixtureCase: item, result: { ...result, png: undefined } }, 6);
            const filename = `${meta.viewport.width}x${meta.viewport.height}-article-private-negative-${item.mode}.png`;
            await writeFile(path.join(driver.evidenceDir, filename), Buffer.from(result.png.split(',')[1], 'base64'));
            driver.report.captures.push({ name: 'article-private-negative-' + item.mode, filename, viewport: meta.viewport,
                kind: 'Actual production capture of declared unknown quote text/coupon description; original kiwiApi/renderer retained, synthetic data only.',
                captureMethod: 'Actual production captureElementScreenshot', geometry: { width: result.width, height: result.height } });
        }
    } finally {
        controls.quoteVariant = 'normal';
        if (await page.locator('.coupon-remove').count()) await page.locator('.coupon-remove').press('Enter');
        await page.evaluate(() => window.renderOrderItems());
    }
    driver.check('privacy-boundary response variants retain the exact underlying article selection model', await page.evaluate(() => JSON.stringify(window.orderItems)), originalModel, meta, 6);
}
