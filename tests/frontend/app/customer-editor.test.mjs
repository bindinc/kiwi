import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openCustomerEditor, mutationPath } from '../../../assets/js/app/customer-editor.js';
import { createEditorDocument } from '../support/editor-dom.mjs';
import i18n from '../../../assets/js/i18n/index.js';
i18n.setLocale('nl');

const sectionRegion = (dialog, section) => dialog.querySelectorAll('section').find(node => node.getAttribute('data-customer-section') === section);
const recordActions = (region) => region.querySelectorAll('button').filter(node => node.getAttribute('data-customer-record-index') !== null);
const recordSummary = (region) => region.querySelectorAll('p').find(node => node.className === 'customer-editor-record-summary');
const settle = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };


test('readonly gender is an exact display mapping and leaves source data and unknown values intact', async () => {
    const previousDocument = globalThis.document;
    const examples = [
        ['Geachte heer', 'Man'], ['Geachte mevrouw', 'Vrouw'], ['Geachte heer/mevrouw', 'Anders'],
        ['  gEaChTe HeEr/MeVrOuW  ', 'Anders'], ['__proto__', '__proto__'],
        ['constructor', 'constructor'], ['Geachte heer en familie', 'Geachte heer en familie'],
        ['', ''], ['   ', '   ']
    ];
    try {
        for (const [raw, expected] of examples) {
            globalThis.document = createEditorDocument();
            const model = { capabilities: { roleCanWrite: false, operations: {} }, version: 'read-version',
                sections: { person: [{ id: 'synthetic-person', fields: { firstName: 'Synthetic', salutation: raw } }] } };
            const original = structuredClone(model);
            let writes = 0;
            await openCustomerEditor({ id: 'synthetic-person', credentialKey: 'fixture' }, {
                api: { async get() { return model; }, async request() { writes++; } }, refresh() {}
            });
            const dialog = document.body.children[0];
            const input = dialog.querySelectorAll('input').find(control => control.name === 'salutation');
            const label = dialog.querySelectorAll('label').find(row => row.children.includes(input));
            assert.equal(label.ownText, 'Geslacht');
            assert.equal(input.value, expected);
            assert.equal(input.readOnly, true);
            const summary = recordSummary(sectionRegion(dialog, 'person')).textContent;
            assert.equal(summary, ['Synthetic', expected].filter(Boolean).join(' · '));
            assert.equal(input.getAttribute('data-feedback-sensitive'), 'salutation');
            dialog.querySelectorAll('form')[0].emit('submit');
            assert.equal(writes, 0);
            assert.deepEqual(model, original, 'display formatting must not normalize the registered source model');
        }
    } finally { globalThis.document = previousDocument; }
});

test('writable salutation keeps its raw summary, reset, draft, no-op and versioned PATCH values', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    const raw = 'Geachte heer/mevrouw';
    const model = { capabilities: { roleCanWrite: true, operations: { 'person.update': { enabled: true } } },
        version: 'original-version', sections: { person: [{ id: 'synthetic-person', fields: { firstName: 'Synthetic', salutation: raw } }] } };
    const original = structuredClone(model);
    const writes = [];
    const customer = { id: 'synthetic-person', credentialKey: 'fixture' };
    const options = { api: { async get() { return model; }, async request(...args) { writes.push(args); } }, refresh() {} };
    const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
    try {
        await openCustomerEditor(customer, options);
        const dialog = document.body.children[0];
        const personForm = () => dialog.querySelectorAll('form')[0];
        const salutation = () => personForm().querySelectorAll('input').find(input => input.name === 'salutation');
        const label = dialog.querySelectorAll('label').find(row => row.children.includes(salutation()));
        assert.equal(label.ownText, 'Aanhef');
        assert.equal(salutation().value, raw);
        assert.equal(recordSummary(sectionRegion(dialog, 'person')).textContent, `Synthetic · ${raw}`);
        personForm().emit('submit');
        await settle();
        assert.equal(writes.length, 0, 'opening and submitting unchanged data is a no-op');
        salutation().value = 'Draft letter text'; salutation().emit('input');
        personForm().querySelectorAll('button')[1].emit('click');
        assert.equal(salutation().value, raw, 'reset restores the registered letter value');
        salutation().value = 'Retained letter draft'; salutation().emit('input');
        dialog.querySelectorAll('button')[0].emit('click');
        await openCustomerEditor(customer, options);
        assert.equal(salutation().value, 'Retained letter draft');
        personForm().querySelectorAll('button')[1].emit('click');
        const firstName = personForm().querySelectorAll('input').find(input => input.name === 'firstName');
        firstName.value = 'Changed synthetic'; firstName.emit('input');
        personForm().emit('submit'); await settle();
        assert.deepEqual(writes[0][2], { credentialKey: 'fixture', expectedVersion: 'original-version', changes: { firstName: 'Changed synthetic' } });
        assert.equal(writes[0][0], 'PATCH');
        assert.ok(writes[0][3].headers['Idempotency-Key']);
        salutation().value = 'Explicit raw letter value'; salutation().emit('input');
        personForm().emit('submit'); await settle();
        assert.deepEqual(writes[1][2].changes, { salutation: 'Explicit raw letter value' });
        assert.deepEqual(model, original);
    } finally { globalThis.document = previousDocument; }
});

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
        assert.equal(dialog.querySelectorAll('select').length, 0);
        assert.equal(forms[2].children.length, 0);
        assert.ok(sectionRegion(dialog, 'email').textContent.includes('first@example.org'));
        assert.ok(sectionRegion(dialog, 'email').textContent.includes('second@example.org'));
        recordActions(sectionRegion(dialog, 'bank'))[0].emit('click');
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


