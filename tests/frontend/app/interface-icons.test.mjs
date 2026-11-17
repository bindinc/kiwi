import assert from 'node:assert/strict';
import test from 'node:test';
import { interfaceIcon, iconLabel } from '../../../assets/js/app/interface-icons.js';
import { createBootstrapSlice } from '../../../assets/js/app/slices/bootstrap-slice.js';
import { applyIndexHtmlTranslations } from '../../../assets/js/app/slices/localization-slice.js';
import { configureAppShellSliceDependencies, showToast } from '../../../assets/js/app/slices/app-shell-slice.js';
import { createEditorDocument } from '../support/editor-dom.mjs';

test('untrusted icon names and captions cannot inject SVG or executable markup', () => {
    assert.equal(interfaceIcon('person"><image href="https://unexpected.invalid"/>'), '');
    assert.equal(interfaceIcon('__proto__'), '');
    const markup = iconLabel('person', '<img src=x onerror=alert(1)> 👤 Free customer text');
    assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt; 👤 Free customer text/);
    assert.doesNotMatch(markup, /<img|<image|<script|<use|href=/);
    assert.match(markup, /aria-hidden="true" focusable="false"/);
});

test('readonly customer caption stays View through NL EN NL without replacing its SVG or customer state', () => {
    const previous = { window: globalThis.window, document: globalThis.document };
    try {
        const documentRef = createEditorDocument();
        const button = documentRef.createElement('button');
        button.id = 'editCustomerBtn'; button.style = {};
        button.setAttribute('data-i18n', 'indexHtml.text.bewerken_69177f14');
        button.removeAttribute = key => { delete button.attributes[key]; };
        documentRef.body.append(button);
        documentRef.getElementById = id => id === button.id ? button : null;
        const all = node => [node, ...node.children.flatMap(all)];
        documentRef.querySelectorAll = selector => {
            const attribute = selector.slice(1, -1);
            return all(documentRef.body).filter(node => node.getAttribute(attribute) !== null);
        };
        const labels = { nl: { 'customerEditorRecords.viewDetails': 'Gegevens bekijken', 'customerEditorRecords.edit': 'Bewerken' },
            en: { 'customerEditorRecords.viewDetails': 'View customer details', 'customerEditorRecords.edit': 'Edit' } };
        let locale = 'nl';
        globalThis.window = { i18n: { t: key => labels[locale][key] || key } };
        globalThis.document = documentRef;
        const customer = { id: 'synthetic-source', sourceSystem: 'subscription-api', credentialKey: 'synthetic-opaque' };
        const before = JSON.stringify(customer);
        const slice = createBootstrapSlice();
        slice.updateCustomerActionButtons({ documentRef, currentCustomer: customer });
        const svg = button.querySelector('svg');
        assert.ok(svg);
        assert.equal(button.getAttribute('data-i18n'), null, 'The stale parent Edit binding must be removed.');
        for (locale of ['nl', 'en', 'nl']) {
            applyIndexHtmlTranslations();
            assert.equal(button.querySelector('svg'), svg, 'Locale switching keeps the original icon node.');
            assert.equal(button.querySelector('span').textContent, labels[locale]['customerEditorRecords.viewDetails']);
        }
        assert.equal(JSON.stringify(customer), before);
        slice.updateCustomerActionButtons({ documentRef, currentCustomer: { id: 'synthetic-legacy' } });
        assert.equal(button.querySelector('span').getAttribute('data-i18n'), 'customerEditorRecords.edit');
    } finally { globalThis.window = previous.window; globalThis.document = previous.document; }
});

test('separate toast presentation never rewrites persisted history or arbitrary provider messages', () => {
    const previous = { window: globalThis.window, document: globalThis.document, setTimeout: globalThis.setTimeout };
    try {
        globalThis.window = {};
        const entries = [];
        configureAppShellSliceDependencies(() => ({ getCurrentCustomer: () => ({ id: 'synthetic-legacy' }),
            getContactHistoryState: () => null, pushContactHistory: (_customer, entry) => entries.push(entry) }));
        const raw = '📞 Gesprek gestart met Synthetic 👤';
        showToast(raw, 'info', { presentation: { icon: 'phone', message: 'Gesprek gestart met Synthetic 👤' } });
        assert.equal(entries[0].description, raw, 'Business/history description keeps every original character.');
        const toast = { textContent: '', innerHTML: '', classList: { add() {}, remove() {} } };
        globalThis.document = { getElementById: id => id === 'toast' ? toast : null, querySelectorAll: () => [] };
        globalThis.setTimeout = () => 1;
        configureAppShellSliceDependencies(() => ({ getCurrentCustomer: () => null }));
        const provider = '⚠️ Provider text <literal> 🛒';
        showToast(provider, 'warning');
        assert.equal(toast.textContent, provider, 'Unknown/provider text is not stripped or rewritten.');
        showToast(raw, 'info', { presentation: { icon: 'phone', message: '<Synthetic> 👤' } });
        assert.match(toast.innerHTML, /data-interface-icon="phone"/);
        assert.match(toast.innerHTML, /&lt;Synthetic&gt; 👤/);
        assert.equal(entries.length, 1);
    } finally {
        configureAppShellSliceDependencies(null);
        globalThis.window = previous.window; globalThis.document = previous.document; globalThis.setTimeout = previous.setTimeout;
    }
});
