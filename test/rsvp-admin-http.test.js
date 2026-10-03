const assert = require("assert");
const http = require("http");
const express = require("express");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const { createRsvpAdminHttp } = require("../backend/rsvp/admin-http");
const { createAdminAccess } = require("../backend/http/admin-access");
const { createAdminOriginPolicy } = require("../js/core/admin-origin-policy");
const { createRsvpService } = require("../backend/rsvp/service");
const { RsvpError, toHttpError } = require("../backend/rsvp/errors");
const tokens = require("../backend/rsvp/token");
const password = "synthetic-admin-password";
const eventId = "synthetic-event";
const invitationId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const prefix = `/api/admin/eventos/${eventId}/rsvp`;
const revisionBody = { expectedRevision: 4 };
const createBody = { displayName: "Synthetic", invitationType: "group", maxAttendees: 2, requestId };
const configuration = { eventId, eventStatus: "active", configured: true, revision: 7, timezone: "UTC",
    eventAt: "2027-06-12T18:30:00Z", deadlineAt: "2027-06-01T23:59:00Z", purgeDueAt: "2027-09-10T18:30:00Z", purged: false };
const invitation = { invitation_id: invitationId, display_name: "Synthetic", invitation_type: "group", max_attendees: 2,
    revoked: false, revision: 4, response_status: "attending", attendee_count: 2 };
const audit = { audit_id: invitationId, occurred_at: "2027-06-01T00:00:00Z", action: "CORRECT", actor_class: "authenticated_admin" };
const aggregate = { event_id: eventId, invitation_count: 1, attending_count: 1, not_attending_count: 0,
    unanswered_count: 0, attendee_count: 2, materialized_at: "2027-09-10T18:30:00Z" };
