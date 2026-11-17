// theme_audit: actual localized icon-button naming and unchanged selected-customer behavior.
export async function inspectClearResultsIcon(page, state, customer, { check, capture, focus, locale }) {
    await page.evaluate(async customer => window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer, requireFresh: true }), customer);
    await page.locator('#customerDetail').waitFor({ state: 'visible' });
    const identity = await page.evaluateHandle(() => {
        const read = () => { const context = window.kiwiCustomerWorkSession.getRequestContext(); return JSON.stringify({
            customer: window.currentCustomer, reference: context.customerReference, workflow: context.workflowSessionId,
            generation: context.contextGeneration, call: window.callSession
        }); };
        return { customer: window.currentCustomer, call: window.callSession, before: read(), read };
    });
    let glyph;
    try {
        for (const language of ['nl', 'en', 'nl']) {
            await locale(page, language);
            await page.evaluate(() => window.displaySearchResults([window.currentCustomer]));
            const button = page.locator('#searchResultsView [data-action=clear-search-results]'); await button.waitFor({ state: 'visible' });
            const expected = language === 'en' ? 'Close' : 'Sluiten';
            const attributes = await button.evaluate(node => ({ label: node.getAttribute('aria-label'), key: node.getAttribute('data-i18n-aria-label'), title: node.title,
                glyph: node.querySelector('svg')?.dataset.interfaceIcon, hidden: node.querySelector('svg')?.getAttribute('aria-hidden') }));
            check('clear-results has explicit localized aria label and decorative close SVG ' + language, attributes.label === expected
                && attributes.key === 'indexHtml.title.sluiten_dc802a5b' && attributes.title === expected && attributes.glyph === 'close' && attributes.hidden === 'true', { attributes });
            const roleMatch = page.locator('#searchResultsView').getByRole('button', { name: expected, exact: true });
            check('actual visible role/name locator uniquely resolves clear-results ' + language, await roleMatch.count() === 1
                && await roleMatch.evaluate(node => node.dataset.action === 'clear-search-results'));
            const snapshot = await button.ariaSnapshot();
            const accessible = { language, expected, snapshot, kind: 'Playwright actual DOM accessibility snapshot; no Firefox platform AX-tree API claim.' };
            if (state.report.environment.browser === 'chromium') {
                const session = await page.context().newCDPSession(page);
                try {
                    const document = await session.send('DOM.getDocument');
                    const { nodeId } = await session.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#searchResultsView [data-action=clear-search-results]' });
                    const tree = await session.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
                    const buttonNode = tree.nodes.find(node => node.role?.value === 'button');
                    accessible.chromiumAX = { role: buttonNode?.role?.value, name: buttonNode?.name?.value, ignored: buttonNode?.ignored };
                    check('actual Chromium browser AX tree exposes clear-results name ' + language, buttonNode?.name?.value === expected && buttonNode.ignored === false, accessible.chromiumAX);
                } finally { await session.detach(); }
            }
            check('actual accessibility snapshot names the button ' + language, snapshot.includes(`button "${expected}"`), accessible);
            state.report.clearResultsAccessibility ||= []; state.report.clearResultsAccessibility.push(accessible);
            if (!glyph) glyph = await button.locator('svg').elementHandle();
            check('locale changes retain the same actual close SVG node', await glyph.evaluate(node => node === document.querySelector('#searchResultsView [data-action=clear-search-results] svg') && node.isConnected));
            await focus(page, '#searchResultsView [data-action=clear-search-results]');
            await capture(page, 'clear-results-focused-' + language + '-' + state.report.clearResultsAccessibility.length, state.viewport,
                'Actual explicit localized icon-button name and keyboard focus after installed search renderer; fictional selected customer remains canonical.');
            await button.press('Enter');
            check('keyboard clear preserves exact selected customer/work-session/call identity ' + language, await identity.evaluate(value =>
                window.currentCustomer === value.customer && window.callSession === value.call && value.read() === value.before));
            check('keyboard clear hides results and restores existing selected customer details', !await page.locator('#searchResultsView').isVisible() && await page.locator('#customerDetail').isVisible());
        }
    } finally { await glyph?.dispose(); await identity.dispose(); }
}
