import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const finalSource = process.env.KIWI_THEME_AUDIT_FINAL_SOURCE === '1';
const finalReference = '67f2532069054f48f0bc703b0a54b64edf655678ff8ae48bfb19f125e0cb5ccb';
export async function registerCustomerAcceptance(report) {
    report.customerAcceptance ||= { module: { path: modulePath, sha256: createHash('sha256').update(await readFile(modulePath)).digest('hex') }, states: [], privacy: [] };
}

export async function readCustomerPresentation(page) {
    return page.evaluate(() => {
        const bounds = node => {
            if (!node) return null;
            const r = node.getBoundingClientRect(), s = getComputedStyle(node);
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
                visible: r.width > 0 && r.height > 0 && s.visibility === 'visible', display: s.display,
                paddingLeft: parseFloat(s.paddingLeft), paddingRight: parseFloat(s.paddingRight),
                background: s.backgroundColor, color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
                radius: s.borderRadius, shadow: s.boxShadow, transform: s.transform,
                borderColor: s.borderTopColor, borderBottomWidth: s.borderBottomWidth, borderBottomColor: s.borderBottomColor,
                outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset,
                hover: node.matches(':hover'), pressed: node.matches(':active'), focus: node.matches(':focus-visible'), opacity: s.opacity,
                scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
        };
        const filter = document.querySelector('#additionalFiltersToggle');
        const role = document.createElement('span');
        role.style.cssText = 'background:var(--surface-subdued);color:var(--text-muted);border:1px solid var(--border-control)';
        document.body.append(role);
        const disabledRole = { background: getComputedStyle(role).backgroundColor, color: getComputedStyle(role).color, borderColor: getComputedStyle(role).borderTopColor };
        role.style.cssText = 'color:var(--action-hover);border:1px solid var(--action)';
        const rowActionRoles = { hoverColor: getComputedStyle(role).color, hoverBorder: getComputedStyle(role).borderTopColor };
        role.style.cssText = 'color:var(--action-active);border:1px solid var(--action-active)';
        rowActionRoles.pressedColor = getComputedStyle(role).color; rowActionRoles.pressedBorder = getComputedStyle(role).borderTopColor;
        role.remove();
        const rows = [...document.querySelectorAll('.result-row')].filter(row => bounds(row).visible).map(row => ({
            bounds: bounds(row), selected: row.classList.contains('is-selected'), current: row.getAttribute('aria-current'),
            cells: [...row.cells].map(bounds),
            views: [...row.querySelectorAll('button[data-action="select-customer"]')].map(button => ({ ...bounds(button), disabled: button.disabled }))
        }));
        const meta = document.querySelector('.customer-meta');
        const editors = [...document.querySelectorAll('.customer-editor')].filter(editor => editor.querySelector('.customer-editor-context'));
        const ids = editors.flatMap(editor => [...editor.querySelectorAll('[id]')].map(node => node.id));
        return { disabledRole, rowActionRoles, viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
            rootOverflow: getComputedStyle(document.documentElement).overflowX, bodyOverflow: getComputedStyle(document.body).overflowX,
            legacy: { card: bounds(document.querySelector('#editCustomerForm .onepager-container')), open: Boolean(document.querySelector('#editCustomerForm')?.getClientRects().length),
                fields: [...document.querySelectorAll('#editCustomerForm input,#editCustomerForm select,#editCustomerForm textarea')].map(field => ({ ...bounds(field), id: field.id, type: field.type, tag: field.tagName,
                    label: Boolean(field.labels?.length || field.getAttribute('aria-label') || field.getAttribute('aria-labelledby')),
                    labelBounds: field.labels?.length ? bounds(field.labels[0]) : null })) },
            filter: { bounds: bounds(filter), caption: bounds(filter.querySelector('[data-i18n]')), chevron: bounds(filter.querySelector('.chevron')),
                expanded: filter.getAttribute('aria-expanded') },
            sort: { ...bounds(document.querySelector('.sort-select')), tag: document.querySelector('.sort-select')?.tagName }, rows,
            record: { header: bounds(document.querySelector('.customer-header')), title: bounds(document.querySelector('.customer-info h2')),
                metadata: bounds(meta), labels: [...(meta?.querySelectorAll('dt') || [])].map(bounds), values: [...(meta?.querySelectorAll('dd') || [])].map(bounds) },
            duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
            editors: editors.map(editor => ({ open: editor.open, heading: editor.getAttribute('aria-labelledby'),
                headingOwned: Boolean(editor.querySelector('h2[id]') && document.getElementById(editor.getAttribute('aria-labelledby')) === editor.querySelector('h2[id]')),
                card: bounds(editor.querySelector('.onepager-container')), title: bounds(editor.querySelector('h2')),
                nameMarkers: editor.querySelectorAll('.customer-editor-context [data-feedback-sensitive="name"]').length,
                idMarkers: editor.querySelectorAll('.customer-editor-context [data-feedback-sensitive="id"]').length,
                publicSource: Boolean(editor.querySelector('.customer-editor-context [data-feedback-public]')),
                status: { visible: Boolean(editor.querySelector('.customer-editor-status')?.getClientRects().length),
                    state: editor.querySelector('.customer-editor-status')?.dataset.state || '',
                    populated: Boolean(editor.querySelector('.customer-editor-status')?.textContent.trim()),
                    public: Boolean(editor.querySelector('.customer-editor-status[data-feedback-public]')),
                    rawErrorReflected: editor.textContent.includes('Synthetic read-model lookup failure.') },
                fields: [...editor.querySelectorAll('input,select,textarea')].map(field => ({ ...bounds(field), id: field.id, tag: field.tagName, type: field.type, candidateList: field.classList.contains('address-completion-choices'),
                    readonly: Boolean(field.readOnly), disabled: field.disabled,
                    label: Boolean(field.labels?.length || field.getAttribute('aria-label') || field.getAttribute('aria-labelledby')),
                    labelBounds: field.labels?.length ? bounds(field.labels[0]) : null,
                    descriptionsOwned: (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).every(id => editor.contains(document.getElementById(id))) })),
                addresses: [...editor.querySelectorAll('[data-address-prefix]')].map(address => {
                    const prefix = address.dataset.addressPrefix, postal = address.querySelector(`[id="${prefix}PostalCode"]`);
                    return { prefix, editable: Boolean(postal && !postal.readOnly && !postal.disabled),
                        ownPostal: Boolean(postal && document.getElementById(postal.id) === postal),
                        status: Boolean(address.querySelector(`[id="${prefix}AddressStatus"]`)),
                        message: Boolean(address.querySelector(`[id="${prefix}AddressMessage"]`)),
                        choices: Boolean(address.querySelector(`[id="${prefix}AddressChoices"]`)) };
                }) })) };
    });
}

