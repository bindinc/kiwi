#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// theme_audit: actual controlled application states supplement the shared comparison runner.
const companionPath = fileURLToPath(import.meta.url);
const companionProvenance = {
    path: companionPath,
    sourceSha256: createHash('sha256').update(await readFile(companionPath)).digest('hex')
};
const finalSource = process.env.KIWI_THEME_AUDIT_FINAL_SOURCE === '1';
const finalReference = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
const controlScenarios = process.env.KIWI_THEME_AUDIT_CONTROL_SCENARIOS || 'extended';
if (!['extended', 'choices'].includes(controlScenarios)) throw new Error('Use extended or choices for KIWI_THEME_AUDIT_CONTROL_SCENARIOS.');

export async function inspectControls(driver, viewport, contract) {
    if (finalSource && (contract.referenceSha256 !== finalReference || contract.inputFocus?.outlineWidth !== '2px'
        || contract.inputFocus.outlineOffset !== '0px' || contract.inputFocus.boxShadow !== 'none')) {
        throw new Error('Final field checks require an actual measured reference67 focus contract.');
    }
    if (controlScenarios === 'choices') return inspectChoiceValues(driver, viewport, contract);
    const {
        actionChecks, baseUrl, capture, check, compositedTextContrast, controlChecks, evidenceDir,
        keyboardFocus, login, newContext, painted, report, saveReport, trackStylesheets, unverified
    } = driver;
    report.fixtureEvidence = {
        kind: 'Actual local application renderers with controlled in-memory/GET data and intercepted read-only quote calculations.',
        companion: companionProvenance,
        limitations: 'No backend price/coupon/duplicate acceptance, customer selection, identity-warning acknowledgement or business submission.'
    };
    const kind = 'actual local application renderers with controlled offer GET and read-only quote POST fixtures';
    const metadata = { viewport, kind };
    const context = await newContext({ width: viewport.width, height: Math.max(viewport.height, 1000) });
    const page = await context.newPage();
    const finishAssets = trackStylesheets(page, viewport);
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.errors.push({ scenario: 'additional action runtime', viewport, message: error.message }));
    report.readOnlyQuoteFixtures ||= [];
    report.additionalActionCoverage ||= [];
    const quotePath = new URL('api/v1/catalog/article-order-quote', baseUrl).pathname;
    const offersPath = new URL('api/v1/webabo/offers', baseUrl).pathname;
    await page.route(url => url.origin === baseUrl.origin && url.pathname === quotePath, async route => {
        if (route.request().method() !== 'POST') return route.fallback();
        report.readOnlyQuoteFixtures.push({ method: route.request().method(), path: new URL(route.request().url()).pathname,
            kind: 'Synthetic response to a read-only price calculation; request never reaches backend.' });
        await route.fulfill({ json: {
            items: [{ articleId: 9501, name: 'Synthetic action article', code: 'THEME', magazine: 'Fixture', unitPrice: 10, quantity: 1 }],
            subtotal: 10, total: 9, totalDiscount: 1, couponCode: 'THEME', coupon: { valid: true, code: 'THEME', type: 'fixed', amount: 1 },
            discounts: [{ type: 'Synthetic coupon', description: 'Read-only renderer fixture', amount: 1, isCoupon: true }]
        } });
    });
    await page.route(url => url.origin === baseUrl.origin && (url.pathname === offersPath || url.pathname.startsWith(offersPath + '/')), async route => {
        const url = new URL(route.request().url());
        if (route.request().method() !== 'GET') return route.fallback();
        if (url.pathname.endsWith('/salescodecombinations')) {
            return route.fulfill({ json: { items: [
                { key: 'TM/IB', codes: ['TM', 'IB'], label: 'Synthetic telephone channel', detail: 'Controlled GET fixture' },
                { key: 'OL', codes: ['OL'], label: 'Synthetic online channel', detail: 'Controlled GET fixture' }
            ] } });
        }
        return route.fulfill({ json: { total: 2, items: [
            { salesCode: 'THEME-ACTIVE', title: 'Synthetic long product title for actual choice rendering', magazine: 'Fixture guide', price: 10,
                mandant: 'HMC', divisionId: '14', allowedChannels: ['TM/IB', 'OL'], isActive: true },
            { salesCode: 'THEME-INACTIVE', title: 'Synthetic inactive product', magazine: 'Fixture guide', price: 12,
                mandant: 'HMC', divisionId: '14', allowedChannels: ['OL'], isActive: false }
        ] } });
    });
    async function family(state, root, classes) {
        await actionChecks(page, contract, state, root, kind);
        for (const className of classes) {
            const count = await page.locator(root).locator('.' + className + ':visible').count();
            check(className + ' actual renderer coverage', count > 0, true, { ...metadata, state, count }, 2);
            report.additionalActionCoverage.push({ className, count, state, viewport, kind });
        }
    }
    async function tabWithoutActivation(selector, state, unchanged) {
        const button = page.locator(selector).first();
        await button.focus();
        check(state + ' starting keyboard target is active', await button.evaluate(node => node === document.activeElement), true, metadata, 2);
        await page.keyboard.press('Tab');
        check(state + ' Tab does not activate action', await unchanged(), true, metadata, 2);
    }
    async function inspectDialog(state, rootSelector) {
        let hoverReachable = true;
        for (const selector of ['.btn-primary:visible:not(:disabled)', '.form-actions .btn-secondary:visible:not(.ghost):not(:disabled)']) {
            const button = page.locator(rootSelector).locator(selector).first();
            if (!await button.count()) continue;
            await button.scrollIntoViewIfNeeded();
            const inside = await button.evaluate(node => {
                const bounds = node.getBoundingClientRect();
                const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
                return x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight;
            });
            if (!inside) hoverReachable = false;
        }
        await controlChecks(page, contract, state, rootSelector, kind, { inspectHover: hoverReachable });
        if (!hoverReachable) {
            unverified(state + ' hover remains unreachable after scrolling',
                'Actual dialog containment prevents pointer access. Shared field/action geometry is measured separately; no hover pass is claimed.',
                { ...metadata, state }, viewport.height <= 320 ? 8 : 2);
        }
    }
    async function canonicalFields(state, ids) {
        report.canonicalModalFields ||= [];
        for (const id of ids) {
            const field = page.locator('#' + id);
            check(id + ' actual conditional field coverage', await field.count(), 1, { ...metadata, state }, 2);
            await field.scrollIntoViewIfNeeded();
            await page.keyboard.press('Tab');
            await field.focus();
            if (finalSource) await painted(page);
            const observed = await field.evaluate(node => {
                const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
                return {
                    id: node.id, active: document.activeElement === node, visible: node.matches(':focus-visible'),
                    tag: node.tagName, type: node.type, role: node.getAttribute('role'),
                    outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset, outlineColor: style.outlineColor, boxShadow: style.boxShadow,
                    bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: innerWidth, height: innerHeight }
                };
            });
            const ordinaryField = ['SELECT', 'TEXTAREA'].includes(observed.tag) || (observed.tag === 'INPUT'
                && !['radio', 'checkbox', 'hidden', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(observed.type));
            const focusPaint = finalSource && ordinaryField
                ? observed.outlineWidth === contract.inputFocus.outlineWidth && observed.outlineOffset === contract.inputFocus.outlineOffset
                    && observed.outlineColor === contract.inputFocus.outlineColor && observed.boxShadow === contract.inputFocus.boxShadow
                : observed.outlineWidth === '3px' && observed.outlineColor === 'rgb(73, 98, 117)' && observed.boxShadow === 'none';
            check(id + ' single canonical keyboard focus paint', observed.active && observed.visible && focusPaint,
                true, { ...metadata, state, observed }, 2);
            const bounds = observed.bounds;
            check(id + ' focused field fits viewport after scrolling', bounds.left >= 0 && bounds.right <= bounds.width
                && bounds.top >= 0 && bounds.bottom <= bounds.height,
                true, { ...metadata, state, observed, reason: 'Dialog containment remains independently required in slice 08; correct focus paint is not a containment pass.' }, 8);
            report.canonicalModalFields.push({ state, viewport, observed });
        }
    }
    try {
        await login(page);
        await page.setViewportSize(viewport);
        await family('filters collapsed', '.search-card', ['additional-filters-toggle']);
        await page.locator('#additionalFiltersToggle').press('Enter');
        await page.locator('#searchName').waitFor({ state: 'visible' });
        await family('filters expanded', '.search-card', ['additional-filters-toggle']);
        await capture(page, 'additional-filters', undefined, kind);

        await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
        await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
        await page.locator('#articleSearch').fill('a');
        await page.locator('#articleDropdown').waitFor({ state: 'visible' });
        await family('article browse action', '#articleDropdown', ['browse-all-link']);
        await capture(page, 'browse-all-action', undefined, kind);
        await page.locator('#articleDropdown .browse-all-link').first().press('Enter');
        await page.locator('#allArticlesModal').waitFor({ state: 'visible' });
        await family('catalog default tabs', '#allArticlesModal', ['article-tab']);
        const catalogClose = page.locator('#allArticlesModal .modal-header .btn-close');
        check('catalog close default inverse foreground', await catalogClose.evaluate(node => getComputedStyle(node).color), 'rgb(255, 255, 255)', metadata, 2);
        await catalogClose.hover(); await painted(page);
        const closeHoverContrast = await compositedTextContrast(catalogClose);
        check('catalog close hover inverse foreground', await catalogClose.evaluate(node => getComputedStyle(node).color), 'rgb(255, 255, 255)', metadata, 2);
        check('catalog close actual hover contrast', closeHoverContrast.supported && closeHoverContrast.ratio >= 3, true, { ...metadata, contrast: closeHoverContrast }, 2);
        await capture(page, 'catalog-inverse-close-hover', undefined, kind);
        await page.mouse.move(0, 0);
        await keyboardFocus(page, '#allArticlesModal .modal-header .btn-close', 'catalog inverse close');
        const closeFocus = await catalogClose.evaluate(node => ({ color: getComputedStyle(node).outlineColor, width: getComputedStyle(node).outlineWidth, visible: node.matches(':focus-visible') }));
        check('catalog close inverse keyboard focus', closeFocus.visible && closeFocus.color === 'rgb(255, 255, 255)' && Number.parseFloat(closeFocus.width) >= 3, true, { ...metadata, closeFocus }, 2);
        await capture(page, 'catalog-inverse-close-keyboard', undefined, kind);
        await page.evaluate(() => {
            window.__themeArticleTabClicks = 0;
            document.addEventListener('click', event => {
                if (event.target.closest('.article-tab')) window.__themeArticleTabClicks++;
            }, true);
        });
        await page.locator('.article-tab[data-tab="all"]').focus();
        await page.keyboard.press('Tab');
        check('catalog Tab preserves active tab', await page.locator('.article-tab.active').getAttribute('data-tab'), 'all', metadata, 2);
        check('catalog Tab reaches next native tab', await page.locator('.article-tab[data-tab="popular"]').evaluate(node => document.activeElement === node && node.matches(':focus-visible')), true, metadata, 2);
        await page.keyboard.press('Space');
        check('catalog Space selects popular tab', await page.locator('.article-tab.active').getAttribute('data-tab'), 'popular', metadata, 2);
        check('catalog native Space activates exactly once', await page.evaluate(() => window.__themeArticleTabClicks), 1, metadata, 2);
        await family('catalog selected tabs', '#allArticlesModal', ['article-tab']);
        await capture(page, 'catalog-tabs-keyboard', undefined, kind);
        await page.locator('#allArticlesModal [data-action="close-all-articles-modal"]').press('Enter');

        await page.evaluate(async () => {
            window.orderItems = [{ articleId: 9501, name: 'Synthetic action article', code: 'THEME', magazine: 'Fixture', unitPrice: 10, quantity: 1 }];
            await window.renderOrderItems();
        });
        await page.locator('.order-item-remove').waitFor({ state: 'visible' });
        await family('actual populated cart and quote coupon', '#articleSaleForm', ['order-item-remove', 'coupon-remove']);
        for (const locale of ['nl', 'en']) {
            await page.evaluate(async locale => { window.i18n.setLocale(locale); await window.renderOrderItems(); }, locale);
            const expected = locale === 'nl'
                ? ['Artikel uit bestelling verwijderen', 'Kortingscode verwijderen']
                : ['Remove article from order', 'Remove coupon'];
            for (const [index, selector] of ['.order-item-remove', '.coupon-remove'].entries()) {
                const label = await page.locator(selector).first().getAttribute('aria-label');
                check(selector + ' localized meaningful aria label', label, expected[index], { ...metadata, locale }, 2);
                check(selector + ' localized title agrees', await page.locator(selector).first().getAttribute('title'), label, { ...metadata, locale }, 2);
            }
            await page.locator('.order-item-remove').scrollIntoViewIfNeeded();
            await page.keyboard.press('Tab');
            await page.locator('.order-item-remove').focus();
            const focused = await page.locator('.order-item-remove').evaluate(node => {
                const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
                return { active: document.activeElement === node, visible: node.matches(':focus-visible'), shadow: style.boxShadow,
                    outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset, outlineColor: style.outlineColor,
                    bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: innerWidth, height: innerHeight } };
            });
            const inverseOutline = focused.outlineColor === 'rgb(255, 255, 255)' && Number.parseFloat(focused.outlineWidth) >= 3 && Number.parseFloat(focused.outlineOffset) < 0;
            const inverseShadow = focused.shadow.includes('inset') && focused.shadow.includes('255, 255, 255');
            check('filled order removal has visible inverse inset focus', focused.active && focused.visible && (inverseOutline || inverseShadow), true, { ...metadata, locale, focused }, 2);
            await capture(page, 'cart-coupon-focus-' + locale, undefined, kind);
            const closeup = viewport.width + 'x' + viewport.height + '-remove-focus-' + locale + '.png';
            await page.locator('.order-item-remove').screenshot({ path: path.join(evidenceDir, closeup), animations: 'disabled' });
            const pixels = await page.evaluate(async ({ dataUrl, focused }) => {
                const image = new Image(); image.src = dataUrl; await image.decode();
                const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
                const { width, height } = canvas; const rgba = context.getImageData(0, 0, width, height).data;
                const rgbAt = (x, y) => [...rgba.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
                const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
                const contrast = (one, two) => { const values = [luminance(one), luminance(two)].sort((a, b) => a - b); return (values[1] + .05) / (values[0] + .05); };
                const bounds = focused.bounds;
                const cssWidth = bounds.right - bounds.left, cssHeight = bounds.bottom - bounds.top;
                const inset = Math.abs(Number.parseFloat(focused.outlineOffset));
                const stroke = Number.parseFloat(focused.outlineWidth);
                const fractionX = bounds.left - Math.floor(bounds.left), fractionY = bounds.top - Math.floor(bounds.top);
                const left = Math.round(fractionX + inset - stroke / 2), right = Math.round(fractionX + cssWidth - inset + stroke / 2);
                const top = Math.round(fractionY + inset - stroke / 2), bottom = Math.round(fractionY + cssHeight - inset + stroke / 2);
                const insideLeft = Math.ceil(fractionX + inset + 1), insideRight = Math.floor(fractionX + cssWidth - inset - 1);
                const insideTop = Math.ceil(fractionY + inset + 1), insideBottom = Math.floor(fractionY + cssHeight - inset - 1);
                const edges = { top: [], bottom: [], left: [], right: [] };
                for (let x = Math.ceil(fractionX + inset); x < Math.floor(fractionX + cssWidth - inset); x++) {
                    edges.top.push(contrast(rgbAt(x, top), rgbAt(x, insideTop)));
                    edges.bottom.push(contrast(rgbAt(x, bottom), rgbAt(x, insideBottom)));
                }
                for (let y = Math.ceil(fractionY + inset); y < Math.floor(fractionY + cssHeight - inset); y++) {
                    edges.left.push(contrast(rgbAt(left, y), rgbAt(insideLeft, y)));
                    edges.right.push(contrast(rgbAt(right, y), rgbAt(insideRight, y)));
                }
                return { width, height, method: 'Actual geometry-derived stroke center versus adjacent rendered red fill; source white focus may be composited by a floating shadow.',
                    sampling: { left, right, top, bottom, insideLeft, insideRight, insideTop, insideBottom, fractionX, fractionY, cssWidth, cssHeight, inset, stroke },
                    visibleEdgePixels: Object.fromEntries(Object.entries(edges).map(([edge, values]) => [edge, values.filter(ratio => ratio >= 3).length])),
                    edgeContrast: Object.fromEntries(Object.entries(edges).map(([edge, values]) => [edge, { samples: values.length, minimum: Math.min(...values), maximum: Math.max(...values) }])) };
            }, { dataUrl: 'data:image/png;base64,' + (await readFile(path.join(evidenceDir, closeup))).toString('base64'), focused });
            check('actual filled removal screenshot shows four inverse focus edges',
                pixels.visibleEdgePixels.top >= pixels.width / 2 && pixels.visibleEdgePixels.bottom >= pixels.width / 2
                    && pixels.visibleEdgePixels.left >= pixels.height / 2 && pixels.visibleEdgePixels.right >= pixels.height / 2,
                true, { ...metadata, locale, pixels, filename: closeup }, 2);
            report.captures.push({ name: 'actual order remove focus pixels ' + locale, filename: closeup, viewport, kind,
                captureMethod: 'Actual focused production-rendered button closeup; not a CSS class specimen' });
        }
        await page.evaluate(async () => { window.i18n.setLocale('nl'); await window.renderOrderItems(); });
        const quoteCount = report.readOnlyQuoteFixtures.length;
        await tabWithoutActivation('.order-item-remove', 'order remove', () => page.evaluate(() => window.orderItems.length === 1));
        await tabWithoutActivation('.coupon-remove', 'coupon remove', async () => report.readOnlyQuoteFixtures.length === quoteCount);
        await page.locator('#articleSaleForm [data-action="close-article-sale-form"]').first().press('Enter');

        await page.locator('[data-action="show-new-subscription"]').first().press('Enter');
        await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
        await page.locator('#werfsleutelInput').fill('THEME');
        await page.locator('.werfsleutel-suggestion').first().waitFor({ state: 'visible' });
        await family('controlled GET product suggestions', '#newSubscriptionForm', ['werfsleutel-suggestion']);
        await capture(page, 'product-suggestions', undefined, kind);
        await page.locator('.werfsleutel-suggestion[data-code="THEME-ACTIVE"]').press('Enter');
        await page.locator('.channel-chip').first().waitFor({ state: 'visible' });
        await family('actual selected offer and channels', '#newSubscriptionForm', ['subscription-offer-toggle', 'channel-chip']);
        await capture(page, 'product-channel-choices', undefined, kind);
        await page.locator('.channel-chip').first().press('Enter');
        if (!(await page.locator('.channel-chip').first().isVisible())) await page.locator('.subscription-offer-toggle').first().press('Enter');
        await page.locator('.channel-chip.selected').waitFor({ state: 'visible' });
        await family('actual selected channel', '#newSubscriptionForm', ['subscription-offer-toggle', 'channel-chip']);
        await capture(page, 'product-channel-selected', undefined, kind);
        await page.evaluate(() => {
            const runtime = window.kiwiSubscriptionRoleRuntime;
            runtime.setSubscriptionRoleMode('recipient', 'create');
            const duplicate = runtime.getSubscriptionDuplicateRoleState('recipient');
            duplicate.strongMatches = [{ id: 9511, firstName: 'Alex', initials: 'A.', lastName: 'Synthetic duplicate', postalCode: '1234AB', houseNumber: '10', address: 'Teststraat 10', city: 'Teststad', mandant: 'HMC' }];
            duplicate.lastFingerprint = 'theme-audit-controlled-renderer';
            duplicate.isChecking = false; duplicate.isExpanded = false; duplicate.acknowledgedFingerprint = '';
            runtime.renderSubscriptionDuplicateCheck('recipient');
        });
        await family('actual duplicate warning controls', '#recipientDuplicateCheck', ['subscription-duplicate-action']);
        await page.locator('#recipientDuplicateCheck [data-action="toggle-subscription-duplicate-matches"]').press('Enter');
        await page.locator('#recipientDuplicateCheck [data-action="select-subscription-duplicate-person"]').waitFor({ state: 'visible' });
        await family('actual expanded duplicate match', '#recipientDuplicateCheck', ['subscription-duplicate-action']);
        await capture(page, 'duplicate-actions-expanded', undefined, kind);
        await tabWithoutActivation('#recipientDuplicateCheck .warning', 'duplicate create-anyway warning', () => page.evaluate(() => window.kiwiSubscriptionRoleRuntime.getSubscriptionDuplicateRoleState('recipient').acknowledgedFingerprint === ''));
        await page.locator('#newSubscriptionForm [data-action="close-form"]').first().press('Enter');

        await page.evaluate(finalSource => {
            currentCustomer = { id: 9531, firstName: 'Alex', lastName: 'Synthetic delivery fixture',
                sourceSystem: 'theme-audit-local', deliveryRemarks: { default: '' } };
            if (finalSource) Object.assign(currentCustomer, { initials: 'A.', middleName: '', postalCode: '1234AB',
                houseNumber: '10', houseNumberAddition: '', address: 'Synthetic street 10', city: 'Synthetic town',
                countryCode: 'NL', email: 'synthetic-delivery@example.invalid', phone: '0209462718' });
            window.kiwiDeliveryRemarksSlice.editDeliveryRemarks();
        }, finalSource);
        await page.locator('#editDeliveryRemarksModal').waitFor({ state: 'visible' });
        await inspectDialog('installed delivery-notes modal fields and actions', '#editDeliveryRemarksModal');
        await canonicalFields('installed delivery-notes modal', ['editCustomerDeliveryRemarks']);
        await page.locator('#editCustomerDeliveryRemarks').scrollIntoViewIfNeeded();
        await capture(page, 'delivery-notes-controls', undefined, kind);
        await page.evaluate(() => window.kiwiDeliveryRemarksSlice.closeEditRemarksModal());

        await page.evaluate(() => window.kiwiCallAgentRuntime.showDispositionModal());
        await page.locator('#dispNotes').waitFor({ state: 'visible' });
        await page.locator('#dispFollowUpRequired').check();
        await page.locator('#dispFollowUpNotes').waitFor({ state: 'visible' });
        await inspectDialog('actual disposition notes and conditional follow-up', '#dispositionModal');
        await canonicalFields('actual disposition notes and conditional follow-up', ['dispNotes', 'dispFollowUpNotes']);
        await page.locator('#dispFollowUpNotes').scrollIntoViewIfNeeded();
        await capture(page, 'disposition-canonical-fields', undefined, kind);
        await page.evaluate(() => window.kiwiCallAgentRuntime.cancelDisposition());

        await page.evaluate(() => window.kiwiCallAgentRuntime.openDebugModal());
        await page.locator('#debugModal').waitFor({ state: 'visible' });
        await page.locator('#debugCallerType').selectOption('known');
        await page.locator('#debugKnownCustomer').waitFor({ state: 'visible' });
        await inspectDialog('actual development dialog ordinary fields', '#debugModal');
        await canonicalFields('actual development dialog ordinary fields', [
            'debugServiceNumber', 'debugWaitTime', 'debugCallerType', 'debugKnownCustomer', 'debugQueueSize', 'debugQueueMix'
        ]);
        await page.locator('#debugQueueSize').scrollIntoViewIfNeeded();
        await capture(page, 'debug-canonical-fields', undefined, kind);
        await page.locator('#debugCallerType').selectOption('anonymous');
        await page.locator('#debugModal [data-action="debug.close-modal"]').press('Enter');

        await page.locator('#contextualFeedbackSettingsButton').press('Enter');
        await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' });
        await controlChecks(page, contract, 'actual settings text action roles', '.contextual-feedback-settings-modal', kind);
        await capture(page, 'settings-text-actions', undefined, kind);
        await page.locator('[data-feedback-settings-close]').first().press('Enter');
        await page.locator('#contextualFeedbackButton').evaluate(node => node.click());
        await page.locator('.contextual-feedback-modal').waitFor({ state: 'visible' });
        await controlChecks(page, contract, 'actual feedback text action roles', '.contextual-feedback-modal', kind);
        await capture(page, 'feedback-text-actions', undefined, kind);
        await page.keyboard.press('Escape');
    } catch (error) {
        report.errors.push({ scenario: 'additional actual action fixtures', viewport, message: error.message });
        await capture(page, 'additional-action-failure', undefined, kind).catch(() => {});
    } finally {
        await finishAssets();
        await context.close();
        await saveReport();
    }
}

