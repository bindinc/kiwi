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
const realSensitiveValues = ['Jansen', 'maria.jansen@email.nl', 'Wijnhaven', '3011BD', '06-87654321'];

const { chromium } = loadPlaywright();
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    executablePath: chromeExecutablePath,
    args: [
        '--ignore-certificate-errors',
        '--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'
    ]
});

try {
    const page = await browser.newPage({
        ignoreHTTPSErrors: true,
        viewport: { width: 1693, height: 1209 }
    });

    await runSmokeScenario(page);
    console.log('[compose-smoke-feedback-privacy] Contextual feedback privacy smoke checks passed.');
} catch (error) {
    console.log(`[compose-smoke-feedback-privacy] ${error instanceof Error ? error.message : String(error)}`);
    throw error;
} finally {
    await browser.close();
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

    const targetBox = await page.locator('#customerName').boundingBox();
    if (!targetBox) {
        throw new Error('Could not locate #customerName for feedback capture.');
    }

    await page.click('#contextualFeedbackButton');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'visible', timeout: 10000 });
    await assertFormFirstState(page);
    await page.fill('textarea[name="comment"]', 'This comment must survive screenshot capture.');
    await page.click('[data-feedback-add-screenshot]');
    await page.waitForSelector('.contextual-feedback-picker-overlay', { timeout: 10000 });
    await assertDialogIsSuspendedDuringCapture(page);
    await page.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.waitForSelector('.contextual-feedback-modal canvas', { timeout: 30000 });

    const retainedComment = await page.inputValue('textarea[name="comment"]');
    if (retainedComment !== 'This comment must survive screenshot capture.') {
        throw new Error(`Feedback comment was not retained after screenshot capture: ${retainedComment}`);
    }

    await assertFeedbackReviewSurfaceIsPrivate(page, {
        width: targetBox.width,
        height: targetBox.height
    });

    await page.click('[data-feedback-close]');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'detached', timeout: 10000 });
    await captureCustomArea(page, targetBox);
}

async function assertFormFirstState(page) {
    const state = await page.evaluate(() => {
        const modal = document.querySelector('.contextual-feedback-modal');
        const workspace = document.querySelector('[data-feedback-workspace]');
        const comment = document.querySelector('textarea[name="comment"]');

        return {
            modalVisible: Boolean(modal && window.getComputedStyle(modal).display !== 'none'),
            workspaceHidden: Boolean(workspace?.hidden),
            commentRequired: Boolean(comment?.required),
            selectionSummary: document.querySelector('[data-feedback-selection-summary]')?.textContent?.trim(),
            pickerCount: document.querySelectorAll('.contextual-feedback-picker-overlay').length
        };
    });

    const isFormFirst = state.modalVisible
        && state.workspaceHidden
        && state.commentRequired
        && state.selectionSummary === 'No screenshot attached'
        && state.pickerCount === 0;
    if (!isFormFirst) {
        await saveFailureEvidence(page, 'form-first-state');
        throw new Error(`Feedback did not open in form-first state: ${JSON.stringify(state)}`);
    }
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

    await page.click('#contextualFeedbackSettingsButton');
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

    await page.click('#contextualFeedbackButton');
    await page.waitForSelector('.contextual-feedback-modal', { state: 'visible', timeout: 10000 });
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
    });
}

async function assertFeedbackReviewSurfaceIsPrivate(page, expectedSize) {
    const modalText = await page.locator('.contextual-feedback-modal').innerText();
    const leakedModalValues = realSensitiveValues.filter((value) => modalText.includes(value));
    if (leakedModalValues.length > 0) {
        await saveFailureEvidence(page, 'modal-text-leak');
        throw new Error(`Feedback modal text leaks real values: ${leakedModalValues.join(', ')}`);
    }

    await assertScreenshotPrivacyToggle(page);

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

async function assertScreenshotPrivacyToggle(page) {
    const toggle = page.locator('[data-feedback-pseudonymized]');
    await toggle.waitFor({ timeout: 10000 });
    if (!await toggle.isChecked()) {
        await saveFailureEvidence(page, 'pseudonymization-toggle-off');
        throw new Error('Pseudonymization toggle is not enabled by default.');
    }

    const pseudoCanvas = await page.locator('.contextual-feedback-modal canvas').evaluate((canvas) => canvas.toDataURL('image/png'));
    await toggle.uncheck();
    await page.waitForFunction(() => {
        return document.querySelector('[data-feedback-visible-privacy]')?.textContent?.includes('Send original-data screenshot to restricted Teams workflow');
    }, null, { timeout: 10000 });
    const originalCanvas = await page.locator('.contextual-feedback-modal canvas').evaluate((canvas) => canvas.toDataURL('image/png'));
    if (pseudoCanvas === originalCanvas) {
        await saveFailureEvidence(page, 'pseudonymization-toggle-no-change');
        throw new Error('Pseudonymization toggle did not switch the visible screenshot variant.');
    }

    await toggle.check();
    await page.waitForFunction(() => {
        return document.querySelector('[data-feedback-visible-privacy]')?.textContent?.includes('Send pseudo-data screenshot to Teams');
    }, null, { timeout: 10000 });
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
