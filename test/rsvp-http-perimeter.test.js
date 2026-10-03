"use strict";

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const util = require("util");
const express = require("express");
const { createRsvpPublicHttp } = require("../backend/rsvp/http");
const { createRsvpAdminHttp } = require("../backend/rsvp/admin-http");

const marker = "RSVP_G1_SYNTHETIC_SECRET";
const counters = { localParsers: 0, globalParsers: 0, globalErrors: 0, bodyReads: 0,
    service: 0, adapter: 0, limiter: 0, access: 0 };
const logs = [];
const savedConsole = Object.fromEntries(["error", "log", "warn"].map((name) => [name, console[name]]));
let server;
let checks = 0;
const parserFactory = { json(options) {
    const parse = express.json(options);
    return (req, res, next) => { counters.localParsers++; return parse(req, res, next); };
} };
const adapter = { invoke() { counters.adapter++; throw new Error(marker); } };
const operations = ["publicRead", "publicRespond", "readConfiguration", "syncConfiguration", "list",
    "createInvitation", "correctName", "correctResponse", "correctCapacity", "revoke", "rotate",
    "deleteInvitation", "aggregate", "auditList"];
const service = Object.fromEntries(operations.map((name) => [name, async () => {
    counters.service++;
    return adapter.invoke();
}]));
const publicHttp = createRsvpPublicHttp({ service, express: parserFactory,
    limiter: { async consume() { counters.limiter++; throw new Error(marker); } } });
const adminHttp = createRsvpAdminHttp({ service, express: parserFactory,
    adminAccess: { async authorize() { counters.access++; throw new Error(marker); } } });
const app = express();
app.use((req, _res, next) => {
    // Any attempt to inspect a body on the rejected request is observable.
    Object.defineProperty(req, "body", { configurable: true,
        get() { counters.bodyReads++; return undefined; },
        set(value) { Object.defineProperty(req, "body", { configurable: true, writable: true, value }); }
    });
    next();
});
app.get("/api/eventos/:eventId/rsvp", publicHttp.get);
app.post("/api/eventos/:eventId/rsvp", publicHttp.post);
app.use("/api/eventos/:eventId/rsvp", publicHttp.fallback);
app.use(publicHttp.errorHandler);
app.use("/api/admin/eventos/:eventId/rsvp", adminHttp.handle, adminHttp.fallback);
app.use(adminHttp.errorHandler);
app.use((req, res, next) => { counters.globalParsers++; next(); });
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use((error, _req, res, _next) => {
    counters.globalErrors++;
    console.error("Synthetic global raw handler", error);
    res.status(400).json({ error: error.message });
});
app.use((_req, res) => res.status(404).end());

function request(method, url, body) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: url, method,
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body),
                Authorization: marker, "X-Admin-Password": marker } }, (res) => {
            let text = "";
            res.on("data", (chunk) => { text += chunk; });
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
        });
        req.on("error", reject);
        req.end(body);
    });
}
function verify(result, method, status = 404) {
    assert.strictEqual(result.status, status);
    assert.strictEqual(result.headers["cache-control"], "no-store");
    assert.strictEqual(result.headers["referrer-policy"], "no-referrer");
    assert(!result.headers.etag && !result.headers["last-modified"]);
    assert(!result.text.includes(marker));
    if (method === "HEAD") assert.strictEqual(result.text, "");
    else assert.strictEqual(JSON.parse(result.text).error.code, status === 404 ? "RSVP_NOT_AVAILABLE" : "RSVP_INVALID_PAYLOAD");
    assert.deepStrictEqual(counters, Object.fromEntries(Object.keys(counters).map((name) => [name, 0])));
    assert.deepStrictEqual(logs, []);
    checks++;
}

(async () => {
    for (const name of Object.keys(savedConsole)) console[name] = (...args) => logs.push(util.format(...args));
    server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    const publicPrefix = "/api/eventos/synthetic-event/rsvp";
    const adminPrefix = "/api/admin/eventos/synthetic-event/rsvp";
    const cases = [
        ...["PUT", "PATCH", "DELETE", "OPTIONS"].map((method) => [method, publicPrefix]),
        ["GET", publicPrefix + "/unknown"], ["POST", publicPrefix + "/unknown"],
        ["POST", publicPrefix + "/unknown/deep"], ["HEAD", publicPrefix + "/unknown"],
        ["DELETE", publicPrefix + "/"], ["GET", publicPrefix + "/unknown?token=" + marker],
        ["PUT", "/API/EVENTOS/synthetic-event/RSVP"],
        ...["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].map((method) => [method, adminPrefix]),
        ["GET", adminPrefix + "/unknown"], ["POST", adminPrefix + "/unknown"],
        ...["PUT", "DELETE", "OPTIONS"].map((method) => [method, adminPrefix + "/configuration"]),
        ["HEAD", adminPrefix + "/configuration"],
        ["PATCH", adminPrefix + "/invitations/11111111-1111-1111-1111-111111111111/unknown"],
        ["GET", adminPrefix + "/unknown?authorization=" + marker],
        ["PUT", "/API/ADMIN/EVENTOS/synthetic-event/RSVP"]
    ];
    const bodies = ["{}", JSON.stringify({ secretMarker: marker }), '{"secretMarker":"' + marker + '",'];
    for (const [method, url] of cases) {
        for (const body of bodies) verify(await request(method, url, body), method);
    }
    // Parameter decoding failures happen before a mounted fallback dispatches.
    for (const method of ["PUT", "OPTIONS"]) {
        verify(await request(method, "/api/eventos/%ZZ/rsvp/unknown", bodies[2]), method);
        verify(await request(method, "/api/admin/eventos/%ZZ/rsvp/unknown", bodies[2]), method, 400);
        verify(await request(method, "/API/EVENTOS/%ZZ/RSVP/unknown", bodies[2]), method);
        verify(await request(method, "/API/ADMIN/EVENTOS/%ZZ/RSVP/unknown", bodies[2]), method, 400);
    }
    // A neighboring path is outside RSVP; the closure must not take it over.
    for (const url of [publicPrefix + "-other", adminPrefix + "-other", "/api/admin/eventos/synthetic-event/versions"]) {
        const before = counters.globalParsers;
        const result = await request("POST", url, "{}");
        assert.strictEqual(result.status, 404);
        assert.strictEqual(result.headers["referrer-policy"], undefined);
        assert.strictEqual(counters.globalParsers, before + 1);
        checks++;
    }
    assert.deepStrictEqual(logs, []);
    assert.strictEqual(counters.globalErrors, 0);
    const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    const publicMount = source.indexOf("app.use('/api/eventos/:eventId/rsvp', rsvpPublicHttp.fallback)");
    const adminMount = source.indexOf("app.use('/api/admin/eventos/:eventId/rsvp', rsvpAdminHttp.handle, rsvpAdminHttp.fallback)");
    assert(publicMount > source.indexOf("app.post('/api/eventos/:eventId/rsvp'"));
    for (const mount of [publicMount, adminMount]) {
        assert(mount >= 0 && mount < source.indexOf("app.use(express.json")
            && mount < source.indexOf("app.use(express.urlencoded"));
    }
    checks++;
})().then(() => savedConsole.log(`rsvp-http-perimeter: ${checks} checks passed`))
    .catch((error) => { savedConsole.error(error); process.exitCode = 1; })
    .finally(() => {
        for (const name of Object.keys(savedConsole)) console[name] = savedConsole[name];
        if (server) server.close();
    });
