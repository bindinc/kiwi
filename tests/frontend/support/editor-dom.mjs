export function createEditorDocument() {
    function node(tag) {
        return {
            tag, children: [], listeners: {}, attributes: {}, value: '', textContent: '', open: false,
            append(...items) { this.children.push(...items); },
            prepend(...items) { this.children.unshift(...items); },
            replaceChildren(...items) { this.children = items; },
            setAttribute(key, value) { this.attributes[key] = value; },
            addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); },
            removeEventListener(name, listener) { this.listeners[name] = (this.listeners[name] || []).filter((item) => item !== listener); },
            emit(name) { for (const listener of this.listeners[name] || []) listener({ preventDefault() {} }); },
            showModal() { this.open = true; },
            close() { this.open = false; this.emit('close'); },
            remove() {}, focus() {},
            querySelectorAll(selector) { return this.children.flatMap((child) => [...(child.tag === selector ? [child] : []), ...child.querySelectorAll(selector)]); }
        };
    }
    return { createElement: node, body: node('body') };
}
