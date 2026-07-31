#!/usr/bin/env node
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);

const gatewayPort = process.env.KIWI_SMOKE_GATEWAY_PORT || '8443';
const baseUrl = process.env.KIWI_SMOKE_BASE_URL || `https://bdc.rtvmedia.org.local:${gatewayPort}/kiwi/`;
const evidenceDir = process.env.KIWI_FEEDBACK_EVIDENCE_DIR || '/tmp/kiwi-feedback-privacy-smoke';
const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH || '/home/bartdeijkers/emailtemplates/node_modules/playwright';
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome';
const browserName = process.env.KIWI_SMOKE_BROWSER || 'chromium';
const pixelChannelTolerance = 64;
const realSensitiveValues = ['Jansen', 'maria.jansen@email.nl', 'Wijnhaven', '3011BD', '06-87654321'];

const playwright = loadPlaywright();
await mkdir(evidenceDir, { recursive: true });

const browserType = playwright[browserName];
if (!['chromium', 'firefox'].includes(browserName) || !browserType) {
    throw new Error(`KIWI_SMOKE_BROWSER must be firefox or chromium, received: ${browserName}`);
}

const browser = await browserType.launch(browserLaunchOptions());

try {
    const page = await browser.newPage({
        ignoreHTTPSErrors: true,
        viewport: { width: 1693, height: 1209 }
    });

    await runSmokeScenario(page);
    console.log(`[compose-smoke-feedback-privacy] Contextual feedback privacy smoke checks passed in ${browserName}.`);
} catch (error) {
    console.log(`[compose-smoke-feedback-privacy] ${error instanceof Error ? error.message : String(error)}`);
    throw error;
} finally {
    await browser.close();
}

function browserLaunchOptions() {
    if (browserName === 'firefox') {
        return { headless: true };
    }

    return {
        headless: true,
        executablePath: chromeExecutablePath,
        args: [
            '--ignore-certificate-errors',
            '--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'
        ]
    };
}

function loadPlaywright() {
    try {
        return require(playwrightModulePath);
    } catch (error) {
        const message = [
            `Could not load Playwright from ${playwrightModulePath}.`,
            'Set PLAYWRIGHT_MODULE_PATH to an existing Playwright installation.',
            'This script does not run npx or download dependencies automatically.'
        ].join(' ');
        throw new Error(message, { cause: error });
    }
}

async function runSmokeScenario(page) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await loginIfNeeded(page);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await enableFeedbackIfNeeded(page);
    await assertFeedbackBadgeLayout(page);
    await searchAndSelectJansen(page);
    await setKiwiLocale(page, 'nl', 'Contextuele feedback');
    await assertFeedbackSettingsLocale(page);

    const target = page.locator('.customer-header');
    const targetBox = await target.boundingBox();
    if (!targetBox) {
        throw new Error('Could not locate the Jansen customer header for feedback capture.');
    }
    const nativeElementScreenshot = bufferToDataUrl(await target.screenshot());
    const liveDomBeforeCapture = await readLiveDomState(page);

    await page.click('#contextualFeedbackButton');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'visible', timeout: 10000 });
    await assertFormFirstState(page, {
        title: 'Feedback versturen',
        noScreenshot: 'Geen screenshot toegevoegd',
        commentLabel: 'Opmerking (verplicht)'
    });
    await page.fill('textarea[name="comment"]', 'Deze opmerking moet na de screenshot behouden blijven.');
    await page.click('[data-feedback-add-screenshot]');
    await page.waitForSelector('.contextual-feedback-picker-overlay', { timeout: 10000 });
    await assertDialogIsSuspendedDuringCapture(page);
    await page.mouse.click(targetBox.x + 4, targetBox.y + targetBox.height - 4);
    await page.waitForSelector('.contextual-feedback-modal canvas', { timeout: 30000 });

    const retainedComment = await page.inputValue('textarea[name="comment"]');
    if (retainedComment !== 'Deze opmerking moet na de screenshot behouden blijven.') {
        throw new Error(`Feedback comment was not retained after screenshot capture: ${retainedComment}`);
    }

    await assertFeedbackReviewSurfaceIsPrivate(page, {
        width: targetBox.width,
        height: targetBox.height
    }, nativeElementScreenshot);
    const liveDomAfterCapture = await readLiveDomState(page);
    if (JSON.stringify(liveDomAfterCapture) !== JSON.stringify(liveDomBeforeCapture)) {
        throw new Error(`Live Kiwi DOM changed during clone capture: before=${JSON.stringify(liveDomBeforeCapture)} after=${JSON.stringify(liveDomAfterCapture)}`);
    }

    await page.click('[data-feedback-close]');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'detached', timeout: 10000 });
    await setKiwiLocale(page, 'en', 'Contextual feedback');
    await captureCustomArea(page, targetBox);
    await page.click('[data-feedback-close]');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'detached', timeout: 10000 });
    await captureDeterministicFidelityFixture(page);
}

