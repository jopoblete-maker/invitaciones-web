"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const { createRequire } = require("node:module");
const express = require("express");
const SECRET = "synthetic-private-password";
const root = path.resolve(__dirname, "..");
let rate = "allow", writeError = false, reads = 0, writes = 0, rateCalls = 0;
const logs = [], saved = [];
const supabase = {
    rpc: async (name) => {
        assert.equal(name, "consume_admin_rate_limit"); rateCalls++;
        if (rate === "unavailable") return { error: new Error(SECRET) };
        return { data: [{ allowed: rate !== "limited", retry_after_seconds: 7 }] };
    },
    from: () => ({
        select() { return this; }, eq() { return this; },
        maybeSingle: async () => { reads++; return { data: null }; },
        upsert: async record => { writes++; saved.push(record); return { error: writeError ? new Error(SECRET) : null }; }
    })
};
const actualRequire = createRequire(path.join(root, "server.js"));
const makeExpress = () => { const app = express(); app.listen = () => {}; return app; };
Object.assign(makeExpress, express);
const env = { ADMIN_PASSWORD: SECRET, SUPABASE_URL: "https://synthetic.example.test", SUPABASE_KEY: "synthetic",
    ADMIN_ALLOWED_ORIGINS: "https://admin.example.test", ADMIN_RATE_LIMIT_WINDOW_SECONDS: "60", ADMIN_RATE_LIMIT_MAX_REQUESTS: "100" };
const run = vm.runInNewContext("(function(require,__dirname,process,console,Buffer,setTimeout,clearTimeout){"
    + fs.readFileSync(path.join(root, "server.js"), "utf8") + "\nreturn app;})");
const app = run(name => name === "express" ? makeExpress : name === "@supabase/supabase-js"
    ? { createClient: () => supabase } : actualRequire(name), root, { env }, {
        log: (...values) => logs.push(values), error: (...values) => logs.push(values)
    }, Buffer, setTimeout, clearTimeout);
let server;
function request(method, payload, headers = {}) {
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: "/api/eventos", method,
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...headers } }, res => {
                const chunks = [];
                res.on("data", b => chunks.push(b));
                res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(Buffer.concat(chunks)) }));
            });
        req.on("error", reject); req.end(body);
    });
}
(async () => {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    let checks = 0;
    for (const method of ["POST", "PUT"]) {
        for (const scenario of ["allowed", "wrong-password", "missing-origin", "bad-origin", "null-origin",
            "referer", "conflicting-credentials", "limited", "unavailable", "write-error", "bad-json"]) {
            reads = writes = rateCalls = 0; saved.length = 0; logs.length = 0;
            rate = scenario === "limited" ? "limited" : scenario === "unavailable" ? "unavailable" : "allow";
            writeError = scenario === "write-error";
            const payload = { id: "synthetic-legacy", nombre: "Synthetic", password: scenario === "wrong-password" ? "wrong" : SECRET };
            const headers = { Origin: "https://admin.example.test" };
            if (scenario === "missing-origin" || scenario === "referer") delete headers.Origin;
            if (scenario === "referer") headers.Referer = "https://admin.example.test/editor";
            if (scenario === "bad-origin") headers.Origin = "https://untrusted.example.test";
            if (scenario === "null-origin") headers.Origin = "null";
            if (scenario === "conflicting-credentials") headers["X-Admin-Password"] = "different";
            const result = await request(method, scenario === "bad-json" ? '{"password":"' + SECRET + '",' : payload, headers);
            const expected = { allowed: 200, referer: 200, "wrong-password": 401, "missing-origin": 403, "bad-origin": 403,
                "null-origin": 403, "conflicting-credentials": 401, limited: 429, unavailable: 503, "write-error": 500, "bad-json": 400 }[scenario];
            assert.equal(result.status, expected, method + " " + scenario);
            if (expected === 200) {
                assert.deepEqual(result.data, { success: true, id: payload.id }); assert.equal(writes, 1);
                assert(!Object.hasOwn(saved[0].datos, "password"));
            } else {
                assert.equal(typeof result.data.error, "string"); assert.deepEqual(Object.keys(result.data), ["error"]);
                if (scenario !== "write-error") { assert.equal(writes, 0); assert.equal(reads, 0); }
            }
            if (scenario === "limited") assert.equal(result.headers["retry-after"], "7");
            if ([401,403,400].includes(expected)) assert.equal(rateCalls, 0);
            assert(!JSON.stringify(result.data).includes(SECRET));
            assert(!JSON.stringify(logs).includes(SECRET));
            checks++;
        }
    }
    console.log("legacy administrative HTTP integration PASS: " + checks + " scenarios");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});
