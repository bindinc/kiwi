import { serviceCustomer } from './compose-smoke-theme-audit-service.mjs';
import { finishOperationalQueueFixture } from './compose-smoke-theme-audit-operational.mjs';
import { privacy09CalendarQuery, createPrivacy09Calendar } from './compose-smoke-theme-audit-operational-privacy.mjs';

// theme_audit: finite remaining painted icon states. No service callback is submitted.
export async function installIconCalendar(page, state) {
    let calendarReads = 0;
    const calendar = new URL('api/v1/catalog/delivery-calendar', state.baseUrl);
    await page.route(url => url.origin === calendar.origin && url.pathname === calendar.pathname, route => {
        const request = route.request(), url = new URL(request.url());
        const query = request.method() === 'GET' && !url.username && !url.password ? privacy09CalendarQuery(url, state.api) : null;
        if (!query || calendarReads >= 4) {
            state.report.deniedRequests.push({ method: request.method(), pathname: url.pathname, reason: 'Unexpected advanced calendar method/query/count.' });
            return route.abort('blockedbyclient');
        }
        calendarReads++;
        state.report.advancedCalendarReads ||= [];
        state.report.advancedCalendarReads.push({ method: 'GET', ...query, sourceGenerated: true, locallyFulfilled: true });
        return route.fulfill({ json: createPrivacy09Calendar(state.sourceRoot, query) });
    });
}

export async function installAdvancedIconCustomer(page, state) {
    await installIconCalendar(page, state);
    const customer = { ...structuredClone(serviceCustomer), sourceSystem: 'theme-audit-local', contactHistory: [], articles: [] };
    const url = new URL('api/v1/persons/990701?sourceSystem=theme-audit-local', state.baseUrl);
    let reads = 0;
    await page.route(url.href, route => {
        if (route.request().method() !== 'GET' || reads++) {
            state.report.deniedRequests.push({ reason: 'Extra advanced synthetic customer detail request.' });
            return route.abort('blockedbyclient');
        }
        state.report.advancedCustomerReads ||= [];
        state.report.advancedCustomerReads.push({ method: 'GET', exactQuery: true, syntheticId: customer.id, locallyFulfilled: true });
        return route.fulfill({ json: customer });
    });
    return customer;
}

