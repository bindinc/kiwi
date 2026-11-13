import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// theme_audit: observed original08 content, never the new09 display contract.
export function readonlySourceFixtures() {
    return ['Geachte heer', 'Geachte mevrouw', 'Geachte heer/mevrouw'].map((salutation, index) => {
        const id = 990940 + index, credentialKey = 'theme-audit-readonly-' + index;
        return { index, salutation, id, credentialKey,
            suffix: `persons/${id}/editing?credentialKey=${credentialKey}`,
            customer: { id, personId: String(id), credentialKey, sourceSystem: 'subscription-api',
                firstName: 'Synthetic', lastName: 'Readonly source ' + index, mandant: 'SYNTHETIC' },
            model: { version: 'theme-audit-readonly-source-v1', capabilities: { roleCanWrite: false,
                operations: Object.fromEntries(['person.update', 'address.update', 'email.update', 'phone.update', 'mobile.update', 'bank.update', 'bank.create', 'bank.delete'].map(operation => [operation, { enabled: false }])) },
                sections: { person: [{ id: 'synthetic-person-' + index, fields: { firstName: 'Synthetic', initials: 'S.', surName: '',
                    lastName: 'Readonly source ' + index, salutation, birthDay: '1980-01-01' } }],
                    address: [], email: [], phone: [], mobile: [], bank: [] } }
        };
    });
}

// Use the frozen application's serializer so the supplement cannot invent DTO fields or validity periods.
export function currentRecordsFixture(sourceRoot) {
    const id = 990970, credentialKey = 'theme-audit-records-b4';
    const customer = { id, personId: String(id), credentialKey, sourceSystem: 'subscription-api', mandant: 'SYNTHETIC',
        firstName: 'Synthetic', initials: 'S.', middleName: '', lastName: 'Multiple records', salutation: 'Geachte heer',
        address: 'Fixturestraat 1', postalCode: '1231AA', houseNumber: '1', houseNumberAddition: '', street: 'Fixturestraat',
        city: 'Testplaats', countryCode: 'NL', email: 'first@example.invalid', phone: '',
        addressValidation: { status: 'confirmed' }, subscriptions: [], articles: [], contactHistory: [] };
    const address = (street, house, postCode) => ({ address: { street, housenumber: { housenumber: house }, postCode,
        city: 'Testplaats', isoCountryCode: 'NL', extension: '', additionalExtension: '' } });
    const raw = { rId: String(id), firstName: customer.firstName, initials: customer.initials, surName: '', lastName: customer.lastName,
        salutation: customer.salutation, birthDay: '1980-01-01', contacts: {
            addresses: [{ rId: 'synthetic-address-a', ...address('Fixturestraat', '1', '1231AA') }, address('Tweedestraat', '2', '1231AB')],
            emails: [{ rId: 'synthetic-email-a', emailAddress: 'first@example.invalid' }, { emailAddress: 'second@example.invalid' }],
            phones: [{ rId: 'synthetic-phone-a', areaCode: '020', number: '0000001' }, { areaCode: '020', number: '0000002' }],
            mobiles: [{ rId: 'synthetic-mobile-a', areaCode: '06', number: '00000001' }, { areaCode: '06', number: '00000002' }]
        }, payments: { ibanItems: [{ rId: 'synthetic-bank-a', iban: 'SYNTHETIC0001', bic: 'SYNTHETIC' }, { iban: 'SYNTHETIC0002', bic: '' }] } };
    const php = 'require $argv[1]."/src/SubscriptionApi/CustomerMutationInput.php"; require $argv[1]."/src/SubscriptionApi/CustomerEditingSnapshot.php"; '
        + 'echo json_encode((new \\App\\SubscriptionApi\\CustomerEditingSnapshot())->build(json_decode($argv[2], true)), JSON_THROW_ON_ERROR);';
    const model = JSON.parse(execFileSync('php', ['-r', php, sourceRoot, JSON.stringify(raw)], { encoding: 'utf8' }));
    model.personId = String(id); model.credentialKey = credentialKey;
    model.capabilities = { roleCanWrite: true, operations: Object.fromEntries(['person.update', 'address.update', 'email.update', 'phone.update',
        'mobile.update', 'bank.update', 'bank.create', 'bank.delete'].map(operation => [operation, { enabled: false, reason: 'upstream_concurrency_unverified' }])) };
    return { id, customer, model, detailSuffix: `persons/${id}?credentialKey=${credentialKey}&sourceSystem=subscription-api`,
        suffix: `persons/${id}/editing?credentialKey=${credentialKey}` };
}

export async function inspectCurrentRecords(page, state, { observe }) {
    const fixture = state.recordFixture;
    await page.evaluate(async customer => {
        await window.kiwiCustomerDetailSlice.selectCustomer(customer.id, { sourceCustomer: customer, requireFresh: true });
    }, fixture.customer);
    await page.locator('#customerDetail').waitFor({ state: 'visible' });
    const identity = await page.evaluate(customer => {
        const context = window.kiwiCustomerWorkSession?.getRequestContext();
        return { selectedPersonMatches: String(window.currentCustomer?.personId) === customer.personId,
            selectedSourceMatches: window.currentCustomer?.credentialKey === customer.credentialKey,
            sessionPersonMatches: context?.customerReference?.personId === customer.personId,
            sessionSourceMatches: context?.customerReference?.credentialKey === customer.credentialKey,
            headerPersonMatches: document.querySelector('#customerName').textContent.includes(customer.personId) };
    }, fixture.customer);
    assert.ok(Object.values(identity).every(Boolean), 'Canonical selected customer, header and work session must share the fixture identity.');
    await page.locator('#customerDetail .customer-header').scrollIntoViewIfNeeded();
    await observe(page, state, 'records-b4-customer-header', ['#customerDetail .customer-header', '#customerWorkSessionBar'], { identity,
        closeNextToComplaint: await page.locator('#editorialComplaintBtn + [data-action=close-customer-detail]').count(),
        boundary: 'Current b4 layout baseline for the new record/close feedback; distinct from immutable original08 BEFORE and from AFTER acceptance.' });
    await page.locator('#editCustomerBtn').click();
    const dialog = page.locator('.customer-editor[open]');
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.customer-editor[open] section select option[value="0"]'));
    for (const [section, items] of Object.entries(fixture.model.sections)) {
        const index = ['person', 'address', 'email', 'phone', 'mobile', 'bank'].indexOf(section);
        const region = dialog.locator('section').nth(index), select = region.locator('select');
        await region.locator('h3').scrollIntoViewIfNeeded();
        const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, text: node.textContent })));
        await observe(page, state, 'records-b4-' + section + '-overview', ['.customer-editor[open]', '.customer-editor[open] section:nth-child(' + (index + 1) + ')'],
            { section, options, sourceRecords: items.map(item => ({ id: item.id, fieldNames: Object.keys(item.fields), ...(item.maskedIban ? { maskedIban: item.maskedIban } : {}) })),
                versionIsNull: fixture.model.version === null, validityMetadataAvailable: false,
                boundary: 'Actual b4 select-driven renderer. All record options are inventoried; this does not claim simultaneous visible summaries or known validity.' });
        for (let recordIndex = 0; recordIndex < items.length; recordIndex += 1) {
            await select.selectOption(String(recordIndex));
            await region.locator('input').first().scrollIntoViewIfNeeded();
            const controls = await region.locator('input').evaluateAll(nodes => nodes.map(node => ({ name: node.name, value: node.value, readOnly: node.readOnly })));
            assert.ok(controls.every(control => control.readOnly), 'The real null-version/disabled-capability model must stay readonly.');
            assert.equal(await region.locator('button:not([disabled])').count(), 0, 'No write action may be enabled.');
            await observe(page, state, `records-b4-${section}-${recordIndex}`, ['.customer-editor[open]', '.customer-editor[open] section:nth-child(' + (index + 1) + ')'],
                { section, sourceRecordId: items[recordIndex].id, controls, readonly: true });
        }
    }
    await dialog.locator('.form-header .btn-close').click();
    await dialog.waitFor({ state: 'hidden' });
}