async function assertFormFirstState(page, expected) {
    const state = await page.evaluate(() => {
        const modal = document.querySelector('.contextual-feedback-modal');
        const workspace = document.querySelector('[data-feedback-workspace]');
        const comment = document.querySelector('textarea[name="comment"]');

        return {
            modalVisible: Boolean(modal && window.getComputedStyle(modal).display !== 'none'),
            workspaceHidden: Boolean(workspace?.hidden),
            commentRequired: Boolean(comment?.required),
            title: document.querySelector('#contextualFeedbackTitle')?.textContent?.trim(),
            commentLabel: comment?.closest('label')?.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim(),
            selectionSummary: document.querySelector('[data-feedback-selection-summary]')?.textContent?.trim(),
            pickerCount: document.querySelectorAll('.contextual-feedback-picker-overlay').length
        };
    });

    const isFormFirst = state.modalVisible
        && state.workspaceHidden
        && state.commentRequired
        && state.title === expected.title
        && state.commentLabel === expected.commentLabel
        && state.selectionSummary === expected.noScreenshot
        && state.pickerCount === 0;
    if (!isFormFirst) {
        await saveFailureEvidence(page, 'form-first-state');
        throw new Error(`Feedback did not open in form-first state: ${JSON.stringify(state)}`);
    }
}

async function setKiwiLocale(page, locale, expectedFeedbackTitle) {
    await page.click('#agentProfileTrigger');
    await page.click(`[data-locale-option="${locale}"]`);
    await page.waitForFunction((expectedLocale) => document.documentElement.lang === expectedLocale, locale, { timeout: 10000 });
    await page.waitForFunction((expectedTitle) => {
        return document.querySelector('#contextualFeedbackButton')?.getAttribute('title') === expectedTitle;
    }, expectedFeedbackTitle, { timeout: 10000 });
}

async function assertFeedbackSettingsLocale(page) {
    await page.click('#contextualFeedbackSettingsButton');
    await page.waitForSelector('.contextual-feedback-settings-modal', { state: 'visible', timeout: 10000 });

    const settingsText = await page.locator('.contextual-feedback-settings-modal').innerText();
    for (const expectedText of ['Feedbackinstellingen', 'Feedbackknop', 'Microsoft Teams-koppeling', 'Opslaan']) {
        if (!settingsText.includes(expectedText)) {
            throw new Error(`Dutch feedback settings translation is missing: ${expectedText}`);
        }
    }

    await page.locator('[data-feedback-settings-close]').first().click();
    await page.waitForSelector('.contextual-feedback-settings-modal', { state: 'detached', timeout: 10000 });
}

async function assertDialogIsSuspendedDuringCapture(page) {
    const state = await page.evaluate(() => {
        const modal = document.querySelector('.contextual-feedback-modal');

        return {
            modalHidden: Boolean(modal?.hidden),
            modalDisplay: modal ? window.getComputedStyle(modal).display : '',
            bodyHasReviewState: document.body.classList.contains('contextual-feedback-reviewing')
        };
    });

    if (!state.modalHidden || state.modalDisplay !== 'none' || state.bodyHasReviewState) {
        await saveFailureEvidence(page, 'dialog-visible-during-capture');
        throw new Error(`Feedback dialog was not fully hidden during capture: ${JSON.stringify(state)}`);
    }
}

async function loginIfNeeded(page) {
    const usernameField = page.locator('input[name="username"]');
    if (await usernameField.count() === 0 && page.url().includes('/login')) {
        await usernameField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    }
    if (await usernameField.count() === 0) {
        return;
    }

    await usernameField.fill('kiwi-admin');
    await page.fill('input[name="password"]', 'kiwi-local-dev-password');
    await Promise.all([
        page.waitForURL(/\/kiwi\/?$/, { timeout: 30000 }),
        page.click('input[type="submit"], button[type="submit"]')
    ]);
}

