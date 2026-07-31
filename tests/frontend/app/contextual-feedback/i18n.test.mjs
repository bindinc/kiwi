import assert from 'node:assert/strict';
import en from '../../../../assets/js/i18n/en.js';
import { getLocale, setLocale } from '../../../../assets/js/i18n/index.js';
import nl from '../../../../assets/js/i18n/nl.js';
import { buildFeedbackDialogHtml } from '../../../../assets/js/app/contextual-feedback/dialog.js';
import { feedbackApiError, feedbackText } from '../../../../assets/js/app/contextual-feedback/i18n.js';
import { buildFeedbackSettingsHtml } from '../../../../assets/js/app/contextual-feedback/settings-modal.js';

const SETTINGS = {
    feedbackEnabled: true,
    allowedRoles: ['bink8s.app.kiwi.dev'],
    teamsWebhookConfigured: true,
    teamsWebhookSource: 'database',
    originalDataWebhookConfigured: false,
    originalDataWebhookSource: 'environment',
    publicBaseUrl: 'https://example.org/kiwi',
    imageTtlDays: 30,
    maxImageBytes: 3145728
};

function testFeedbackTranslationsCoverTheSameKeys() {
    assert.deepEqual(
        flattenKeys(nl.contextualFeedback),
        flattenKeys(en.contextualFeedback)
    );
}

function testFeedbackTextFollowsTheActiveKiwiLocale() {
    const previousLocale = getLocale();

    try {
        setLocale('nl');
        assert.equal(feedbackText('dialog.title'), 'Feedback versturen');
        assert.equal(
            feedbackText('picker.minimumArea', { size: 10 }),
            'Selecteer een gebied van minimaal 10 × 10 px'
        );

        setLocale('en');
        assert.equal(feedbackText('dialog.title'), 'Send feedback');
        assert.equal(
            feedbackText('picker.minimumArea', { size: 10 }),
            'Select an area of at least 10 × 10 px'
        );
    } finally {
        setLocale(previousLocale);
    }
}

function testApiErrorsUseLocalizedProblemCodes() {
    const previousLocale = getLocale();

    try {
        setLocale('nl');
        assert.equal(
            feedbackApiError({ error: { code: 'screenshot_too_large' } }, 'submission.failed'),
            'De screenshot is te groot.'
        );
        assert.equal(
            feedbackApiError({ error: { code: 'unknown_error' } }, 'submission.failed'),
            'Feedback kon niet worden verstuurd.'
        );
    } finally {
        setLocale(previousLocale);
    }
}

function testFeedbackDialogAndSettingsRenderInBothLocales() {
    const previousLocale = getLocale();

    try {
        setLocale('nl');
        const dutchDialog = buildFeedbackDialogHtml();
        const dutchSettings = buildFeedbackSettingsHtml(SETTINGS);
        assert.match(dutchDialog, /Feedback versturen/);
        assert.match(dutchDialog, /Geen screenshot toegevoegd/);
        assert.match(dutchDialog, /Opmerking/);
        assert.match(dutchDialog, /Pseudogegevens geselecteerd/);
        assert.match(dutchDialog, /reguliere Teams-workflow/);
        assert.match(dutchDialog, /Pseudogegevens gebruiken/);
        assert.doesNotMatch(dutchDialog, /Handmatig onleesbaar maken beschikbaar/);
        assert.match(dutchSettings, /Feedbackinstellingen/);
        assert.match(dutchSettings, /Microsoft Teams-koppeling/);

        setLocale('en');
        const englishDialog = buildFeedbackDialogHtml();
        const englishSettings = buildFeedbackSettingsHtml(SETTINGS);
        assert.match(englishDialog, /Send feedback/);
        assert.match(englishDialog, /No screenshot attached/);
        assert.match(englishDialog, /Comment/);
        assert.match(englishDialog, /Pseudo data selected/);
        assert.match(englishDialog, /standard Teams workflow/);
        assert.match(englishDialog, /Use pseudo data/);
        assert.doesNotMatch(englishDialog, /Manual redaction available/);
        assert.match(englishSettings, /Feedback settings/);
        assert.match(englishSettings, /Microsoft Teams connector/);
    } finally {
        setLocale(previousLocale);
    }
}

function flattenKeys(value, prefix = '') {
    const keys = [];

    for (const [key, nestedValue] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
            keys.push(...flattenKeys(nestedValue, path));
            continue;
        }

        keys.push(path);
    }

    return keys.sort();
}

testFeedbackTranslationsCoverTheSameKeys();
testFeedbackTextFollowsTheActiveKiwiLocale();
testApiErrorsUseLocalizedProblemCodes();
testFeedbackDialogAndSettingsRenderInBothLocales();
