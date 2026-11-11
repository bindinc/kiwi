import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { productionInputPixelProof } from './compose-smoke-theme-audit-customer-acceptance.mjs';

export async function registerSubscriptionAcceptance(report) {
    const modulePath = fileURLToPath(import.meta.url);
    report.subscriptionAcceptance ||= { module: { path: modulePath,
        sha256: createHash('sha256').update(await readFile(modulePath)).digest('hex') },
        unchangedPixelGuard: { path: fileURLToPath(new URL('./compose-smoke-theme-audit-customer-acceptance.mjs', import.meta.url)),
            sha256: createHash('sha256').update(await readFile(new URL('./compose-smoke-theme-audit-customer-acceptance.mjs', import.meta.url))).digest('hex') },
        states: [], interactions: [], privacy: [] };
}

export async function readSubscriptionPresentation(page) {
    return page.evaluate(() => {
        const root = document.getElementById('newSubscriptionForm'), form = document.getElementById('subscriptionForm');
        const read = node => {
            if (!node) return null;
            const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
            return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
                visible: Boolean(node.getClientRects().length) && css.visibility === 'visible', display: css.display,
                fontSize: parseFloat(css.fontSize), weight: css.fontWeight, lineHeight: parseFloat(css.lineHeight),
                paddingLeft: parseFloat(css.paddingLeft), paddingRight: parseFloat(css.paddingRight), radius: parseFloat(css.borderRadius),
                shadow: css.boxShadow, color: css.color, background: css.backgroundColor, borderLeftWidth: parseFloat(css.borderLeftWidth),
                borderTopWidth: parseFloat(css.borderTopWidth), borderBottomWidth: parseFloat(css.borderBottomWidth), borderColor: css.borderColor,
                overflow: node.scrollWidth > node.clientWidth + 1, opacity: Number(css.opacity), outline: css.outline,
                outlineWidth: parseFloat(css.outlineWidth), focusVisible: node.matches(':focus-visible') };
        };
        const sections = [...form.querySelectorAll('.subscription-form-block')].filter(node => node.getClientRects().length);
        const controls = [...form.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(node => node.getClientRects().length);
        return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
            root: read(root), card: read(root.querySelector('.onepager-container')), form: read(form), title: read(root.querySelector('h2')),
            product: read(form.querySelector('.werfsleutel-fieldset')), sections: sections.map(read),
            headings: [...form.querySelectorAll('.form-subtitle')].filter(node => node.getClientRects().length).map(read),
            fields: controls.map(node => {
                const bounds = read(node), block = read(node.closest('.subscription-form-block'));
                return { ...bounds, id: node.id, type: node.type, disabled: node.disabled,
                    readonly: Boolean(node.readOnly), label: Boolean(node.labels?.length || node.getAttribute('aria-label') || node.getAttribute('aria-labelledby')),
                    block, insideSectionInset: block && bounds.x >= block.x + block.paddingLeft - 1
                        && bounds.right <= block.right - block.paddingRight + 1 };
            }),
            dateCaptions: [...form.querySelectorAll('.subscription-start-date > label')].map(read),
            selected: [...form.querySelectorAll('.party-selected-person')].filter(node => node.getClientRects().length).map(read),
            payment: [...form.querySelectorAll('.payment-option')].map(node => ({ ...read(node),
                input: read(node.querySelector('input')), value: node.querySelector('input').value, checked: node.querySelector('input').checked })),
            consent: [...form.querySelectorAll('.optin-row')].map(node => ({ ...read(node),
                label: read(node.querySelector('.optin-label')), values: [...node.querySelectorAll('label')].map(read) })),
            primary: read(form.querySelector('button[type="submit"]')), cancel: read(form.querySelector('.form-actions [data-action="close-form"]')) };
    });
}