async function enableFeedbackIfNeeded(page) {
    const feedbackButton = page.locator('#contextualFeedbackButton');
    if (await feedbackButton.isVisible()) {
        return;
    }

    const settingsButton = page.locator('#contextualFeedbackSettingsButton');
    if (await settingsButton.count() === 0) {
        const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
        throw new Error(`Authenticated Kiwi page did not load: url=${page.url()} body=${JSON.stringify(bodyText)}`);
    }

    await settingsButton.click();
    const enabledCheckbox = page.locator('.contextual-feedback-settings-modal input[name="feedbackEnabled"]');
    await enabledCheckbox.waitFor({ timeout: 10000 });
    if (!await enabledCheckbox.isChecked()) {
        await enabledCheckbox.check();
    }

    await page.click('.contextual-feedback-settings-modal button[type="submit"]');
    await page.waitForSelector('#contextualFeedbackButton:not([hidden])', { timeout: 10000 });
    await page.click('.contextual-feedback-settings-modal [data-feedback-settings-close]');
}

async function assertFeedbackBadgeLayout(page) {
    const feedbackButton = page.locator('#contextualFeedbackButton');
    await feedbackButton.waitFor({ state: 'visible', timeout: 10000 });
    await feedbackButton.evaluate((element) => element.blur());
    await page.mouse.move(10, 10);
    await waitForFeedbackButtonWidth(page, 46);

    const restingState = await readFeedbackButtonState(feedbackButton);
    assertFeedbackButtonPosition(restingState, { width: 46, viewportWidth: 1693, viewportHeight: 1209 });
    if (restingState.labelOpacity > 0.01) {
        throw new Error(`Feedback label is visible while the capsule is resting: ${JSON.stringify(restingState)}`);
    }

    await feedbackButton.hover();
    await waitForFeedbackButtonWidth(page, 124);
    const hoverState = await readFeedbackButtonState(feedbackButton);
    if (Math.abs(hoverState.width - 124) > 1 || hoverState.labelOpacity < 0.99) {
        throw new Error(`Feedback capsule did not expand on hover: ${JSON.stringify(hoverState)}`);
    }

    await page.mouse.move(10, 10);
    await waitForFeedbackButtonWidth(page, 46);
    await page.keyboard.press('Tab');
    await waitForFeedbackButtonWidth(page, 124);
    const focusState = await readFeedbackButtonState(feedbackButton);
    if (!focusState.focusVisible || focusState.labelOpacity < 0.99 || focusState.outlineWidth !== '3px') {
        throw new Error(`Feedback capsule did not expose its keyboard focus state: ${JSON.stringify(focusState)}`);
    }

    await feedbackButton.evaluate((element) => element.blur());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.mouse.move(10, 10);
    await waitForFeedbackButtonWidth(page, 46);
    const mobileState = await readFeedbackButtonState(feedbackButton);
    assertFeedbackButtonPosition(mobileState, { width: 46, viewportWidth: 390, viewportHeight: 844 });

    await page.setViewportSize({ width: 1693, height: 1209 });
    await waitForFeedbackButtonWidth(page, 46);
}

async function readFeedbackButtonState(feedbackButton) {
    return feedbackButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        const label = element.querySelector('.contextual-feedback-label');

        return {
            position: styles.position,
            zIndex: styles.zIndex,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            centerY: rect.top + rect.height / 2,
            labelOpacity: Number(label ? window.getComputedStyle(label).opacity : 0),
            focusVisible: element.matches(':focus-visible'),
            outlineWidth: styles.outlineWidth
        };
    });
}

function assertFeedbackButtonPosition(state, { width, viewportWidth, viewportHeight }) {
    const isExpectedSize = Math.abs(state.width - width) <= 1 && Math.abs(state.height - 46) <= 1;
    const isAtRightEdge = Math.abs(state.right - viewportWidth) <= 1;
    const isVerticallyCentered = Math.abs(state.centerY - viewportHeight / 2) <= 1;
    const isAlwaysOnTop = state.position === 'fixed' && state.zIndex === '2147483647';

    if (!isExpectedSize || !isAtRightEdge || !isVerticallyCentered || !isAlwaysOnTop) {
        throw new Error(`Feedback capsule is not fixed at the viewport edge: ${JSON.stringify(state)}`);
    }
}

