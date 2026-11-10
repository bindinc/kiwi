import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function createConsoleStub() {
    return {
        logs: [],
        warns: [],
        errors: [],
        log(...args) {
            this.logs.push(args);
        },
        warn(...args) {
            this.warns.push(args);
        },
        error(...args) {
            this.errors.push(args);
        },
        debug() {}
    };
}

function createRuntimeContext() {
    const consoleStub = createConsoleStub();
    const contextObject = {
        console: consoleStub,
        setTimeout,
        clearTimeout,
        window: null,
        globalThis: null
    };
    contextObject.window = contextObject;
    contextObject.globalThis = contextObject;

    const context = vm.createContext(contextObject);
    const source = readFileSync(new URL('../../../assets/js/app/call-agent-runtime.js', import.meta.url), 'utf8');
    vm.runInContext(source, context);

    return { context, consoleStub };
}

function configureRuntimeDependencies(context, dependencies = {}) {
    const runtimeApi = context.kiwiCallAgentRuntime;
    assert.equal(typeof runtimeApi.configureDependencies, 'function');
    runtimeApi.configureDependencies(dependencies);
}

function testConfiguredShowToastDependencyTakesPriorityOverGlobalFallback() {
    const { context } = createRuntimeContext();
    const dependencyCalls = [];
    const fallbackCalls = [];

    configureRuntimeDependencies(context, {
        showToast(...args) {
            dependencyCalls.push(args);
        }
    });
    context.showToast = (...args) => {
        fallbackCalls.push(args);
    };

    context.runtimeShowToast('saved', 'success');

    assert.deepEqual(dependencyCalls, [['saved', 'success']]);
    assert.equal(fallbackCalls.length, 0);
}

function testGlobalFallbackIsNotUsedWithoutConfiguredDependency() {
    const { context, consoleStub } = createRuntimeContext();
    const fallbackCalls = [];

    context.showToast = (...args) => {
        fallbackCalls.push(args);
    };

    context.runtimeShowToast('fallback', 'warning');

    assert.equal(fallbackCalls.length, 0);
    const missingShowToastWarnings = consoleStub.warns.filter((warningArgs) => (
        warningArgs.join(' ').includes('showToast')
    ));
    assert.equal(missingShowToastWarnings.length, 1);
}

function testDispositionCategoriesFallsBackToEmptyObjectAndWarnsOnce() {
    const { context, consoleStub } = createRuntimeContext();

    const firstResult = context.runtimeGetDispositionCategories();
    const secondResult = context.runtimeGetDispositionCategories();

    assert.equal(JSON.stringify(firstResult), '{}');
    assert.equal(JSON.stringify(secondResult), '{}');

    const missingCategoryWarnings = consoleStub.warns.filter((warningArgs) => (
        warningArgs.join(' ').includes('getDispositionCategories')
    ));
    assert.equal(missingCategoryWarnings.length, 1);
}

function testConfiguredDependenciesSupportSelectCustomerAndCallSessionSliceBridge() {
    const { context } = createRuntimeContext();
    const dependencyCalls = [];
    const sliceCalls = [];

    configureRuntimeDependencies(context, {
        selectCustomer(customerId) {
            dependencyCalls.push(['selectCustomer', customerId]);
        },
        addContactMoment(customerId, type, description) {
            dependencyCalls.push(['addContactMoment', customerId, type, description]);
        },
        getDispositionCategories() {
            return { general: { label: 'General', outcomes: [] } };
        },
        showToast() {}
    });
    context.kiwiCallSessionSlice = {
        startCallSession() {
            sliceCalls.push(['startCallSession']);
        }
    };

    context.runtimeSelectCustomer(88);
    context.runtimeStartCallSession();
    context.runtimeAddContactMoment(77, 'note', 'saved');

    assert.deepEqual(dependencyCalls, [
        ['selectCustomer', 88],
        ['addContactMoment', 77, 'note', 'saved']
    ]);
    assert.deepEqual(sliceCalls, [['startCallSession']]);
    assert.equal(
        JSON.stringify(context.runtimeGetDispositionCategories()),
        JSON.stringify({
            general: { label: 'General', outcomes: [] }
        })
    );
}

