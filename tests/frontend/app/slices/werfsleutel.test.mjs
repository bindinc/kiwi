import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    __setWerfsleutelCatalogSyncStateForTests,
    __resetWerfsleutelSliceForTests,
    configureWerfsleutelRuntimeForTests,
    detectDurationKeyFromTitle,
    extractDurationLabelFromTitle,
    getWerfsleutelOfferDetails,
    handleWerfsleutelQuery,
    isWerfsleutelBarcodeQuery,
    registerWerfsleutelActions
} from '../../../../assets/js/app/slices/werfsleutel.js';

function testBarcodeDetection() {
    assert.equal(isWerfsleutelBarcodeQuery('8712345'), true);
    assert.equal(isWerfsleutelBarcodeQuery(' 8712345 '), true);
    assert.equal(isWerfsleutelBarcodeQuery('AVRV525'), false);
    assert.equal(isWerfsleutelBarcodeQuery('12345'), false);
}

function testDurationDetection() {
    assert.equal(detectDurationKeyFromTitle('Avrobode 2 jaar actie'), '2-jaar');
    assert.equal(detectDurationKeyFromTitle('Mikrogids 24 nummers per maand'), '2-jaar-maandelijks');
    assert.equal(detectDurationKeyFromTitle('ncrv proef 12'), '1-jaar');
    assert.equal(detectDurationKeyFromTitle('onbekend aanbod'), null);
}

function testDurationLabelExtraction() {
    assert.equal(extractDurationLabelFromTitle('Actie 3 jaar geldig'), '3 jaar');
    assert.equal(extractDurationLabelFromTitle('Looptijd 6 maanden'), '6 maanden');
    assert.equal(extractDurationLabelFromTitle(''), 'Looptijd onbekend');
}

function testOfferDetails() {
    const knownMagazineDetails = getWerfsleutelOfferDetails({
        title: 'Avrobode 2 jaar maandelijks korting'
    });
    assert.equal(knownMagazineDetails.magazine, 'Avrobode');
    assert.equal(knownMagazineDetails.durationKey, '2-jaar-maandelijks');
    assert.equal(knownMagazineDetails.durationLabel, '2 jaar - Maandelijks betaald');

    const derivedMagazineDetails = getWerfsleutelOfferDetails({
        title: 'ncrv proef 12 nummers'
    });
    assert.equal(derivedMagazineDetails.magazine, 'Ncrvgids');
    assert.equal(derivedMagazineDetails.durationKey, '1-jaar');
}

function testActionRegistrationAndBridgeApi() {
    const listeners = {};
    const root = {
        addEventListener(eventType, handler) {
            listeners[eventType] = handler;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        }
    };

    const router = createActionRouter({
        root,
        eventTypes: ['input', 'keydown', 'click']
    });
    registerWerfsleutelActions(router);

    const expectedActions = [
        'handle-werfsleutel-input',
        'reset-werfsleutel-picker',
        'select-werfsleutel',
        'select-werfsleutel-channel',
        'toggle-subscription-offer',
        'remove-subscription-offer'
    ];
    assert.deepEqual(
        router.getRegisteredActions().slice().sort(),
        expectedActions.slice().sort()
    );

    assert.equal(typeof globalThis.kiwiWerfsleutelSlice, 'object');
    assert.equal(typeof globalThis.kiwiWerfsleutelSlice.getSelections, 'function');
    assert.equal(typeof globalThis.kiwiWerfsleutelSlice.getSelection, 'function');
    assert.equal(typeof globalThis.kiwiWerfsleutelSlice.getOfferDetails, 'function');
    assert.deepEqual(globalThis.kiwiWerfsleutelSlice.getSelections(), []);
}

