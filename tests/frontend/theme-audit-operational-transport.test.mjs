import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createOperationalWriteGate, createNativeLoginReceiver, nativeLoginExpectation, nativeViewLoginExpectation, selectedNativeLoginAccount, remainingOperationalGatePlan, nativeZoomRatiosMatch, finishOperationalQueueFixture, installOperationalTransport, createSettingsEnableGate, createRecordMutationGate, operationalJobs, validateAfterViewportPlan, validateLegacyAdoption, validateSecondLegacyAdoption, validateThirdLegacyAdoption, validateFourthLegacyAdoption, physicalClientPoint, nativeReadonlyEditorOpeningAllowed, nativeReadonlyMotionOwnsTarget, shortCallControlsAreReachable, coarseMenuGeometryUnchanged, coarseMenuTargetsAreClear } from '../../scripts/compose-smoke-theme-audit-operational.mjs';
import { readonlySourceFixtures, currentRecordsFixture, recordListAfterFixture, affectedRecordPrivacyFixtures, privacyProductionBaselineIsExact, inputProfileRecordsFixture, summaryFocusGeometryUnchanged, summaryFocusedControlIsClear } from '../../scripts/compose-smoke-theme-audit-operational-feedback.mjs';

const pathname = '/kiwi/api/v1/call-session/hold';
const request = () => ({ method: 'POST', pathname, search: '', payload: {}, csrfPresent: true, contentType: 'application/json' });

test('view login is selected only in the explicit AFTER input-gates role job and never broadens the admin matcher', () => {
    const state = { phase: 'after', suite: 'actual-view', report: { requestedSuite: 'input-gates' } };
    assert.equal(selectedNativeLoginAccount(state), 'kiwi-view');
    for (const override of [{ phase: 'before' }, { suite: 'locale-en' }, { report: { requestedSuite: 'preflight' } }, { report: {} }]) {
        assert.equal(selectedNativeLoginAccount({ ...state, ...override }), 'kiwi-admin');
    }
    const view = { entries: [['username', 'kiwi-view'], ['password', 'kiwi-local-dev-password'], ['opaque-control', 'synthetic']], submitterDisabled: true };
    assert.ok(nativeViewLoginExpectation(view)); assert.equal(nativeLoginExpectation(view), null);
    const admin = structuredClone(view); admin.entries[0][1] = 'kiwi-admin';
    assert.ok(nativeLoginExpectation(admin)); assert.equal(nativeViewLoginExpectation(admin), null);
    for (const change of [value => { value.entries.push(['username', 'kiwi-view']); }, value => { value.entries.push(['password', 'kiwi-local-dev-password']); },
        value => { value.entries[1][1] = 'wrong'; }, value => { value.submitterDisabled = undefined; }]) {
        const invalid = structuredClone(view); change(invalid); assert.equal(nativeViewLoginExpectation(invalid), null);
    }
});

test('remaining input and native plans have exact engine/viewport/context membership and reject replay or widening', () => {
    const viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 320 }];
    for (const browser of ['chromium', 'firefox']) {
        validateAfterViewportPlan('input-gates', browser, viewports);
        validateAfterViewportPlan('native-operational', browser, [viewports[0]]);
        assert.equal(remainingOperationalGatePlan(browser).length, 4);
        assert.equal(operationalJobs('after', 'input-gates', viewports).length, 4);
        assert.deepEqual(operationalJobs('after', 'native-operational', [viewports[0]]), [{ viewport: viewports[0], suite: 'native-operational', recordCount: 2 }]);
    }
    validateAfterViewportPlan('summary-correction', 'firefox', [{ width: 390, height: 1000 }]);
    for (const suite of ['input-gates', 'native-operational', 'summary-correction']) assert.throws(() => operationalJobs('before', suite, viewports));
    for (const [suite, browser, plan] of [['input-gates', 'webkit', viewports], ['input-gates', 'firefox', [...viewports, viewports[0]]],
        ['native-operational', 'firefox', viewports], ['summary-correction', 'chromium', [{ width: 390, height: 1000 }]]]) {
        assert.throws(() => validateAfterViewportPlan(suite, browser, plan));
    }
});

test('native zoom evidence rejects CSS-only scaling, pinch scaling or a changed physical window', () => {
    const before = { innerWidth: 1440, innerHeight: 1000, outerWidth: 1440, outerHeight: 1085, dpr: 1, pinchScale: 1 };
    assert.equal(nativeZoomRatiosMatch('firefox', before, { innerWidth: 720, innerHeight: 500, outerWidth: 720, outerHeight: 543, dpr: 2, pinchScale: 1 }), true);
    assert.equal(nativeZoomRatiosMatch('chromium', before, { innerWidth: 720, innerHeight: 500, outerWidth: 1440, outerHeight: 1085, dpr: 2, pinchScale: 1 }), true);
    for (const zoomed of [{ innerWidth: 720, innerHeight: 500, outerWidth: 1440, outerHeight: 1085, dpr: 1, pinchScale: 1 },
        { innerWidth: 720, innerHeight: 500, outerWidth: 1440, outerHeight: 1085, dpr: 2, pinchScale: 2 },
        { innerWidth: 720, innerHeight: 500, outerWidth: 1500, outerHeight: 1085, dpr: 2, pinchScale: 1 },
        { innerWidth: 720, innerHeight: 500, outerWidth: 1440, outerHeight: 1200, dpr: 2, pinchScale: 1 }]) {
        assert.equal(nativeZoomRatiosMatch('chromium', before, zoomed), false);
    }
});

test('corrected initial focus cannot be accepted through later recovery, missing hits or hidden painted geometry', () => {
    const geometry = { activeIsSummaryButton: true, active: { focused: true, focusVisible: true,
        fullPerimeterInsideAllClips: true, headerOverlapsPerimeter: false, hits: Array.from({ length: 3 }, () => ({ ownTarget: true, headerHit: false })) } };
    assert.equal(summaryFocusedControlIsClear(geometry), true);
    for (const change of [value => { value.activeIsSummaryButton = false; }, value => { value.active.fullPerimeterInsideAllClips = false; },
        value => { value.active.headerOverlapsPerimeter = true; }, value => { value.active.focusVisible = false; },
        value => { value.active.hits[0].ownTarget = false; }, value => { value.active.hits = []; }]) {
        const invalid = structuredClone(geometry); change(invalid); assert.equal(summaryFocusedControlIsClear(invalid), false);
    }
});

test('single-customer input fixtures retain source2/12 arrays, null IDs and disabled null-version capabilities', () => {
    const fixture = inputProfileRecordsFixture(fileURLToPath(new URL('../../', import.meta.url)));
    assert.equal(fixture.model.sections.address.length, 2); assert.equal(fixture.model.sections.phone.length, 2);
    assert.equal(fixture.model.sections.mobile.length, 2); assert.equal(fixture.model.sections.email.length, 12); assert.equal(fixture.model.sections.bank.length, 12);
    assert.equal(fixture.model.sections.address[1].id, null); assert.equal(fixture.model.sections.email[11].id, null);
    assert.equal(fixture.model.version, null); assert.equal(fixture.componentOnly, false);
    assert.ok(Object.values(fixture.model.capabilities.operations).every(operation => operation.enabled === false));
});

test('summary screenshots reject the measured smooth-scroll race and any changed active target or header inset', () => {
    const before = { viewport: { width: 390, height: 1000 }, scrollX: 0, scrollY: 295,
        header: { bounds: { top: 0, bottom: 125 }, scrollInset: '141px' }, activeIsSummaryButton: true,
        summaryButton: { bounds: { top: 99.65, bottom: 139.65 }, focusVisible: true },
        active: { observedNodeIndex: 1, tag: 'BUTTON', text: 'Bekijk resultaten', bounds: { top: 99.65, bottom: 139.65 } } };
    assert.equal(summaryFocusGeometryUnchanged(before, structuredClone(before)), true);
    for (const change of [after => { after.scrollY = 316; after.summaryButton.bounds.top = 78.65; },
        after => { after.active.text = 'Nieuw Abonnement'; }, after => { after.active.bounds.top -= 21; },
        after => { after.header.scrollInset = '142px'; }, after => { after.header.bounds.bottom = 126; },
        after => { after.summaryButton.focusVisible = false; }, after => { after.scrollX = 1; },
        after => { after.active.observedNodeIndex = 2; }]) {
        const after = structuredClone(before); change(after); assert.equal(summaryFocusGeometryUnchanged(before, after), false);
    }
});

