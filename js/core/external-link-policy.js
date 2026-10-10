(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.ExternalLinkPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const controls = /[\u0000-\u001f\u007f-\u009f]/;
    function parse(value) {
        if (typeof value !== "string" || value !== value.trim() || controls.test(value)
            || /\\|%(?:0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f])/i.test(value)
            || !/^https:\/\//i.test(value)) return null;
        try {
            const url = new URL(value);
            const host = url.hostname;
            if (url.protocol !== "https:" || url.username || url.password || url.port
                || !host.includes(".") || host.endsWith(".") || host.includes(":") || host.startsWith("[")
                || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|lan|home|testlocal)$/.test(host)) return null;
            return url;
        } catch (_) { return null; }
    }
    // Exact approved destinations, including path/query/fragment; no wildcard or redirect inference.
    function createPolicy({ allowedUrls = [] } = {}) {
        if (!Array.isArray(allowedUrls)) throw new TypeError("Invalid link policy configuration.");
        const allowed = new Set();
        for (const value of allowedUrls) {
            const url = parse(value);
            if (!url) throw new TypeError("Invalid link policy configuration.");
            allowed.add(url.href);
        }
        return Object.freeze({ isAllowed: value => {
            const url = parse(value);
            return Boolean(url && allowed.has(url.href));
        } });
    }
    return { createPolicy };
});