test('retained customer editors keep record actions and named details bound to their own document IDs', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    const options = {
        api: { async get() { return { capabilities: { operations: {} }, version: null, sections: {
            email: [{ id: null, fields: { emailAddress: 'synthetic@example.org' } }]
        } }; } }, refresh() {}
    };
    try {
        await openCustomerEditor({ id: 'first', credentialKey: 'test' }, options);
        document.body.children[0].close();
        await openCustomerEditor({ id: 'second', credentialKey: 'test' }, options);
        const ids = [];
        for (const dialog of document.body.children) {
            for (const button of recordActions(dialog)) {
                const detail = dialog.querySelector(`#${button.getAttribute('aria-controls')}`);
                assert.ok(detail, 'every record action controls a detail slot in its own retained dialog');
                ids.push(detail.id);
                button.emit('click');
                assert.equal(button.getAttribute('aria-expanded'), 'true');
                const form = detail.querySelector('form');
                assert.ok(detail.querySelector(`#${form.getAttribute('aria-labelledby')}`));
            }
        }
        assert.equal(new Set(ids).size, ids.length);
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
    function selectAddress(dialog) { recordActions(sectionRegion(dialog, 'address'))[0].emit('click'); }
    function ids(dialog) {
        return ['h2', 'p', 'input'].flatMap(tag => dialog.querySelectorAll(tag).map(node => node.id).filter(Boolean));
    }
    try {
        await openCustomerEditor(customer, options);
        const first = document.body.children[0];
        selectAddress(first);
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
        selectAddress(second);
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
        selectAddress(first);
        assert.equal(first.querySelector('[data-address-prefix]').getAttribute('data-address-prefix'), firstPrefix, 'section changes retain address session ownership');
        const { resetLightboxDrafts } = await import('../../../assets/js/app/lightbox-drafts.js');
        resetLightboxDrafts(document);
        await openCustomerEditor(customer, options);
        const fresh = document.body.children[0];
        selectAddress(fresh);
        assert.notEqual(fresh.querySelector('[data-address-prefix]').getAttribute('data-address-prefix'), firstPrefix);
        assert.equal(reads, 3, 'reset starts a fresh model with a new address ownership key');
    } finally { globalThis.document = previousDocument; }
});

test('editor marks every record summary sensitive while retaining public source, actions and validity copy', async () => {
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
        assert.equal(recordSummary(sectionRegion(dialog, 'phone')).getAttribute('data-feedback-sensitive'), 'phone');
        const validity = dialog.querySelectorAll('p').filter(node => node.className === 'customer-editor-record-validity');
        assert.equal(validity.length, 2);
        assert.ok(validity.every(node => node.textContent === 'Geldigheid niet beschikbaar' && node.getAttribute('data-feedback-public') === ''));
        assert.ok(recordActions(dialog).every(node => node.getAttribute('data-feedback-public') === ''));
        assert.ok(dialog.querySelectorAll('p').filter(node => node.getAttribute('role') === 'status').every(node => node.getAttribute('data-feedback-public') === ''), 'fixed status copy remains public during pseudonymization');
    } finally { globalThis.document = previousDocument; }
});