test('short-call reachability rejects any obscured edge/perimeter or missing real keyboard target', () => {
    const nodes = ['#recordingIndicator .rec-text', '#holdCallBtn', '#endCallBtn'].map(selector => ({ selector,
        active: selector === '#holdCallBtn', focusVisible: selector === '#holdCallBtn', fullControlAndFocusInsideAllClips: true,
        overlapsToast: false, focusPerimeterOverlapsToast: false, naturalPointerTarget: true }));
    assert.equal(shortCallControlsAreReachable(nodes), true);
    const pointerInitial = structuredClone(nodes); pointerInitial[1].focusVisible = false;
    assert.equal(shortCallControlsAreReachable(pointerInitial), false);
    assert.equal(shortCallControlsAreReachable(pointerInitial, { requireKeyboardFocus: false }), true);
    const pointerObscured = structuredClone(pointerInitial); pointerObscured[1].overlapsToast = true;
    assert.equal(shortCallControlsAreReachable(pointerObscured, { requireKeyboardFocus: false }), false);
    const pointerNoOwnership = structuredClone(pointerInitial); pointerNoOwnership[1].active = false;
    assert.equal(shortCallControlsAreReachable(pointerNoOwnership, { requireKeyboardFocus: false }), false);
    assert.equal(shortCallControlsAreReachable([...nodes, { selector: '#sessionServiceNumber', fullControlAndFocusInsideAllClips: false }]), true);
    for (const changed of [{ fullControlAndFocusInsideAllClips: false }, { overlapsToast: true }, { focusPerimeterOverlapsToast: true },
        { naturalPointerTarget: false }, { active: false }, { focusVisible: false }]) {
        const invalid = structuredClone(nodes); Object.assign(invalid[1], changed); assert.equal(shortCallControlsAreReachable(invalid), false);
    }
    assert.equal(shortCallControlsAreReachable(nodes.slice(1)), false);
    assert.equal(shortCallControlsAreReachable([...nodes, nodes[0]]), false);
});

test('legacy adoption permits only four named original replacements and sixteen unchanged original members', () => {
    const changed = ['scripts/compose-smoke-theme-audit-customer.mjs', 'scripts/compose-smoke-theme-audit-controls.mjs',
        'scripts/compose-smoke-theme-audit-customer-acceptance.mjs', 'scripts/compose-smoke-theme-audit.mjs'];
    const original = { toolingOriginals: [...changed, ...Array.from({ length: 16 }, (_, index) => `scripts/unchanged-${index}.mjs`)]
        .map(path => ({ path, sha256: 'a'.repeat(64) })) };
    const adoption = { phase: 'after', independentReview: '69c981b5ac932400a460e34a82e921894b976fe08ea43592f7c9d2997529721b',
        changedOriginalMembers: 4, unchangedOriginalMembers: 16,
        allowedChanges: [...changed, 'scripts/compose-smoke-shared-addresses.mjs'].map(path => ({ path, beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) })),
        toolingOriginals: original.toolingOriginals.map(entry => ({ ...entry, originalSha256: entry.sha256,
            sha256: changed.includes(entry.path) ? 'b'.repeat(64) : entry.sha256, adopted: changed.includes(entry.path) })) };
    assert.equal(validateLegacyAdoption(adoption, original).size, 20);
    for (const mutate of [value => { value.phase = 'before'; }, value => { value.allowedChanges.push({ path: 'scripts/unapproved.mjs' }); },
        value => { value.toolingOriginals[4].sha256 = 'b'.repeat(64); }, value => { value.toolingOriginals[0].adopted = false; },
        value => { value.allowedChanges[0].beforeSha256 = 'c'.repeat(64); }, value => { value.toolingOriginals.push(value.toolingOriginals[0]); },
        value => { value.changedOriginalMembers = 5; }]) {
        const invalid = structuredClone(adoption); mutate(invalid);
        assert.throws(() => validateLegacyAdoption(invalid, original));
    }
});

