import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openCustomerEditor, mutationPath } from '../../../assets/js/app/customer-editor.js';
import { createEditorDocument } from '../support/editor-dom.mjs';

test('source viewer uses explicit contact selection, masks banks and cannot submit disabled operations', async () => {
    const oldDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    let writes = 0;
    try {
        await openCustomerEditor({ id: '123', credentialKey: 'test', lastName: 'Test' }, {
            api: { async get() { return {
                capabilities: { roleCanWrite: true, operations: {} }, version: null,
                sections: { person: [{ id: '123', fields: { firstName: 'Alex', initials: 'A.B.' } }],
                    email: [{ id: 'e1', fields: { emailAddress: 'first@example.org' } }, { id: 'e2', fields: { emailAddress: 'second@example.org' } }],
                    bank: [{ id: null, fields: { bic: 'ABNANL2A' }, maskedIban: 'NL •••• 4300', deletionAllowed: false }] }
            }; }, async request() { writes++; } }, refresh() { throw new Error('No writes expected'); }
        });
        const dialog = document.body.children[0];
        const forms = dialog.querySelectorAll('form');
        assert.equal(forms[0].querySelectorAll('input')[0].value, 'Alex');
        assert.equal(forms[0].querySelectorAll('input')[1].value, 'A.B.');
        const selects = dialog.querySelectorAll('select');
        assert.equal(selects[2].value, '');
        assert.equal(forms[2].children.length, 0);
        selects[5].value = '0'; selects[5].emit('change');
        assert.ok(forms[5].children.some((child) => child.textContent.includes('NL •••• 4300')));
        assert.ok(forms[5].querySelectorAll('button').every((button) => button.disabled));
        forms[5].emit('submit');
        assert.equal(writes, 0);
    } finally { globalThis.document = oldDocument; }
});

test('source resource paths preserve opaque identifiers', () => {
    assert.equal(mutationPath('A/B', 'email', 'e?1'), '/api/v1/persons/A%2FB/emails/e%3F1');
    assert.equal(mutationPath('123', 'bank'), '/api/v1/persons/123/bank-accounts');
});

test('dismissed source edits retain input and version until a workspace reset', async () => {
    const { resetLightboxDrafts } = await import('../../../assets/js/app/lightbox-drafts.js');
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    let reads = 0;
    const customer = { id: '123', credentialKey: 'test', lastName: 'Test' };
    const options = {
        api: { async get() {
            reads++;
            return {
                capabilities: { roleCanWrite: true, operations: { 'person.update': { enabled: true } } },
                version: 'original-version',
                sections: { person: [{ id: '123', fields: { firstName: 'Alex' } }] }
            };
        } },
        refresh() {}
    };
    try {
        await openCustomerEditor(customer, options);
        const dialog = document.body.children[0];
        const input = dialog.querySelectorAll('input')[0];
        input.value = 'Unsubmitted draft';
        input.emit('input');
        dialog.querySelectorAll('button')[0].emit('click');
        assert.equal(dialog.open, false);
        await openCustomerEditor(customer, options);
        assert.equal(dialog.open, true);
        assert.equal(input.value, 'Unsubmitted draft');
        assert.equal(reads, 1, 'Reopening must not replace the model or its concurrency version');
        resetLightboxDrafts(document);
        await openCustomerEditor(customer, options);
        assert.equal(reads, 2);
        assert.equal(document.body.children.at(-1).querySelectorAll('input')[0].value, 'Alex');
    } finally { globalThis.document = previousDocument; }
});


test('retained customer editors keep section labels bound to their own controls', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    const options = {
        api: { async get() { return { capabilities: { operations: {} }, version: null, sections: {} }; } },
        refresh() {}
    };
    try {
        await openCustomerEditor({ id: 'first', credentialKey: 'test' }, options);
        document.body.children[0].close();
        await openCustomerEditor({ id: 'second', credentialKey: 'test' }, options);
        for (const dialog of document.body.children) {
            const labels = dialog.querySelectorAll('label');
            for (const select of dialog.querySelectorAll('select')) {
                assert.ok(labels.some(label => label.children.includes(select)), 'each label wraps its own section selector');
                assert.equal(select.id, undefined, 'retained dialogs do not create shared global selector IDs');
            }
        }
    } finally { globalThis.document = previousDocument; }
});

