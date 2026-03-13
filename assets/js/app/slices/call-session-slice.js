import { getGlobalScope } from '../services.js';
import { translate } from './localization-slice.js';

const CALL_SESSION_SLICE_NAMESPACE = 'kiwiCallSessionSlice';
const CALL_SESSION_SERVICE_LABELS = {
    AVROBODE: { key: 'serviceNumbers.avrobode', fallback: 'AVROBODE SERVICE' },
    MIKROGIDS: { key: 'serviceNumbers.mikrogids', fallback: 'MIKROGIDS SERVICE' },
    NCRVGIDS: { key: 'serviceNumbers.ncrvgids', fallback: 'NCRVGIDS SERVICE' },
    ALGEMEEN: { key: 'serviceNumbers.algemeen', fallback: 'ALGEMEEN SERVICE' }
};

function resolveCustomerId(payload) {
    if (!payload || payload.customerId === undefined || payload.customerId === null || payload.customerId === '') {
        return null;
    }

    return payload.customerId;
}

function getDocumentRef() {
    const globalScope = getGlobalScope();
    const documentRef = globalScope && globalScope.document ? globalScope.document : null;
    return documentRef && typeof documentRef.getElementById === 'function' ? documentRef : null;
}

function getRuntimeApi() {
    const globalScope = getGlobalScope();
    const runtimeApi = globalScope && globalScope.kiwiCallAgentRuntime ? globalScope.kiwiCallAgentRuntime : null;
    return runtimeApi && typeof runtimeApi === 'object' ? runtimeApi : null;
}

function getCallSession(runtimeApi) {
    if (!runtimeApi || typeof runtimeApi.getCallSession !== 'function') {
        return null;
    }

    const callSession = runtimeApi.getCallSession();
    if (!callSession || typeof callSession !== 'object') {
        return null;
    }

    return callSession;
}

function getTimerFunctions() {
    const globalScope = getGlobalScope();
    const setIntervalFn = globalScope && typeof globalScope.setInterval === 'function'
        ? globalScope.setInterval.bind(globalScope)
        : null;
    const clearIntervalFn = globalScope && typeof globalScope.clearInterval === 'function'
        ? globalScope.clearInterval.bind(globalScope)
        : null;

    return { setIntervalFn, clearIntervalFn };
}

function setElementText(documentRef, elementId, value) {
    const element = documentRef.getElementById(elementId);
    if (!element) {
        return;
    }

    element.textContent = value;
}

function setElementDisplay(documentRef, elementId, displayValue) {
    const element = documentRef.getElementById(elementId);
    if (!element || !element.style) {
        return;
    }

    element.style.display = displayValue;
}

function formatDuration(runtimeApi, durationSeconds) {
    if (runtimeApi && typeof runtimeApi.formatTime === 'function') {
        return runtimeApi.formatTime(durationSeconds);
    }

    return String(durationSeconds);
}

function getServiceNumberLabel(serviceNumber) {
    const normalizedServiceNumber = String(serviceNumber || '').toUpperCase();
    const labelConfig = CALL_SESSION_SERVICE_LABELS[normalizedServiceNumber];
    if (!labelConfig) {
        return serviceNumber || '';
    }

    return translate(labelConfig.key, {}, labelConfig.fallback);
}

function updateHoldButton(documentRef) {
    const holdBtn = documentRef.getElementById('holdCallBtn');
    if (!holdBtn || !holdBtn.style || !holdBtn.classList) {
        return;
    }

    holdBtn.style.display = 'inline-block';
    holdBtn.innerHTML = translate('calls.holdButtonLabel', {}, '⏸️ In Wacht Zetten');
    holdBtn.classList.remove('on-hold');
}

function updateDebugEndCallButton(documentRef) {
    const debugEndBtn = documentRef.getElementById('debugEndCallBtn');
    if (!debugEndBtn || !debugEndBtn.style) {
        return;
    }

    debugEndBtn.style.display = 'block';
}

function updateRecordingIndicator(documentRef, runtimeApi, callSession) {
    const recordingEnabled = runtimeApi && typeof runtimeApi.isRecordingEnabled === 'function'
        ? runtimeApi.isRecordingEnabled()
        : false;
    if (!recordingEnabled) {
        return;
    }

    const recordingIndicator = documentRef.getElementById('recordingIndicator');
    if (!recordingIndicator || !recordingIndicator.style) {
        return;
    }

    recordingIndicator.style.display = 'flex';
    callSession.recordingActive = true;
}

export function updateCallDuration() {
    const runtimeApi = getRuntimeApi();
    const callSession = getCallSession(runtimeApi);
    const documentRef = getDocumentRef();

    if (!runtimeApi || !callSession || !documentRef || !callSession.active || !callSession.startTime) {
        return;
    }

    const elapsedSeconds = Math.floor((Date.now() - callSession.startTime) / 1000);
    setElementText(documentRef, 'sessionDuration', formatDuration(runtimeApi, elapsedSeconds));
}

export function startCallSession() {
    const runtimeApi = getRuntimeApi();
    const callSession = getCallSession(runtimeApi);
    const documentRef = getDocumentRef();

    if (!runtimeApi || !callSession || !documentRef) {
        return;
    }

    setElementDisplay(documentRef, 'sessionInfo', 'flex');
    setElementText(documentRef, 'sessionServiceNumber', getServiceNumberLabel(callSession.serviceNumber));
    setElementText(documentRef, 'sessionWaitTime', formatDuration(runtimeApi, Number(callSession.waitTime || 0)));
    setElementText(
        documentRef,
        'sessionCallerName',
        callSession.customerName || translate('calls.anonymousCaller', {}, 'Anonieme Beller')
    );
    setElementDisplay(documentRef, 'endCallBtn', 'inline-block');

    if (typeof runtimeApi.autoSetAgentStatus === 'function') {
        runtimeApi.autoSetAgentStatus('call_started');
    }

    updateHoldButton(documentRef);
    updateDebugEndCallButton(documentRef);
    updateRecordingIndicator(documentRef, runtimeApi, callSession);

    const { setIntervalFn, clearIntervalFn } = getTimerFunctions();
    updateCallDuration();

    if (callSession.durationInterval && clearIntervalFn) {
        clearIntervalFn(callSession.durationInterval);
    }
    if (setIntervalFn) {
        callSession.durationInterval = setIntervalFn(updateCallDuration, 1000);
    }

    if (typeof runtimeApi.updateIdentifyCallerButtons === 'function') {
        runtimeApi.updateIdentifyCallerButtons();
    }
    if (typeof runtimeApi.saveCallSession === 'function') {
        runtimeApi.saveCallSession();
    }
}

function exposeCallSessionSliceApi() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[CALL_SESSION_SLICE_NAMESPACE] = {
        startCallSession,
        updateCallDuration
    };
}

export function registerCallSessionSlice(actionRouter, runtime) {
    exposeCallSessionSliceApi();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !runtime) {
        return;
    }

    actionRouter.registerMany({
        'call-session.toggle-hold'() {
            runtime.toggleCallHold();
        },
        'call-session.end'() {
            runtime.endCallSession();
        },
        'call-session.identify-current-customer'() {
            runtime.identifyCurrentCustomerAsCaller();
        },
        'call-session.identify-caller'(payload, context) {
            if (context.event && typeof context.event.stopPropagation === 'function') {
                context.event.stopPropagation();
            }

            const customerId = resolveCustomerId(payload);
            if (customerId === null) {
                return;
            }

            runtime.identifyCallerAsCustomer(customerId);
        }
    });
}