async function waitForFeedbackButtonWidth(page, width) {
    await page.waitForFunction((expectedWidth) => {
        const button = document.querySelector('#contextualFeedbackButton');
        return button && Math.abs(button.getBoundingClientRect().width - expectedWidth) <= 1;
    }, width, { timeout: 10000 });
}

async function searchAndSelectJansen(page) {
    if (!await page.locator('#searchName').isVisible()) {
        await page.click('#additionalFiltersToggle');
        await page.waitForSelector('#searchName', { state: 'visible', timeout: 10000 });
    }

    await page.fill('#searchName', 'Jansen');
    await page.click('button[data-action="search-customer"]');
    await page.waitForSelector('#paginatedResults .result-row', { timeout: 30000 });
    await page.locator('#paginatedResults .result-row', { hasText: 'Jansen' }).first().click();
    await page.waitForFunction(() => document.querySelector('#customerName')?.textContent?.includes('Jansen'), null, { timeout: 10000 });

    for (const value of realSensitiveValues) {
        const bodyText = await page.locator('body').innerText();
        if (!bodyText.includes(value)) {
            throw new Error(`Fixture did not expose expected real value before feedback capture: ${value}`);
        }
    }
}

async function captureCustomArea(page, targetBox) {
    const start = {
        x: Math.max(20, targetBox.x - 30),
        y: Math.max(20, targetBox.y - 30)
    };
    const end = {
        x: Math.min(1673, start.x + 320),
        y: Math.min(1189, start.y + 180)
    };
    const nativeAreaScreenshot = bufferToDataUrl(await page.screenshot({
        clip: {
            x: start.x,
            y: start.y,
            width: end.x - start.x,
            height: end.y - start.y
        }
    }));

    await page.click('#contextualFeedbackButton');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'visible', timeout: 10000 });
    await assertFormFirstState(page, {
        title: 'Send feedback',
        noScreenshot: 'No screenshot attached',
        commentLabel: 'Comment (required)'
    });
    await page.click('[data-feedback-add-screenshot]');
    await page.waitForSelector('.contextual-feedback-picker-overlay', { timeout: 10000 });
    await assertDialogIsSuspendedDuringCapture(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up({ button: 'left' });
    await page.waitForSelector('.contextual-feedback-modal canvas', { timeout: 30000 });

    const selectionSummary = await page.locator('.contextual-feedback-panel-header p').innerText();
    const expectedSummary = `Custom screenshot area ${Math.round(end.x - start.x)} × ${Math.round(end.y - start.y)} px`;
    if (!selectionSummary.includes(expectedSummary)) {
        await saveFailureEvidence(page, 'custom-area-summary');
        throw new Error(`Custom area summary is incorrect: ${selectionSummary}`);
    }

    await assertFeedbackReviewSurfaceIsPrivate(page, {
        width: end.x - start.x,
        height: end.y - start.y
    }, nativeAreaScreenshot);
}