export function subscriptionPresentationChecks(data, reference, state) {
    const checks = [], add = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
    const near = (a, b, tolerance = 1) => Math.abs(parseFloat(a) - parseFloat(b)) <= tolerance;
    const inside = node => node.x >= data.card.x - 1 && node.right <= data.card.right + 1;
    add('subscription content has no sideways document card form or section scrolling', data.documentWidth <= data.viewport.width + 1
        && !data.card.overflow && !data.form.overflow && data.sections.every(node => !node.overflow && inside(node)), data);
    if (state === 'initial-top') {
        const columns = [...new Set(data.sections.map(node => Math.round(node.x)))];
        const expectedColumns = data.viewport.width >= 960 ? 2 : 1;
        const narrowest = Math.min(...data.sections.map(node => node.width));
        add('subscription sections use available desktop width and collapse in DOM order', columns.length === expectedColumns
            && data.sections.every(node => near(node.width, narrowest, 2) || node.width >= data.form.width - 2), { columns, expectedColumns });
        add('subscription title uses the showcase hierarchy on a flat workspace', data.card.radius === 0 && data.card.shadow === 'none'
            && near(data.title.fontSize, reference.subscriptionTitle.fontSize), { card: data.card, title: data.title });
        const expectedInset = data.viewport.width <= 768 ? 16 : 20;
        add('subscription sections have consistent readable insets and restrained headings', data.sections.length >= 5
            && data.sections.every(node => near(node.paddingLeft, expectedInset) && near(node.paddingRight, expectedInset) && node.radius === 0 && node.shadow === 'none')
            && data.headings.every(node => near(node.fontSize, reference.subscriptionHeading.fontSize)), { expectedInset, sections: data.sections, headings: data.headings });
        add('subscription product context is flat without nested rounded decoration', data.product.radius === 0 && data.product.shadow === 'none', data.product);
    }
    if (['create-recipient', 'create-payer', 'open-recipient-lookup'].includes(state)) {
        const textFields = data.fields.filter(node => !['radio', 'checkbox'].includes(node.type));
        add('active subscription fields keep labels standard text and usable control height', textFields.every(node => node.label
            && node.height >= 39 && node.insideSectionInset && near(node.fontSize, reference.subscriptionInput.fontSize)), textFields);
    }
    if (state.includes('guide') || state.includes('provider') || state.includes('source-reject'))
        add('guide field captions retain the showcase label role', data.dateCaptions.length >= 2
            && data.dateCaptions.every(node => near(node.fontSize, reference.subscriptionCaption.fontSize)
                && node.weight === reference.subscriptionCaption.fontWeight && near(node.lineHeight, reference.subscriptionCaption.lineHeight)), data.dateCaptions);
    if (['selected-recipient', 'different-payer'].includes(state)) {
        add('selected person remains a flat source context with the shared selection rule', data.selected.length > 0
            && data.selected.every(node => node.borderLeftWidth === 2 && node.radius === 0 && node.shadow === 'none' && inside(node)), data.selected);
    }
    if (state.includes('payment') || state.includes('consent-actions')) {
        add('subscription keeps visible native payment choices and a clear action region', data.payment.every(node => node.height >= 44
            && node.input.width >= 14 && node.input.height >= 14 && node.input.opacity === 1)
            && data.primary.height >= 40 && data.cancel.height >= 40 && data.primary.background !== data.cancel.background, data.payment);
        add('consent keeps persistent labels and separated native choices', data.consent.every(node => node.label.visible
            && node.height >= 44 && (node.borderBottomWidth === 1 || node.borderTopWidth === 1) && node.values.length === 2), data.consent);
    }
    return checks;
}

export async function checkSubscriptionState(page, driver, meta, state) {
    await registerSubscriptionAcceptance(driver.report);
    const data = await readSubscriptionPresentation(page);
    for (const { name, passed, detail } of subscriptionPresentationChecks(data, driver.contract, state))
        driver.check(name, passed, true, { ...meta, state, detail }, 5);
    driver.report.subscriptionAcceptance.states.push({ ...meta, state, data });
}

