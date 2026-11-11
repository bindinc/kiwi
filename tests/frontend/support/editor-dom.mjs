export function createEditorDocument() {
    function node(tag) {
        return {
            tag, children: [], listeners: {}, attributes: {}, value: '', ownText: '', open: false,
            get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); },
            set textContent(value) { this.ownText = value; this.children = []; },
            append(...items) { for (const item of items) { item.parentElement = this; this.children.push(item); } },
            prepend(...items) { for (const item of items) item.parentElement = this; this.children.unshift(...items); },
            replaceChildren(...items) { this.children = []; this.append(...items); },
            setAttribute(key, value) { this.attributes[key] = value; },
            getAttribute(key) { return this.attributes[key] ?? null; },
            addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); },
            removeEventListener(name, listener) { this.listeners[name] = (this.listeners[name] || []).filter((item) => item !== listener); },
            emit(name) { for (const listener of this.listeners[name] || []) listener({ preventDefault() {} }); },
            showModal() { this.open = true; },
            close() { this.open = false; this.emit('close'); },
            remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); },
            focus() {},
            querySelectorAll(selector) {
                function matches(child) {
                    if (selector.startsWith('#')) return child.id === selector.slice(1);
                    if (selector === '[data-address-prefix]') return child.attributes['data-address-prefix'] !== undefined;
                    return child.tag === selector;
                }
                return this.children.flatMap((child) => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
            },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
            // Parse the generated address fragment so tests exercise the editor's real prefix queries.
            set innerHTML(markup) {
                this.children = [];
                const parents = [this];
                for (const part of markup.match(/<[^>]+>|[^<]+/g) || []) {
                    if (part.startsWith('</')) { parents.pop(); continue; }
                    if (!part.startsWith('<')) { parents.at(-1).ownText += part.trim(); continue; }
                    const tag = part.match(/^<(\w+)/)?.[1];
                    if (!tag) continue;
                    const child = node(tag);
                    for (const match of part.matchAll(/([\w-]+)="([^"]*)"/g)) {
                        child.setAttribute(match[1], match[2]);
                        if (match[1] === 'id') child.id = match[2];
                    }
                    parents.at(-1).append(child);
                    if (!['input', 'br'].includes(tag)) parents.push(child);
                }
            }
        };
    }
    return { createElement: node, body: node('body') };
}