function fieldMatches(actual, expected) {
    const nativeSelect = actual.tag === 'SELECT' && actual.lineHeight === 'normal';
    return actual.fontSize === expected.fontSize && actual.fontWeight === expected.fontWeight && (nativeSelect || actual.lineHeight === expected.lineHeight);
}

function typeMatches(actual, expected) {
    return actual && actual.fontSize === expected.fontSize && actual.fontWeight === expected.fontWeight && actual.lineHeight === expected.lineHeight;
}

export function customerPresentationChecks(data, reference, state) {
    const checks = [], add = (name, passed, details = {}) => checks.push({ name, passed: Boolean(passed), ...details });
    add('customer presentation stays within the document without hiding overflow', data.documentWidth <= data.viewport.width + 1
        && (data.legacy.open || data.editors.some(editor => editor.open)
            || ![data.rootOverflow, data.bodyOverflow].some(value => ['hidden', 'clip'].includes(value))),
        { modalScrollLockIsSeparateFromFieldContainment: data.legacy.open || data.editors.some(editor => editor.open) });
    if (state.startsWith('filter-')) {
        const { bounds, caption, chevron } = data.filter;
        add('filter text and chevron retain deliberate inline insets', bounds.paddingLeft === 12 && bounds.paddingRight === 12
            && caption.x >= bounds.x + 11 && chevron.right <= bounds.right - 11, { filter: data.filter });
        add('filter keeps shared action type and stable40px target', bounds.height >= 40 && typeMatches(bounds, reference.primary)
            && bounds.radius === '0px' && bounds.transform === 'none', { filter: data.filter });
    }
    if (state === 'sort-keyboard-focus') {
        const focusPaint = finalSource
            ? data.sort?.tag === 'SELECT' && reference.referenceSha256 === finalReference && reference.inputFocus?.outlineWidth === '2px'
                && reference.inputFocus.outlineOffset === '0px' && reference.inputFocus.boxShadow === 'none'
                && data.sort?.outlineWidth === reference.inputFocus.outlineWidth
                && data.sort.outlineOffset === reference.inputFocus.outlineOffset
                && data.sort.outlineColor === reference.inputFocus.outlineColor && data.sort.shadow === reference.inputFocus.boxShadow
            : data.sort?.outlineWidth === '3px' && data.sort.outlineColor === reference.primary.backgroundColor && data.sort.shadow === 'none';
        add('sort uses the canonical single visible focus indicator', data.sort?.focus && focusPaint, { sort: data.sort });
    }
    if (data.rows.length && /results|view|mixed-table/.test(state)) {
        add('actual results preserve six native table cells with continuous row geometry', data.rows.every(row => row.cells.length === 6
            && row.cells.every(cell => cell.display === 'table-cell' && Math.abs(cell.bottom - row.bounds.bottom) <= 1)), { rows: data.rows });
        add('every row divider uses one consistent boundary across columns', data.rows.every((row, index) => (index === data.rows.length - 1 || row.cells[0].borderBottomWidth === '1px') && row.cells.every(cell =>
            cell.borderBottomWidth === row.cells[0].borderBottomWidth && (cell.borderBottomWidth === '0px' || cell.borderBottomColor === row.cells[0].borderBottomColor))), { rows: data.rows });
        const views = data.rows.flatMap(row => row.views);
        add('actual VIEW actions use the intended outlined secondary role', views.length > 0 && views.every(button => {
            const fill = button.disabled ? data.disabledRole.background : reference.secondary.backgroundColor;
            const ink = button.disabled ? data.disabledRole.color : button.pressed ? data.rowActionRoles.pressedColor : button.hover ? data.rowActionRoles.hoverColor : reference.secondary.color;
            const border = button.disabled ? data.disabledRole.borderColor : button.pressed ? data.rowActionRoles.pressedBorder : button.hover ? data.rowActionRoles.hoverBorder : reference.secondary.borderTopColor;
            return button.background === fill && button.color === ink && button.borderColor === border
                && button.radius === '0px' && button.height >= 40 && typeMatches(button, reference.primary) && button.transform === 'none';
        }), { views, reason: 'Table-specific enabled hover/pressed retains the reference white surface with action ink/border; shared disabled roles remain explicit. Surrounding row surfaces stay distinct.' });
        if (state === 'actual-view-keyboard-focus') add('VIEW native keyboard focus is visible', views.some(button => button.focus
            && button.outlineWidth === '3px' && button.outlineColor === reference.primary.backgroundColor), { views });
        if (state === 'actual-selected-results') add('actual repeated search marks the existing selected customer distinctly', data.rows.some(row => row.selected && row.current === 'true'
            && row.bounds.background === reference.customer['.sidebar-result'].backgroundColor), { rows: data.rows });
    }
    if (state === 'actual-record') {
        const record = data.record;
        add('customer title uses the rendered reference heading role', typeMatches(record.title, reference.title), { record });
        add('contact data occupies its own full-width band rather than a squeezed action column', record.metadata?.visible
            && Math.abs(record.metadata.width - record.header.width) <= 1, { record });
        add('record captions and values preserve the reference hierarchy', record.labels.length >= 3 && record.values.length === record.labels.length
            && record.labels.every(label => typeMatches(label, reference.customer['.detail span']) && label.color === reference.customer['.detail span'].color)
            && record.values.every(value => typeMatches(value, reference.customer['.detail strong']) && value.color === reference.customer['.detail strong'].color), { record });
    }
    if (state === 'legacy-editor') {
        const fields = data.legacy.fields.filter(field => field.visible && !['hidden', 'checkbox', 'radio', 'button', 'submit'].includes(field.type));
        add('actual legacy editor retains canonical labeled fields within its card', data.legacy.card?.width <= data.viewport.width + 1
            && fields.length > 0 && fields.every(field => field.label && field.height >= 40 && field.radius === '0px'
                && fieldMatches(field, reference.input) && (!field.labelBounds || typeMatches(field.labelBounds, reference.label))
                && field.x >= data.legacy.card.x - 1 && field.right <= data.legacy.card.right + 1), { legacy: data.legacy });
    }
    if (state.startsWith('source-') || state.includes('retained-')) {
        add('all retained editor IDs and dialog heading associations remain unambiguous', data.duplicateIds.length === 0
            && data.editors.every(editor => editor.headingOwned), { duplicateIds: data.duplicateIds, editors: data.editors });
        add('each retained identity has explicit private name/id and public source markers', data.editors.every(editor =>
            editor.nameMarkers === 1 && editor.idMarkers === 1 && editor.publicSource), { editors: data.editors });
        const active = data.editors.find(editor => editor.open);
        if (active) {
            add('editor fields retain associated labels and own descriptions', active.fields.every(field => (!field.visible || field.label) && field.descriptionsOwned
                && (!field.labelBounds || typeMatches(field.labelBounds, reference.label))), { editor: active });
            add('editor content remains flat with reference title and field grammar', active.card?.radius === '0px' && active.card.shadow === 'none'
                && typeMatches(active.title, reference.title)
                && active.fields.filter(field => field.visible).every(field => field.height >= 40 && field.radius === '0px'
                    && (field.candidateList
                        ? field.fontSize === reference.customer['.detail span'].fontSize && field.height >= 40
                        : fieldMatches(field, reference.input))), { editor: active });
            add('editor fields and card remain horizontally contained', active.card?.width <= data.viewport.width + 1
                && active.fields.filter(field => field.visible).every(field => field.x >= active.card.x - 1
                    && field.right <= active.card.right + 1), { editor: active });
            const needsAddress = !['source-editor-loading', 'source-editor-lookup-failed'].includes(state);
            const completionStarted = state.startsWith('source-address-') || state === 'retained-address-session-isolation';
            add('active editable addresses own their postal/status/message/choice nodes', (!needsAddress || active.addresses.length === 1) && active.addresses.every(address => address.ownPostal
                && (!completionStarted || !address.editable || (address.status && address.message && address.choices))), { editor: active });
            if (['source-editor-loading', 'source-editor-lookup-failed'].includes(state)) add('editor loading or lookup error remains explicit and public', active.status.visible
                && active.status.populated && active.status.public && !active.status.rawErrorReflected
                && (state !== 'source-editor-lookup-failed' || active.status.state === 'error'), { status: active.status });
            if (state === 'retained-editors-readonly-address') add('readonly editor shows native readonly controls without permitting edits', active.fields.some(field => field.tag === 'INPUT' && field.visible)
                && active.fields.filter(field => field.tag === 'INPUT').every(field => field.readonly), { editor: active });
        }
    }
    return checks;
}

