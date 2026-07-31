import domToImage from 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm';
import { createPseudonymContext, pseudonymizeScreenshotClone, pseudonymizeSelectedElement } from './screenshot-redaction.js';
import { calculateCanvasCrop } from './screenshot-crop.js';
import { feedbackText } from './i18n.js';

export async function captureElementScreenshot({
    element,
    selectedElement,
    documentRef = document,
    maxDimension = 1600
} = {}) {
    if (!element) {
        throw new Error(feedbackText('capture.noElement'));
    }

    await waitForRenderableResources(element, documentRef);
    const measurements = measureCapture(element, documentRef, documentRef.defaultView || globalThis.window);
    const rect = measurements.rootRect;
    const captureWidth = Math.max(1, Math.round(rect.width || element.scrollWidth || 1));
    const captureHeight = Math.max(1, Math.round(rect.height || element.scrollHeight || 1));
    const context = createPseudonymContext();

    const original = await captureScreenshotVariant({
        element,
        documentRef,
        captureWidth,
        captureHeight,
        maxDimension,
        measurements,
        pseudonymizeText: false
    });
    const pseudonymized = await captureScreenshotVariant({
        element,
        documentRef,
        captureWidth,
        captureHeight,
        maxDimension,
        context,
        measurements,
        pseudonymizeText: true
    });

    context.privacySummary.resourceFailures = Math.max(
        original.resourceFailures,
        pseudonymized.resourceFailures
    );

    return {
        original: withoutCaptureMetadata(original),
        pseudonymized: withoutCaptureMetadata(pseudonymized),
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
        throw new Error(feedbackText('capture.noArea'));
    }

    const captureRoot = documentRef.body;
    if (!captureRoot) {
        throw new Error(feedbackText('capture.noDocumentBody'));
    }

    await waitForRenderableResources(captureRoot, documentRef);
    const measurements = measureCapture(captureRoot, documentRef, windowRef);
    const documentSize = measurements.documentSize;
    const context = createPseudonymContext();

    const original = await captureAreaScreenshotVariant({
        captureRoot,
        rect,
        documentSize,
        documentRef,
        windowRef,
        maxDimension,
        measurements,
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
        measurements,
        pseudonymizeText: true
    });

    context.privacySummary.resourceFailures = Math.max(
        original.resourceFailures,
        pseudonymized.resourceFailures
    );

    return {
        original: withoutCaptureMetadata(original),
        pseudonymized: withoutCaptureMetadata(pseudonymized),
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
    measurements,
    pseudonymizeText
}) {
    const resources = createResourceTracker(measurements.failedImages);
    const blob = await domToImage.toBlob(element, createRenderOptions({
        documentRef,
        width: captureWidth,
        height: captureHeight,
        context,
        measurements,
        pseudonymizeText,
        normalizeRoot: true,
        resources
    }));

    if (!blob) {
        throw new Error(feedbackText('capture.noImage'));
    }

    const result = await downscalePngBlob(blob, maxDimension, documentRef);
    return { ...result, resourceFailures: resources.count };
}

async function captureAreaScreenshotVariant({
    captureRoot,
    rect,
    documentSize,
    documentRef,
    windowRef,
    maxDimension,
    context,
    measurements,
    pseudonymizeText
}) {
    const resources = createResourceTracker(measurements.failedImages);
    const pageCanvas = await domToImage.toCanvas(captureRoot, createRenderOptions({
        documentRef,
        width: documentSize.width,
        height: documentSize.height,
        context,
        measurements,
        pseudonymizeText,
        normalizeRoot: false,
        resources
    }));
    const blob = await cropPageCanvas({
        pageCanvas,
        rect,
        documentSize,
        scrollX: measurements.scrollX,
        scrollY: measurements.scrollY,
        documentRef
    });

    const result = await downscalePngBlob(blob, maxDimension, documentRef);
    return { ...result, resourceFailures: resources.count };
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

    return canvasToPngBlob(canvas, feedbackText('capture.cropFailed'));
}

function serializePrivacySummary(privacySummary) {
    return {
        pseudoValues: privacySummary.pseudoValues,
        maskedElements: privacySummary.maskedElements,
        maskedElementTypes: Array.from(privacySummary.maskedElementTypes || []),
        resourceFailures: privacySummary.resourceFailures,
        unresolvedValues: privacySummary.unresolvedValues,
        verified: privacySummary.verified
    };
}

