const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const express = require("express");
const { createStaticPolicy } = require("../backend/http/static-policy");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "a9-http-static-"));
const root = path.join(fixture, "public");
fs.mkdirSync(path.join(root, "backend", "http"), { recursive: true });
fs.mkdirSync(path.join(root, "assets"));
fs.mkdirSync(path.join(root, "api"));
fs.writeFileSync(path.join(root, "api", "internal.sql"), "synthetic-private-marker");
fs.writeFileSync(path.join(root, "backend", "http", "private.js"), "synthetic-private-marker");
fs.writeFileSync(path.join(root, "backend", "http", "private.js.map"), "synthetic-source-map");
fs.writeFileSync(path.join(root, "backend", "config.json"), "synthetic-config");
fs.writeFileSync(path.join(root, "invitacion.html"), "synthetic-invitation");
fs.writeFileSync(path.join(root, "admin.html"), "synthetic-admin");
fs.writeFileSync(path.join(root, "assets", "musica.mp3"), "synthetic-asset");
fs.writeFileSync(path.join(root, "backend", "musica.mp3"), "synthetic-private-marker");
fs.mkdirSync(path.join(root, "assets", "events"));
fs.symlinkSync(path.join(root, "backend"), path.join(root, "assets", "events", "kaly-joha"), "junction");
fs.writeFileSync(path.join(root, ".hidden"), "synthetic-dotfile");
fs.mkdirSync(path.join(root, ".hidden-dir"));
fs.writeFileSync(path.join(root, ".hidden-dir", "public.txt"), "synthetic-dotfile");
fs.symlinkSync(path.join(root, "backend"), path.join(root, "alias"), "junction");
fs.symlinkSync(path.join(root, "backend"), path.join(root, "%61lias"), "junction");
fs.mkdirSync(path.join(fixture, "outside"));
fs.writeFileSync(path.join(fixture, "outside", "private.txt"), "synthetic-outside");
fs.mkdirSync(path.join(root, "assets", "templates"));
fs.writeFileSync(path.join(fixture, "outside", "thumbnail.webp"), "synthetic-outside");
fs.symlinkSync(path.join(fixture, "outside"), path.join(root, "assets", "templates", "boda-vertical"), "junction");
fs.mkdirSync(path.join(root, "css", "templates"), { recursive: true });
fs.writeFileSync(path.join(root, "css", "style.css"), "synthetic-public-style");
fs.mkdirSync(path.join(root, "css", "templates", "cumple-clasico.css"));
fs.writeFileSync(path.join(root, "css", "templates", "cumple-clasico.css", "index.html"), "synthetic-private-marker");
fs.symlinkSync(path.join(root, "backend"), path.join(root, "css", "templates", "boda-civil-esencial.css"), "junction");
fs.symlinkSync(path.join(fixture, "outside"), path.join(root, "outside-alias"), "junction");

const app = express();
const policy = createStaticPolicy({ root, express });
app.use(policy.guard);
app.use("/assets", express.static(path.join(root, "assets"), { maxAge: 3600000, dotfiles: "ignore" }));
app.use(policy.serveRoot);
const dynamicRoutes = [
    ["get", "/api/eventos/synthetic-event"], ["post", "/api/eventos"], ["put", "/api/eventos"],
    ["get", "/api/admin/eventos"], ["post", "/api/admin/eventos/synthetic-event/versions"],
    ["get", "/api/catalogo/previews/synthetic-event"], ["get", "/api/preview"]
];
for (const [method, url] of dynamicRoutes) app[method](url, (_req, res) => res.status(204).end());
app.use((_req, res) => res.status(404).end());
let server;
let securityChecks = 0;
let privacyChecks = 0;
function request(url, method = "GET", headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: url, method, headers }, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
        });
        req.on("error", reject);
        req.end();
    });
}

