"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { createEventVersionReadRepository } = require("../js/core/event-version-read-repository-supabase");
const { createEventVersionEditorialHttp } = require("../js/core/event-version-editorial-http");
const SECRET = "PRIVATE-SENTINEL-password-snapshot-person@example.test";
function repository({ phase, code, rejected = false, revision = "0", missing = false } = {}) {
    const queries = [];
    const providerError = Object.assign(new Error(SECRET), { code, details: SECRET, hint: SECRET, headers: { secret: SECRET }, content: SECRET });
    return { queries, read: createEventVersionReadRepository({ from(table) {
        queries.push(table);
        const query = { select() { return this; }, eq() { return this; }, order() { return this; },
            maybeSingle() { return this; }, then(resolve, reject) {
                if (table === phase && rejected) return Promise.reject(providerError).then(resolve, reject);
                return Promise.resolve(table === phase ? { error: providerError } : { error: null,
                    data: table === "admin_event_publication_state" ? (missing ? null : { id: "synthetic", event_status: "active",
                        published_version_id: null, current_working_version_id: null, publication_revision: revision }) : [] }).then(resolve, reject);
            } };
        return query;
    } }) };
}
async function invoke(read, { denied = false, logger } = {}) {
    const logs = [], headers = {};
    const http = createEventVersionEditorialHttp({ service: {}, readRepository: read,
        adminAccess: { async authorize() { return denied ? { ok: false, status: 401, code: "UNAUTHORIZED", message: "Unauthorized." } : { ok: true }; } },
        diagnosticLogger: logger || (record => logs.push(record)) });
    const res = { setHeader(k,v) { headers[k]=v; }, status(s) { this.statusCode=s; return this; }, json(body) { this.body=body; return this; } };
    await http.getEditorialState({ params: { eventId: SECRET }, headers: { "x-admin-password": SECRET, "x-correlation-id": SECRET }, body: { snapshot: SECRET } }, res);
    return { logs, headers, res };
}
for (const [phase, code, category, rejected] of [
    ["admin_event_publication_state", "PGRST205", "schema", false],
    ["admin_event_publication_state", "42501", "permission", false],
    ["admin_event_publication_state", "PGRST301", "configuration", false],
    ["admin_event_publication_state", "SUPABASE_TIMEOUT", "timeout", true],
    ["event_versions", "42703", "schema", false],
    ["event_versions", "SUPABASE_TIMEOUT", "timeout", true],
    ["event_versions", SECRET, "backend", false]
]) test(`sanitized read failure: ${phase} ${category} rejected=${rejected}`, async () => {
    const { read, queries } = repository({ phase, code, rejected });
    const { logs, headers, res } = await invoke(read);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } });
    assert.equal(logs.length, 1);
    const record = logs[0];
    assert.deepEqual(Object.keys(record).sort(), ["category", "code", "correlationId", "phase"]);
    assert.equal(record.phase, phase); assert.equal(record.category, category);
    assert.equal(record.code, code === SECRET ? "UNKNOWN" : code);
    assert.match(record.correlationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(headers["X-Correlation-ID"], record.correlationId);
    assert(!JSON.stringify({ logs, headers, body: res.body }).includes(SECRET));
    assert.deepEqual(queries, phase === "admin_event_publication_state" ? [phase] : ["admin_event_publication_state", phase]);
});
test("numeric revision remains rejected and is attributed to projection", async () => {
    const { res, logs } = await invoke(repository({ revision: 1 }).read);
    assert.equal(res.statusCode, 500); assert.equal(logs[0].phase, "admin_event_publication_state");
    assert.equal(logs[0].code, "INVALID_RESPONSE"); assert.equal(logs[0].category, "invalid_response");
});
test("success, missing event and denied access produce no failure diagnostics", async () => {
    for (const [options, status] of [[{},200], [{missing:true},404]]) {
        const { res, logs, headers } = await invoke(repository(options).read);
        assert.equal(res.statusCode,status); assert.deepEqual(logs,[]); assert.deepEqual(headers,{});
    }
    const r=repository({}); const denied=await invoke(r.read,{denied:true});
    assert.equal(denied.res.statusCode,401); assert.deepEqual(r.queries,[]); assert.deepEqual(denied.logs,[]);
});
test("logging failure does not change response and correlation IDs are generated independently", async () => {
    const r=repository({phase:"event_versions",code:"42501"});
    const a=await invoke(r.read),b=await invoke(r.read);
    assert.notEqual(a.headers["X-Correlation-ID"],b.headers["X-Correlation-ID"]);
    const c=await invoke(r.read,{logger(){throw Error(SECRET)}});
    assert.equal(c.res.statusCode,500);assert.deepEqual(c.res.body,a.res.body);
});
test("non-string provider code is never serialized into logs", async () => {
    const maliciousCode = { secret: SECRET, toString() { return "42501"; } };
    const { res, logs } = await invoke(repository({ phase: "event_versions", code: maliciousCode }).read);
    assert.equal(res.statusCode, 500); assert.equal(logs[0].code, "UNKNOWN");
    assert(!JSON.stringify(logs).includes(SECRET));
});
