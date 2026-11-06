import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    __resetDeliveryDatePickerForTests,
    configureDeliveryDatePickerRuntimeForTests,
    closeCalendar,
    formatDateInputValue,
    generateCalendar,
    initDeliveryDatePicker,
    navigateCalendar,
    openCalendar,
    registerDeliveryDatePickerSlice,
    selectRecommendedDate,
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

async function withCalendarFixture(runTest, recommendedDate = '2026-02-12') {
    const previous = { document: globalThis.document, window: globalThis.window, kiwiApi: globalThis.kiwiApi };
    __resetDeliveryDatePickerForTests();
    configureDeliveryDatePickerRuntimeForTests({ nowDate: () => new Date(2026, 1, 10, 12) });
    const requestedUrls = [];
    const hiddenInput = { value: '' };
    const display = {
        textContent: '', classList: createClassList(), attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        querySelector() { return null; },
        focus() { documentRef.activeElement = this; }
    };
    const calendar = {
        innerHTML: '', style: {}, classList: createClassList(['is-open']),
        setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; },
        getBoundingClientRect() { return { x: 0, y: 100, top: 100, left: 0, right: 320, bottom: 500, width: 320, height: 400 }; }
    };
    const documentRef = {
        activeElement: null,
        getElementById(id) {
            return { articleDesiredDelivery: hiddenInput, deliveryDateDisplay: display, deliveryCalendar: calendar }[id] || null;
        }
    };
    const api = {
        async get(url) {
            requestedUrls.push(url);
            const query = new URL(url, 'https://example.invalid').searchParams;
            const year = Number(query.get('year'));
            const month = Number(query.get('month'));
            const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => {
                const day = index + 1;
                return {
                    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                    day, title: `Day ${day}`, weekdayShort: 'day', available: day !== 13, past: day < 10 || day === 14
                };
            });
            return { recommendedDate, monthLabel: `${year}-${month}`, days };
        }
    };
    try {
        globalThis.document = documentRef;
        globalThis.window = { document: documentRef, kiwiApi: api };
        globalThis.kiwiApi = api;
        await runTest({ hiddenInput, display, calendar, requestedUrls, api, documentRef });
    } finally {
        __resetDeliveryDatePickerForTests();
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete globalThis[name];
            else globalThis[name] = value;
        }
    }
}