function testRuntimeStartCallSessionWarnsOnceWithoutSliceBridge() {
    const { context, consoleStub } = createRuntimeContext();

    context.runtimeStartCallSession();
    context.runtimeStartCallSession();

    const missingBridgeWarnings = consoleStub.warns.filter((warningArgs) => (
        warningArgs.join(' ').includes('Missing call-session slice method')
    ));
    assert.equal(missingBridgeWarnings.length, 1);
}

function testResolveDebugWaitTimeUsesInjectedRandom() {
    const { context } = createRuntimeContext();

    configureRuntimeDependencies(context, {
        random() {
            return 0;
        }
    });

    assert.equal(context.kiwiCallAgentRuntime.resolveDebugWaitTimeSeconds('random'), 15);

    configureRuntimeDependencies(context, {
        random() {
            return 0.999;
        }
    });

    assert.equal(context.kiwiCallAgentRuntime.resolveDebugWaitTimeSeconds('random'), 90);
}

function testRemainingAcwSecondsUsesInjectedClock() {
    const { context } = createRuntimeContext();

    configureRuntimeDependencies(context, {
        nowMs() {
            return 35_000;
        }
    });

    assert.equal(context.kiwiCallAgentRuntime.getRemainingAcwSeconds(5_000), 90);
}

function testResolveTeamsSyncLabelExplainsDisabledEnvironment() {
    const { context } = createRuntimeContext();
    context.translate = (_key, _params, fallback) => fallback;

    const label = context.kiwiCallAgentRuntime.resolveTeamsSyncLabel({
        reason: 'feature_disabled',
        capability: {
            can_write: false
        }
    });

    assert.equal(label, 'Teams sync is uitgeschakeld in deze omgeving.');
}

function testResolveTeamsSyncLabelIncludesGraphFailureDetails() {
    const { context } = createRuntimeContext();
    context.translate = (_key, _params, fallback) => fallback;

    const label = context.kiwiCallAgentRuntime.resolveTeamsSyncLabel({
        reason: 'request_failed',
        status_code: 403,
        graph_error: {
            code: 'Authorization_RequestDenied'
        }
    });

    assert.equal(label, 'Teams sync via Microsoft Graph mislukt (HTTP 403, Authorization_RequestDenied).');
}

function createStatusMenuFixture(context) {
    const listeners = new Map();
    const layoutObservers = [];
    const header = {};
    const bounds = { top: 12, bottom: 52, right: 312 };
    const item = {};
    const attributes = {};
    const menu = {
        hidden: true,
        style: {},
        scrollHeight: 720,
        contains(element) { return element === item; },
        getBoundingClientRect() {
            return { width: Math.min(320, parseFloat(this.style.maxWidth) || 320) };
        }
    };
    const trigger = {
        focusCount: 0,
        getBoundingClientRect() { return bounds; },
        setAttribute(name, value) { attributes[name] = value; },
        focus() { this.focusCount += 1; context.document.activeElement = this; }
    };
    context.ResizeObserver = class {
        constructor(callback) { this.callback = callback; layoutObservers.push(this); }
        observe(element, options) { this.target = element; this.box = options.box; }
        disconnect() { this.disconnected = true; }
    };
    context.innerWidth = 320;
    context.innerHeight = 320;
    context.addEventListener = (type, listener, capture = false) => listeners.set(`${type}:${capture}`, listener);
    context.removeEventListener = (type, _listener, capture = false) => listeners.delete(`${type}:${capture}`);
    context.document = {
        activeElement: trigger,
        querySelector(selector) { return selector === '.header' ? header : null; },
        getElementById(id) {
            return id === 'agentStatusMenu' ? menu : id === 'agentProfileTrigger' ? trigger : null;
        }
    };
    return { menu, trigger, item, bounds, attributes, listeners, header, layoutObservers };
}

