export function copyScreenshotFormState(original, clone) {
    const tagName = String(original.tagName || '').toUpperCase();

    if (tagName === 'SELECT') {
        const selectedOptions = Array.from(original.options, option => option.selected);
        Array.from(clone.options).forEach((option, index) => {
            option.selected = selectedOptions[index];
        });
        return;
    }

    if (tagName === 'INPUT') {
        if (original.type !== 'file') {
            clone.value = original.value;
        }
        clone.checked = original.checked;
        clone.indeterminate = original.indeterminate;
        return;
    }

    if (tagName === 'TEXTAREA') {
        clone.value = original.value;
    }
}

// SVG serialization reads attributes and textarea content, not the current DOM properties.
// Run this only on the detached clone, after pseudonymization has changed those properties.
export function serializeScreenshotFormState(root) {
    const elements = [root, ...Array.from(root.querySelectorAll('*'))];

    for (const element of elements) {
        const tagName = String(element.tagName || '').toUpperCase();
        if (tagName === 'INPUT') {
            if (element.type !== 'file') {
                element.setAttribute('value', element.value);
            }
            element.toggleAttribute('checked', element.checked);
        } else if (tagName === 'TEXTAREA') {
            element.textContent = element.value;
        } else if (tagName === 'SELECT') {
            const options = Array.from(element.options);
            const selectedOptions = options.map(option => option.selected);
            options.forEach((option, index) => {
                option.toggleAttribute('selected', selectedOptions[index]);
            });
        }
    }
}
