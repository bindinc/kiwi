import assert from 'node:assert/strict';
import { redactScreenshotDom } from '../../../../assets/js/app/contextual-feedback/screenshot-redaction.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

class FakeElement {
    constructor(tagName, attributes = {}, options = {}) {
        this.nodeType = ELEMENT_NODE;
        this.tagName = tagName.toUpperCase();
        this.attributes = attributes;
        this.style = { ...(options.style || {}) };
        this.childNodes = [];
        this.parentElement = null;
        this.type = options.type || '';
        this.value = options.value || '';
        this.placeholder = options.placeholder || '';
        this.checked = options.checked || false;
        this.indeterminate = options.indeterminate || false;
        this.selectedIndex = options.selectedIndex ?? 0;
        this.selected = options.selected || false;

        for (const child of options.children || []) {
            this.append(child);
        }
    }

    append(child) {
        child.parentElement = this;
        this.childNodes.push(child);
    }

    querySelectorAll(selector) {
        if (selector !== '*') {
            return [];
        }

        const elements = [];
        collectChildElements(this, elements);

        return elements;
    }

    closest(selector) {
        if (selector !== '[data-feedback-ignore]') {
            return null;
        }

        let element = this;
        while (element) {
            if (Object.hasOwn(element.attributes, 'data-feedback-ignore')) {
                return element;
            }

            element = element.parentElement;
        }

        return null;
    }

    matches(selector) {
        return selector === '[data-feedback-mask]' && Object.hasOwn(this.attributes, 'data-feedback-mask');
    }
}

class FakeText {
    constructor(value) {
        this.nodeType = TEXT_NODE;
        this.nodeValue = value;
        this.parentElement = null;
    }
}

function collectChildElements(element, elements) {
    for (const child of element.childNodes) {
        if (child.nodeType !== ELEMENT_NODE) {
            continue;
        }

        elements.push(child);
        collectChildElements(child, elements);
    }
}

function testRedactionHidesVisibleDataAndRestoresDom() {
    const customerName = new FakeText('Jane Sensitive');
    const label = new FakeElement('span', {}, {
        style: { color: 'rgb(17, 24, 39)' },
        children: [customerName]
    });
    const emailInput = new FakeElement('input', {}, {
        type: 'email',
        value: 'jane@example.org',
        placeholder: 'email'
    });
    const optIn = new FakeElement('input', {}, {
        type: 'checkbox',
        checked: true,
        indeterminate: true
    });
    const subscriptionSelect = new FakeElement('select', {}, { selectedIndex: 2 });
    const profilePhoto = new FakeElement('img', {}, { style: { visibility: 'visible' } });
    const root = new FakeElement('main', {}, {
        style: { backgroundImage: 'url(customer-card.png)' },
        children: [label, emailInput, optIn, subscriptionSelect, profilePhoto]
    });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(customerName.nodeValue, 'Jane Sensitive');
    assert.equal(label.style.color, 'transparent');
    assert.equal(root.style.backgroundImage, 'none');
    assert.equal(emailInput.value, '');
    assert.equal(emailInput.placeholder, '');
    assert.equal(optIn.checked, false);
    assert.equal(optIn.indeterminate, false);
    assert.equal(subscriptionSelect.selectedIndex, -1);
    assert.equal(profilePhoto.style.visibility, 'hidden');

    restore();

    assert.equal(label.style.color, 'rgb(17, 24, 39)');
    assert.equal(root.style.backgroundImage, 'url(customer-card.png)');
    assert.equal(emailInput.value, 'jane@example.org');
    assert.equal(emailInput.placeholder, 'email');
    assert.equal(optIn.checked, true);
    assert.equal(optIn.indeterminate, true);
    assert.equal(subscriptionSelect.selectedIndex, 2);
    assert.equal(profilePhoto.style.visibility, 'visible');
}

function testRedactionSkipsFeedbackUi() {
    const ignoredInput = new FakeElement('input', {}, {
        type: 'password',
        value: 'feedback form value',
        placeholder: 'feedback'
    });
    const ignoredModal = new FakeElement('div', { 'data-feedback-ignore': '' }, {
        children: [ignoredInput]
    });
    const root = new FakeElement('main', {}, { children: [ignoredModal] });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(ignoredModal.style.color, undefined);
    assert.equal(ignoredInput.value, 'feedback form value');
    assert.equal(ignoredInput.placeholder, 'feedback');

    restore();

    assert.equal(ignoredInput.value, 'feedback form value');
}

function testRedactionHidesExplicitMaskElements() {
    const accountPanel = new FakeElement('section', { 'data-feedback-mask': '' });
    const root = new FakeElement('main', {}, { children: [accountPanel] });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(accountPanel.style.visibility, 'hidden');

    restore();

    assert.equal(accountPanel.style.visibility, '');
}

function testRedactionInstallsAndRemovesTemporaryStylesheet() {
    const root = new FakeElement('main');
    const stylesheets = [];
    const documentRef = {
        body: root,
        head: {
            append(stylesheet) {
                stylesheets.push(stylesheet);
                stylesheet.remove = () => {
                    const index = stylesheets.indexOf(stylesheet);
                    if (index !== -1) {
                        stylesheets.splice(index, 1);
                    }
                };
            }
        },
        createElement(tagName) {
            assert.equal(tagName, 'style');

            return {
                dataset: {},
                textContent: '',
                remove() {}
            };
        }
    };

    const restore = redactScreenshotDom(documentRef);

    assert.equal(stylesheets.length, 1);
    assert.equal(stylesheets[0].dataset.feedbackIgnore, 'true');
    assert.match(stylesheets[0].textContent, /background-image: none/);
    assert.match(stylesheets[0].textContent, /visibility: hidden/);

    restore();

    assert.equal(stylesheets.length, 0);
}

testRedactionHidesVisibleDataAndRestoresDom();
testRedactionSkipsFeedbackUi();
testRedactionHidesExplicitMaskElements();
testRedactionInstallsAndRemovesTemporaryStylesheet();
