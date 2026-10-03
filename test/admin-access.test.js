const assert = require("assert");
const { createAdminAccess, readAdminPassword, sendAccessFailure } = require("../backend/http/admin-access");
const { createAdminOriginPolicy } = require("../js/core/admin-origin-policy");

const password = "synthetic-admin-password";
const policy = createAdminOriginPolicy("https://admin.example");
const calls = [];
let rateResult = { allowed: true };
let rateError;
const access = createAdminAccess({
    adminPassword: password,
    originPolicy: { validateRequest(req) { calls.push("origin"); return policy.validateRequest(req); } },
    rateLimiter: { async consume(parameters) {
        calls.push(parameters);
        if (rateError) throw rateError;
        return rateResult;
    } }
});
function request(headers = {}) {
    return { headers: { "x-admin-password": password, origin: "https://admin.example", ...headers } };
}
function response(result) {
    const res = {
        headers: {}, statusCode: 200,
        setHeader(key, value) { this.headers[key] = value; },
        status(value) { this.statusCode = value; return this; },
        json(body) { this.body = body; return this; }
    };
    sendAccessFailure(res, result);
    return res;
}
let checks = 0;
function check(condition) { assert(condition); checks++; }

(async () => {
    check(readAdminPassword(request()) === password);
    check(readAdminPassword({ get: (name) => name === "X-Admin-Password" ? password : null }) === password);
    check(access.authenticate(request()).ok);
    for (const value of [undefined, "wrong"]) {
        const result = await access.authorize(request({ "x-admin-password": value }));
        const res = response(result);
        assert.deepStrictEqual(res.body, { error: { code: "UNAUTHORIZED", message: "Unauthorized." } });
        check(res.statusCode === 401);
    }
    const options = { mutate: true, endpoint: "POST /api/admin/eventos/:eventId/versions", action: "CREATE_VERSION" };
    calls.length = 0;
    const allowed = await access.authorize(request(), options);
    check(allowed.ok && allowed.origin === "https://admin.example");
    assert.deepStrictEqual(calls, ["origin", { origin: "https://admin.example", endpoint: options.endpoint, action: options.action }]);
    checks++;
    calls.length = 0;
    const tracedRequest = request();
    tracedRequest.get = (name) => {
        if (name === "X-Admin-Password") calls.push("password");
        return tracedRequest.headers[name.toLowerCase()];
    };
    await access.authorize(tracedRequest, options);
    assert.deepStrictEqual(calls, ["origin", "password", { origin: "https://admin.example", endpoint: options.endpoint, action: options.action }]);
    checks++;
    for (const headers of [{ origin: "https://evil.example" }, { origin: undefined, referer: undefined }]) {
        calls.length = 0;
        const result = await access.authorize(request(headers), options);
        const res = response(result);
        check(res.statusCode === 403 && result.code === "ORIGIN_FORBIDDEN");
        assert.deepStrictEqual(calls, ["origin"]);
    }
    check((await access.authorize(request({ origin: undefined, referer: "https://admin.example/admin.html" }), options)).ok);
    calls.length = 0;
    const orderingRequest = request({ "x-admin-password": "wrong", origin: "https://evil.example" });
    check((await access.authorize(orderingRequest, options)).code === "ORIGIN_FORBIDDEN");
    assert.deepStrictEqual(calls, ["origin"]);
    calls.length = 0;
    check((await access.authorize(orderingRequest, { ...options, originFirst: false })).code === "UNAUTHORIZED");
    check(calls.length === 0);
    calls.length = 0;
    check((await access.authorize(request({ "x-admin-password": "wrong" }), options)).code === "UNAUTHORIZED");
    assert.deepStrictEqual(calls, ["origin"]);
    calls.length = 0;
    check((await access.authorize(request({ origin: "https://evil.example" }))).ok);
    check(calls.length === 0);
    rateResult = { allowed: false, retryAfterSeconds: 17 };
    const limited = response(await access.authorize(request(), options));
    check(limited.statusCode === 429 && limited.headers["Retry-After"] === "17");
    assert.deepStrictEqual(limited.body, { error: { code: "RATE_LIMITED", message: "Too many requests." } });
    rateError = Object.assign(new Error("synthetic raw failure"), { code: "RATE_LIMIT_UNAVAILABLE" });
    const unavailable = response(await access.authorize(request(), options));
    check(unavailable.statusCode === 503);
    assert.deepStrictEqual(unavailable.body, { error: { code: "RATE_LIMIT_UNAVAILABLE", message: "Rate limit service unavailable." } });
    calls.length = 0;
    check((await access.authorize(request())).ok && calls.length === 0);
    rateError = undefined;
    rateResult = { allowed: true };
    calls.length = 0;
    await access.authorize(request(), { ...options, action: () => "APPROVE_VERSION" });
    check(calls[1].action === "APPROVE_VERSION" && calls[1].endpoint === options.endpoint);
    console.log(`admin-access: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
