// A controller test double: native focus/inertness, layout and capture remain browser gates.
export function createFeedbackDocument() {
    const observers = new Set();
    const documentRef = { activeElement: null, listeners: {} };
    const notify = target => {
        for (const observer of observers) if (observer.target === target) observer.callback();
    };
    function node(tag) {
        const attributes = {};
        const element = {
            tagName: tag.toUpperCase(), ownerDocument: documentRef, children: [], parentElement: null,
            listeners: {}, disabled: false, checked: false, value: '', ownText: '', style: {}, dataset: {},
            get isConnected() { return this === documentRef.body || Boolean(this.parentElement?.isConnected); },
            get className() { return attributes.class || ''; },
            set className(value) { this.setAttribute('class', value); },
            get hidden() { return 'hidden' in attributes; },
            set hidden(value) { value ? this.setAttribute('hidden', '') : this.removeAttribute('hidden'); },
            get open() { return 'open' in attributes; },
            get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); },
            set textContent(value) { this.ownText = String(value); this.children = []; },
            get id() { return attributes.id || ''; },
            get name() { return attributes.name || ''; },
            get type() { return attributes.type || ''; },
            setAttribute(key, value) {
                attributes[key] = String(value);
                if (key === 'value') this.value = String(value);
                if (key === 'checked') this.checked = true;
                if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
                notify(this);
            },
            getAttribute(key) { return attributes[key] ?? null; },
            removeAttribute(key) { delete attributes[key]; notify(this); },
            append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } },
            prepend(...children) { for (const child of children) child.parentElement = this; this.children.unshift(...children); },
            remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; },
            matches(selector) {
                return selector.split(',').some(part => {
                    const candidate = part.trim();
                    const tagMatch = candidate.match(/^[a-z]+/i);
                    if (tagMatch && this.tagName !== tagMatch[0].toUpperCase()) return false;
                    const idMatch = candidate.match(/#([\w-]+)/);
                    if (idMatch && this.id !== idMatch[1]) return false;
                    for (const [, name] of candidate.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(name)) return false;
                    for (const [, name, value] of candidate.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
                        if (!(name in attributes) || (value !== undefined && attributes[name] !== value)) return false;
                    }
                    return true;
                });
            },
            closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; },
            querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
            focus() { if (!this.disabled) documentRef.activeElement = this; },
            showModal() { this.setAttribute('open', ''); },
            close() { this.removeAttribute('open'); },
            getContext() { return {}; },
            getClientRects() { return this.isConnected && !this.hidden && this.style.display !== 'none' ? [{}] : []; },
            scrollIntoView() { this.scrolled = true; },
            addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); },
            removeEventListener(name, listener) { this.listeners[name] = (this.listeners[name] || []).filter(item => item !== listener); },
            async emit(name, properties = {}) {
                const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...properties };
                await Promise.all((this.listeners[name] || []).map(listener => listener(event)));
                return event;
            },
            set innerHTML(markup) {
                this.children = [];
                const parents = [this];
                for (const part of markup.match(/<[^>]+>|[^<]+/g) || []) {
                    if (part.startsWith('</')) { if (parents.length > 1) parents.pop(); continue; }
                    if (!part.startsWith('<')) { parents.at(-1).ownText += part.trim(); continue; }
                    const childTag = part.match(/^<(\w+)/)?.[1];
                    if (!childTag) continue;
                    const child = node(childTag);
                    for (const [, key, value] of part.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
                        if (key === childTag) continue;
                        child.setAttribute(key, value ?? '');
                    }
                    parents.at(-1).append(child);
                    if (!['input', 'br', 'hr', 'img', 'meta'].includes(childTag)) parents.push(child);
                }
                for (const select of this.querySelectorAll('select')) select.value = (select.querySelector('[selected]') || select.querySelector('option'))?.getAttribute('value') || '';
            }
        };
        element.classList = {
            contains(name) { return element.className.split(/\s+/).includes(name); },
            add(...names) { element.className = [...new Set([...element.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
            remove(...names) { element.className = element.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
            toggle(name, force) { const add = force ?? !this.contains(name); add ? this.add(name) : this.remove(name); return add; }
        };
        return element;
    }
    documentRef.createElement = node;
    documentRef.body = node('body');
    documentRef.activeElement = documentRef.body;
    documentRef.querySelectorAll = selector => documentRef.body.querySelectorAll(selector);
    documentRef.querySelector = selector => documentRef.body.querySelector(selector);
    documentRef.getElementById = id => documentRef.querySelector(`#${id}`);
    documentRef.addEventListener = (name, listener) => { (documentRef.listeners[name] ||= []).push(listener); };
    documentRef.emit = async (name, target) => { for (const listener of documentRef.listeners[name] || []) await listener({ target }); };
    documentRef.defaultView = {
        MutationObserver: class {
            constructor(callback) { this.callback = callback; }
            observe(target) { this.target = target; observers.add(this); }
            disconnect() { observers.delete(this); }
        }
    };
    return documentRef;
}

export class FeedbackFormData {
    constructor(form) { this.values = new Map(); this.form = form; }
    get(name) {
        if (this.values.has(name)) return this.values.get(name);
        const input = this.form?.querySelector(`[name="${name}"]`);
        return input?.type === 'checkbox' ? (input.checked ? 'on' : null) : input?.value ?? null;
    }
    set(name, value) { this.values.set(name, value); }
}
export function deferred() {
    let resolve, reject;
    const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
    return { promise, resolve, reject };
}
export async function settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
