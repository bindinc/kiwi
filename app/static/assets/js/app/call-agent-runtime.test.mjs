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

function run() {
    testConfiguredShowToastDependencyTakesPriorityOverGlobalFallback();
    testGlobalFallbackIsNotUsedWithoutConfiguredDependency();
    testDispositionCategoriesFallsBackToEmptyObjectAndWarnsOnce();
    testConfiguredDependenciesSupportSelectCustomerAndCallSessionSliceBridge();
    testRuntimeStartCallSessionWarnsOnceWithoutSliceBridge();
    console.log('call-agent-runtime dependency wiring tests passed');
}

run();
