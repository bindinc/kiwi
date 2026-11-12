import assert from 'node:assert/strict';
import { renderOverlayNotification } from '../../../assets/js/app/overlay-notification.js';
import { createFeedbackDocument } from '../support/feedback-dom.mjs';

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const timers = new Map();
let nextTimer = 0;
globalThis.setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
try {
    const documentRef = createFeedbackDocument();
    assert.equal(renderOverlayNotification(documentRef, 'No open overlay', 'error'), false);
    const overlay = documentRef.createElement('div');
    overlay.className = 'form-container';
    overlay.innerHTML = '<div class="card"><textarea></textarea><div class="form-actions"><button type="submit">Save</button></div></div>';
    documentRef.body.append(overlay);
    const field = overlay.querySelector('textarea');
    field.value = 'Retained synthetic draft';
    field.focus();
    const fullMessage = 'Synthetic request failed: <img src=x onerror=alert(1)> ' + 'Detailed recovery instructions. '.repeat(15);
    assert.equal(renderOverlayNotification(documentRef, fullMessage, 'error'), true);
    const error = overlay.querySelector('.overlay-notification');
    assert.equal(error.textContent, fullMessage);
    assert.equal(error.children.length, 0, 'dynamic request text is never parsed as markup');
    assert.equal(error.getAttribute('data-feedback-sensitive'), 'opaque-text');
    assert.equal(error.getAttribute('role'), 'alert');
    assert.equal(error.parentElement, overlay.querySelector('.form-actions'));
    assert.equal(error.parentElement.scrolled, true, 'message and actions are revealed together');
    assert.equal(documentRef.activeElement, field, 'presentation cannot steal focus');
    assert.equal(field.value, 'Retained synthetic draft');
    assert.equal(timers.size, 0, 'critical in-form errors persist until an attempt, new notice or close');
    await documentRef.emit('submit', field);
    assert.equal(overlay.querySelector('.overlay-notification'), null);

    renderOverlayNotification(documentRef, 'Synthetic progress', 'info');
    assert.equal(timers.size, 1);
    const [oldTimerId, oldTimer] = [...timers][0];
    assert.equal(oldTimer.delay, 3000);
    renderOverlayNotification(documentRef, 'New persistent request error', 'error');
    assert.equal(timers.has(oldTimerId), false);
    oldTimer.callback();
    assert.equal(overlay.querySelector('.overlay-notification').textContent, 'New persistent request error');
    await documentRef.emit('click', overlay.querySelector('button'));
    assert.equal(overlay.querySelector('.overlay-notification'), null);
    renderOverlayNotification(documentRef, 'Cleared on close', 'error');
    overlay.hidden = true;
    assert.equal(overlay.querySelector('.overlay-notification'), null);
    overlay.hidden = false;
    assert.equal(overlay.querySelector('.overlay-notification'), null, 'reopen cannot resurrect a stale error');

    const native = documentRef.createElement('dialog');
    native.innerHTML = '<div class="modal-actions"><button>Close</button></div>';
    documentRef.body.append(native);
    native.showModal();
    native.querySelector('button').focus();
    renderOverlayNotification(documentRef, 'Native form error', 'error');
    assert.equal(native.querySelector('.overlay-notification').textContent, 'Native form error');
    native.close();
    assert.equal(native.querySelector('.overlay-notification'), null);
    native.remove();
    overlay.setAttribute('data-feedback-public', 'true');
    field.focus();
    assert.equal(renderOverlayNotification(documentRef, 'Private dynamic text', 'error'), false, 'never insert private text under a public capture ancestor');
} finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
}