export async function checkCustomerState(page, driver, meta, state) {
    await registerCustomerAcceptance(driver.report);
    const data = await readCustomerPresentation(page);
    for (const result of customerPresentationChecks(data, driver.contract, state)) {
        const { name, passed, ...details } = result;
        driver.check(name, passed, true, { ...meta, state, ...details }, 4);
    }
    driver.report.customerAcceptance.states.push({ ...meta, state, data });
}

export async function inspectEditorPrivacy(page, driver, meta) {
    const state = await page.evaluateHandle(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const entry = Object.entries(imports).find(([key]) => key.endsWith('/contextual-feedback/screenshot-redaction.js'));
        const resource = performance.getEntriesByType('resource').find(item => /\/contextual-feedback\/screenshot-redaction(?:-[\w-]{7})?\.js$/.test(new URL(item.name).pathname));
        const url = entry?.[1] || resource?.name;
        if (!url) throw new Error('Actual screenshot-redaction module URL is required.');
        const { redactScreenshotDom, createPseudonymContext } = await import(url);
        const editors = [...document.querySelectorAll('.customer-editor')].filter(editor => editor.querySelector('.customer-editor-context'));
        const snapshot = () => editors.map(editor => {
            const clone = editor.cloneNode(true);
            for (const node of clone.querySelectorAll('[style=""]')) node.removeAttribute('style');
            return { html: clone.outerHTML, rawHtml: editor.outerHTML, fields: [...editor.querySelectorAll('input,select,textarea')].map(field => ({
            id: field.id, value: field.value, checked: field.checked, selectedIndex: field.selectedIndex, readonly: field.readOnly, disabled: field.disabled })) }; });
        const emptyStyles = () => editors.reduce((count, editor) => count + editor.querySelectorAll('[style=""]').length, 0);
        const publicText = () => editors.flatMap(editor => [...editor.querySelectorAll('[data-feedback-public]')].map(node => node.textContent));
        const allPrivate = [...new Set(editors.flatMap(editor => [...editor.querySelectorAll('[data-feedback-sensitive]')]
            .map(node => ['INPUT', 'TEXTAREA'].includes(node.tagName) ? node.value : node.textContent.trim()).filter(value => value?.length >= 5)))];
        const before = snapshot(), emptyStylesBefore = emptyStyles(), publicBefore = publicText(), stylesBefore = document.head.querySelectorAll('style').length;
        const context = createPseudonymContext(), restores = [];
        try { for (const editor of editors) restores.push(redactScreenshotDom(document, { root: editor, context })); }
        catch (error) { for (const restore of restores.reverse()) restore(); throw error; }
        return { editors, before, publicBefore, stylesBefore, snapshot, publicText, allPrivate, restores, emptyStyles,
            inspect: () => {
                const afterText = editors.map(editor => editor.textContent + [...editor.querySelectorAll('input,textarea')].map(field => field.value).join('\n')).join('\n');
                return { editorCount: editors.length, emptyStylesBefore, emptyStylesAfterRedaction: emptyStyles(), privateSourceCount: allPrivate.length,
                    leakCount: allPrivate.filter(value => afterText.includes(value)).length,
                    publicPreserved: JSON.stringify(publicText()) === JSON.stringify(publicBefore),
                    kind: 'Actual SDK DOM redaction scoped to retained editor roots; fields/options/context, no upload or submission.' };
            } };
    });
    let result;
    try {
        result = await state.evaluate(value => value.inspect());
        driver.check('actual editor SDK redaction removes private context fields and options', result.editorCount >= 2
            && result.privateSourceCount > 0 && result.leakCount === 0, true, { ...meta, result }, 4);
        driver.check('editor public sources prompts and annotations survive redaction', result.publicPreserved, true, { ...meta, result }, 4);
        await driver.capture(page, meta.prefix + 'editor-sdk-redacted', undefined, result.kind);
    } finally {
        const restoration = await state.evaluate(value => {
            const emptyStylesAfterEvidenceScreenshot = value.emptyStyles();
            for (const restore of value.restores.reverse()) restore();
            const after = value.snapshot();
            const normalized = items => items.map(({ rawHtml, ...item }) => item);
            return { emptyStylesAfterEvidenceScreenshot, exactEditorDomAndFields: JSON.stringify(normalized(after)) === JSON.stringify(normalized(value.before)),
                rawHtmlRestored: after.every((item, index) => item.rawHtml === value.before[index].rawHtml),
                emptyStyleAttributeCounts: { before: value.before.reduce((count, item) => count + (item.rawHtml.match(/ style=""/g) || []).length, 0),
                    after: after.reduce((count, item) => count + (item.rawHtml.match(/ style=""/g) || []).length, 0) },
                normalization: 'Only inert empty style attributes introduced during direct-redaction screenshot evidence are ignored; phase counts attribute their origin. All nonempty styles, DOM content and field properties compare exactly.',
                publicRestored: JSON.stringify(value.publicText()) === JSON.stringify(value.publicBefore),
                stylesRestored: document.head.querySelectorAll('style').length === value.stylesBefore };
        });
        await state.dispose();
        driver.check('SDK restoration retains semantic editor DOM values selections and state', restoration.exactEditorDomAndFields
            && restoration.publicRestored && restoration.stylesRestored, true, { ...meta, restoration }, 4);
        driver.report.customerAcceptance.privacy.push({ ...meta, result, restoration });
    }
    await inspectProductionEditorCapture(page, driver, meta);
    await driver.capture(page, meta.prefix + 'editor-sdk-restored', undefined,
        'Actual retained editor after SDK restoration; no mutation or save.');
}