async function inspectChoiceValues(driver, viewport, contract, deviceScaleFactor = 1) {
    const { baseUrl, capture, check, choiceStyleChecks, consentStateChecks, evidenceDir, login,
        newContext, painted, paymentChecks, referenceUrl, report, saveReport, trackStylesheets } = driver;
    const kind = 'Actual isolated local payment/consent state; no submission or copied reference defaults.';
    const metadata = { viewport, kind, deviceScaleFactor };
    const prefix = deviceScaleFactor === 2 ? 'dpr2-' : '';
    report.fixtureEvidence = { kind, nativePaintPolicy: {
        normalScale: 'DPR1 UI and raw raster observations remain separate from intended native color.',
        underlyingColor: 'DPR2 actual same-widget stroke cores; 100% browser zoom, not native 200% zoom.',
        rationale: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html'
    }, companion: companionProvenance, scenarioSet: 'choices',
        disabledProbe: 'Temporary disabled property on actual rendered controls, restored exactly; not a permission/workflow acceptance claim.' };
    report.nativeChoicePixels ||= [];
    const context = await newContext({ width: viewport.width, height: Math.max(viewport.height, 1000) }, true, deviceScaleFactor);
    const page = await context.newPage();
    const finishAssets = trackStylesheets(page, viewport);
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.errors.push({ scenario: 'choice values runtime', viewport, message: error.message }));
    async function disabledProbe(rootSelector, state) {
        const inputs = page.locator(rootSelector).locator('.payment-option input[type="radio"],.optin-options input[type="radio"]');
        const original = await inputs.evaluateAll(nodes => nodes.map(node => ({
            key: node.id || node.name + ':' + node.value, disabled: node.disabled, checked: node.checked
        })));
        await inputs.evaluateAll(nodes => nodes.forEach(node => { node.disabled = true; }));
        try {
            check(state + ' controlled disabled fixture is populated', original.length > 0, true, metadata, 2);
            check(state + ' fixture remains disabled', await inputs.evaluateAll(nodes => nodes.every(node => node.disabled)), true, metadata, 2);
            await choiceStyleChecks(page, contract, state + ' controlled disabled rendering', rootSelector,
                'Controlled disabled-state probe on actual rendered choices; no workflow permission claim.');
            await capture(page, prefix + state + '-disabled-choice-values', undefined, 'Controlled disabled-state probe on actual rendered choices');
        } finally {
            await inputs.evaluateAll((nodes, previous) => {
                if (nodes.length !== previous.length) throw new Error('Choice nodes changed during controlled disabled probe.');
                nodes.forEach((node, index) => {
                    if ((node.id || node.name + ':' + node.value) !== previous[index].key) throw new Error('Choice identity changed during controlled disabled probe.');
                    node.disabled = previous[index].disabled;
                });
            }, original);
        }
        const restored = await inputs.evaluateAll(nodes => nodes.map(node => ({ key: node.id || node.name + ':' + node.value, disabled: node.disabled, checked: node.checked })));
        check(state + ' original disabled and checked states restored', JSON.stringify(restored), JSON.stringify(original), metadata, 2);
    }
    async function nativePixels(selector, state, sourceKind = 'actual application') {
        state = prefix + state;
        const input = page.locator(selector).first();
        if (!await input.count()) throw new Error('Missing actual native marker: ' + selector);
        await page.mouse.move(0, 0); await input.blur(); await painted(page);
        const observed = await input.evaluate(node => ({ checked: node.checked, disabled: node.disabled,
            width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height,
            appearance: getComputedStyle(node).appearance, deviceScaleFactor: devicePixelRatio }));
        check(state + ' enabled native marker fixture', !observed.disabled && observed.appearance === 'auto', true, { ...metadata, observed }, 2);
        check(state + ' actual requested device scale', observed.deviceScaleFactor, deviceScaleFactor, { ...metadata, observed }, 2);
        check(state + ' native marker minimum geometry', observed.width >= 20 && observed.height >= 20, true, { ...metadata, observed }, 2);
        const filename = viewport.width + 'x' + viewport.height + '-native-choice-' + state + '.png';
        const filePath = path.join(evidenceDir, filename);
        await input.screenshot({ path: filePath, animations: 'disabled' });
        const pixels = await page.evaluate(async dataUrl => {
            const image = new Image(); image.src = dataUrl; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const { width, height } = canvas, rgba = context.getImageData(0, 0, width, height).data;
            const rgbAt = (x, y) => [...rgba.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
            const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
            let whitePixels = 0;
            const signal = [];
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                const rgb = rgbAt(x, y);
                if (rgb.every(value => value === 255)) whitePixels++;
                // Locate the painted glyph independently of the contrast gate. This also
                // excludes the extra background row/column from fractional clipping.
                if (Math.max(...rgb) < 230) signal.push({ x, y });
            }
            if (!signal.length) return { width, height, whitePixels, bounds: null, quadrants: [] };
            const bounds = { left: Math.min(...signal.map(p => p.x)), right: Math.max(...signal.map(p => p.x)),
                top: Math.min(...signal.map(p => p.y)), bottom: Math.max(...signal.map(p => p.y)) };
            const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
            const radii = { x: (bounds.right - bounds.left + 1) / 2, y: (bounds.bottom - bounds.top + 1) / 2 };
            const quadrants = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(name => {
                const samples = [];
                for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                    const dx = x - center.x, dy = y - center.y;
                    const quadrant = (dy < 0 ? 'top-' : 'bottom-') + (dx < 0 ? 'left' : 'right');
                    const radius = Math.hypot(dx / radii.x, dy / radii.y);
                    if (quadrant === name && radius >= .72 && radius <= 1.08) samples.push({ x, y, rgb: rgbAt(x, y) });
                }
                // Locate repeated outer-stroke cores before evaluating their contrast.
                // Whole quadrants avoid treating a fractional cardinal AA pixel as the stroke.
                samples.sort((one, two) => luminance(one.rgb) - luminance(two.rgb));
                const cores = samples.slice(0, 2).map(core => {
                    const dx = core.x - center.x, dy = core.y - center.y, distance = Math.hypot(dx, dy);
                    const backing = [1, 2, 3, 4].map(step => ({
                        x: Math.round(core.x - dx / distance * step),
                        y: Math.round(core.y - dy / distance * step)
                    })).filter(p => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height)
                        .map(p => ({ ...p, rgb: rgbAt(p.x, p.y) }))
                        .find(p => p.rgb.every(value => value === 255)) || null;
                    return { core, backing,
                        contrast: backing ? (luminance(backing.rgb) + .05) / (luminance(core.rgb) + .05) : 0 };
                });
                return { name, cores };
            });
            return { width, height, whitePixels, bounds, center, radii, quadrants };
        }, 'data:image/png;base64,' + (await readFile(filePath)).toString('base64'));
        check(state + ' actual native white backing pixels', pixels.whitePixels >= pixels.width * pixels.height * .1, true, { ...metadata, pixels }, 2);
        check(state + ' detected native boundary spans the glyph', Boolean(pixels.bounds && pixels.bounds.right - pixels.bounds.left + 1 >= pixels.width * .75 && pixels.bounds.bottom - pixels.bounds.top + 1 >= pixels.height * .75), true, { ...metadata, pixels }, 2);
        check(state + ' repeated native boundary in all four quadrants', pixels.quadrants?.length === 4 && pixels.quadrants.every(quadrant => quadrant.cores.length === 2 && quadrant.cores.every(sample => sample.backing)), true, { ...metadata, pixels }, 2);
        if (deviceScaleFactor === 2) {
            check(state + ' underlying native marker contrast', pixels.quadrants?.length === 4 && pixels.quadrants.every(quadrant => quadrant.cores.every(sample => sample.contrast >= 3)), true, { ...metadata, pixels, sourceKind }, 2);
        }
        report.nativeChoicePixels.push({ state, selector, viewport, deviceScaleFactor, sourceKind, observed, pixels, filename,
            scope: deviceScaleFactor === 2 ? 'Actual intended native stroke color at device scale2/100% browser zoom; not native 200% zoom.' : 'Actual DPR1 raster observation, including antialiasing; not an underlying-color contrast verdict.' });
        report.captures.push({ name: state + ' native marker pixels', filename, viewport,
            kind: sourceKind === 'actual rendered showcase' ? 'Actual rendered showcase native counterpart' : kind,
            captureMethod: 'Actual native input screenshot at declared device scale; no CSS specimen or browser zoom simulation.' });
    }
    try {
        await login(page); await page.setViewportSize(viewport);
        await page.locator('[data-action="show-new-subscription"]').first().press('Enter');
        await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
        await choiceStyleChecks(page, contract, 'subscription initial real values', '#newSubscriptionForm', kind);
        await paymentChecks(page, contract, { rootSelector: '#newSubscriptionForm', state: prefix + 'choice-subscription',
            firstId: 'subPaymentAuto', secondId: 'subPaymentInstruction', ibanId: 'subIBAN' });
        await nativePixels('#subPaymentAuto', 'subscription-checked');
        await nativePixels('#subPaymentInstruction', 'subscription-unchecked');
        await consentStateChecks(page, contract, '#newSubscriptionForm', prefix + 'choice-subscription');
        await nativePixels('#newSubscriptionForm .optin-options input[name="subOptinEmail"][value="yes"]', 'consent-unchecked');
        await nativePixels('#newSubscriptionForm .optin-options input[name="subOptinEmail"][value="no"]', 'consent-checked');
        await disabledProbe('#newSubscriptionForm', 'subscription');
        await page.locator('#newSubscriptionForm [data-action="close-form"]').first().press('Enter');
        await page.locator('[data-action="open-article-sale-form"]').first().press('Enter');
        await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
        await paymentChecks(page, contract, { rootSelector: '#articleSaleForm', state: prefix + 'choice-article',
            firstId: 'articlePaymentIdeal', secondId: 'articlePaymentTransfer' });
        await nativePixels('#articlePaymentIdeal', 'article-checked');
        await nativePixels('#articlePaymentTransfer', 'article-unchecked');
        await disabledProbe('#articleSaleForm', 'article');
        if (deviceScaleFactor === 2) {
            await page.goto(referenceUrl);
            await nativePixels('.subscription-choice input:checked', 'reference-payment-checked', 'actual rendered showcase');
            await nativePixels('.subscription-choice input:not(:checked)', 'reference-payment-unchecked', 'actual rendered showcase');
            await nativePixels('.subscription-consent-row input', 'reference-consent-unchecked', 'actual rendered showcase');
        }
    } catch (error) {
        report.errors.push({ scenario: 'actual choice value states', viewport, message: error.message });
        await capture(page, prefix + 'choice-values-failure', undefined, kind).catch(() => {});
    } finally {
        await finishAssets(); await context.close(); await saveReport();
    }
    if (deviceScaleFactor === 1) await inspectChoiceValues(driver, viewport, contract, 2);
}

const invokedAsCommand = process.argv[1] && path.resolve(process.argv[1]) === companionPath;
if (invokedAsCommand) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./compose-smoke-theme-audit.mjs', import.meta.url))], {
        stdio: 'inherit',
        env: { ...process.env, KIWI_THEME_AUDIT_CONTROLS_ONLY: '1', KIWI_THEME_AUDIT_SLICE: process.env.KIWI_THEME_AUDIT_SLICE || '2' }
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}