export function recordListAfterFixture(sourceRoot, count, component = false) {
    assert.ok([2, 12].includes(count), 'Only the declared small/stress record lists are permitted.');
    const fixture = currentRecordsFixture(sourceRoot);
    const credentialKey = `theme-audit-records-${component ? 'component' : 'source'}-${count}`;
    fixture.customer.credentialKey = credentialKey; fixture.model.credentialKey = credentialKey;
    fixture.detailSuffix = `persons/${fixture.id}?credentialKey=${credentialKey}&sourceSystem=subscription-api`;
    fixture.suffix = `persons/${fixture.id}/editing?credentialKey=${credentialKey}`;
    for (const section of ['address', 'email', 'phone', 'mobile', 'bank']) {
        const original = fixture.model.sections[section];
        fixture.model.sections[section] = Array.from({ length: count }, (_, index) => {
            const item = structuredClone(original[index % 2]);
            item.id = index % 2 ? null : `synthetic-${section}-${index === 0 ? 'a' : index}`;
            if (section === 'email') item.fields.emailAddress = `record-${index + 1}@example.invalid`;
            if (section === 'bank') item.maskedIban = `SY •••• ${String(index + 1).padStart(4, '0')}`;
            return item;
        });
    }
    if (component) {
        fixture.model.version = 'theme-audit-component-only';
        for (const operation of ['person.update', 'email.update']) fixture.model.capabilities.operations[operation] = { enabled: true };
    }
    fixture.recordCount = count; fixture.componentOnly = component;
    return fixture;
}

export function inputProfileRecordsFixture(sourceRoot) {
    const fixture = recordListAfterFixture(sourceRoot, 12);
    for (const section of ['address', 'phone', 'mobile']) fixture.model.sections[section] = fixture.model.sections[section].slice(0, 2);
    fixture.boundary = 'One canonical customer/read pair with source-shaped2addresses/phones/mobiles and12emails/maskedbanks; no inventedidentity, validity or writable capability.';
    return fixture;
}

