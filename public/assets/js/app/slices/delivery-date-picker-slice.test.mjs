import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import { formatDateInputValue, registerDeliveryDatePickerSlice } from './delivery-date-picker-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'keydown', 'submit']
    });
}

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        }
    };
}

function testRegistersDeliveryDatePickerActions() {
    const router = createRouter();
    registerDeliveryDatePickerSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'select-recommended-delivery-date',
        'navigate-delivery-calendar',
        'select-delivery-date'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }

    assert.equal(typeof globalThis.kiwiDeliveryDatePickerSlice, 'object');
    assert.equal(typeof globalThis.kiwiDeliveryDatePickerSlice.initDeliveryDatePicker, 'function');
    assert.equal(typeof globalThis.kiwiDeliveryDatePickerSlice.navigateCalendar, 'function');
    assert.equal(typeof globalThis.kiwiDeliveryDatePickerSlice.selectDeliveryDateByString, 'function');
    assert.equal(typeof globalThis.initDeliveryDatePicker, 'function');
    assert.equal(typeof globalThis.navigateCalendar, 'function');
    assert.equal(typeof globalThis.selectDeliveryDateByString, 'function');
}

function testFormatDateInputValueUsesLocalDateParts() {
    const date = new Date(2024, 0, 5);
    assert.equal(formatDateInputValue(date), '2024-01-05');
}

function testSelectDeliveryDateByStringUpdatesInputs() {
    const previousDocument = globalThis.document;

    const hiddenInput = { value: '' };
    const displayDiv = {
        textContent: '',
        classList: createClassList()
    };
    const calendarDiv = {
        style: {},
        classList: createClassList(['is-open'])
    };

    try {
        globalThis.document = {
            getElementById(elementId) {
                if (elementId === 'articleDesiredDelivery') {
                    return hiddenInput;
                }
                if (elementId === 'deliveryDateDisplay') {
                    return displayDiv;
                }
                if (elementId === 'deliveryCalendar') {
                    return calendarDiv;
                }
                return null;
            }
        };

        globalThis.kiwiDeliveryDatePickerSlice.selectDeliveryDateByString('2024-01-05');

        assert.equal(hiddenInput.value, '2024-01-05');
        assert.equal(displayDiv.textContent, 'Vrijdag 5 januari');
        assert.equal(displayDiv.classList.contains('selected'), true);
        assert.equal(calendarDiv.style.display, 'none');
        assert.equal(calendarDiv.classList.contains('is-open'), false);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

function run() {
    testRegistersDeliveryDatePickerActions();
    testFormatDateInputValueUsesLocalDateParts();
    testSelectDeliveryDateByStringUpdatesInputs();
    console.log('delivery date picker slice tests passed');
}

run();
