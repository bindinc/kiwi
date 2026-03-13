import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import {
    __resetWerfsleutelSliceForTests,
    detectDurationKeyFromTitle,
    extractDurationLabelFromTitle,
    getWerfsleutelOfferDetails,
    isWerfsleutelBarcodeQuery,
    registerWerfsleutelActions
} from './werfsleutel.js';

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
        'select-werfsleutel-channel'
    ];
    assert.deepEqual(
        router.getRegisteredActions().slice().sort(),
        expectedActions.slice().sort()
    );

    assert.equal(typeof globalThis.kiwiWerfsleutelSlice, 'object');
    assert.equal(typeof globalThis.kiwiWerfsleutelSlice.getSelection, 'function');
    assert.equal(typeof globalThis.kiwiWerfsleutelSlice.getOfferDetails, 'function');
}

function run() {
    __resetWerfsleutelSliceForTests();
    testBarcodeDetection();
    testDurationDetection();
    testDurationLabelExtraction();
    testOfferDetails();
    testActionRegistrationAndBridgeApi();
    console.log('werfsleutel slice tests passed');
}

run();
