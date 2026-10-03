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
fs.writeFileSync(path.join(root, "backend", "http", "private.js"), "synthetic-private-marker");
fs.writeFileSync(path.join(root, "backend", "http", "private.js.map"), "synthetic-source-map");
fs.writeFileSync(path.join(root, "backend", "config.json"), "synthetic-config");
fs.writeFileSync(path.join(root, "invitacion.html"), "synthetic-invitation");
fs.writeFileSync(path.join(root, "admin.html"), "synthetic-admin");
fs.writeFileSync(path.join(root, "assets", "public.txt"), "synthetic-asset");
fs.writeFileSync(path.join(root, ".hidden"), "synthetic-dotfile");
fs.mkdirSync(path.join(root, ".hidden-dir"));
fs.writeFileSync(path.join(root, ".hidden-dir", "public.txt"), "synthetic-dotfile");
fs.symlinkSync(path.join(root, "backend"), path.join(root, "alias"), "junction");
fs.symlinkSync(path.join(root, "backend"), path.join(root, "%61lias"), "junction");
fs.mkdirSync(path.join(fixture, "outside"));
fs.writeFileSync(path.join(fixture, "outside", "private.txt"), "synthetic-outside");
fs.symlinkSync(path.join(fixture, "outside"), path.join(root, "outside-alias"), "junction");

const app = express();
const policy = createStaticPolicy({ root, express });
app.use(policy.guard);
app.use("/assets", express.static(path.join(root, "assets"), { maxAge: 3600000, dotfiles: "ignore" }));
app.use(policy.serveRoot);
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
        "/%2ehidden", "/%00backend", "/%zz", "/backend/../admin.html"
    ];
    for (const url of blocked) {
        const result = await request(url);
        assert.strictEqual(result.status, 404, url);
        assert.strictEqual(result.body, "", url);
        securityChecks++;
    }
    for (const url of ["/admin.html", "/assets/public.txt", "/invitacion.html"]) {
        assert.strictEqual((await request(url)).status, 200, url);
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
    const asset = await request("/assets/public.txt");
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
    console.log(`static-policy: ${securityChecks} security checks, ${privacyChecks} privacy checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const resolved = path.resolve(fixture);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
});