export async function inspectAdvancedIconServices(page, state, customer, { check, capture, focus }) {
    const viewport = state.viewport;
    check('empty-search component context begins without a selected customer', await page.evaluate(() => !window.currentCustomer));
    await page.evaluate(() => window.clearSearchResults());
    await page.locator('#welcomeMessage svg[data-interface-icon=person]').waitFor({ state: 'visible' });
    await capture(page, 'advanced-cleared-welcome-person', viewport, 'Installed clearSearchResults on this fresh unselected empty fixture context; no selected-customer lifecycle claim.');
    await page.evaluate(() => window.displaySearchResults([]));
    await page.locator('#welcomeMessage svg[data-interface-icon=search]').waitFor({ state: 'visible' });
    await capture(page, 'advanced-no-results-search', viewport, 'Actual installed displaySearchResults with explicit empty local input; no API or customer reset.');
    const beforeCall = await page.evaluateHandle(() => ({ session: window.callSession }));
    try {
        await page.evaluate(customer => { window.callSession = { ...window.callSession, active: true, callerType: 'anonymous' }; window.displaySearchResults([customer]); }, customer);
        await page.locator('#paginatedResults .btn-identify-caller svg[data-interface-icon=person]').first().waitFor({ state: 'visible' });
        await capture(page, 'advanced-search-identify-person', viewport, 'Installed search renderer with explicit local customer and temporary anonymous-call display fixture; no caller identification or API command.');
    } finally { await beforeCall.evaluate(value => { window.callSession = value.session; window.clearSearchResults(); }); await beforeCall.dispose(); }
    await page.evaluate(async customer => window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer, requireFresh: true }), customer);
    await page.locator('#customerDetail').waitFor({ state: 'visible' });
    const history = await page.evaluateHandle(() => ({ customer: window.currentCustomer, history: window.currentCustomer.contactHistory }));
    try {
        await page.evaluate(() => { window.currentCustomer.contactHistory = [{ type: 'overlijden', description: 'Synthetic overlijden notice; raw text remains data.' }]; window.kiwiCustomerDetailSlice.displayDeceasedStatusBanner(); });
        await page.locator('.deceased-status-banner svg[data-interface-icon=warning]').waitFor({ state: 'visible' });
        await page.locator('.deceased-status-banner').scrollIntoViewIfNeeded(); await capture(page, 'advanced-deceased-warning', viewport,
            'Installed source deceased-banner renderer with explicit temporary local history input; no deceased-registration command or provider policy claim.');
    } finally {
        check('deceased component fixture restores original customer/history identity', await history.evaluate(value => {
            const sameCustomer = window.currentCustomer === value.customer; value.customer.contactHistory = value.history;
            window.kiwiCustomerDetailSlice.displayDeceasedStatusBanner();
            return sameCustomer && window.currentCustomer.contactHistory === value.history && !document.querySelector('.deceased-status-banner');
        })); await history.dispose();
    }
    const actions = await page.locator('#subscriptionsList .icon-btn').evaluateAll(nodes => nodes.map(node => ({
        action: node.dataset.action, name: node.getAttribute('aria-label'), glyph: node.querySelector('svg')?.dataset.interfaceIcon
    })));
    check('actual subscription edit and cancel icons retain accessible names', actions.some(action => action.action === 'edit-subscription' && action.glyph === 'edit')
        && actions.some(action => action.action === 'cancel-subscription' && action.glyph === 'ban') && actions.every(action => Boolean(action.name)), { actions });
    await page.locator('#subscriptionsList').scrollIntoViewIfNeeded(); await capture(page, 'advanced-subscription-actions', viewport);
    await focus(page, '#subscriptionsList [data-action=edit-subscription]');
    await page.locator('#subscriptionsList [data-action=edit-subscription]').first().press('Enter');
    await page.locator('#editSubscriptionForm').waitFor({ state: 'visible' }); await capture(page, 'advanced-edit-subscription', viewport);
    await page.locator('#editSubscriptionForm [data-action=close-form]').first().press('Enter');
    await page.locator('#subscriptionsList [data-action=cancel-subscription]').first().press('Enter');
    await page.locator('#winbackFlow').waitFor({ state: 'visible' }); await capture(page, 'advanced-winback', viewport);
    await page.locator('#winbackFlow [data-action=close-form]').first().press('Enter');
    await page.locator('#subscriptionsList [data-action=revert-restitution]').first().press('Enter');
    await page.locator('#restitutionTransferForm').waitFor({ state: 'visible' });
    check('actual source-shaped restitution title retains transfer SVG', await page.locator('#restitutionTransferTitle svg[data-interface-icon=transfer]').count() === 1);
    await capture(page, 'advanced-restitution-transfer', viewport); await page.locator('#restitutionTransferForm [data-action=close-form]').first().press('Enter');
    for (const [button, id] of [['#resendMagazineBtn', 'resendMagazineForm'], ['#editorialComplaintBtn', 'editorialComplaintForm']]) {
        await page.locator(button).press('Enter'); await page.locator('#' + id).waitFor({ state: 'visible' });
        await capture(page, 'advanced-' + id, viewport); await page.locator('#' + id + ' [data-action=close-form]').first().press('Enter');
    }
    await page.evaluate(() => window.kiwiDeliveryRemarksSlice.editDeliveryRemarks());
    await page.locator('#editDeliveryRemarksModal').waitFor({ state: 'visible' });
    check('actual delivery heading uses package SVG', await page.locator('#editDeliveryRemarksModal h2 svg[data-interface-icon=package]').count() === 1);
    await capture(page, 'advanced-delivery-package', viewport);
    await page.locator('[data-action=close-edit-delivery-remarks-modal]').first().press('Enter');
    await page.evaluate(() => {
        window.callQueue = { enabled: true, queue: [
            { id: 'icon-known', callerType: 'known', customerId: 990701, customerName: 'Synthetic known caller', serviceNumber: 'AVROBODE', waitTime: 187 },
            { id: 'icon-anonymous', callerType: 'anonymous', customerId: null, customerName: 'Synthetic anonymous caller', serviceNumber: 'AVROBODE', waitTime: 61 }
        ], currentPosition: 0, autoAdvance: true, waitTimeInterval: null };
        window.kiwiCallAgentRuntime.updateQueueDisplay(); window.kiwiCallAgentRuntime.openDebugModal(); window.kiwiCallAgentRuntime.updateDebugQueuePreview();
    });
    await page.locator('#debugModal').waitFor({ state: 'visible' });
    check('actual known and anonymous queue uses person/help and two clocks', await page.locator('#debugQueuePreview svg[data-interface-icon=person]').count() === 1
        && await page.locator('#debugQueuePreview svg[data-interface-icon=help]').count() === 1 && await page.locator('#debugQueuePreview svg[data-interface-icon=clock]').count() === 2);
    await page.locator('#debugQueuePreview').scrollIntoViewIfNeeded();
    await capture(page, 'advanced-known-anonymous-queue', viewport);
    for (const [index, name] of ['known', 'anonymous'].entries()) {
        const card = page.locator('#debugQueueList .debug-queue-item').nth(index); await card.scrollIntoViewIfNeeded();
        const painted = await card.evaluate(node => { const b = node.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: innerWidth, height: innerHeight }; });
        check('actual ' + name + ' queue card is inside the captured viewport', painted.top >= 0 && painted.left >= 0 && painted.bottom <= painted.height && painted.right <= painted.width, painted);
        await capture(page, 'advanced-queue-painted-' + name, viewport);
    }
    await page.locator('#debugModal [data-action="debug.close-modal"]').press('Enter');
    await page.evaluate(finishOperationalQueueFixture);
    const notification = await page.evaluate(async () => {
        const original = runtimeDependencies.showToast; let seen;
        runtimeDependencies.showToast = (...args) => { seen = { raw: args[0], type: args[1], presentation: args[2]?.presentation }; return original(...args); };
        try { await window.kiwiCallAgentRuntime.acceptNextCall(); }
        finally { runtimeDependencies.showToast = original; }
        return { ...seen, restored: runtimeDependencies.showToast === original, installedOutboxRetained: Boolean(window.kiwiOutbox) };
    });
    check('known notification forwards original raw text and separate warning presentation', notification.raw === '⚠️ Geen bellers in wachtrij'
        && notification.presentation?.icon === 'warning' && notification.presentation.message === 'Geen bellers in wachtrij' && notification.restored && notification.installedOutboxRetained, { notification });
    await page.locator('#toast svg[data-interface-icon=warning]').waitFor({ state: 'visible' }); await capture(page, 'advanced-notification-presentation', viewport,
        'Actual empty-queue handler and transparent exact-argument observer restored in finally. Installed outbox suppresses notification history; no notification persistence claim.');
}

