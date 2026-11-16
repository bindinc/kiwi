#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installOperationalTransport, createNativeLoginReceiver } from './compose-smoke-theme-audit-operational.mjs';
import { readonlySourceFixtures } from './compose-smoke-theme-audit-operational-feedback.mjs';
import { installArticleFixtures, prepareArticleEvidence, releaseArticleFixtures } from './compose-smoke-theme-audit-article.mjs';
import { normalizeKnownJsImports } from './compose-smoke-theme-audit-shell-acceptance.mjs';

// theme_audit: bounded icon155 evidence. Existing09 gates and historical runners remain unchanged.
const baseline = process.env.KIWI_ICON_BASELINE === '1';
const callOnly = process.env.KIWI_ICON_CALL_ONLY === '1';
const root = path.resolve(process.env.KIWI_THEME_APP_ROOT || '');
const expectedHead = process.env.KIWI_ICON_EXPECT_SOURCE;
const baseUrl = new URL(process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:9444/kiwi/');
const browserName = process.env.KIWI_SMOKE_BROWSER;
const output = process.env.KIWI_THEME_EVIDENCE_DIR;
const container = process.env.KIWI_ICON_CONTAINER || (baseline ? 'kiwi-theme-audit-09-app-1' : 'kiwi-theme-icons-155-app-1');
const sdkFile = '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-11/slice-04/privacy-serialization-fix/dom-to-image-more-3.10.1-esm.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
assert.equal(root, baseline ? '/home/bartdeijkers/_worktrees/align-theme-operational-states' : '/home/bartdeijkers/_worktrees/unify-kiwi-interface-icons');
if (baseline) assert.equal(expectedHead, '2c193b25770506321d3b85bf9e5954deb159c2ef');
assert.match(expectedHead || '', /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', 'HEAD'), expectedHead);
assert.ok(['chromium', 'firefox'].includes(browserName));
assert.equal(baseUrl.href, 'https://bdc.rtvmedia.org.local:9444/kiwi/');
assert.ok(output?.startsWith('/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-16/icon-refinement/'));
assert.ok(Date.now() < Date.parse('2026-11-16T10:49:30Z'), 'No new capture after the agreed terminal boundary.');
const evidenceDir = path.join(output, browserName);
await mkdir(evidenceDir, { recursive: false });
const paths = git('ls-files', 'assets', 'templates', 'src').split('\n').filter(name => !name.endsWith('.md'));
const sources = new Map(await Promise.all(paths.map(async name => [name, await readFile(path.join(root, name))])));
for (const [name, bytes] of sources) assert.equal(hash(bytes), hash(execFileSync('git', ['-C', root, 'show', `${expectedHead}:${name}`])), `Frozen committed source: ${name}`);
const runtimeHashes = JSON.parse(execFileSync('docker', ['exec', container, 'php', '-r',
    '$r=[];foreach(json_decode($argv[1],true) as $p){$r[$p]=hash_file("sha256","/app/".$p);}echo json_encode($r);', JSON.stringify(paths)], { encoding: 'utf8' }));
for (const [name, bytes] of sources) assert.equal(hash(bytes), runtimeHashes[name], `Exact runtime source: ${name}`);
const sdkBytes = await readFile(sdkFile);
assert.equal(hash(sdkBytes), '1913ae113e0675d70c684af23d5b29da8d1409d10440866d3cca1db6b888f70c');
const report = { marker: 'theme_audit', callOnly, scope: baseline ? 'Observational immutable accepted09 BEFORE icon refinement; no icon155 acceptance.' : 'Finite actual icon155 rendering/interactions plus isolated production SVG capture; not full155/final10 acceptance.',
    source: { root, head: expectedHead, productionCount: paths.length, files: paths.map(name => ({ path: name, sha256: hash(sources.get(name)), runtimeSha256: runtimeHashes[name] })) },
    runner: { path: fileURLToPath(import.meta.url), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
    importedHelpers: await Promise.all(['compose-smoke-theme-audit-operational.mjs', 'compose-smoke-theme-audit-operational-feedback.mjs', 'compose-smoke-theme-audit-article.mjs'].map(async name => ({ name, sha256: hash(await readFile(new URL(name, import.meta.url))) }))),
    sdk: { path: sdkFile, sha256: hash(sdkBytes) }, checks: [], captures: [], errors: [], servedSources: [], sourceErrors: [],
    deniedRequests: [], localCallWrites: [], authentications: [], authDiagnostics: [], authLifecycle: [], outboxReads: [], settingsFixtures: [], sdkReads: [], readonlySourceReads: [],
    limitations: ['Finite icon scope only; no new business persistence, full interface/native200 or whole original privacy suite acceptance.', 'Synthetic operational/catalogue/readonly fixtures are explicit; they do not prove backend policies.', 'Isolated SVG/privacy specimen supplements actual application images; it does not replace affected-record/full guarded privacy.'] };
const save = () => writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
function check(name, passed, detail = {}) { report.checks.push({ name, passed: Boolean(passed), ...detail }); if (!passed) throw new Error(name); }
function normalizeCss(body, source, sourceUrl) {
    const references = [...source.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].trim().replace(/^['"]|['"]$/g, ''));
    return body.replace(/url\(([^)]+)\)/g, (statement, raw) => {
        const actual = new URL(raw.trim().replace(/^['"]|['"]$/g, ''), sourceUrl);
        const known = references.find(ref => { const expected = new URL(ref, sourceUrl); const escaped = expected.pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const extension = path.posix.extname(expected.pathname); const stem = escaped.slice(0, -extension.length - 1);
            return actual.origin === expected.origin && actual.search === expected.search && actual.hash === expected.hash
                && (actual.pathname === expected.pathname || new RegExp('^' + stem + '-[\\w-]{7}\\' + extension + '$').test(actual.pathname)); });
        return known ? `url(known:${new URL(known, sourceUrl).href})` : statement;
    });
}
function track(page, viewport) {
    const pending = [], seen = new Set();
    page.on('response', response => {
        const url = new URL(response.url()); if (url.origin !== baseUrl.origin || !url.pathname.startsWith('/kiwi/assets/')) return;
        const relative = 'assets/' + url.pathname.slice('/kiwi/assets/'.length).replace(/-[\w-]{7}(?=\.(?:css|js)$)/, '');
        if (!sources.has(relative) || !/\.(css|js)$/.test(relative)) return;
        pending.push((async () => { const bytes = await response.body().catch(() => null); if (!bytes) return;
            const source = sources.get(relative).toString(), normalize = relative.endsWith('.js') ? normalizeKnownJsImports : normalizeCss;
            const expected = hash(normalize(source, source, url)), actual = hash(normalize(bytes.toString(), source, url));
            report.servedSources.push({ path: relative, expected, actual, viewport }); assert.equal(actual, expected, `Served source: ${relative}`); seen.add(relative);
        })().catch(error => { report.sourceErrors.push({ path: relative, message: error.message.slice(0, 300) }); }));
    });
    return async () => { await Promise.all(pending); for (const name of ['styles', 'article-search', 'contextual-feedback', 'delivery-date-picker', 'session-outbox']) check(`served ${name} stylesheet`, seen.has(`assets/css/${name}.css`), { viewport });
        if (!baseline) check('served actual interface icon module', seen.has('assets/js/app/interface-icons.js'), { viewport }); check('all served sources match frozen source', !report.sourceErrors.length); };
}
const playwright = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const browser = await playwright[browserName].launch(browserName === 'firefox' ? { headless: true } : { headless: true, executablePath: '/usr/bin/google-chrome', args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'] });
report.environment = { browser: browserName, version: browser.version(), locale: 'nl-NL', deviceScaleFactor: 1, reducedMotion: 'reduce', zoom: '100percent', createdUtc: new Date().toISOString() };
const terminalTimer = setTimeout(() => { report.errors.push({ scenario: 'deadline', message: 'Terminal capture boundary reached.' }); void browser.close(); }, Math.max(1, Date.parse('2026-11-16T10:49:30Z') - Date.now()));
async function capture(page, name, viewport, kind = 'Actual installed Compose UI with declared local synthetic fixtures') {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const filename = `${viewport.width}x${viewport.height}-${name}.png`;
    await page.screenshot({ path: path.join(evidenceDir, filename), animations: 'disabled' });
    const icons = await page.locator('svg.interface-icon').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
        const css = getComputedStyle(node), bounds = node.getBoundingClientRect(), control = node.closest('button,a');
        return { glyph: node.dataset.interfaceIcon || null, viewBox: node.getAttribute('viewBox'), hidden: node.getAttribute('aria-hidden'), focusable: node.getAttribute('focusable'),
            stroke: node.getAttribute('stroke'), width: node.getAttribute('stroke-width'), cap: node.getAttribute('stroke-linecap'), join: node.getAttribute('stroke-linejoin'),
            pointerEvents: css.pointerEvents, translatedAncestor: Boolean(node.closest('[data-i18n]')), selfContained: !node.querySelector('use,image,script,foreignObject'),
            painted: bounds.width > 0 && bounds.height > 0, controlNamed: !control || Boolean(control.getAttribute('aria-label') || control.getAttribute('title') || control.textContent.trim()) };
    }));
    const unchangedEmptyScenes = ['shell', 'profile-keyboard', 'shell-en', 'shell-nl'];
    if (!baseline) check(`${name} rendered icon grammar`, (icons.length > 0 || unchangedEmptyScenes.includes(name)) && icons.every(icon => icon.viewBox === '0 0 24 24' && icon.hidden === 'true' && icon.focusable === 'false'
        && icon.stroke === 'currentColor' && icon.width === '1.75' && icon.cap === 'round' && icon.join === 'round' && icon.pointerEvents === 'none'
        && !icon.translatedAncestor && icon.selfContained && icon.painted && icon.controlNamed), { viewport, icons });
    report.captures.push({ name, filename, viewport, kind, icons: icons.length }); await save();
}
async function login(page, control) {
    control.authReceiver = createNativeLoginReceiver(page, page.mainFrame());
    await page.exposeBinding('__themeAuditReceiveNativeLogin', (source, snapshot) => control.authReceiver.receive(source, snapshot));
    await page.goto(baseUrl.href); await page.locator('[name=username]').fill('kiwi-admin'); await page.locator('[name=password]').fill('kiwi-local-dev-password');
    control.auth = await page.locator('[name=password]').evaluate(input => { const form = input.form; form.addEventListener('submit', event => {
        void window.__themeAuditReceiveNativeLogin({ entries: [...new FormData(form, event.submitter).entries()], submitterDisabled: Boolean(event.submitter?.disabled) }); }, { once: true }); return { url: form.action }; });
    await Promise.all([page.waitForURL(url => url.pathname === baseUrl.pathname), page.locator('input[type=submit],button[type=submit]').click()]); control.auth = null;
    await page.waitForFunction(() => window.kiwiCallAgentRuntime && window.kiwiCustomerDetailSlice && window.kiwiOutbox);
}
async function locale(page, language) { await page.locator('#agentProfileTrigger').press('Enter'); await page.locator(`[data-locale-option="${language}"]`).press('Enter'); await page.waitForFunction(lang => document.documentElement.lang === lang, language); }
async function focus(page, selector) {
    const control = page.locator(selector).first(); await control.scrollIntoViewIfNeeded(); await control.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const result = await control.evaluate(node => { const r = node.getBoundingClientRect(), css = getComputedStyle(node); return { focused: document.activeElement === node,
        visible: node.matches(':focus-visible'), outline: parseFloat(css.outlineWidth), x: r.x, right: r.right, y: r.y, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
    check(`${selector} native keyboard focus`, result.focused && result.visible && result.outline >= 2 && result.x >= 0 && result.right <= result.width + 1 && result.y >= 0 && result.bottom <= result.height + 1, result);
}
async function svgPrivacy(page, viewport) {
    await page.evaluate(() => { const box = document.createElement('div'); box.id = 'iconPrivacyFixture'; box.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:180px;background:white;color:#496275;padding:16px;z-index:2147483647';
        const publicCaption = document.createElement('span'); publicCaption.dataset.feedbackPublic = ''; publicCaption.textContent = 'Public icon grammar'; box.append(publicCaption);
        for (const svg of [...document.querySelectorAll('svg.interface-icon')].slice(0, 6)) box.append(svg.cloneNode(true));
        const input = document.createElement('input'); input.dataset.feedbackSensitive = 'email'; input.value = 'synthetic-icons-private@example.invalid'; input.style.cssText = 'display:block;width:400px;height:40px;margin-top:16px'; box.append(input); document.body.append(box); });
    const target = page.locator('#iconPrivacyFixture'); const native = (await target.screenshot()).toString('base64');
    const result = await target.evaluate(async (element, nativeBase64) => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type=importmap]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js')); if (!key) throw new Error('Actual screenshot import missing.');
        const { captureElementScreenshot } = await import(imports[key]); const before = element.outerHTML; const value = element.querySelector('input').value;
        const captured = await captureElementScreenshot({ element, selectedElement: { tagName: 'DIV', id: 'iconPrivacyFixture', text: 'Public icon grammar' } });
        const dataUrl = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        const original = await dataUrl(captured.original.blob), pseudo = await dataUrl(captured.pseudonymized.blob);
        const pixels = async data => { const img = new Image(); img.src = data; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; canvas.getContext('2d').drawImage(img, 0, 0); return { width: img.width, height: img.height, bytes: canvas.getContext('2d').getImageData(0, 0, img.width, img.height).data }; };
        const expected = await pixels('data:image/png;base64,' + nativeBase64), actual = await pixels(original), redacted = await pixels(pseudo);
        let changed = 0, privateChanged = 0, outside = 0, outsideCount = 0; const rect = element.getBoundingClientRect(), field = element.querySelector('input').getBoundingClientRect();
        if (expected.width !== actual.width || expected.height !== actual.height) throw new Error('SVG original dimensions differ.');
        for (let y = 0; y < actual.height; y++) for (let x = 0; x < actual.width; x++) { const i = (y * actual.width + x) * 4;
            if ([0, 1, 2, 3].some(c => Math.abs(expected.bytes[i + c] - actual.bytes[i + c]) > 64)) changed++;
            const isPrivate = x >= field.x - rect.x - 1 && x <= field.right - rect.x + 1 && y >= field.y - rect.y - 1 && y <= field.bottom - rect.y + 1;
            const differs = [0, 1, 2, 3].some(c => Math.abs(actual.bytes[i + c] - redacted.bytes[i + c]) > 64);
            if (isPrivate && differs) privateChanged++; if (!isPrivate) { outsideCount++; if (differs) outside++; }
        }
        return { original, pseudo, fidelity: changed / (actual.width * actual.height), outsidePrivate: outside / Math.max(1, outsideCount), privateChanged,
            privacy: captured.privacySummary, liveUnchanged: element.outerHTML === before && element.querySelector('input').value === value,
            kind: 'Isolated synthetic icon/public-caption/private-input specimen through unchanged actual production clone/SDK; not whole interface privacy.' };
    }, native);
    await writeFile(path.join(evidenceDir, 'isolated-svg-native.png'), Buffer.from(native, 'base64'));
    for (const name of ['original', 'pseudo']) { await writeFile(path.join(evidenceDir, `isolated-svg-${name}.png`), Buffer.from(result[name].split(',')[1], 'base64')); delete result[name]; }
    report.svgPrivacy = result; check('isolated production SVG original/native fidelity <=2percent at64channels', result.fidelity <= .02, result);
    check('isolated production privacy preserves public SVG pixels and live input', result.outsidePrivate <= .02 && result.privateChanged > 0 && result.privacy.verified && result.privacy.unresolvedValues === 0 && result.liveUnchanged, result);
    await target.evaluate(node => node.remove()); await save();
}
const widths = [1440, 390, 320];
try {
    for (const viewport of (baseline ? [{ width: 1440, height: 1000 }] : callOnly ? [{ width: 390, height: 1000 }] : [...widths.map(width => ({ width, height: 1000 })), { width: 390, height: 320 }])) {
        const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: viewport.width, height: 1000 }, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers: 'block' });
        const state = { sourceRoot: root, baseUrl, sdkBytes, phase: 'after', suite: 'feedback', feedbackFixtures: readonlySourceFixtures(), api: new URL('api/v1/', baseUrl).pathname, report };
        const control = await installOperationalTransport(context, state); control.mode = 'ready';
        const knownReads = new Set(['bootstrap', 'call-queue', 'call-session', 'agent-status', 'outbox-sessions?limit=20&offset=0',
            'workflows/subscription?limit=20', 'webabo/offers?limit=250', 'development-feedback/settings', 'persons/990901',
            ...state.feedbackFixtures.map(fixture => fixture.suffix)].map(suffix => state.api + suffix));
        const knownWrites = new Set(['PUT call-session', 'POST call-session/hold', 'POST call-session/resume', 'POST call-session/end', 'POST agent-status',
            'PUT development-feedback/settings'].map(entry => { const [method, suffix] = entry.split(' '); return method + ' ' + state.api + suffix; }));
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            const kiwiApi = ['/kiwi/api', '/kiwi-preview/api'].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'));
            if (!kiwiApi) return route.fallback();
            const exactRead = ['GET', 'HEAD'].includes(request.method()) && knownReads.has(url.pathname + url.search);
            const exactCommand = !url.search && knownWrites.has(request.method() + ' ' + url.pathname);
            if (exactRead || exactCommand) return route.fallback();
            report.deniedRequests.push({ method: request.method(), pathname: url.pathname, reason: 'Icon guard: unknown API under either base; never upstream.' });
            return route.abort('blockedbyclient');
        });
        const page = await context.newPage(); page.setDefaultTimeout(7000);
        page.on('pageerror', error => report.errors.push({ scenario: 'actual runtime', message: error.message.slice(0, 500) }));
        const finishSources = track(page, viewport); const articleDriver = { sourceRoot: root, baseUrl, report };
        await prepareArticleEvidence(articleDriver); const article = await installArticleFixtures(page, articleDriver);
        const readonlyCustomer = state.feedbackFixtures[0].customer; let detailReads = 0;
        const readonlyDetailUrl = new URL('api/v1/persons/' + readonlyCustomer.id, baseUrl); readonlyDetailUrl.searchParams.set('credentialKey', readonlyCustomer.credentialKey); readonlyDetailUrl.searchParams.set('sourceSystem', readonlyCustomer.sourceSystem);
        await page.route(readonlyDetailUrl.href, async route => {
            if (route.request().method() !== 'GET' || detailReads++) { report.deniedRequests.push({ reason: 'Extra synthetic readonly detail request' }); return route.abort('blockedbyclient'); }
            return route.fulfill({ json: { ...readonlyCustomer, subscriptions: [], contactHistory: [], articles: [] } });
        });
        try {
            await login(page, control); await locale(page, 'nl'); await page.setViewportSize(viewport); await capture(page, 'shell', viewport);
            await focus(page, '#agentProfileTrigger'); await page.locator('#agentProfileTrigger').press('Enter'); await capture(page, 'profile-keyboard', viewport); await page.keyboard.press('Escape');
            for (const language of ['en', 'nl']) { await locale(page, language); await capture(page, `shell-${language}`, viewport); }
            if (!callOnly) {
            await page.locator('[data-action=show-new-subscription]').first().press('Enter'); await page.locator('#newSubscriptionForm').waitFor({ state: 'visible' });
            check('initial recipient/payer modes remain actually disabled', await page.locator('#newSubscriptionForm input[type=radio]:disabled').count() > 0, { viewport }); await capture(page, 'subscription-initial-disabled', viewport); await page.locator('#newSubscriptionForm .form-actions').scrollIntoViewIfNeeded(); await capture(page, 'subscription-payment-actions', viewport);
            await page.locator('#newSubscriptionForm [data-action=close-form]').first().press('Enter');
            await page.locator('[data-action=open-article-sale-form]').first().press('Enter'); await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
            await page.locator('#articleSearch').fill('Synthetic'); await page.locator('#articleDropdown [data-arg-article-id="990601"]').waitFor(); await capture(page, 'article-dynamic-suggestions', viewport);
            await page.locator('#articleDropdown .browse-all-link').press('Enter'); await page.locator('#allArticlesModal').waitFor({ state: 'visible' }); await capture(page, 'article-catalog', viewport);
            await focus(page, '#allArticlesModal .btn-close'); await page.locator('#allArticlesModal .btn-close').press('Enter');
            await page.locator('#articleSearch').fill('Synthetic'); await page.locator('#articleDropdown [data-arg-article-id="990601"]').press('Enter');
            await page.waitForFunction(() => document.getElementById('articleName')?.dataset.articleId === '990601');
            await page.locator('#articleQuantity').fill('5'); await page.locator('#articleQuantity').press('Tab'); await page.locator('[data-action=add-article-to-order]').press('Enter');
            await page.waitForFunction(() => window.orderItems?.length === 1); await page.locator('#orderItemsList').scrollIntoViewIfNeeded(); await capture(page, 'cart-discount-icons', viewport);
            await page.locator('#couponCode').fill('THEME06'); await page.locator('#couponCode').press('Enter'); await page.locator('#couponMessage.success').waitFor(); await capture(page, 'coupon-success-icons', viewport);
            await page.locator('#articleSaleForm [data-action=close-article-sale-form]').first().press('Enter');
            await page.evaluate(async customer => window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer, requireFresh: true }), readonlyCustomer);
            await page.locator('#customerDetail').waitFor({ state: 'visible' });
            for (const language of ['en', 'nl']) { await locale(page, language);
                if (!baseline) check('readonly View caption survives actual ' + language, (await page.locator('#editCustomerBtn').innerText()).trim() === (language === 'en' ? 'View customer details' : 'Gegevens bekijken'), { viewport });
                await page.locator('#customerDetail .customer-header').scrollIntoViewIfNeeded(); await capture(page, `readonly-customer-${language}`, viewport); }
            const rawHistory = 'Synthetische gesprekstekst ☎ blijft exact bewaard';
            await page.evaluate(description => { window.currentCustomer.contactHistory = [{ id: 'icon-synthetic-history', type: 'call_hold', date: new Date().toISOString(), description }]; window.kiwiContactHistorySlice.displayContactHistory(); }, rawHistory);
            await page.locator('#contactHistory').scrollIntoViewIfNeeded(); await capture(page, 'history-dynamic-decoration', viewport);
            check('raw stored synthetic history description preserved', await page.evaluate(() => window.currentCustomer.contactHistory[0].description) === rawHistory, { viewport });
            const fixture = state.feedbackFixtures[0]; await page.evaluate(customer => { window.currentCustomer = customer; window.customers = [customer]; window.editCustomer(); }, fixture.customer);
            await page.locator('.customer-editor[open] section').first().waitFor(); await page.locator('.customer-editor[open] [data-customer-section=person] .customer-editor-record-action').first().press('Enter');
            await capture(page, 'readonly-editor', viewport); await focus(page, '.customer-editor[open] .btn-close'); await page.locator('.customer-editor[open] .btn-close').press('Enter');
            await page.evaluate(() => { window.currentCustomer = null; window.customers = []; });
            if (!await page.locator('#subscriptionQueuePanel').isVisible()) await page.locator('#subscriptionQueueToggle').press('Enter'); await page.locator('#subscriptionQueuePanel').waitFor({ state: 'visible' }); await capture(page, 'outbox-dynamic-icons', viewport);
            const menu = page.locator('.session-outbox-item [aria-controls]').first(); await focus(page, '.session-outbox-item [aria-controls]'); await menu.press('Enter'); await page.locator('.session-outbox-menu:popover-open').waitFor(); await capture(page, 'outbox-icon-only-menu', viewport); await page.keyboard.press('Escape');
            control.mode = 'held'; const pendingRefresh = page.evaluate(() => window.kiwiOutbox.refreshOutbox());
            for (let attempt = 0; !control.held.length && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
            check('actual pending outbox GET is held', control.held.length > 0, { viewport });
            await capture(page, 'outbox-pending-read', viewport); control.mode = 'ready'; control.release(); await pendingRefresh;
            await page.locator('#subscriptionQueueToggle').press('Enter');
            }
            const initial = await page.evaluate(() => ({ ...window.callSession, active: true, startTime: Date.now() - 60000, serviceNumber: 'AVROBODE', recordingActive: false })); delete initial.durationInterval;
            const expected = { ...initial, recordingActive: true }; control.gate.arm('POST', state.api + 'agent-status', { status: 'in_call' }, { status: 'in_call', teams_sync: null }); control.gate.arm('PUT', state.api + 'call-session', expected, expected);
            await page.evaluate(session => { window.callSession = session; window.kiwiCallSessionSlice.startCallSession(); }, initial);
            await page.waitForFunction(() => document.getElementById('sessionInfo').offsetHeight > 0); if (!baseline) check('active call action uses pause glyph', await page.locator('#holdCallBtn svg[data-interface-icon=pause]').count() === 1, { viewport }); if (callOnly) check('both queue and active-call wait markers use clock SVG', await page.locator('.wait-icon svg[data-interface-icon=clock]').count() === 2 && await page.locator('.wait-icon').evaluateAll(nodes => nodes.every(node => node.textContent.trim() === '')), { viewport }); await capture(page, 'call-active-recording', viewport);
            const held = await page.evaluate(() => { const value = { ...window.callSession, onHold: true, holdStartTime: Date.now() }; delete value.durationInterval; return value; });
            control.gate.arm('POST', state.api + 'call-session/hold', {}, held); await page.locator('#holdCallBtn').press('Enter');
            await page.waitForFunction(() => window.callSession?.onHold === true && Boolean(document.querySelector('#holdIndicator'))); if (!baseline) check('held call action uses play and music glyphs', await page.locator('#holdCallBtn svg[data-interface-icon=play]').count() === 1 && await page.locator('#holdIndicator svg[data-interface-icon=music]').count() === 1, { viewport }); await capture(page, 'call-held-icons', viewport);
            check('all exact synthetic call writes consumed', control.gate.pending().length === 0);
            await page.locator('#contextualFeedbackSettingsButton').press('Enter'); await page.locator('.contextual-feedback-settings-modal').waitFor({ state: 'visible' }); await capture(page, 'feedback-settings', viewport);
            const settings = page.locator('.contextual-feedback-settings-modal'); await settings.locator('input[name=feedbackEnabled]').check(); control.settingsGate.arm();
            await settings.locator('button[type=submit]').press('Enter'); await page.locator('#contextualFeedbackButton').waitFor({ state: 'visible' }); await settings.locator('header [data-feedback-settings-close]').press('Enter');
            await page.locator('#contextualFeedbackButton').press('Enter'); await page.locator('.contextual-feedback-modal').waitFor(); await capture(page, 'feedback-visible-entry', viewport);
            await focus(page, '.contextual-feedback-modal [data-feedback-close]'); await page.locator('.contextual-feedback-modal [data-feedback-close]').press('Enter');
            if (!baseline && viewport.width === 1440) await svgPrivacy(page, viewport);
            await finishSources(); check('no unrecognized request or runtime errors', !report.deniedRequests.length && !report.errors.length);
        } catch (error) { report.errors.push({ scenario: `${viewport.width}x${viewport.height}`, message: error.message.slice(0, 800) }); await page.screenshot({ path: path.join(evidenceDir, `${viewport.width}x${viewport.height}-failure.png`) }).catch(() => {}); throw error;
        } finally { releaseArticleFixtures(article); control.release(); await context.close(); await save(); }
    }
} catch (error) { report.failure = error.message.slice(0, 1000); process.exitCode = 1;
} finally { clearTimeout(terminalTimer); await browser.close(); check('frozen application commit retained', git('rev-parse', 'HEAD') === expectedHead); report.summary = { checks: report.checks.length, failed: report.checks.filter(item => !item.passed).length, captures: report.captures.length, errors: report.errors.length, deniedRequests: report.deniedRequests.length, complete155Acceptance: false }; await save(); console.log(JSON.stringify(report.summary)); }