export async function inspectRecordListsAfter(page, state, { observe, control, mutationSection = 'email', validityLabel = 'Geldigheid niet beschikbaar', touch = false, openNativeReadonlyEditor = null }) {
    assert.equal(state.phase, 'after');
    const fixture = state.recordFixture;
    await page.evaluate(async customer => window.kiwiCustomerDetailSlice.selectCustomer(customer.id,
        { sourceCustomer: customer, requireFresh: true }), fixture.customer);
    await page.locator('#customerDetail').waitFor({ state: 'visible' });
    const identity = await page.evaluate(customer => {
        const context = window.kiwiCustomerWorkSession.getRequestContext();
        return { customer: String(window.currentCustomer?.personId) === customer.personId && window.currentCustomer?.credentialKey === customer.credentialKey,
            session: context.customerReference?.personId === customer.personId && context.customerReference?.credentialKey === customer.credentialKey,
            header: document.querySelector('#customerName').textContent.includes(customer.personId) };
    }, fixture.customer);
    assert.ok(Object.values(identity).every(Boolean), 'Record AFTER must retain the canonical customer/header/work-session identity.');
    assert.equal(await page.locator('#customerDetail [data-action=close-customer-detail]').count(), 0);
    assert.equal(await page.locator('#customerWorkSessionBar').isVisible(), true);
    await page.locator('#customerDetail .customer-header').scrollIntoViewIfNeeded();
    await observe(page, state, 'records-after-header', ['#customerDetail .customer-header', '#customerWorkSessionBar'], { identity });
    if (openNativeReadonlyEditor) {
        assert.equal(state.phase, 'after'); assert.equal(state.suite, 'native-operational');
        assert.equal(state.report.environment.browser, 'firefox'); assert.ok(state.nativeKernel);
        await openNativeReadonlyEditor();
    } else if (touch) await page.locator('#editCustomerBtn').tap(); else await page.locator('#editCustomerBtn').click();
    const dialog = page.locator('.customer-editor[open]');
    await dialog.locator('[data-customer-section=bank] .customer-editor-record-action').first().waitFor();
    const ids = await page.locator('.customer-editor [id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(ids).size, ids.length, 'Every retained editor/control/record ID must be unique.');
    for (const [section, items] of Object.entries(fixture.model.sections)) {
        const region = dialog.locator(`[data-customer-section="${section}"]`);
        const rows = region.locator('.customer-editor-record');
        assert.equal(await rows.count(), items.length, 'Every source array item must have its own visible record row.');
        assert.equal(await region.locator('select').count(), 0, 'The source-record choice dropdown is gone.');
        for (let index = 0; index < items.length; index += 1) {
            const row = rows.nth(index), action = row.locator('.customer-editor-record-action');
            assert.equal(await row.isVisible(), true);
            assert.equal(await row.locator('.customer-editor-record-summary').isVisible(), true);
            const validity = row.locator('.customer-editor-record-validity');
            assert.equal(await validity.isVisible(), true);
            assert.equal(await validity.innerText(), validityLabel, 'Unavailable per-record validity must use the exact approved localized source text.');
            assert.equal(await action.getAttribute('data-customer-record-index'), String(index));
            assert.equal(await action.evaluate(node => {
                const row = node.closest('.customer-editor-record'), title = row.querySelector('.customer-editor-record-title');
                const labels = (node.getAttribute('aria-labelledby') || '').split(/\s+/);
                return Boolean(title.id && node.id && labels.includes(title.id) && labels.includes(node.id));
            }), true, 'Every record action must expose its own type/ordinal and action text as an accessible name.');
            await action.scrollIntoViewIfNeeded();
            let focus;
            if (touch) {
                const target = await action.boundingBox();
                assert.ok(target.width >= 40 && target.height >= 40, 'Ordinary record actions retain their40px reference contract under coarse input.');
                await action.tap();
                focus = { input: 'Actual touch tap; own record selection and subsequent native field focus.', target };
            } else {
                focus = await keyboardFocus(page, action, 'after');
                await action.press('Enter');
            }
            assert.equal(await action.getAttribute('aria-expanded'), 'true');
            const form = region.locator('.customer-editor-record-detail form');
            await form.waitFor({ state: 'visible' });
            if (touch && (index === 0 || index === items.length - 1)) {
                focus.nativeField = await keyboardFocus(page, form.locator('input').first(), 'after');
            }
            const readonly = !fixture.componentOnly || items[index].id === null || !['person', 'email'].includes(section);
            const values = await form.locator('input').evaluateAll(nodes => nodes.map(node => ({ name: node.name, value: node.value, readOnly: node.readOnly })));
            assert.ok(values.every(field => field.readOnly === readonly));
            if (section === 'email') assert.equal(values.find(field => field.name === 'emailAddress')?.value, items[index].fields.emailAddress);
            if (section === 'bank') assert.ok((await region.locator('.customer-editor-record-detail').innerText()).includes(items[index].maskedIban));
            if (index === 0 || index === items.length - 1) await observe(page, state, `records-after-${section}-${index}`,
                ['.customer-editor[open]', `[data-customer-section="${section}"]`], { sourceRecordId: items[index].id, readonly, focus,
                    recordCount: items.length, boundary: fixture.componentOnly ? 'Explicit writable component fixture, no source-policy proof.' : 'Source-shaped null-version disabled model, no role/supplier acceptance.' });
        }
        if (section === 'bank') {
            const create = region.locator('.customer-editor-record-action[data-customer-record-index=new]');
            await create.scrollIntoViewIfNeeded();
            if (touch) await create.tap(); else await create.press('Enter');
            assert.equal(await create.getAttribute('aria-expanded'), 'true');
            const form = region.locator('.customer-editor-record-detail form');
            assert.equal(await form.locator('button[type=submit]').isEnabled(), false, 'Disabled source/component bank.create capability cannot be activated by viewing a new record.');
            assert.ok(await form.locator('input').evaluateAll(nodes => nodes.every(node => node.readOnly)));
            await observe(page, state, 'records-after-bank-create-readonly', ['.customer-editor[open]', '[data-customer-section=bank]'],
                { componentOnly: fixture.componentOnly, sourceBankCreateRemainsDisabled: true });
        }
    }
    if (!fixture.componentOnly) return;
    assert.ok(['person', 'email'].includes(mutationSection));
    const region = dialog.locator(`[data-customer-section="${mutationSection}"]`);
    const actions = region.locator('.customer-editor-record-action');
    await actions.first().click();
    const fieldName = mutationSection === 'person' ? 'salutation' : 'emailAddress';
    const field = region.locator(`input[name="${fieldName}"]`);
    const changed = mutationSection === 'person' ? 'Geachte mevrouw' : 'changed@example.invalid';
    if (mutationSection === 'person') assert.equal(await field.inputValue(), 'Geachte heer', 'Writable raw source phrase must not become the readonly display alias.');
    await field.fill(changed);
    const selectedField = await field.elementHandle();
    await actions.first().click();
    assert.equal(await field.evaluate((node, original) => node === original, selectedField), true, 'Selecting the same record must preserve the actual draft controls.');
    assert.equal(await field.inputValue(), changed);
    if (mutationSection === 'email') {
        page.once('dialog', prompt => prompt.dismiss());
        await actions.nth(1).click();
        assert.equal(await field.inputValue(), changed, 'Cancel switching keeps the draft.');
        assert.equal(await actions.first().getAttribute('aria-expanded'), 'true');
        page.once('dialog', prompt => prompt.accept());
        await actions.nth(1).click();
        assert.equal(await actions.nth(1).getAttribute('aria-expanded'), 'true');
        assert.equal(await field.inputValue(), fixture.model.sections.email[1].fields.emailAddress);
        assert.equal(await field.evaluate(node => node.readOnly), true, 'A null source identity remains readonly even in the writable component model.');
        await actions.first().click();
        assert.equal(await field.inputValue(), fixture.model.sections.email[0].fields.emailAddress, 'Confirmed record switch discards the old draft explicitly.');
        await field.fill(changed);
        await region.getByRole('button', { name: 'Wijzigingen herstellen', exact: true }).click();
        assert.equal(await field.inputValue(), fixture.model.sections.email[0].fields.emailAddress, 'Reset restores the selected original source value.');
        await field.fill(changed);
    }
    control.recordMutationGate.arm({ pathname: state.api + `persons/${fixture.id}/` + (mutationSection === 'person' ? 'profile' : 'emails/synthetic-email-a'),
        credentialKey: fixture.customer.credentialKey, expectedVersion: fixture.model.version, changes: { [fieldName]: changed } });
    try {
        await region.locator('button[type=submit]').press('Enter');
        await page.waitForFunction(() => document.querySelector('.customer-editor-feedback[data-state=pending]'));
        for (let attempt = 0; attempt < 100 && typeof control.recordMutationResponse !== 'function'; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(typeof control.recordMutationResponse, 'function', 'The one exact component PATCH must be held locally.');
        assert.equal(await dialog.locator('section button:not([disabled])').count(), 0, 'Pending mutation locks every record, create and form action.');
        assert.equal(await dialog.locator('.form-header .btn-close').isEnabled(), false);
        await observe(page, state, 'records-after-component-pending-' + mutationSection, ['.customer-editor[open]'],
            { exactLocalResponseHeld: true, allRecordCreateAndFormActionsLocked: true });
    } finally { control.releaseRecordMutation(); }
    await page.waitForFunction(() => document.querySelector('.customer-editor-feedback[data-state=error]'));
    assert.equal(control.recordMutationGate.used(), true);
    assert.equal(await field.inputValue(), changed, 'A local503 must retain the raw draft value.');
    assert.equal(await region.locator('button[type=submit]').isEnabled(), false, 'Uncertain save must require a fresh source reload before another mutation.');
    await observe(page, state, 'records-after-component-error-' + mutationSection, ['.customer-editor[open]'],
        { exactRawPayloadVerified: true, draftRetained: true, boundary: 'One exact locally fulfilled503 component PATCH. No source write, concurrency or actual role claim.' });
    await dialog.locator('.form-header .btn-close').click();
    await dialog.waitFor({ state: 'hidden' });
    await page.locator('#editCustomerBtn').click();
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await field.inputValue(), changed, 'Retained editor reopen must preserve the failed draft without another source request.');
    assert.equal(control.recordReads.size, 2);
    await observe(page, state, 'records-after-component-reopened-' + mutationSection, ['.customer-editor[open]'], { draftRetained: true, sourceReadCount: 2 });
}

export async function readAfterReference(browser, referencePath, evidenceDir, viewport) {
    await mkdir(evidenceDir, { recursive: true });
    const context = await browser.newContext({ viewport, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
        await context.route('**/*', route => new URL(route.request().url()).protocol === 'file:' ? route.continue() : route.abort('blockedbyclient'));
        await page.goto(pathToFileURL(referencePath).href);
        await page.addStyleTag({ content: '.page-header,.skip-link{visibility:hidden!important}' });
        const measure = selector => page.locator(selector).first().evaluate(node => {
            const s = getComputedStyle(node);
            return Object.fromEntries(['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'gap', 'borderRadius',
                'backgroundColor', 'color', 'boxShadow', 'minHeight', 'outlineWidth', 'outlineOffset'].map(name => [name, s[name]]));
        });
        const contract = { boundary: 'Actual rendered candidate reference67, shared roles only. Documentation header visibility exclusion matches historical reference capture; no business equivalence.',
            viewport, browserVersion: browser.version(),
            body: await measure('.preview-shell'), panel: await measure('.customer-card'), input: await measure('.search-input'),
            primary: await measure('.preview-shell .button-primary'), secondary: await measure('.preview-shell .button-secondary') };
        const input = page.locator('.search-input').first();
        await input.scrollIntoViewIfNeeded(); await input.focus(); await page.keyboard.press('ArrowRight');
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        contract.inputFocus = await measure('.search-input');
        contract.focusObservation = await input.evaluate(node => ({ active: node === document.activeElement,
            focusVisible: node.matches(':focus-visible'), tag: node.tagName, type: node.type }));
        await writeFile(path.join(evidenceDir, 'contract.json'), JSON.stringify(contract, null, 2) + '\n');
        await page.screenshot({ path: path.join(evidenceDir, 'reference-text-focus.png') });
        assert.equal(contract.focusObservation.active, true); assert.equal(contract.focusObservation.focusVisible, true);
        assert.equal(contract.inputFocus.outlineWidth, '2px'); assert.equal(contract.inputFocus.outlineOffset, '0px');
        assert.equal(contract.inputFocus.boxShadow, 'none');
        await page.locator('.customer-card').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(evidenceDir, 'reference-customer.png') });
        await writeFile(path.join(evidenceDir, 'contract.json'), JSON.stringify(contract, null, 2) + '\n');
        return contract;
    } finally { await context.close(); }
}