test('second serial adoption admits only six original replacements, fourteen unchanged members and two exact new privacy bodies', () => {
    const root = '/home/bartdeijkers/_worktrees/.kiwi-theme-audit/evidence/2026-11-13/slice-09/';
    const changed = ['scripts/compose-smoke-theme-audit-customer.mjs', 'scripts/compose-smoke-theme-audit-controls.mjs',
        'scripts/compose-smoke-theme-audit-customer-acceptance.mjs', 'scripts/compose-smoke-theme-audit.mjs',
        'scripts/compose-smoke-theme.mjs', 'scripts/compose-smoke-theme-audit-overlays-acceptance.mjs'];
    const original = { toolingOriginals: [...changed, ...Array.from({ length: 14 }, (_, index) => `scripts/unchanged-${index}.mjs`)]
        .map(path => ({ path, sha256: 'a'.repeat(64) })) };
    const adoption = { phase: 'after', independentReview: '69c981b5ac932400a460e34a82e921894b976fe08ea43592f7c9d2997529721b',
        changedOriginalMembers: 6, unchangedOriginalMembers: 14,
        allowedChanges: [...changed, 'scripts/compose-smoke-shared-addresses.mjs'].map(path => ({ path, beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) })),
        toolingOriginals: original.toolingOriginals.map(entry => ({ ...entry, originalSha256: entry.sha256,
            sha256: changed.includes(entry.path) ? 'b'.repeat(64) : entry.sha256, adopted: changed.includes(entry.path) })),
        previousAdoption: { path: root + 'legacy-helper-adoption-01.json', sha256: 'bd353358221c62736cdfd49ba8a863a2e9412068ca65ea54b79fb275a357aa4e' },
        candidateManifests: [
            { path: root + 'legacy-adapter-candidate-01/manifest.json', sha256: '6520562c7e1e37583968391f738fd9bed558db2626e20c9be2938902a89bd530' },
            { path: root + 'legacy-reference-bridge-candidate-01/manifest.json', sha256: 'e863d0662726462e7b07a41277a9715c49336b4620913e424b7ae4eda6df8fb0' },
            { path: root + 'legacy-theme-focus-candidate-01/manifest.json', sha256: '67770266875de998fe21dd1f14b603d0df5c6e2fbea161ce46029ae83784cb1a' },
            { path: root + 'privacy-current-source-candidate-02/manifest.json', sha256: '3cd4a2e8fcaf76655b876a1c4f05a7ecf6f5698f07fe0f8f95f62cb7f04dcad7' } ],
        additionalIndependentReviews: [
            { path: root + 'independent-review/legacy-normal-theme-focus-candidate01-review-01.json', sha256: '4654df9335a8355ca8cda3689edda6cca25c54fd5080160fd32353fa1b288f0f' },
            { path: root + 'independent-review/privacy-current-source-candidate02-review-01.json', sha256: '9aeae74ad3faf1066e6df81d191beeba46130fde6a7741802b1daa4fb8529da6' } ],
        newMembers: [
            { path: 'scripts/compose-smoke-theme-audit-operational-privacy.mjs', afterSha256: '8cc734b54744777c313a2a87c0c780a6de920175fc8637923c2dcf5b2857bbf0', bytes: 23009 },
            { path: 'tests/frontend/theme-audit-operational-privacy.test.mjs', afterSha256: '53c34024c3f6924464b864431b253d5d945ac8059a49d57b2b7c644eefc12ee5', bytes: 12112 } ] };
    assert.equal(validateSecondLegacyAdoption(adoption, original).size, 20);
    const third = { ...structuredClone(adoption), previousAdoption: { path: root + 'legacy-helper-adoption-02.json', sha256: '2741b4be7c424c9d98937f083c7e202e17bb49999e056179ec3b5bc6a24c8501' },
        candidateManifests: [...adoption.candidateManifests, { path: root + 'privacy-baseline-candidate-05/manifest.json', sha256: '6bf7abf8f2125e4b9e7751d211f3429946ba0eb1df33bb78d965eaf60845f00c' }],
        additionalIndependentReviews: [...adoption.additionalIndependentReviews,
            { path: root + 'independent-review/privacy-calendar03-and-launcher03-review-01.json', sha256: '3e72671cfd4075f5e47898866a38c6e9e099c5462b615ed8e747cab9646690ad' },
            { path: root + 'independent-review/privacy-baseline05-recorder-source-review-01.json', sha256: '2835f74a5792ca53a1035a965e22234fdbac28fbed04b83758e6908217012d91' }],
        newMembers: [
            { path: 'scripts/compose-smoke-theme-audit-operational-privacy.mjs', afterSha256: '778a5a7cc12565a59f42a51d85b5284a9223fe75c38070be66a09baa9133d35b', bytes: 26598, previousSha256: '8cc734b54744777c313a2a87c0c780a6de920175fc8637923c2dcf5b2857bbf0' },
            { path: 'tests/frontend/theme-audit-operational-privacy.test.mjs', afterSha256: 'ab4f93c5c95ad3233228998bb8a90d8853eae1439670889e5aecd45935d6e275', bytes: 16589, previousSha256: '53c34024c3f6924464b864431b253d5d945ac8059a49d57b2b7c644eefc12ee5' }] };
    assert.equal(validateThirdLegacyAdoption(third, original, adoption).size, 20);
    const fourth = { ...structuredClone(third), previousAdoption: { path: root + 'legacy-helper-adoption-03.json', sha256: '324ebfbfd1ed6da038e886992e8d63a18ae8b42c64d04875ed78c5c43fb4ed79' },
        candidateManifests: [...third.candidateManifests, { path: root + 'privacy-missing-resource-candidate-06/manifest.json', sha256: '59e346381d349ca1ef6ed63eef441504fad5059d4b147596656b2cd6ac841336' }],
        additionalIndependentReviews: [...third.additionalIndependentReviews,
            { path: root + 'independent-review/privacy-missing-resource06-source-review-01.json', sha256: '3f39dc8f3bbee5d120fded84e08a98b0ce4937b5cc44c5c246ca71e5dba03595' }],
        newMembers: [
            { path: 'scripts/compose-smoke-theme-audit-operational-privacy.mjs', afterSha256: 'c7bfa2fa7c104ddaae3232ccc38b30f4ec20acbccbaad03e0ed7e319da70d84f', bytes: 27453, previousSha256: '778a5a7cc12565a59f42a51d85b5284a9223fe75c38070be66a09baa9133d35b' },
            { path: 'tests/frontend/theme-audit-operational-privacy.test.mjs', afterSha256: '9c0b1808cd8c65c730b51cb05431af9b592277c6f0b230d409bf6e8b2f30d2fe', bytes: 20779, previousSha256: 'ab4f93c5c95ad3233228998bb8a90d8853eae1439670889e5aecd45935d6e275' }] };
    assert.equal(validateFourthLegacyAdoption(fourth, original, third, adoption).size, 20);
    for (const change of [value => { value.phase = 'before'; }, value => { value.previousAdoption.sha256 = 'c'.repeat(64); },
        value => { value.toolingOriginals[0].sha256 = 'c'.repeat(64); }, value => { value.allowedChanges.push(value.allowedChanges[0]); },
        value => { value.candidateManifests[5].sha256 = 'c'.repeat(64); }, value => { value.additionalIndependentReviews.pop(); },
        value => { value.newMembers[0].previousSha256 = 'c'.repeat(64); }, value => { value.newMembers[1].bytes++; }]) {
        const invalid = structuredClone(fourth); change(invalid); assert.throws(() => validateFourthLegacyAdoption(invalid, original, third, adoption));
    }

    for (const change of [value => { value.phase = 'before'; }, value => { value.previousAdoption.sha256 = 'c'.repeat(64); },
        value => { value.allowedChanges[0].afterSha256 = 'c'.repeat(64); }, value => { value.toolingOriginals[7].sha256 = 'c'.repeat(64); },
        value => { value.candidateManifests.pop(); }, value => { value.additionalIndependentReviews[3].sha256 = 'c'.repeat(64); },
        value => { value.newMembers[0].previousSha256 = 'c'.repeat(64); }, value => { value.newMembers[1].afterSha256 = 'c'.repeat(64); }]) {
        const invalid = structuredClone(third); change(invalid); assert.throws(() => validateThirdLegacyAdoption(invalid, original, adoption));
    }

    for (const mutate of [value => { value.phase = 'before'; }, value => { value.changedOriginalMembers = 7; },
        value => { value.allowedChanges.push({ path: 'scripts/unapproved.mjs' }); }, value => { value.toolingOriginals[6].sha256 = 'b'.repeat(64); },
        value => { value.toolingOriginals[0].adopted = false; }, value => { value.toolingOriginals.pop(); },
        value => { value.previousAdoption.sha256 = 'c'.repeat(64); }, value => { value.candidateManifests[3].path += '-other'; },
        value => { value.additionalIndependentReviews.pop(); }, value => { value.newMembers[0].afterSha256 = 'c'.repeat(64); },
        value => { value.newMembers[1].bytes++; }, value => { value.newMembers.push(value.newMembers[0]); }]) {
        const invalid = structuredClone(adoption); mutate(invalid);
        assert.throws(() => validateSecondLegacyAdoption(invalid, original));
    }
});

test('matrix engine/viewport tuples are finite and cannot silently replay desktop or widen other scopes', () => {
    const desktop = { width: 1440, height: 1000 }, narrow = [{ width: 390, height: 1000 }, { width: 320, height: 1000 }, { width: 390, height: 320 }];
    validateAfterViewportPlan('matrix', 'chromium', narrow);
    validateAfterViewportPlan('matrix', 'firefox', [desktop, ...narrow]);
    validateAfterViewportPlan('matrix-remaining', 'chromium', [narrow[2]]);
    validateAfterViewportPlan('matrix-remaining', 'firefox', [desktop, ...narrow]);
    validateAfterViewportPlan('matrix-firefox-short', 'firefox', [narrow[2]]);
    assert.equal(operationalJobs('after', 'matrix-firefox-short', [narrow[2]]).length, 4);
    validateAfterViewportPlan('async-outbox', 'chromium', [desktop]);
    assert.deepEqual(operationalJobs('after', 'async-outbox', [desktop]), [{ viewport: desktop, suite: 'async-outbox' }]);
    assert.throws(() => operationalJobs('before', 'async-outbox', [desktop]));
    validateAfterViewportPlan('summary-focus', 'firefox', [narrow[0]]);
    assert.deepEqual(operationalJobs('after', 'summary-focus', [narrow[0]]), [{ viewport: narrow[0], suite: 'summary-focus' }]);
    assert.throws(() => operationalJobs('before', 'summary-focus', [narrow[0]]));
    validateAfterViewportPlan('feedback-after', 'chromium', [desktop]);
    validateAfterViewportPlan('short-call', 'chromium', [{ width: 390, height: 320 }]);
    validateAfterViewportPlan('anonymous-short', 'chromium', [{ width: 390, height: 320 }]);
    validateAfterViewportPlan('outbox-editor', 'chromium', [{ width: 320, height: 1000 }]);
    validateAfterViewportPlan('outbox-fallback-narrow', 'chromium', [{ width: 320, height: 1000 }]);
    validateAfterViewportPlan('held-readability', 'chromium', narrow.slice(0, 2));
    validateAfterViewportPlan('correction-carry', 'chromium', [narrow[0], desktop]);
    assert.deepEqual(operationalJobs('after', 'correction-carry', [narrow[0], desktop]), [
        { viewport: narrow[0], suite: 'outbox-fallback-narrow' }, { viewport: desktop, suite: 'outbox-editor' }]);
    assert.deepEqual(operationalJobs('after', 'short-call', [{ width: 390, height: 320 }]), [{ viewport: { width: 390, height: 320 }, suite: 'short-call' }]);
    assert.equal(operationalJobs('after', 'matrix', narrow).length, 12);
    assert.ok(operationalJobs('after', 'matrix', narrow).every(job => job.suite !== 'records-after-component'));
    for (const [suite, browser, viewports] of [['matrix', 'chromium', [desktop, ...narrow]], ['matrix', 'chromium', narrow.slice(1)],
        ['matrix', 'firefox', narrow], ['matrix', 'webkit', [desktop, ...narrow]], ['preflight', 'firefox', [desktop]], ['records-component', 'chromium', narrow],
        ['short-call', 'firefox', [{ width: 390, height: 320 }]], ['short-call', 'chromium', [desktop]],
        ['anonymous-short', 'chromium', [desktop]], ['outbox-editor', 'chromium', [{ width: 390, height: 1000 }]],
        ['outbox-fallback-narrow', 'firefox', [{ width: 320, height: 1000 }]], ['matrix-remaining', 'chromium', narrow],
        ['held-readability', 'chromium', [desktop]], ['correction-carry', 'chromium', [desktop, narrow[0]]],
        ['matrix-firefox-short', 'chromium', [narrow[2]]], ['matrix-firefox-short', 'firefox', narrow],
        ['async-outbox', 'firefox', [desktop]], ['async-outbox', 'chromium', narrow],
        ['summary-focus', 'chromium', [narrow[0]]], ['summary-focus', 'firefox', [narrow[2]]]]) {
        assert.throws(() => validateAfterViewportPlan(suite, browser, viewports));
    }
});