async function testRenderedCalendarUsesNativeButtonsAndOneTabStop() {
    await withCalendarFixture(async ({ calendar }) => {
        await generateCalendar(new Date(2026, 1, 1));
        const dayButtons = [...calendar.innerHTML.matchAll(/<button\b[^>]*class="[^"]*delivery-day-cell[^\"]*"[^>]*>/g)].map(match => match[0]);
        assert.equal(dayButtons.length, 28, 'every calendar date is a native button');
        assert.equal(dayButtons.filter(markup => /tabindex="0"/.test(markup)).length, 1, 'one date participates in Tab order');
        const unavailable = dayButtons.find(markup => markup.includes('2026-02-13'));
        assert.match(unavailable, /aria-disabled="true"/, 'unavailable dates remain inspectable but not activatable');
        assert.doesNotMatch(unavailable, /\sdisabled(?:\s|=|>)/, 'native disabled would remove unavailable dates from arrow navigation');
        assert.doesNotMatch(calendar.innerHTML, /class="(?:day-name|day-badge)/, 'calendar avoids repeated weekday labels and per-date badges');
    });
}

async function testDateActivationRejectsUnavailablePastAndUnrenderedDays() {
    await withCalendarFixture(async ({ hiddenInput }) => {
        const router = createRouter();
        registerDeliveryDatePickerSlice(router);
        await generateCalendar(new Date(2026, 1, 1));
        function activate(date) {
            const element = {
                dataset: { action: 'select-delivery-date', actionEvent: 'click,keydown', argDate: date },
                closest() { return this; },
                getAttribute() { return null; }
            };
            router.dispatch({ type: 'click', target: element, preventDefault() {}, stopPropagation() {} });
        }
        for (const date of ['2026-02-13', '2026-02-14', '2026-03-01', 'not-a-date']) {
            activate(date);
            assert.equal(hiddenInput.value, '', `${date} must not bypass server availability`);
        }
        activate('2026-02-15');
        assert.equal(hiddenInput.value, '2026-02-15');
    });
}

async function testEarliestUsesServerRecommendationAfterMonthNavigation() {
    await withCalendarFixture(async ({ hiddenInput, requestedUrls }) => {
        await generateCalendar(new Date(2026, 1, 1));
        await navigateCalendar(2);
        await selectRecommendedDate();
        assert.equal(hiddenInput.value, '2026-03-02', 'earliest is the API recommendation, not the first day of the viewed month');
        assert.ok(requestedUrls.some(url => url.includes('year=2026&month=4')), 'calendar navigated to April');
    }, '2026-03-02');
}

async function testOlderCalendarResponseCannotReplaceNewerMonth() {
    await withCalendarFixture(async ({ calendar, api }) => {
        const respond = new Map();
        const getPayload = api.get;
        api.get = url => new Promise(resolve => {
            respond.set(url, async () => resolve(await getPayload(url)));
        });
        const older = generateCalendar(new Date(2026, 0, 1));
        const newer = generateCalendar(new Date(2026, 1, 1));
        await respond.get('/api/v1/catalog/delivery-calendar?year=2026&month=2')();
        await newer;
        const newerMarkup = calendar.innerHTML;
        assert.match(newerMarkup, /2026-02-12/);
        await respond.get('/api/v1/catalog/delivery-calendar?year=2026&month=1')();
        await older;
        assert.equal(calendar.innerHTML, newerMarkup, 'late January response must not replace February');
    });
}

async function testClosingDuringLoadDoesNotReopenOrStealFocus() {
    await withCalendarFixture(async ({ calendar, display, api, documentRef }) => {
        let respond;
        const getPayload = api.get;
        api.get = url => new Promise(resolve => {
            respond = async () => resolve(await getPayload(url));
        });
        const opening = openCalendar();
        assert.equal(calendar.classList.contains('is-open'), true, 'loading calendar can be dismissed');
        closeCalendar();
        const dismissedMarkup = calendar.innerHTML;
        assert.equal(documentRef.activeElement, display);
        await respond();
        await opening;
        assert.equal(calendar.classList.contains('is-open'), false);
        assert.equal(display.getAttribute('aria-expanded'), 'false');
        assert.equal(calendar.innerHTML, dismissedMarkup, 'dismissed load must not render late content');
        assert.equal(documentRef.activeElement, display, 'late response must not move focus back into the calendar');
    });
}

async function testDismissedOpeningCannotStealFocusFromReopenedCalendar() {
    await withCalendarFixture(async ({ calendar, api, documentRef }) => {
        const respond = [];
        const getPayload = api.get;
        api.get = url => new Promise(resolve => {
            respond.push(async () => resolve(await getPayload(url)));
        });
        calendar.focus = () => { documentRef.activeElement = calendar; };
        calendar.querySelectorAll = () => [...calendar.innerHTML.matchAll(/data-arg-date="([\d-]+)"/g)].map(([, date]) => ({
            dataset: { argDate: date },
            focus() { documentRef.activeElement = this; }
        }));
        const dismissedOpening = openCalendar();
        closeCalendar();
        const currentOpening = openCalendar();
        await respond[1]();
        await currentOpening;
        const currentFocus = documentRef.activeElement;
        assert.ok(currentFocus?.dataset.argDate, 'reopened calendar focuses its date');
        const currentMarkup = calendar.innerHTML;
        await respond[0]();
        await dismissedOpening;
        assert.equal(calendar.innerHTML, currentMarkup);
        assert.equal(documentRef.activeElement, currentFocus, 'old opening must not move focus to the calendar container');
        assert.equal(calendar.classList.contains('is-open'), true);
    });
}

async function testDismissedNavigationCannotStealFocusFromReopenedCalendar() {
    await withCalendarFixture(async ({ calendar, api, documentRef }) => {
        await generateCalendar(new Date(2026, 1, 1));
        const respond = [];
        const getPayload = api.get;
        api.get = url => new Promise(resolve => {
            respond.push(async () => resolve(await getPayload(url)));
        });
        const dayFocus = { dataset: { argDate: '2026-03-10' } };
        const navigationFocus = { dataset: { argDirection: '1' } };
        calendar.contains = element => element === dayFocus;
        calendar.querySelectorAll = () => [{ ...dayFocus, focus() { documentRef.activeElement = dayFocus; } }];
        calendar.querySelector = () => ({ focus() { documentRef.activeElement = navigationFocus; } });
        documentRef.activeElement = dayFocus;
        const dismissedNavigation = navigateCalendar(1);
        closeCalendar();
        const currentOpening = openCalendar();
        await respond[1]();
        await currentOpening;
        assert.equal(documentRef.activeElement, dayFocus);
        await respond[0]();
        await dismissedNavigation;
        assert.equal(documentRef.activeElement, dayFocus, 'old navigation must not focus a navigation control in the reopened calendar');
    });
}

function run() {
    __resetDeliveryDatePickerForTests();
    testRegistersDeliveryDatePickerActions();
    testFormatDateInputValueUsesLocalDateParts();
    testSelectDeliveryDateByStringUpdatesInputs();
    return Promise.resolve()
        .then(testInitDeliveryDatePickerUsesControlledTodayAndRecommendedDate)
        .then(testSelectNextWeekScansAcrossMonthBoundaryFromControlledToday)
        .then(testRenderedCalendarUsesNativeButtonsAndOneTabStop)
        .then(testDateActivationRejectsUnavailablePastAndUnrenderedDays)
        .then(testEarliestUsesServerRecommendationAfterMonthNavigation)
        .then(testOlderCalendarResponseCannotReplaceNewerMonth)
        .then(testClosingDuringLoadDoesNotReopenOrStealFocus)
        .then(testDismissedOpeningCannotStealFocusFromReopenedCalendar)
        .then(testDismissedNavigationCannotStealFocusFromReopenedCalendar)
        .then(() => {
            console.log('delivery date picker slice tests passed');
        });
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