let checks = 0;
let server;
let calls;
let order;
let status;
let results;
let adapterError;
let rateError;
let rateAllowed;
let generated;
let globalParser = 0;
function reset() {
    calls = []; order = []; status = "active"; adapterError = undefined; rateError = undefined; rateAllowed = true; generated = [];
    results = { readConfiguration: { ...configuration }, configure: 8, list: [invitation],
        createInvitation: { invitationId, revision: 1, created: true },
        correctName: { invitationId, revision: 5, changed: true }, correctResponse: { revision: 5, changed: true },
        correctCapacity: { revision: 5, changed: true, type: "individual", maxAttendees: 1 },
        revoke: { revision: 5, changed: true }, rotate: { revision: 5, changed: true },
        deleteInvitation: { deleted: true }, aggregate: [aggregate], auditList: [audit], publicRead: {}, publicRespond: {} };
}
reset();
const adapter = Object.fromEntries(Object.keys(results).map((name) => [name, async (options) => {
    calls.push({ name, options }); order.push(name);
    if (adapterError) throw adapterError;
    return results[name];
}]));
const service = createRsvpService({ adapter, context: { async read() {
    order.push("context"); return { eventId, eventStatus: status, kind: "managed", publishedVersionId: "synthetic-version",
        editorialRevision: 999, timezone: "UTC", eventAt: configuration.eventAt, deadlineAt: results.readConfiguration.deadlineAt };
} }, token: { hashToken: tokens.hashToken, generateToken() { const value = tokens.generateToken(); generated.push(value); return value; } } });
const policy = createAdminOriginPolicy("http://localhost:3000");
const adminAccess = createAdminAccess({ adminPassword: password,
    originPolicy: { validateRequest(req) { order.push("origin"); return policy.validateRequest(req); } },
    rateLimiter: { async consume(options) { order.push("limit"); calls.push({ name: "limit", options });
        if (rateError) throw rateError;
        return { allowed: rateAllowed, retryAfterSeconds: 60 }; } }
});
const controller = createRsvpAdminHttp({ service, adminAccess, express });
const app = express();
app.use((req, _res, next) => {
    const get = req.get.bind(req);
    req.get = (name) => { if (name === "X-Admin-Password") order.push("auth"); return get(name); };
    next();
});
app.use("/api/admin/eventos/:eventId/rsvp", controller.handle);
app.use(controller.errorHandler);
app.use((_req, _res, next) => { globalParser++; next(); });
app.use(express.json({ limit: "50mb" }));
app.use((_req, res) => res.status(404).end());
app.use((_err, _req, res, _next) => res.status(599).end("raw-error"));
function request(method, suffix, body, headers, rawUrl) {
    const encoded = body === undefined ? undefined : typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    const requestHeaders = { ...(headers || { "X-Admin-Password": password, Origin: "http://localhost:3000", "Content-Type": "application/json" }),
        ...(encoded === undefined ? {} : { "Content-Length": Buffer.byteLength(encoded) }) };
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port: server.address().port, method,
            path: rawUrl || prefix + suffix, headers: requestHeaders }, (res) => {
            let text = ""; res.on("data", (chunk) => { text += chunk; });
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text, body: text ? JSON.parse(text) : null }));
        });
        req.on("error", reject); req.end(encoded);
    });
}
function verify(result, expected, code, tokenAllowed = false) {
    assert.strictEqual(result.status, expected);
    if (code) assert.strictEqual(result.body.error.code, code);
    assert.strictEqual(result.headers["cache-control"], "no-store");
    assert.strictEqual(result.headers["referrer-policy"], "no-referrer");
    assert(!result.headers.etag && !result.headers["last-modified"]);
    assert(result.headers["content-type"].startsWith("application/json"));
    for (const marker of [password, "raw-", "tokenHash", "token_hash", "stack"]) assert(!result.text.includes(marker));
    if (!tokenAllowed) { assert(!Object.prototype.hasOwnProperty.call(result.body, "token")); for (const value of generated) assert(!result.text.includes(value.token)); }
    checks++;
}
async function failure(method, suffix, body, code) {
    const error = new RsvpError(code); adapterError = error;
    const mapped = toHttpError(error); verify(await request(method, suffix, body), mapped.status, mapped.body.error.code);
}
const cases = [
    ["GET", "/configuration", undefined, "readConfiguration"], ["POST", "/configuration", {}, "syncConfiguration"],
    ["GET", "/invitations", undefined, "list"], ["POST", "/invitations", createBody, "createInvitation"],
    ["PATCH", `/invitations/${invitationId}/name`, { displayName: "New synthetic", ...revisionBody }, "correctName"],
    ["PATCH", `/invitations/${invitationId}/response`, { status: "attending", attendeeCount: 2, ...revisionBody }, "correctResponse"],
    ["PATCH", `/invitations/${invitationId}/capacity`, { invitationType: "individual", maxAttendees: 1, ...revisionBody }, "correctCapacity"],
    ["POST", `/invitations/${invitationId}/revoke`, revisionBody, "revoke"],
    ["POST", `/invitations/${invitationId}/rotate`, revisionBody, "rotate"],
    ["DELETE", `/invitations/${invitationId}`, revisionBody, "deleteInvitation"],
    ["GET", "/aggregate", undefined, "aggregate"], ["GET", "/audit", undefined, "auditList"]
];
(async () => {
    server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    for (const [method, suffix, body, operation] of cases) {
        reset(); const result = await request(method, suffix, body);
        assert.strictEqual(result.status, operation === "createInvitation" ? 201 : 200, `${method} ${suffix}`);
        verify(result, operation === "createInvitation" ? 201 : 200, undefined, ["createInvitation", "rotate"].includes(operation));
        if (method === "GET") assert.deepStrictEqual(order, ["auth", operation]);
        else assert.deepStrictEqual(order.slice(0, 3), operation === "syncConfiguration" ? ["auth", "origin", "limit"] : ["origin", "auth", "limit"]);
        if (operation === "syncConfiguration") {
            assert.strictEqual(calls.at(-1).name, "configure");
            assert.strictEqual(calls.at(-1).options.expectedRevision, 7);
            assert.deepStrictEqual(result.body, { revision: 8, sourceVersionId: "synthetic-version" });
        } else assert.strictEqual(calls.at(-1).name, operation);
        if (method !== "GET") {
            const bucket = calls[0].options;
            assert(!JSON.stringify(bucket).includes(eventId) && !JSON.stringify(bucket).includes(invitationId)
                && !JSON.stringify(bucket).includes(password) && !JSON.stringify(bucket).includes("Synthetic"));
            assert.strictEqual(bucket.action, operation);
        }
        if (["createInvitation", "rotate"].includes(operation)) {
            assert.strictEqual(generated.length, 1); assert.strictEqual(result.body.token, generated[0].token);
            assert.deepStrictEqual(calls.at(-1).options.tokenHash, tokens.hashToken(result.body.token));
            assert(!("token" in calls.at(-1).options));
        }
        // Frozen archived matrix, exercised through the real service.
        reset(); status = "archived";
        const allowed = method === "GET" || method === "DELETE";
        verify(await request(method, suffix, body), allowed ? 200 : 409, allowed ? undefined : "ADMIN_EVENT_NOT_ACTIVE");
        if (!allowed) { assert.strictEqual(calls.filter((call) => call.name !== "limit").length, 0); assert.strictEqual(generated.length, 0); }
    }
    for (const headers of [{}, { "X-Admin-Password": "wrong" }]) {
        reset(); verify(await request("GET", "/configuration", undefined, headers), 401, "UNAUTHORIZED"); assert.strictEqual(calls.length, 0);
        reset(); verify(await request("POST", "/configuration", "bad", headers), 401, "UNAUTHORIZED"); assert.deepStrictEqual(order, ["auth"]);
    }
    for (const headers of [{ "X-Admin-Password": password }, { "X-Admin-Password": password, Origin: "http://invalid.example" },
        { "X-Admin-Password": "wrong", Origin: "http://invalid.example" }]) {
        reset(); verify(await request("POST", "/invitations", "bad", headers), 403, "ORIGIN_FORBIDDEN"); assert.deepStrictEqual(order, ["origin"]);
    }
    reset(); verify(await request("POST", "/configuration", {}, { "X-Admin-Password": password, Referer: "http://localhost:3000/admin.html", "Content-Type": "application/json" }), 200);
    reset(); rateAllowed = false; const limited = await request("POST", "/invitations", "bad"); verify(limited, 429, "RATE_LIMITED");
    assert.strictEqual(limited.headers["retry-after"], "60"); assert.strictEqual(calls.length, 1);
    reset(); rateError = { code: "RATE_LIMIT_UNAVAILABLE", message: "raw-secret" };
    verify(await request("POST", "/invitations", createBody), 503, "RATE_LIMIT_UNAVAILABLE"); assert.strictEqual(calls.length, 1);
    reset(); results.readConfiguration.configured = false; verify(await request("GET", "/configuration"), 409, "MANAGED_CONFIG_NOT_FOUND");
    reset(); results.list = []; verify(await request("GET", "/invitations"), 200);
    reset(); verify(await request("GET", `/invitations?limit=200&afterId=${invitationId}`), 200);
    assert.deepStrictEqual(calls[0].options, { eventId, limit: 200, afterId: invitationId });
    reset(); verify(await request("GET", "/audit?limit=100"), 200); assert.strictEqual(calls[0].options.limit, 100);
    for (const suffix of ["/invitations?limit=201", "/invitations?afterId=bad", "/audit?limit=1&limit=2", "/audit?token=bad"]) {
        reset(); verify(await request("GET", suffix), 400, "RSVP_INVALID_PAYLOAD"); assert.strictEqual(calls.length, 0);
    }
    reset(); verify(await request("POST", "/invitations", { ...createBody, invitationType: "individual", maxAttendees: 1 }), 201, undefined, true);
    reset(); results.createInvitation.created = false; results.createInvitation.token = "raw-spurious";
    verify(await request("POST", "/invitations", createBody), 200); assert.strictEqual(generated.length, 1);
    assert.strictEqual(calls.at(-1).options.requestId, requestId);
    for (const body of [{ ...createBody, requestId: "bad" }, { ...createBody, requestId: undefined },
        { ...createBody, displayName: " " }, { ...createBody, displayName: "x".repeat(121) },
        { ...createBody, invitationType: "individual", maxAttendees: 2 }, { ...createBody, maxAttendees: 21 }, { ...createBody, token: "raw-token" }]) {
        reset(); verify(await request("POST", "/invitations", body), 400, "RSVP_INVALID_PAYLOAD"); assert.strictEqual(generated.length, 0);
    }
    for (const displayName of ["", " ", "x".repeat(121)]) {
        reset(); verify(await request("PATCH", `/invitations/${invitationId}/name`, { displayName, ...revisionBody }), 400, "RSVP_INVALID_PAYLOAD");
    }
    reset(); verify(await request("PATCH", `/invitations/${invitationId}/name`, { displayName: "😀".repeat(120), ...revisionBody }), 200);
    reset(); verify(await request("PATCH", `/invitations/${invitationId}/response`, { status: "not_attending", attendeeCount: 0, ...revisionBody }), 200);
    reset(); verify(await request("PATCH", `/invitations/${invitationId}/capacity`, { invitationType: "group", maxAttendees: 20, ...revisionBody }), 200);
    // The HTTP/service layers impose no public deadline on administrative correction.
    reset(); results.readConfiguration.deadlineAt = "2000-01-01T00:00:00Z";
    verify(await request("PATCH", `/invitations/${invitationId}/response`, { status: "attending", attendeeCount: 1, ...revisionBody }), 200);
    reset(); verify(await request("PATCH", `/invitations/${invitationId}/response`, { status: "attending", attendeeCount: 1, reason: "raw-reason", ...revisionBody }), 400, "RSVP_INVALID_PAYLOAD");
    for (const [method, suffix, body, code] of [
        ["GET", "/configuration", undefined, "ADMIN_EVENT_NOT_FOUND"],
        ["PATCH", `/invitations/${invitationId}/name`, { displayName: "New", ...revisionBody }, "ADMIN_INVITATION_NOT_FOUND"],
        ["PATCH", `/invitations/${invitationId}/response`, { status: "attending", attendeeCount: 3, ...revisionBody }, "RSVP_ATTENDEE_COUNT_INVALID"],
        ["PATCH", `/invitations/${invitationId}/response`, { status: "attending", attendeeCount: 1, ...revisionBody }, "RSVP_REVISION_CONFLICT"],
        ["PATCH", `/invitations/${invitationId}/capacity`, { invitationType: "individual", maxAttendees: 1, ...revisionBody }, "CAPACITY_BELOW_CURRENT_ATTENDANCE"],
        ["DELETE", `/invitations/${invitationId}`, revisionBody, "ADMIN_INVITATION_NOT_FOUND"],
        ["GET", "/invitations", undefined, "PII_RETENTION_EXPIRED"],
        ["POST", "/invitations", createBody, "IDEMPOTENCY_KEY_CONSUMED"],
        ["GET", "/configuration", undefined, "UPSTREAM_TIMEOUT"],
        ["POST", "/configuration", {}, "MANAGED_PUBLICATION_REQUIRED"],
        ["POST", "/configuration", {}, "MANAGED_NOT_ENABLED"]
    ]) { reset(); await failure(method, suffix, body, code); }
    for (const [suffix, body] of [["/invitations", createBody], [`/invitations/${invitationId}/rotate`, revisionBody]]) {
        reset(); await failure("POST", suffix, body, "RSVP_WRITE_RESULT_UNKNOWN");
        assert.strictEqual(generated.length, 1); assert.strictEqual(calls.filter((call) => call.name !== "limit").length, 1);
    }
    reset(); results.rotate.revoked = true; const rotated = await request("POST", `/invitations/${invitationId}/rotate`, revisionBody);
    verify(rotated, 200, undefined, true); assert.strictEqual(rotated.body.revoked, true);
    for (const operation of ["list", "deleteInvitation", "auditList", "aggregate", "readConfiguration"]) {
        reset(); const target = results[operation];
        const extra = { token: "raw-token", token_hash: "raw-hash", password: "raw-password", details: "raw-error", displayName: "raw-pii" };
        if (Array.isArray(target)) results[operation] = target.map((row) => ({ ...row, ...extra })); else results[operation] = { ...target, ...extra };
        const entry = cases.find((item) => item[3] === operation); verify(await request(entry[0], entry[1], entry[2]), 200);
    }
    for (const body of ["{", "[]", "null", "", Buffer.alloc(2049, 32), { expectedRevision: 0 }]) {
        reset(); verify(await request("POST", `/invitations/${invitationId}/revoke`, body), 400, "RSVP_INVALID_PAYLOAD");
    }
    for (const media of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
        reset(); verify(await request("POST", "/configuration", {}, { "X-Admin-Password": password, Origin: "http://localhost:3000", "Content-Type": media }), 400, "RSVP_INVALID_PAYLOAD");
    }
    reset(); verify(await request("POST", "/configuration", zlib.gzipSync("{}"), { "X-Admin-Password": password, Origin: "http://localhost:3000", "Content-Type": "application/json", "Content-Encoding": "gzip" }), 400, "RSVP_INVALID_PAYLOAD");
    for (const url of ["/api/admin/eventos/UPPER/rsvp/configuration", "/api/admin/eventos/%ZZ/rsvp/configuration", prefix + "/invitations/bad/name"]) {
        reset(); const mutation = url.endsWith("name");
        verify(await request(mutation ? "PATCH" : "GET", "", mutation ? { displayName: "New", ...revisionBody } : undefined, undefined, url), 400, "RSVP_INVALID_PAYLOAD");
    }
    reset(); adapterError = new Error("raw-secret"); verify(await request("GET", "/configuration"), 500, "RSVP_INTERNAL_ERROR");
    assert.strictEqual(globalParser, 0); checks++;
    const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    const mounted = source.indexOf("app.use('/api/admin/eventos/:eventId/rsvp'");
    assert(mounted >= 0 && mounted < source.indexOf("app.use(express.json") && mounted < source.indexOf("app.use(staticPolicy.guard)"));
    assert.strictEqual((source.match(/const adminAccess = createAdminAccess/g) || []).length, 1); checks++;
    console.log(`rsvp-admin-http: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { if (server) server.close(); });
