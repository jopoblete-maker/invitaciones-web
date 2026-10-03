const assert = require("assert");
const http = require("http");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { createRsvpPublicHttp } = require("../backend/rsvp/http");
const { RsvpError, toHttpError } = require("../backend/rsvp/errors");
const { createRsvpRpcAdapter } = require("../backend/rsvp/rpc-adapter");
const { createRsvpService } = require("../backend/rsvp/service");
const { generateToken } = require("../backend/rsvp/token");
const token = generateToken().token;
const auth = { Authorization: `RSVP ${token}` };
const input = { status: "attending", attendeeCount: 2, expectedRevision: 3 };
const readResult = { displayName: "Synthetic", type: "group", maxAttendees: 2, revision: 3, timezone: "UTC",
    deadlineAt: "2027-06-01T23:59:00Z", closed: false, response: { status: "attending", attendeeCount: 2 } };
let checks = 0;
let serviceError;
let rate;
let rateError;
let calls;
let order;
let globalParses = 0;
let server;
let contractMode;
let sqlError;
let contextError;
const contractService = createRsvpService({
    adapter: createRsvpRpcAdapter({ supabase: { rpc: async () => ({ data: null, error: { code: "P0001", message: sqlError } }) }, execute: (query) => query }),
    context: { async read() {
        if (contextError) throw new RsvpError(contextError);
        return { eventId: "synthetic-event", eventStatus: "active", kind: "managed" };
    } }
});
function reset() { calls = []; order = []; serviceError = undefined; rateError = undefined; rate = { allowed: true };
    contractMode = false; sqlError = undefined; contextError = undefined; }
const routes = createRsvpPublicHttp({ express,
    limiter: { async consume(options) { order.push("limiter"); calls.push(["limit", options]); if (rateError) throw rateError; return rate; } },
    service: {
        async publicRead(options) { order.push("read"); calls.push(["read", options]); if (serviceError) throw serviceError;
            if (contractMode) return contractService.publicRead(options);
            return { ...readResult, token: "raw-token", tokenHash: "raw-hash", response: { ...readResult.response, secret: "raw-nested" } }; },
        async publicRespond(options) { order.push("respond"); calls.push(["respond", options]); if (serviceError) throw serviceError;
            if (contractMode) return contractService.publicRespond(options);
            return { revision: 4, status: options.status, attendeeCount: options.attendeeCount, token: "raw-token", admin: "raw-admin" }; }
    }
});
const app = express();
app.get("/api/eventos/:eventId/rsvp", routes.get);
app.post("/api/eventos/:eventId/rsvp", routes.post);
app.use(routes.errorHandler);
app.use((_req, _res, next) => { globalParses++; next(); });
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((_req, res) => res.status(404).end());
app.use((_error, _req, res, _next) => res.status(599).end("raw-error"));

