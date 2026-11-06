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

async function newPage(width, height = 1000) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height }, reducedMotion: 'reduce' });
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
    const viewport = page.viewportSize();
    const size = viewport.height === 1000 ? String(viewport.width) : `${viewport.width}x${viewport.height}`;
    const filename = `${browserName}-${mode}-${size}-${name}.png`;
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

function shiftDate(isoDate, days) {
    const date = new Date(`${isoDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function expectFocusedDate(page, isoDate) {
    await page.waitForFunction(expected => document.activeElement?.dataset.argDate === expected, isoDate);
    assert.equal(await page.locator('#deliveryCalendar .delivery-day-cell[tabindex="0"]').count(), 1);
}

async function inspectDatePicker(page) {
    const trigger = page.locator('#deliveryDateDisplay');
    if (baselineDir) {
        await trigger.click();
        await capture(page, 'date-picker', '#deliveryCalendar');
        await trigger.click();
        return;
    }

    assert.equal(await trigger.evaluate(element => element.tagName), 'BUTTON');
    await page.waitForFunction(() => Boolean(document.getElementById('articleDesiredDelivery')?.value));
    await trigger.focus();
    await trigger.press('Enter');
    await page.locator('#deliveryCalendar.is-open').waitFor();
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    await page.mouse.move(0, 0);
    const geometry = await page.locator('#deliveryCalendar').evaluate(calendar => {
        const grid = calendar.querySelector('.delivery-calendar-grid');
        const bounds = calendar.getBoundingClientRect();
        const headers = [...grid.querySelectorAll('.delivery-day-header')].map(header => {
            const rect = header.getBoundingClientRect();
            return { left: rect.left, right: rect.right };
        });
        const days = [...grid.querySelectorAll('.delivery-day-cell:not(.empty)')];
        const available = days.filter(day => day.getAttribute('aria-disabled') !== 'true' && !day.classList.contains('selected'));
        const selectedNumber = grid.querySelector('.selected .day-number');
        return {
            left: bounds.left, right: bounds.right, width: bounds.width,
            clientWidth: calendar.clientWidth, scrollWidth: calendar.scrollWidth,
            tracks: getComputedStyle(grid).gridTemplateColumns.split(' ').length, headers,
            headingDecoration: getComputedStyle(calendar.querySelector('.calendar-month'), '::after').content,
            nativeButtons: days.every(day => day.tagName === 'BUTTON'),
            neutralAvailable: available.every(day => [day, day.querySelector('.day-number')].every(element => {
                const background = getComputedStyle(element).backgroundColor;
                return background === 'rgba(0, 0, 0, 0)' || background === 'rgb(255, 255, 255)';
            })),
            selectedNumber: selectedNumber ? { width: selectedNumber.getBoundingClientRect().width, height: selectedNumber.getBoundingClientRect().height } : null
        };
    });
    assert.equal(geometry.tracks, 7, 'calendar has seven columns');
    assert.equal(geometry.headingDecoration, 'none', 'month heading has no inherited form-section underline');
    assert.equal(geometry.headers.length, 7);
    assert.ok(geometry.headers.every(header => header.left >= geometry.left && header.right <= geometry.right), 'all weekday columns fit');
    assert.ok(geometry.left >= 0 && geometry.right <= page.viewportSize().width, 'calendar fits viewport');
    assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, 'calendar has no horizontal overflow');
    assert.equal(geometry.nativeButtons, true);
    assert.equal(geometry.neutralAvailable, true, 'unselected available days are neutral');
    assert.ok(geometry.selectedNumber && geometry.selectedNumber.width <= 36 && geometry.selectedNumber.height <= 36, 'selected date has a compact indicator');

    const selected = await page.locator('#articleDesiredDelivery').inputValue();
    await expectFocusedDate(page, selected);
    for (const [key, delta] of [['ArrowRight', 1], ['ArrowLeft', -1], ['ArrowDown', 7], ['ArrowUp', -7]]) {
        const date = await page.evaluate(() => document.activeElement.dataset.argDate);
        await page.keyboard.press(key);
        await expectFocusedDate(page, shiftDate(date, delta));
    }
    const dayOfWeek = (new Date(`${selected}T12:00:00`).getDay() + 6) % 7;
    await page.keyboard.press('Home');
    await expectFocusedDate(page, shiftDate(selected, -dayOfWeek));
    await page.keyboard.press('End');
    await expectFocusedDate(page, shiftDate(selected, 6 - dayOfWeek));
    const weekEnd = await page.evaluate(() => document.activeElement.dataset.argDate);
    const nextMonth = new Date(`${weekEnd}T12:00:00`);
    const desiredDay = nextMonth.getDate();
    nextMonth.setDate(1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(Math.min(desiredDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
    const nextMonthIso = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;
    await page.keyboard.press('PageDown');
    await expectFocusedDate(page, nextMonthIso);
    await page.keyboard.press('PageUp');
    const previousMonth = new Date(nextMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    await expectFocusedDate(page, shiftDate(`${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-${String(previousMonth.getDate()).padStart(2, '0')}`, 0));

    const unavailable = page.locator('#deliveryCalendar button.delivery-day-cell[aria-disabled="true"]').first();
    assert.ok(await unavailable.count(), 'fixture month includes unavailable dates');
    await unavailable.focus();
    for (const key of ['Enter', 'Space']) {
        await unavailable.press(key);
        assert.equal(await page.locator('#articleDesiredDelivery').inputValue(), selected, 'unavailable date cannot be selected');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    }
    const next = page.locator('#deliveryCalendar [data-action="navigate-delivery-calendar"][data-arg-direction="1"]');
    const previousMonthLabel = await page.locator('#deliveryCalendar .calendar-month').innerText();
    await next.click();
    await page.waitForFunction(previous => document.querySelector('#deliveryCalendar .calendar-month')?.textContent !== previous, previousMonthLabel);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true', 'month navigation keeps the calendar open');
    await page.waitForFunction(() => document.activeElement?.dataset.argDirection === '1');
    await page.keyboard.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Escape returns trigger focus');
    await trigger.press('Space');
    await page.locator('#deliveryCalendar.is-open').waitFor();
    await page.locator('#deliveryCalendar [data-action="select-recommended-delivery-date"]').click();
    assert.equal(await page.locator('#articleDesiredDelivery').inputValue(), selected, 'earliest action uses the API recommendation across navigation');
    await trigger.press('Enter');
    await page.locator('#deliveryCalendar.is-open').waitFor();
    await capture(page, 'date-picker', '#deliveryCalendar');
    await page.keyboard.press('Escape');
    report.assertions.push(`Date picker ${page.viewportSize().width}px: seven columns, neutral/compact states, keyboard navigation, unavailable guards, API earliest and focus restoration`);
}

async function runDatePickerOnly(width, height = 1000) {
    // Configure locale before shrinking the viewport; this scenario targets the date picker, not the profile menu.
    const page = await newPage(width);
    try {
        await login(page);
        await page.waitForFunction(() => window.kiwiCustomerWorkSession && window.kiwiCustomerDetailSlice);
        await page.locator('#agentProfileTrigger').click();
        await page.locator('[data-locale-option="nl"]').click();
        await page.waitForFunction(() => document.documentElement.lang === 'nl');
        await page.setViewportSize({ width, height });
        await page.locator('[data-action="open-article-sale-form"]').click();
        await page.locator('#articleSaleForm').waitFor({ state: 'visible' });
        await inspectDatePicker(page);
        if (!baselineDir && height < 500) {
            await page.locator('#deliveryDateDisplay').press('Enter');
            await page.locator('#deliveryCalendar.is-open').waitFor();
            await page.keyboard.press('End');
            for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
            await page.waitForFunction(() => {
                const calendar = document.getElementById('deliveryCalendar').getBoundingClientRect();
                const focused = document.activeElement.getBoundingClientRect();
                return Boolean(document.activeElement.dataset.argDate)
                    && focused.top >= Math.max(0, calendar.top)
                    && focused.bottom <= Math.min(innerHeight, calendar.bottom);
            });
            await capture(page, 'date-picker-keyboard-scroll', '#deliveryCalendar');
            report.assertions.push(`Date picker ${width}x${height}: keyboard focus remains visible while the calendar scrolls`);
        }
    } catch (error) {
        console.error('Date picker failure state:', await page.evaluate(() => ({
            activeElement: { tag: document.activeElement?.tagName, id: document.activeElement?.id, classes: document.activeElement?.className, date: document.activeElement?.dataset.argDate },
            expanded: document.getElementById('deliveryDateDisplay')?.getAttribute('aria-expanded'),
            calendarClasses: document.getElementById('deliveryCalendar')?.className,
            articleFormDisplay: getComputedStyle(document.getElementById('articleSaleForm')).display
        })));
        await capture(page, 'date-picker-failure').catch(() => {});
        throw error;
    } finally {
        await page.context().close();
    }
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
        await inspectDatePicker(page);
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
    if (process.env.KIWI_THEME_DATEPICKER_ONLY === '1') {
        for (const width of [1440, 390, 320]) await runDatePickerOnly(width);
        await runDatePickerOnly(390, 320);
    } else {
        for (const width of [1440, 390]) await runWorkspace(width);
        await runDatePickerOnly(320);
    }
    console.log(`[compose-smoke-theme] ${browserName} ${mode}: ${report.screenshots.length} screenshots; ${report.assertions.length} assertions passed.`);
} finally {
    await writeFile(path.join(evidenceDir, `${browserName}-${mode}-report.json`), JSON.stringify(report, null, 2));
    await browser.close();
}