export function checkAfterObservation(name, data, detail, state) {
    const required = (label, passed, evidence = {}) => {
        state.report.checks.push({ state: name, name: label, passed, ...evidence });
        assert.ok(passed, label);
    };
    required('Document stays within actual viewport', data.documentWidth <= data.viewport.width + 1);
    const nodes = data.roots.flatMap(root => root.nodes);
    for (const control of [...nodes, ...data.controls].filter(node => node.visible && node.focusVisible)) {
        const textEntry = ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tag)
            && !['hidden', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(control.inputType);
        if (textEntry) {
            required('Focused text entry uses actual reference outline width', control.outlineWidth === state.referenceContract.inputFocus.outlineWidth, { tag: control.tag });
            required('Focused text entry uses actual reference flush offset', control.outlineOffset === state.referenceContract.inputFocus.outlineOffset);
            required('Focused text entry has no duplicate shadow ring', control.shadow === state.referenceContract.inputFocus.boxShadow);
        } else if (control.tag === 'BUTTON') required('Focused action retains3px boundary', control.outlineWidth === '3px');
    }
    for (const node of nodes.filter(node => node.visible && /timeline-item|session-outbox-item/.test(node.className))) {
        required('Ordinary operational row uses reference flat corner', node.radius === state.referenceContract.panel.borderRadius);
        required('Ordinary operational row has no decorative shadow', node.shadow === state.referenceContract.panel.boxShadow);
    }
    if (detail.focus?.layoutBefore) {
        required('Focus does not change control layout box', JSON.stringify(detail.focus.layoutBefore) === JSON.stringify(detail.focus.layoutAfter));
    }
    if (name === 'outbox-native-editor') {
        const dialog = nodes.find(node => node.id === 'sessionOutboxEditor');
        const card = nodes.find(node => node.className.includes('card'));
        required('Actual generic editor is a native modal', dialog?.nativeModal === true);
        required('Actual generic editor has its opaque real card', Boolean(card && card.background === state.referenceContract.panel.backgroundColor && card.opacity === '1'));
    }
}

async function keyboardFocus(page, locator, phase) {
    await locator.scrollIntoViewIfNeeded();
    const before = await locator.boundingBox();
    const layoutBefore = phase === 'after' ? await locator.evaluate(node => ({ left: node.offsetLeft, top: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight })) : null;
    await locator.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const focused = await locator.evaluate(node => node === document.activeElement);
    assert.ok(focused, 'Actual Tab/Shift+Tab must return to the requested real control.');
    return { before, after: await locator.boundingBox(), boundary: 'Explicit setup focus followed by genuine native Tab/Shift+Tab; no forced click or simulated focus CSS.',
        ...(phase === 'after' ? { layoutBefore, layoutAfter: await locator.evaluate(node => ({ left: node.offsetLeft, top: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight })) } : {}) };
}

async function sourceEditors(page, state, observe) {
    const fixtures = state.feedbackFixtures;
    const selected = state.viewport.width === 1440 ? fixtures : [fixtures[2]];
    for (const fixture of selected) {
        await page.evaluate(customer => {
            window.currentCustomer = customer;
            window.customers = [customer];
            window.editCustomer();
        }, fixture.customer);
        const dialog = page.locator('.customer-editor[open]');
        await dialog.waitFor({ state: 'visible' });
        const person = dialog.locator('section').filter({ has: page.getByRole('heading', { name: 'Persoonsgegevens', exact: true }) });
        if (state.phase === 'after') await person.locator('.customer-editor-record-action[data-customer-record-index="0"]').press('Enter');
        else await person.locator('select').first().selectOption('0');
        const field = person.locator('input[name=salutation]');
        const data = await field.evaluate((input, after) => ({ value: input.value, readOnly: input.readOnly,
            label: input.closest('label')?.childNodes[0]?.textContent,
            summary: after ? input.closest('section').querySelector('.customer-editor-record-summary')?.textContent
                : input.closest('section').querySelector('select').selectedOptions[0]?.textContent }), state.phase === 'after');
        const expected = state.phase === 'after' ? ['Man', 'Vrouw', 'Anders'][fixture.index] : fixture.salutation;
        assert.equal(data.value, expected, 'Actual source renderer must display its phase-specific registered fixture value.');
        if (state.phase === 'after') { assert.equal(data.label.trim(), 'Geslacht'); assert.ok(data.summary.includes(expected) && !data.summary.includes(fixture.salutation)); }
        assert.equal(data.readOnly, true, 'The declared capability fixture must actually render readonly.');
        await field.scrollIntoViewIfNeeded();
        await observe(page, state, 'feedback-readonly-raw-' + fixture.index, ['.customer-editor[open]'], {
            sourceFixture: { syntheticId: fixture.id, registeredRawPhrase: fixture.salutation }, observed: data,
            boundary: 'Actual installed editCustomer→openCustomerEditor and exact locally fulfilled raw source GET. Synthetic readonly capabilities do not prove actual readonly role or server policy; phase-specific display is checked separately from raw input data.' });
        const focus = await keyboardFocus(page, field, state.phase);
        await observe(page, state, 'feedback-readonly-field-focus-' + fixture.index, ['.customer-editor[open]', '.customer-editor[open] input[name=salutation]'], { focus });
        const close = dialog.locator('.form-header .btn-close');
        const closeFocus = await keyboardFocus(page, close, state.phase);
        await observe(page, state, 'feedback-readonly-close-focus-' + fixture.index, ['.customer-editor[open]', '.customer-editor[open] .btn-close'], { focus: closeFocus });
        await close.press('Enter');
        await dialog.waitFor({ state: 'hidden' });
    }
    await page.evaluate(() => { window.currentCustomer = null; window.customers = []; });
}

