import assert from 'node:assert/strict';
import { buildSubmission } from '../../../../assets/js/app/contextual-feedback/dialog.js';

const annotationCanvas = {
    async exportFinalPngBlobFor(blob) {
        return blob;
    },
    getAnnotations() {
        return [];
    }
};

async function testUnverifiedPseudonymizationFailsClosedToOriginalWorkflow() {
    const submission = await buildSubmission({
        annotationCanvas,
        screenshot: createScreenshot({ verified: false }),
        pseudonymizationCheckbox: { checked: true }
    });

    assert.equal(submission.teamsScreenshotVariant, 'original');
    assert.equal(submission.screenshots.pseudonymized, 'pseudo-blob');
    assert.equal(submission.screenshots.original, 'original-blob');
}

async function testVerifiedPseudonymizationUsesRegularWorkflow() {
    const submission = await buildSubmission({
        annotationCanvas,
        screenshot: createScreenshot({ verified: true }),
        pseudonymizationCheckbox: { checked: true }
    });

    assert.equal(submission.teamsScreenshotVariant, 'pseudonymized');
}

function createScreenshot(privacySummary) {
    return {
        selectionKind: 'element',
        selectedElement: { tag: 'div', label: 'Selected element', selector: '#target', textSample: null },
        selectedRect: { x: 0, y: 0, width: 100, height: 50 },
        privacySummary,
        screenshots: {
            pseudonymized: { blob: 'pseudo-blob' },
            original: { blob: 'original-blob' }
        }
    };
}

await testUnverifiedPseudonymizationFailsClosedToOriginalWorkflow();
await testVerifiedPseudonymizationUsesRegularWorkflow();