test('every collection record is visible before selection and each direct action reveals its own source fields', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    const sections = {
        address: Array.from({ length: 12 }, (_, index) => ({ id: index ? null : 'address-a', fields: { street: `Synthetic street ${index + 1}`, city: 'Fixture city', isoCountryCode: 'NL' } })),
        email: [{ id: 'email-a', fields: { emailAddress: 'one@example.org' } }, { id: null, fields: { emailAddress: 'two@example.org' } }],
        phone: [{ id: 'phone-a', fields: { number: '111' } }, { id: null, fields: { number: '222' } }],
        mobile: [{ id: 'mobile-a', fields: { number: '333' } }, { id: null, fields: { number: '444' } }],
        bank: [{ id: 'bank-a', maskedIban: 'NL •••• 1111', fields: { bic: 'FIRST' } }, { id: null, maskedIban: 'NL •••• 2222', fields: { bic: 'SECOND' } }]
    };
    const original = structuredClone(sections);
    let writes = 0;
    try {
        await openCustomerEditor({ id: 'fixture', credentialKey: 'fixture' }, {
            api: { async get() { return { capabilities: { operations: {} }, version: null, sections }; }, async request() { writes++; } }, refresh() {}
        });
        const dialog = document.body.children[0];
        for (const [section, items] of Object.entries(sections)) {
            const region = sectionRegion(dialog, section);
            const rows = region.querySelectorAll('li');
            assert.equal(rows.length, items.length);
            assert.equal(region.querySelector('form').children.length, 0);
            for (const [index, item] of items.entries()) {
                const expectedSummary = item.maskedIban || Object.values(item.fields).filter(Boolean).join(' · ');
                assert.ok(rows[index].textContent.includes(expectedSummary));
                assert.ok(rows[index].textContent.includes('Geldigheid niet beschikbaar'));
                assert.equal(recordActions(region)[index].textContent, 'Bekijken');
                recordActions(region)[index].emit('click');
                const form = region.querySelector('form');
                for (const input of form.querySelectorAll('input')) assert.equal(input.readOnly, true);
                if (section === 'email') assert.equal(form.querySelector('input').value, item.fields.emailAddress);
                if (section === 'bank') assert.ok(form.textContent.includes(item.maskedIban));
                form.emit('submit');
                assert.equal(rows.length, region.querySelectorAll('li').length, 'selection never hides sibling records');
                const detail = region.children.find(node => node.className === 'customer-editor-record-detail');
                assert.equal(detail.querySelector('h4').textContent, `${i18n.t(`customerEditorRecords.${section}`)} ${index + 1}`);
                assert.ok(detail.textContent.includes(expectedSummary), 'selected detail retains exact visible source context');
            }
        }
        assert.equal(writes, 0);
        assert.deepEqual(sections, original);
    } finally { globalThis.document = previousDocument; }
});

test('dirty direct-record switches can be cancelled, same-record actions preserve drafts, and reset restores source', async () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    globalThis.document = createEditorDocument();
    let confirmResult = false;
    let confirmations = 0;
    globalThis.window = { confirm() { confirmations++; return confirmResult; } };
    try {
        await openCustomerEditor({ id: 'fixture', credentialKey: 'fixture' }, {
            api: { async get() { return { capabilities: { operations: { 'email.update': { enabled: true } } }, version: 'source-version', sections: {
                email: [{ id: 'first', fields: { emailAddress: 'first@example.org' } }, { id: 'second', fields: { emailAddress: 'second@example.org' } }]
            } }; } }, refresh() {}
        });
        const region = sectionRegion(document.body.children[0], 'email');
        const buttons = recordActions(region);
        buttons[0].emit('click');
        const originalInput = region.querySelector('input');
        originalInput.value = 'draft@example.org'; originalInput.emit('input');
        buttons[0].emit('click');
        assert.equal(region.querySelector('input'), originalInput);
        assert.equal(confirmations, 0);
        buttons[1].emit('click');
        assert.equal(confirmations, 1);
        assert.equal(region.querySelector('input').value, 'draft@example.org');
        assert.equal(buttons[0].getAttribute('aria-expanded'), 'true');
        assert.equal(buttons[1].getAttribute('aria-expanded'), 'false');
        region.querySelector('form').querySelectorAll('button')[1].emit('click');
        assert.equal(originalInput.value, 'first@example.org');
        originalInput.value = 'second draft'; originalInput.emit('input');
        confirmResult = true;
        buttons[1].emit('click');
        assert.equal(region.querySelector('input').value, 'second@example.org');
        assert.equal(buttons[1].getAttribute('aria-expanded'), 'true');
    } finally { globalThis.document = previousDocument; globalThis.window = previousWindow; }
});

