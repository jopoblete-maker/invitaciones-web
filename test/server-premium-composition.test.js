"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const { createStaticPolicy } = require("../backend/http/static-policy");

function content() {
    return { schema_version: 2, id: "synthetic-server-premium", event_type: "wedding", plan: "premium",
        status: "draft", template: { slug: "boda-fiesta-premium" }, identity: { title: "Synthetic wedding" },
        schedule: { date: "2026-12-05" }, modules: {}, media: { items: {} }, sections: [
            { id: "hero", type: "hero", enabled: true, order: 1, data: {} },
            { id: "gift", type: "gifts", enabled: true, order: 2,
                data: { title: "Gift", message: "Synthetic gift message", cbu: "0".repeat(22) } },
            { id: "album", type: "collaborative-album", enabled: true, order: 3,
                data: { url: "https://album.example.com/synthetic" } }
        ] };
}
function configuration(value) {
    return { entries: [{ revision: 1, manifest: { status: "approved", eventId: value.id,
        templateSlug: value.template.slug, canonicalDigest: canonicalContentDigest(value), media: {},
        gifts: { gift: { ...value.sections[1].data } }, albumUrls: [value.sections[2].data.url] } }] };
}

function server(configurationText, rows, startupEnvironment = {}) {
    const routes = {}, writes = [], logs = [];
    let rpcCalls = 0;
    const express = () => ({ use() {}, listen() {},
        get(p, handler) { routes[`GET ${p}`] = handler; },
        post(p, handler) { routes[`POST ${p}`] = handler; },
        put(p, handler) { routes[`PUT ${p}`] = handler; } });
    express.json = express.urlencoded = express.static = () => (_req, _res, next) => next();
    const supabase = { from(table) {
        if (!rows) throw new Error("Unexpected database read");
        let id;
        return { select() { return this; }, eq(_column, value) { id = value; return this; },
            maybeSingle() { return Promise.resolve({ data: rows[table]?.[id] || null, error: null }); } };
    },
        async rpc(name, parameters) {
            rpcCalls++;
            if (name === "consume_admin_rate_limit") return { data: [{ allowed: true,
                retry_after_seconds: 0, current_count: 1 }], error: null };
            writes.push({ name, parameters });
            return { data: [{ event_id: parameters.p_event_id,
                version_id: "11111111-1111-4111-8111-111111111111", version_number: 1, workflow_status: "draft" }], error: null };
        } };
    const filename = path.resolve(__dirname, "../server.js"), actualRequire = createRequire(filename);
    const requireDouble = name => name === "express" ? express
        : name === "@supabase/supabase-js" ? { createClient: () => supabase } : actualRequire(name);
    const env = { ADMIN_PASSWORD: "synthetic-password", ADMIN_ALLOWED_ORIGINS: "http://localhost:3000",
        ADMIN_RATE_LIMIT_WINDOW_SECONDS: "60", ADMIN_RATE_LIMIT_MAX_REQUESTS: "100",
        SUPABASE_URL: "https://example.supabase.co", SUPABASE_KEY: "synthetic-key" };
    if (configurationText !== undefined) env.PREMIUM_AUTHORIZATION_CONFIG = configurationText;
    Object.assign(env, startupEnvironment);
    const run = vm.runInNewContext(`(function(require, __dirname, process, console, Buffer, setTimeout, clearTimeout, JSON) {
        ${fs.readFileSync(filename, "utf8")}
    })`, {});
    run(requireDouble, path.dirname(filename), { env },
        { log: (...args) => logs.push(args), error: (...args) => logs.push(args) }, Buffer, setTimeout, clearTimeout, JSON);
    return { routes, writes, logs, express, rpcCalls: () => rpcCalls };
}
function response() {
    return { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }, end() { return this; } };
}
async function request(h, value, extra = {}, eventId = value.id) {
    const headers = { origin: "http://localhost:3000", "x-admin-password": "synthetic-password",
        "content-type": "application/json", ...extra.headers };
    const results = [];
    for (const p of ["POST /api/admin/eventos", "POST /api/admin/eventos/:eventId/versions"]) {
        const res = response();
        await h.routes[p]({ headers, params: { eventId }, query: extra.query || {},
            body: { eventId, content: value, expectedWorkingVersionId: null, ...extra.body } }, res);
        results.push(res);
    }
    return results;
}

