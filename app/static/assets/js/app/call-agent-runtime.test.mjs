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
    const source = readFileSync(new URL('./call-agent-runtime.js', import.meta.url), 'utf8');
    vm.runInContext(source, context);

    return { context, consoleStub };
}

function testBridgeShowToastTakesPriorityOverGlobalFallback() {
    const { context } = createRuntimeContext();
    const bridgeCalls = [];
    const fallbackCalls = [];

    context.kiwiRuntimeCompatibilityBridge = {
        showToast(...args) {
            bridgeCalls.push(args);
        }
    };
    context.showToast = (...args) => {
        fallbackCalls.push(args);
    };

    context.runtimeShowToast('saved', 'success');

    assert.deepEqual(bridgeCalls, [['saved', 'success']]);
    assert.equal(fallbackCalls.length, 0);
}

function testGlobalFallbackIsUsedWithoutBridgeHandler() {
    const { context } = createRuntimeContext();
    const fallbackCalls = [];

    context.showToast = (...args) => {
        fallbackCalls.push(args);
    };

    context.runtimeShowToast('fallback', 'warning');

    assert.deepEqual(fallbackCalls, [['fallback', 'warning']]);
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

function testBridgeHandlersSupportSelectCustomerAndStartCallSession() {
    const { context } = createRuntimeContext();
    const bridgeCalls = [];

    context.kiwiRuntimeCompatibilityBridge = {
        selectCustomer(customerId) {
            bridgeCalls.push(['selectCustomer', customerId]);
        },
        startCallSession() {
            bridgeCalls.push(['startCallSession']);
        },
        addContactMoment(customerId, type, description) {
            bridgeCalls.push(['addContactMoment', customerId, type, description]);
        },
        getDispositionCategories() {
            return { general: { label: 'General', outcomes: [] } };
        },
        showToast() {}
    };

    context.runtimeSelectCustomer(88);
    context.runtimeStartCallSession();
    context.runtimeAddContactMoment(77, 'note', 'saved');

    assert.deepEqual(bridgeCalls, [
        ['selectCustomer', 88],
        ['startCallSession'],
        ['addContactMoment', 77, 'note', 'saved']
    ]);
    assert.equal(
        JSON.stringify(context.runtimeGetDispositionCategories()),
        JSON.stringify({
            general: { label: 'General', outcomes: [] }
        })
    );
}

function run() {
    testBridgeShowToastTakesPriorityOverGlobalFallback();
    testGlobalFallbackIsUsedWithoutBridgeHandler();
    testDispositionCategoriesFallsBackToEmptyObjectAndWarnsOnce();
    testBridgeHandlersSupportSelectCustomerAndStartCallSession();
    console.log('call-agent-runtime bridge tests passed');
}

run();
