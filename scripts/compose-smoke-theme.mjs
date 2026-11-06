#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright');
const browserName = process.env.KIWI_SMOKE_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName), 'KIWI_SMOKE_BROWSER must be chromium or firefox');
const baseUrl = process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:8443/kiwi/';
const evidenceDir = process.env.KIWI_THEME_EVIDENCE_DIR || '/tmp/kiwi-theme-smoke';
// Baseline mode serves an explicitly supplied snapshot of the original CSS on the same application.
const baselineDir = process.env.KIWI_THEME_BASELINE_DIR;
const mode = baselineDir ? 'before' : 'after';
const cssFiles = ['styles.css', 'article-search.css', 'delivery-date-picker.css', 'contextual-feedback.css', 'session-outbox.css'];
await mkdir(evidenceDir, { recursive: true });
const browser = await playwright[browserName].launch(browserName === 'firefox' ? { headless: true } : {
    headless: true,
    executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1']
});
const report = { browser: browserName, mode, screenshots: [], assertions: [] };

async function newPage(width) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    if (baselineDir) {
        await context.route('**/*.css*', async route => {
            const pathname = new URL(route.request().url()).pathname;
            const filename = cssFiles.find(file => new RegExp(`/${file.replace('.css', '')}(?:-[\\w]+)?\\.css$`).test(pathname));
            if (!filename) return route.continue();
            await route.fulfill({ contentType: 'text/css', body: await readFile(path.join(baselineDir, 'assets/css', filename), 'utf8') });
        });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    return page;
}

async function login(page, username = 'kiwi-admin') {
    await page.goto(baseUrl);
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill('kiwi-local-dev-password');
    await Promise.all([
        page.waitForURL(url => url.pathname === new URL(baseUrl).pathname),
        page.locator('input[type="submit"], button[type="submit"]').click()
    ]);
}

async function capture(page, name, selector) {
    const filename = `${browserName}-${mode}-${page.viewportSize().width}-${name}.png`;
    const target = selector ? page.locator(selector).first() : page;
    await target.screenshot({ path: path.join(evidenceDir, filename), animations: 'disabled' });
    report.screenshots.push(filename);
}

async function assertStyle(page, selector, property, expected) {
    if (baselineDir) return;
    const actual = await page.locator(selector).first().evaluate((element, key) => getComputedStyle(element)[key], property);
    assert.equal(actual, expected, `${selector} ${property}`);
    report.assertions.push(`${selector} ${property}: ${actual}`);
}

async function assertKeyboardFocus(page, selector, expectedColor) {
    if (baselineDir) return;
    await page.keyboard.press('Tab');
    await page.locator(selector).first().focus();
    const focus = await page.locator(selector).first().evaluate(element => ({
        visible: element.matches(':focus-visible'),
        width: getComputedStyle(element).outlineWidth,
        color: getComputedStyle(element).outlineColor
    }));
    assert.equal(focus.visible, true, `${selector} keyboard focus`);
    assert.equal(focus.width, '3px', `${selector} outline width`);
    assert.equal(focus.color, expectedColor, `${selector} outline color`);
    report.assertions.push(`${selector} keyboard focus visible`);
}

async function assertContrast(page, foregroundSelector, backgroundSelector, minimum = 4.5, property = 'color') {
    if (baselineDir) return;
    const foreground = await page.locator(foregroundSelector).evaluate((element, name) => getComputedStyle(element)[name], property);
    const background = await page.locator(backgroundSelector).evaluate(element => getComputedStyle(element).backgroundColor);
    function luminance(rgb) {
        const values = rgb.match(/[\d.]+/g).map(Number);
        assert.ok(values.length === 3 || values[3] === 1, `Contrast needs an opaque color: ${rgb}`);
        const linear = values.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return linear.reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    }
    const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    const ratio = (values[1] + 0.05) / (values[0] + 0.05);
    assert.ok(ratio >= minimum, `${foregroundSelector} ${property} on ${backgroundSelector}: ${ratio}`);
    report.assertions.push(`${foregroundSelector} ${property} contrast: ${ratio.toFixed(3)}`);
}

