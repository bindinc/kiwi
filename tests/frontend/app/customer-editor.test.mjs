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
