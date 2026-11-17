// theme_audit: exact outer delegation guards. Lower fixture owners still validate payloads/counts.
export function createIconApiGuard({ baseUrl, knownReads, knownWrites, deniedRequests }) {
    return async route => {
        const request = route.request(), url = new URL(request.url());
        const kiwiApi = ['/kiwi/api', '/kiwi-preview/api'].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'));
        if (!kiwiApi) return route.fallback();
        const sameOrigin = url.origin === baseUrl.origin && !url.username && !url.password;
        const exactRead = request.method() === 'GET' && knownReads.has(url.pathname + url.search);
        const exactCommand = !url.search && knownWrites.has(request.method() + ' ' + url.pathname);
        if (sameOrigin && (exactRead || exactCommand)) return route.fallback();
        deniedRequests.push({ method: request.method(), pathname: url.pathname, reason: 'Unknown icon API request; never upstream.' });
        return route.abort('blockedbyclient');
    };
}

export function pinIconLoginAction(action, baseUrl) {
    const url = new URL(action);
    if (url.origin !== baseUrl.origin || url.username || url.password
        || url.pathname !== '/kiwi-oidc/realms/kiwi-local/login-actions/authenticate') {
        throw new Error('Native icon login form must use the exact local OIDC origin and authenticate path.');
    }
}

export function isIconLoginNavigation(request, mainFrame) {
    return request.method() === 'POST' && request.isNavigationRequest()
        && request.resourceType() === 'document' && request.frame() === mainFrame;
}

export function nativeNoRoleLoginFormMatches(snapshot, postData) {
    if (!snapshot || typeof snapshot.submitterDisabled !== 'boolean' || !Array.isArray(snapshot.entries)) return false;
    const stringPairs = snapshot.entries.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(value => typeof value === 'string'));
    if (!stringPairs) return false;
    const fields = new URLSearchParams(snapshot.entries);
    const knownAccount = fields.getAll('username').length === 1 && fields.get('username') === 'donny';
    const knownPassword = fields.getAll('password').length === 1 && fields.get('password') === 'kiwi-local-dev-password';
    if (!knownAccount || !knownPassword) return false;
    const actual = [...new URLSearchParams(postData || '').entries()].sort();
    return JSON.stringify(actual) === JSON.stringify([...fields.entries()].sort());
}