export async function inspectAdvancedCallCompletion(page, state, control, { check, capture }) {
    const resumed = await page.evaluate(() => { const value = { ...window.callSession, onHold: false, holdStartTime: null, totalHoldTime: 12 }; delete value.durationInterval; return value; });
    control.gate.arm('POST', state.api + 'call-session/resume', {}, resumed); await page.locator('#holdCallBtn').press('Enter');
    await page.waitForFunction(() => window.callSession.onHold === false && !document.getElementById('holdIndicator'));
    check('actual resumed call restores pause SVG', await page.locator('#holdCallBtn svg[data-interface-icon=pause]').count() === 1);
    await capture(page, 'advanced-call-resumed', state.viewport);
    const lastCall = await page.evaluate(() => ({ customerId: null, customerName: null, serviceNumber: window.callSession.serviceNumber,
        startTime: window.callSession.startTime, callDuration: Math.floor((Date.now() - window.callSession.startTime) / 1000), waitTime: window.callSession.waitTime, totalHoldTime: window.callSession.totalHoldTime }));
    const idle = { ...resumed, active: false, customerId: null, customerName: null, startTime: null, recordingActive: false, onHold: false, holdStartTime: null };
    control.gate.arm('POST', state.api + 'call-session/end', { forcedByCustomer: false }, { last_call_session: lastCall, call_session: idle });
    control.gate.arm('POST', state.api + 'agent-status', { status: 'ready' }, { status: 'ready', teams_sync: null });
    await page.evaluate(() => window.kiwiCallAgentRuntime.endCallSession());
    await page.locator('#dispositionModal').waitFor({ state: 'visible' });
    check('actual ended-call ACW has clipboard and phone glyphs', await page.locator('#dispositionModal svg[data-interface-icon=clipboard]').count() > 0
        && await page.locator('#dispositionModal svg[data-interface-icon=phone]').count() > 0);
    await capture(page, 'advanced-ended-call-acw', state.viewport); await page.locator('#dispNotes').fill('Synthetic retained ACW note; no disposition submission.');
    await page.locator('#dispositionModal [data-action="disposition.cancel"]').first().press('Enter');
    check('all exact local call commands consumed without disposition submit', control.gate.pending().length === 0);
}