(async () => {
    const value = content(), cfg = configuration(value), text = JSON.stringify(cfg);
    const valid = server(text);
    for (const res of await request(valid, value)) {
        assert.equal(res.statusCode, 201);
        assert(!JSON.stringify(res.body).includes("canonicalDigest"));
        assert(!JSON.stringify(res.body).includes("0".repeat(22)));
    }
    assert.equal(valid.writes.length, 2);
    for (const write of valid.writes) assert.deepEqual(write.parameters.p_content, value);
    assert(!JSON.stringify(valid.logs).includes(cfg.entries[0].manifest.canonicalDigest));
    assert(!JSON.stringify(valid.logs).includes("0".repeat(22)));

    const versionId = "11111111-1111-4111-8111-111111111111";
    const rows = { eventos: { [value.id]: { id: value.id, event_status: "active", published_version_id: versionId } },
        event_versions: { [versionId]: { id: versionId, event_id: value.id, content: value,
            workflow_status: "approved", published_at: "2026-10-12T12:00:00Z" } } };
    const published = server(text, rows), publicResponse = response();
    await published.routes["GET /api/eventos/:id"]({ params: { id: value.id } }, publicResponse);
    assert.equal(publicResponse.statusCode, 200);
    assert.equal(publicResponse.headers["Cache-Control"], "no-store");
    assert.equal(publicResponse.body.versionId, versionId);
    assert.deepEqual([...publicResponse.body.presentation.giftFields.gift].sort(), ["cbu", "message", "title"]);
    assert(!JSON.stringify(publicResponse.body).includes("canonicalDigest"));
    assert.equal(published.writes.length, 0);
    const missingApproval = server(undefined, rows), deniedResponse = response();
    await missingApproval.routes["GET /api/eventos/:id"]({ params: { id: value.id } }, deniedResponse);
    assert.equal(deniedResponse.statusCode, 404);
    assert.equal(missingApproval.writes.length, 0);

    // Startup uses the operational provider with an independent canonical JSON
    // reference. No RPC, database query or writable adapter is used by the check.
    const enabled = { PREMIUM_AUTHORIZATION_CHECK_ENABLED: "true",
        PREMIUM_AUTHORIZATION_REFERENCE_CONTENT: JSON.stringify(value) };
    const checked = server(text, rows, enabled);
    assert.equal(checked.rpcCalls(), 0);
    assert.equal(checked.writes.length, 0);
    assert.deepEqual(checked.logs.filter(args => String(args[0]).startsWith("PREMIUM_STARTUP_AUTHORIZATION")),
        [["PREMIUM_STARTUP_AUTHORIZATION PASS"]]);
    assert.deepEqual(Object.keys(checked.routes), Object.keys(valid.routes));
    const checkedResponse = response();
    await checked.routes["GET /api/eventos/:id"]({ params: { id: value.id } }, checkedResponse);
    assert.equal(checkedResponse.statusCode, 200);
    assert.equal(checked.rpcCalls(), 0);

    const revocation = structuredClone(cfg);
    revocation.entries.push({ revision: 2, manifest: { ...revocation.entries[0].manifest, status: "revoked" } });
    for (const [approval, environment] of [
        [text, { PREMIUM_AUTHORIZATION_CHECK_ENABLED: "true" }],
        [undefined, enabled], ["not-json", enabled], [JSON.stringify(revocation), enabled],
        [text, { ...enabled, PREMIUM_AUTHORIZATION_REFERENCE_CONTENT: "not-json" }],
        [text, { ...enabled, PREMIUM_AUTHORIZATION_REFERENCE_CONTENT: JSON.stringify(cfg) }],
        [text, { ...enabled, PREMIUM_AUTHORIZATION_REFERENCE_CONTENT: JSON.stringify({ ...value, id: "other-event" }) }],
        [text, { ...enabled, PREMIUM_AUTHORIZATION_REFERENCE_CONTENT: JSON.stringify({ ...value, identity: { title: "Changed" } }) }],
        [text, { ...enabled, PREMIUM_AUTHORIZATION_CHECK_ENABLED: "invalid" }]
    ]) {
        const failed = server(approval, rows, environment);
        assert.equal(failed.rpcCalls(), 0);
        assert.equal(failed.writes.length, 0);
        assert.deepEqual(failed.logs.filter(args => String(args[0]).startsWith("PREMIUM_STARTUP_AUTHORIZATION")),
            [["PREMIUM_STARTUP_AUTHORIZATION FAIL"]]);
        const res = response();
        await failed.routes["GET /api/eventos/:id"]({ params: { id: value.id } }, res);
        assert.equal(res.statusCode, 404);
        assert.equal(failed.rpcCalls(), 0);
        for (const result of await request(failed, value)) assert.notEqual(result.statusCode, 201);
        assert.equal(failed.writes.length, 0);
        for (const result of await request(failed, { nombre: "Synthetic legacy" }, {}, "synthetic-legacy")) {
            assert.equal(result.statusCode, 201);
        }
        const civil = { schema_version: 2, id: "synthetic-civil", event_type: "wedding-civil", plan: "esencial",
            status: "draft", template: { slug: "boda-civil-esencial" }, identity: { title: "Synthetic civil" },
            schedule: { date: "2026-12-05" }, modules: {}, media: { items: {} },
            sections: [{ id: "hero", type: "hero", enabled: true, order: 1, data: {} }] };
        for (const result of await request(failed, civil)) assert.equal(result.statusCode, 201);
        const logs = JSON.stringify(failed.logs);
        for (const secret of ["canonicalDigest", cfg.entries[0].manifest.canonicalDigest,
            value.identity.title, value.sections[1].data.cbu, "synthetic-password", "synthetic-key"]) {
            assert(!logs.includes(secret));
        }
    }
    const disabled = server(text, rows, { PREMIUM_AUTHORIZATION_CHECK_ENABLED: "false",
        PREMIUM_AUTHORIZATION_REFERENCE_CONTENT: "invalid" });
    for (const h of [valid, disabled]) {
        assert(!h.logs.some(args => String(args[0]).startsWith("PREMIUM_STARTUP_AUTHORIZATION")));
    }
    const disabledResponse = response();
    await disabled.routes["GET /api/eventos/:id"]({ params: { id: value.id } }, disabledResponse);
    assert.equal(disabledResponse.statusCode, 200);

    const revoked = structuredClone(cfg);
    revoked.entries.push({ revision: 2, manifest: { ...revoked.entries[0].manifest, status: "revoked" } });
    const duplicate = structuredClone(cfg); duplicate.entries.push(structuredClone(duplicate.entries[0]));
    for (const config of [undefined, "not-json", "{}", JSON.stringify(revoked), JSON.stringify(duplicate)]) {
        const h = server(config);
        for (const res of await request(h, value, { body: { PREMIUM_AUTHORIZATION_CONFIG: text, manifest: cfg,
            getAuthorizationState: () => ({ approved: true }) }, query: { authorization: text },
            headers: { "x-premium-authorization": text } })) {
            assert.notEqual(res.statusCode, 201);
            assert(!JSON.stringify(res.body).includes("canonicalDigest"));
            assert(!JSON.stringify(res.body).includes(".dev/"));
        }
        assert.equal(h.writes.length, 0);
        // Missing/invalid premium configuration does not block legacy editorial JSON.
        for (const res of await request(h, { nombre: "Synthetic legacy" }, {}, "synthetic-legacy")) assert.equal(res.statusCode, 201);
    }
    for (const change of [c => { c.identity.title = "Modified"; },
        c => { c.sections[2].data.url = "https://album.example.com/other"; },
        c => { c.id = "other-event"; }]) {
        const altered = content(); change(altered); const h = server(text);
        for (const res of await request(h, altered, {}, value.id)) assert.notEqual(res.statusCode, 201);
        assert.equal(h.writes.length, 0);
    }
    const policy = createStaticPolicy({ root: path.resolve(__dirname, ".."), express: valid.express });
    for (const url of ["/.dev/premium/approval.json", "/.dev/drafts/commercial.json",
        "/backend/premium/authorization-provider.js", "/assets/templates/boda-fiesta-premium/ornamento-floral.svg"]) {
        const res = response(); let next = false;
        policy.guard({ url }, res, () => { next = true; });
        assert.equal(res.statusCode, 404); assert.equal(next, false);
    }
    console.log("server premium composition tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
