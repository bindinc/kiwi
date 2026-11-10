export function localCalendarDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function createSubscriptionStartDates({ document, getContext, fetchDate, translate }) {
    let entries = new Map();
    const contextKey = () => JSON.stringify(getContext());
    const identity = (offer) => JSON.stringify([
        contextKey(), offer.salesCode, offer.credentialKey, offer.productCode, offer.subscriptionKind, offer.variantCodes
    ]);
    const text = (key) => translate(`subscriptionStartDates.${key}`);

    function element(tag, content = '') {
        const node = document.createElement(tag);
        node.textContent = content;
        return node;
    }

    function render() {
        const container = document.getElementById('subscriptionStartDates');
        if (!container) return;
        const focusedId = document.activeElement?.id;
        container.replaceChildren();
        let hasMembership = false;
        for (const entry of entries.values()) {
            if (entry.offer.subscriptionKind === 'membership') {
                hasMembership = true;
                continue;
            }
            const group = element('fieldset');
            group.className = 'subscription-start-date';
            group.append(element('legend', entry.offer.title || entry.offer.salesCode));
            if (entry.variants.length > 1) {
                const label = element('label', text('edition'));
                const select = element('select');
                select.id = `subscription-edition-${entry.offer.salesCode}`;
                select.required = true;
                label.htmlFor = select.id;
                const placeholder = element('option', text('chooseEdition'));
                placeholder.value = '';
                select.append(placeholder);
                for (const variant of entry.variants) {
                    const option = element('option', variant);
                    option.value = variant;
                    select.append(option);
                }
                select.value = entry.variantCode;
                select.addEventListener('change', () => {
                    entry.variantCode = select.value;
                    void load(entry);
                });
                const row = element('div');
                row.className = 'form-row';
                row.append(select);
                group.append(label, row);
            }
            const label = element('label', text('deliveryDate'));
            const input = element('input');
            input.id = `subscription-date-${entry.offer.salesCode}`;
            input.type = 'date';
            input.readOnly = true;
            input.value = entry.date || '';
            label.htmlFor = input.id;
            const status = element('p', text(entry.status));
            status.id = `${input.id}-status`;
            status.setAttribute('role', 'status');
            input.setAttribute('aria-describedby', status.id);
            const row = element('div');
            row.className = 'form-row';
            row.append(input);
            group.append(label, row, status);
            if (entry.status === 'unavailable') {
                const retry = element('button', text('retry'));
                retry.type = 'button';
                retry.className = 'btn btn-secondary btn-small';
                retry.addEventListener('click', () => void load(entry));
                group.append(retry);
            }
            container.append(group);
        }
        const membershipDate = document.getElementById('membershipStartDate');
        if (membershipDate) membershipDate.hidden = !hasMembership;
        const input = document.getElementById('subStartDate');
        if (input) {
            input.disabled = !hasMembership;
            input.required = hasMembership;
        }
        if (focusedId) document.getElementById(focusedId)?.focus();
    }

    async function load(entry) {
        entry.date = '';
        entry.request = (entry.request || 0) + 1;
        const request = entry.request;
        const isCurrent = () => entries.get(entry.offer.salesCode) === entry
            && entry.identity === identity(entry.offer) && entry.request === request;
        if (!entry.variantCode) {
            entry.status = entry.variants.length > 1 ? 'chooseEdition' : 'missingEdition';
            render();
            return;
        }
        entry.status = 'loading';
        render();
        try {
            const result = await fetchDate(entry.offer.salesCode, entry.variantCode);
            if (!isCurrent()) return;
            const value = result.startDate;
            const [year, month, day] = typeof value === 'string' ? value.split('-').map(Number) : [];
            const validDate = /^\d{4}-\d{2}-\d{2}$/.test(value || '')
                && month >= 1 && month <= 12 && day >= 1
                && day <= new Date(year, month, 0).getDate()
                && value >= localCalendarDate();
            if (!validDate || result.variantCode !== entry.variantCode) throw new Error('Invalid source date');
            entry.date = result.startDate;
            entry.status = 'ready';
        } catch {
            if (!isCurrent()) return;
            entry.status = 'unavailable';
        }
        render();
    }

    function sync(selections, reset = false) {
        const next = new Map();
        const toLoad = [];
        for (const { selectedKey: offer } of selections) {
            if (!offer) continue;
            const previous = reset ? null : entries.get(offer.salesCode);
            if (previous?.identity === identity(offer)) {
                next.set(offer.salesCode, previous);
                continue;
            }
            const variants = Array.isArray(offer.variantCodes) ? offer.variantCodes : [];
            const entry = { offer, identity: identity(offer), variants,
                variantCode: variants.length === 1 ? variants[0] : '', date: '', status: 'chooseEdition' };
            next.set(offer.salesCode, entry);
            if (offer.subscriptionKind !== 'membership') toLoad.push(entry);
        }
        entries = next;
        render();
        return Promise.all(toLoad.map(load));
    }

    function read(offer) {
        const entry = entries.get(offer.salesCode);
        if (!entry || entry.identity !== identity(offer)) throw new Error(text('changed'));
        if (offer.subscriptionKind === 'membership') {
            return { startDate: document.getElementById('subStartDate')?.value || '', variantCode: null };
        }
        if (entry.status !== 'ready') throw new Error(text(entry.status));
        return { startDate: entry.date, variantCode: entry.variantCode };
    }

    function reject(offer, variantCode) {
        const entry = entries.get(offer.salesCode);
        const isCurrentOffer = entry && entry.identity === identity(offer);
        const isSubmittedEdition = entry?.variantCode === variantCode;
        if (!isCurrentOffer || !isSubmittedEdition || offer.subscriptionKind === 'membership') return;
        entry.request = (entry.request || 0) + 1;
        entry.date = '';
        entry.status = 'unavailable';
        render();
    }

    async function restore(offer) {
        const entry = entries.get(offer.salesCode);
        if (!entry || entry.offer.subscriptionKind === 'membership') return;
        if (!entry.variants.includes(offer.variantCode)) return;
        entry.variantCode = offer.variantCode;
        await load(entry);
    }

    return { sync, read, reject, restore };
}