(async () => {
    server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    const blocked = [
        "/backend", "/backend/", "/backend/http/private.js", "/backend/http/private.js.map", "/backend/config.json",
        "/BACKEND/http/private.js", "/BackEnd", "/%62ackend/http/private.js", "/%2562ackend/http/private.js",
        "/backend%2fhttp%2fprivate.js", "/%252562ackend/http/private.js", "/x/../backend/http/private.js",
        "/x/%2e%2e/backend/http/private.js", "/backend\\http\\private.js", "/backend%5chttp%5cprivate.js",
        "/x%5c..%5cbackend%5chttp%5cprivate.js", "/backend./http/private.js", "/backend%20/http/private.js",
        "/backend:stream", "/backend/http/private.js?public=true", "/alias/http/private.js",
        "/%2561lias/http/private.js", "/outside-alias/private.txt", "/.hidden", "/.hidden-dir/public.txt",
        "/%2ehidden", "/%00backend", "/%zz", "/backend/../admin.html",
        "/server.js", "/docs/sql/phase-a9/01-rsvp-managed.sql", "/docs/sql/phase-a9/02-rsvp-managed-contract-delta.sql",
        "/test/rsvp-http.test.js", "/test/rsvp-admin-http.test.js", "/tests/internal.js",
        "/package.json", "/package-lock.json", "/node_modules/express/package.json", "/.git/config", "/.env", "/.env.local",
        "/internal.sql", "/api/internal.sql", "/config.json", "/scripts/dev-preview-server.js", "/js/core/event-version-editorial-http.js",
        "/js/core/private-preview-token.js", "/assets/internal.sql", "/assets/internal.js", "/css/internal.css",
        "/assets/events/kaly-joha/musica.mp3", "/assets/templates/boda-vertical/thumbnail.webp",
        "/css/templates/boda-civil-esencial.css", "/css/templates/boda-civil-esencial.css/", "/css/templates/boda-civil-esencial.css/musica.mp3",
        "/css/templates/cumple-clasico.css", "/css/templates/cumple-clasico.css/",
        "/%73erver.js", "/%2573erver.js", "/docs%2fsql%2fphase-a9%2f01-rsvp-managed.sql",
        "/%2564ocs/sql/phase-a9/01-rsvp-managed.sql", "//docs//sql/phase-a9/01-rsvp-managed.sql",
        "/css/../server.js", "/css/%2e%2e/server.js", "/css/..%5cserver.js", "/SERVER.JS", "/PACKAGE.JSON",
        "/assets/events/kaly-joha/../../../server.js", "/C:/server.js", "/server.js:stream", "/server.js.", "/server.js%20",
        "/js/core/admin-dashboard-private.js", "/js/core/admin-event-summary.js.map", "/css/admin-private.css"
    ];
    for (const url of blocked) {
        const result = await request(url);
        assert.strictEqual(result.status, 404, url);
        assert.strictEqual(result.body, "", url);
        securityChecks++;
    }
    for (const url of ["/admin.html", "/assets/musica.mp3", "/invitacion.html"]) {
        assert.strictEqual((await request(url)).status, 200, url);
        securityChecks++;
    }
    for (const [method, url] of dynamicRoutes) {
        assert.strictEqual((await request(url, method.toUpperCase())).status, 204, url);
        securityChecks++;
    }
    for (const url of ["/invitacion.html", "/invitacion.html?id=synthetic", "/%69nvitacion.html", "/x/../invitacion.html"]) {
        for (const method of ["GET", "HEAD"]) {
            const result = await request(url, method, { "If-None-Match": "*", "If-Modified-Since": "Wed, 01 Jan 2031 00:00:00 GMT" });
            assert.strictEqual(result.status, 200, `${method} ${url}`);
            assert.strictEqual(result.headers["cache-control"], "no-store");
            assert.strictEqual(result.headers["referrer-policy"], "no-referrer");
            assert.strictEqual(result.headers.etag, undefined);
            assert.strictEqual(result.headers["last-modified"], undefined);
            if (method === "HEAD") assert.strictEqual(result.body, "");
            privacyChecks++;
        }
    }
    const asset = await request("/assets/musica.mp3");
    assert.strictEqual(asset.headers["cache-control"], "public, max-age=3600");
    assert(asset.headers.etag);
    privacyChecks++;
    const other = await request("/admin.html");
    assert.strictEqual(other.headers["cache-control"], "public, max-age=0");
    assert(other.headers.etag);
    assert.strictEqual(other.headers["referrer-policy"], undefined);
    privacyChecks++;
    fs.unlinkSync(path.join(root, "invitacion.html"));
    const missing = await request("/invitacion.html");
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.headers["cache-control"], "no-store");
    assert.strictEqual(missing.headers["referrer-policy"], "no-referrer");
    assert.strictEqual(missing.headers.etag, undefined);
    privacyChecks++;
    await new Promise((resolve) => server.close(resolve));
    const realRoot = path.join(__dirname, "..");
    const realApp = express();
    const realPolicy = createStaticPolicy({ root: realRoot, express });
    realApp.use(realPolicy.guard);
    realApp.use("/assets", express.static(path.join(realRoot, "assets"), { maxAge: 3600000, dotfiles: "ignore" }));
    realApp.use(realPolicy.serveRoot);
    realApp.use((_req, res) => res.status(404).end());
    server = await new Promise((resolve) => { const instance = realApp.listen(0, "127.0.0.1", () => resolve(instance)); });
    // Only HEAD requests for internal or legacy data files: no content read.
    for (const url of ["/server.js", "/docs/sql/phase-a9/01-rsvp-managed.sql", "/docs/sql/phase-a9/02-rsvp-managed-contract-delta.sql",
        "/test/rsvp-http.test.js", "/test/rsvp-admin-http.test.js", "/package.json", "/package-lock.json",
        "/backend/rsvp/token.js", "/backend/rsvp/service.js", "/node_modules/express/package.json",
        "/.git/config", "/.env", "/.env.local", "/js/core/event-version-editorial-http.js", "/js/core/private-preview-token.js"]) {
        assert.strictEqual((await request(url, "HEAD")).status, 404, url);
        securityChecks++;
    }
    const publicResources = new Set(["/", "/data.json", "/data/moira-20-12-2026.json",
        "/js/core/admin-event-summary.js", "/js/core/admin-dashboard.js", "/css/admin.css",
        "/css/templates/boda-vertical.css", "/css/templates/cumple-clasico.css", "/css/templates/boda-civil-esencial.css",
        "/assets/templates/boda-vertical/thumbnail.webp", "/assets/templates/cumple-clasico/thumbnail.webp",
        "/assets/templates/boda-civil-esencial/thumbnail.webp", "/assets/templates/boda-civil-esencial/demo/hero.webp",
        "/assets/templates/boda-vertical/demo/hero.svg", "/assets/templates/boda-vertical/demo/closing.svg",
        "/assets/events/kaly-joha/01-invitacion.gif", "/assets/events/kaly-joha/02-portada.gif",
        "/assets/events/kaly-joha/03-cierre.gif", "/assets/events/kaly-joha/cierre-animado.gif", "/assets/events/kaly-joha/musica.mp3"]);
    for (const html of ["index.html", "admin.html", "catalogo.html", "invitacion.html"]) {
        publicResources.add("/" + html);
        const source = fs.readFileSync(path.join(realRoot, html), "utf8");
        for (const match of source.matchAll(/(?:src|href)="(\/?(?:js|css)\/[^"?#]+)"/g)) {
            publicResources.add("/" + match[1].replace(/^\//, ""));
        }
    }
    for (const url of publicResources) {
        assert.strictEqual((await request(url, "HEAD")).status, 200, url);
        securityChecks++;
    }
    for (const url of ["/invitacion.html", "/%69nvitacion.html?id=synthetic", "/x/../invitacion.html"]) {
        const result = await request(url, "HEAD", { "If-None-Match": "*", "If-Modified-Since": "Wed, 01 Jan 2031 00:00:00 GMT" });
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.headers["cache-control"], "no-store");
        assert.strictEqual(result.headers["referrer-policy"], "no-referrer");
        assert(!result.headers.etag && !result.headers["last-modified"]);
        privacyChecks++;
    }
    const realAsset = await request("/assets/templates/boda-vertical/thumbnail.webp", "HEAD");
    assert.strictEqual(realAsset.headers["cache-control"], "public, max-age=3600");
    assert(realAsset.headers.etag && realAsset.headers["last-modified"]);
    privacyChecks++;
    console.log(`static-policy: ${securityChecks} security checks, ${privacyChecks} privacy checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const resolved = path.resolve(fixture);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
});