async function captureDeterministicFidelityFixture(page) {
    await page.evaluate(() => {
        const fixture = document.createElement('section');
        fixture.id = 'feedbackFidelityFixture';
        fixture.dataset.feedbackId = 'screenshot-fidelity-fixture';
        fixture.style.cssText = [
            'position:fixed',
            'inset:70px auto auto 70px',
            'z-index:9000',
            'width:640px',
            'height:360px',
            'margin:17px',
            'padding:12px',
            'overflow:auto',
            'box-sizing:border-box',
            'background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27%3E%3Cpath d=%27M0 20L20 0%27 stroke=%27%23dbeafe%27/%3E%3C/svg%3E")',
            'border:2px solid #1d4ed8',
            'display:grid',
            'grid-template-columns:1fr 1fr',
            'gap:12px'
        ].join(';');
        fixture.innerHTML = `
            <div style="display:flex;gap:10px;align-items:center">
                <img data-feedback-public alt="Public product" width="64" height="48" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='48'%3E%3Crect width='64' height='48' fill='%2322c55e'/%3E%3Ccircle cx='32' cy='24' r='14' fill='%23fef08a'/%3E%3C/svg%3E">
                <svg data-feedback-public width="64" height="48" viewBox="0 0 64 48"><rect width="64" height="48" fill="#f97316"/><path d="M8 38L32 8l24 30z" fill="#fff"/></svg>
            </div>
            <div data-feedback-sensitive="name" style="font:700 18px sans-serif">Alexandria Verylongcustomername-Sensitive</div>
            <div data-feedback-mask style="width:96px;height:64px;border-radius:8px"><img alt="Sensitive avatar" width="96" height="64" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='64'%3E%3Crect width='96' height='64' fill='%23ef4444'/%3E%3C/svg%3E"></div>
            <canvas id="feedbackFidelityCanvas" width="120" height="64"></canvas>
            <div style="height:220px;grid-column:1/-1;background:linear-gradient(90deg,#e0f2fe,#fce7f3)">
                <div style="position:sticky;top:0;background:#111827;color:#fff;padding:6px">Sticky landmark</div>
                <img alt="Failed resource" width="24" height="24" src="/kiwi/feedback-fixture-does-not-exist.png">
                <iframe title="Unsupported frame" style="width:80px;height:40px"></iframe>
            </div>
        `;
        document.body.append(fixture);
        const canvas = fixture.querySelector('#feedbackFidelityCanvas');
        const context = canvas.getContext('2d');
        context.fillStyle = '#7c3aed';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.fillRect(18, 14, 84, 36);
        fixture.scrollTop = 28;
    });

    const fixture = page.locator('#feedbackFidelityFixture');
    const fixtureBox = await fixture.boundingBox();
    if (!fixtureBox) {
        throw new Error('Could not install deterministic screenshot fidelity fixture.');
    }
    const sensitiveRegions = await fixture.evaluate((root) => {
        const rootRect = root.getBoundingClientRect();
        return Array.from(root.querySelectorAll('[data-feedback-sensitive], [data-feedback-mask]')).map((element) => {
            const rect = element.getBoundingClientRect();
            return {
                x: rect.x - rootRect.x,
                y: rect.y - rootRect.y,
                width: rect.width,
                height: rect.height
            };
        });
    });
    const nativeScreenshot = bufferToDataUrl(await fixture.screenshot());
    await page.click('#contextualFeedbackButton');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'visible', timeout: 10000 });
    await page.click('[data-feedback-add-screenshot]');
    await page.waitForSelector('.contextual-feedback-picker-overlay', { timeout: 10000 });
    await page.mouse.click(fixtureBox.x + 4, fixtureBox.y + fixtureBox.height / 2);
    await page.waitForSelector('.contextual-feedback-modal canvas', { timeout: 30000 });
    await assertFeedbackReviewSurfaceIsPrivate(page, fixtureBox, nativeScreenshot, sensitiveRegions);

    const privacyText = await page.locator('[data-feedback-privacy-summary]').innerText();
    if (!privacyText.includes('resource')) {
        throw new Error(`Unsupported fixture resources did not produce a visible fidelity warning: ${privacyText}`);
    }

    await page.click('[data-feedback-close]');
    await page.locator('#feedbackFidelityFixture').evaluate((element) => element.remove());
}

