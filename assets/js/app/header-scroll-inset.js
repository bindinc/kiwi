// Native scrollIntoView must clear the live frame as customer and call context change its height.
export function observeHeaderScrollInset({ header, documentRef = document, windowRef = window }) {
    const root = documentRef.documentElement;
    let lastInset = null;

    function updateInset() {
        const isSticky = windowRef.getComputedStyle(header).position === 'sticky';
        const gutter = parseFloat(windowRef.getComputedStyle(root).getPropertyValue('--workspace-padding')) || 0;
        const inset = isSticky ? Math.ceil(header.getBoundingClientRect().height + gutter) : 0;
        if (inset === lastInset) return;

        lastInset = inset;
        root.style.setProperty('--header-scroll-inset', `${inset}px`);
    }

    updateInset();
    const observer = new windowRef.ResizeObserver(updateInset);
    observer.observe(header, { box: 'border-box' });
    // A height breakpoint can disable sticky positioning without resizing the header itself.
    windowRef.addEventListener('resize', updateInset);
    windowRef.visualViewport?.addEventListener('resize', updateInset);

    return () => {
        observer.disconnect();
        windowRef.removeEventListener('resize', updateInset);
        windowRef.visualViewport?.removeEventListener('resize', updateInset);
        root.style.removeProperty('--header-scroll-inset');
    };
}
