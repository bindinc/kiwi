export function showFeedbackModal(modal) {
    if (!modal.isConnected) return;
    modal.hidden = false;
    if (!modal.open) modal.showModal();
    syncFeedbackModalState(modal.ownerDocument);
}

export function hideFeedbackModal(modal, opener = null) {
    if (modal.open) modal.close();
    modal.hidden = true;
    syncFeedbackModalState(modal.ownerDocument);

    // These asynchronous flows disable their opener before the native dialog opens.
    if (opener?.isConnected && !opener.disabled && modal.ownerDocument.activeElement !== opener) {
        opener.focus();
    }
}

export function syncFeedbackModalState(documentRef) {
    const dialogs = [...documentRef.querySelectorAll(
        'dialog.contextual-feedback-modal[open], dialog.contextual-feedback-settings-modal[open]'
    )].filter(modal => !modal.hidden && !modal.classList.contains('is-capturing'));
    const reviewingImage = dialogs.some(modal => modal.classList.contains('has-screenshot'));
    documentRef.body.classList.toggle('contextual-feedback-overlay-open', dialogs.length > 0);
    documentRef.body.classList.toggle('contextual-feedback-reviewing', reviewingImage);
}