function request({ method = "GET", url = "/api/eventos/synthetic-event/rsvp", headers = auth, body } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: url, method, headers }, (res) => {
            let text = ""; res.on("data", (chunk) => { text += chunk; });
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text, body: text ? JSON.parse(text) : null }));
        });
        req.on("error", reject); req.end(body);
    });
}
function verify(result, status, code) {
    assert.strictEqual(result.status, status);
    if (code) assert.strictEqual(result.body.error.code, code);
    if (result.body.error) assert(!["REVISION_CONFLICT", "RSVP_ATTENDEE_LIMIT", "RATE_LIMITED", "RATE_LIMIT_UNAVAILABLE", "INTERNAL_ERROR"].includes(result.body.error.code));
    assert.strictEqual(result.headers["cache-control"], "no-store");
    assert.strictEqual(result.headers["referrer-policy"], "no-referrer");
    assert(!result.headers.etag && !result.headers["last-modified"]);
    assert(result.headers["content-type"].startsWith("application/json"));
    for (const secret of [token, "raw-", "Authorization", "tokenHash", "stack"]) assert(!result.text.includes(secret));
    checks++;
}
function post(body = JSON.stringify(input), headers = { ...auth, "Content-Type": "application/json" }) { return request({ method: "POST", body, headers }); }
(async () => {
    server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    reset(); const valid = await request(); verify(valid, 200); assert.deepStrictEqual(valid.body, readResult);
    assert.deepStrictEqual(order, ["limiter", "read"]);
    assert.deepStrictEqual(calls[0], ["limit", { eventId: "synthetic-event", operation: "GET" }]);
    assert.deepStrictEqual(calls[1], ["read", { eventId: "synthetic-event", token }]);
    for (const headers of [{}, { Authorization: `Bearer ${token}` }, { Authorization: "RSVP invalid" },
        { Authorization: [`RSVP ${token}`, `RSVP ${token}`] }, { Authorization: `rsvp ${token}` },
        { Authorization: `RSVP  ${token}` }, { Cookie: `rsvp=${token}` }]) {
        reset(); verify(await request({ headers }), 404, "RSVP_NOT_AVAILABLE"); assert.deepStrictEqual(order, ["limiter"]);
    }
    for (const url of ["/api/eventos/UPPER/rsvp", "/api/eventos/x--y/rsvp", "/api/eventos/legacy-/rsvp",
        `/api/eventos/${"x".repeat(129)}/rsvp`, "/api/eventos/%ZZ/rsvp", "/api/eventos/a%2Fb/rsvp"]) {
        reset(); verify(await request({ url }), 404, "RSVP_NOT_AVAILABLE"); assert.strictEqual(calls.length, 0);
    }
    for (const method of ["GET", "POST"]) {
        reset(); verify(await request({ method, url: "/api/eventos/synthetic-event/rsvp?foo=bar",
            headers: { ...auth, "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify(input) : undefined }), 200);
        assert.strictEqual(calls[1][1].token, token);
        const queryToken = generateToken().token;
        for (const key of ["token", "rsvp", "authorization"]) {
            const url = `/api/eventos/synthetic-event/rsvp?${key}=${queryToken}`;
            for (const headers of [{}, { Authorization: `Bearer ${token}` }, auth]) {
                reset(); const validHeader = headers === auth;
                verify(await request({ method, url, headers: { ...headers, "Content-Type": "application/json" },
                    body: method === "POST" ? JSON.stringify(input) : undefined }), validHeader ? 200 : 404, validHeader ? undefined : "RSVP_NOT_AVAILABLE");
                if (validHeader) {
                    assert.strictEqual(calls[1][1].token, token);
                    assert(!JSON.stringify(calls).includes(queryToken));
                } else assert.strictEqual(calls.length, 1);
            }
        }
        reset(); rate = { allowed: false, retryAfterSeconds: 60 };
        const denied = await request({ method, headers: {}, body: method === "POST" ? "invalid" : undefined }); verify(denied, 429, "RSVP_RATE_LIMITED");
        assert.strictEqual(denied.headers["retry-after"], "60"); assert.strictEqual(calls.length, 1);
        reset(); rateError = new Error("raw-secret"); verify(await request({ method }), 503, "RSVP_RATE_LIMIT_UNAVAILABLE");
        reset(); rate = {}; verify(await request({ method }), 503, "RSVP_RATE_LIMIT_UNAVAILABLE");
    }
    for (const [code, status] of [["RSVP_NOT_AVAILABLE", 404], ["UPSTREAM_TIMEOUT", 504], ["RSVP_INTERNAL_ERROR", 500]]) {
        reset(); serviceError = new RsvpError(code); verify(await request(), status, toHttpError(serviceError).body.error.code);
    }
    for (const error of [new Error("raw-secret"), new RsvpError("ADMIN_INVITATION_NOT_FOUND"), new RsvpError("PII_RETENTION_EXPIRED")]) {
        reset(); serviceError = error; verify(await request(), 500, "RSVP_INTERNAL_ERROR");
    }
    // Archived GET is not blocked at HTTP; SQL/service decide availability.
    reset(); verify(await request(), 200); assert.strictEqual(calls[1][0], "read");
    reset(); verify(await post(), 200); assert.deepStrictEqual(calls[1], ["respond", { eventId: "synthetic-event", token, ...input }]);
    assert.deepStrictEqual(order, ["limiter", "respond"]);
    reset(); verify(await post(JSON.stringify({ ...input, status: "not_attending", attendeeCount: 0 })), 200);
    reset(); verify(await post(JSON.stringify(input), { ...auth, "Content-Type": "application/json; charset=utf-8" }), 200);
    // No capacity precheck: a count beyond a possibly stale cap reaches SQL.
    reset(); serviceError = new RsvpError("RSVP_ATTENDEE_COUNT_INVALID");
    verify(await post(JSON.stringify({ ...input, attendeeCount: 21 })), 422, "RSVP_ATTENDEE_COUNT_INVALID"); assert.strictEqual(calls.length, 2);
    for (const [message, code, status] of [["REVISION_CONFLICT", "RSVP_REVISION_CONFLICT", 409],
        ["RSVP_ATTENDEE_LIMIT", "RSVP_ATTENDEE_COUNT_INVALID", 422]]) {
        reset(); contractMode = true; sqlError = message; verify(await post(), status, code);
    }
    for (const method of ["GET", "POST"]) {
        for (const code of ["RSVP_CALENDAR_INVALID", "MANAGED_PUBLICATION_REQUIRED"]) {
            reset(); contractMode = true; contextError = code;
            const result = await request({ method, headers: { ...auth, "Content-Type": "application/json" },
                body: method === "POST" ? JSON.stringify(input) : undefined });
            verify(result, 404, "RSVP_NOT_AVAILABLE");
            assert(!result.text.includes("RSVP_CALENDAR_INVALID") && !result.text.includes("INVALID_MANAGED_CALENDAR"));
        }
    }
    for (const body of ["{", "null", "[]", "true", "", "{}", JSON.stringify({ ...input, status: "other" }),
        ...[-1, 0, 1.5, "2", null, 2147483648].map((attendeeCount) => JSON.stringify({ ...input, attendeeCount })),
        ...[0, 1.5, "3", null].map((expectedRevision) => JSON.stringify({ ...input, expectedRevision })),
        JSON.stringify({ ...input, status: "not_attending", attendeeCount: 1 }),
        JSON.stringify({ status: "attending", attendeeCount: 1 })]) {
        reset(); verify(await post(body), 400, "RSVP_INVALID_PAYLOAD"); assert.strictEqual(calls.length, 1);
    }
    for (const key of ["name", "email", "phone", "message", "token", "eventId", "revision", "__proto__"]) {
        reset(); verify(await post(JSON.stringify({ ...input, [key]: "raw-body" })), 400, "RSVP_INVALID_PAYLOAD"); assert.strictEqual(calls.length, 1);
    }
    for (const media of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=synthetic", "application/problem+json"]) {
        reset(); verify(await post(JSON.stringify(input), { ...auth, "Content-Type": media }), 400, "RSVP_INVALID_PAYLOAD");
    }
    reset(); verify(await post(JSON.stringify(input), auth), 400, "RSVP_INVALID_PAYLOAD");
    for (const encoding of ["gzip", "deflate", "br"]) {
        reset(); verify(await post(zlib.gzipSync(JSON.stringify(input)), { ...auth, "Content-Type": "application/json", "Content-Encoding": encoding }), 400, "RSVP_INVALID_PAYLOAD");
    }
    reset(); verify(await post(Buffer.alloc(2049, 32)), 400, "RSVP_INVALID_PAYLOAD");
    reset(); verify(await post(Buffer.alloc(100000, 32)), 400, "RSVP_INVALID_PAYLOAD");
    reset(); const padded = JSON.stringify(input).padEnd(2048, " "); verify(await post(padded), 200);
    reset(); verify(await post(Buffer.from(JSON.stringify(input), "utf16le"), { ...auth, "Content-Type": "application/json; charset=utf-16le" }), 200);
    reset(); verify(await post(JSON.stringify(input), { ...auth, "Content-Type": "application/json; charset=invalid" }), 400, "RSVP_INVALID_PAYLOAD");
    for (const code of ["RSVP_EVENT_ARCHIVED", "RSVP_DEADLINE_CLOSED", "RSVP_REVISION_CONFLICT", "RSVP_WRITE_RESULT_UNKNOWN", "RSVP_NOT_AVAILABLE"]) {
        reset(); serviceError = new RsvpError(code);
        const mapped = toHttpError(serviceError); verify(await post(), mapped.status, mapped.body.error.code); assert.strictEqual(calls.length, 2);
    }
    // GET does not parse a malformed or oversized body at all.
    reset(); verify(await request({ headers: { ...auth, "Content-Length": "3", "Content-Type": "application/json" }, body: "bad" }), 200);
    assert.strictEqual(globalParses, 0); checks++;
    const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    for (const method of ["get", "post"]) {
        const position = source.indexOf(`app.${method}('/api/eventos/:eventId/rsvp'`);
        assert(position >= 0 && position < source.indexOf("app.use(express.json") && position < source.indexOf("app.use(express.urlencoded")
            && position < source.indexOf("app.use(staticPolicy.guard)"));
    }
    assert.strictEqual((source.match(/createClient\(SUPABASE_URL, SUPABASE_KEY\)/g) || []).length, 1); checks++;
    console.log(`rsvp-http: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { if (server) server.close(); });