export async function subscriptionDraftSnapshot(page) {
    return page.evaluate(() => ({ fields: [...document.querySelectorAll('#subscriptionForm input,#subscriptionForm select,#subscriptionForm textarea')]
        .map(node => ({ id: node.id, name: node.name, value: node.value, checked: node.checked, disabled: node.disabled, readonly: node.readOnly })),
        offers: window.kiwiWerfsleutelSlice.getSelections().map(item => ({ offer: item.selectedKey, channel: item.selectedChannel })),
        people: ['recipient', 'requester'].map(role => ({ role, mode: subscriptionRoleState[role].mode, person: subscriptionRoleState[role].selectedPerson })),
        addressViews: [...document.querySelectorAll('#subscriptionForm select[id$="HouseExtChoices"]')].map(node => {
            const field = document.getElementById(node.id.replace(/Choices$/, ''));
            return { id: node.id, value: node.value, hidden: node.hidden, visible: Boolean(node.getClientRects().length), options: node.options.length,
                pairedId: field.id, pairedValue: field.value, pairedVisible: Boolean(field.getClientRects().length),
                pairedLabelled: Boolean(field.labels?.length), pairedReadonly: field.readOnly };
        }),
        samePayer: subscriptionRoleState.requesterSameAsRecipient }));
}

export function subscriptionDraftPreservation(before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return { passed: true, strictEqual: true, addressViewTeardowns: [] };
    const expected = structuredClone(before), transitions = [];
    for (let index = 0; index < before.addressViews.length; index++) {
        const original = before.addressViews[index], current = after.addressViews[index];
        if (JSON.stringify(original) === JSON.stringify(current)) continue;
        const fieldIndex = before.fields.findIndex(field => field.id === original.id);
        const modelBefore = before.fields.find(field => field.id === original.pairedId);
        const modelAfter = after.fields.find(field => field.id === original.pairedId);
        const expectedTeardown = current?.id === original.id && original.visible && !original.hidden && original.options > 0
            && original.value.length > 0 && original.value === original.pairedValue
            && current.hidden && !current.visible && current.options === 0 && current.value === ''
            && current.pairedValue === original.pairedValue && current.pairedVisible && current.pairedLabelled && current.pairedReadonly
            && modelBefore && modelAfter && original.pairedValue === modelBefore.value && current.pairedValue === modelAfter.value
            && JSON.stringify(modelBefore) === JSON.stringify(modelAfter) && fieldIndex >= 0;
        if (!expectedTeardown) return { passed: false, strictEqual: false, addressViewTeardowns: transitions };
        expected.addressViews[index] = current;
        expected.fields[fieldIndex].value = '';
        transitions.push({ id: original.id, pairedModelId: original.pairedId, before: original, after: current,
            kind: 'Actual endAddressSessions destroys the provider option view; the exact entered HouseExt model remains visible, labelled and readonly.' });
    }
    return { passed: JSON.stringify(expected) === JSON.stringify(after), strictEqual: false, addressViewTeardowns: transitions };
}

export async function inspectSubscriptionKeyboard(page, driver, meta) {
    await page.locator('#newSubscriptionForm .btn-close').focus();
    const path = [];
    for (let step = 0; step < 120; step++) {
        await page.keyboard.press('Tab');
        const item = await page.evaluate(() => {
            const node = document.activeElement, rect = node.getBoundingClientRect();
            const css = getComputedStyle(node);
            return { id: node.id, tag: node.tagName, type: node.type, name: node.getAttribute('name'),
                withinForm: Boolean(node.closest('#newSubscriptionForm')), focusVisible: node.matches(':focus-visible'),
                focused: node.matches(':focus'), focusWithin: node.matches(':focus-within'), outline: css.outline,
                outlineWidth: parseFloat(css.outlineWidth), outlineStyle: css.outlineStyle,
                reachable: rect.width > 0 && rect.height > 0 && rect.x >= -1 && rect.right <= innerWidth + 1 && rect.y >= -1 && rect.bottom <= innerHeight + 1,
                cancel: Boolean(node.matches('#subscriptionForm .form-actions [data-action="close-form"]')) };
        });
        path.push(item);
        if (item.withinForm && item.type === 'date' && !item.focusVisible)
            await driver.capture(page, (meta.native ? 'native-200-' : 'after-') + 'subscription-native-date-focus-step-' + step, undefined,
                'Actual native DATE internal Tab stop diagnostic; full focus path and computed host outline recorded, no native-focus exemption.');
        if (item.cancel || !item.withinForm) break;
    }
    driver.check('actual native Tab traverses subscription controls to Cancel within the visible viewport', path.length > 5
        && path[0].id === 'werfsleutelInput' && path.at(-1).cancel && path.every(item => item.withinForm && item.reachable && item.focusVisible), true, { ...meta, path }, 5);
    driver.report.subscriptionAcceptance.interactions.push({ ...meta, keyboardPath: path });
    await driver.capture(page, (meta.native ? 'native-200-' : 'after-') + 'subscription-keyboard-cancel', undefined,
        'Actual native Tab traversal; no form activation, DOM focus reorder, save or transaction.');
}

