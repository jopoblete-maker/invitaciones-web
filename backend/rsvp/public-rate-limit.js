"use strict";

const { RsvpError } = require("./errors");
const LIMITS = Object.freeze({
    GET: Object.freeze({ globalMinute: 1200, eventMinute: 120, globalDay: 20000 }),
    POST: Object.freeze({ globalMinute: 300, eventMinute: 30, globalDay: 5000 })
});

function validEventId(value) {
    return typeof value === "string" && value.length <= 128 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function createRsvpPublicRateLimiter({ rpc }) {
    if (typeof rpc !== "function") throw new TypeError("An existing timeout-protected RPC executor is required.");
    async function consume({ eventId, operation }) {
        if (!validEventId(eventId)) throw new RsvpError("RSVP_NOT_AVAILABLE");
        if (!Object.prototype.hasOwnProperty.call(LIMITS, operation)) throw new RsvpError("RSVP_RATE_LIMIT_UNAVAILABLE");
        const limits = LIMITS[operation];
        // Global admission precedes event-key creation, bounding daily key growth
        // even for syntactically valid but nonexistent IDs. No local cache.
        const buckets = [
            [`rsvp-public:${operation}:global:day`, 86400, limits.globalDay],
            [`rsvp-public:${operation}:global:minute`, 60, limits.globalMinute],
            [`rsvp-public:${operation}:event:${eventId}:minute`, 60, limits.eventMinute]
        ];
        for (const [key, seconds, maximum] of buckets) {
            let row;
            try {
                const result = await rpc("consume_admin_rate_limit", {
                    p_window_key: key, p_window_seconds: seconds, p_max_requests: maximum
                });
                if (!result || result.error || !Array.isArray(result.data) || result.data.length !== 1) throw new Error();
                row = result.data[0];
                if (!row || typeof row.allowed !== "boolean" || !Number.isSafeInteger(row.current_count)
                    || row.current_count < 1 || row.allowed !== (row.current_count <= maximum)
                    || !Number.isSafeInteger(row.retry_after_seconds) || row.retry_after_seconds < 1
                    || row.retry_after_seconds > seconds) throw new Error();
            } catch (_error) { throw new RsvpError("RSVP_RATE_LIMIT_UNAVAILABLE"); }
            if (!row.allowed) return { allowed: false, retryAfterSeconds: row.retry_after_seconds };
        }
        return { allowed: true };
    }
    return Object.freeze({ consume });
}

module.exports = { createRsvpPublicRateLimiter, validEventId, LIMITS };
