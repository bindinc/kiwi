import assert from 'node:assert/strict';
import {
    findPickableElement,
    isValidAreaRect,
    normalizeAreaRect,
    startElementPicker
} from '../../../../assets/js/app/contextual-feedback/element-picker.js';

function createElement(tagName, ignored = false) {
    return {
        tagName,
        nodeType: 1,
        dataset: ignored ? { feedbackIgnore: 'true' } : {},
        style: {},
        hidden: false,
        classList: createClassList(),
        setAttribute() {},
        setPointerCapture() {},
        releasePointerCapture() {},
        remove() {},
        closest(selector) {
            return selector === '[data-feedback-ignore]' && ignored ? this : null;
        },
        getBoundingClientRect() {
            return { x: 12, y: 20, width: 120, height: 40 };
        }
    };
}

function createClassList() {
    const values = new Set();

    return {
        add(...names) {
            for (const name of names) {
                values.add(name);
            }
        },
        remove(...names) {
            for (const name of names) {
                values.delete(name);
            }
        },
        toggle(name, force) {
            if (force === false) {
                values.delete(name);
            } else {
                values.add(name);
            }
        },
        contains(name) {
            return values.has(name);
        }
    };
}

function testPickerSkipsFeedbackUi() {
    const overlay = createElement('DIV', true);
    const button = createElement('BUTTON');
    const documentRef = {
        elementsFromPoint() {
            return [overlay, button];
        }
    };

    assert.equal(findPickableElement(documentRef, 12, 20), button);
}

function testPickerDoesNotSelectBody() {
    const body = createElement('BODY');
    const documentRef = {
        elementsFromPoint() {
            return [body];
        }
    };

    assert.equal(findPickableElement(documentRef, 12, 20), null);
}

function testAreaRectNormalizesEveryDragDirectionAndClampsToViewport() {
    assert.deepEqual(
        normalizeAreaRect(
            { x: 100, y: 90 },
            { x: -20, y: 30 },
            { width: 80, height: 70 }
        ),
        { x: 0, y: 30, width: 80, height: 40 }
    );
}

function testAreaRequiresBothDimensionsToBeTenPixels() {
    assert.equal(isValidAreaRect({ width: 10, height: 10 }), true);
    assert.equal(isValidAreaRect({ width: 9.99, height: 10 }), false);
    assert.equal(isValidAreaRect({ width: 10, height: 9.99 }), false);
}

function testSingleClickStillSelectsDomElement() {
    const harness = createPickerHarness();
    let selection = null;
    startElementPicker({
        documentRef: harness.documentRef,
        windowRef: harness.windowRef,
        onSelect(nextSelection) {
            selection = nextSelection;
        }
    });

    harness.dispatch('pointerdown', pointerEvent({ x: 30, y: 40 }));
    harness.dispatch('pointerup', pointerEvent({ x: 30, y: 40 }));
    harness.dispatch('click', pointerEvent({ x: 30, y: 40 }));

    assert.equal(selection.kind, 'element');
    assert.equal(selection.element, harness.target);
    assert.deepEqual(selection.rect, { x: 12, y: 20, width: 120, height: 40 });
}

function testDragSelectsCustomArea() {
    const harness = createPickerHarness();
    let selection = null;
    startElementPicker({
        documentRef: harness.documentRef,
        windowRef: harness.windowRef,
        onSelect(nextSelection) {
            selection = nextSelection;
        }
    });

    harness.dispatch('pointerdown', pointerEvent({ x: 90, y: 80 }));
    harness.dispatch('pointermove', pointerEvent({ x: 30, y: 20 }));
    harness.dispatch('pointerup', pointerEvent({ x: 30, y: 20 }));
    harness.dispatch('click', pointerEvent({ x: 30, y: 20 }));

    assert.deepEqual(selection, {
        kind: 'area',
        rect: { x: 30, y: 20, width: 60, height: 60 }
    });
}

function testInvalidAreaKeepsPickerActiveForAnotherSelection() {
    const harness = createPickerHarness();
    const selections = [];
    startElementPicker({
        documentRef: harness.documentRef,
        windowRef: harness.windowRef,
        onSelect(selection) {
            selections.push(selection);
        }
    });

    harness.dispatch('pointerdown', pointerEvent({ x: 20, y: 20 }));
    harness.dispatch('pointermove', pointerEvent({ x: 60, y: 25 }));
    harness.dispatch('pointerup', pointerEvent({ x: 60, y: 25 }));
    harness.dispatch('click', pointerEvent({ x: 60, y: 25 }));
    assert.equal(selections.length, 0);
    assert.equal(harness.createdElements[2].textContent, 'Select an area of at least 10 × 10 px');

    harness.dispatch('pointerdown', pointerEvent({ x: 20, y: 20 }));
    harness.dispatch('pointerup', pointerEvent({ x: 20, y: 20 }));
    harness.dispatch('click', pointerEvent({ x: 20, y: 20 }));
    assert.equal(selections.length, 1);
    assert.equal(selections[0].kind, 'element');
}

function createPickerHarness() {
    const listeners = new Map();
    const createdElements = [];
    const target = createElement('BUTTON');
    const body = {
        append(...elements) {
            createdElements.push(...elements);
        }
    };
    const documentRef = {
        body,
        defaultView: { innerWidth: 200, innerHeight: 150 },
        createElement(tagName) {
            return createElement(tagName.toUpperCase(), true);
        },
        elementsFromPoint() {
            return [createdElements[0], target];
        },
        addEventListener(type, listener) {
            const typeListeners = listeners.get(type) || [];
            typeListeners.push(listener);
            listeners.set(type, typeListeners);
        },
        removeEventListener(type, listener) {
            const typeListeners = listeners.get(type) || [];
            listeners.set(type, typeListeners.filter((candidate) => candidate !== listener));
        }
    };

    return {
        documentRef,
        windowRef: documentRef.defaultView,
        target,
        createdElements,
        dispatch(type, event) {
            for (const listener of [...(listeners.get(type) || [])]) {
                listener(event);
            }
        }
    };
}

function pointerEvent({ x, y, pointerId = 1, button = 0 }) {
    return {
        clientX: x,
        clientY: y,
        pointerId,
        button,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {}
    };
}

testPickerSkipsFeedbackUi();
testPickerDoesNotSelectBody();
testAreaRectNormalizesEveryDragDirectionAndClampsToViewport();
testAreaRequiresBothDimensionsToBeTenPixels();
testSingleClickStillSelectsDomElement();
testDragSelectsCustomArea();
testInvalidAreaKeepsPickerActiveForAnotherSelection();
