"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const catalog = fs.readFileSync(path.join(root, "catalogo.html"), "utf8");
const legacy = fs.readFileSync(path.join(root, "invitacion-legacy.html"));
// Canonical SHA-256 of the verified original HTML; only CRLF is normalized.
const canonicalHash = value => crypto.createHash("sha256").update(value.toString("utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex");
const expectedLegacyHash = "618e1237920d4f0930d6fd0bde0830c0aa4d611b6bbb4990a1d1c9789ca5ea41";
assert.equal(canonicalHash(legacy), expectedLegacyHash);
const legacyLF = legacy.toString("utf8").replace(/\r\n/g, "\n");
assert.equal(canonicalHash(legacyLF), expectedLegacyHash);
assert.equal(canonicalHash(legacyLF.replace(/\n/g, "\r\n")), expectedLegacyHash);
// A real HTML change must still fail the same cryptographic assertion.
assert.throws(() => assert.equal(canonicalHash(legacyLF.replace("<title>", "<title>Alteración sintética ")), expectedLegacyHash), assert.AssertionError);
const redirect = home.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const search of ["?id=synthetic-event", "?id=synthetic-event&extra=a%26b", "?id="]) {
    let actual;
    vm.runInNewContext(redirect, { URLSearchParams, window: { location: { search, hash: "#detalle", replace: v => { actual = v; } } } });
    assert.equal(actual, "invitacion-legacy.html" + search + "#detalle");
}
let redirected = false;
vm.runInNewContext(redirect, { URLSearchParams, window: { location: { search: "", hash: "", replace: () => { redirected = true; } } } });
assert.equal(redirected, false);
assert(home.includes('href="/catalogo.html"'));
for (const page of [home, catalog]) {
    assert(page.includes('lang="es"'));
    assert(page.includes('class="skip-link"'));
    assert(page.includes('aria-label="Navegación principal"'));
    assert(!/<form\b/i.test(page));
    assert(!/href=["'][^"']*admin\.html/i.test(page));
    assert(page.includes("Elegís tu plantilla, nos enviás los datos y el equipo YCOR crea y personaliza tu invitación."));
}
assert(catalog.includes('id="catalogSelection"'));
assert(fs.readFileSync(path.join(root,"css/comercial.css"),"utf8").includes("prefers-reduced-motion"));
assert(fs.readFileSync(path.join(root,"js/main.js"),"utf8").includes('invitacionId ? `/data/${invitacionId}.json` : "data.json"'));
console.log("commercial pages: navigation, OWNER-only model and legacy URL preservation PASS");
