import assert from 'node:assert/strict';
import { findPickableElement } from '../../../../assets/js/app/contextual-feedback/element-picker.js';

function createElement(tagName, ignored = false) {
    return {
        tagName,
        nodeType: 1,
        closest(selector) {
            return selector === '[data-feedback-ignore]' && ignored ? this : null;
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

testPickerSkipsFeedbackUi();
testPickerDoesNotSelectBody();