export async function inspectSubscriptionPrivacy(page, driver, meta) {
    const hasMembership = await page.evaluate(() => window.kiwiWerfsleutelSlice.getSelections().some(item => item.selectedKey.salesCode === 'THEME05-MEMBER'));
    if (!hasMembership) {
        await page.locator('#werfsleutelInput').fill('THEME05-MEMBER');
        await page.locator('.werfsleutel-suggestion[data-code="THEME05-MEMBER"]').press('Enter');
        await page.locator('.channel-chip[data-arg-sales-code="THEME05-MEMBER"][data-arg-combination-key="OL"]').press('Enter');
    }
    await page.locator('#subStartDate').fill('2035-03-25');
    await page.locator('#subIBAN').fill('NL80INGB0001340187');
    for (const role of ['Recipient', 'Requester']) {
        await page.locator('#sub' + role + 'LastName').fill('Synthetic private family ' + role);
        await page.locator('#sub' + role + 'Email').fill(role.toLowerCase() + '-private05@example.invalid');
        const phone = page.locator('#sub' + role + 'Phone,#sub' + role + 'LandlinePhone').first();
        if (await phone.count()) await phone.fill('0209462718');
    }
    await page.evaluate(() => Promise.all(['recipient', 'requester'].map(role => window.kiwiSubscriptionRoleRuntime.evaluateSubscriptionDuplicateRole(role))));
    await page.waitForFunction(() => ['recipient', 'requester'].every(role => {
        const state = window.kiwiSubscriptionRoleRuntime.getSubscriptionDuplicateRoleState(role);
        return state && !state.isChecking && state.debounceTimer === null;
    }), null, { timeout: 10000 });
    const result = await page.evaluate(async diagnostic => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js'));
        if (!key) throw new Error('Actual production screenshot module is required.');
        const { captureElementScreenshot } = await import(imports[key]);
        const element = document.querySelector('#newSubscriptionForm .onepager-container'), bounds = element.getBoundingClientRect();
        const snapshot = () => ({ html: element.outerHTML, fields: [...element.querySelectorAll('input,select,textarea')]
            .map(node => ({ id: node.id, name: node.name, type: node.type, value: node.value, checked: node.checked,
                disabled: node.disabled, readonly: node.readOnly, selected: node.selectedIndex,
                attributes: Object.fromEntries([...node.attributes].map(attribute => [attribute.name, attribute.value])) })) });
        const dates = [...element.querySelectorAll('input[type="date"]')], originalDates = dates.map(node => node.value);
        const fields = [...element.querySelectorAll('input[data-feedback-sensitive],textarea[data-feedback-sensitive]')]
            .filter(node => node.value.length >= 5 && node.getBoundingClientRect().width > 0).map(node => {
                const rect = node.getBoundingClientRect();
                return { type: node.type, dateOrdinal: dates.indexOf(node), x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height };
            });
        const before = snapshot(), livePhases = [], domToImage = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default;
        const sample = name => {
            const value = snapshot();
            livePhases.push(diagnostic ? { name, ...value } : { name, htmlExact: value.html === before.html,
                fieldsExact: JSON.stringify(value.fields) === JSON.stringify(before.fields), emptyStyles: element.querySelectorAll('[style=""]').length });
        };
        if (diagnostic) livePhases.push({ name: 'before-instrumentation-import', ...before });
        sample('after-instrumentation-import');
        const captionSelector = 'label,.form-label,.optin-label,.form-subtitle,.subscription-start-date > p[role="status"],.subscription-start-date > legend,.subscription-offer-title';
        const cataloguePublications = new Set(window.kiwiWerfsleutelSlice.getSelections().map(item => item.selectedKey.magazine));
        const publicationBadgeIndices = [...element.querySelectorAll('.subscription-offer-meta-badge')]
            .flatMap((node, index) => cataloguePublications.has(node.textContent.trim()) ? [index] : []);
        const fixedCopy = root => [...root.querySelectorAll(captionSelector), ...publicationBadgeIndices.map(index =>
            root.querySelectorAll('.subscription-offer-meta-badge')[index]).filter(Boolean)].map(node => node.textContent.trim());
        const captionsBefore = fixedCopy(element);
        const originalIban = element.querySelector('#subIBAN').value.replace(/\s+/g, '').toUpperCase();
        const originalToBlob = domToImage.toBlob, dateCloneStates = [], ibanCloneStates = [], publicCopyCloneStates = [];
        sample('before-production');
        domToImage.toBlob = async (node, options) => {
            const variant = dateCloneStates.length === 0 ? 'original' : 'pseudonymized';
            sample(variant + '-toBlob-entry');
            const blob = await originalToBlob.call(domToImage, node, { ...options, onclone(clone) {
            const result = options.onclone(clone);
            dateCloneStates.push([...clone.querySelectorAll('input[type="date"]')].map((field, index) => ({
                liveIso: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(originalDates[index] || ''), valuePresent: Boolean(field.value),
                valueMatchesOriginal: field.value === originalDates[index], attributeMatchesOriginal: field.getAttribute('value') === originalDates[index],
                attributeMatchesCurrent: field.getAttribute('value') === field.value })));
            const iban = clone.querySelector('#subIBAN');
            ibanCloneStates.push({ valuePresent: Boolean(iban.value), valueMatchesOriginalNormalized: iban.value.replace(/\s+/g, '').toUpperCase() === originalIban,
                attributeMatchesCurrent: iban.getAttribute('value') === iban.value });
            const captions = fixedCopy(clone);
            publicCopyCloneStates.push({ exact: JSON.stringify(captions) === JSON.stringify(captionsBefore),
                differences: captionsBefore.flatMap((text, index) => captions[index] === text ? [] : [{ index, before: text, after: captions[index] ?? null }]) });
            sample(variant + '-normal-onclone-complete');
            return result;
            } });
            sample(variant + '-toBlob-complete');
            return blob;
        };
        let capture;
        try { capture = await captureElementScreenshot({ element }); }
        finally { domToImage.toBlob = originalToBlob; }
        const afterCapture = snapshot(); sample('after-production');
        const pixels = async blob => {
            const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
            return { context, width: canvas.width, height: canvas.height };
        };
        const original = await pixels(capture.original.blob), pseudo = await pixels(capture.pseudonymized.blob);
        const scale = pseudo.width / bounds.width;
        const regions = fields.map((field, index) => {
            const x = Math.max(0, Math.round((field.x + 4) * scale)), y = Math.max(0, Math.round((field.y + 4) * scale));
            const width = Math.min(pseudo.width - x, Math.floor((field.width - 8) * scale));
            const height = Math.min(pseudo.height - y, Math.floor((field.height - 8) * scale));
            if (width <= 0 || height <= 0) return { index, type: field.type, covered: false, changedPixels: 0 };
            const a = original.context.getImageData(x, y, width, height).data, b = pseudo.context.getImageData(x, y, width, height).data;
            let changedPixels = 0, originalUniform = true;
            const originalColor = [...a.slice(0, 4)];
            for (let offset = 0; offset < a.length; offset += 4) {
                if (originalColor.some((value, component) => a[offset + component] !== value)) originalUniform = false;
                if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2]) changedPixels++;
            }
            return { index, type: field.type, dateOrdinal: field.dateOrdinal, covered: true, width, height, changedPixels, originalUniform, originalColor };
        });
        const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(capture.pseudonymized.blob); });
        const after = snapshot(); sample('after-pixel-analysis');
        let firstHtmlDifference = 0;
        while (firstHtmlDifference < Math.min(before.html.length, after.html.length) && before.html[firstHtmlDifference] === after.html[firstHtmlDifference]) firstHtmlDifference++;
        return { png, fieldPixels: regions, privacy: capture.privacySummary, liveEditorExactlyUnchanged: JSON.stringify(after) === JSON.stringify(before),
            restoration: { htmlExactAfterCapture: afterCapture.html === before.html, fieldsExactAfterCapture: JSON.stringify(afterCapture.fields) === JSON.stringify(before.fields),
                htmlExactAfterAnalysis: after.html === before.html, fieldsExactAfterAnalysis: JSON.stringify(after.fields) === JSON.stringify(before.fields),
                firstHtmlDifference, beforeFragment: before.html.slice(Math.max(0, firstHtmlDifference - 120), firstHtmlDifference + 200),
                afterFragment: after.html.slice(Math.max(0, firstHtmlDifference - 120), firstHtmlDifference + 200) }, livePhases,
            ibanCloneStates, publicCopyCloneStates,
            captureObserverRestored: domToImage.toBlob === originalToBlob, dateCloneStates,
            originalWidth: original.width, originalHeight: original.height, width: pseudo.width, height: pseudo.height };
    }, Boolean(meta.privacyDiagnostic));
    const { png, ...detail } = result;
    const pixelProof = productionInputPixelProof(result, driver.report.environment.browser);
    driver.check('actual subscription production capture redacts every populated sensitive input and restores the live draft', result.privacy.verified
        && result.privacy.unresolvedValues === 0 && result.privacy.resourceFailures === 0 && pixelProof.passed, true, { ...meta, detail, pixelProof }, 5);
    driver.check('production capture changes normalized private IBAN and preserves fixed public captions', result.ibanCloneStates.length === 2
        && result.ibanCloneStates[0].valueMatchesOriginalNormalized && !result.ibanCloneStates[1].valueMatchesOriginalNormalized
        && result.ibanCloneStates.every(state => state.attributeMatchesCurrent) && result.publicCopyCloneStates.every(state => state.exact), true,
    { ...meta, ibanCloneStates: result.ibanCloneStates, publicCopyCloneStates: result.publicCopyCloneStates }, 5);
    if (pixelProof.unpaintedDateRegions.length) driver.report.limitations.push('Firefox SVG originally renders the populated membership DATE as a uniform opaque region. Exact original/sanitized clone property+attribute, unchanged live-state and dimension proof is required; actual native DATE is checked separately atOS200.');
    const filename = `${meta.viewport.width}x${meta.viewport.height}-after-subscription-production-pseudonymized.png`;
    await writeFile(path.join(driver.evidenceDir, filename), Buffer.from(png.split(',')[1], 'base64'));
    driver.report.captures.push({ name: 'after-subscription-production-pseudonymized', filename, viewport: meta.viewport,
        kind: 'Actual production clone capture on synthetic new-person drafts; unmodified pseudonymized PNG only, original kept in memory, no upload.',
        captureMethod: 'Actual production captureElementScreenshot', geometry: { width: result.width, height: result.height } });
    driver.report.subscriptionAcceptance.privacy.push({ ...meta, detail });
    for (const [name, selector] of [['recipient', '#recipientRolePanel'], ['payer', '#requesterRolePanel'],
        ['payment-dates', '.subscription-payment-block'], ['consent', '.subscription-consent-block']]) {
        const component = await page.evaluate(async selector => {
            const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
            const key = Object.keys(imports).find(key => key.endsWith('/contextual-feedback/screenshot.js'));
            const { captureElementScreenshot } = await import(imports[key]);
            const capture = await captureElementScreenshot({ element: document.querySelector('#newSubscriptionForm ' + selector) });
            const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(capture.pseudonymized.blob); });
            return { png, width: capture.pseudonymized.width, height: capture.pseudonymized.height, privacy: capture.privacySummary };
        }, selector);
        const filename = `${meta.viewport.width}x${meta.viewport.height}-subscription-production-${name}-pseudonymized.png`;
        await writeFile(path.join(driver.evidenceDir, filename), Buffer.from(component.png.split(',')[1], 'base64'));
        driver.report.captures.push({ name: 'subscription-production-' + name + '-pseudonymized', filename, viewport: meta.viewport,
            kind: 'Actual production component capture for readable fixed-copy diagnostic; unmodified pseudonymized PNG only, no upload.',
            captureMethod: 'Actual production captureElementScreenshot', geometry: { width: component.width, height: component.height } });
    }
}
