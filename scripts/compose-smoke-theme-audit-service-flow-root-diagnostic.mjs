#!/usr/bin/env node
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installServiceFixtures, prepareServiceCustomer, prepareServiceEvidence, releaseServiceFixtures } from './compose-smoke-theme-audit-service.mjs';
import { productionInputPixelProof } from './compose-smoke-theme-audit-customer-acceptance.mjs';

// theme_audit: one reversible geometry counterfactual, never a service submission.
const sourceRoot = process.env.KIWI_THEME_APP_ROOT;
const expectedSource = process.env.KIWI_THEME_DIAGNOSTIC_EXPECT_SOURCE;
if (!sourceRoot || !expectedSource) throw new Error('Explicit source worktree and frozen expected commit are required.');
const sourceCommit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sourceCommit !== expectedSource) throw new Error('Diagnostic source commit differs from the explicitly reviewed checkpoint.');
const baseUrl = new URL(process.env.KIWI_SMOKE_BASE_URL || 'https://bdc.rtvmedia.org.local:9444/kiwi/');
if (!['bdc.rtvmedia.org.local', 'localhost', '127.0.0.1'].includes(baseUrl.hostname)) throw new Error('Only an isolated local Compose URL is allowed.');
const evidenceDir = process.env.KIWI_THEME_EVIDENCE_DIR;
if (!evidenceDir) throw new Error('Explicit durable evidence directory is required.');
await mkdir(evidenceDir, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const files = ['assets/css/styles.css', 'templates/base/index.html.twig', 'assets/js/app/slices/winback-slice.js',
    'assets/js/app/slices/subscription-workflow-slice.js', 'assets/js/app/service-form-context.js', 'assets/js/app/subscription-role-runtime.js', 'assets/js/app/service-form-feedback.js'];
const sourceHashes = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await readFile(path.join(sourceRoot, file)))])));
const sourceBefore = await sourceHashes();
const report = { marker: 'theme_audit', slice: 7, scope: 'One Chromium1440 frozen-source three-property service margin containment counterfactual; no workflow replay, source edit, SDK or threshold change.',
    applicationCommit: sourceCommit, sourceBefore, errors: [], blockedWrites: [], fixtureRequests: [] };
