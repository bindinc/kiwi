#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// theme_audit: BEFORE observations deliberately do not assert future layout parity.
const companionPath = fileURLToPath(import.meta.url);
const provenance = { path: companionPath, sourceSha256: createHash('sha256').update(await readFile(companionPath)).digest('hex') };
const phase = process.env.KIWI_THEME_AUDIT_SHELL_PHASE || 'before';
if (!['before', 'after'].includes(phase)) throw new Error('Shell phase must be before or after.');

export async function inspectShell(driver, viewport, contract) {
    const { capture, check, login, newContext, painted, report, saveReport, trackStylesheets } = driver;
    report.shellEvidence ||= { phase, companion: provenance, scope: 'Observed actual local shell states; no complete workflow or parity acceptance.', references: [], observations: [], keyboard: [], fixtures: [] };
    report.shellEvidence.references.push({ viewport, measuredShowcase: contract.shell });
    for (const locale of ['nl', 'en']) {
        const context = await newContext({ width: viewport.width, height: Math.max(1000, viewport.height) });
        const page = await context.newPage();
        const finishAssets = trackStylesheets(page, { ...viewport, locale });
        page.setDefaultTimeout(12000);
        page.on('pageerror', error => report.errors.push({ scenario: 'shell runtime', viewport, locale, message: error.message }));
        const prefix = phase + '-' + locale + '-shell-';
        async function settled(requireCustomer = false) {
            await page.waitForFunction(state => {
                const target = document.querySelector(state.requireCustomer ? '.customer-header' : '.main-content');
                const bounds = target?.getBoundingClientRect();
                const ready = bounds && bounds.width > 0 && bounds.height > 0
                    && (!state.requireCustomer || (!document.querySelector('#customerAddressRetry')?.disabled && scrollY === 0));
                if (!ready) { state.previous = null; state.frames = 0; return false; }
                const current = [scrollX, scrollY, bounds.x, bounds.y, bounds.width, bounds.height];
                state.frames = JSON.stringify(current) === JSON.stringify(state.previous) ? state.frames + 1 : 0;
                state.previous = current;
                return state.frames >= 2;
            }, { requireCustomer, previous: null, frames: 0 }, { polling: 'raf', timeout: 12000 });
        }
        async function observe(state, kind = 'Actual local application flow') {
            await painted(page);
            const geometry = await page.evaluate(() => {
                const selectors = ['.header', '.header-content', '.header-top', '.header-right', '.main-content', '.left-panel', '.center-panel', '.right-panel', '.history-card', '#welcomeMessage', '#searchResultsView', '.results-table-wrapper', '.results-table', '#customerDetail', '#customerWorkSessionBar', '#customerWorkSessionIdentity', '#customerWorkSessionName', '#customerWorkSessionPersonId', '#customerWorkSessionSource', '#customerWorkSessionPendingMutation', '#endCustomerWorkSessionButton', '#agentProfileTrigger', '#agentStatusMenu', '#subscriptionQueueToggle', '#subscriptionQueuePanel', '#queueInfo', '#sessionInfo', '#acwBar'];
                const elements = Object.fromEntries(selectors.map(selector => {
                    const node = document.querySelector(selector); if (!node) return [selector, null];
                    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
                    return [selector, { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
                        documentY: rect.y + scrollY, rendered: rect.width > 0 && rect.height > 0 && style.visibility === 'visible', hidden: node.hidden, display: style.display, visibility: style.visibility,
                        order: style.order, gridColumns: style.gridTemplateColumns, minWidth: style.minWidth, padding: style.padding,
                        backgroundColor: style.backgroundColor, color: style.color, borderColor: style.borderColor, boxShadow: style.boxShadow, position: style.position, zIndex: style.zIndex,
                        fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, borderRadius: style.borderRadius,
                        overflowX: style.overflowX, overflowY: style.overflowY, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
                        clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, touchAction: style.touchAction,
                        tabindex: node.getAttribute('tabindex'), role: node.getAttribute('role'), expanded: node.getAttribute('aria-expanded') }];
                }));
                const tabStops = [...document.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
                    .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length)
                    .map(node => ({ id: node.id, action: node.dataset.action || null, tag: node.tagName, region: node.closest('.left-panel,.center-panel,.right-panel,.header')?.className || null }));
                return { viewport: { width: innerWidth, height: innerHeight }, scrollX, scrollY,
                    documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
                    overflow: document.documentElement.scrollWidth - innerWidth, elements, tabStops };
            });
            const issues = [];
            const elements = geometry.elements;
            if (geometry.overflow > 1) issues.push({ finding: 'Document horizontal overflow', pixels: geometry.overflow });
            if (elements['.right-panel']?.documentY < elements['.left-panel']?.documentY) issues.push({ finding: 'Supporting rail precedes search/actions visually' });
            const menu = elements['#agentStatusMenu'];
            if (menu?.rendered && (menu.x < 0 || menu.right > viewport.width || menu.y < 0 || menu.bottom > viewport.height)) issues.push({ finding: 'Profile menu extends beyond viewport', bounds: menu });
            if (elements['#customerWorkSessionName']?.rendered) {
                for (const selector of ['#customerWorkSessionPersonId', '#customerWorkSessionSource']) {
                    if (!elements[selector]?.rendered) issues.push({ finding: 'Selected customer context is not rendered', selector });
                }
            }
            for (const selector of ['#queueInfo', '#sessionInfo', '#acwBar']) {
                const bar = elements[selector];
                if (bar?.rendered && bar.bottom > elements['.header'].bottom) issues.push({ finding: 'Operational bar paints beyond header allocation', selector, bottom: bar.bottom, headerBottom: elements['.header'].bottom });
            }
            report.shellEvidence.observations.push({ state, locale, viewport, kind, observedIssues: issues, ...geometry });
            await capture(page, prefix + state, undefined, kind);
            await saveReport();
        }
        async function profile(state, stress = false) {
            await page.locator('#agentProfileTrigger').press('Enter');
            await page.locator('#agentStatusMenu').waitFor({ state: 'visible' });
            let originals;
            if (stress) {
                originals = await page.locator('.profile-menu-user-name,.profile-menu-role').evaluateAll((nodes, language) => nodes.map(node => {
                    const value = node.textContent;
                    node.textContent = language === 'nl' ? 'Synthetische lange medewerkernaam voor klantenservice en abonnementenbeheer' : 'Synthetic long customer service agent name and subscription administration role';
                    return value;
                }), locale);
            }
            await observe(state, stress ? 'Controlled DOM text-length fixture on actual shell; not real identity or permission evidence.' : 'Actual open profile menu');
            if (!stress) {
                const traversal = [];
                for (let index = 0; index < 10; index++) {
                    await page.keyboard.press('Tab');
                    traversal.push(await page.evaluate(() => { const node = document.activeElement, rect = node.getBoundingClientRect(); return { id: node.id, tag: node.tagName, action: node.dataset.action || null, status: node.dataset.statusOption || null, locale: node.dataset.localeOption || null, inMenu: Boolean(node.closest('#agentStatusMenu')), x: rect.x, y: rect.y, width: rect.width, height: rect.height, focusVisible: node.matches(':focus-visible'), outlineWidth: getComputedStyle(node).outlineWidth, outlineColor: getComputedStyle(node).outlineColor, boxShadow: getComputedStyle(node).boxShadow }; }));
                }
                await page.keyboard.press('Shift+Tab');
                await page.keyboard.press('Escape');
                const escaped = await page.evaluate(() => ({ hidden: document.querySelector('#agentStatusMenu').hidden, returnedToTrigger: document.activeElement?.id === 'agentProfileTrigger' }));
                report.shellEvidence.keyboard.push({ state, viewport, locale, traversal, escaped, scope: 'Actual native Tab/Shift+Tab/Escape; no status or logout action activated.' });
            }
            if (originals) await page.locator('.profile-menu-user-name,.profile-menu-role').evaluateAll((nodes, values) => nodes.forEach((node, index) => { node.textContent = values[index]; }), originals);
            if (await page.locator('#agentStatusMenu').isVisible()) await page.locator('#agentProfileTrigger').press('Enter');
        }
        try {
            await login(page);
            if (locale === 'en') { await page.locator('#agentProfileTrigger').press('Enter'); await page.locator('[data-locale-option="en"]').press('Enter'); }
            await page.setViewportSize(viewport); await settled();
            check('actual requested shell locale', await page.locator('html').getAttribute('lang'), locale, { viewport, phase }, 3);
            await observe('empty');
            await profile('profile');
            await profile('profile-long-labels', true);
            if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').press('Enter');
            await page.locator('#searchName').fill('Jansen');
            await page.locator('button[data-action="search-customer"]').press('Enter');
            await page.locator('#paginatedResults .result-row').first().waitFor(); await settled();
            await observe('results');
            await page.locator('#paginatedResults .result-row').first().click();
            await page.locator('#customerDetail').waitFor({ state: 'visible' }); await settled(true);
            await observe('selected-session');
            await page.locator('#subscriptionQueueToggle').press('Enter');
            await page.locator('#subscriptionQueuePanel').waitFor({ state: 'visible' });
            await observe('outbox-placement');
            await page.locator('#subscriptionQueuePanel').scrollIntoViewIfNeeded();
            await observe('outbox-visible');
            await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
            const fixtureNodes = ['#customerWorkSessionName', '#customerWorkSessionPersonId', '#customerWorkSessionSource', '#customerWorkSessionPendingMutation', '#endCustomerWorkSessionButton'];
            const saved = await page.evaluate(selectors => selectors.map(selector => {
                const node = document.querySelector(selector);
                return { selector, html: node.innerHTML, hidden: node.hidden, disabled: node.disabled };
            }), fixtureNodes);
            await page.evaluate(language => {
                document.querySelector('#customerWorkSessionName').textContent = language === 'nl' ? 'Synthetische lange klantnaam voor contextcontrole' : 'Synthetic long customer identity for context inspection';
                document.querySelector('#customerWorkSessionPersonId').textContent = 'THEME-1234567890';
                document.querySelector('#customerWorkSessionSource').textContent = 'Synthetic source / long mandant context';
                document.querySelector('#customerWorkSessionPendingMutation').hidden = false;
                document.querySelector('#endCustomerWorkSessionButton').disabled = true;
            }, locale);
            await observe('pending-long-context-placement-fixture', 'Controlled DOM text/visibility fixture; not actual identity, pending submission or reset-guard behavior.');
            await page.evaluate(values => values.forEach(value => { const node = document.querySelector(value.selector); node.innerHTML = value.html; node.hidden = value.hidden; if (typeof value.disabled === 'boolean') node.disabled = value.disabled; }), saved);
            for (const [id, state] of [['queueInfo', 'queue'], ['sessionInfo', 'active-call'], ['acwBar', 'acw']]) {
                const originalStyle = await page.locator('#' + id).getAttribute('style');
                await page.locator('#' + id).evaluate(node => { node.style.display = 'block'; });
                await observe(state + '-placement-fixture', 'Controlled visibility of actual operational template only; no queue/call/ACW mutation, timer or business action.');
                await page.locator('#' + id).evaluate((node, value) => { if (value === null) node.removeAttribute('style'); else node.setAttribute('style', value); }, originalStyle);
            }

        } catch (error) {
            report.errors.push({ scenario: 'shell observations', viewport, locale, message: error.message });
            await capture(page, prefix + 'failure', undefined, 'Incomplete shell baseline').catch(() => {});
        } finally { await finishAssets(); await context.close(); await saveReport(); }
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === companionPath) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./compose-smoke-theme-audit.mjs', import.meta.url))], {
        stdio: 'inherit', env: { ...process.env, KIWI_THEME_AUDIT_SHELL_ONLY: '1', KIWI_THEME_AUDIT_SLICE: process.env.KIWI_THEME_AUDIT_SLICE || '3' }
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}