test('the explicitly selected resource owns versioned mutations and all record actions lock during pending readback', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    let finishWrite;
    const pending = new Promise(resolve => { finishWrite = resolve; });
    const writes = [];
    let reads = 0;
    let refreshes = 0;
    const model = { version: 'source-version', capabilities: { operations: { 'email.update': { enabled: true }, 'bank.create': { enabled: true } } }, sections: {
        email: [{ id: 'first', fields: { emailAddress: 'first@example.org' } }, { id: 'resource/?second', fields: { emailAddress: 'second@example.org' } }],
        bank: [{ id: null, maskedIban: 'NL •••• 0000', fields: {} }]
    } };
    try {
        await openCustomerEditor({ id: 'person/private', credentialKey: 'own-credential' }, {
            api: { async get() { reads++; return model; }, async request(...args) { writes.push(args); await pending; } }, refresh() { refreshes++; }
        });
        const dialog = document.body.children[0];
        const region = sectionRegion(dialog, 'email');
        const actions = recordActions(region);
        actions[1].emit('click');
        region.querySelector('input').value = 'changed@example.org';
        region.querySelector('input').emit('input');
        const form = region.querySelector('form');
        form.emit('submit');
        assert.ok(recordActions(dialog).every(button => button.disabled), 'including the new-bank and sibling-section buttons');
        actions[0].emit('click'); form.emit('submit');
        assert.equal(writes.length, 1, 'synthetic repeat actions cannot switch or duplicate a pending mutation');
        assert.equal(region.querySelector('input').value, 'changed@example.org');
        assert.equal(writes[0][0], 'PATCH');
        assert.equal(writes[0][1], '/api/v1/persons/person%2Fprivate/emails/resource%2F%3Fsecond');
        assert.deepEqual(writes[0][2], { credentialKey: 'own-credential', expectedVersion: 'source-version', changes: { emailAddress: 'changed@example.org' } });
        assert.ok(writes[0][3].headers['Idempotency-Key']);
        finishWrite(); await settle();
        assert.equal(reads, 2, 'successful mutations require source readback');
        assert.equal(refreshes, 1);
        assert.ok(recordActions(dialog).every(button => !button.disabled));
    } finally { finishWrite(); globalThis.document = previousDocument; }
});

test('identity, capability, source version and foreign-address restrictions cannot be bypassed by direct actions', async () => {
    const previousDocument = globalThis.document;
    let writes = 0;
    try {
        for (const gate of ['identity', 'capability', 'version', 'foreignAddress']) {
            globalThis.document = createEditorDocument();
            const address = gate === 'foreignAddress';
            const section = address ? 'address' : 'email';
            await openCustomerEditor({ id: 'fixture', credentialKey: 'fixture' }, {
                api: { async get() { return { version: gate === 'version' ? null : 'version', capabilities: { operations: gate === 'capability' ? {} : { [`${section}.update`]: { enabled: true } } }, sections: {
                    [section]: [{ id: gate === 'identity' ? null : 'original-id', fields: address ? { isoCountryCode: 'BE', street: 'Fixture street' } : { emailAddress: 'fixture@example.org' } }]
                } }; }, async request() { writes++; } }, refresh() {}
            });
            const region = sectionRegion(document.body.children[0], section);
            assert.equal(recordActions(region)[0].textContent, 'Bekijken');
            recordActions(region)[0].emit('click');
            const form = region.querySelector('form');
            assert.ok(form.querySelectorAll('input').every(input => input.readOnly));
            form.querySelectorAll('input')[0].value = 'synthetic bypass';
            form.emit('submit');
            assert.ok(form.querySelectorAll('button').every(button => button.disabled));
        }
        assert.equal(writes, 0);
    } finally { globalThis.document = previousDocument; }
});