test('explicit record CLI scopes keep readonly2/12 and raw component person/email in separate fresh jobs', () => {
    const viewport = { width: 1440, height: 1000 };
    assert.deepEqual(operationalJobs('after', 'records-after', [viewport]), [2, 12].map(recordCount => ({ viewport, suite: 'records-after', recordCount })));
    assert.deepEqual(operationalJobs('after', 'records-component', [viewport]), ['person', 'email'].map(mutationSection => ({ viewport,
        suite: 'records-after-component', recordCount: 2, mutationSection })));
    assert.deepEqual(operationalJobs('after', 'preflight', [viewport]), ['operational', 'feedback'].map(suite => ({ viewport, suite })));
    assert.deepEqual(operationalJobs('after', 'feedback-after', [viewport]), [{ viewport, suite: 'feedback' }]);
    assert.deepEqual(operationalJobs('after', 'outbox-focus', [viewport]), [{ viewport, suite: 'outbox-focus' }]);
    assert.deepEqual(operationalJobs('before', 'records-b4', [viewport]), [{ viewport, suite: 'records-b4' }]);
    for (const [phase, suite] of [['before', 'records-after'], ['before', 'records-component'], ['after', 'records-b4'], ['after', 'operational'], ['unknown', 'records-after']]) {
        assert.throws(() => operationalJobs(phase, suite, [viewport]));
    }
});

test('finite record list fixtures preserve every source-shaped item and distinguish component write eligibility', () => {
    const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
    for (const count of [2, 12]) {
        const readonly = recordListAfterFixture(sourceRoot, count);
        assert.equal(readonly.model.version, null);
        assert.equal(readonly.componentOnly, false);
        for (const section of ['address', 'email', 'phone', 'mobile', 'bank']) {
            assert.equal(readonly.model.sections[section].length, count);
            assert.equal(readonly.model.sections[section].filter(item => item.id === null).length, count / 2);
            const ids = readonly.model.sections[section].flatMap(item => item.id === null ? [] : [item.id]);
            assert.equal(new Set(ids).size, ids.length);
        }
        const component = recordListAfterFixture(sourceRoot, count, true);
        assert.equal(component.model.version, 'theme-audit-component-only');
        assert.equal(component.componentOnly, true);
        assert.deepEqual(Object.entries(component.model.capabilities.operations).filter(([, capability]) => capability.enabled).map(([operation]) => operation), ['person.update', 'email.update']);
    }
    assert.throws(() => recordListAfterFixture(sourceRoot, 3), /declared/);
});

test('record mutations require an exact armed single synthetic component PATCH and never allow arbitrary business records', () => {
    const gate = createRecordMutationGate();
    const payload = { credentialKey: 'theme-audit-records-component-2', expectedVersion: 'theme-audit-component-only', changes: { salutation: 'Geachte mevrouw' } };
    const valid = { method: 'PATCH', pathname: '/kiwi/api/v1/persons/990970/profile', search: '', payload, csrfPresent: true,
        idempotencyPresent: true, contentType: 'application/json' };
    assert.equal(gate.take(valid), false);
    assert.throws(() => gate.arm({ ...payload, pathname: '/kiwi/api/v1/persons/990971/profile' }));
    gate.arm({ ...payload, pathname: valid.pathname });
    for (const changed of [{ method: 'POST' }, { pathname: valid.pathname + '/other' }, { search: '?extra=1' }, { csrfPresent: false },
        { idempotencyPresent: false }, { contentType: 'text/plain' }, { payload: { ...payload, unexpected: true } },
        { payload: { ...payload, changes: { salutation: 'Vrouw' } } }, { payload: { ...payload, changes: { firstName: 'Synthetic' } } }]) {
        assert.equal(gate.take({ ...valid, ...changed }), false);
        assert.equal(gate.pending(), true);
    }
    assert.equal(gate.take(valid), true);
    assert.equal(gate.take(valid), false);
    assert.equal(gate.pending(), false);
    assert.equal(gate.used(), true);
    assert.throws(() => gate.arm({ ...payload, pathname: valid.pathname }));
});

test('the component transport exception only fulfills its reviewed AFTER scope and returns a local503', async () => {
    const payload = { credentialKey: 'theme-audit-records-component-2', expectedVersion: 'theme-audit-component-only', changes: { emailAddress: 'changed@example.invalid' } };
    const pathname = '/kiwi/api/v1/persons/990970/emails/synthetic-email-a';
    for (const [phase, suite, allowed] of [['before', 'records-b4', false], ['after', 'feedback', false], ['after', 'records-after', false], ['after', 'records-after-component', true]]) {
        let handler;
        const state = { phase, suite, baseUrl: new URL('https://bdc.rtvmedia.org.local:9444/kiwi/'), report: { deniedRequests: [], recordMutations: [] } };
        const control = await installOperationalTransport({ route: async (_pattern, value) => { handler = value; } }, state);
        control.recordMutationGate.arm({ pathname, ...payload });
        const outcome = {};
        const pending = handler({ request: () => ({ method: () => 'PATCH', url: () => new URL(pathname, state.baseUrl).href,
            headers: () => ({ 'content-type': 'application/json', 'x-csrf-token': 'synthetic', 'idempotency-key': 'synthetic' }), postDataJSON: () => payload }),
            fulfill: async response => { outcome.response = response; }, abort: async () => { outcome.aborted = true; },
            continue: async () => { outcome.forwarded = true; } });
        if (allowed) {
            assert.equal(outcome.response, undefined, 'The exact local response remains held for real pending-state observation.');
            assert.equal(typeof control.recordMutationResponse, 'function');
            control.releaseRecordMutation();
        }
        await pending;
        assert.equal(Boolean(outcome.response), allowed);
        assert.equal(outcome.forwarded, undefined);
        if (allowed) {
            assert.equal(outcome.response.status, 503);
            assert.equal(state.report.recordMutations.length, 1);
            assert.equal('credentialKey' in state.report.recordMutations[0], false);
        } else assert.equal(outcome.aborted, true);
    }
});

