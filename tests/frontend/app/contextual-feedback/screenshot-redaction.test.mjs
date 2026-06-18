import assert from 'node:assert/strict';
import {
    createPseudonymContext,
    pseudonymizeSelectedElement,
    redactScreenshotDom
} from '../../../../assets/js/app/contextual-feedback/screenshot-redaction.js';

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
        this.id = attributes.id || '';
        this.className = attributes.class || '';
        this.name = attributes.name || '';
        this.type = options.type || attributes.type || '';
        this.value = options.value || '';
        this.placeholder = options.placeholder || attributes.placeholder || '';
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

    get textContent() {
        return this.childNodes.map((child) => child.nodeValue || child.textContent || '').join('');
    }

    set textContent(value) {
        this.childNodes = [new FakeText(value)];
        this.childNodes[0].parentElement = this;
    }

    getAttribute(name) {
        return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
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
        let element = this;
        while (element) {
            if (matchesSelector(element, selector)) {
                return element;
            }

            element = element.parentElement;
        }

        return null;
    }

    matches(selector) {
        return matchesSelector(this, selector);
    }
}

class FakeText {
    constructor(value) {
        this.nodeType = TEXT_NODE;
        this.nodeValue = value;
        this.parentElement = null;
    }
}

function matchesSelector(element, selector) {
    const attributeName = selector.match(/^\[([^\]]+)\]$/)?.[1];
    if (!attributeName) {
        return false;
    }

    return Object.hasOwn(element.attributes, attributeName);
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

function testSensitiveTextIsPseudonymizedAndRestored() {
    const customerName = new FakeText('Jane Sensitive');
    const nameElement = new FakeElement('h2', { 'data-feedback-sensitive': 'name' }, {
        children: [customerName]
    });
    const root = new FakeElement('main', {}, { children: [nameElement] });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(customerName.nodeValue, 'Sophie de Vries');

    restore();

    assert.equal(customerName.nodeValue, 'Jane Sensitive');
}

function testTypedPseudoValuesAndFormRestore() {
    const emailInput = new FakeElement('input', { 'data-feedback-sensitive': 'email' }, {
        type: 'email',
        value: 'jane@example.org',
        placeholder: 'real@example.org'
    });
    const phoneInput = new FakeElement('input', { id: 'customerPhone' }, {
        type: 'tel',
        value: '0611111111',
        placeholder: 'Telefoonnummer'
    });
    const notes = new FakeElement('textarea', { 'data-feedback-sensitive': 'free-text' }, {
        value: 'Call about invoice details',
        placeholder: 'Private note'
    });
    const root = new FakeElement('main', {}, { children: [emailInput, phoneInput, notes] });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(emailInput.value, 'sophie.devries@example.test');
    assert.equal(emailInput.placeholder, 'sophie.devries@example.test');
    assert.equal(phoneInput.value, '0612345678');
    assert.equal(notes.value, 'Vraag over facturatie. Uitleg gegeven over betaalwijze.');

    restore();

    assert.equal(emailInput.value, 'jane@example.org');
    assert.equal(emailInput.placeholder, 'real@example.org');
    assert.equal(phoneInput.value, '0611111111');
    assert.equal(notes.value, 'Call about invoice details');
}

function testSensitiveScopeKeepsPublicCopy() {
    const sensitiveName = new FakeText('Jane Sensitive');
    const publicLabel = new FakeText('Bekijken');
    const sensitiveElement = new FakeElement('span', {}, { children: [sensitiveName] });
    const publicElement = new FakeElement('button', { 'data-feedback-public': '' }, { children: [publicLabel] });
    const scope = new FakeElement('section', { 'data-feedback-sensitive-scope': '' }, {
        children: [sensitiveElement, publicElement]
    });
    const root = new FakeElement('main', {}, { children: [scope] });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(sensitiveName.nodeValue, 'Klantnotitie met testgegevens');
    assert.equal(publicLabel.nodeValue, 'Bekijken');

    restore();

    assert.equal(sensitiveName.nodeValue, 'Jane Sensitive');
    assert.equal(publicLabel.nodeValue, 'Bekijken');
}

function testRepeatedValuesUseStableReplacement() {
    const firstEmail = new FakeText('jane@example.org');
    const secondEmail = new FakeText('jane@example.org');
    const firstElement = new FakeElement('span', {}, { children: [firstEmail] });
    const secondElement = new FakeElement('span', {}, { children: [secondEmail] });
    const root = new FakeElement('main', {}, { children: [firstElement, secondElement] });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(firstEmail.nodeValue, 'sophie.devries@example.test');
    assert.equal(secondEmail.nodeValue, 'sophie.devries@example.test');

    restore();
}