test('new record copy uses existing NL and EN keys and annotations without changing raw source values', async () => {
    const previousDocument = globalThis.document;
    try {
        for (const locale of ['nl', 'en']) {
            i18n.setLocale(locale);
            globalThis.document = createEditorDocument();
            await openCustomerEditor({ id: 'fixture', credentialKey: 'fixture' }, {
                api: { async get() { return { version: null, capabilities: { operations: {} }, sections: {
                    email: [{ id: null, fields: { emailAddress: 'raw@example.org' } }]
                } }; } }, refresh() {}
            });
            const dialog = document.body.children[0];
            const region = sectionRegion(dialog, 'email');
            const button = recordActions(region)[0];
            assert.equal(button.textContent, locale === 'en' ? 'View' : 'Bekijken');
            assert.equal(button.getAttribute('data-i18n'), 'customerEditorRecords.view');
            assert.ok(region.textContent.includes(locale === 'en' ? 'Validity unavailable' : 'Geldigheid niet beschikbaar'));
            assert.ok(sectionRegion(dialog, 'address').textContent.includes(locale === 'en' ? 'No data available' : 'Geen gegevens beschikbaar'));
            button.emit('click');
            assert.equal(region.querySelector('input').value, 'raw@example.org');
            for (const id of button.getAttribute('aria-labelledby').split(' ')) assert.ok(dialog.querySelector(`#${id}`));
        }
    } finally { i18n.setLocale('nl'); globalThis.document = previousDocument; }
});


test('uncertain mutation errors retain entered values and cannot be retried or redirected to another source record', async () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    globalThis.document = createEditorDocument();
    globalThis.window = { confirm() { return true; } };
    let writes = 0;
    let reads = 0;
    try {
        await openCustomerEditor({ id: 'fixture', credentialKey: 'fixture' }, {
            api: { async get() { reads++; return { version: 'original-version', capabilities: { operations: { 'email.update': { enabled: true } } }, sections: {
                email: [{ id: 'first', fields: { emailAddress: 'first@example.org' } }, { id: 'second', fields: { emailAddress: 'second@example.org' } }]
            } }; }, async request() { writes++; throw { payload: { error: { code: 'mutation_outcome_unknown' } } }; } }, refresh() { throw new Error('unconfirmed mutations must not refresh'); }
        });
        const region = sectionRegion(document.body.children[0], 'email');
        recordActions(region)[0].emit('click');
        region.querySelector('input').value = 'uncertain@example.org'; region.querySelector('input').emit('input');
        region.querySelector('form').emit('submit'); await settle();
        assert.equal(region.querySelector('input').value, 'uncertain@example.org');
        assert.ok(region.textContent.includes('De uitkomst is onzeker'));
        assert.ok(recordActions(region).every(button => button.textContent === 'Bekijken'), 'reload gating is reflected in each direct action');
        region.querySelector('form').emit('submit'); await settle();
        assert.equal(writes, 1);
        recordActions(region)[1].emit('click');
        assert.equal(region.querySelector('input').readOnly, true, 'requiresReload also guards newly selected records');
        region.querySelector('input').value = 'bypass@example.org'; region.querySelector('form').emit('submit'); await settle();
        assert.equal(writes, 1);
        assert.equal(reads, 1, 'an uncertain outcome never triggers automatic readback or retry');
    } finally { globalThis.document = previousDocument; globalThis.window = previousWindow; }
});

test('a null-identity masked bank record cannot delete through a synthetic disabled-button event', async () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    globalThis.document = createEditorDocument();
    globalThis.window = { confirm() { return true; } };
    let writes = 0;
    try {
        await openCustomerEditor({ id: 'fixture', credentialKey: 'fixture' }, {
            api: { async get() { return { version: 'source-version', capabilities: { operations: { 'bank.delete': { enabled: true } } }, sections: {
                bank: [{ id: null, fields: { bic: 'FIXTURE' }, maskedIban: 'NL •••• 1234', deletionAllowed: true }]
            } }; }, async request() { writes++; } }, refresh() {}
        });
        const region = sectionRegion(document.body.children[0], 'bank');
        recordActions(region)[0].emit('click');
        const remove = region.querySelector('form').querySelectorAll('button').find(button => button.textContent === 'Bankrekening verwijderen');
        assert.equal(remove.disabled, true); remove.emit('click'); await settle();
        assert.equal(writes, 0);
        assert.ok(region.textContent.includes('NL •••• 1234'));
        assert.ok(!region.textContent.includes('NL00FULLPRIVATEIBAN'));
    } finally { globalThis.document = previousDocument; globalThis.window = previousWindow; }
});
