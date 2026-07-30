import assert from 'node:assert/strict';
import { buildFeedbackPayload } from '../../../../assets/js/app/contextual-feedback/payload.js';

function testPayloadUsesRuntimeMetadata() {
    const payload = buildFeedbackPayload({
        comment: 'Button overlaps.',
        severity: 'normal',
        category: 'bug',
        selectionKind: 'element',
        teamsScreenshotVariant: 'original',
        selectedElement: {
            tag: 'button',
            label: 'Create subscription',
            selector: '[data-feedback-id="create"]',
            textSample: 'Create'
        },
        selectedRect: {
            x: 10.123,
            y: 20.456,
            width: 100.789,
            height: 40.111
        },
        annotations: [{ type: 'rectangle' }],
        locationRef: {
            href: 'https://bdc.rtvmedia.org.local/kiwi/customer?id=1',
            pathname: '/kiwi/customer',
            search: '?id=1'
        },
        windowRef: {
            innerWidth: 1440,
            innerHeight: 900,
            devicePixelRatio: 1
        },
        navigatorRef: {
            userAgent: 'node-test'
        }
    });

    assert.deepEqual(payload, {
        comment: 'Button overlaps.',
        severity: 'normal',
        category: 'bug',
        selectionKind: 'element',
        teamsScreenshotVariant: 'original',
        pageUrl: 'https://bdc.rtvmedia.org.local/kiwi/customer?id=1',
        routePath: '/kiwi/customer?id=1',
        userAgent: 'node-test',
        viewport: {
            width: 1440,
            height: 900,
            devicePixelRatio: 1
        },
        selectedElement: {
            tag: 'button',
            label: 'Create subscription',
            selector: '[data-feedback-id="create"]',
            textSample: 'Create',
            rect: {
                x: 10.12,
                y: 20.46,
                width: 100.79,
                height: 40.11
            }
        },
        annotations: [{ type: 'rectangle' }]
    });
}

function testPayloadSupportsFeedbackWithoutScreenshot() {
    const payload = buildFeedbackPayload({
        comment: 'The labels are unclear.',
        severity: 'low',
        category: 'chore',
        locationRef: {
            href: 'https://bdc.rtvmedia.org.local/kiwi/customer',
            pathname: '/kiwi/customer',
            search: ''
        },
        windowRef: {
            innerWidth: 1280,
            innerHeight: 720,
            devicePixelRatio: 2
        },
        navigatorRef: {
            userAgent: 'node-test'
        }
    });

    assert.deepEqual(payload, {
        comment: 'The labels are unclear.',
        severity: 'low',
        category: 'chore',
        selectionKind: 'none',
        pageUrl: 'https://bdc.rtvmedia.org.local/kiwi/customer',
        routePath: '/kiwi/customer',
        userAgent: 'node-test',
        viewport: {
            width: 1280,
            height: 720,
            devicePixelRatio: 2
        },
        annotations: []
    });
}

testPayloadUsesRuntimeMetadata();
testPayloadSupportsFeedbackWithoutScreenshot();
