// The action disclosure uses the browser's top layer, outside the scrolling outbox list.
const iconPaths = {
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    edit: 'm16 3 5 5M4 20l4-1L21 6a2 2 0 0 0-3-3L5 16l-1 4Z',
    pause: 'M8 5v14M16 5v14',
    resume: 'm8 4 12 8-12 8V4Z',
    delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    inbox: 'M4 4h16l2 12v4H2v-4L4 4ZM2 16h6l2 3h4l2-3h6',
};

export function outboxIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', name === 'more' ? '3.5' : '1.75');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', iconPaths[name]);
    svg.append(path);
    return svg;
}

export function outboxIconButton(label, name, callback, onError, withLabel = false) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'session-outbox-icon-button';
    control.append(outboxIcon(name));
    control.setAttribute('aria-label', label);
    control.title = label;
    control.addEventListener('click', event => { void Promise.resolve(callback(event)).catch(onError); });
    if (withLabel) {
        const text = document.createElement('span');
        text.textContent = label;
        control.append(text);
    }
    return control;
}

export function outboxActionMenu(item, actions, onError) {
    const group = document.createElement('div');
    group.className = 'session-outbox-actions';
    if (!actions.length) return group;
    const popover = document.createElement('div');
    popover.id = `outbox-actions-${item.id}`;
    popover.className = 'session-outbox-menu';
    popover.setAttribute('popover', 'auto');
    popover.setAttribute('aria-label', `Acties voor ${item.summary.customer}`);
    const trigger = outboxIconButton(`Acties voor ${item.summary.customer}`, 'more', event => {
        const bounds = trigger.getBoundingClientRect();
        popover.style.left = `${Math.max(8, Math.min(innerWidth - 212, bounds.right - 204))}px`;
        const menuHeight = actions.length * 40 + 20;
        const top = bounds.bottom + menuHeight + 8 <= innerHeight ? bounds.bottom + 4 : bounds.top - menuHeight - 4;
        popover.style.top = `${Math.max(8, top)}px`;
        popover.showPopover();
        if (event.detail === 0) popover.querySelector('button')?.focus();
    }, onError);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', popover.id);
    popover.addEventListener('toggle', event => trigger.setAttribute('aria-expanded', String(event.newState === 'open')));
    popover.addEventListener('keydown', event => {
        if (event.key === 'Escape') { popover.hidePopover(); trigger.focus(); }
    });
    for (const {label, icon, run} of actions) {
        const control = outboxIconButton(label, icon, async () => {
            popover.hidePopover();
            trigger.focus();
            await run();
        }, onError, true);
        if (icon === 'delete') control.classList.add('is-destructive');
        popover.append(control);
    }
    group.append(trigger, popover);
    return group;
}

export function outboxSessionRow(item, statusLabel, open, actions, onError) {
    const row = document.createElement('article');
    row.className = 'subscription-queue-item session-outbox-item';
    row.dataset.status = item.status;
    const body = document.createElement('div');
    body.className = 'session-outbox-body';
    const title = document.createElement(item.capabilities.edit ? 'button' : 'strong');
    title.className = 'session-outbox-customer';
    title.textContent = item.summary.customer;
    if (item.capabilities.edit) {
        title.type = 'button';
        title.title = 'Sessie openen en pauzeren';
        title.addEventListener('click', () => { void open().catch(onError); });
    }
    const metadata = document.createElement('p');
    metadata.className = 'session-outbox-caption';
    metadata.title = item.contributors.map(actor => item.contributorLabels?.[actor] || actor).join(', ');
    metadata.textContent = `${item.summary.changeCount} ${item.summary.changeCount === 1 ? 'wijziging' : 'wijzigingen'} · ${item.contributors.length} ${item.contributors.length === 1 ? 'bijdrager' : 'bijdragers'}`;
    const status = document.createElement('span');
    status.className = 'session-outbox-state';
    if (item.status === 'paused') status.append(outboxIcon('pause'));
    const seconds = Math.max(0, Math.ceil((Date.parse(item.availableAt) - Date.parse(item.serverTime)) / 1000));
    status.append(document.createTextNode(`${statusLabel}${item.status === 'pending' ? ` · ${seconds} sec.` : ''}`));
    body.append(title, metadata, status);
    row.append(body, outboxActionMenu(item, actions, onError));
    return row;
}