test('current record fixtures are serialized by the application DTO with null version, source IDs and masked banks', () => {
    const fixture = currentRecordsFixture(fileURLToPath(new URL('../../', import.meta.url)));
    assert.equal(fixture.model.version, null);
    assert.equal(fixture.model.personId, fixture.customer.personId);
    assert.equal(fixture.model.credentialKey, fixture.customer.credentialKey);
    for (const section of ['address', 'email', 'phone', 'mobile', 'bank']) {
        assert.equal(fixture.model.sections[section].length, 2);
        assert.equal(fixture.model.sections[section][0].id, 'synthetic-' + section + '-a');
        assert.equal(fixture.model.sections[section][1].id, null);
        for (const item of fixture.model.sections[section]) {
            assert.equal(Object.keys(item).some(key => /valid|from|until|period/i.test(key)), false);
        }
    }
    for (const bank of fixture.model.sections.bank) {
        assert.equal('iban' in bank.fields, false);
        assert.match(bank.maskedIban, /^SY •••• 000[12]$/);
        assert.equal(bank.deletionAllowed, false);
        assert.equal(bank.deletionReason, 'bank_links_unverified');
    }
    assert.ok(Object.values(fixture.model.capabilities.operations).every(operation => operation.enabled === false));
});

test('current record supplement allows only its exact detail/editing GETs once and blocks record/reset writes', async () => {
    let handler;
    const state = { phase: 'before', suite: 'records-b4', recordFixture: currentRecordsFixture(fileURLToPath(new URL('../../', import.meta.url))),
        baseUrl: new URL('https://bdc.rtvmedia.org.local:9444/kiwi/'), report: { readonlySourceReads: [], deniedRequests: [] } };
    await installOperationalTransport({ route: async (_pattern, routeHandler) => { handler = routeHandler; } }, state);
    const invoke = async (suffix, method = 'GET') => {
        const outcome = {};
        await handler({ request: () => ({ url: () => new URL('api/v1/' + suffix, state.baseUrl).href, method: () => method,
            headers: () => ({}), postDataJSON: () => ({}) }), fulfill: async response => { outcome.response = response; },
            abort: async () => { outcome.aborted = true; }, continue: async () => { outcome.forwarded = true; } });
        return outcome;
    };
    for (const suffix of [state.recordFixture.detailSuffix, state.recordFixture.suffix]) {
        assert.equal((await invoke(suffix + '&extra=1')).aborted, true);
        assert.ok((await invoke(suffix)).response);
        assert.equal((await invoke(suffix)).aborted, true);
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await invoke(suffix, method)).aborted, true);
    }
    assert.equal((await invoke('persons/990970/addresses/unrecognized')).aborted, true);
    assert.equal((await invoke('customer-work-sessions/reset', 'POST')).aborted, true);
    assert.equal(state.report.readonlySourceReads.length, 2);
});

test('visible feedback enablement requires one armed exact six-key safe settings UI request', () => {
    const baseUrl = new URL('https://bdc.rtvmedia.org.local:9444/kiwi/');
    const gate = createSettingsEnableGate(baseUrl);
    const payload = { feedbackEnabled: true, publicBaseUrl: 'https://bdc.rtvmedia.org.local:9444/kiwi', imageTtlDays: 14,
        maxImageBytes: 3145728, clearWebhookUrl: false, clearOriginalDataWebhookUrl: false };
    const valid = { method: 'PUT', pathname: '/kiwi/api/v1/development-feedback/settings', search: '', payload, csrfPresent: true, contentType: 'application/json' };
    assert.equal(gate.take(valid), false);
    gate.arm();
    for (const changed of [{ method: 'POST' }, { csrfPresent: false }, { search: '?extra=1' }, { contentType: 'text/plain' },
        { payload: { ...payload, webhookUrl: '' } }, { payload: { ...payload, originalDataWebhookUrl: '' } },
        { payload: { ...payload, allowedRoles: ['admin'] } }, { payload: { ...payload, imageTtlDays: 13 } }]) {
        assert.equal(gate.take({ ...valid, ...changed }), false);
    }
    assert.equal(gate.take(valid), true);
    assert.equal(gate.take(valid), false);
    assert.throws(() => gate.arm(), /Only one/);
});

test('readonly source reads require exact synthetic identity/query once and never authorize a write', async () => {
    let routeHandler;
    const state = { suite: 'feedback', feedbackFixtures: readonlySourceFixtures(),
        baseUrl: new URL('https://bdc.rtvmedia.org.local:9444/kiwi/'), report: { readonlySourceReads: [], deniedRequests: [] } };
    await installOperationalTransport({ route: async (_pattern, handler) => { routeHandler = handler; } }, state);
    const invoke = async (url, method = 'GET') => {
        const outcome = {};
        await routeHandler({ request: () => ({ url: () => url, method: () => method, headers: () => ({}), postDataJSON: () => ({}) }),
            fulfill: async response => { outcome.response = response; }, abort: async () => { outcome.aborted = true; } });
        return outcome;
    };
    for (const fixture of state.feedbackFixtures) {
        const outcome = await invoke(new URL('api/v1/' + fixture.suffix, state.baseUrl).href);
        assert.equal(outcome.response.json.sections.person[0].fields.salutation, fixture.salutation);
        assert.equal(outcome.response.json.capabilities.roleCanWrite, false);
    }
    const first = new URL('api/v1/' + state.feedbackFixtures[0].suffix, state.baseUrl).href;
    assert.equal((await invoke(first)).aborted, true);
    assert.equal((await invoke(first + '-unexpected')).aborted, true);
    assert.equal((await invoke(first, 'POST')).aborted, true);
    assert.equal(state.report.readonlySourceReads.length, 3);
    assert.equal(state.report.deniedRequests.length, 3);
});

test('canonical summary setup permits only its exact third readonly fixture once and rejects other person reads or writes', async () => {
    let routeHandler;
    const state = { phase: 'after', suite: 'summary-focus', feedbackFixtures: readonlySourceFixtures(),
        baseUrl: new URL('https://bdc.rtvmedia.org.local:9444/kiwi/'), report: { readonlySourceReads: [], deniedRequests: [] } };
    await installOperationalTransport({ route: async (_pattern, handler) => { routeHandler = handler; } }, state);
    const invoke = async (suffix, method = 'GET') => {
        const outcome = {};
        await routeHandler({ request: () => ({ url: () => new URL('api/v1/' + suffix, state.baseUrl).href, method: () => method,
            headers: () => ({}), postDataJSON: () => ({}) }), fulfill: async response => { outcome.response = response; },
            abort: async () => { outcome.aborted = true; } });
        return outcome;
    };
    const suffix = state.feedbackFixtures[2].suffix;
    assert.equal((await invoke(suffix + '-unexpected')).aborted, true);
    assert.equal((await invoke(state.feedbackFixtures[0].suffix)).aborted, true);
    assert.equal((await invoke('persons/990942')).aborted, true);
    assert.equal((await invoke(suffix, 'PATCH')).aborted, true);
    assert.equal((await invoke(suffix)).response.json.capabilities.roleCanWrite, false);
    assert.equal((await invoke(suffix)).aborted, true);
    assert.equal(state.report.readonlySourceReads.length, 1);
});

test('the actual outbox read fixture stays pending until release, then drains the unchanged source-shaped response', async () => {
    let routeHandler, fulfilled = null;
    const state = { baseUrl: new URL('https://bdc.rtvmedia.org.local:9444/kiwi/'), report: { outboxReads: [] } };
    const context = { route: async (_pattern, handler) => { routeHandler = handler; } };
    const control = await installOperationalTransport(context, state);
    const pending = routeHandler({ request: () => ({ url: () => 'https://bdc.rtvmedia.org.local:9444/kiwi/api/v1/outbox-sessions?limit=20&offset=0', method: () => 'GET' }),
        fulfill: async response => { fulfilled = response; } });
    assert.equal(control.held.length, 1);
    assert.equal(fulfilled, null);
    control.mode = 'ready'; control.release();
    await pending;
    assert.equal(control.held.length, 0);
    assert.equal(fulfilled.json.items.length, 9);
    assert.deepEqual(fulfilled.json.items.map(item => item.status), ['pending', 'paused', 'ready', 'processing', 'completed', 'failed', 'uncertain', 'cancelled', 'synthetic_unknown']);
    assert.equal(state.report.outboxReads.length, 1);
});