function testCustomerProfileKeepsRelatedValuesConsistent() {
    const searchValue = new FakeElement('input', { 'data-feedback-sensitive': 'name' }, {
        type: 'search',
        value: 'Jansen'
    });
    const unmarkedSearchValue = new FakeElement('input', { id: 'searchName' }, {
        type: 'text',
        value: 'Jansen'
    });
    const customerName = new FakeText('Mevr. M. Jansen');
    const customerInitials = new FakeText('M.');
    const customerEmail = new FakeText('maria.jansen@email.nl');
    const customerPhone = new FakeText('06-87654321');
    const customerAddress = new FakeText('Wijnhaven 15');
    const customerPostalCode = new FakeText('3011BD');
    const root = new FakeElement('main', {}, {
        children: [
            searchValue,
            unmarkedSearchValue,
            new FakeElement('h2', { id: 'customerName', 'data-feedback-sensitive': 'name' }, { children: [customerName] }),
            new FakeElement('span', { 'data-feedback-sensitive': 'name' }, { children: [customerInitials] }),
            new FakeElement('span', { 'data-feedback-sensitive': 'email' }, { children: [customerEmail] }),
            new FakeElement('span', { 'data-feedback-sensitive': 'phone' }, { children: [customerPhone] }),
            new FakeElement('span', { 'data-feedback-sensitive': 'address' }, { children: [customerAddress] }),
            new FakeElement('span', { 'data-feedback-sensitive': 'postal-code' }, { children: [customerPostalCode] })
        ]
    });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(searchValue.value, 'de Vries');
    assert.equal(unmarkedSearchValue.value, 'de Vries');
    assert.equal(customerName.nodeValue, 'Sophie de Vries');
    assert.equal(customerInitials.nodeValue, 'S.');
    assert.equal(customerEmail.nodeValue, 'sophie.devries@example.test');
    assert.equal(customerPhone.nodeValue, '0612345678');
    assert.equal(customerAddress.nodeValue, 'Dorpsstraat 12');
    assert.equal(customerPostalCode.nodeValue, '1234 AB');

    restore();

    assert.equal(searchValue.value, 'Jansen');
    assert.equal(unmarkedSearchValue.value, 'Jansen');
    assert.equal(customerName.nodeValue, 'Mevr. M. Jansen');
}

function testEmptyFieldsStayEmptyAndAddressShapeIsPreserved() {
    const emptyName = new FakeElement('input', { 'data-feedback-sensitive': 'name' }, {
        type: 'text',
        value: ''
    });
    const emptyEmail = new FakeElement('input', { 'data-feedback-sensitive': 'email' }, {
        type: 'email',
        value: ''
    });
    const emptyText = new FakeText('');
    const fullAddress = new FakeText('Wijnhaven 15, 3011BD Rotterdam');
    const root = new FakeElement('main', {}, {
        children: [
            emptyName,
            emptyEmail,
            new FakeElement('span', { 'data-feedback-sensitive': 'phone' }, { children: [emptyText] }),
            new FakeElement('span', { 'data-feedback-sensitive': 'address' }, { children: [fullAddress] })
        ]
    });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(emptyName.value, '');
    assert.equal(emptyEmail.value, '');
    assert.equal(emptyText.nodeValue, '');
    assert.equal(fullAddress.nodeValue, 'Dorpsstraat 12, 1234 AB Utrecht');

    restore();
}

function testSelectedElementDescriptionIsPseudonymized() {
    const context = createPseudonymContext();
    const safeElement = pseudonymizeSelectedElement({
        tag: 'h2',
        label: 'Mevr. M. Jansen',
        selector: '#customerName',
        textSample: 'Mevr. M. Jansen'
    }, context);

    assert.equal(safeElement.label, 'Sophie de Vries');
    assert.equal(safeElement.selector, '#customerName');
    assert.equal(safeElement.textSample, 'Sophie de Vries');
}

function testPatternFallbackCatchesUnmarkedSensitiveValues() {
    const emailText = new FakeText('jane@example.org');
    const phoneText = new FakeText('0611111111');
    const ibanText = new FakeText('NL12ABNA0123456789');
    const postalText = new FakeText('1234AB');
    const staticText = new FakeText('Klant Zoeken');
    const root = new FakeElement('main', {}, {
        children: [
            new FakeElement('span', {}, { children: [emailText] }),
            new FakeElement('span', {}, { children: [phoneText] }),
            new FakeElement('span', {}, { children: [ibanText] }),
            new FakeElement('span', {}, { children: [postalText] }),
            new FakeElement('h2', {}, { children: [staticText] })
        ]
    });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(emailText.nodeValue, 'sophie.devries@example.test');
    assert.equal(phoneText.nodeValue, '0612345678');
    assert.equal(ibanText.nodeValue, 'NL91 ABNA 0417 1643 00');
    assert.equal(postalText.nodeValue, '1234 AB');
    assert.equal(staticText.nodeValue, 'Klant Zoeken');

    restore();

    assert.equal(emailText.nodeValue, 'jane@example.org');
    assert.equal(phoneText.nodeValue, '0611111111');
    assert.equal(ibanText.nodeValue, 'NL12ABNA0123456789');
    assert.equal(postalText.nodeValue, '1234AB');
}