test('retained editors isolate heading, feedback and address IDs across credentials without losing drafts', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    let reads = 0;
    const customer = { personId: 'private/person', credentialKey: 'private-source-one', lastName: 'Sentinel Name' };
    const options = {
        api: { async get() {
            reads++;
            return {
                version: 'retained-version',
                capabilities: { roleCanWrite: true, operations: { 'address.update': { enabled: true } } },
                sections: { address: [{ id: 'opaque-address', fields: { postCode: '1234AB', housenumber: '7', street: 'First street', city: 'City', isoCountryCode: 'NL' } }] }
            };
        } }, refresh() {}
    };
    function addressSelector(dialog) { return dialog.querySelectorAll('select')[1]; }
    function ids(dialog) {
        return ['h2', 'p', 'input'].flatMap(tag => dialog.querySelectorAll(tag).map(node => node.id).filter(Boolean));
    }
    try {
        await openCustomerEditor(customer, options);
        const first = document.body.children[0];
        addressSelector(first).value = '0'; addressSelector(first).emit('change');
        const firstIds = ids(first);
        const address = first.querySelector('[data-address-prefix]');
        const firstPrefix = address.getAttribute('data-address-prefix');
        assert.match(firstPrefix, /^[A-Za-z][A-Za-z0-9]*$/);
        const postalCode = first.querySelector(`#${firstPrefix}PostalCode`);
        assert.equal(postalCode.value, '1234AB', 'the editor queries its own rendered address prefix');
        postalCode.value = '9876ZY';
        first.close();
        await openCustomerEditor({ ...customer, credentialKey: 'private-source-two' }, options);
        const second = document.body.children[1];
        addressSelector(second).value = '0'; addressSelector(second).emit('change');
        const secondIds = ids(second);
        assert.equal(new Set([...firstIds, ...secondIds]).size, firstIds.length + secondIds.length);
        for (const dialog of [first, second]) {
            assert.equal(dialog.querySelector(`#${dialog.getAttribute('aria-labelledby')}`).tag, 'h2');
            for (const label of dialog.querySelectorAll('label')) {
                const target = label.getAttribute('for');
                if (target) assert.equal(dialog.querySelector(`#${target}`).tag, 'input', 'address labels resolve inside their own dialog');
            }
            for (const input of dialog.querySelectorAll('input')) {
                const feedbackId = input.getAttribute('aria-describedby');
                assert.ok(dialog.querySelector(`#${feedbackId}`), 'feedback resolves in the same dialog');
            }
            assert.ok(ids(dialog).every(id => !id.includes('private')));
        }
        second.close();
        await openCustomerEditor(customer, options);
        assert.equal(first.open, true);
        assert.deepEqual(ids(first), firstIds);
        assert.equal(postalCode.value, '9876ZY');
        assert.equal(reads, 2, 'reopening a retained editor must not issue another read');
        assert.equal(first.querySelector('[data-address-prefix]').getAttribute('data-address-prefix'), firstPrefix);
        addressSelector(first).value = ''; addressSelector(first).emit('change');
        addressSelector(first).value = '0'; addressSelector(first).emit('change');
        assert.equal(first.querySelector('[data-address-prefix]').getAttribute('data-address-prefix'), firstPrefix, 'section changes retain address session ownership');
        const { resetLightboxDrafts } = await import('../../../assets/js/app/lightbox-drafts.js');
        resetLightboxDrafts(document);
        await openCustomerEditor(customer, options);
        const fresh = document.body.children[0];
        addressSelector(fresh).value = '0'; addressSelector(fresh).emit('change');
        assert.notEqual(fresh.querySelector('[data-address-prefix]').getAttribute('data-address-prefix'), firstPrefix);
        assert.equal(reads, 3, 'reset starts a fresh model with a new address ownership key');
    } finally { globalThis.document = previousDocument; }
});

test('editor marks data-bearing context and options while retaining public source and selection prompts', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    try {
        await openCustomerEditor({ id: 'private-reference', credentialKey: 'test', lastName: 'Sentinel Name', mandant: 'Public source' }, {
            api: { async get() { return { capabilities: { operations: {} }, version: null, sections: {
                phone: [{ id: 'phone', fields: { areaCode: '020', number: '1234567' } }],
                person: [{ id: 'person', fields: { firstName: 'Sentinel Name' } }]
            } }; } }, refresh() {}
        });
        const dialog = document.body.children[0];
        assert.equal(dialog.querySelectorAll('h2')[0].getAttribute('data-feedback-public'), '');
        const spans = dialog.querySelectorAll('span');
        assert.equal(spans.find(node => node.textContent === 'Sentinel Name').getAttribute('data-feedback-sensitive'), 'name');
        assert.equal(spans.find(node => node.textContent === 'private-reference').getAttribute('data-feedback-sensitive'), 'id');
        assert.equal(spans.find(node => node.textContent === 'Public source').getAttribute('data-feedback-public'), '');
        const options = dialog.querySelectorAll('option');
        assert.equal(options.find(node => node.textContent === '020 · 1234567').getAttribute('data-feedback-sensitive'), 'phone');
        assert.ok(options.filter(node => node.value === '').every(node => node.getAttribute('data-feedback-sensitive') === null && node.getAttribute('data-feedback-public') === ''));
        assert.ok(dialog.querySelectorAll('p').filter(node => node.getAttribute('role') === 'status').every(node => node.getAttribute('data-feedback-public') === ''), 'fixed status copy remains public during pseudonymization');
    } finally { globalThis.document = previousDocument; }
});
