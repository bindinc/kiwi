(function () {
    const defaultHeaders = {
        'Accept': 'application/json'
    };
    const configuredBasePath = typeof window !== 'undefined' && typeof window.kiwiBasePath === 'string'
        ? window.kiwiBasePath
        : '';
    const basePath = configuredBasePath && configuredBasePath !== '/'
        ? configuredBasePath.replace(/\/+$/, '')
        : '';

    function getCustomerContextHeaders(options) {
        if (options && options.skipCustomerContext === true) {
            return {};
        }

        const customerWorkSession = typeof window !== 'undefined'
            ? window.kiwiCustomerWorkSession
            : null;
        if (!customerWorkSession || typeof customerWorkSession.getRequestHeaders !== 'function') {
            return {};
        }

        const headers = customerWorkSession.getRequestHeaders();
        return headers && typeof headers === 'object' ? headers : {};
    }

    function buildHeaders(extraHeaders, options) {
        return {
            ...defaultHeaders,
            ...getCustomerContextHeaders(options),
            ...(extraHeaders || {})
        };
    }

    function buildRequestUrl(url) {
        if (!url || typeof url !== 'string') {
            return url;
        }

        // Absolute URLs should pass through unchanged.
        if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
            return url;
        }

        // Only prefix root-relative app API paths.
        const isRootRelative = url.startsWith('/') && !url.startsWith('//');
        if (!isRootRelative || !basePath) {
            return url;
        }

        const alreadyPrefixed = url === basePath || url.startsWith(`${basePath}/`);
        return alreadyPrefixed ? url : `${basePath}${url}`;
    }

    async function request(method, url, payload, options) {
        const requestUrl = buildRequestUrl(url);
        const requestOptions = {
            method,
            credentials: 'same-origin',
            headers: buildHeaders(options && options.headers, options)
        };

        if (options && options.signal) {
            requestOptions.signal = options.signal;
        }

        if (payload !== undefined) {
            requestOptions.body = JSON.stringify(payload);
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(requestUrl, requestOptions);
        const contentType = response.headers.get('content-type') || '';
        const hasJsonBody = contentType.includes('application/json');
        const body = hasJsonBody ? await response.json() : null;

        if (response.status === 401) {
            const loginUrl = basePath ? `${basePath}/` : '/';
            window.location.href = loginUrl;
            throw new Error('unauthorized');
        }

        if (!response.ok) {
            const errorMessage = body && body.error && body.error.message
                ? body.error.message
                : `Request failed with status ${response.status}`;
            const error = new Error(errorMessage);
            error.status = response.status;
            error.payload = body;
            throw error;
        }

        return body;
    }

    window.kiwiApi = {
        request,
        get(url, options) {
            return request('GET', url, undefined, options);
        },
        post(url, payload, options) {
            return request('POST', url, payload, options);
        },
        put(url, payload, options) {
            return request('PUT', url, payload, options);
        },
        patch(url, payload, options) {
            return request('PATCH', url, payload, options);
        },
        delete(url, options) {
            return request('DELETE', url, undefined, options);
        }
    };
})();