test('the actual repository delayed queue renderer cannot restart or persist a finished component fixture', () => {
    let starts = 0, clears = 0, writes = 0;
    const queueBar = { style: { display: 'block' } };
    const scope = { console, callQueue: { enabled: true, queue: [{ waitTime: 187 }], waitTimeInterval: 123 },
        callSession: { active: false }, document: { getElementById: id => id === 'queueInfo' ? queueBar : null },
        setInterval: () => { starts += 1; return 456; }, clearInterval: () => { clears += 1; },
        kiwiApi: { put: () => { writes += 1; return Promise.resolve(); } } };
    scope.window = scope;
    vm.createContext(scope);
    vm.runInContext(readFileSync(new URL('../../assets/js/app/call-agent-runtime.js', import.meta.url), 'utf8'), scope);
    const delayedSourceCallback = scope.kiwiCallAgentRuntime.updateQueueDisplay;
    finishOperationalQueueFixture(scope);
    delayedSourceCallback();
    assert.equal(queueBar.style.display, 'none');
    assert.equal(scope.callQueue.enabled, false);
    assert.equal(scope.callQueue.queue.length, 0);
    assert.equal(scope.callQueue.waitTimeInterval, null);
    assert.equal(clears, 1);
    assert.equal(starts, 0);
    assert.equal(writes, 0);
});

test('the native snapshot receiver accepts only its armed page/mainframe once', async () => {
    const page = {}, frame = {}, receiver = createNativeLoginReceiver(page, frame);
    const expected = { entries: [['username', 'kiwi-admin'], ['password', 'kiwi-local-dev-password']], submitterDisabled: true };
    assert.equal(receiver.receive({ page: {}, frame }, expected), false);
    assert.equal(receiver.receive({ page, frame: {} }, expected), false);
    assert.equal(receiver.receive({ page, frame }, expected), true);
    assert.equal(receiver.receive({ page, frame }, { ...expected, submitterDisabled: false }), false);
    assert.deepEqual(await receiver.wait(20), expected);
});

test('the native snapshot receiver has a bounded no-message outcome for safe auth denial', async () => {
    const page = {}, frame = {}, receiver = createNativeLoginReceiver(page, frame);
    assert.equal(await receiver.wait(5), null);
    assert.equal(receiver.receive({ page, frame }, {}), false);
});

test('native form snapshots cannot override pinned fixture credentials or omit/duplicate critical fields', () => {
    const entries = [['username', 'kiwi-admin'], ['password', 'kiwi-local-dev-password'], ['credentialId', '']];
    const snapshot = values => ({ entries: values, submitterDisabled: true });
    assert.deepEqual(nativeLoginExpectation(snapshot(entries)), [...entries].sort());
    assert.deepEqual(nativeLoginExpectation(snapshot([...entries, ['login', 'native named submit']])), [...entries, ['login', 'native named submit']].sort());
    assert.equal(nativeLoginExpectation(snapshot([['username', 'kiwi-view'], ...entries.slice(1)])), null);
    assert.equal(nativeLoginExpectation(snapshot([entries[0], ['password', 'different fixture value'], entries[2]])), null);
    for (const name of ['username', 'password']) {
        assert.equal(nativeLoginExpectation(snapshot(entries.filter(([field]) => field !== name))), null);
        assert.equal(nativeLoginExpectation(snapshot([...entries, entries.find(([field]) => field === name)])), null);
    }
    assert.equal(nativeLoginExpectation({ entries }), null);
    assert.equal(nativeLoginExpectation(snapshot([...entries, ['unexpected non-string', {}]])), null);
});

test('the finite local guard rejects unarmed writes and business endpoints', () => {
    const gate = createOperationalWriteGate();
    assert.equal(gate.take(request()), null);
    for (const pathname of ['/kiwi/api/v1/persons/990901/contact-history', '/kiwi/api/v1/outbox-sessions/990910/reopen', '/kiwi/api/v1/development-feedback/settings']) {
        assert.throws(() => gate.arm('POST', pathname, {}, {}), /reviewed call/);
    }
});

test('an exact fixture can be consumed once and cannot be replayed', () => {
    const gate = createOperationalWriteGate();
    gate.arm('POST', pathname, {}, { onHold: true });
    assert.deepEqual(gate.take(request()).response, { onHold: true });
    assert.equal(gate.take(request()), null);
    assert.deepEqual(gate.pending(), []);
});

test('query, CSRF, content type, method and body changes neither authorize nor consume a fixture', () => {
    const gate = createOperationalWriteGate();
    gate.arm('POST', pathname, {}, { onHold: true });
    for (const changed of [{ search: '?unexpected=1' }, { csrfPresent: false }, { contentType: 'text/plain' },
        { method: 'PUT' }, { payload: { unexpected: true } }, { pathname: pathname + '/extra' }]) {
        assert.equal(gate.take({ ...request(), ...changed }), null);
        assert.equal(gate.pending().length, 1);
    }
    assert.ok(gate.take(request()));
});

test('call-state keys and values must match exactly, independent of JSON property order', () => {
    const gate = createOperationalWriteGate();
    const pathname = '/kiwi/api/v1/call-session';
    gate.arm('PUT', pathname, { customerId: null, active: true, recordingActive: true }, { active: true });
    assert.equal(gate.take({ ...request(), method: 'PUT', pathname, payload: { customerId: 123, active: true, recordingActive: true } }), null);
    assert.equal(gate.take({ ...request(), method: 'PUT', pathname, payload: { customerId: null, active: true, recordingActive: true, extra: false } }), null);
    assert.ok(gate.take({ ...request(), method: 'PUT', pathname, payload: { recordingActive: true, active: true, customerId: null } }));
});

test('source-derived end-call fixture accepts only the reviewed exact forcedByCustomer value', () => {
    const gate = createOperationalWriteGate();
    const pathname = '/kiwi/api/v1/call-session/end';
    gate.arm('POST', pathname, { forcedByCustomer: false }, { call_session: { active: false }, last_call_session: { customerId: null } });
    assert.equal(gate.take({ ...request(), pathname, payload: { forcedByCustomer: true } }), null);
    assert.equal(gate.take({ ...request(), pathname, payload: {} }), null);
    assert.ok(gate.take({ ...request(), pathname, payload: { forcedByCustomer: false } }));
});


test('coarse retry preserves three accepted desktop profiles and permits only the one failed Chromium short tuple', () => {
    const viewport = { width: 390, height: 320 };
    validateAfterViewportPlan('coarse-touch-retry', 'chromium', [viewport]);
    assert.deepEqual(operationalJobs('after', 'coarse-touch-retry', [viewport]), [{ viewport, suite: 'coarse-touch', recordCount: 12 }]);
    for (const [browser, viewports] of [['firefox', [viewport]], ['chromium', [{ width: 1440, height: 1000 }]], ['chromium', [viewport, viewport]]]) {
        assert.throws(() => validateAfterViewportPlan('coarse-touch-retry', browser, viewports));
    }
    assert.throws(() => operationalJobs('before', 'coarse-touch-retry', [viewport]));
});


test('coarse menu diagnostic is one Chromium390short context and cannot widen or rewrite observed geometry', () => {
    const viewport = { width: 390, height: 320 };
    validateAfterViewportPlan('coarse-menu', 'chromium', [viewport]);
    assert.deepEqual(operationalJobs('after', 'coarse-menu', [viewport]), [{ viewport, suite: 'coarse-menu' }]);
    assert.throws(() => validateAfterViewportPlan('coarse-menu', 'firefox', [viewport]));
    assert.throws(() => validateAfterViewportPlan('coarse-menu', 'chromium', [{ width: 1440, height: 1000 }]));
    assert.throws(() => operationalJobs('before', 'coarse-menu', [viewport]));
    const before = { scrollY: 916, menuScrollTop: 0, actions: [{ bounds: { bottom: 328.5 }, focusVisible: false }] };
    assert.equal(coarseMenuGeometryUnchanged(before, structuredClone(before)), true);
    for (const update of [{ scrollY: 920 }, { menuScrollTop: 1 }, { actions: [{ bounds: { bottom: 320 }, focusVisible: false }] },
        { actions: [{ bounds: { bottom: 328.5 }, focusVisible: true }] }]) assert.equal(coarseMenuGeometryUnchanged(before, { ...before, ...update }), false);
});

