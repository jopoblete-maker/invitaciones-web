"use strict";
// Loopback-only read simulator executing the real server.js, resolver and static policy.
// No Supabase client is created. Every mutation is rejected before server handlers.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto");
const { createRequire } = require("node:module");
const { signPreviewToken } = require("../js/core/private-preview-token");
const ROOT = path.resolve(__dirname, "..");
const VERSION = "11111111-1111-4111-8111-111111111111";
function createPublicPreview({ content, configuration, port = 0, secret = crypto.randomBytes(32).toString("hex"),
    eventStatus = "active", workflowStatus = "approved", published = true, versionEventId = content.id } = {}) {
    const express = require("express"), logs = [], writes = [];
    const created = new Date().toISOString();
    const event = { id: content.id, event_status: eventStatus, published_version_id: published ? VERSION : null,
        current_working_version_id: published ? null : VERSION, publication_revision: "0" };
    const version = { id: VERSION, event_id: versionEventId, version_number: 1, content,
        workflow_status: workflowStatus, created_at: created, published_at: published ? created : null, source_version_id: null };
    const rows = { eventos: [event], admin_event_publication_state: [event], event_versions: [version] };
    const supabase = { from(table) {
        if (!Object.hasOwn(rows, table)) throw new Error("Unexpected simulated table.");
        const filters = [];
        const result = () => rows[table].filter(row => filters.every(([k, v]) => row[k] === v));
        return { select() { return this; }, eq(k, v) { filters.push([k, v]); return this; }, order() { return this; },
            maybeSingle() { return Promise.resolve({ data: result()[0] || null, error: null }); },
            then(resolve, reject) { return Promise.resolve({ data: result(), error: null }).then(resolve, reject); } };
    }, rpc() { writes.push("forbidden"); throw new Error("SIMULATED_WRITES_FORBIDDEN"); } };
    let listener;
    const expressDouble = Object.assign(() => {
        const app = express();
        app.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : res.status(405).end());
        const listen = app.listen.bind(app);
        app.listen = (port, callback) => { listener = listen(port, "127.0.0.1", callback); return listener; };
        return app;
    }, express);
    const filename = path.join(ROOT, "server.js"), actualRequire = createRequire(filename);
    const requireDouble = name => name === "express" ? expressDouble : name === "@supabase/supabase-js"
        ? { createClient: () => supabase } : actualRequire(name);
    const env = { PORT: String(port), ADMIN_PASSWORD: crypto.randomBytes(32).toString("hex"),
        ADMIN_ALLOWED_ORIGINS: "http://127.0.0.1", PREVIEW_SIGNING_KEY: secret,
        SUPABASE_URL: "https://unused.invalid", SUPABASE_KEY: "simulated-unused",
        PREMIUM_AUTHORIZATION_CONFIG: JSON.stringify(configuration), PREMIUM_AUTHORIZATION_CHECK_ENABLED: "true",
        PREMIUM_AUTHORIZATION_REFERENCE_CONTENT: JSON.stringify(content) };
    const run = vm.runInNewContext("(function(require, __dirname, process, console, Buffer, setTimeout, clearTimeout, JSON) {\n"
        + fs.readFileSync(filename, "utf8") + "\n})", {});
    run(requireDouble, ROOT, { env }, { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
        Buffer, setTimeout, clearTimeout, JSON);
    const token = signPreviewToken({ eventId: content.id, versionId: VERSION, secret });
    return { server: listener, logs, writes, rows, token, secret, versionId: VERSION,
        close: () => { listener.closeAllConnections(); return new Promise(resolve => listener.close(resolve)); } };
}
if (require.main === module) {
    const privateDir = path.join(ROOT, ".dev/premium");
    const content = JSON.parse(fs.readFileSync(path.join(privateDir, "angel-eli-public.event.json"), "utf8"));
    const configuration = JSON.parse(fs.readFileSync(path.join(privateDir, "angel-eli-public.authorization.json"), "utf8"));
    const preview = createPublicPreview({ content, configuration, port: 4186 });
    preview.server.once("listening", () => console.log("Simulated public flow (not published): http://127.0.0.1:4186/invitacion.html?id=angel-eli-boda"));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => preview.close());
}
module.exports = { createPublicPreview, VERSION };
