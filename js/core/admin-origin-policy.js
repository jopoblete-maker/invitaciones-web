(function (root, factory) {
    const policy = factory();
    if (typeof module === "object" && module.exports) module.exports = policy;
    root.AdminOriginPolicy = policy;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function normalizeOrigin(value) {
        if (typeof value !== "string" || value.trim() === "") return null;
        let url;
        try {
            url = new URL(value.trim());
        } catch (_error) {
            return null;
        }
        if (!/^https?:$/.test(url.protocol) || url.username || url.password
            || url.pathname !== "/" || url.search || url.hash) return null;
        return url.origin;
    }

    function createAdminOriginPolicy(rawOrigins) {
        const values = typeof rawOrigins === "string" ? rawOrigins.split(",") : [];
        const origins = new Set();
        let configurationValid = values.length > 0;
        for (const value of values) {
            const trimmed = value.trim();
            if (trimmed === "*") configurationValid = false;
            const normalized = normalizeOrigin(trimmed);
            if (!normalized) configurationValid = false;
            else origins.add(normalized);
        }

        function requestHeader(req, name) {
            if (req && typeof req.get === "function") return req.get(name);
            const headers = req?.headers || {};
            return headers[name.toLowerCase()] ?? headers[name] ?? undefined;
        }

        function validateRequest(req) {
            if (!configurationValid) return { ok: false, origin: null };
            const originHeader = requestHeader(req, "Origin");
            const referer = requestHeader(req, "Referer");
            const candidate = originHeader !== undefined
                ? originHeader
                : referer;
            let candidateOrigin = candidate;
            if (originHeader === undefined && typeof referer === "string") {
                try { candidateOrigin = new URL(referer).origin; } catch (_error) { candidateOrigin = null; }
            }
            const normalized = normalizeOrigin(candidateOrigin);
            return { ok: Boolean(normalized && origins.has(normalized)), origin: normalized };
        }

        return Object.freeze({ validateRequest, normalizeOrigin, origins: Object.freeze([...origins]) });
    }

    return { normalizeOrigin, createAdminOriginPolicy };
});