async function measureSummaryFocus(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return page.evaluate(() => {
        const button = document.querySelector('#searchSummary [data-action=scroll-to-results]');
        const active = document.activeElement, header = document.querySelector('.header');
        const observedNodes = window.__themeAuditSummaryObservedNodes ||= [];
        const nodeIndex = node => {
            const previous = observedNodes.indexOf(node);
            return previous >= 0 ? previous : observedNodes.push(node) - 1;
        };
        const bounds = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const headerBounds = bounds(header);
        const measure = node => {
            const rect = bounds(node), css = getComputedStyle(node), focused = node === active, focusVisible = node.matches(':focus-visible');
            const extent = focused && focusVisible ? Math.max(0, Number.parseFloat(css.outlineWidth) + Number.parseFloat(css.outlineOffset)) : 0;
            const perimeter = { left: rect.left - extent, top: rect.top - extent, right: rect.right + extent, bottom: rect.bottom + extent };
            const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, ancestors = [];
            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                const r = parent.getBoundingClientRect(), style = getComputedStyle(parent);
                const x = /hidden|clip|auto|scroll/.test(style.overflowX), y = /hidden|clip|auto|scroll/.test(style.overflowY);
                if (!x && !y) continue;
                const inner = { left: r.left + parent.clientLeft, top: r.top + parent.clientTop,
                    right: r.left + parent.clientLeft + parent.clientWidth, bottom: r.top + parent.clientTop + parent.clientHeight };
                ancestors.push({ id: parent.id, className: parent.className, overflowX: style.overflowX, overflowY: style.overflowY, clip: inner, scrollTop: parent.scrollTop });
                if (x) { clip.left = Math.max(clip.left, inner.left); clip.right = Math.min(clip.right, inner.right); }
                if (y) { clip.top = Math.max(clip.top, inner.top); clip.bottom = Math.min(clip.bottom, inner.bottom); }
            }
            const points = [{ x: rect.left + rect.width / 2, y: rect.top + 1 },
                { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, { x: rect.left + rect.width / 2, y: rect.bottom - 1 }];
            const hits = points.map(point => { const hit = document.elementFromPoint(point.x, point.y);
                return { point, ownTarget: hit === node || node.contains(hit), headerHit: Boolean(hit?.closest('.header')) }; });
            const headerOverlapsPerimeter = Math.min(perimeter.right, headerBounds.right) > Math.max(perimeter.left, headerBounds.left)
                && Math.min(perimeter.bottom, headerBounds.bottom) > Math.max(perimeter.top, headerBounds.top);
            return { observedNodeIndex: nodeIndex(node), tag: node.tagName, id: node.id, className: node.className, text: node.tagName === 'BUTTON' ? node.textContent.trim() : undefined, focused, focusVisible, bounds: rect,
                outlineWidth: css.outlineWidth, outlineOffset: css.outlineOffset, paintedPerimeter: focused && focusVisible ? perimeter : null,
                fullPerimeterInsideAllClips: rect.width > 0 && rect.height > 0 && perimeter.left >= clip.left && perimeter.top >= clip.top
                    && perimeter.right <= clip.right && perimeter.bottom <= clip.bottom,
                headerOverlapsPerimeter, clip, ancestors, hits };
        };
        return { viewport: { width: innerWidth, height: innerHeight }, scrollX, scrollY,
            header: { observedNodeIndex: nodeIndex(header), bounds: headerBounds, position: getComputedStyle(header).position, zIndex: getComputedStyle(header).zIndex, background: getComputedStyle(header).backgroundColor,
                scrollInset: getComputedStyle(document.documentElement).getPropertyValue('--header-scroll-inset').trim() },
            summaryButton: measure(button), active: measure(active), activeIsSummaryButton: active === button };
    });
}

export function summaryFocusGeometryUnchanged(before, after) {
    const position = geometry => ({ viewport: geometry.viewport, scrollX: geometry.scrollX, scrollY: geometry.scrollY,
        header: geometry.header, activeIsSummaryButton: geometry.activeIsSummaryButton,
        summaryButton: geometry.summaryButton, active: geometry.active });
    return JSON.stringify(position(before)) === JSON.stringify(position(after));
}

async function settleSummaryFocus(page) {
    const started = Date.now(), samples = [];
    let geometry = await measureSummaryFocus(page), unchangedSince = Date.now();
    while (Date.now() - started < 2000) {
        await new Promise(resolve => setTimeout(resolve, 40));
        const next = await measureSummaryFocus(page), now = Date.now();
        if (!summaryFocusGeometryUnchanged(geometry, next)) unchangedSince = now;
        geometry = next;
        samples.push({ elapsedMs: now - started, scrollX: geometry.scrollX, scrollY: geometry.scrollY,
            summaryBounds: geometry.summaryButton.bounds, activeBounds: geometry.active.bounds,
            activeText: geometry.active.text, activeIsSummaryButton: geometry.activeIsSummaryButton,
            headerBounds: geometry.header.bounds, headerScrollInset: geometry.header.scrollInset });
        if (now - unchangedSince >= 180) return { geometry, settlement: { settled: true, stableForMs: now - unchangedSince, samples } };
    }
    return { geometry, settlement: { settled: false, stableForMs: Date.now() - unchangedSince, samples } };
}

async function verifySummaryCaptureGeometry(page, state, geometry, settlement) {
    const postCaptureGeometry = await measureSummaryFocus(page);
    const unchanged = summaryFocusGeometryUnchanged(geometry, postCaptureGeometry);
    const observation = state.report.observations.at(-1);
    observation.summaryScrollSettlement = settlement;
    observation.postCaptureSummaryFocus = postCaptureGeometry;
    observation.summaryCaptureGeometryUnchanged = unchanged;
    state.report.checks.push({ name: 'Summary geometry is naturally settled and unchanged across the whole screenshot',
        state: observation.name, passed: settlement.settled && unchanged });
    await writeFile(path.join(state.evidenceDir, 'report.json'), JSON.stringify(state.report, null, 2) + '\n');
    assert.ok(settlement.settled && unchanged, 'Natural summary/active/header geometry must settle and match before/after the actual screenshot.');
}

export function summaryFocusedControlIsClear(geometry, requireSummaryOwner = true) {
    const active = geometry.active;
    return (!requireSummaryOwner || geometry.activeIsSummaryButton) && active.focused && active.focusVisible
        && active.fullPerimeterInsideAllClips && !active.headerOverlapsPerimeter
        && active.hits.length === 3 && active.hits.every(hit => hit.ownTarget && !hit.headerHit);
}

export async function inspectSummaryFocusDiagnostic(page, state, observe, { requireReachability = false } = {}) {
    assert.equal(state.phase, 'after');
    await sourceEditors(page, state, observe);
    state.report.summaryFocusCanonicalSetup = await page.evaluate(() => ({ scrollY,
        readonlyDialogClosed: !document.querySelector('.customer-editor[open]'),
        currentCustomerCleared: window.currentCustomer === null, visibleCustomerDetail: document.querySelector('#customerDetail').getBoundingClientRect().height > 0 }));
    await searchSummaries(page, state, observe, { diagnoseFocus: true, requireReachability });
}

