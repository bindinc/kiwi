import assert from 'node:assert/strict';
import {
    registerCallSessionSlice,
    startCallSession,
    updateCallDuration
} from './call-session-slice.js';

function createClassList(initialClasses = []) {
    const classes = new Set(initialClasses);
    return {
        add(className) {
            classes.add(className);
        },
        remove(className) {
            classes.delete(className);
        },
        contains(className) {
            return classes.has(className);
        }
    };
}

function createElement(overrides = {}) {
    return {
        textContent: '',
        innerHTML: '',
        style: {},
        classList: createClassList(),
        ...overrides
    };
}

function createDocumentStub(elementsById = {}) {
    return {
        getElementById(elementId) {
            return Object.prototype.hasOwnProperty.call(elementsById, elementId)
                ? elementsById[elementId]
                : null;
        }
    };
}

function withGlobalState(testFn) {
    const previousGlobals = {
        kiwiCallAgentRuntime: globalThis.kiwiCallAgentRuntime,
        kiwiCallSessionSlice: globalThis.kiwiCallSessionSlice,
        document: globalThis.document,
        i18n: globalThis.i18n,
        setInterval: globalThis.setInterval,
        clearInterval: globalThis.clearInterval,
        dateNow: Date.now
    };

    try {
        testFn();
    } finally {
        if (previousGlobals.kiwiCallAgentRuntime === undefined) {
            delete globalThis.kiwiCallAgentRuntime;
        } else {
            globalThis.kiwiCallAgentRuntime = previousGlobals.kiwiCallAgentRuntime;
        }

        if (previousGlobals.kiwiCallSessionSlice === undefined) {
            delete globalThis.kiwiCallSessionSlice;
        } else {
            globalThis.kiwiCallSessionSlice = previousGlobals.kiwiCallSessionSlice;
        }

        if (previousGlobals.document === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousGlobals.document;
        }

        if (previousGlobals.i18n === undefined) {
            delete globalThis.i18n;
        } else {
            globalThis.i18n = previousGlobals.i18n;
        }

        globalThis.setInterval = previousGlobals.setInterval;
        globalThis.clearInterval = previousGlobals.clearInterval;
        Date.now = previousGlobals.dateNow;
    }
}

function testRegisterCallSessionSliceExposesNamespaceAndRoutesActions() {
    withGlobalState(() => {
        const actionCalls = [];
        const runtime = {
            toggleCallHold() {
                actionCalls.push(['toggleCallHold']);
            },
            endCallSession() {
                actionCalls.push(['endCallSession']);
            },
            identifyCurrentCustomerAsCaller() {
                actionCalls.push(['identifyCurrentCustomerAsCaller']);
            },
            identifyCallerAsCustomer(customerId) {
                actionCalls.push(['identifyCallerAsCustomer', customerId]);
            }
        };
        const actionHandlers = {};
        const actionRouter = {
            registerMany(handlers) {
                Object.assign(actionHandlers, handlers);
            }
        };

        registerCallSessionSlice(actionRouter, runtime);

        assert.equal(typeof globalThis.kiwiCallSessionSlice, 'object');
        assert.equal(typeof globalThis.kiwiCallSessionSlice.startCallSession, 'function');
        assert.equal(typeof globalThis.kiwiCallSessionSlice.updateCallDuration, 'function');

        actionHandlers['call-session.toggle-hold']();
        actionHandlers['call-session.end']();
        actionHandlers['call-session.identify-current-customer']();
        actionHandlers['call-session.identify-caller'](
            { customerId: 73 },
            { event: { stopPropagation() { actionCalls.push(['stopPropagation']); } } }
        );

        assert.deepEqual(actionCalls, [
            ['toggleCallHold'],
            ['endCallSession'],
            ['identifyCurrentCustomerAsCaller'],
            ['stopPropagation'],
            ['identifyCallerAsCustomer', 73]
        ]);
    });
}

