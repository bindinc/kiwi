// theme_audit: sanitize child-process output in memory before logging or persistence.
export function redactIconProcessOutput(value) {
    return String(value || '')
        .replaceAll('kiwi-local-dev-password', '[local fixture password]')
        .replace(/https?:\/\/[^\s"'<>]+/g, '[local URL]')
        .replace(/((?:["']?authorization["']?|["']?cookie["']?)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n]*)/gi, '$1[redacted]')
        .replace(/(["']?(?:access_token|refresh_token|id_token|client_secret|session_code)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[redacted]');
}