async function inspectProductionEditorCapture(page, driver, meta) {
    const result = await page.evaluate(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
        const entry = Object.entries(imports).find(([key]) => key.endsWith('/contextual-feedback/screenshot.js'));
        const resource = performance.getEntriesByType('resource').find(item => /\/contextual-feedback\/screenshot(?:-[\w-]{7})?\.js$/.test(new URL(item.name).pathname));
        const { captureElementScreenshot } = await import(entry?.[1] || resource?.name);
        const element = document.querySelector('.customer-editor[open] .onepager-container');
        const snapshot = () => ({ html: element.outerHTML, fields: [...element.querySelectorAll('input,select,textarea')].map(field => ({ value: field.value,
            selectedIndex: field.selectedIndex, checked: field.checked, readonly: field.readOnly, disabled: field.disabled })) });
        const before = snapshot(), rootBounds = element.getBoundingClientRect();
        const dateFields = [...element.querySelectorAll('input[type="date"]')];
        const originalDates = dateFields.map(field => field.value);
        const sensitiveFields = [...element.querySelectorAll('input[data-feedback-sensitive],textarea[data-feedback-sensitive]')]
            .filter(field => field.value.length >= 5 && field.getBoundingClientRect().width > 0)
            .map((field, index) => { const bounds = field.getBoundingClientRect(); return { index, tag: field.tagName, type: field.type, dateOrdinal: dateFields.indexOf(field),
                x: bounds.x - rootBounds.x, y: bounds.y - rootBounds.y, width: bounds.width, height: bounds.height }; });
        const domToImage = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default;
        const originalToBlob = domToImage.toBlob, dateCloneStates = [];
        domToImage.toBlob = (node, options) => originalToBlob.call(domToImage, node, { ...options, onclone(clone) {
            const result = options.onclone(clone);
            dateCloneStates.push([...clone.querySelectorAll('input[type="date"]')].map((field, index) => ({
                liveIso: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(originalDates[index] || ''),
                valueMatchesOriginal: field.value === originalDates[index], attributeMatchesOriginal: field.getAttribute('value') === originalDates[index],
                attributeMatchesCurrent: field.getAttribute('value') === field.value, valuePresent: Boolean(field.value)
            })));
            return result;
        } });
        let capture;
        try { capture = await captureElementScreenshot({ element }); }
        finally { domToImage.toBlob = originalToBlob; }
        const captureObserverRestored = domToImage.toBlob === originalToBlob;
        const toPixels = async variant => {
            const bitmap = await createImageBitmap(variant.blob), canvas = document.createElement('canvas');
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
            return { context, width: canvas.width, height: canvas.height };
        };
        const originalPixels = await toPixels(capture.original), pseudoPixels = await toPixels(capture.pseudonymized);
        const scale = capture.pseudonymized.width / rootBounds.width;
        const fieldPixels = sensitiveFields.map(field => {
            const x = Math.max(0, Math.round((field.x + 4) * scale)), y = Math.max(0, Math.round((field.y + 4) * scale));
            const width = Math.min(pseudoPixels.width - x, Math.max(1, Math.floor((field.width - 8) * scale)));
            const height = Math.min(pseudoPixels.height - y, Math.max(1, Math.floor((field.height - 8) * scale)));
            if (width <= 0 || height <= 0) return { index: field.index, type: field.type, covered: false, changedPixels: 0 };
            const original = originalPixels.context.getImageData(x, y, width, height).data;
            const pseudo = pseudoPixels.context.getImageData(x, y, width, height).data;
            let changedPixels = 0, originalUniform = true;
            const originalColor = [...original.slice(0, 4)];
            for (let offset = 0; offset < original.length; offset += 4) {
                if (originalColor.some((value, index) => original[offset + index] !== value)) originalUniform = false;
                if (original[offset] !== pseudo[offset] || original[offset + 1] !== pseudo[offset + 1] || original[offset + 2] !== pseudo[offset + 2]) changedPixels++;
            }
            return { index: field.index, type: field.type, dateOrdinal: field.dateOrdinal, covered: true, width, height, changedPixels, originalUniform, originalColor };
        });
        const png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(capture.pseudonymized.blob); });
        return { png, fieldPixels, dateCloneStates, captureObserverRestored, width: capture.pseudonymized.width, height: capture.pseudonymized.height, privacy: capture.privacySummary,
            originalProduced: capture.original.blob.size > 0, originalWidth: capture.original.width, originalHeight: capture.original.height,
            liveEditorExactlyUnchanged: JSON.stringify(snapshot()) === JSON.stringify(before),
            kind: 'Actual production captureElementScreenshot clone/onclone pipeline on synthetic retained editor; pseudonymized PNG only retained, no feedback submission/upload.' };
    });
    const { png, ...details } = result;
    driver.check('production editor capture creates a verified pseudonymized clone without changing live draft state', result.liveEditorExactlyUnchanged
        && result.originalProduced && result.width > 0 && result.height > 0 && result.privacy.verified && result.privacy.unresolvedValues === 0
        && result.privacy.resourceFailures === 0 && result.captureObserverRestored && result.dateCloneStates.length === 2, true, { ...meta, ...details }, 4);
    const pixelProof = productionInputPixelProof(result, driver.report.environment.browser);
    driver.check('production sensitive inputs have changed pixels or proven sanitized originally unpainted Firefox dates', pixelProof.passed, true,
        { ...meta, pixelProof, fieldPixels: result.fieldPixels, dateCloneStates: result.dateCloneStates,
            kind: 'Unmodified original/pseudonymized PNG pixels; unchanged nondate or painted-date regions fail. Only originally uniform opaque Firefox DATE regions require separate actual clone property/attribute proof.' }, 4);
    if (pixelProof.unpaintedDateRegions.length) driver.report.limitations.push('Firefox SVG foreignObject renders the original native DATE region as a uniform opaque background despite a valid serialized value. That capture-only blank-date limitation is explicit; sanitized clone property/attribute proof and unchanged live date state pass separately.');
    const filename = `${meta.viewport.width}x${meta.viewport.height}-${meta.prefix}editor-production-pseudonymized.png`;
    await writeFile(path.join(driver.evidenceDir, filename), Buffer.from(png.split(',')[1], 'base64'));
    driver.report.captures.push({ name: meta.prefix + 'editor-production-pseudonymized', filename, viewport: meta.viewport,
        kind: result.kind, captureMethod: 'Actual production dom-to-image clone pipeline pseudonymized PNG', geometry: { width: result.width, height: result.height } });
    driver.report.customerAcceptance.privacy.push({ ...meta, productionCapture: details });
}