async function ownedCanvasPoint(page, canvas, state) {
    await canvas.scrollIntoViewIfNeeded();
    const attempts = [];
    for (let attempt = 0; attempt < 9; attempt++) {
        const probe = await canvas.evaluate(node => {
            const bounds = node.getBoundingClientRect();
            const clip = { left: Math.max(0, bounds.left), right: Math.min(innerWidth, bounds.right), top: Math.max(0, bounds.top), bottom: Math.min(innerHeight, bounds.bottom) };
            const ancestors = [];
            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                const style = getComputedStyle(parent), b = parent.getBoundingClientRect();
                const clipsX = /hidden|clip|auto|scroll/.test(style.overflowX), clipsY = /hidden|clip|auto|scroll/.test(style.overflowY);
                if (clipsX) { clip.left = Math.max(clip.left, b.left + parent.clientLeft); clip.right = Math.min(clip.right, b.left + parent.clientLeft + parent.clientWidth); }
                if (clipsY) { clip.top = Math.max(clip.top, b.top + parent.clientTop); clip.bottom = Math.min(clip.bottom, b.top + parent.clientTop + parent.clientHeight); }
                if (clipsX || clipsY) ancestors.push({ className: parent.className, overflowX: style.overflowX, overflowY: style.overflowY, scrollTop: parent.scrollTop, ...clip });
            }
            const points = [];
            if (clip.right > clip.left && clip.bottom > clip.top) {
                for (const [fx, fy] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) {
                    const x = clip.left + (clip.right - clip.left) * fx, y = clip.top + (clip.bottom - clip.top) * fy, hit = document.elementFromPoint(x, y);
                    points.push({ x, y, owned: hit === node, hitTag: hit?.tagName, hitClass: hit?.className });
                }
            }
            const wrap = node.closest('[data-feedback-canvas-wrap]').getBoundingClientRect();
            const scrollPoint = { x: Math.max(1, Math.min(innerWidth - 1, (wrap.left + wrap.right) / 2)), y: Math.max(1, Math.min(innerHeight - 1, (Math.max(0, wrap.top) + Math.min(innerHeight, wrap.bottom)) / 2)) };
            return { bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, clip, ancestors, points, scrollPoint };
        });
        attempts.push(probe);
        const owned = probe.points.find(point => point.owned);
        if (owned) {
            state.report.annotationPointerProbes ||= []; state.report.annotationPointerProbes.push({ viewport: { ...state.viewport }, attempts, owned });
            return owned;
        }
        if (state.nativeWorkspace) break;
        await page.mouse.move(probe.scrollPoint.x, probe.scrollPoint.y); await page.mouse.wheel(0, 100);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    state.report.annotationPointerProbes ||= []; state.report.annotationPointerProbes.push({ viewport: { ...state.viewport }, attempts, owned: null });
    throw new Error('No canvas-owned visible point after permitted scroll checks; no annotation gesture sent.');
}