test('affected-record privacy uses two source-serialized readonly2/12 roots and four genuine person input values without changing the original fixture', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const fixtures = affectedRecordPrivacyFixtures(root);
    assert.deepEqual(fixtures.map(fixture => fixture.recordCount), [2, 12]);
    assert.equal(new Set(fixtures.map(fixture => fixture.suffix)).size, 2);
    for (const fixture of fixtures) {
        assert.equal(fixture.model.version, null); assert.equal(fixture.componentOnly, false);
        assert.ok(Object.values(fixture.model.capabilities.operations).every(operation => !operation.enabled));
        assert.equal(fixture.model.sections.person[0].fields.surName, 'van der');
        assert.equal(fixture.customer.middleName, 'van der');
        assert.equal(fixture.privacySourceInput.surName, 'van der');
        for (const type of ['address', 'email', 'phone', 'mobile', 'bank']) {
            assert.equal(fixture.model.sections[type].length, fixture.recordCount);
            assert.equal(fixture.model.sections[type][1].id, null);
        }
    }
    assert.equal(currentRecordsFixture(root).model.sections.person[0].fields.surName, '');
    for (const browser of ['chromium', 'firefox']) validateAfterViewportPlan('editor-privacy', browser, [{ width: 1440, height: 1000 }]);
    assert.throws(() => validateAfterViewportPlan('editor-privacy', 'chromium', [{ width: 390, height: 1000 }]));
    assert.throws(() => operationalJobs('before', 'editor-privacy', [{ width: 1440, height: 1000 }]));
});

test('affected-record privacy admits exactly two editing reads once and denies wrong tuples detail queries repeats and writes', async () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    for (const [phase, suite, allowed] of [['after', 'editor-privacy', true], ['after', 'summary-correction', false]]) {
        let handler;
        const state = { phase, suite, privacyFixtures: affectedRecordPrivacyFixtures(root), feedbackFixtures: readonlySourceFixtures(),
            baseUrl: new URL('https://bdc.rtvmedia.org.local:9444/kiwi/'), report: { readonlySourceReads: [], deniedRequests: [] } };
        await installOperationalTransport({ route: async (_pattern, value) => { handler = value; } }, state);
        const invoke = async (suffix, method = 'GET') => {
            const result = {};
            await handler({ request: () => ({ url: () => new URL('api/v1/' + suffix, state.baseUrl).href, method: () => method, headers: () => ({}), postDataJSON: () => ({}) }),
                fulfill: async response => { result.response = response; }, abort: async () => { result.aborted = true; }, continue: async () => { result.forwarded = true; } });
            assert.equal(result.forwarded, undefined); return result;
        };
        for (const fixture of state.privacyFixtures) {
            assert.equal((await invoke(fixture.suffix + '&extra=1')).aborted, true);
            assert.equal((await invoke(fixture.detailSuffix)).aborted, true);
            const valid = await invoke(fixture.suffix);
            assert.equal(Boolean(valid.response), allowed);
            assert.equal((await invoke(fixture.suffix)).aborted, true);
            for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await invoke(fixture.suffix, method)).aborted, true);
        }
        assert.equal((await invoke('customer-work-sessions/reset', 'POST')).aborted, true);
        assert.equal(state.report.readonlySourceReads.length, allowed ? 2 : 0);
    }
});


test('corrected menu plan is one source-bound coarse Chromium390short job while old diagnostics stay observational', () => {
    const viewport = { width: 390, height: 320 };
    validateAfterViewportPlan('coarse-menu-correction', 'chromium', [viewport]);
    assert.deepEqual(operationalJobs('after', 'coarse-menu-correction', [viewport]), [{ viewport, suite: 'coarse-menu-correction' }]);
    assert.throws(() => validateAfterViewportPlan('coarse-menu-correction', 'firefox', [viewport]));
    assert.throws(() => validateAfterViewportPlan('coarse-menu-correction', 'chromium', [{ width: 1440, height: 1000 }]));
    assert.throws(() => operationalJobs('before', 'coarse-menu-correction', [viewport]));
});

test('menu correction rejects the actual clipped initial target and keyboard ring even after border and hits recover', () => {
    const action = { bounds: { width: 190, height: 44 }, fullBorderInsideAllClips: true, fullPaintedPerimeterInsideAllClips: true,
        hits: [{ ownTarget: true }, { ownTarget: true }, { ownTarget: true }], focused: false, focusVisible: false, outlineWidth: '3px', outlineOffset: '2px' };
    const initial = { menu: { fullBorderInsideAllClips: true }, actions: [structuredClone(action), structuredClone(action), structuredClone(action)], active: { trigger: true, menuActionIndex: -1 } };
    assert.equal(coarseMenuTargetsAreClear(initial), true);
    const clippedInitial = structuredClone(initial); clippedInitial.actions[2].fullBorderInsideAllClips = false;
    assert.equal(coarseMenuTargetsAreClear(clippedInitial), false);
    const keyboard = structuredClone(initial); keyboard.active = { trigger: false, menuActionIndex: 2 }; keyboard.actions[2].focused = true; keyboard.actions[2].focusVisible = true;
    assert.equal(coarseMenuTargetsAreClear(keyboard, 2), true);
    const oldFinding = structuredClone(keyboard); oldFinding.actions[2].fullPaintedPerimeterInsideAllClips = false;
    assert.equal(coarseMenuTargetsAreClear(oldFinding, 2), false);
    for (const change of [value => { value.actions[2].hits[2].ownTarget = false; }, value => { value.actions[2].bounds.height = 35.48; },
        value => { value.actions[2].outlineOffset = '-2px'; }, value => { value.actions[2].focusVisible = false; }, value => { value.active.menuActionIndex = 1; }]) {
        const invalid = structuredClone(keyboard); change(invalid); assert.equal(coarseMenuTargetsAreClear(invalid, 2), false);
    }
});