export function productionInputPixelProof(result, browser) {
    const dimensionsMatch = result.originalWidth === result.width && result.originalHeight === result.height;
    const observedActualClones = result.captureObserverRestored && result.dateCloneStates?.length === 2;
    const statePreserved = result.liveEditorExactlyUnchanged;
    const unpaintedDateRegions = [];
    if (!dimensionsMatch || !observedActualClones || !statePreserved || result.fieldPixels.length < 4) return { passed: false, unpaintedDateRegions };
    for (const region of result.fieldPixels) {
        if (!region.covered) return { passed: false, unpaintedDateRegions };
        if (region.changedPixels > 0) continue;
        const originalDate = result.dateCloneStates[0][region.dateOrdinal], privateDate = result.dateCloneStates[1][region.dateOrdinal];
        const originallyBlankDate = browser === 'firefox' && region.type === 'date' && region.originalUniform && region.originalColor?.[3] === 255;
        const originalDatePreserved = originalDate?.liveIso && originalDate.valuePresent && originalDate.valueMatchesOriginal && originalDate.attributeMatchesOriginal && originalDate.attributeMatchesCurrent;
        const privateDateRemoved = privateDate && !privateDate.valueMatchesOriginal && !privateDate.attributeMatchesOriginal && privateDate.attributeMatchesCurrent;
        if (!originallyBlankDate || !originalDatePreserved || !privateDateRemoved) return { passed: false, unpaintedDateRegions };
        unpaintedDateRegions.push(region.index);
    }
    return { passed: true, unpaintedDateRegions };
}
