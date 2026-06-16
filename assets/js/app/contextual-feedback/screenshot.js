import { toBlob } from 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';

const SENSITIVE_FIELD_SELECTOR = [
    'input[type="password"]',
    'input[name*="token" i]',
    'input[name*="secret" i]',
    'input[name*="password" i]',
    'textarea[name*="token" i]',
    'textarea[name*="secret" i]',
    '[data-feedback-mask]'
].join(',');

export async function captureViewportScreenshot({
    documentRef = document,
    windowRef = window,
    maxDimension = 1600
} = {}) {
    const root = documentRef.body;
    const viewportWidth = Math.max(1, Math.round(windowRef.innerWidth || root.clientWidth || 1));
    const viewportHeight = Math.max(1, Math.round(windowRef.innerHeight || root.clientHeight || 1));

    const restoreSensitiveFields = maskSensitiveFields(documentRef);
    try {
        const blob = await toBlob(root, {
            cacheBust: true,
            pixelRatio: 1,
            width: viewportWidth,
            height: viewportHeight,
            canvasWidth: viewportWidth,
            canvasHeight: viewportHeight,
            backgroundColor: '#ffffff',
            filter(node) {
                return !(node instanceof Element) || !node.closest('[data-feedback-ignore]');
            },
            style: {
                width: `${viewportWidth}px`,
                height: `${viewportHeight}px`,
                overflow: 'hidden'
            }
        });

        if (!blob) {
            throw new Error('Screenshot capture returned no image.');
        }

        return downscalePngBlob(blob, maxDimension);
    } finally {
        restoreSensitiveFields();
    }
}

function maskSensitiveFields(documentRef) {
    const fields = Array.from(documentRef.querySelectorAll(SENSITIVE_FIELD_SELECTOR));
    const previousValues = fields.map((field) => ({
        field,
        value: 'value' in field ? field.value : field.textContent
    }));

    for (const field of fields) {
        if ('value' in field) {
            field.value = '';
            field.placeholder = 'redacted';
        } else {
            field.textContent = 'redacted';
        }
    }

    return () => {
        for (const item of previousValues) {
            if ('value' in item.field) {
                item.field.value = item.value;
            } else {
                item.field.textContent = item.value;
            }
        }
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