function testStartCallSessionUpdatesUiAndOwnsDurationTimer() {
    withGlobalState(() => {
        const sessionInfo = createElement({ style: { display: 'none' } });
        const sessionServiceNumber = createElement();
        const sessionWaitTime = createElement();
        const sessionCallerName = createElement();
        const endCallBtn = createElement({ style: { display: 'none' } });
        const holdCallBtn = createElement({
            style: { display: 'none' },
            classList: createClassList(['on-hold'])
        });
        const debugEndCallBtn = createElement({ style: { display: 'none' } });
        const recordingIndicator = createElement({ style: { display: 'none' } });
        const sessionDuration = createElement();

        globalThis.document = createDocumentStub({
            sessionInfo,
            sessionServiceNumber,
            sessionWaitTime,
            sessionCallerName,
            endCallBtn,
            holdCallBtn,
            debugEndCallBtn,
            recordingIndicator,
            sessionDuration
        });
        globalThis.i18n = {
            t(key) {
                const translations = {
                    'serviceNumbers.avrobode': 'AVROBODE SERVICE NL',
                    'calls.anonymousCaller': 'Anonieme testbeller',
                    'calls.holdButtonLabel': 'In wacht zetten'
                };
                return translations[key] || key;
            }
        };

        let now = 20_000;
        Date.now = () => now;

        let registeredIntervalCallback = null;
        let registeredIntervalMs = null;
        const clearedIntervalIds = [];
        globalThis.setInterval = (callback, intervalMs) => {
            registeredIntervalCallback = callback;
            registeredIntervalMs = intervalMs;
            return 'new-duration-interval';
        };
        globalThis.clearInterval = (intervalId) => {
            clearedIntervalIds.push(intervalId);
        };

        const runtimeCalls = [];
        const callSession = {
            active: true,
            serviceNumber: 'AVROBODE',
            waitTime: 125,
            customerName: null,
            startTime: 14_000,
            durationInterval: 'old-duration-interval',
            recordingActive: false
        };
        globalThis.kiwiCallAgentRuntime = {
            getCallSession() {
                return callSession;
            },
            formatTime(seconds) {
                return `t${seconds}`;
            },
            autoSetAgentStatus(nextStatus) {
                runtimeCalls.push(['autoSetAgentStatus', nextStatus]);
            },
            isRecordingEnabled() {
                return true;
            },
            updateIdentifyCallerButtons() {
                runtimeCalls.push(['updateIdentifyCallerButtons']);
            },
            saveCallSession() {
                runtimeCalls.push(['saveCallSession']);
            }
        };

        startCallSession();

        assert.equal(sessionInfo.style.display, 'flex');
        assert.equal(sessionServiceNumber.textContent, 'AVROBODE SERVICE NL');
        assert.equal(sessionWaitTime.textContent, 't125');
        assert.equal(sessionCallerName.textContent, 'Anonieme testbeller');
        assert.equal(endCallBtn.style.display, 'inline-block');
        assert.equal(holdCallBtn.style.display, 'inline-block');
        assert.equal(holdCallBtn.innerHTML, 'In wacht zetten');
        assert.equal(holdCallBtn.classList.contains('on-hold'), false);
        assert.equal(debugEndCallBtn.style.display, 'block');
        assert.equal(recordingIndicator.style.display, 'flex');
        assert.equal(callSession.recordingActive, true);
        assert.equal(sessionDuration.textContent, 't6');
        assert.deepEqual(clearedIntervalIds, ['old-duration-interval']);
        assert.equal(callSession.durationInterval, 'new-duration-interval');
        assert.equal(registeredIntervalMs, 1000);
        assert.deepEqual(runtimeCalls, [
            ['autoSetAgentStatus', 'call_started'],
            ['updateIdentifyCallerButtons'],
            ['saveCallSession']
        ]);

        now = 22_000;
        registeredIntervalCallback();
        assert.equal(sessionDuration.textContent, 't8');
    });
}

function testUpdateCallDurationNoopsWhenCallIsInactive() {
    withGlobalState(() => {
        const sessionDuration = createElement({ textContent: 'unchanged' });
        globalThis.document = createDocumentStub({
            sessionDuration
        });
        globalThis.kiwiCallAgentRuntime = {
            getCallSession() {
                return {
                    active: false,
                    startTime: 5_000
                };
            },
            formatTime(seconds) {
                return `t${seconds}`;
            }
        };

        updateCallDuration();
        assert.equal(sessionDuration.textContent, 'unchanged');
    });
}

function run() {
    testRegisterCallSessionSliceExposesNamespaceAndRoutesActions();
    testStartCallSessionUpdatesUiAndOwnsDurationTimer();
    testUpdateCallDurationNoopsWhenCallIsInactive();
    console.log('call-session-slice tests passed');
}

run();