function testRedactionSkipsFeedbackUi() {
    const ignoredInput = new FakeElement('input', {}, {
        type: 'password',
        value: 'feedback form value',
        placeholder: 'feedback'
    });
    const ignoredText = new FakeText('jane@example.org');
    const ignoredModal = new FakeElement('div', { 'data-feedback-ignore': '' }, {
        children: [ignoredInput, new FakeElement('span', {}, { children: [ignoredText] })]
    });
    const root = new FakeElement('main', {}, { children: [ignoredModal] });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(ignoredInput.value, 'feedback form value');
    assert.equal(ignoredInput.placeholder, 'feedback');
    assert.equal(ignoredText.nodeValue, 'jane@example.org');

    restore();

    assert.equal(ignoredInput.value, 'feedback form value');
}

function testMediaMaskAndBackgroundsAreHiddenAndRestored() {
    const accountPanel = new FakeElement('section', { 'data-feedback-mask': '' });
    const profilePhoto = new FakeElement('img', {}, { style: { visibility: 'visible' } });
    const root = new FakeElement('main', {}, {
        style: { backgroundImage: 'url(customer-card.png)' },
        children: [accountPanel, profilePhoto]
    });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(root.style.backgroundImage, 'none');
    assert.equal(accountPanel.style.visibility, 'hidden');
    assert.equal(profilePhoto.style.visibility, 'hidden');
    assert.equal(restore.privacySummary?.hiddenElements, undefined);

    restore();

    assert.equal(root.style.backgroundImage, 'url(customer-card.png)');
    assert.equal(accountPanel.style.visibility, '');
    assert.equal(profilePhoto.style.visibility, 'visible');
}

function testPrivacySummaryCountsPseudoValuesAndHiddenElements() {
    const context = createPseudonymContext();
    const customerName = new FakeText('Jane Sensitive');
    const nameElement = new FakeElement('h2', { 'data-feedback-sensitive': 'name' }, {
        children: [customerName]
    });
    const profilePhoto = new FakeElement('img');
    const root = new FakeElement('main', {}, { children: [nameElement, profilePhoto] });

    const restore = redactScreenshotDom({ body: root }, { context });

    assert.equal(context.privacySummary.pseudoValues, 1);
    assert.equal(context.privacySummary.hiddenElements, 1);

    restore();
}

function testFreeTextKeepsDomainContextAndReplacesPii() {
    const contactHistory = new FakeText('Vraag over facturatie voor maria.jansen@email.nl. Uitleg gegeven over automatische incasso.');
    const addressHistory = new FakeText('Adres gewijzigd van Kerkstraat 10 naar Damstraat 42.');
    const root = new FakeElement('main', {}, {
        children: [
            new FakeElement('div', { 'data-feedback-sensitive': 'free-text' }, { children: [contactHistory] }),
            new FakeElement('div', { 'data-feedback-sensitive': 'free-text' }, { children: [addressHistory] })
        ]
    });

    const restore = redactScreenshotDom({ body: root });

    assert.equal(contactHistory.nodeValue, 'Vraag over facturatie voor sophie.devries@example.test. Uitleg gegeven over automatische incasso.');
    assert.equal(addressHistory.nodeValue, 'Adres gewijzigd van Dorpsstraat 12 naar Dorpsstraat 12.');

    restore();

    assert.equal(contactHistory.nodeValue, 'Vraag over facturatie voor maria.jansen@email.nl. Uitleg gegeven over automatische incasso.');
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
    assert.match(stylesheets[0].textContent, /visibility: hidden/);
    assert.doesNotMatch(stylesheets[0].textContent, /color: transparent/);

    restore();

    assert.equal(stylesheets.length, 0);
}

testSensitiveTextIsPseudonymizedAndRestored();
testTypedPseudoValuesAndFormRestore();
testSensitiveScopeKeepsPublicCopy();
testRepeatedValuesUseStableReplacement();
testCustomerProfileKeepsRelatedValuesConsistent();
testEmptyFieldsStayEmptyAndAddressShapeIsPreserved();
testSelectedElementDescriptionIsPseudonymized();
testPatternFallbackCatchesUnmarkedSensitiveValues();
testRedactionSkipsFeedbackUi();
testMediaMaskAndBackgroundsAreHiddenAndRestored();
testPrivacySummaryCountsPseudoValuesAndHiddenElements();
testFreeTextKeepsDomainContextAndReplacesPii();
testRedactionInstallsAndRemovesTemporaryStylesheet();