async function assertFeedbackReviewSurfaceIsPrivate(page, expectedSize, nativeScreenshot, sensitiveRegions = []) {
    const modalText = await page.locator('.contextual-feedback-modal').innerText();
    const leakedModalValues = realSensitiveValues.filter((value) => modalText.includes(value));
    if (leakedModalValues.length > 0) {
        await saveFailureEvidence(page, 'modal-text-leak');
        throw new Error(`Feedback modal text leaks real values: ${leakedModalValues.join(', ')}`);
    }

    await assertScreenshotPrivacyToggle(page, nativeScreenshot, sensitiveRegions);

    const backgroundState = await page.evaluate(() => {
        const modal = document.querySelector('.contextual-feedback-modal');
        const reviewedElement = Array.from(document.body.children).find((child) => {
            return child !== modal && !child.matches('[data-feedback-ignore]');
        });
        const styles = reviewedElement ? window.getComputedStyle(reviewedElement) : null;

        return {
            bodyHasReviewState: document.body.classList.contains('contextual-feedback-reviewing'),
            filter: styles?.filter || '',
            opacity: styles?.opacity || '',
            backdropFilter: window.getComputedStyle(modal).backdropFilter || ''
        };
    });

    if (!backgroundState.bodyHasReviewState || !backgroundState.filter.includes('blur') || Number(backgroundState.opacity) > 0.2) {
        await saveFailureEvidence(page, 'background-not-hidden');
        throw new Error(`Feedback background is not strongly hidden: ${JSON.stringify(backgroundState)}`);
    }

    const canvasState = await page.locator('.contextual-feedback-modal canvas').evaluate((canvas) => {
        const context = canvas.getContext('2d');
        const sample = context.getImageData(0, 0, Math.max(1, Math.min(canvas.width, 32)), Math.max(1, Math.min(canvas.height, 32))).data;
        const hasNonBlankPixel = Array.from(sample).some((value, index) => index % 4 !== 3 && value < 250);

        return {
            width: canvas.width,
            height: canvas.height,
            hasNonBlankPixel
        };
    });

    if (canvasState.width < 1 || canvasState.height < 1 || !canvasState.hasNonBlankPixel) {
        await saveFailureEvidence(page, 'blank-canvas');
        throw new Error(`Feedback canvas is blank or invalid: ${JSON.stringify(canvasState)}`);
    }

    if (Math.abs(canvasState.width - expectedSize.width) > 4 || Math.abs(canvasState.height - expectedSize.height) > 4) {
        await saveFailureEvidence(page, 'canvas-not-cropped');
        throw new Error(`Feedback canvas is not cropped to the selection: canvas=${JSON.stringify(canvasState)} target=${JSON.stringify(expectedSize)}`);
    }
}

async function assertScreenshotPrivacyToggle(page, nativeScreenshot, sensitiveRegions = []) {
    const toggle = page.locator('[data-feedback-pseudonymized]');
    await toggle.waitFor({ timeout: 10000 });
    if (!await toggle.isChecked()) {
        await saveFailureEvidence(page, 'pseudonymization-toggle-off');
        const privacySummary = await page.locator('[data-feedback-privacy-summary] [title]').getAttribute('title').catch(() => '');
        const privacyText = await page.locator('[data-feedback-privacy-summary]').innerText().catch(() => '');
        throw new Error(`Pseudonymization toggle is not enabled by default: ${privacyText} ${privacySummary}`);
    }

    const locale = await page.evaluate(() => document.documentElement.lang);
    const expectedPrivacyText = locale === 'nl'
        ? {
            original: 'Screenshot met originele gegevens naar de afgeschermde Teams-workflow versturen',
            pseudonymized: 'Screenshot met pseudogegevens naar Teams versturen'
        }
        : {
            original: 'Send original-data screenshot to restricted Teams workflow',
            pseudonymized: 'Send pseudo-data screenshot to Teams'
        };
    const pseudoCanvas = await page.locator('.contextual-feedback-modal canvas').evaluate((canvas) => canvas.toDataURL('image/png'));
    await toggle.uncheck();
    await page.waitForFunction((expectedText) => {
        return document.querySelector('[data-feedback-visible-privacy]')?.textContent?.includes(expectedText);
    }, expectedPrivacyText.original, { timeout: 10000 });
    const originalCanvas = await page.locator('.contextual-feedback-modal canvas').evaluate((canvas) => canvas.toDataURL('image/png'));
    if (pseudoCanvas === originalCanvas) {
        await saveFailureEvidence(page, 'pseudonymization-toggle-no-change');
        throw new Error('Pseudonymization toggle did not switch the visible screenshot variant.');
    }

    const fidelity = await compareScreenshots(page, nativeScreenshot, originalCanvas);
    const dimensionsMatch = Math.abs(fidelity.nativeWidth - fidelity.actualWidth) <= 1
        && Math.abs(fidelity.nativeHeight - fidelity.actualHeight) <= 1;
    if (!dimensionsMatch || fidelity.changedPixelRatio > 0.02) {
        await saveFailureEvidence(page, 'original-fidelity');
        throw new Error(`Original screenshot differs from native capture: ${JSON.stringify(fidelity)}`);
    }
    console.log(`[compose-smoke-feedback-privacy] ${browserName} original/native changed pixels: ${(fidelity.changedPixelRatio * 100).toFixed(3)}%.`);

    if (sensitiveRegions.length > 0) {
        const outsideSensitiveRegions = await compareScreenshots(page, pseudoCanvas, originalCanvas, sensitiveRegions);
        if (outsideSensitiveRegions.changedPixelRatio > 0.02) {
            throw new Error(`Pseudonymization moved pixels outside measured sensitive regions: ${JSON.stringify(outsideSensitiveRegions)}`);
        }
        console.log(`[compose-smoke-feedback-privacy] ${browserName} pseudo/original changes outside sensitive regions: ${(outsideSensitiveRegions.changedPixelRatio * 100).toFixed(3)}%.`);
    }

    await toggle.check();
    await page.waitForFunction((expectedText) => {
        return document.querySelector('[data-feedback-visible-privacy]')?.textContent?.includes(expectedText);
    }, expectedPrivacyText.pseudonymized, { timeout: 10000 });
}

