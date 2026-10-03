const assert = require("assert");
const { createRsvpPublicRateLimiter, validEventId, LIMITS } = require("../backend/rsvp/public-rate-limit");
const { toHttpError } = require("../backend/rsvp/errors");
let checks = 0;
let calls;
let rejectAt;
let brokenAt;
let broken;
const limiter = createRsvpPublicRateLimiter({ rpc: async (name, parameters) => {
    calls.push({ name, parameters });
    if (calls.length === brokenAt) {
        if (broken instanceof Error) throw broken;
        return broken;
    }
    const allowed = calls.length !== rejectAt;
    return { data: [{ allowed, current_count: allowed ? 1 : parameters.p_max_requests + 1,
        retry_after_seconds: parameters.p_window_seconds }], error: null };
} });
function reset() { calls = []; rejectAt = 0; brokenAt = 0; broken = undefined; }
async function fail(input, code) {
    await assert.rejects(() => limiter.consume(input), (error) => {
        assert.strictEqual(error.code, code);
        assert(!error.cause && !JSON.stringify(toHttpError(error)).includes("raw-"));
        return true;
    }); checks++;
}
(async () => {
    assert.deepStrictEqual(LIMITS, { GET: { globalMinute: 1200, eventMinute: 120, globalDay: 20000 },
        POST: { globalMinute: 300, eventMinute: 30, globalDay: 5000 } }); checks++;
    for (const operation of ["GET", "POST"]) {
        reset(); assert.deepStrictEqual(await limiter.consume({ eventId: "synthetic-event", operation,
            ip: "raw-ip", userAgent: "raw-ua", token: "raw-token", tokenHash: "raw-hash" }), { allowed: true });
        const maximums = operation === "GET" ? [20000, 1200, 120] : [5000, 300, 30];
        assert.deepStrictEqual(calls, ["global:day", "global:minute", "event:synthetic-event:minute"].map((key, index) => ({
            name: "consume_admin_rate_limit", parameters: { p_window_key: `rsvp-public:${operation}:${key}`,
                p_window_seconds: index === 0 ? 86400 : 60, p_max_requests: maximums[index] }
        })));
        assert(!JSON.stringify(calls).includes("raw-")); checks++;
        for (const level of [1, 2, 3]) {
            reset(); rejectAt = level;
            assert.deepStrictEqual(await limiter.consume({ eventId: "synthetic-event", operation }),
                { allowed: false, retryAfterSeconds: level === 1 ? 86400 : 60 });
            assert.strictEqual(calls.length, level); checks++;
            reset(); brokenAt = level; broken = new Error("raw-secret");
            await fail({ eventId: "synthetic-event", operation }, "RSVP_RATE_LIMIT_UNAVAILABLE");
            assert.strictEqual(calls.length, level);
        }
    }
    for (const eventId of [undefined, "", "UPPER", "has space", "x/y", "legacy-", "x--y", "x|GET", "x".repeat(129), "é", "x\n"]) {
        reset(); assert(!validEventId(eventId)); await fail({ eventId, operation: "GET" }, "RSVP_NOT_AVAILABLE");
        assert.strictEqual(calls.length, 0);
    }
    reset(); assert(validEventId("x".repeat(128))); await limiter.consume({ eventId: "x".repeat(128), operation: "GET" });
    assert(calls[2].parameters.p_window_key.length < 512); checks++;
    for (const operation of ["PUT", "get", "__proto__"]) {
        reset(); await fail({ eventId: "synthetic-event", operation }, "RSVP_RATE_LIMIT_UNAVAILABLE"); assert.strictEqual(calls.length, 0);
    }
    for (const result of [null, {}, { error: { message: "raw-secret" } }, { data: [] }, { data: [{ allowed: true }, {}] },
        { data: [{ allowed: "true", current_count: 1, retry_after_seconds: 1 }] },
        { data: [{ allowed: true, current_count: 0, retry_after_seconds: 1 }] },
        { data: [{ allowed: true, current_count: 20001, retry_after_seconds: 1 }] },
        { data: [{ allowed: false, current_count: 20001, retry_after_seconds: -1 }] },
        { data: [{ allowed: false, current_count: 20001, retry_after_seconds: 86401 }] }]) {
        reset(); brokenAt = 1; broken = result; await fail({ eventId: "synthetic-event", operation: "GET" }, "RSVP_RATE_LIMIT_UNAVAILABLE");
        assert.strictEqual(calls.length, 1);
    }
    // Every admitted arbitrary event key requires both global admissions first.
    for (let index = 0; index < 5; index++) {
        reset(); rejectAt = 1; await limiter.consume({ eventId: `synthetic-${index}`, operation: "GET" });
        assert(calls.every((call) => !call.parameters.p_window_key.includes(":event:")));
    }
    checks++;
    console.log(`rsvp-public-rate-limit: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