async function searchSummaries(page, state, observe, { diagnoseFocus = false, requireReachability = false } = {}) {
    if (state.phase === 'after') {
        await page.locator('#searchPostalCode').fill('1231AA');
        await page.locator('#searchHouseNumber').fill('1');
    }
    for (const count of state.phase === 'after' ? [0, 1, 3] : [1, 2]) {
        const customers = Array.from({ length: count }, (_, index) => ({ id: 990960 + index,
            firstName: 'Synthetic', lastName: 'Summary result ' + index, sourceSystem: 'theme-audit-local',
            postalCode: '1231AA', houseNumber: '1', street: 'Fixturestraat', city: 'Testplaats', subscriptions: [],
            ...(state.phase === 'after' ? { address: 'Fixturestraat 1', initials: 'S.', middleName: '', houseNumberAddition: '', countryCode: 'NL', email: 'summary@example.invalid', phone: '' } : {}) }));
        await page.evaluate(customers => window.displaySearchResults(customers), customers);
        if (count) await page.locator('#searchSummary').scrollIntoViewIfNeeded();
        const summary = state.phase === 'after' ? await page.locator('#searchSummary').evaluate(node => ({
            countText: node.querySelector('#resultCount').textContent.trim(), label: node.querySelector('#resultCountLabel').textContent.trim(),
            labelKey: node.querySelector('#resultCountLabel').getAttribute('data-i18n'), innerText: node.innerText,
            title: document.querySelector('#resultsTitle').textContent.trim(), range: document.querySelector('#resultsRange').textContent.trim(),
            renderedRowCount: document.querySelectorAll('#paginatedResults .result-row').length })) : undefined;
        const initialSettled = diagnoseFocus && count === 3 ? await settleSummaryFocus(page) : null;
        const initialFocus = initialSettled?.geometry;
        await observe(page, state, 'feedback-search-summary-' + count, diagnoseFocus && count === 3 ? ['#searchSummary', ':focus'] : ['#searchSummary'], { syntheticResultCount: count,
            ...(summary ? { actualSummary: summary } : {}),
            ...(initialFocus ? { summaryFocusDiagnostic: initialFocus, summaryScrollSettlement: initialSettled.settlement } : {}),
            boundary: 'Installed displaySearchResults and real summary template with local-source synthetic results. No subscription-api summary POST or search/customer write; complete AFTER rows are guarded against visible undefined.' });
        if (initialFocus) {
            await verifySummaryCaptureGeometry(page, state, initialFocus, initialSettled.settlement);
            if (requireReachability) {
                const sameNode = await page.evaluate(() => document.querySelector('#searchSummary [data-action=scroll-to-results]') === window.__themeAuditRetainedSummaryButton);
                const passed = sameNode && summaryFocusedControlIsClear(initialFocus);
                state.report.checks.push({ name: 'Corrected settled INITIAL retained summary node owns unobscured full painted keyboard focus', passed, sameNode });
                await writeFile(path.join(state.evidenceDir, 'report.json'), JSON.stringify(state.report, null, 2) + '\n');
                assert.ok(passed, 'The initial retained summary focus itself must be visible; native recovery cannot substitute.');
            }
            assert.equal(summary.countText, '3'); assert.equal(summary.renderedRowCount, 3);
            assert.equal(summary.title, 'Zoekresultaten: "1231AA 1"'); assert.equal(summary.range, 'Toont 1-3 van 3');
            const steps = [{ key: 'initial', geometry: initialFocus }];
            for (const key of ['Tab', 'Shift+Tab']) {
                await page.keyboard.press(key);
                const { geometry, settlement } = await settleSummaryFocus(page); steps.push({ key, geometry });
                await observe(page, state, 'feedback-summary-natural-' + key, ['#searchSummary', ':focus'], { geometry, summaryScrollSettlement: settlement,
                    boundary: 'Retained count1 native focus, then original count3 display/summary scroll setup. Only this genuine native key follows initial observation; no forced scroll/focus/CSS repair.' });
                await verifySummaryCaptureGeometry(page, state, geometry, settlement);
                if (requireReachability) {
                    const passed = summaryFocusedControlIsClear(geometry, key === 'Shift+Tab');
                    state.report.checks.push({ name: 'Corrected settled native summary sequence retains unobscured full keyboard focus', key, passed });
                    await writeFile(path.join(state.evidenceDir, 'report.json'), JSON.stringify(state.report, null, 2) + '\n');
                    assert.ok(passed, 'Every genuine native focus stage must stay fully visible after natural scrolling settles.');
                }
            }
            const expectedInitial = { scrollY: 293, buttonLeft: 158.9166718, buttonTop: 101.6499939,
                buttonWidth: 129.899994, buttonHeight: 40, headerBottom: 125 };
            const near = (actual, expected) => Math.abs(actual - expected) < 0.02;
            const button = initialFocus.summaryButton;
            const initialMatchesRetainedFinding = initialFocus.activeIsSummaryButton && button.focusVisible
                && initialFocus.scrollY === expectedInitial.scrollY && near(button.bounds.left, expectedInitial.buttonLeft)
                && near(button.bounds.top, expectedInitial.buttonTop) && near(button.bounds.width, expectedInitial.buttonWidth)
                && near(button.bounds.height, expectedInitial.buttonHeight) && near(initialFocus.header.bounds.bottom, expectedInitial.headerBottom);
            const returned = steps.at(-1).geometry;
            const nativeReturnClear = returned.activeIsSummaryButton && returned.summaryButton.focusVisible
                && returned.summaryButton.fullPerimeterInsideAllClips && !returned.summaryButton.headerOverlapsPerimeter
                && returned.summaryButton.hits.every(hit => hit.ownTarget && !hit.headerHit);
            state.report.summaryFocusDiagnostic = { steps, expectedInitial, initialMatchesRetainedFinding, nativeReturnClear,
                boundary: 'Observational distinction between the original helper scroll setup and actual subsequent native focus; full whole-image review required, no source acceptance.' };
            return;
        }
        if (state.phase === 'after') {
            if (count) {
                assert.equal(summary.countText, String(count));
                assert.equal(summary.label, count === 1 ? 'klant gevonden' : 'klanten gevonden');
                assert.equal(summary.labelKey, count === 1 ? 'search.resultSummaryOne' : 'search.resultSummaryMany');
                assert.equal(summary.title, 'Zoekresultaten: "1231AA 1"');
                assert.equal(summary.range, `Toont 1-${count} van ${count}`); assert.equal(summary.renderedRowCount, count);
                await page.evaluate(() => { window.__themeAuditSummaryQuery = JSON.stringify([...document.querySelectorAll('.search-card input')].map(node => [node.id, node.value])); });
                for (const locale of ['en', 'nl']) {
                    await page.locator('#agentProfileTrigger').click();
                    await page.locator('[data-locale-option=' + locale + ']').click();
                    await page.locator('#searchSummary').scrollIntoViewIfNeeded();
                    const translated = await page.locator('#searchSummary').evaluate(node => ({
                        countText: node.querySelector('#resultCount').textContent.trim(), label: node.querySelector('#resultCountLabel').textContent.trim(),
                        labelKey: node.querySelector('#resultCountLabel').getAttribute('data-i18n'),
                        title: document.querySelector('#resultsTitle').textContent.trim(), range: document.querySelector('#resultsRange').textContent.trim(),
                        renderedRowCount: document.querySelectorAll('#paginatedResults .result-row').length,
                        queryUnchanged: JSON.stringify([...document.querySelectorAll('.search-card input')].map(input => [input.id, input.value])) === window.__themeAuditSummaryQuery }));
                    await observe(page, state, `feedback-search-summary-${count}-${locale}`, ['#searchSummary'], { syntheticResultCount: count, locale, actualSummary: translated });
                    assert.equal(translated.countText, String(count)); assert.equal(translated.labelKey, summary.labelKey);
                    assert.equal(translated.label, locale === 'en' ? (count === 1 ? 'customer found' : 'customers found') : summary.label);
                    assert.equal(translated.title, locale === 'en' ? 'Search results: "1231AA 1"' : summary.title);
                    assert.equal(translated.range, locale === 'en' ? `Showing 1-${count} of ${count}` : summary.range);
                    assert.equal(translated.renderedRowCount, count);
                    assert.equal(translated.queryUnchanged, true);
                }
            } else assert.equal(await page.locator('#searchSummary').isVisible(), false);
        }
        if (count === 1) {
            const link = page.locator('#searchSummary [data-action=scroll-to-results]');
            const focus = await keyboardFocus(page, link, state.phase);
            if (diagnoseFocus) await link.evaluate(node => { window.__themeAuditRetainedSummaryButton = node; });
            await observe(page, state, 'feedback-search-summary-link-focus', ['#searchSummary'], { focus });
        }
    }
}