async function compareScreenshots(page, expectedDataUrl, actualDataUrl, ignoredRegions = []) {
    return page.evaluate(async ({ expectedDataUrl, actualDataUrl, ignoredRegions, pixelChannelTolerance }) => {
        const loadImage = (src) => new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = src;
        });
        const [expected, actual] = await Promise.all([
            loadImage(expectedDataUrl),
            loadImage(actualDataUrl)
        ]);
        const width = Math.min(expected.width, actual.width);
        const height = Math.min(expected.height, actual.height);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(expected, 0, 0);
        const expectedPixels = context.getImageData(0, 0, width, height).data;
        context.clearRect(0, 0, width, height);
        context.drawImage(actual, 0, 0);
        const actualPixels = context.getImageData(0, 0, width, height).data;
        let changedPixels = 0;
        let comparedPixels = 0;

        for (let index = 0; index < expectedPixels.length; index += 4) {
            const pixelIndex = index / 4;
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);
            const isIgnored = ignoredRegions.some((region) => {
                return x >= region.x - 2
                    && x <= region.x + region.width + 2
                    && y >= region.y - 2
                    && y <= region.y + region.height + 2;
            });
            if (isIgnored) {
                continue;
            }
            comparedPixels += 1;
            const redDiff = Math.abs(expectedPixels[index] - actualPixels[index]);
            const greenDiff = Math.abs(expectedPixels[index + 1] - actualPixels[index + 1]);
            const blueDiff = Math.abs(expectedPixels[index + 2] - actualPixels[index + 2]);
            const alphaDiff = Math.abs(expectedPixels[index + 3] - actualPixels[index + 3]);
            if (Math.max(redDiff, greenDiff, blueDiff, alphaDiff) > pixelChannelTolerance) {
                changedPixels += 1;
            }
        }

        return {
            nativeWidth: expected.width,
            nativeHeight: expected.height,
            actualWidth: actual.width,
            actualHeight: actual.height,
            changedPixelRatio: changedPixels / Math.max(1, comparedPixels)
        };
    }, { expectedDataUrl, actualDataUrl, ignoredRegions, pixelChannelTolerance });
}

async function readLiveDomState(page) {
    return page.evaluate(() => {
        const customerName = document.querySelector('#customerName');
        const actions = document.querySelector('.customer-header-actions');
        const customerRect = customerName?.getBoundingClientRect();
        const actionsRect = actions?.getBoundingClientRect();

        return {
            customerName: customerName?.textContent,
            customerHtml: customerName?.innerHTML,
            customerRect: customerRect ? [customerRect.x, customerRect.y, customerRect.width, customerRect.height] : null,
            actionsRect: actionsRect ? [actionsRect.x, actionsRect.y, actionsRect.width, actionsRect.height] : null,
            searchName: document.querySelector('#searchName')?.value
        };
    });
}

function bufferToDataUrl(buffer) {
    return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function saveFailureEvidence(page, name) {
    await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true }).catch(() => {});
    const canvasDataUrl = await page.locator('.contextual-feedback-modal canvas').evaluate((canvas) => canvas.toDataURL('image/png')).catch(() => '');
    if (!canvasDataUrl) {
        return;
    }

    const base64 = canvasDataUrl.replace(/^data:image\/png;base64,/, '');
    await writeFile(path.join(evidenceDir, `${name}-canvas.png`), Buffer.from(base64, 'base64'));
}
