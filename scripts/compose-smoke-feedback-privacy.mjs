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
    await searchAndSelectJansen(page);

    const targetBox = await page.locator('#customerName').boundingBox();
    if (!targetBox) {
        throw new Error('Could not locate #customerName for feedback capture.');
    }

    await page.click('#contextualFeedbackButton');
    await page.waitForSelector('.contextual-feedback-picker-overlay', { timeout: 10000 });
    await page.mouse.click(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.waitForSelector('.contextual-feedback-modal canvas', { timeout: 30000 });

    await assertFeedbackReviewSurfaceIsPrivate(page);
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

async function searchAndSelectJansen(page) {
    if (!await page.locator('#searchName').isVisible()) {
        await page.click('#additionalFiltersToggle');
        await page.waitForSelector('#searchName', { state: 'visible', timeout: 10000 });
    }

    await page.fill('#searchName', 'Jansen');
    await page.click('[data-action="search-customer"]');
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

async function assertFeedbackReviewSurfaceIsPrivate(page) {
    const modalText = await page.locator('.contextual-feedback-modal').innerText();
    const leakedModalValues = realSensitiveValues.filter((value) => modalText.includes(value));
    if (leakedModalValues.length > 0) {
        await saveFailureEvidence(page, 'modal-text-leak');
        throw new Error(`Feedback modal text leaks real values: ${leakedModalValues.join(', ')}`);
    }

    const backgroundState = await page.evaluate(() => {
        const modal = document.querySelector('.contextual-feedback-modal');
        const reviewedElement = Array.from(document.body.children).find((child) => child !== modal);
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

    const targetRect = await page.locator('#customerName').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    });

    if (Math.abs(canvasState.width - targetRect.width) > 4 || Math.abs(canvasState.height - targetRect.height) > 4) {
        await saveFailureEvidence(page, 'canvas-not-cropped');
        throw new Error(`Feedback canvas is not cropped to selected element: canvas=${JSON.stringify(canvasState)} target=${JSON.stringify(targetRect)}`);
    }
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