function testStatusMenuFitsShortViewportAndReturnsInternalFocus() {
    const { context } = createRuntimeContext();
    const { menu, trigger, item, attributes, listeners } = createStatusMenuFixture(context);
    context.setStatusMenuOpen(true);

    assert.equal(menu.hidden, false);
    assert.equal(attributes['aria-expanded'], 'true');
    assert.equal(parseFloat(menu.style.left), 8);
    assert.equal(parseFloat(menu.style.top), 60);
    assert.equal(parseFloat(menu.style.maxWidth), 304);
    assert.equal(parseFloat(menu.style.maxHeight), 252);
    assert.equal(listeners.has('resize:false'), true);
    assert.equal(listeners.has('scroll:true'), true);

    context.document.activeElement = item;
    context.closeStatusMenu();
    assert.equal(menu.hidden, true);
    assert.equal(attributes['aria-expanded'], 'false');
    assert.equal(context.document.activeElement, trigger);
    assert.equal(trigger.focusCount, 1);
    assert.equal(listeners.size, 0);
}

function testStatusMenuOutsideDismissalDoesNotStealFocus() {
    const { context } = createRuntimeContext();
    const { trigger } = createStatusMenuFixture(context);
    context.setStatusMenuOpen(true);
    const workControl = {};
    context.document.activeElement = workControl;
    context.closeStatusMenu();

    assert.equal(context.document.activeElement, workControl);
    assert.equal(trigger.focusCount, 0);
}

function testStatusMenuUsesAvailableSpaceAboveAndVisualViewportBounds() {
    const { context } = createRuntimeContext();
    const { menu, bounds, listeners } = createStatusMenuFixture(context);
    bounds.top = 270;
    bounds.bottom = 310;
    context.setStatusMenuOpen(true);
    assert.equal(parseFloat(menu.style.top), 8);
    assert.equal(parseFloat(menu.style.maxHeight), 254);

    // The same open disclosure follows a resized/panned visual viewport.
    context.visualViewport = {
        offsetLeft: 50, offsetTop: 100, width: 220, height: 240,
        addEventListener() {}, removeEventListener() {}
    };
    bounds.top = 110;
    bounds.bottom = 150;
    bounds.right = 260;
    listeners.get('resize:false')();
    assert.equal(parseFloat(menu.style.maxWidth), 204);
    assert.equal(parseFloat(menu.style.left), 58);
    assert.equal(parseFloat(menu.style.top), 158);
    assert.equal(parseFloat(menu.style.maxHeight), 174);
    context.closeStatusMenu();
}

function testOpenMenuTracksHeaderReflowWithoutTriggerResize() {
    const { context } = createRuntimeContext();
    const { menu, bounds, header, layoutObservers } = createStatusMenuFixture(context);
    context.setStatusMenuOpen(true);
    assert.equal(layoutObservers.length, 1);
    assert.equal(layoutObservers[0].target, header);
    assert.equal(layoutObservers[0].box, 'border-box');

    bounds.top = 70;
    bounds.bottom = 110;
    layoutObservers[0].callback();
    assert.equal(parseFloat(menu.style.top), 118);
    assert.equal(parseFloat(menu.style.maxHeight), 194);
    context.closeStatusMenu();
    assert.equal(layoutObservers[0].disconnected, true);

    context.setStatusMenuOpen(true);
    assert.equal(layoutObservers.length, 2);
    context.closeStatusMenu();
    assert.equal(layoutObservers[1].disconnected, true);
}

function run() {
    testOpenMenuTracksHeaderReflowWithoutTriggerResize();
    testStatusMenuFitsShortViewportAndReturnsInternalFocus();
    testStatusMenuOutsideDismissalDoesNotStealFocus();
    testStatusMenuUsesAvailableSpaceAboveAndVisualViewportBounds();
    testConfiguredShowToastDependencyTakesPriorityOverGlobalFallback();
    testGlobalFallbackIsNotUsedWithoutConfiguredDependency();
    testDispositionCategoriesFallsBackToEmptyObjectAndWarnsOnce();
    testConfiguredDependenciesSupportSelectCustomerAndCallSessionSliceBridge();
    testRuntimeStartCallSessionWarnsOnceWithoutSliceBridge();
    testResolveDebugWaitTimeUsesInjectedRandom();
    testRemainingAcwSecondsUsesInjectedClock();
    testResolveTeamsSyncLabelExplainsDisabledEnvironment();
    testResolveTeamsSyncLabelIncludesGraphFailureDetails();
    console.log('call-agent-runtime dependency wiring tests passed');
}

run();
