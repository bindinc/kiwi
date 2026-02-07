(function () {
    const defaultHeaders = {
        'Accept': 'application/json'
    };

    function buildHeaders(extraHeaders) {
        return {
            ...defaultHeaders,
            ...(extraHeaders || {})
        };
    }

    async function request(method, url, payload, options) {
        const requestOptions = {
            method,
            credentials: 'same-origin',
            headers: buildHeaders(options && options.headers)
        };

        if (payload !== undefined) {
            requestOptions.body = JSON.stringify(payload);
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, requestOptions);
        const contentType = response.headers.get('content-type') || '';
        const hasJsonBody = contentType.includes('application/json');
        const body = hasJsonBody ? await response.json() : null;

        if (response.status === 401) {
            const loginUrl = '/';
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
