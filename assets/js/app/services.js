export function getGlobalScope() {
    if (typeof window !== 'undefined') {
        return window;
    }

    if (typeof globalThis !== 'undefined') {
        return globalThis;
    }

    return undefined;
}

function getMappedAssetUrl(assetKey) {
    const globalScope = getGlobalScope();
    const assetPaths = globalScope && typeof globalScope.kiwiAssetPaths === 'object'
        ? globalScope.kiwiAssetPaths
        : null;
    const mappedUrl = assetPaths ? assetPaths[assetKey] : null;

    return typeof mappedUrl === 'string' && mappedUrl !== '' ? mappedUrl : null;
}

export function resolveScriptUrl(options = {}) {
    const normalizedOptions = typeof options === 'string'
        ? { relativePath: options }
        : options;
    const mappedUrl = normalizedOptions.assetKey
        ? getMappedAssetUrl(normalizedOptions.assetKey)
        : null;

    if (mappedUrl) {
        return mappedUrl;
    }

    if (!normalizedOptions.relativePath) {
        return null;
    }

    return new URL(normalizedOptions.relativePath, import.meta.url).toString();
}

export function loadScriptOnce(options = {}) {
    const { id, url } = options;
    const globalScope = getGlobalScope();
    const documentRef = globalScope && globalScope.document ? globalScope.document : null;

    if (!documentRef || !id || !url) {
        return Promise.resolve();
    }

    const existingScript = documentRef.getElementById(id);
    if (existingScript) {
        if (existingScript.dataset.loaded === 'true') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', (error) => reject(error), { once: true });
        });
    }

    return new Promise((resolve, reject) => {
        const script = documentRef.createElement('script');
        script.id = id;
        script.src = url;
        script.async = false;

        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });

        script.addEventListener('error', (error) => {
            reject(error);
        }, { once: true });

        const targetNode = documentRef.head || documentRef.body || documentRef.documentElement;
        targetNode.appendChild(script);
    });
}
