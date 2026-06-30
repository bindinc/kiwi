import { toBlob } from 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';
import { createPseudonymContext, pseudonymizeSelectedElement, redactScreenshotDom } from './screenshot-redaction.js';

export async function captureElementScreenshot({
    element,
    selectedElement,
    documentRef = document,
    maxDimension = 1600
} = {}) {
    if (!element) {
        throw new Error('No element selected for screenshot capture.');
    }

    const rect = element.getBoundingClientRect();
    const captureWidth = Math.max(1, Math.round(rect.width || element.scrollWidth || 1));
    const captureHeight = Math.max(1, Math.round(rect.height || element.scrollHeight || 1));
    const context = createPseudonymContext();
    const originalContext = createPseudonymContext();

    const original = await captureScreenshotVariant({
        element,
        documentRef,
        captureWidth,
        captureHeight,
        maxDimension,
        context: originalContext,
        pseudonymizeText: false
    });
    const pseudonymized = await captureScreenshotVariant({
        element,
        documentRef,
        captureWidth,
        captureHeight,
        maxDimension,
        context,
        pseudonymizeText: true
    });

    return {
        original,
        pseudonymized,
        selectedElement: pseudonymizeSelectedElement(selectedElement, context),
        privacySummary: serializePrivacySummary(context.privacySummary)
    };
}

async function captureScreenshotVariant({
    element,
    documentRef,
    captureWidth,
    captureHeight,
    maxDimension,
    context,
    pseudonymizeText
}) {
    const restoreScreenshotDom = redactScreenshotDom(documentRef, {
        root: documentRef.body,
        context,
        pseudonymizeText
    });

    try {
        const blob = await toBlob(element, {
            cacheBust: true,
            pixelRatio: 1,
            width: captureWidth,
            height: captureHeight,
            canvasWidth: captureWidth,
            canvasHeight: captureHeight,
            backgroundColor: '#ffffff',
            filter(node) {
                return !(node instanceof Element) || !node.closest('[data-feedback-ignore]');
            },
            style: {
                width: `${captureWidth}px`,
                minWidth: `${captureWidth}px`,
                height: `${captureHeight}px`,
                minHeight: `${captureHeight}px`
            }
        });

        if (!blob) {
            throw new Error('Screenshot capture returned no image.');
        }

        return downscalePngBlob(blob, maxDimension);
    } finally {
        restoreScreenshotDom();
    }
}

function serializePrivacySummary(privacySummary) {
    return {
        pseudoValues: privacySummary.pseudoValues,
        hiddenElements: privacySummary.hiddenElements,
        hiddenElementTypes: Array.from(privacySummary.hiddenElementTypes || [])
    };
}

async function downscalePngBlob(blob, maxDimension) {
    const image = await blobToImage(blob);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    if (scale === 1) {
        return { blob, width, height };
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);

    const downscaledBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
            if (nextBlob) {
                resolve(nextBlob);
            } else {
                reject(new Error('Could not downscale screenshot.'));
            }
        }, 'image/png');
    });

    return { blob: downscaledBlob, width, height };
}

function blobToImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.addEventListener('load', () => {
            URL.revokeObjectURL(url);
            resolve(image);
        }, { once: true });
        image.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read captured screenshot.'));
        }, { once: true });
        image.src = url;
    });
}
