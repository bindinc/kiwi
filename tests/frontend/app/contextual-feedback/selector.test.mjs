import assert from 'node:assert/strict';
import { describeElement, generateStableSelector } from '../../../../assets/js/app/contextual-feedback/selector.js';

class FakeElement {
    constructor(tagName, attributes = {}, options = {}) {
        this.tagName = tagName.toUpperCase();
        this.attributes = attributes;
        this.id = attributes.id || '';
        this.textContent = options.textContent || '';
        this.classList = options.classList || [];
        this.parentElement = options.parentElement || null;
        this.previousElementSibling = options.previousElementSibling || null;
        this.nodeType = 1;
    }

    getAttribute(name) {
        return this.attributes[name] ?? null;
    }

    closest(selector) {
        if (selector === 'label') {
            return this.parentElement?.tagName === 'LABEL' ? this.parentElement : null;
        }

        return null;
    }
}

function createDocument(elements) {
    return {
        body: {},
        documentElement: {},
        getElementById(id) {
            return elements.find((element) => element.id === id) || null;
        },
        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            return elements.filter((element) => matchesSelector(element, selector));
        }
    };
}

function matchesSelector(element, selector) {
    if (selector.startsWith('#')) {
        return element.id === selector.slice(1);
    }

    const dataMatch = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    if (dataMatch) {
        return element.getAttribute(dataMatch[1]) === dataMatch[2];
    }

    const semanticMatch = selector.match(/^([a-z]+)\[([^=]+)="([^"]+)"\]$/);
    if (semanticMatch) {
        return element.tagName.toLowerCase() === semanticMatch[1] && element.getAttribute(semanticMatch[2]) === semanticMatch[3];
    }

    const labelMatch = selector.match(/^label\[for="([^"]+)"\]$/);
    if (labelMatch) {
        return element.tagName === 'LABEL' && element.getAttribute('for') === labelMatch[1];
    }

    const classMatch = selector.match(/^([a-z]+)\.([a-z0-9_-]+)$/i);
    if (classMatch) {
        return element.tagName.toLowerCase() === classMatch[1] && element.classList.includes(classMatch[2]);
    }

    return element.tagName.toLowerCase() === selector;
}

function testDataFeedbackIdWins() {
    const element = new FakeElement('button', { 'data-feedback-id': 'create-subscription' }, { textContent: 'Create' });
    const documentRef = createDocument([element]);

    assert.equal(generateStableSelector(element, documentRef), '[data-feedback-id="create-subscription"]');
}

function testGeneratedIdIsIgnoredForSemanticSelector() {
    const element = new FakeElement('input', { id: 'field-a1b2c3d4e5', name: 'postalCode' });
    const documentRef = createDocument([element]);

    assert.equal(generateStableSelector(element, documentRef), 'input[name="postalCode"]');
}

function testLabelAndTextSampleAreBounded() {
    const label = new FakeElement('label', { for: 'city' }, { textContent: 'City name' });
    const element = new FakeElement('input', { id: 'city' }, { textContent: 'Hidden content' });
    const documentRef = createDocument([label, element]);

    assert.deepEqual(describeElement(element, documentRef), {
        tag: 'input',
        label: 'City name',
        selector: '#city',
        textSample: 'Hidden content'
    });
}

testDataFeedbackIdWins();
testGeneratedIdIsIgnoredForSemanticSelector();
testLabelAndTextSampleAreBounded();