async function feedbackAndSettings(page, state, observe, control) {
    if (state.phase === 'after') {
        await page.locator('#contextualFeedbackSettingsButton').press('Enter');
        const settings = page.locator('.contextual-feedback-settings-modal');
        await settings.locator('input[name=feedbackEnabled]').check();
        control.settingsGate.arm();
        await settings.locator('button[type=submit]').press('Enter');
        await page.waitForFunction(() => document.querySelector('#contextualFeedbackButton')?.hidden === false);
        assert.equal(control.settingsGate.used(), true);
        await settings.locator('header [data-feedback-settings-close]').press('Enter');
        await settings.waitFor({ state: 'hidden' });
        await page.locator('#contextualFeedbackButton').waitFor({ state: 'visible' });
        await page.locator('#contextualFeedbackButton').press('Enter');
    } else {
    // Explicit component setup through the already installed hidden button handler, as in accepted08 BEFORE.
    // This is not a claim that the disabled feature is user-accessible; settings/business writes remain denied.
    await page.locator('#contextualFeedbackButton').evaluate(button => button.click());
    }
    const feedback = page.locator('.contextual-feedback-modal');
    await feedback.waitFor({ state: 'visible' });
    await observe(page, state, state.phase === 'after' ? 'feedback-dialog-visible-entry' : 'feedback-dialog-old-close', ['.contextual-feedback-modal', '.contextual-feedback-modal [data-feedback-close]'], {
        boundary: state.phase === 'after' ? 'Actual visible native trigger after one exact local settings UI save; no persisted settings, screenshot capture or feedback submission.' : 'Actual installed hidden-button handler is explicit component setup; no feature availability, capture or feedback submission claim.' });
    const commentFocus = await keyboardFocus(page, feedback.locator('textarea[name=comment]'), state.phase);
    await observe(page, state, 'feedback-dialog-text-focus', ['.contextual-feedback-modal'], { focus: commentFocus });
    const closeFocus = await keyboardFocus(page, feedback.locator('[data-feedback-close]'), state.phase);
    await observe(page, state, 'feedback-dialog-close-focus', ['.contextual-feedback-modal'], { focus: closeFocus });
    await feedback.locator('[data-feedback-close]').press('Enter');
    await feedback.waitFor({ state: 'hidden' });
    await observe(page, state, 'feedback-dialog-after-close', ['#contextualFeedbackButton']);
    await page.locator('#contextualFeedbackSettingsButton').press('Enter');
    const settings = page.locator('.contextual-feedback-settings-modal');
    await settings.waitFor({ state: 'visible' });
    await settings.locator('input[name=publicBaseUrl]').waitFor({ state: 'visible' });
    await observe(page, state, 'feedback-settings-old-close', ['.contextual-feedback-settings-modal']);
    const settingsFocus = await keyboardFocus(page, settings.locator('input[name=publicBaseUrl]'), state.phase);
    await observe(page, state, 'feedback-settings-text-focus', ['.contextual-feedback-settings-modal'], { focus: settingsFocus });
    const settingsClose = settings.locator('header [data-feedback-settings-close]');
    const settingsCloseFocus = await keyboardFocus(page, settingsClose, state.phase);
    await observe(page, state, 'feedback-settings-close-focus', ['.contextual-feedback-settings-modal'], { focus: settingsCloseFocus });
    await settingsClose.press('Enter');
    await settings.waitFor({ state: 'hidden' });
    await observe(page, state, 'feedback-settings-after-close', ['#contextualFeedbackSettingsButton']);
}

async function standardForm(page, state, observe) {
    await page.locator('[data-action=show-new-subscription]').press('Enter');
    const form = page.locator('#newSubscriptionForm');
    await form.waitFor({ state: 'visible' });
    const close = form.locator('.form-header .btn-close');
    await observe(page, state, 'feedback-standard-form-close', ['#newSubscriptionForm', '#newSubscriptionForm .btn-close']);
    const closeFocus = await keyboardFocus(page, close, state.phase);
    await observe(page, state, 'feedback-standard-form-close-focus', ['#newSubscriptionForm'], { focus: closeFocus });
    await close.press('Enter');
    await form.waitFor({ state: 'hidden' });
}

export async function inspectOperationalFeedback(page, state, { observe, control }) {
    await sourceEditors(page, state, observe);
    await searchSummaries(page, state, observe);
    await feedbackAndSettings(page, state, observe, control);
    await standardForm(page, state, observe);
}

export function affectedRecordPrivacyFixtures(sourceRoot) {
    return [2, 12].map(count => {
        const fixture = recordListAfterFixture(sourceRoot, count);
        const sourceInput = { rId: String(fixture.id), firstName: fixture.customer.firstName, initials: fixture.customer.initials,
            surName: 'van der', lastName: fixture.customer.lastName, salutation: fixture.customer.salutation, birthDay: '1980-01-01' };
        const php = 'require $argv[1]."/src/SubscriptionApi/CustomerMutationInput.php"; require $argv[1]."/src/SubscriptionApi/CustomerEditingSnapshot.php"; '
            + 'echo json_encode((new \\App\\SubscriptionApi\\CustomerEditingSnapshot())->build(json_decode($argv[2], true)), JSON_THROW_ON_ERROR);';
        const person = JSON.parse(execFileSync('php', ['-r', php, sourceRoot, JSON.stringify(sourceInput)], { encoding: 'utf8' }));
        fixture.model.sections.person = person.sections.person;
        fixture.customer.middleName = sourceInput.surName;
        fixture.privacySourceInput = sourceInput;
        assert.equal(fixture.model.version, null);
        assert.equal(fixture.model.sections.person[0].fields.surName, 'van der');
        return fixture;
    });
}

export function privacyProductionBaselineIsExact(nodes) {
    return nodes.length === 1 && nodes[0].id === 'sessionOutboxEditor' && nodes[0].tag === 'DIALOG'
        && nodes[0].className === 'form-lightbox customer-editor' && nodes[0].open === false
        && nodes[0].rendered === false && nodes[0].hasCustomerContext === false
        && nodes[0].labelledBy === 'sessionOutboxEditorTitle';
}