async function inspectPresentationFixture(page) {
    // These real component classes exercise states without creating calls, orders or outbox records.
    await page.evaluate(() => {
        const fixture = document.createElement('section');
        fixture.id = 'themeSmokeFixture';
        fixture.setAttribute('aria-label', 'Theme diagnostic fixture — synthetic presentation states');
        fixture.style.cssText = 'position:fixed;inset:16px;z-index:10000;overflow:auto;padding:16px;background:var(--surface,#fff);display:grid;gap:16px;align-content:start';
        fixture.innerHTML = `
            <h2>Theme diagnostic fixture — synthetic presentation states</h2>
            <p>No active call or queued customer change is represented here.</p>
            <button type="button" class="btn btn-primary">Example primary action</button>
            <button type="button" class="btn btn-secondary">Example secondary action</button>
            <button type="button" class="channel-chip"><span class="channel-code">TEST</span><span class="channel-label">Example channel</span></button>
            <button type="button" class="werfsleutel-suggestion"><span class="code">TEST</span><span class="title">Example offer</span></button>
            <div class="subscription-item subscription-ended"><div class="subscription-info"><div class="subscription-name">Example ended subscription</div><div class="subscription-details">Ended — diagnostic state</div></div></div>
            <button type="button" class="btn-winback">Example winback action</button>
            <div class="search-summary"><div class="summary-badge">✓ Example search summary</div></div>
            <div class="header" style="position:static;height:auto;padding:0;background-image:none">
                <div class="session-info"><div class="session-info-content"><span class="session-caller">Example active call</span><span class="recording-indicator"><span class="rec-text">REC — example</span></span><button type="button" class="btn-hold-call">Hold example</button><button type="button" class="btn-end-call">End example</button></div></div>
                <div class="acw-bar"><div class="acw-bar-content"><span class="acw-label">Example after-call work</span><span class="acw-timer">0:00</span><button type="button" class="btn-finish-acw">Finish example</button></div></div>
            </div>
            <div class="subscription-queue-item session-outbox-item" data-status="paused"><div class="session-outbox-body"><button type="button" class="session-outbox-customer">Synthetic customer</button><p class="session-outbox-caption">Example queued change</p><span class="session-outbox-state">Paused — diagnostic state</span></div><button type="button" class="session-outbox-icon-button" aria-label="Example outbox options">⋮</button></div>`;
        document.body.append(fixture);
    });
    const root = '#themeSmokeFixture';
    if (!baselineDir) {
        const primary = `${root} .btn-primary`;
        await page.locator(primary).hover();
        await waitForBackground(page, primary, 'rgb(53, 76, 94)');
        await page.mouse.down();
        try {
            await waitForBackground(page, primary, 'rgb(43, 62, 77)');
        } finally {
            await page.mouse.up();
        }
        const secondary = `${root} .btn-secondary`;
        await page.locator(secondary).hover();
        await waitForBackground(page, secondary, 'rgb(93, 88, 85)');
        await page.mouse.move(0, 0);
    }
    for (const component of ['.channel-chip', '.werfsleutel-suggestion']) {
        await assertStyle(page, `${root} ${component}`, 'borderTopColor', 'rgb(118, 136, 148)');
        await assertContrast(page, `${root} ${component}`, root, 3, 'borderTopColor');
        await assertKeyboardFocus(page, `${root} ${component}`, 'rgb(73, 98, 117)');
    }
    await assertStyle(page, `${root} .subscription-ended`, 'opacity', '1');
    await assertContrast(page, `${root} .subscription-details`, `${root} .subscription-ended`);
    await assertStyle(page, `${root} .btn-winback`, 'borderTopColor', 'rgb(15, 23, 42)');
    await assertContrast(page, `${root} .btn-winback`, `${root} .btn-winback`);
    await assertContrast(page, `${root} .btn-winback`, `${root} .btn-winback`, 3, 'borderTopColor');
    await assertStyle(page, `${root} .summary-badge`, 'color', 'rgb(22, 101, 52)');
    await assertContrast(page, `${root} .summary-badge`, `${root} .search-summary`);
    await assertContrast(page, `${root} .session-caller`, `${root} .session-info`);
    await assertContrast(page, `${root} .rec-text`, `${root} .recording-indicator`);
    await assertContrast(page, `${root} .acw-label`, `${root} .acw-bar`);
    await assertContrast(page, `${root} .session-outbox-state`, `${root} .session-outbox-item`);
    await assertKeyboardFocus(page, `${root} .btn-hold-call`, 'rgb(255, 255, 255)');
    await assertKeyboardFocus(page, `${root} .btn-finish-acw`, 'rgb(255, 255, 255)');
    await assertKeyboardFocus(page, `${root} .session-outbox-customer`, 'rgb(73, 98, 117)');
    await capture(page, 'diagnostic-component-states', root);
    await page.locator(root).evaluate(element => element.remove());
}

