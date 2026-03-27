import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    __resetDeliveryDatePickerForTests,
    configureDeliveryDatePickerRuntimeForTests,
    formatDateInputValue,
    initDeliveryDatePicker,
    registerDeliveryDatePickerSlice,
    selectNextWeek
} from '../../../../assets/js/app/slices/delivery-date-picker-slice.js';

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

async function testInitDeliveryDatePickerUsesControlledTodayAndRecommendedDate() {
    __resetDeliveryDatePickerForTests();
    configureDeliveryDatePickerRuntimeForTests({
        nowDate: () => new Date('2026-02-10T09:00:00Z')
    });

    const requestedUrls = [];
    const hiddenInput = { value: '' };
    const displayParent = { replaceChild() {} };
    const displayDiv = {
        textContent: '',
        classList: createClassList(),
        cloneNode() {
            return this;
        },
        addEventListener() {},
        parentNode: displayParent
    };
    const calendarDiv = {
        style: {},
        classList: createClassList()
    };
    const container = {
        contains() {
            return false;
        }
    };
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const previousKiwiApi = globalThis.kiwiApi;

    try {
        globalThis.document = {
            getElementById(elementId) {
                if (elementId === 'deliveryDatePickerContainer') {
                    return container;
                }
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
            },
            addEventListener() {}
        };
        globalThis.window = {
            document: globalThis.document,
            addEventListener() {}
        };
        globalThis.window.kiwiApi = {
            async get(url) {
                requestedUrls.push(url);
                return { recommendedDate: '2026-02-12', days: [], monthLabel: 'februari 2026' };
            }
        };
        globalThis.kiwiApi = globalThis.window.kiwiApi;

        await initDeliveryDatePicker();

        assert.deepEqual(requestedUrls, ['/api/v1/catalog/delivery-calendar?year=2026&month=2']);
        assert.equal(hiddenInput.value, '2026-02-12');
        assert.equal(displayDiv.textContent, 'Donderdag 12 februari');
    } finally {
        __resetDeliveryDatePickerForTests();
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
        if (previousWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = previousWindow;
        }
        if (previousKiwiApi === undefined) {
            delete globalThis.kiwiApi;
        } else {
            globalThis.kiwiApi = previousKiwiApi;
        }
    }
}

async function testSelectNextWeekScansAcrossMonthBoundaryFromControlledToday() {
    __resetDeliveryDatePickerForTests();
    configureDeliveryDatePickerRuntimeForTests({
        nowDate: () => new Date('2026-01-28T09:00:00Z')
    });

    const hiddenInput = { value: '' };
    const displayDiv = {
        textContent: '',
        classList: createClassList()
    };
    const calendarDiv = {
        style: {},
        classList: createClassList(['is-open'])
    };
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const previousKiwiApi = globalThis.kiwiApi;

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
        globalThis.window = {
            document: globalThis.document,
            kiwiApi: {
                async get(url) {
                    if (!url.includes('year=2026&month=2')) {
                        throw new Error(`unexpected url ${url}`);
                    }

                    return {
                        recommendedDate: null,
                        monthLabel: 'februari 2026',
                        days: [
                            { date: '2026-02-03', available: false },
                            { date: '2026-02-04', available: true }
                        ]
                    };
                }
            }
        };
        globalThis.kiwiApi = globalThis.window.kiwiApi;

        await selectNextWeek();

        assert.equal(hiddenInput.value, '2026-02-04');
        assert.equal(displayDiv.textContent, 'Woensdag 4 februari');
    } finally {
        __resetDeliveryDatePickerForTests();
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
        if (previousWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = previousWindow;
        }
        if (previousKiwiApi === undefined) {
            delete globalThis.kiwiApi;
        } else {
            globalThis.kiwiApi = previousKiwiApi;
        }
    }
}

function run() {
    __resetDeliveryDatePickerForTests();
    testRegistersDeliveryDatePickerActions();
    testFormatDateInputValueUsesLocalDateParts();
    testSelectDeliveryDateByStringUpdatesInputs();
    return Promise.resolve()
        .then(testInitDeliveryDatePickerUsesControlledTodayAndRecommendedDate)
        .then(testSelectNextWeekScansAcrossMonthBoundaryFromControlledToday)
        .then(() => {
            console.log('delivery date picker slice tests passed');
        });
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
