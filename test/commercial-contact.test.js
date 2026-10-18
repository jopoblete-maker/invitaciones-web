"use strict";
const assert = require("node:assert/strict");
const Contact = require("../js/core/commercial-contact");
const Registry = require("../js/core/template-registry");
const Catalog = require("../js/core/template-catalog");
const Themes = require("../js/core/theme-registry");
const entries = Catalog.buildCatalogEntries(Registry, Themes);
assert.equal(entries.length, 3);
for (const entry of entries) {
    const request = Contact.templateRequest(entry.slug, Registry);
    const url = new URL(request.href);
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/5491157339281");
    assert.equal(url.searchParams.get("text"), request.message);
    assert(request.message.includes(entry.name));
    assert(request.message.includes(entry.variantName));
    assert(request.message.includes(entry.slug));
}
const registry = { getTemplate: slug => ({ slug, name: "Boda & celebración / ¿sí?", status: "active",
    catalog: { variant: { name: "Oro + mar" } }, phone: "000", href: "https://invalid.example" }) };
const request = Contact.templateRequest("synthetic", registry);
assert.equal(new URL(request.href).searchParams.get("text"), request.message);
assert(request.href.includes("%26"));
assert(request.href.includes("%2B"));
assert.equal(new URL(request.href).pathname, "/5491157339281");
for (const slug of ["boda-fiesta-premium", "unknown", "../admin", "https://invalid.example"]) {
    assert.throws(() => Contact.templateRequest(slug, Registry));
}
assert.throws(() => Contact.templateRequest({ slug: "boda-vertical", phone: "000" }, Registry));
assert.equal(new URL(Contact.generalRequest().href).pathname, "/5491157339281");
assert(Object.isFrozen(Contact.CONTACT));
console.log("commercial contact: registry selection, fixed destination and encoding PASS");
