// theme_audit: read-only production clone observations; never remove an observed application stylesheet.
export async function startCaptureStyleProbe(page, state) {
    const probe = await page.evaluateHandle(async () => {
        const sdk = (await import('https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm')).default;
        const original = sdk.toBlob, baselineStyles = [...document.head.querySelectorAll('style')], ids = new Map(), calls = [];
        const avatar = document.querySelector('.agent-avatar'), avatarHtml = avatar?.outerHTML;
        const nodeId = node => { if (!ids.has(node)) ids.set(node, ids.size + 1); return ids.get(node); };
        baselineStyles.forEach(nodeId);
        const rectangle = node => { const b = node.getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; };
        const presentation = node => {
            const css = getComputedStyle(node);
            return { tag: node.tagName, className: typeof node.className === 'string' ? node.className : '', bounds: rectangle(node),
                display: css.display, visibility: css.visibility, opacity: css.opacity, filter: css.filter, background: css.backgroundColor,
                color: css.color, masked: node.hasAttribute('data-feedback-mask') };
        };
        const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(value => value.toString(16).padStart(2, '0')).join('');
        const snapshot = async stage => {
            const styles = await Promise.all([...document.head.querySelectorAll('style')].map(async node => ({
                id: nodeId(node), sha256: await hash(node.textContent), bytes: new TextEncoder().encode(node.textContent).length,
                maskingSelector: node.textContent.includes('[data-feedback-mask]'), baselineIdentity: baselineStyles.includes(node),
                ownerIsLiveDocument: node.ownerDocument === document, parentIsLiveHead: node.parentNode === document.head, connected: node.isConnected
            })));
            const ancestors = []; for (let node = avatar?.parentElement; node; node = node.parentElement) ancestors.push(presentation(node));
            return { stage, headStyleCount: styles.length, styles, baselineStyleIdentitiesRetained: baselineStyles.every(node => node.isConnected && node.parentNode === document.head),
                avatar: avatar ? { root: presentation(avatar), children: [...avatar.children].map(presentation), ancestors,
                    exactOriginalDom: avatar.outerHTML === avatarHtml, sameNode: avatar === document.querySelector('.agent-avatar') } : null,
                bodyClass: document.body.className, documentClass: document.documentElement.className,
                roles: [...document.querySelectorAll('.profile-menu-role')].map(node => node.textContent.trim()),
                feedback: [...document.querySelectorAll('.contextual-feedback-modal')].map(node => ({ open: node.open, hidden: node.hidden,
                    className: node.className, display: getComputedStyle(node).display, ariaBusy: node.getAttribute('aria-busy') })),
                cloneCalls: calls.map(call => ({ ...call })) };
        };
        const wrapper = (node, options) => original.call(sdk, node, { ...options, onclone(clone) {
            const before = [...document.head.querySelectorAll('style')];
            try { return typeof options.onclone === 'function' ? options.onclone(clone) : undefined; }
            finally {
                const after = [...document.head.querySelectorAll('style')];
                calls.push({ call: calls.length + 1, cloneOwnerIsLiveDocument: clone.ownerDocument === document,
                    originalOwnerIsLiveDocument: node.ownerDocument === document, cloneIsOriginal: clone === node, cloneConnected: clone.isConnected,
                    beforeStyleCount: before.length, afterStyleCount: after.length,
                    addedLiveHeadStyleIds: after.filter(style => !before.includes(style)).map(nodeId) });
            }
        } });
        sdk.toBlob = wrapper;
        return { snapshot, restore() { const wasObserver = sdk.toBlob === wrapper; sdk.toBlob = original;
            return { wasObserver, exactOriginalFunctionRestored: sdk.toBlob === original }; } };
    });
    state.report.captureStyleProbe = { kind: 'DIAGNOSTIC read-only observer; no application restoration/acceptance claim, no observed stylesheet removed.', observations: [] };
    const record = async stage => {
        const observation = await probe.evaluate((value, name) => value.snapshot(name), stage);
        state.report.captureStyleProbe.observations.push(observation);
        return observation;
    };
    try { await record('before-production-capture'); }
    catch (error) { await probe.evaluate(value => value.restore()); await probe.dispose(); throw error; }
    return { record, async stop() {
        try {
            state.report.captureStyleProbe.instrumentation = await probe.evaluate(value => value.restore());
            return await record('after-observer-restoration');
        } finally { await probe.dispose(); }
    } };
}
