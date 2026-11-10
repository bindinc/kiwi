import assert from 'node:assert/strict';
import { observeHeaderScrollInset } from '../../../assets/js/app/header-scroll-inset.js';

function createFixture() {
    const state = { position: 'sticky', height: 64.5, writes: [], disconnected: false };
    const listeners = new Map();
    const visualListeners = new Map();
    const root = { style: {
        setProperty(name, value) { state.writes.push([name, value]); },
        removeProperty(name) { state.removed = name; }
    } };
    const header = { getBoundingClientRect: () => ({ height: state.height }) };
    const windowRef = {
        getComputedStyle(element) {
            return element === header ? { position: state.position }
                : { getPropertyValue: () => '16px' };
        },
        ResizeObserver: class {
            constructor(callback) { state.observerCallback = callback; }
            observe(element, options) { state.observed = element; state.box = options.box; }
            disconnect() { state.disconnected = true; }
        },
        addEventListener(type, callback) { listeners.set(type, callback); },
        removeEventListener(type) { listeners.delete(type); },
        visualViewport: {
            addEventListener(type, callback) { visualListeners.set(type, callback); },
            removeEventListener(type) { visualListeners.delete(type); }
        }
    };
    return { state, root, header, windowRef, listeners, visualListeners };
}

function testInsetTracksMeasuredFrameAndSkipsUnchangedUpdates() {
    const fixture = createFixture();
    const { state, root, header, windowRef } = fixture;
    const stop = observeHeaderScrollInset({ header, documentRef: { documentElement: root }, windowRef });
    assert.equal(state.observed, header);
    assert.equal(state.box, 'border-box');
    assert.deepEqual(state.writes, [['--header-scroll-inset', '81px']]);

    // Session/call content increases the actual frame; no fixed toolbar-height guess applies.
    state.height = 143;
    state.observerCallback();
    assert.deepEqual(state.writes.at(-1), ['--header-scroll-inset', '159px']);
    const count = state.writes.length;
    state.observerCallback();
    assert.equal(state.writes.length, count);
    stop();
}

function testHeightBreakpointAndVisualViewportChangesUpdateWithoutHeaderResize() {
    const { state, root, header, windowRef, listeners, visualListeners } = createFixture();
    const stop = observeHeaderScrollInset({ header, documentRef: { documentElement: root }, windowRef });
    state.position = 'relative';
    listeners.get('resize')();
    assert.deepEqual(state.writes.at(-1), ['--header-scroll-inset', '0px']);

    state.position = 'sticky';
    visualListeners.get('resize')();
    assert.deepEqual(state.writes.at(-1), ['--header-scroll-inset', '81px']);
    stop();
    assert.equal(state.disconnected, true);
    assert.equal(listeners.size, 0);
    assert.equal(visualListeners.size, 0);
    assert.equal(state.removed, '--header-scroll-inset');
}

testInsetTracksMeasuredFrameAndSkipsUnchangedUpdates();
testHeightBreakpointAndVisualViewportChangesUpdateWithoutHeaderResize();
console.log('header scroll inset tests passed');
