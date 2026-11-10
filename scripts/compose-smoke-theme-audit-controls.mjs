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

export async function inspectControls(driver, viewport, contract) {
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
            const observed = await field.evaluate(node => {
                const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
                return {
                    id: node.id, active: document.activeElement === node, visible: node.matches(':focus-visible'),
                    outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow,
                    bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: innerWidth, height: innerHeight }
                };
            });
            check(id + ' single canonical keyboard focus paint', observed.active && observed.visible
                && observed.outlineWidth === '3px' && observed.outlineColor === 'rgb(73, 98, 117)' && observed.boxShadow === 'none',
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

        await page.evaluate(() => {
            currentCustomer = { id: 9531, firstName: 'Alex', lastName: 'Synthetic delivery fixture',
                sourceSystem: 'theme-audit-local', deliveryRemarks: { default: '' } };
            window.kiwiDeliveryRemarksSlice.editDeliveryRemarks();
        });
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

const invokedAsCommand = process.argv[1] && path.resolve(process.argv[1]) === companionPath;
if (invokedAsCommand) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./compose-smoke-theme-audit.mjs', import.meta.url))], {
        stdio: 'inherit',
        env: { ...process.env, KIWI_THEME_AUDIT_CONTROLS_ONLY: '1', KIWI_THEME_AUDIT_SLICE: process.env.KIWI_THEME_AUDIT_SLICE || '2' }
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}
