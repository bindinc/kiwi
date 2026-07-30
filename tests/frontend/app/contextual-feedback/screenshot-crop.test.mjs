import assert from 'node:assert/strict';
import { calculateCanvasCrop } from '../../../../assets/js/app/contextual-feedback/screenshot-crop.js';

function testCropUsesScrollOffsetAndCanvasScale() {
    assert.deepEqual(calculateCanvasCrop({
        rect: { x: 25, y: 40, width: 120, height: 80 },
        documentSize: { width: 1000, height: 2000 },
        canvasSize: { width: 500, height: 1000 },
        scrollX: 10,
        scrollY: 300
    }), {
        sourceX: 17.5,
        sourceY: 170,
        sourceWidth: 60,
        sourceHeight: 40,
        targetWidth: 120,
        targetHeight: 80
    });
}

function testCropRoundsOutputDimensionsToCssPixels() {
    const crop = calculateCanvasCrop({
        rect: { x: 0, y: 0, width: 10.4, height: 15.6 },
        documentSize: { width: 100, height: 100 },
        canvasSize: { width: 100, height: 100 }
    });

    assert.equal(crop.targetWidth, 10);
    assert.equal(crop.targetHeight, 16);
}

testCropUsesScrollOffsetAndCanvasScale();
testCropRoundsOutputDimensionsToCssPixels();
