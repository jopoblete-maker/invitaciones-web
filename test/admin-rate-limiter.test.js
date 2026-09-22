const assert = require("assert");
const { createAdminRateLimiter } = require("../js/core/admin-rate-limiter");

async function run() {
    const calls = [];
    const limiter = createAdminRateLimiter({
        windowSeconds: "60",
        maxRequests: "5",
        rpc: async (name, parameters) => {
            calls.push({ name, parameters });
            return [{ allowed: false, retry_after_seconds: 12, current_count: 6 }];
        }
    });
    const result = await limiter.consume({ origin: "https://admin.example", endpoint: "POST /versions", action: "CREATE_VERSION" });
    assert.deepStrictEqual(result, { allowed: false, retryAfterSeconds: 12, currentCount: 6 });
    assert.strictEqual(calls[0].name, "consume_admin_rate_limit");
    assert.deepStrictEqual(calls[0].parameters, {
        p_window_key: "https://admin.example|POST /versions|CREATE_VERSION",
        p_window_seconds: 60,
        p_max_requests: 5
    });
    assert(!calls[0].parameters.p_window_key.includes("event-id"));
    assert(!calls[0].parameters.p_window_key.includes("secret"));

    for (const value of [undefined, "", "abc", "0", "-1", "1.5", "86401"]) {
        const invalid = createAdminRateLimiter({ windowSeconds: value, maxRequests: "5", rpc: async () => [] });
        await assert.rejects(() => invalid.consume({ origin: "https://admin.example", endpoint: "POST /versions", action: "CREATE_VERSION" }), /ADMIN_RATE_LIMIT/);
    }
    const unavailable = createAdminRateLimiter({ windowSeconds: "60", maxRequests: "5", rpc: async () => { throw new Error("offline"); } });
    await assert.rejects(
        () => unavailable.consume({ origin: "https://admin.example", endpoint: "POST /versions", action: "CREATE_VERSION" }),
        (error) => error.code === "RATE_LIMIT_UNAVAILABLE"
    );
    console.log("admin-rate-limiter tests passed");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