const require = createRequire(import.meta.url);
const { chromium } = require('/home/bartdeijkers/emailtemplates/node_modules/playwright');
const { PNG } = require('/home/bartdeijkers/emailtemplates/node_modules/playwright-core/lib/utilsBundle.js');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--host-resolver-rules=MAP bdc.rtvmedia.org.local 127.0.0.1'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', serviceWorkers: 'block' });
await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        report.blockedWrites.push({ method: request.method(), path: url.pathname }); return route.abort('blockedbyclient');
    }
    return route.continue();
});
const page = await context.newPage(); page.setDefaultTimeout(10000);
page.on('pageerror', error => report.errors.push(error.message));
const driver = { report, baseUrl };
await prepareServiceEvidence(driver);
let controls;
try {
    controls = await installServiceFixtures(page, driver);
    await page.goto(baseUrl.href);
    await page.locator('[name=username]').fill('kiwi-admin'); await page.locator('[name=password]').fill('kiwi-local-dev-password');
    await Promise.all([page.waitForURL(url => url.pathname === baseUrl.pathname), page.locator('input[type=submit],button[type=submit]').click()]);
    await page.waitForFunction(() => window.kiwiWinbackSlice && window.kiwiCustomerWorkSession);
    await page.locator('#agentProfileTrigger').click(); await page.locator('[data-locale-option=nl]').click();
    await prepareServiceCustomer(page); await page.evaluate(() => window.kiwiWinbackSlice.cancelSubscription(990711));
    await page.locator('input[name=cancelReason][value=deceased]').press('Space');
    await page.locator('#winbackStep1 [data-arg-step="2"]').press('Enter');
    await page.locator('input[name=action_990711][value=transfer]').press('Space');
    await page.locator('input[name=action_990712][value=cancel_refund]').press('Space');
    await page.locator('#winbackStep1b [data-action=process-deceased-subscriptions]').press('Enter');
    for (const [suffix, value] of Object.entries({ Initials: 'S.Q.', MiddleName: 'van', LastName: 'Synthetic Private Recipient07', Email: 'private.transfer07@example.invalid', Phone: '0209462718' })) await page.locator('#transfer2' + suffix).fill(value);
    for (const [suffix, value] of [['Day', '28'], ['Month', '12'], ['Year', '1980']]) await page.locator('#transfer2Birthday' + suffix).selectOption(value);
    await page.locator('#transfer2SameAddress').check();
    await page.locator('#refundEmail2').fill('private.refund07@example.invalid'); await page.locator('#refundNotes2').fill('Synthetic private refund note07 with retained payment/contact context.');
    report.addressConfirmed = await page.evaluate(() => window.kiwiAddressCompletion.validate(document.getElementById('winbackStep1e')));
    await page.evaluate(async () => { document.activeElement?.blur(); await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    report.sequence = await page.evaluate(async () => {
        const card = document.querySelector('#winbackFlow .card'), wrapper = document.querySelector('#transfer2CustomerForm'), host = wrapper.querySelector('.address-fields'), firstHeading = wrapper.querySelector(':scope > .form-subtitle:first-child'), lastGroup = wrapper.lastElementChild;
        const sameAddressLabel = wrapper.querySelector('#transfer2SameAddress').closest('label');
        if (!host || getComputedStyle(host).display === 'flow-root') throw new Error('Expected actual unfixed service address host.');
        const styled = { host, wrapper, firstHeading };
        const originalStyles = Object.fromEntries(Object.entries(styled).map(([name, node]) => [name, node.getAttribute('style')]));
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        const snapshot = () => {
            const bounds = rect(card);
            return { html: card.outerHTML, styles: Object.fromEntries(Object.entries(styled).map(([name, node]) => [name, node.getAttribute('style')])), card: bounds, host: rect(host),
                wrapper: rect(wrapper), firstHeading: rect(firstHeading), lastGroup: rect(lastGroup), sameAddress: rect(wrapper.querySelector('#transfer2SameAddress')), sameAddressLabel: rect(sameAddressLabel),
                margins: { wrapperTop: getComputedStyle(wrapper).marginTop, wrapperBottom: getComputedStyle(wrapper).marginBottom, firstTop: getComputedStyle(firstHeading).marginTop, lastBottom: getComputedStyle(lastGroup).marginBottom },
                viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scrollX, scrollY },
                controls: [...card.querySelectorAll('input,select,textarea')].map(node => { const box = rect(node); return {
                    id: node.id, name: node.name, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex, readOnly: node.readOnly, disabled: node.disabled,
                    attributes: Object.fromEntries([...node.attributes].map(attribute => [attribute.name, attribute.value])), rect: box,
                    relativeRect: { x: box.x - bounds.x, y: box.y - bounds.y, width: box.width, height: box.height } }; }),
                street: rect(card.querySelector('#transfer2Address')), phone: rect(card.querySelector('#transfer2Phone')), phoneLabel: rect(card.querySelector('label[for=transfer2Phone]')) };
        };
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type=importmap]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js'));
        const { captureElementScreenshot } = await import(imports[key]);
        const domToImage = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default, originalToBlob = domToImage.toBlob;
        const dataUrl = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        const capture = async name => {
            const before = snapshot(), clones = [], dates = [...card.querySelectorAll('input[type=date]')], originalDates = dates.map(node => node.value), dateCloneStates = [];
            const bounds = card.getBoundingClientRect();
            const privateFields = [...card.querySelectorAll('#winbackStep1e input[data-feedback-sensitive],#winbackStep1e textarea[data-feedback-sensitive]')]
                .filter(node => node.type !== 'hidden' && node.value && node.getClientRects().length).map(node => { const box = node.getBoundingClientRect(); return { id: node.id, type: node.type, dateOrdinal: dates.indexOf(node), x: box.x - bounds.x, y: box.y - bounds.y, width: box.width, height: box.height }; });
            domToImage.toBlob = async (node, options) => originalToBlob.call(domToImage, node, { ...options, onclone(clone) {
                const value = options.onclone(clone);
                const h = clone.querySelector('#transfer2CustomerForm .address-fields');
                const parent = clone.querySelector('#transfer2CustomerForm'), first = parent.querySelector(':scope > .form-subtitle:first-child'), last = parent.lastElementChild, label = parent.querySelector('#transfer2SameAddress').closest('label');
                clones.push({ hostHeight: h.style.height, hostDisplay: h.style.display, hostOverflow: h.style.overflow, wrapperHeight: parent.style.height, wrapperMarginTop: parent.style.marginTop, wrapperOverflow: parent.style.overflow, firstMarginTop: first.style.marginTop, lastMarginBottom: last.style.marginBottom, sameAddressLabelHeight: label.style.height, sameAddressLabelText: label.textContent.trim() });
                dateCloneStates.push([...clone.querySelectorAll('input[type=date]')].map((field, index) => ({ liveIso: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(originalDates[index] || ''), valuePresent: Boolean(field.value), valueMatchesOriginal: field.value === originalDates[index], attributeMatchesOriginal: field.getAttribute('value') === originalDates[index], attributeMatchesCurrent: field.getAttribute('value') === field.value })));
                return value;
            } });
            let result;
            try { result = await captureElementScreenshot({ element: card }); } finally { domToImage.toBlob = originalToBlob; }
            const after = snapshot();
            const pixels = async variant => { const bitmap = await createImageBitmap(variant.blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close(); return { context, width: canvas.width, height: canvas.height }; };
            const original = await pixels(result.original), pseudo = await pixels(result.pseudonymized), scale = pseudo.width / bounds.width;
            const textRects = [...sameAddressLabel.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()).flatMap(node => {
                const range = document.createRange(); range.selectNodeContents(node);
                return [...range.getClientRects()].filter(box => box.width > 0 && box.height > 0).map(box => ({ x: Math.round((box.x - bounds.x) * scale), y: Math.round((box.y - bounds.y) * scale), width: Math.ceil(box.width * scale), height: Math.ceil(box.height * scale) }));
            });
            let textChangedPixels = 0, originalTextPaintedPixels = 0;
            const textCovered = textRects.length > 0 && textRects.every(box => box.x >= 0 && box.y >= 0 && box.x + box.width <= pseudo.width && box.y + box.height <= pseudo.height);
            if (textCovered) for (const box of textRects) {
                const a = original.context.getImageData(box.x, box.y, box.width, box.height).data, b = pseudo.context.getImageData(box.x, box.y, box.width, box.height).data;
                for (let offset = 0; offset < a.length; offset += 4) { if (a[offset] !== 255 || a[offset + 1] !== 255 || a[offset + 2] !== 255) originalTextPaintedPixels++; if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2] || a[offset + 3] !== b[offset + 3]) textChangedPixels++; }
            }
            const checkboxRect = before.controls.find(node => node.id === 'transfer2SameAddress').relativeRect;
            const publicSameAddress = { textCovered, textRects, textChangedPixels, originalTextPaintedPixels, checkboxRect, text: sameAddressLabel.textContent.trim(),
                boundary: 'Only direct literal TEXT_NODE glyph regions compare exactly. Checkbox checked state is intentionally pseudonymized; each original/pseudo 20px box instead needs painted top and bottom borders.' };
            const fieldPixels = privateFields.map((field, index) => {
                const x = Math.max(0, Math.round((field.x + 4) * scale)), y = Math.max(0, Math.round((field.y + 4) * scale)), width = Math.min(pseudo.width - x, Math.floor((field.width - 8) * scale)), height = Math.min(pseudo.height - y, Math.floor((field.height - 8) * scale));
                if (width <= 0 || height <= 0) return { ...field, index, covered: false, changedPixels: 0 };
                const a = original.context.getImageData(x, y, width, height).data, b = pseudo.context.getImageData(x, y, width, height).data, originalColor = [...a.slice(0, 4)];
                let changedPixels = 0, originalUniform = true;
                for (let offset = 0; offset < a.length; offset += 4) { if (originalColor.some((v, c) => a[offset + c] !== v)) originalUniform = false; if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2]) changedPixels++; }
                return { ...field, index, covered: true, changedPixels, originalUniform, originalColor };
            });
            return { name, before, after, publicSameAddress, rawExact: JSON.stringify(before) === JSON.stringify(after), observerRestored: domToImage.toBlob === originalToBlob, clones, privacy: result.privacySummary,
                pixelProofInput: { fieldPixels, dateCloneStates, captureObserverRestored: domToImage.toBlob === originalToBlob, liveEditorExactlyUnchanged: JSON.stringify(before) === JSON.stringify(after), originalWidth: original.width, originalHeight: original.height, width: pseudo.width, height: pseudo.height },
                original: { width: result.original.width, height: result.original.height, png: await dataUrl(result.original.blob) }, pseudo: { width: result.pseudonymized.width, height: result.pseudonymized.height, png: await dataUrl(result.pseudonymized.blob) } };
        };
        const initial = snapshot(), states = [];
        try { states.push(await capture('before')); host.style.display = 'flow-root'; wrapper.style.marginTop = 'var(--space-5)'; firstHeading.style.marginTop = '0px'; states.push(await capture('margin-containment')); }
        finally { for (const [name, node] of Object.entries(styled)) { if (originalStyles[name] === null) node.removeAttribute('style'); else node.setAttribute('style', originalStyles[name]); } domToImage.toBlob = originalToBlob; }
        const restored = snapshot();
        return { initial, states, restored, restoredExactly: JSON.stringify(initial) === JSON.stringify(restored), originalStyles, restoredStyles: Object.fromEntries(Object.entries(styled).map(([name, node]) => [name, node.getAttribute('style')])) };
    });
    for (const state of report.sequence.states) {
        state.pixelProof = productionInputPixelProof(state.pixelProofInput, 'chromium');
        for (const [key, label] of [['original', 'original'], ['pseudo', 'pseudonymized']]) {
            const bytes = Buffer.from(state[key].png.split(',')[1], 'base64'), filename = state.name + '-' + label + '.png';
            await writeFile(path.join(evidenceDir, filename), bytes); delete state[key].png; state[key].file = filename; state[key].sha256 = hash(bytes);
            const png = PNG.sync.read(bytes);
            const borderTop = field => {
                const region = state.before.controls.find(node => node.id === field), expected = region.relativeRect.y, x0 = Math.round(region.relativeRect.x + 1), x1 = Math.round(region.relativeRect.x + region.relativeRect.width - 1), rows = [];
                const count = y => { if (y < 0 || y >= png.height) return 0; let n = 0; for (let x = x0; x < x1; x++) { const offset = (y * png.width + x) * 4, r = png.data[offset], g = png.data[offset + 1], b = png.data[offset + 2]; if (png.data[offset + 3] === 255 && r < 230 && g - r > 3 && b - g > 2) n++; } return n; };
                for (let y = Math.max(0, Math.floor(expected - 32)); y <= Math.min(png.height - 1, Math.ceil(expected + 32)); y++) if (count(y) >= (x1 - x0) * 0.8 && count(y + Math.round(region.rect.height) - 1) >= (x1 - x0) * 0.8) rows.push(y);
                if (!rows.length) throw new Error('Actual PNG control borders were not found for ' + field);
                return rows.sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected))[0];
            };
            const box = state.publicSameAddress.checkboxRect, left = Math.round(box.x), top = Math.round(box.y), width = Math.round(box.width), height = Math.round(box.height);
            const borderPaint = start => { let count = 0; for (let y = start; y <= start + 1; y++) for (let x = left; x < left + width; x++) {
                if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
                const offset = (y * png.width + x) * 4;
                if (png.data[offset + 3] === 255 && (png.data[offset] < 245 || png.data[offset + 1] < 245 || png.data[offset + 2] < 245)) count++;
            } return count; };
            state[key].sameAddressBoxPaint = { left, top, width, height, topBorderPixels: borderPaint(top), bottomBorderPixels: borderPaint(top + height - 2),
                boundary: 'Paint presence at both actual measured borders, not identical checked state.' };
            const streetTop = borderTop('transfer2Address'), phoneTop = borderTop('transfer2Phone');
            state[key].raster = { streetTop, phoneTop, delta: phoneTop - streetTop, nativeDelta: state.before.phone.top - state.before.street.top,
                method: 'Read original unmodified PNG border rows with existing Playwright PNG decoder; no image rewriting/normalization.' };
        }
    }
    const [before, after] = report.sequence.states;
    report.nativeControlsAndCardExact = JSON.stringify(Object.fromEntries(['controls', 'card', 'viewport', 'wrapper', 'firstHeading', 'lastGroup', 'sameAddress', 'sameAddressLabel'].map(name => [name, before.before[name]]))) === JSON.stringify(Object.fromEntries(['controls', 'card', 'viewport', 'wrapper', 'firstHeading', 'lastGroup', 'sameAddress', 'sameAddressLabel'].map(name => [name, after.before[name]])));
    report.nativeGapBefore = before.before.phoneLabel.top - before.before.street.bottom; report.nativeGapAfter = after.before.phoneLabel.top - after.before.street.bottom;
    report.baselineRastersDeviateFromNative = ['original', 'pseudo'].every(key => Math.abs(before[key].raster.delta - before[key].raster.nativeDelta) > 1);
    report.nativeGapMatchesAuthorized16 = Math.abs(report.nativeGapBefore - 16) < 0.1 && report.nativeGapBefore === report.nativeGapAfter;
    report.rasterMatchesNativeAfter = ['original', 'pseudo'].every(key => Math.abs(after[key].raster.delta - after[key].raster.nativeDelta) <= 1);
    report.sameAddressRowCompletelyRenderedAfter = after.publicSameAddress.textCovered && after.publicSameAddress.originalTextPaintedPixels > 0 && after.publicSameAddress.textChangedPixels === 0
        && ['original', 'pseudo'].every(key => after[key].sameAddressBoxPaint.topBorderPixels > 0 && after[key].sameAddressBoxPaint.bottomBorderPixels > 0);
    report.sourceAfter = await sourceHashes(); report.sourceExactlyUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(report.sourceAfter);
    report.helperSha256 = hash(await readFile(fileURLToPath(import.meta.url))); report.fixtureRequests = report.serviceEvidence.fixtureRequests;
    report.passed = report.addressConfirmed && report.nativeControlsAndCardExact && report.nativeGapMatchesAuthorized16 && report.baselineRastersDeviateFromNative && report.rasterMatchesNativeAfter && report.sameAddressRowCompletelyRenderedAfter
        && report.sequence.restoredExactly && report.sequence.states.every(state => state.rawExact && state.observerRestored && state.pixelProof.passed && state.privacy.verified && state.privacy.unresolvedValues === 0 && state.privacy.resourceFailures === 0)
        && report.sourceExactlyUnchanged && report.errors.length === 0 && report.blockedWrites.length === 0;
    if (!report.passed) process.exitCode = 1;
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally { releaseServiceFixtures(controls); await context.close(); await browser.close(); await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ passed: report.passed, errors: report.errors, blockedWrites: report.blockedWrites, nativeControlsAndCardExact: report.nativeControlsAndCardExact,
    nativeGapBefore: report.nativeGapBefore, nativeGapAfter: report.nativeGapAfter, baselineRastersDeviateFromNative: report.baselineRastersDeviateFromNative, sameAddressRowCompletelyRenderedAfter: report.sameAddressRowCompletelyRenderedAfter, restoredExactly: report.sequence?.restoredExactly, sourceExactlyUnchanged: report.sourceExactlyUnchanged,
    raster: report.sequence?.states.map(state => ({ name: state.name, original: state.original.raster, pseudo: state.pseudo.raster, pixelProof: state.pixelProof })) }, null, 2));