export async function inspectNativeIconWorkspace(page, state, customer, { check, capture, focus }) {
    await page.evaluate(async customer => window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer, requireFresh: true }), customer);
    await page.locator('#customerDetail').waitFor({ state: 'visible' });
    await page.locator('#editCustomerBtn').scrollIntoViewIfNeeded();
    await page.evaluate(async () => {
        const imports = Object.assign({}, ...[...document.querySelectorAll('script[type=importmap]')].map(node => JSON.parse(node.textContent).imports));
        const moduleUrl = suffix => { const url = Object.entries(imports).find(([key]) => key.endsWith(suffix))?.[1]; if (!url) throw new Error('Installed workspace module missing: ' + suffix); return url; };
        const { openFeedbackDialog } = await import(moduleUrl('/contextual-feedback/dialog.js'));
        const { captureElementScreenshot } = await import(moduleUrl('/contextual-feedback/screenshot.js'));
        const { describeElement } = await import(moduleUrl('/contextual-feedback/selector.js'));
        await openFeedbackDialog({ opener: document.querySelector('#editCustomerBtn'), async onRequestScreenshot() {
            const element = document.querySelector('#editCustomerBtn .interface-icon-label'), rect = element.getBoundingClientRect();
            const captured = await captureElementScreenshot({ element, selectedElement: describeElement(element) });
            window.__themeAuditNativeWorkspaceCapture = { width: captured.pseudonymized.width, height: captured.pseudonymized.height,
                originalBytes: captured.original.blob.size, pseudonymizedBytes: captured.pseudonymized.blob.size, privacy: captured.privacySummary };
            return { selectionKind: 'element', selectedRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                selectedElement: captured.selectedElement, privacySummary: captured.privacySummary,
                screenshots: { original: captured.original, pseudonymized: captured.pseudonymized } };
        }, async onSubmit() { throw new Error('Native component fixture must never submit feedback.'); } });
    });
    const modal = page.locator('.contextual-feedback-modal'); await modal.waitFor({ state: 'visible' });
    await modal.locator('textarea[name=comment]').fill('Synthetic native workspace component draft; no native picker or drawing claim.');
    await modal.locator('[data-feedback-add-screenshot]').press('Enter');
    await page.waitForFunction(() => { const root = document.querySelector('.contextual-feedback-modal'), canvas = root?.querySelector('[data-feedback-canvas]');
        return root?.matches(':modal') && root.classList.contains('has-screenshot') && canvas?.width > 0 && !root.querySelector('[data-feedback-add-screenshot]').disabled; });
    const boundary = 'Actual OS200 installed dialog workspace with unchanged production capture callback fixture. Keyboard tools and owned geometry; no native picker/drawing/backend claim.';
    for (const tool of ['hand', 'rectangle', 'arrow', 'pin', 'text', 'blur']) {
        await modal.locator(`[data-feedback-tool=${tool}]`).press('Enter');
        check('native workspace keyboard tool becomes active ' + tool, await modal.locator(`[data-feedback-tool=${tool}]`).evaluate(node => node.classList.contains('is-active')));
    }
    await focus(page, '[data-feedback-tool=blur]'); await capture(page, 'native-workspace-keyboard-tools', state.viewport, boundary);
    const point = await ownedCanvasPoint(page, modal.locator('[data-feedback-canvas]'), state), layout = await canvasLayout(page);
    const privacy = await modal.evaluate(node => ({ pseudo: node.querySelector('[data-feedback-pseudonymized]').checked,
        veil: getComputedStyle(node).backgroundColor, backdrop: getComputedStyle(node).backdropFilter, shield: document.body.classList.contains('contextual-feedback-reviewing') }));
    const productionCapture = await page.evaluate(() => window.__themeAuditNativeWorkspaceCapture);
    check('native workspace uses verified actual production capture variants', productionCapture.originalBytes > 0 && productionCapture.pseudonymizedBytes > 0
        && productionCapture.privacy.verified && productionCapture.privacy.unresolvedValues === 0, productionCapture);
    check('actual native workspace keeps intrinsic privacy row and owned tiny canvas', layout.wrap.gridAutoRows === 'max-content'
        && layout.privacy.scrollHeight <= layout.privacy.clientHeight + 1 && point.owned, { layout, point });
    check('actual native workspace preserves pseudonymized image and privacy shield', privacy.pseudo && privacy.shield && privacy.veil === 'rgba(15, 23, 42, 0.86)' && privacy.backdrop === 'blur(14px)', privacy);
    state.report.nativeWorkspace = { boundary, layout, privacy, productionCapture, ownedPoint: point };
    await capture(page, 'native-workspace-owned-canvas', state.viewport, boundary);
    await focus(page, '.contextual-feedback-modal [data-feedback-close]'); await modal.locator('[data-feedback-close]').press('Enter');
}

