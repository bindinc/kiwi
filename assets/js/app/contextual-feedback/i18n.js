import { t } from '../../i18n/index.js';

const TRANSLATION_PREFIX = 'contextualFeedback';

export function feedbackText(key, params = {}, fallback) {
    return t(`${TRANSLATION_PREFIX}.${key}`, params, { fallback });
}

export function feedbackApiError(payload, fallbackKey) {
    const errorCode = typeof payload?.error?.code === 'string'
        ? payload.error.code
        : '';
    const fallbackMessage = feedbackText(fallbackKey);

    if (!errorCode) {
        return fallbackMessage;
    }

    return feedbackText(`apiErrors.${errorCode}`, {}, fallbackMessage);
}
