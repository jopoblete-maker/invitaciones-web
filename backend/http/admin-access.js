"use strict";

const FAILURES = Object.freeze({
    UNAUTHORIZED: { status: 401, message: "Unauthorized." },
    ORIGIN_FORBIDDEN: { status: 403, message: "Request origin is not allowed." },
    RATE_LIMITED: { status: 429, message: "Too many requests." },
    RATE_LIMIT_UNAVAILABLE: { status: 503, message: "Rate limit service unavailable." }
});

function readAdminPassword(req) {
    if (req && typeof req.get === "function") return req.get("X-Admin-Password");
    return req?.headers?.["x-admin-password"];
}

function failure(code, retryAfterSeconds) {
    return { ok: false, code, ...FAILURES[code], retryAfterSeconds };
}

function sendAccessFailure(res, result) {
    if (result.code === "RATE_LIMITED") {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
    }
    return res.status(result.status).json({ error: { code: result.code, message: result.message } });
}

function createAdminAccess({ adminPassword, originPolicy, rateLimiter }) {
    if (typeof adminPassword !== "string" || adminPassword === "") throw new TypeError("adminPassword is required.");
    if (!originPolicy || typeof originPolicy.validateRequest !== "function") throw new TypeError("originPolicy is required.");
    if (!rateLimiter || typeof rateLimiter.consume !== "function") throw new TypeError("rateLimiter is required.");

    function authenticate(req) {
        return readAdminPassword(req) === adminPassword ? { ok: true } : failure("UNAUTHORIZED");
    }

    function validateMutationOrigin(req) {
        const result = originPolicy.validateRequest(req);
        return result.ok ? { ok: true, origin: result.origin } : failure("ORIGIN_FORBIDDEN");
    }

    async function consumeMutationLimit(parameters) {
        try {
            const rate = await rateLimiter.consume(parameters);
            return rate.allowed ? { ok: true } : failure("RATE_LIMITED", rate.retryAfterSeconds);
        } catch (error) {
            if (error?.code === "RATE_LIMIT_UNAVAILABLE") return failure("RATE_LIMIT_UNAVAILABLE");
            throw error;
        }
    }

    async function authorize(req, { mutate = false, endpoint, action, originFirst = true } = {}) {
        let origin = null;
        if (!originFirst) {
            const auth = authenticate(req);
            if (!auth.ok) return auth;
        }
        if (mutate) {
            const result = validateMutationOrigin(req);
            if (!result.ok) return result;
            origin = result.origin;
        }
        if (originFirst) {
            const auth = authenticate(req);
            if (!auth.ok) return auth;
        }
        if (mutate) {
            const rate = await consumeMutationLimit({ origin, endpoint, action: typeof action === "function" ? action(req) : action });
            if (!rate.ok) return rate;
        }
        return { ok: true, origin };
    }

    return Object.freeze({ authenticate, validateMutationOrigin, consumeMutationLimit, authorize });
}

module.exports = { createAdminAccess, readAdminPassword, sendAccessFailure };