async function canvasLayout(page) {
    return page.locator('[data-feedback-canvas]').evaluate(canvas => {
        const rect = node => { const b = node.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
        const wrap = canvas.closest('[data-feedback-canvas-wrap]'), privacy = wrap.querySelector('[data-feedback-privacy-status]'), css = getComputedStyle(wrap), bounds = rect(canvas);
        const owners = [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]].map(([fx, fy]) => {
            const x = bounds.left + bounds.width * fx, y = bounds.top + bounds.height * fy, hit = document.elementFromPoint(x, y);
            return { x, y, owned: hit === canvas, hitTag: hit?.tagName, hitClass: hit?.className };
        });
        return { wrap: { bounds: rect(wrap), gridTemplateRows: css.gridTemplateRows, gridAutoRows: css.gridAutoRows, clientHeight: wrap.clientHeight, scrollHeight: wrap.scrollHeight, scrollTop: wrap.scrollTop },
            privacy: { bounds: rect(privacy), clientHeight: privacy.clientHeight, scrollHeight: privacy.scrollHeight,
                children: [...privacy.children].map(node => ({ className: node.className, bounds: rect(node), scrollHeight: node.scrollHeight })) }, canvas: bounds, owners };
    });
}

async function startShortLayoutDiagnostic(page, state, { capture, check }) {
    const canvas = page.locator('[data-feedback-canvas]'); await canvas.scrollIntoViewIfNeeded();
    const before = await canvasLayout(page); state.report.shortLayoutDiagnostic = { kind: 'DIAGNOSTIC counterfactual only; never application acceptance.', before };
    await capture(page, 'diagnostic-grid-before', state.viewport, 'DIAGNOSTIC actual unchanged short tiny-image state before the single CSS counterfactual.');
    const baseline = await page.evaluateHandle(() => ({ styles: document.head.querySelectorAll('style').length,
        grid: getComputedStyle(document.querySelector('[data-feedback-canvas-wrap]')).gridAutoRows,
        pixels: document.querySelector('[data-feedback-canvas]').toDataURL(), comment: document.querySelector('textarea[name=comment]').value,
        pseudo: document.querySelector('[data-feedback-pseudonymized]').checked }));
    const style = await page.evaluateHandle(() => {
        const node = document.createElement('style'); node.textContent = '.contextual-feedback-canvas-wrap { grid-auto-rows: max-content; }'; document.head.append(node); return node;
    });
    try {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await canvas.scrollIntoViewIfNeeded(); state.report.shortLayoutDiagnostic.after = await canvasLayout(page);
        await capture(page, 'diagnostic-grid-max-content', state.viewport, 'DIAGNOSTIC only grid-auto-rows:max-content added; no source/picker/target/privacy rule change.');
    } catch (error) {
        await style.evaluate(node => node.remove()); await style.dispose(); await baseline.dispose(); throw error;
    }
    return async () => {
        try {
            await style.evaluate(node => node.remove());
            const restored = await baseline.evaluate(value => ({ styles: document.head.querySelectorAll('style').length === value.styles,
                grid: getComputedStyle(document.querySelector('[data-feedback-canvas-wrap]')).gridAutoRows === value.grid,
                pixels: document.querySelector('[data-feedback-canvas]').toDataURL() === value.pixels,
                comment: document.querySelector('textarea[name=comment]').value === value.comment,
                pseudo: document.querySelector('[data-feedback-pseudonymized]').checked === value.pseudo }));
            state.report.shortLayoutDiagnostic.restored = restored;
            check('diagnostic CSS removal restores grid/style count and exact image comment privacy choice', Object.values(restored).every(Boolean), restored);
            state.report.shortLayoutDiagnostic.afterRestoration = await canvasLayout(page);
            await capture(page, 'diagnostic-grid-restored', state.viewport, 'DIAGNOSTIC original source styling restored after pin/undo; no application acceptance.');
        } finally { await style.dispose(); await baseline.dispose(); }
    };
}