function createMockElement(overrides = {}) {
    const classNames = new Set(overrides.classNames || []);

    return {
        value: overrides.value || '',
        innerHTML: overrides.innerHTML || '',
        textContent: overrides.textContent || '',
        style: overrides.style || {},
        dataset: overrides.dataset || {},
        attributes: {},
        classList: {
            add(...names) {
                names.forEach((name) => classNames.add(name));
            },
            remove(...names) {
                names.forEach((name) => classNames.delete(name));
            },
            contains(name) {
                return classNames.has(name);
            }
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        getAttribute(name) {
            return this.attributes[name];
        },
        removeAttribute(name) {
            delete this.attributes[name];
        },
        querySelector(selector) {
            if (typeof selector === 'string' && selector.startsWith('#werfsleutelOption-')) {
                return {
                    id: selector.slice(1),
                    scrollIntoView() {}
                };
            }
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

function installWerfsleutelDomHarness(locale = 'nl') {
    const toasts = [];
    const elements = {
        werfsleutelInput: createMockElement(),
        werfsleutelSuggestions: createMockElement(),
        werfsleutelSummary: createMockElement(),
        subscriptionOfferSelections: createMockElement()
    };

    const translationsByLocale = {
        nl: {
            'werfsleutel.noOffersSelected': 'Nog geen aanbiedingen toegevoegd',
            'werfsleutel.selectionCountSingle': '1 product toegevoegd',
            'werfsleutel.selectionCountMultiple': '{count} producten toegevoegd',
            'werfsleutel.summaryStatusOpen': '{count}/{total} open',
            'werfsleutel.summaryStatusComplete': '{count}/{total} compleet',
            'werfsleutel.summaryLeadPendingSingle': 'Nog 1 kanaalcombinatie kiezen.',
            'werfsleutel.summaryLeadPendingMultiple': 'Nog {count} kanaalcombinaties kiezen.',
            'werfsleutel.summaryLeadComplete': 'Alle kanaalcombinaties zijn gekozen.',
            'werfsleutel.summaryHintPending': 'Kies hieronder per product de juiste combinatie.',
            'werfsleutel.summaryHintComplete': 'Alle producten zijn compleet ingesteld.',
            'werfsleutel.channelSelected': 'Compleet',
            'werfsleutel.channelRequiredHint': 'Open'
        },
        en: {
            'werfsleutel.noOffersSelected': 'No products added yet',
            'werfsleutel.selectionCountSingle': '1 product added',
            'werfsleutel.selectionCountMultiple': '{count} products added',
            'werfsleutel.summaryStatusOpen': '{count}/{total} open',
            'werfsleutel.summaryStatusComplete': '{count}/{total} complete',
            'werfsleutel.summaryLeadPendingSingle': '1 channel combination left to choose.',
            'werfsleutel.summaryLeadPendingMultiple': '{count} channel combinations left to choose.',
            'werfsleutel.summaryLeadComplete': 'All channel combinations are selected.',
            'werfsleutel.summaryHintPending': 'Choose the correct combination per product below.',
            'werfsleutel.summaryHintComplete': 'All products are fully configured.',
            'werfsleutel.channelSelected': 'Complete',
            'werfsleutel.channelRequiredHint': 'Open'
        }
    };

    globalThis.document = {
        documentElement: {
            lang: locale
        },
        getElementById(id) {
            return elements[id] || null;
        }
    };
    globalThis.i18n = {
        getLocale() {
            return locale;
        },
        t(key) {
            const localeTranslations = translationsByLocale[locale] || {};
            return localeTranslations[key] || key;
        }
    };
    globalThis.showToast = (message, type) => {
        toasts.push({ message, type });
    };
    globalThis.kiwiBasePath = '/kiwi';
    globalThis.kiwiAssetPaths = {
        avrotrosLogo: '/assets/img/avrotros-logo.svg',
        kroncrvLogo: '/assets/img/kroncrv-logo.svg'
    };

    return { elements, toasts };
}

function createWerfsleutelActionHarness() {
    const router = createActionRouter({
        root: {
            addEventListener() {},
            removeEventListener() {}
        },
        eventTypes: ['click', 'input']
    });
    registerWerfsleutelActions(router);

    function dispatchAction(eventType, actionName, args = {}, value = '') {
        const dataset = { action: actionName };
        for (const [key, value] of Object.entries(args)) {
            const datasetKey = `arg${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            dataset[datasetKey] = String(value);
        }

        const actionElement = {
            dataset,
            value
        };

        router.dispatch({
            type: eventType,
            target: {
                closest() {
                    return actionElement;
                }
            },
            preventDefault() {},
            stopPropagation() {}
        });
    }

    function dispatchClick(actionName, args = {}) {
        dispatchAction('click', actionName, args);
    }

    function dispatchInput(actionName, value, args = {}) {
        dispatchAction('input', actionName, args, value);
    }

    return { dispatchClick, dispatchInput };
}

function testSummaryHeaderStatesAndCardTerminology() {
    __resetWerfsleutelSliceForTests();
    const { elements } = installWerfsleutelDomHarness('nl');
    const { dispatchClick } = createWerfsleutelActionHarness();

    globalThis.kiwiWerfsleutelSlice.setCatalogMetadata({
        catalog: [
            {
                salesCode: 'AV1',
                title: 'Avrobode 1 jaar',
                price: 52,
                allowedChannels: ['OL', 'TM/IB'],
                isActive: true
            }
        ]
    });

    dispatchClick('select-werfsleutel', { salesCode: 'AV1' });
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('1 product toegevoegd'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('1/1 open'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('Nog 1 kanaalcombinatie kiezen.'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('Kies hieronder per product de juiste combinatie.'), true);
    assert.equal(elements.subscriptionOfferSelections.innerHTML.includes('>Open<'), true);

    dispatchClick('select-werfsleutel-channel', { salesCode: 'AV1', combinationKey: 'OL' });
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('1/1 compleet'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('Alle kanaalcombinaties zijn gekozen.'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('Alle producten zijn compleet ingesteld.'), true);
    assert.equal(elements.subscriptionOfferSelections.innerHTML.includes('>Compleet<'), false);
    assert.equal(elements.subscriptionOfferSelections.innerHTML.includes('subscription-offer-channel-code'), true);
    assert.equal(elements.subscriptionOfferSelections.innerHTML.includes('>Open<'), false);
}

function testPluralSummaryAndFirstIncompleteStaysExpanded() {
    __resetWerfsleutelSliceForTests();
    const { elements } = installWerfsleutelDomHarness('nl');
    const { dispatchClick } = createWerfsleutelActionHarness();

    globalThis.kiwiWerfsleutelSlice.setCatalogMetadata({
        catalog: [
            {
                salesCode: 'AV1',
                title: 'Avrobode 1 jaar',
                price: 52,
                allowedChannels: ['OL'],
                isActive: true
            },
            {
                salesCode: 'MI2',
                title: 'Mikrogids 2 jaar',
                price: 98,
                allowedChannels: ['OL', 'TM/IB'],
                isActive: true
            }
        ]
    });

    dispatchClick('select-werfsleutel', { salesCode: 'AV1' });
    dispatchClick('select-werfsleutel', { salesCode: 'MI2' });

    assert.equal(elements.werfsleutelSummary.innerHTML.includes('2 producten toegevoegd'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('1/2 open'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('Nog 1 kanaalcombinatie kiezen.'), true);

    dispatchClick('toggle-subscription-offer', { salesCode: 'MI2' });
    assert.match(
        elements.subscriptionOfferSelections.innerHTML,
        /class="subscription-offer-toggle"[\s\S]*?data-arg-sales-code="MI2"[\s\S]*?aria-expanded="true"/
    );
}

function testEnglishSingularAndPluralSummaryCopy() {
    __resetWerfsleutelSliceForTests();
    const { elements } = installWerfsleutelDomHarness('en');
    const { dispatchClick } = createWerfsleutelActionHarness();

    globalThis.kiwiWerfsleutelSlice.setCatalogMetadata({
        catalog: [
            {
                salesCode: 'AV1',
                title: 'Avrobode 1 year',
                price: 52,
                allowedChannels: ['OL', 'TM/IB'],
                isActive: true
            },
            {
                salesCode: 'MI2',
                title: 'Mikrogids 2 years',
                price: 98,
                allowedChannels: ['OL', 'TM/IB'],
                isActive: true
            }
        ]
    });

    dispatchClick('select-werfsleutel', { salesCode: 'AV1' });
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('1 product added'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('1/1 open'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('1 channel combination left to choose.'), true);

    dispatchClick('select-werfsleutel', { salesCode: 'MI2' });
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('2 products added'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('2/2 open'), true);
    assert.equal(elements.werfsleutelSummary.innerHTML.includes('2 channel combinations left to choose.'), true);
}

function testSelectingOfferDoesNotShowSuccessToast() {
    __resetWerfsleutelSliceForTests();
    const { toasts } = installWerfsleutelDomHarness('nl');
    const { dispatchClick } = createWerfsleutelActionHarness();

    globalThis.kiwiWerfsleutelSlice.setCatalogMetadata({
        catalog: [
            {
                salesCode: 'AV1',
                title: 'Avrobode 1 jaar',
                price: 52,
                allowedChannels: ['OL', 'TM/IB'],
                isActive: true
            }
        ]
    });

    dispatchClick('select-werfsleutel', { salesCode: 'AV1' });

    assert.deepEqual(toasts, []);
}

function testWerfsleutelMandantBadgesUseLogoBranding() {
    __resetWerfsleutelSliceForTests();
    const { elements } = installWerfsleutelDomHarness('nl');
    const { dispatchClick, dispatchInput } = createWerfsleutelActionHarness();

    globalThis.kiwiWerfsleutelSlice.setCatalogMetadata({
        catalog: [
            {
                salesCode: 'TVK1',
                title: 'TV Krant 1 jaar',
                price: 52,
                allowedChannels: ['OL'],
                isActive: true,
                mandant: 'HMC'
            },
            {
                salesCode: 'KRO1',
                title: 'KRO Magazine 1 jaar',
                price: 52,
                allowedChannels: ['OL'],
                isActive: true,
                mandant: 'KRONCRV'
            },
            {
                salesCode: 'UNK1',
                title: 'Onbekend aanbod',
                price: 52,
                allowedChannels: ['OL'],
                isActive: true
            }
        ]
    });

    dispatchInput('handle-werfsleutel-input', 'TV Krant');
    assert.equal(elements.werfsleutelSuggestions.innerHTML.includes('avrotros-logo.svg'), true);
    assert.equal(elements.werfsleutelSuggestions.innerHTML.includes('alt="AVROTROS"'), true);

    dispatchInput('handle-werfsleutel-input', 'Onbekend');
    assert.equal(elements.werfsleutelSuggestions.innerHTML.includes('avrotros-logo.svg'), false);
    assert.equal(elements.werfsleutelSuggestions.innerHTML.includes('kroncrv-logo.svg'), false);

    dispatchClick('select-werfsleutel', { salesCode: 'TVK1' });
    dispatchClick('select-werfsleutel', { salesCode: 'KRO1' });

    assert.equal(elements.subscriptionOfferSelections.innerHTML.includes('avrotros-logo.svg'), true);
    assert.equal(elements.subscriptionOfferSelections.innerHTML.includes('kroncrv-logo.svg'), true);
}

function testDebouncedQueryUsesInjectedTimer() {
    __resetWerfsleutelSliceForTests();
    installWerfsleutelDomHarness('nl');

    const scheduledTimers = [];
    configureWerfsleutelRuntimeForTests({
        setTimeout(callback, timeout) {
            scheduledTimers.push({ callback, timeout });
            return scheduledTimers.length;
        }
    });

    handleWerfsleutelQuery('tv');

    assert.equal(scheduledTimers.length, 1);
    assert.equal(scheduledTimers[0].timeout, 180);
}

async function testCatalogTtlUsesInjectedClock() {
    __resetWerfsleutelSliceForTests();
    installWerfsleutelDomHarness('nl');

    let fetchCount = 0;
    let nowMs = 1_000_000;
    const seededCatalog = [
        {
            salesCode: 'TVK1',
            title: 'TV Krant 1 jaar',
            price: 52,
            allowedChannels: ['OL'],
            isActive: true
        }
    ];
    globalThis.kiwiApi = {
        async get() {
            fetchCount += 1;
            return { items: seededCatalog };
        }
    };

    configureWerfsleutelRuntimeForTests({
        nowMs: () => nowMs
    });

    await globalThis.kiwiWerfsleutelSlice.ensureLoaded();
    assert.equal(fetchCount, 1);

    __setWerfsleutelCatalogSyncStateForTests({
        catalog: seededCatalog,
        catalogSyncedAt: nowMs
    });

    nowMs += (15 * 60 * 1000) - 1;
    await globalThis.kiwiWerfsleutelSlice.ensureLoaded();
    assert.equal(fetchCount, 1);
}

function run() {
    __resetWerfsleutelSliceForTests();
    testBarcodeDetection();
    testDurationDetection();
    testDurationLabelExtraction();
    testOfferDetails();
    testActionRegistrationAndBridgeApi();
    testSummaryHeaderStatesAndCardTerminology();
    testPluralSummaryAndFirstIncompleteStaysExpanded();
    testEnglishSingularAndPluralSummaryCopy();
    testSelectingOfferDoesNotShowSuccessToast();
    testWerfsleutelMandantBadgesUseLogoBranding();
    testDebouncedQueryUsesInjectedTimer();
    return Promise.resolve()
        .then(testCatalogTtlUsesInjectedClock)
        .then(() => {
            console.log('werfsleutel slice tests passed');
        });
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
