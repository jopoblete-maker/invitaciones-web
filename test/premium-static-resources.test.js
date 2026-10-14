"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createHash } = require("node:crypto");
const express = require("express");
const { createStaticPolicy } = require("../backend/http/static-policy");

const root = path.resolve(__dirname, "..");
const prefix = "/assets/templates/boda-fiesta-premium/";
const resources = [
    ["/css/templates/boda-fiesta-premium.css", "text/css"],
    ["/js/core/premium-section-renderers.js", "javascript"],
    ["/js/core/external-link-policy.js", "javascript"],
    ...["portada-original.webp", "nuestra-boda-fotografia.webp", "cierre-puente.webp"].map(name => [prefix + name, "image/webp"]),
    ...["fiesta-decorativa.webp", "asistencia-decorativa.webp", "carpeta-decorativa.webp",
        "pareja-premium.webp", "cierre-decorativo-b17-e1.webp",
        "fiesta-decorativa-b17-e4.webp", "asistencia-decorativa-b17-e4.webp"].map(name => [prefix + name, "image/webp"]),
    [prefix + "rosas-blancas-esquina.png", "image/png"],
    [prefix + "foto3-b18.jpeg", "image/jpeg"],
    [prefix + "musica-boda.mp3", "audio/mpeg"]
];
const app = express(), policy = createStaticPolicy({ root, express });
app.use(policy.guard);
app.use("/assets", express.static(path.join(root, "assets"), { maxAge: 3600000, dotfiles: "ignore" }));
app.use(policy.serveRoot);
app.use((_req, res) => res.status(404).end());
let server;
function request(resource, method = "GET", headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: resource, method, headers }, res => {
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on("error", reject); req.end();
    });
}
const hash = buffer => createHash("sha256").update(buffer).digest("hex");

(async () => {
    server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    for (const [url, type] of resources) {
        const res = await request(url);
        assert.equal(res.status, 200, url);
        assert(res.headers["content-type"].includes(type), url);
        assert(res.body.equals(fs.readFileSync(path.join(root, url.slice(1)))), "Exact public file required");
        assert.equal((await request(url, "HEAD")).status, 200, url);
    }
    const audio = await request(prefix + "musica-boda.mp3", "GET", { Range: "bytes=0-31" });
    assert.equal(audio.status, 206);
    assert.equal(audio.body.length, 32);
    const photo = await request(prefix + "nuestra-boda-fotografia.webp");
    const retiredHash = "42d927ed001290f795172ee8f1e5e1033680bcc04666878141c57321214fff96";
    assert.equal(hash(photo.body), "fc39484c891e82469e5629b67c694da9076dd41100b735df8d2fae8528956f71");
    assert.notEqual(hash(photo.body), retiredHash);
    const publicFiles = fs.readdirSync(path.join(root, prefix.slice(1)), { withFileTypes: true });
    for (const file of publicFiles.filter(entry => entry.isFile())) {
        assert.notEqual(hash(fs.readFileSync(path.join(root, prefix.slice(1), file.name))), retiredHash);
    }
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/premium-preview.synthetic.json"), "utf8"));
    assert.equal(fixture.media.items["foto-pareja"].src, prefix + "nuestra-boda-fotografia.webp");
    for (const media of Object.values(fixture.media.items)) assert(resources.some(([url]) => url === media.src));

    const blocked = [
        prefix + "foto3-b18.jpg", prefix + "foto3-b18.webp", prefix + "foto3-b18.jpeg.bak",
        prefix + "foto3-b18.jpeg/", prefix + "foto3-b18.jpeg/extra",
        "/.dev/premium/kaly-joha-nuestra-boda.b18-candidate.event.json",
        "/.dev/premium/kaly-joha-nuestra-boda.b18-candidate.authorization.json",
        prefix, prefix + "ornamento-floral.svg", prefix + "missing.webp", prefix + "musica-original.mpeg",
        // Unused historical art stays private even after the B17 static approval.
        prefix + "cierre-premium.webp",
        "/.dev/premium/kaly-joha-nuestra-boda.b17-f1-production.authorization.json",
        "/.dev/premium/kaly-joha-nuestra-boda.b17-f1-final.event.json",
        prefix + "authorization.json", prefix + "nuestra-boda-fotografia-anterior.webp",
        "/.dev/premium/kaly-joha-boda-fiesta-demo.authorization.json",
        "/.dev/drafts/kaly-joha-boda-fiesta-demo.event.json",
        "/.dev/referencias/Nuestra%20Boda%20entre%20Luces%20y%20Flores%20(4).png",
        "/.dev/referencias/01_referencia_original.mp4",
        "/backend/premium/authorization-provider.js", "/backend/premium/write-boundary.js",
        "/js/core/premium-authorization.js", "/js/core/premium-section-validator.js",
        "/js/core/premium-section-renderers.js.map", "/js/core/external-link-policy.js.map",
        "/scripts/premium-local-preview.js", "/server.js", "/test/public-premium-read.test.js",
        "/docs/sql/phase-a9/01-rsvp-managed.sql", "/.env", "/.git/config",
        prefix + "../../../backend/premium/authorization-provider.js",
        prefix + "%2e%2e/%2e%2e/%2e%2e/.dev/premium/kaly-joha-boda-fiesta-demo.authorization.json",
        prefix + "%252e%252e/%252e%252e/%252e%252e/backend/premium/write-boundary.js",
        "/assets\\..\\backend\\premium\\authorization-provider.js",
        "/assets%5c..%5cbackend%5cpremium%5cauthorization-provider.js"
    ];
    for (const url of blocked) assert.equal((await request(url)).status, 404, url);
    // Existing civil/traditional paths and invitation privacy remain unchanged.
    for (const url of ["/assets/events/kaly-joha/01-invitacion.gif", "/assets/events/kaly-joha/musica.mp3",
        "/css/templates/boda-civil-esencial.css", "/css/templates/boda-vertical.css", "/js/core/rsvp.js"]) {
        assert.equal((await request(url, "HEAD")).status, 200, url);
    }
    const invitation = await request("/invitacion.html?id=synthetic", "HEAD");
    assert.equal(invitation.status, 200);
    assert.equal(invitation.headers["cache-control"], "no-store");
    assert.equal(invitation.headers["referrer-policy"], "no-referrer");
    console.log(`premium static resources: ${resources.length} public files; ${blocked.length} blocked paths; real HTTP PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});