export async function inspectAnnotationIcons(page, state, { check, capture, focus, coarse }) {
    const comment = 'Synthetic icon annotation draft retained across picker cancellation and dialog dismissal.';
    const modal = page.locator('.contextual-feedback-modal'); await modal.locator('textarea[name=comment]').fill(comment);
    await modal.locator('[data-feedback-add-screenshot]').press('Enter'); await page.locator('.contextual-feedback-picker-overlay').waitFor({ state: 'visible' });
    check('actual screenshot capture disables its action and suspends dialog', await modal.locator('[data-feedback-add-screenshot]').isDisabled() && !await modal.isVisible());
    await page.keyboard.press('Escape'); await modal.waitFor({ state: 'visible' });
    check('cancelled actual picker preserves comment and restores capture action', await modal.locator('textarea[name=comment]').inputValue() === comment && await modal.locator('[data-feedback-add-screenshot]').isEnabled());
    await modal.locator('[data-feedback-close]').press('Enter'); await page.locator('#editCustomerBtn').scrollIntoViewIfNeeded();
    const target = await page.locator('#editCustomerBtn').boundingBox();
    check('actual visible customer edit button is a valid screenshot target', target && target.width > 0 && target.height > 0);
    await page.locator('#contextualFeedbackButton').press('Enter'); await modal.locator('[data-feedback-add-screenshot]').press('Enter');
    await page.locator('.contextual-feedback-picker-overlay').waitFor({ state: 'visible' });
    const current = await page.locator('#editCustomerBtn').boundingBox();
    if (coarse) await page.touchscreen.tap(current.x + current.width / 2, current.y + current.height / 2);
    else await page.mouse.click(current.x + current.width / 2, current.y + current.height / 2);
    await page.waitForFunction(() => { const modal = document.querySelector('.contextual-feedback-modal'), canvas = modal?.querySelector('[data-feedback-canvas]');
        return modal?.matches(':modal') && modal.classList.contains('has-screenshot') && canvas?.width > 0 && !modal.querySelector('[data-feedback-add-screenshot]').disabled; });
    const tools = await modal.locator('[data-feedback-tool]').evaluateAll(nodes => nodes.map(node => ({ tool: node.dataset.feedbackTool,
        name: node.getAttribute('aria-label'), glyph: node.querySelector('svg')?.dataset.interfaceIcon || null, text: node.textContent.trim() })));
    check('all six actual annotation controls have names and four SVG/two literal tool marks', tools.length === 6 && tools.every(tool => Boolean(tool.name))
        && ['move', 'rectangle', 'arrow-up-right', 'blur'].every(glyph => tools.some(tool => tool.glyph === glyph))
        && tools.some(tool => tool.tool === 'pin' && tool.text === '!') && tools.some(tool => tool.tool === 'text' && tool.text === 'T'), { tools });
    for (const tool of ['hand', 'rectangle', 'arrow', 'pin', 'text', 'blur']) {
        const button = modal.locator(`[data-feedback-tool=${tool}]`);
        if (coarse) await button.tap(); else await button.press('Enter');
        check('actual annotation active tool ' + tool, await button.evaluate(node => node.classList.contains('is-active')));
    }
    await focus(page, '[data-feedback-tool=blur]'); await capture(page, 'advanced-annotation-toolbar', state.viewport);
    const canvas = modal.locator('[data-feedback-canvas]'), before = await canvas.evaluate(node => node.toDataURL());
    const restoreLayout = state.layoutDiagnostic ? await startShortLayoutDiagnostic(page, state, { capture, check }) : null;
    try {
    if (coarse) await modal.locator('[data-feedback-tool=pin]').tap(); else await modal.locator('[data-feedback-tool=pin]').press('Enter');
    check('pseudonymized screenshot remains selected before annotation gesture', await modal.locator('[data-feedback-pseudonymized]').isChecked());
    const point = await ownedCanvasPoint(page, canvas, state);
    const pointer = await canvas.evaluateHandle(node => {
        const events = [], listener = event => events.push({ trusted: event.isTrusted, exactTarget: event.target === node, x: event.clientX, y: event.clientY });
        node.addEventListener('pointerdown', listener); return { events, node, listener };
    });
    try {
        if (coarse) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
        const events = await pointer.evaluate(value => value.events);
        check('actual annotation pointer gesture belongs to canvas and preserves pseudo variant', events.length === 1 && events[0].trusted && events[0].exactTarget
            && await modal.locator('[data-feedback-pseudonymized]').isChecked(), { events });
    } finally { await pointer.evaluate(value => value.node.removeEventListener('pointerdown', value.listener)); await pointer.dispose(); }
    check('actual annotation pin changes retained screenshot pixels', await canvas.evaluate((node, before) => node.toDataURL() !== before, before));
    await capture(page, 'advanced-annotation-painted-pin', state.viewport); await modal.locator('[data-feedback-undo]').press('Enter');
    check('actual annotation undo restores original retained image exactly', await canvas.evaluate((node, before) => node.toDataURL() === before, before));
    if (state.layoutDiagnostic) { await capture(page, 'diagnostic-pin-undo-complete', state.viewport, 'DIAGNOSTIC actual owned pin/undo with the one CSS counterfactual; not source acceptance.'); return; }
    await modal.locator('[data-feedback-close]').press('Enter'); await page.locator('#contextualFeedbackButton').press('Enter');
    check('actual dismissal retains image comment and privacy shield', await modal.locator('textarea[name=comment]').inputValue() === comment
        && await canvas.evaluate((node, before) => node.toDataURL() === before, before) && await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
    await capture(page, 'advanced-annotation-retained-draft', state.viewport); await modal.locator('[data-feedback-remove-screenshot]').press('Enter');
    await modal.locator('[data-feedback-workspace]').waitFor({ state: 'hidden' });
    check('actual image removal preserves comment and removes review shield', await modal.locator('textarea[name=comment]').inputValue() === comment
        && !await page.locator('body').evaluate(node => node.classList.contains('contextual-feedback-reviewing')));
    } finally { if (restoreLayout) await restoreLayout(); }
}
