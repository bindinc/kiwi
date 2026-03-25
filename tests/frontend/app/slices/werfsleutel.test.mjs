import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    __resetWerfsleutelSliceForTests,
    detectDurationKeyFromTitle,
    extractDurationLabelFromTitle,
    getWerfsleutelOfferDetails,
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
        querySelectorAll() {
            return [];
        }
    };
}

function installWerfsleutelDomHarness(locale = 'nl') {
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
    globalThis.showToast = () => {};

    return elements;
}

function createWerfsleutelActionHarness() {
    const router = createActionRouter({
        root: {
            addEventListener() {},
            removeEventListener() {}
        },
        eventTypes: ['click']
    });
    registerWerfsleutelActions(router);

    function dispatchClick(actionName, args = {}) {
        const dataset = { action: actionName };
        for (const [key, value] of Object.entries(args)) {
            const datasetKey = `arg${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            dataset[datasetKey] = String(value);
        }

        const actionElement = {
            dataset
        };

        router.dispatch({
            type: 'click',
            target: {
                closest() {
                    return actionElement;
                }
            },
            preventDefault() {},
            stopPropagation() {}
        });
    }

    return { dispatchClick };
}

function testSummaryHeaderStatesAndCardTerminology() {
    __resetWerfsleutelSliceForTests();
    const elements = installWerfsleutelDomHarness('nl');
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
    const elements = installWerfsleutelDomHarness('nl');
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
    const elements = installWerfsleutelDomHarness('en');
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
    console.log('werfsleutel slice tests passed');
}

run();
