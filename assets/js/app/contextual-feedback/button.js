export function initFeedbackButton({ documentRef = document, onClick }) {
    const button = documentRef.getElementById('contextualFeedbackButton');
    if (!button) {
        return null;
    }

    button.addEventListener('click', () => {
        if (button.disabled) {
            return;
        }

        onClick?.(button);
    });

    return button;
}