export async function inspectAffectedRecordPrivacy(page, state, { observe }) {
    const { registerCustomerAcceptance, inspectEditorPrivacy } = await import('./compose-smoke-theme-audit-customer-acceptance.mjs');
    await registerCustomerAcceptance(state.report);
    assert.equal(state.report.customerAcceptance.module.sha256, 'babd6dc3404d86d791469b9ef5e7481fbb4d14be85cf4820bc50c76e96a70990');
    state.report.captures ||= [];
    const identity = await page.evaluateHandle(() => {
        const read = () => {
            const context = window.kiwiCustomerWorkSession.getRequestContext();
            return { customer: window.currentCustomer, customers: window.customers, reference: context.customerReference,
                workflow: context.workflowSessionId, generation: context.contextGeneration };
        };
        return { read, before: JSON.stringify(read()) };
    });
    const check = (name, actual, expected, detail) => {
        const passed = actual === expected;
        state.report.checks.push({ name, passed, ...detail });
        assert.equal(actual, expected, name);
    };
    const driver = { report: state.report, evidenceDir: state.evidenceDir, check,
        async capture(page, name, selector, kind) {
            const filename = `${state.viewport.width}x${state.viewport.height}-${name}.png`;
            await (selector ? page.locator(selector) : page).screenshot({ path: path.join(state.evidenceDir, filename) });
            state.report.captures.push({ name, filename, viewport: state.viewport, kind, captureMethod: 'Actual default-renderer browser protocol screenshot' });
            await writeFile(path.join(state.evidenceDir, 'report.json'), JSON.stringify(state.report, null, 2) + '\n');
        } };
    let baseline;
    try {
        const baselineMetadata = await page.locator('.customer-editor').evaluateAll(nodes => nodes.map(node => ({
            id: node.id, tag: node.tagName, className: node.className, open: node.open,
            rendered: node.getClientRects().length > 0, hasCustomerContext: Boolean(node.querySelector('.customer-editor-context')),
            labelledBy: node.getAttribute('aria-labelledby')
        })));
        assert.ok(privacyProductionBaselineIsExact(baselineMetadata), 'The existing hidden native outbox editor must retain its exact production identity.');
        state.report.privacyProductionBaseline = baselineMetadata;
        baseline = await page.evaluateHandle(() => {
            const node = document.querySelector('#sessionOutboxEditor');
            const read = () => JSON.stringify({ html: node.outerHTML, open: node.open,
                fields: [...node.querySelectorAll('input,select,textarea')].map(field => ({ value: field.value, checked: field.checked,
                    selectedIndex: field.selectedIndex, readonly: field.readOnly, disabled: field.disabled })) });
            return { node, read, before: read(), unchanged() { return this.node === document.querySelector('#sessionOutboxEditor') && this.before === this.read(); } };
        });
        assert.equal(await page.locator('.customer-editor:has(.customer-editor-context)').count(), 0, 'No source-customer editor is retained before the two explicit fixture opens.');
        for (const fixture of state.privacyFixtures) {
            await page.evaluate(async customer => {
                const imports = Object.assign({}, ...[...document.querySelectorAll('script[type="importmap"]')].map(node => JSON.parse(node.textContent).imports));
                const url = Object.entries(imports).find(([key]) => key.endsWith('/app/customer-editor.js'))?.[1];
                if (!url) throw new Error('Installed customer-editor import is required.');
                const { openCustomerEditor } = await import(url);
                await openCustomerEditor(customer, { api: window.kiwiApi, refresh: async () => { throw new Error('Readonly supplement must never refresh after saving.'); } });
            }, fixture.customer);
            const dialog = page.locator('.customer-editor[open]');
            await dialog.locator('[data-customer-section=bank] .customer-editor-record-action').first().waitFor();
            if (fixture.recordCount === 2) {
                await dialog.locator('[data-customer-section=email] .customer-editor-record-action[data-customer-record-index="1"]').press('Enter');
                await dialog.locator('[data-customer-section=email] input[name=emailAddress]').waitFor();
                await dialog.locator('.form-header .btn-close').click();
                await dialog.waitFor({ state: 'hidden' });
            } else {
                await dialog.locator('[data-customer-section=person] .customer-editor-record-action[data-customer-record-index="0"]').press('Enter');
                await dialog.locator('[data-customer-section=person] input[name=surName]').waitFor();
                await dialog.locator('[data-customer-section=person]').scrollIntoViewIfNeeded();
            }
        }
        const topology = await page.evaluate(() => [...document.querySelectorAll('.customer-editor')].filter(editor => editor.querySelector('.customer-editor-context')).map(editor => ({
            open: editor.open,
            sections: [...editor.querySelectorAll('[data-customer-section]')].map(section => ({
                type: section.dataset.customerSection, rows: section.querySelectorAll('.customer-editor-record').length,
                selected: [...section.querySelectorAll('.customer-editor-record-action[aria-expanded=true]')].map(button => button.dataset.customerRecordIndex),
                allFieldsReadonly: [...section.querySelectorAll('input')].every(field => field.readOnly)
            }))
        })));
        assert.equal(topology.length, 2); assert.equal(topology[0].open, false); assert.equal(topology[1].open, true);
        for (let index = 0; index < topology.length; index++) {
            const count = [2, 12][index];
            assert.deepEqual(topology[index].sections.map(section => section.type), ['person', 'address', 'email', 'phone', 'mobile', 'bank']);
            assert.deepEqual(topology[index].sections.map(section => section.rows), [1, count, count, count, count, count]);
            assert.ok(topology[index].sections.every(section => section.allFieldsReadonly));
        }
        assert.deepEqual(topology[0].sections.find(section => section.type === 'email').selected, ['1']);
        assert.deepEqual(topology[1].sections.find(section => section.type === 'person').selected, ['0']);
        const paintedRegions = await page.evaluate(() => {
            const root = document.querySelector('.customer-editor[open] .onepager-container'), bounds = root.getBoundingClientRect();
            return [...root.querySelectorAll('input[data-feedback-sensitive]')].filter(field => field.value.length >= 5 && field.getBoundingClientRect().width > 0)
                .map(field => { const rect = field.getBoundingClientRect(); return { name: field.name, type: field.type,
                    insideCapture: rect.left >= bounds.left && rect.top >= bounds.top && rect.right <= bounds.right && rect.bottom <= bounds.bottom,
                    insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight }; });
        });
        assert.deepEqual(paintedRegions.map(field => field.name).sort(), ['birthDay', 'firstName', 'lastName', 'surName']);
        assert.ok(paintedRegions.every(field => field.insideCapture && field.insideViewport), 'All four real source-derived sensitive inputs must be painted in the production capture; no offscreen waiver.');
        const before = await page.evaluateHandle(() => {
            const read = () => [...document.querySelectorAll('.customer-editor')].filter(editor => editor.querySelector('.customer-editor-context')).map(editor => ({
                fields: [...editor.querySelectorAll('input,select,textarea')].map(field => ({ value: field.value, checked: field.checked, selectedIndex: field.selectedIndex,
                    readonly: field.readOnly, disabled: field.disabled })),
                selected: [...editor.querySelectorAll('.customer-editor-record-action[aria-expanded=true]')].map(button => [button.closest('[data-customer-section]').dataset.customerSection, button.dataset.customerRecordIndex]),
                publicText: [...editor.querySelectorAll('[data-feedback-public]')].map(node => node.textContent)
            }));
            return { read, value: JSON.stringify(read()) };
        });
        state.report.affectedRecordPrivacy = { topology, paintedRegions, sourceInputs: state.privacyFixtures.map(fixture => fixture.privacySourceInput),
            boundary: 'Two exact retained source-shaped readonly roots; genuine synthetic van der is additional new-supplement field coverage. Original Jansen privacy fixture/crop/thresholds unchanged.' };
        await observe(page, state, 'affected-record-privacy-ready', ['.customer-editor[open]'], { topology, paintedRegions });
        try {
            await inspectEditorPrivacy(page, driver, { viewport: state.viewport, prefix: 'affected-record-' });
            check('Both retained editors preserve selected records fields and public labels', await before.evaluate(state => JSON.stringify(state.read()) === state.value), true, {});
            check('Global customer and work-session identity stays exactly unchanged', await identity.evaluate(state => JSON.stringify(state.read()) === state.before), true, {});
            check('Hidden production outbox editor preserves its exact node DOM and field state', await baseline.evaluate(value => value.unchanged()), true, {});
        } finally { await before.dispose(); }
    } finally { await baseline?.dispose(); await identity.dispose(); }
}
