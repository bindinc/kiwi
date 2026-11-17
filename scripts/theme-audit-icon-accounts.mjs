import { createNativeLoginReceiver } from './compose-smoke-theme-audit-operational.mjs';
import { pinIconLoginAction, isIconLoginNavigation, nativeNoRoleLoginFormMatches } from './theme-audit-icon-guards.mjs';
import path from 'node:path';

// theme_audit: actual server pages, isolated from business API fixtures and role simulation.
export async function inspectIconAccountPages(browser, { baseUrl, viewport, report, track, capture, check, focus }) {
    for (const denied of [false, true]) {
        const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        const finishSources = track(page, viewport);
        let action = null, attempts = 0, homeStatus = null;
        const receiver = createNativeLoginReceiver(page, page.mainFrame());
        page.on('pageerror', error => report.errors.push({ scenario: 'Actual account route', message: error.message.slice(0, 500) }));
        page.on('response', response => { const url = new URL(response.url()); if (url.origin === baseUrl.origin && url.pathname === baseUrl.pathname) homeStatus = response.status(); });
        await page.exposeBinding('__themeAuditReceiveNoRoleLogin', (source, snapshot) => receiver.receive(source, snapshot));
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            const api = ['/kiwi/api', '/kiwi-preview/api'].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'));
            const fail = reason => { report.deniedRequests.push({ method: request.method(), pathname: url.pathname, reason }); return route.abort('blockedbyclient'); };
            if (api || url.origin !== baseUrl.origin || url.username || url.password) return fail('Account pages permit no business API or external origin.');
            if (request.method() === 'GET') return route.continue();
            if (!denied || !action || url.href !== action || attempts || !isIconLoginNavigation(request, page.mainFrame())
                || !request.headers()['content-type']?.startsWith('application/x-www-form-urlencoded')) return fail('Unexpected account-page command.');
            attempts++;
            const snapshot = await receiver.wait();
            if (!nativeNoRoleLoginFormMatches(snapshot, request.postData())) return fail('No-role native form body differs from independently pinned account.');
            report.authentications.push({ pathname: url.pathname, selectedRole: 'donny (no allowed Kiwi role)', exactFormVerified: true,
                bodyMatchesNativeSnapshot: true, mainFrameDocumentPost: true, attempt: attempts, submitterDisabled: snapshot.submitterDisabled });
            return route.continue();
        });
        try {
            if (denied) {
                await page.goto(baseUrl.href); await page.locator('[name=username]').fill('donny'); await page.locator('[name=password]').fill('kiwi-local-dev-password');
                action = await page.locator('[name=password]').evaluate(input => {
                    const form = input.form; form.addEventListener('submit', event => {
                        void window.__themeAuditReceiveNoRoleLogin({ entries: [...new FormData(form, event.submitter).entries()], submitterDisabled: Boolean(event.submitter?.disabled) });
                    }, { once: true }); return form.action;
                });
                pinIconLoginAction(action, baseUrl);
                await Promise.all([page.waitForURL(url => url.pathname === baseUrl.pathname), page.locator('input[type=submit],button[type=submit]').click()]);
            } else await page.goto(new URL('logged-out', baseUrl).href);
            await page.locator('.access-denied-card h1').waitFor({ state: 'visible' });
            if (denied) {
                const roles = await page.locator('.access-denied-roles > div').evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll('code')].map(role => role.textContent)));
                check('actual no-role account returns403 and has no allowed Kiwi role', homeStatus === 403 && attempts === 1 && roles.length === 2
                    && roles[0].length > 0 && roles[1].every(role => !roles[0].includes(role)), { viewport, roles, homeStatus });
            }
            const glyph = denied ? 'ban' : 'logout';
            check('actual account illustration uses ' + glyph + ' SVG', await page.locator(`.access-denied-icon svg[data-interface-icon=${glyph}]`).count() === 1, { viewport });
            await focus(page, '.access-denied-actions .btn');
            await capture(page, denied ? 'actual-account-no-role403' : 'actual-public-logged-out', viewport,
                denied ? 'Actual native donny login and server403; no role DOM injection/business API/policy mutation.' : 'Actual public logged-out GET presentation; no session revocation/logout POST claim.');
            await finishSources({ fullApplication: false });
        } catch (error) {
            await page.screenshot({ path: path.join(report.evidenceDir, `${viewport.width}x${viewport.height}-account-failure.png`) }).catch(() => {});
            throw error;
        } finally { await context.close(); }
    }
}
