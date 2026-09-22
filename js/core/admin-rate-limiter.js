(function (root, factory) {
    const rateLimiter = factory();
    if (typeof module === "object" && module.exports) module.exports = rateLimiter;
    root.AdminRateLimiter = rateLimiter;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const LIMITS = Object.freeze({
        windowSeconds: { min: 1, max: 86400 },
        maxRequests: { min: 1, max: 100000 }
    });

    function parsePositiveInteger(value, name, limits) {
        if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
            throw new Error(`${name} must be a positive integer.`);
        }
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < limits.min || parsed > limits.max) {
            throw new Error(`${name} is outside the supported range.`);
        }
        return parsed;
    }

    function createAdminRateLimiter({ rpc, windowSeconds, maxRequests }) {
        if (!rpc || typeof rpc !== "function") throw new TypeError("rpc is required.");
        let configuration;
        let configurationError = null;
        try {
            configuration = Object.freeze({
                windowSeconds: parsePositiveInteger(windowSeconds, "ADMIN_RATE_LIMIT_WINDOW_SECONDS", LIMITS.windowSeconds),
                maxRequests: parsePositiveInteger(maxRequests, "ADMIN_RATE_LIMIT_MAX_REQUESTS", LIMITS.maxRequests)
            });
        } catch (error) {
            configurationError = error;
        }

        async function consume({ origin, endpoint, action }) {
            if (configurationError) {
                configurationError.code = "RATE_LIMIT_UNAVAILABLE";
                throw configurationError;
            }
            if (typeof origin !== "string" || typeof endpoint !== "string" || typeof action !== "string") {
                const unavailable = new Error("Rate limit service unavailable.");
                unavailable.code = "RATE_LIMIT_UNAVAILABLE";
                throw unavailable;
            }
            const windowKey = `${origin}|${endpoint}|${action}`;
            let result;
            try {
                result = await rpc("consume_admin_rate_limit", {
                    p_window_key: windowKey,
                    p_window_seconds: configuration.windowSeconds,
                    p_max_requests: configuration.maxRequests
                });
            } catch (error) {
                const unavailable = new Error("Rate limit service unavailable.");
                unavailable.code = "RATE_LIMIT_UNAVAILABLE";
                unavailable.cause = error;
                throw unavailable;
            }
            if (result?.error) {
                const unavailable = new Error("Rate limit service unavailable.");
                unavailable.code = "RATE_LIMIT_UNAVAILABLE";
                unavailable.cause = result.error;
                throw unavailable;
            }
            const payload = result?.data ?? result;
            const row = Array.isArray(payload) ? payload[0] : payload;
            if (!row || typeof row.allowed !== "boolean") {
                const unavailable = new Error("Rate limit service unavailable.");
                unavailable.code = "RATE_LIMIT_UNAVAILABLE";
                throw unavailable;
            }
            if (!row.allowed) {
                if (!Number.isSafeInteger(row.retry_after_seconds) || row.retry_after_seconds < 0) {
                    const unavailable = new Error("Rate limit service unavailable.");
                    unavailable.code = "RATE_LIMIT_UNAVAILABLE";
                    throw unavailable;
                }
            }
            return {
                allowed: row.allowed,
                retryAfterSeconds: row.retry_after_seconds,
                currentCount: row.current_count
            };
        }

        return Object.freeze({
            consume,
            configuration,
            configurationError,
            limits: LIMITS
        });
    }

    return { createAdminRateLimiter, LIMITS };
});