async function waitForBackground(page, selector, color) {
    await page.waitForFunction(({ selector, color }) => getComputedStyle(document.querySelector(selector)).backgroundColor === color, { selector, color });
    report.assertions.push(`${selector} interaction background: ${color}`);
}

async function runWorkspace(width) {
    const page = await newPage(width);
    try {
        await login(page);
        await page.waitForFunction(() => window.kiwiCustomerWorkSession && window.kiwiCustomerDetailSlice);
        await assertStyle(page, 'body', 'backgroundColor', 'rgb(240, 238, 233)');
        await assertStyle(page, '.header', 'backgroundColor', 'rgb(73, 98, 117)');
        await assertStyle(page, '.card', 'backgroundColor', 'rgb(255, 255, 255)');
        await assertKeyboardFocus(page, '#agentProfileTrigger', 'rgb(255, 255, 255)');
        await capture(page, 'shell');
        await page.locator('#agentProfileTrigger').click();
        await capture(page, 'profile', '#agentStatusMenu');
        await page.locator('[data-locale-option="nl"]').click();

        await page.locator('[data-action="open-article-sale-form"]').click();
        await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
        await assertStyle(page, '#articleInitials', 'borderTopColor', 'rgb(118, 136, 148)');
        await assertKeyboardFocus(page, '#articleInitials', 'rgb(73, 98, 117)');
        await capture(page, 'article-form');
        await page.locator('#deliveryDateDisplay').click();
        await page.locator('#deliveryCalendar.is-open').waitFor({ state: 'visible' });
        await capture(page, 'date-picker', '#deliveryCalendar');
        await page.locator('#deliveryDateDisplay').click();
        await page.locator('#articleSearch').fill('a');
        await page.locator('#articleDropdown').waitFor({ state: 'visible' });
        await capture(page, 'article-search', '.article-sale-right');
        await page.locator('#articleSaleForm [data-action="close-article-sale-form"]').first().click();
        // Discard this smoke session's unsent form draft before selecting a different customer.
        await page.locator('#endCustomerWorkSessionButton').click();

        if (!await page.locator('#searchName').isVisible()) await page.locator('#additionalFiltersToggle').click();
        await page.locator('#searchName').fill('Jansen');
        await page.locator('button[data-action="search-customer"]').click();
        await page.locator('#paginatedResults .result-row').first().waitFor();
        await capture(page, 'customer-results');
        await page.locator('#paginatedResults .result-row').first().click();
        await page.locator('#customerDetail').waitFor({ state: 'visible' });
        await capture(page, 'customer-detail');

        if (!await page.locator('#contextualFeedbackButton').isVisible()) {
            await page.locator('#contextualFeedbackSettingsButton').click();
            await page.locator('input[name="feedbackEnabled"]').check();
            await page.locator('.contextual-feedback-settings-modal button[type="submit"]').click();
            await page.locator('[data-feedback-settings-close]').first().click();
        }
        await page.locator('#contextualFeedbackButton').click();
        await page.locator('.contextual-feedback-modal').waitFor({ state: 'visible' });
        await capture(page, 'feedback');
        await page.locator('[data-feedback-close]').first().click();

        await inspectPresentationFixture(page);

        await page.goto(new URL('logged-out', baseUrl).href);
        await assertStyle(page, 'body', 'backgroundColor', 'rgb(240, 238, 233)');
        await capture(page, 'logged-out');
    } catch (error) {
        await capture(page, 'failure').catch(() => {});
        throw error;
    } finally {
        await page.context().close();
    }

    const denied = await newPage(width);
    try {
        await login(denied, 'donny');
        await denied.locator('.access-denied-card').waitFor();
        await assertStyle(denied, 'body', 'backgroundColor', 'rgb(240, 238, 233)');
        await capture(denied, 'access-denied');
    } finally {
        await denied.context().close();
    }
}

try {
    for (const width of [1440, 390]) await runWorkspace(width);
    console.log(`[compose-smoke-theme] ${browserName} ${mode}: ${report.screenshots.length} screenshots; ${report.assertions.length} assertions passed.`);
} finally {
    await writeFile(path.join(evidenceDir, `${browserName}-${mode}-report.json`), JSON.stringify(report, null, 2));
    await browser.close();
}