function withoutCaptureMetadata(result) {
    return {
        blob: result.blob,
        width: result.width,
        height: result.height
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

    const downscaledBlob = await canvasToPngBlob(canvas, feedbackText('capture.downscaleFailed'));

    return { blob: downscaledBlob, width, height };
}

function createRenderOptions({
    documentRef,
    width,
    height,
    context,
    measurements,
    pseudonymizeText,
    normalizeRoot,
    resources
}) {
    return {
        cacheBust: true,
        pixelRatio: 1,
        width,
        height,
        bgcolor: '#ffffff',
        preserveScroll: true,
        styleCaching: 'strict',
        imagePlaceholder: transparentPixel(),
        filter: includeScreenshotNode,
        onImageError() {
            resources.addFailure();
        },
        adjustClonedNode(originalNode, clonedNode, after) {
            if (after || originalNode?.nodeType !== 1 || clonedNode?.nodeType !== 1) {
                return clonedNode;
            }

            restoreMeasuredScroll(originalNode, clonedNode, measurements);
            if (pseudonymizeText) {
                lockSensitiveGeometry(originalNode, clonedNode, measurements);
            }
            replaceUnsupportedResource(originalNode, clonedNode, resources);

            return clonedNode;
        },
        onclone(clonedRoot) {
            freezeClone(clonedRoot, documentRef);
            if (normalizeRoot) {
                normalizeClonedRoot(clonedRoot, width, height);
            }
            if (pseudonymizeText) {
                pseudonymizeScreenshotClone(clonedRoot, context);
            }
        }
    };
}

function measureCapture(root, documentRef, windowRef) {
    const geometry = new WeakMap();
    const scrollPositions = new WeakMap();
    const elements = [root, ...Array.from(root.querySelectorAll?.('*') || [])];
    let failedImages = 0;

    for (const element of elements) {
        if (typeof element.getBoundingClientRect === 'function') {
            const rect = element.getBoundingClientRect();
            geometry.set(element, {
                width: rect.width,
                height: rect.height
            });
        }

        if (Number(element.scrollLeft || 0) !== 0 || Number(element.scrollTop || 0) !== 0) {
            scrollPositions.set(element, {
                left: Number(element.scrollLeft || 0),
                top: Number(element.scrollTop || 0)
            });
        }

        if (String(element.tagName || '').toUpperCase() === 'IMG' && element.complete && element.naturalWidth === 0) {
            failedImages += 1;
        }
    }

    return {
        rootRect: root.getBoundingClientRect(),
        documentSize: getDocumentSize(documentRef, windowRef),
        scrollX: Number(windowRef.scrollX || windowRef.pageXOffset || 0),
        scrollY: Number(windowRef.scrollY || windowRef.pageYOffset || 0),
        geometry,
        scrollPositions,
        failedImages
    };
}

function lockSensitiveGeometry(originalNode, clonedNode, measurements) {
    if (!shouldLockGeometry(originalNode)) {
        return;
    }

    const rect = measurements.geometry.get(originalNode);
    if (!rect || rect.width < 1 || rect.height < 1) {
        return;
    }

    const computedStyle = originalNode.ownerDocument?.defaultView?.getComputedStyle?.(originalNode);
    if (computedStyle?.display === 'inline') {
        clonedNode.style.display = 'inline-block';
    }
    clonedNode.style.boxSizing = 'border-box';
    clonedNode.style.width = `${rect.width}px`;
    clonedNode.style.minWidth = `${rect.width}px`;
    clonedNode.style.maxWidth = `${rect.width}px`;
    clonedNode.style.height = `${rect.height}px`;
    clonedNode.style.minHeight = `${rect.height}px`;
    clonedNode.style.maxHeight = `${rect.height}px`;
    clonedNode.style.overflow = 'hidden';
}

function shouldLockGeometry(element) {
    if (element.matches?.('[data-feedback-sensitive], [data-feedback-mask]')) {
        return true;
    }

    const tagName = String(element.tagName || '').toUpperCase();
    if (['INPUT', 'OPTION', 'SELECT', 'TEXTAREA'].includes(tagName) && String(element.value || '').trim()) {
        return true;
    }

    const identity = [element.id, element.className, element.name, element.getAttribute?.('aria-label')].join(' ');
    return /(caller|customer|klant|person|persoon|subscriber|abon|name|naam|email|mail|phone|telefoon|adres|address|remark|note)/i.test(identity);
}

function restoreMeasuredScroll(originalNode, clonedNode, measurements) {
    const scroll = measurements.scrollPositions.get(originalNode);
    if (!scroll) {
        return;
    }

    clonedNode.scrollLeft = scroll.left;
    clonedNode.scrollTop = scroll.top;
}

function replaceUnsupportedResource(originalNode, clonedNode, resources) {
    const tagName = String(originalNode.tagName || '').toUpperCase();
    if (!['EMBED', 'IFRAME', 'OBJECT', 'VIDEO'].includes(tagName)) {
        return;
    }

    resources.addUnsupported(originalNode);
    clonedNode.removeAttribute?.('src');
    clonedNode.removeAttribute?.('srcdoc');
    clonedNode.style.background = '#d9dde3';
    clonedNode.style.color = '#4b5563';
    clonedNode.style.border = '1px solid #9ca3af';
}

function freezeClone(clonedRoot, documentRef) {
    const style = (clonedRoot.ownerDocument || documentRef).createElement('style');
    style.textContent = `
        *, *::before, *::after {
            animation: none !important;
            caret-color: transparent !important;
            scroll-behavior: auto !important;
            transition: none !important;
        }
    `;
    clonedRoot.prepend?.(style);
}

function normalizeClonedRoot(clonedRoot, width, height) {
    clonedRoot.style.margin = '0';
    clonedRoot.style.boxSizing = 'border-box';
    clonedRoot.style.width = `${width}px`;
    clonedRoot.style.height = `${height}px`;
}

function createResourceTracker(initialFailures = 0) {
    const unsupportedNodes = new WeakSet();
    let count = initialFailures;

    return {
        get count() {
            return count;
        },
        addFailure() {
            count += 1;
        },
        addUnsupported(node) {
            if (unsupportedNodes.has(node)) {
                return;
            }
            unsupportedNodes.add(node);
            count += 1;
        }
    };
}

async function waitForRenderableResources(root, documentRef) {
    const tasks = [];
    if (documentRef.fonts?.ready) {
        tasks.push(documentRef.fonts.ready);
    }

    for (const image of root.querySelectorAll?.('img') || []) {
        if (!image.complete && typeof image.decode === 'function') {
            tasks.push(image.decode().catch(() => undefined));
        }
    }

    if (tasks.length === 0) {
        return;
    }

    await Promise.race([
        Promise.allSettled(tasks),
        new Promise((resolve) => globalThis.setTimeout(resolve, 2000))
    ]);
}

function transparentPixel() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==';
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
            reject(new Error(feedbackText('capture.readFailed')));
        }, { once: true });
        image.src = url;
    });
}