test('affected-record privacy blocks both Kiwi API bases before forwarding while retaining exact local reads and one-use editing allowances', async () => {
    const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
    for (const base of ['/kiwi/', '/kiwi-preview/']) {
        const otherBase = base === '/kiwi/' ? '/kiwi-preview/' : '/kiwi/';
        let handler;
        const state = { phase: 'after', suite: 'editor-privacy', baseUrl: new URL('https://bdc.rtvmedia.org.local:9444' + base),
            privacyFixtures: affectedRecordPrivacyFixtures(sourceRoot), feedbackFixtures: [],
            report: { readonlySourceReads: [], deniedRequests: [], outboxReads: [], settingsFixtures: [] } };
        const control = await installOperationalTransport({ route: async (_pattern, value) => { handler = value; } }, state);
        control.mode = 'empty'; control.release();
        const invoke = async (pathname, method = 'GET', origin = state.baseUrl.origin) => {
            const result = {};
            await handler({ request: () => ({ url: () => origin + pathname, method: () => method, headers: () => ({}), postDataJSON: () => ({}) }),
                fulfill: async response => { result.response = response; }, abort: async () => { result.aborted = true; },
                continue: async () => { result.forwarded = true; } });
            return result;
        };
        const denied = async (pathname, method = 'GET', origin) => {
            const result = await invoke(pathname, method, origin);
            assert.equal(result.aborted, true); assert.equal(result.forwarded, undefined); assert.equal(result.response, undefined);
        };
        const localReads = ['bootstrap', 'call-queue', 'call-session', 'agent-status', 'outbox-sessions?limit=20&offset=0',
            'workflows/subscription?limit=20', 'webabo/offers?limit=250', 'development-feedback/settings'];
        for (const suffix of localReads) {
            const result = await invoke(base + 'api/v1/' + suffix);
            assert.ok(result.response); assert.equal(result.forwarded, undefined); assert.equal(result.aborted, undefined);
            await denied(otherBase + 'api/v1/' + suffix);
        }
        for (const apiBase of [base, otherBase]) {
            for (const pathname of [apiBase + 'api', apiBase + 'api/', apiBase + 'api/v1/unknown', apiBase + 'api/v1/unknown?extra=1']) {
                for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']) await denied(pathname, method);
            }
        }
        for (const fixture of state.privacyFixtures) {
            for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']) {
                await denied(otherBase + 'api/v1/' + fixture.suffix, method);
                await denied(otherBase + 'api/v1/' + fixture.detailSuffix, method);
                await denied(otherBase + 'api/v1/' + fixture.suffix + '&extra=1', method);
            }
            for (const method of ['HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']) await denied(base + 'api/v1/' + fixture.suffix, method);
            await denied(base + 'api/v1/' + fixture.detailSuffix);
            await denied(base + 'api/v1/' + fixture.suffix + '&extra=1');
            await denied(base + 'api/v1/' + fixture.suffix, 'GET', 'https://unexpected.example.invalid');
            assert.equal(control.recordReads.has(base + 'api/v1/' + fixture.suffix), false, 'Denied requests must not consume a valid editing allowance.');
            const allowed = await invoke(base + 'api/v1/' + fixture.suffix);
            assert.deepEqual(allowed.response.json, fixture.model); assert.equal(allowed.forwarded, undefined); assert.equal(allowed.aborted, undefined);
            await denied(base + 'api/v1/' + fixture.suffix);
        }
        assert.equal(state.report.readonlySourceReads.length, 2); assert.equal(control.recordReads.size, 2);
        for (const pathname of [base, base + 'login', base + 'auth/callback', base + 'assets/app.js', '/kiwi-oidc/realms/kiwi-local/']) {
            const result = await invoke(pathname);
            assert.equal(result.forwarded, true); assert.equal(result.aborted, undefined); assert.equal(result.response, undefined);
        }
        for (const [phase, suite] of [['before', 'operational'], ['after', 'operational']]) {
            let inherited;
            await installOperationalTransport({ route: async (_pattern, value) => { inherited = value; } },
                { ...state, phase, suite, report: { deniedRequests: [] } });
            let forwarded = false;
            await inherited({ request: () => ({ url: () => state.baseUrl.origin + otherBase + 'api/v1/unknown', method: () => 'GET', headers: () => ({}) }),
                continue: async () => { forwarded = true; }, abort: async () => { throw new Error('Unrelated suite behavior must remain unchanged.'); } });
            assert.equal(forwarded, true);
        }
    }
});


test('genuine readonly opening is limited to the exact Firefox native200 fixture and never another mode role or selector', () => {
 const before={innerWidth:1280,innerHeight:955,outerWidth:1280,outerHeight:1040,dpr:1,pinchScale:1};
 const zoomed={innerWidth:640,innerHeight:478,outerWidth:640,outerHeight:520,dpr:2,pinchScale:1};
 const fixture={id:990970,recordCount:2,componentOnly:false,model:{version:null,capabilities:{operations:Object.fromEntries(['person.update','address.update','email.update','phone.update','mobile.update','bank.update','bank.create','bank.delete'].map(operation=>[operation,{enabled:false}]))}}};
 const state={phase:'after',suite:'native-operational',nativeKernel:{launchEnvironment:{DISPLAY:':96'}},recordFixture:fixture,
  report:{requestedSuite:'native-operational',environment:{browser:'firefox',role:'kiwi-admin'},nativeProof:{before,zoomed}}};
 assert.equal(nativeReadonlyEditorOpeningAllowed(state,'#editCustomerBtn'),true);
 for(const change of [v=>{v.phase='before';},v=>{v.suite='records-after';},v=>{v.report.requestedSuite='input-gates';},v=>{v.report.environment.browser='chromium';},
  v=>{v.report.environment.role='kiwi-view';},v=>{v.nativeKernel=null;},v=>{v.nativeKernel.launchEnvironment.DISPLAY=':95';},v=>{v.recordFixture.componentOnly=true;},
  v=>{v.recordFixture.model.version='fake';},v=>{v.recordFixture.model.capabilities.operations['person.update'].enabled=true;},v=>{v.recordFixture.model.capabilities.operations={};},
  v=>{v.report.nativeProof.zoomed.dpr=1;},v=>{v.report.nativeProof.zoomed.innerWidth=800;}]) {
  const invalid=structuredClone(state);change(invalid);assert.equal(nativeReadonlyEditorOpeningAllowed(invalid,'#editCustomerBtn'),false);
 }
 assert.equal(nativeReadonlyEditorOpeningAllowed(state,'#endCallBtn'),false);
});

test('native physical opening rejects missing or wrong ownership and invalid physical viewport geometry', () => {
 const point={x:530.6083,y:172.4}, event={type:'pointermove',trusted:true,ownsExpectedTarget:true,clientX:530.5,clientY:172.15};
 assert.equal(nativeReadonlyMotionOwnsTarget(event,point),true);
 for(const change of [{trusted:false},{ownsExpectedTarget:false},{type:'click'},{clientX:265},{clientY:86}]) assert.equal(nativeReadonlyMotionOwnsTarget({...event,...change},point),false);
 const viewport={innerWidth:640,innerHeight:478,dpr:2,pinchScale:1};
 assert.deepEqual(physicalClientPoint({x:0,y:0,width:1280,height:1040},viewport,point),{x:1061,y:429,origin:{x:0,y:84}});
 assert.throws(()=>physicalClientPoint({x:0,y:0,width:640,height:520},viewport,point));
 assert.throws(()=>physicalClientPoint({x:0,y:0,width:1280,height:1040},{...viewport,pinchScale:2},point));
});


test('privacy preserves the legitimate hidden native outbox baseline while rejecting open extra or customer-owned baselines', () => {
 const baseline=[{id:'sessionOutboxEditor',tag:'DIALOG',className:'form-lightbox customer-editor',open:false,rendered:false,hasCustomerContext:false,labelledBy:'sessionOutboxEditorTitle'}];
 assert.equal(privacyProductionBaselineIsExact(baseline),true);
 assert.equal(privacyProductionBaselineIsExact([]),false);
 assert.equal(privacyProductionBaselineIsExact([...baseline,...baseline]),false);
 for(const change of [{id:'other'},{open:true},{rendered:true},{hasCustomerContext:true},{tag:'DIV'},{labelledBy:'other'}]) assert.equal(privacyProductionBaselineIsExact([{...baseline[0],...change}]),false);
});

test('privacy public calendar reuses the exact source matcher and serializer locally without opening either API base', async () => {
 const root=fileURLToPath(new URL('../../',import.meta.url)); let handler;
 const state={phase:'after',suite:'editor-privacy',sourceRoot:root,baseUrl:new URL('https://bdc.rtvmedia.org.local:9444/kiwi/'),report:{readonlySourceReads:[],deniedRequests:[]}};
 await installOperationalTransport({route:async(_pattern,value)=>{handler=value;}},state);
 const invoke=async(suffix,method='GET')=>{const result={};await handler({request:()=>({url:()=>new URL(suffix,state.baseUrl).href,method:()=>method,headers:()=>({}),postDataJSON:()=>({})}),fulfill:async response=>{result.response=response;},abort:async()=>{result.aborted=true;},continue:async()=>{result.forwarded=true;}});assert.equal(result.forwarded,undefined);return result;};
 for(const suffix of ['api/v1/catalog/delivery-calendar','api/v1/catalog/delivery-calendar?year=2026&month=13','api/v1/catalog/delivery-calendar?year=bad&month=11','api/v1/catalog/delivery-calendar?year=2026&month=11&extra=1','/kiwi-preview/api/v1/catalog/delivery-calendar?year=2026&month=11'])assert.equal((await invoke(suffix)).aborted,true);
 assert.equal((await invoke('api/v1/catalog/delivery-calendar?year=2026&month=11','POST')).aborted,true);
 for(let index=0;index<4;index++) {const result=await invoke('api/v1/catalog/delivery-calendar?year=2026&month=11');assert.equal(result.response.json.year,2026);assert.equal(result.response.json.month,11);}
 assert.equal((await invoke('api/v1/catalog/delivery-calendar?year=2026&month=11')).aborted,true);
 assert.equal(state.report.privacyCalendarReads.length,4);assert.equal(state.report.readonlySourceReads.length,0);
});
