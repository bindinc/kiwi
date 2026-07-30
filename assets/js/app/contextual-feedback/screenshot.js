import { toBlob, toCanvas } from 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';
import { createPseudonymContext, pseudonymizeSelectedElement, redactScreenshotDom } from './screenshot-redaction.js';
import { calculateCanvasCrop } from './screenshot-crop.js';

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

export async function captureAreaScreenshot({
    rect,
    selectedElement,
    documentRef = document,
    windowRef = window,
    maxDimension = 1600
} = {}) {
    if (!rect || rect.width < 1 || rect.height < 1) {
        throw new Error('No area selected for screenshot capture.');
    }

    const captureRoot = documentRef.body;
    if (!captureRoot) {
        throw new Error('No document body available for screenshot capture.');
    }

    const documentSize = getDocumentSize(documentRef, windowRef);
    const context = createPseudonymContext();
    const originalContext = createPseudonymContext();

    const original = await captureAreaScreenshotVariant({
        captureRoot,
        rect,
        documentSize,
        documentRef,
        windowRef,
        maxDimension,
        context: originalContext,
        pseudonymizeText: false
    });
    const pseudonymized = await captureAreaScreenshotVariant({
        captureRoot,
        rect,
        documentSize,
        documentRef,
        windowRef,
        maxDimension,
        context,
        pseudonymizeText: true
    });

    return {
        original,
        pseudonymized,
        selectedElement,
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

        return downscalePngBlob(blob, maxDimension, documentRef);
    } finally {
        restoreScreenshotDom();
    }
}

async function captureAreaScreenshotVariant({
    captureRoot,
    rect,
    documentSize,
    documentRef,
    windowRef,
    maxDimension,
    context,
    pseudonymizeText
}) {
    const restoreScreenshotDom = redactScreenshotDom(documentRef, {
        root: captureRoot,
        context,
        pseudonymizeText
    });

    try {
        const pageCanvas = await toCanvas(captureRoot, {
            cacheBust: true,
            pixelRatio: 1,
            width: documentSize.width,
            height: documentSize.height,
            canvasWidth: documentSize.width,
            canvasHeight: documentSize.height,
            backgroundColor: '#ffffff',
            filter: includeScreenshotNode,
            style: {
                width: `${documentSize.width}px`,
                minWidth: `${documentSize.width}px`,
                height: `${documentSize.height}px`,
                minHeight: `${documentSize.height}px`
            }
        });
        const blob = await cropPageCanvas({
            pageCanvas,
            rect,
            documentSize,
            scrollX: Number(windowRef.scrollX || windowRef.pageXOffset || 0),
            scrollY: Number(windowRef.scrollY || windowRef.pageYOffset || 0),
            documentRef
        });

        return downscalePngBlob(blob, maxDimension, documentRef);
    } finally {
        restoreScreenshotDom();
    }
}

export async function cropPageCanvas({
    pageCanvas,
    rect,
    documentSize,
    scrollX = 0,
    scrollY = 0,
    documentRef = document
}) {
    const crop = calculateCanvasCrop({
        rect,
        documentSize,
        canvasSize: {
            width: pageCanvas.width,
            height: pageCanvas.height
        },
        scrollX,
        scrollY
    });
    const canvas = documentRef.createElement('canvas');
    canvas.width = crop.targetWidth;
    canvas.height = crop.targetHeight;

    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
        pageCanvas,
        crop.sourceX,
        crop.sourceY,
        crop.sourceWidth,
        crop.sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
    );

    return canvasToPngBlob(canvas, 'Could not crop selected screenshot area.');
}

function serializePrivacySummary(privacySummary) {
    return {
        pseudoValues: privacySummary.pseudoValues,
        hiddenElements: privacySummary.hiddenElements,
        hiddenElementTypes: Array.from(privacySummary.hiddenElementTypes || [])
    };
}

async function downscalePngBlob(blob, maxDimension, documentRef = document) {
    const image = await blobToImage(blob);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    if (scale === 1) {
        return { blob, width, height };
    }

    const canvas = documentRef.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);

    const downscaledBlob = await canvasToPngBlob(canvas, 'Could not downscale screenshot.');

    return { blob: downscaledBlob, width, height };
}

function getDocumentSize(documentRef, windowRef) {
    const body = documentRef.body;
    const root = documentRef.documentElement;

    return {
        width: Math.max(
            Number(windowRef.innerWidth || 1),
            Number(body?.scrollWidth || 0),
            Number(body?.offsetWidth || 0),
            Number(root?.clientWidth || 0),
            Number(root?.scrollWidth || 0),
            Number(root?.offsetWidth || 0)
        ),
        height: Math.max(
            Number(windowRef.innerHeight || 1),
            Number(body?.scrollHeight || 0),
            Number(body?.offsetHeight || 0),
            Number(root?.clientHeight || 0),
            Number(root?.scrollHeight || 0),
            Number(root?.offsetHeight || 0)
        )
    };
}

function includeScreenshotNode(node) {
    return node?.nodeType !== 1 || !node.closest?.('[data-feedback-ignore]');
}

function canvasToPngBlob(canvas, errorMessage) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error(errorMessage));
            }
        }, 'image/png');
    });
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
