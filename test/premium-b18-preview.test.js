"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const { normalizeEvent } = require("../js/core/event-normalizer");
const { preparePremiumLocalPreview } = require("../scripts/premium-local-preview");
const { createPreviewServer } = require("../scripts/dev-preview-server");
const { selectInvitationSource } = require("../js/core/invitation-data-source");
const { createStaticPolicy } = require("../backend/http/static-policy");
const express = require("express");
const path = require("node:path");
const ID = "kaly-joha-nuestra-boda";
const TEXT = "Con el amor como nuestro camino, decidimos unir nuestras vidas para siempre. Queremos que seas parte de este momento tan especial.";
const b17 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/premium-preview.synthetic.json"), "utf8"));
b17.id = ID; delete b17.metadata;
const b18 = structuredClone(b17);
b18.template.variant = "b18-client-corrections";
const countdown = b18.sections.find(s => s.type === "countdown");
countdown.data.eyebrow = "\u00bfCu\u00e1nto falta?"; countdown.data.footer = TEXT;
b18.media.items["photo-b18"] = { type: "image", src: "/assets/templates/boda-fiesta-premium/foto3-b18.jpeg" };
b18.sections.find(s => s.id === "fotografia-pareja").data = { media_id: "photo-b18", alt: "Synthetic horizontal photograph" };
const closing = b18.sections.find(s => s.id === "cierre");
closing.type = "closing"; closing.data = { media_id: "foto-cierre", imageAlt: "Synthetic bridge", title: "Synthetic closing", names: "Synthetic pair" };
function approval(content, revision) {
    return { entries: [{ revision, manifest: { status: "approved", eventId: ID, templateSlug: content.template.slug,
        canonicalDigest: canonicalContentDigest(content), imageUrls: [],
        media: Object.fromEntries(Object.entries(content.media.items).filter(([, item]) => item.type === "image")),
        gifts: Object.fromEntries(content.sections.filter(s => s.type === "gifts").map(s => [s.id, s.data])),
        albumUrls: content.sections.filter(s => s.type === "collaborative-album").map(s => s.data.url) } }] };
}
const b17Approval = approval(b17, 4), b18Approval = approval(b18, 5);
const before = JSON.stringify({ b17, b18, b17Approval, b18Approval });
assert(preparePremiumLocalPreview(b18, b18Approval, { eventId: ID }).accepted);
assert(!preparePremiumLocalPreview(b18, b17Approval, { eventId: ID }).accepted);
assert.equal(normalizeEvent(b18).template.variant, "b18-client-corrections");
assert.equal(normalizeEvent(b17).template.variant, undefined);
assert.equal(b18.sections.length, 9);
assert.equal(countdown.data.eyebrow, "\u00bfCu\u00e1nto falta?");
assert.equal(countdown.data.targetDateTime, b17.sections.find(s => s.type === "countdown").data.targetDateTime);
assert.equal(selectInvitationSource(`?devDraft=${ID}&candidate=b18`, "127.0.0.1").mode, "local-premium");
assert.equal(selectInvitationSource(`?devDraft=${ID}&candidate=b18`, "production.example").mode, "invalid-preview");
assert.equal(selectInvitationSource("?devDraft=kaly-joha-boda-fiesta-demo&candidate=b18", "127.0.0.1").mode, "invalid-preview");

let observerCallback, preferenceCallback, hidden = false, reduced = false, nextTimer = 0;
const handlers = new Map(), timers = new Map(), observed = [];
const writing = { textContent: "Synthetic pair" };
function element() {
    const classes = new Set();
    const completions = [];
    let starts = 0;
    return { classes, completions, get starts() { return starts; }, offsetWidth: 300,
        classList: { add: n => classes.add(n), remove: n => classes.delete(n) },
        querySelector: () => writing,
        querySelectorAll: selector => Array.from({ length: selector.includes("premium-countdown-quote") ? 4 : 1 }, () => ({ getAnimations() {
            starts++; return [{ finished: new Promise(resolve => completions.push(resolve)) }];
        } })) };
}
const closeElement = element(), dressElement = element(), countdownElement = element();
const app = { classList: { contains: n => n === "premium-b18" }, querySelector: selector =>
    selector === "[data-premium-closing]" ? closeElement : selector.includes("demo-dress-study") ? dressElement : countdownElement };
const browser = { document: { get hidden() { return hidden; }, addEventListener: (n, fn) => handlers.set(n, fn),
    removeEventListener: (n, fn) => { if (handlers.get(n) === fn) handlers.delete(n); } },
    window: { matchMedia: () => ({ get matches() { return reduced; },
        addEventListener: (_n, fn) => { preferenceCallback = fn; }, removeEventListener() {} }) },
    IntersectionObserver: class { constructor(callback) { observerCallback = callback; }
        observe(e) { observed.push(e); } unobserve() { throw Error("Loop must keep observing"); } disconnect() {} },
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, delay }); return nextTimer; }, clearTimeout: id => timers.delete(id),
    setInterval: () => { throw Error("Animation must not restart the countdown interval"); } };
vm.createContext(browser);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/invitacion.js"), "utf8"), browser);
browser.getApp = () => app;
assert(browser.isB18Presentation(normalizeEvent(b18), { slug: "boda-fiesta-premium" }));
assert(!browser.isB18Presentation(normalizeEvent(b17), { slug: "boda-fiesta-premium" }));
assert(!browser.isB18Presentation({ ...normalizeEvent(b18), id: "kaly-joha" }, { slug: "boda-fiesta-premium" }));
assert(!browser.isB18Presentation(normalizeEvent(b18), { slug: "boda-vertical" }));
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function enter(target, visible) { observerCallback([{ target, isIntersecting: visible }]); }
async function lifecycle() {
    browser.setupPremiumEntryAnimations(); assert.equal(observed.length, 3);
    enter(countdownElement, true); assert.equal(timers.size, 0);
    enter(countdownElement, true); assert.equal(countdownElement.starts, 4);
    for (let i = 0; i < 3; i++) countdownElement.completions.shift()();
    await flush(); assert.equal(timers.size, 0, "Wait for the last animation");
    countdownElement.completions.shift()(); await flush();
    assert.equal(timers.size, 1);
    const [id, pause] = timers.entries().next().value;
    assert.equal(pause.delay, 2000); timers.delete(id); pause.fn();
    assert.equal(countdownElement.starts, 8);
    enter(countdownElement, false); while (countdownElement.completions.length) countdownElement.completions.shift()(); await flush();
    assert.equal(timers.size, 0);
    enter(dressElement, true); dressElement.completions.shift()(); await flush();
    assert.equal(timers.size, 1);
    hidden = true; handlers.get("visibilitychange")(); assert.equal(timers.size, 0);
    hidden = false; handlers.get("visibilitychange")(); assert.equal(dressElement.starts, 2);
    enter(closeElement, true); assert.equal(writing.textContent, "");
    reduced = true; preferenceCallback();
    assert.equal(writing.textContent, "Synthetic pair"); assert.equal(timers.size, 0);
    dressElement.completions.shift()(); closeElement.completions.shift()(); await flush();
    assert.equal(timers.size, 0);
    browser.setupPremiumEntryAnimations.dispose();
    assert(!handlers.has("visibilitychange"));
    // Content is visible immediately when reduced motion is active.
    browser.setupPremiumEntryAnimations();
    assert(!dressElement.classes.has("is-animation-ready"));
}

let server, staticServer;
(async () => {
    await lifecycle();
    server = createPreviewServer({ loadPremiumB18CandidateInput: () => ({ content: b18, configuration: b18Approval }),
        loadPremiumE4CandidateInput: () => ({ content: b17, configuration: b17Approval }) });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const result = await fetch(`${base}/__premium-local-preview/${ID}/b18`);
    assert.equal(result.status, 200);
    const payload = await result.json(); assert.equal(payload.content.sections.length, 9);
    assert.equal(payload.content.template.variant, "b18-client-corrections");
    assert(!JSON.stringify(payload).includes("canonicalDigest"));
    const oldPayload = await (await fetch(`${base}/__premium-local-preview/${ID}/b17-e4`)).json();
    assert.equal(oldPayload.content.template.variant, undefined);
    assert.equal((await fetch(`${base}/__premium-local-preview/${ID}/b18`, { method: "POST" })).status, 405);
    for (const name of ["event", "authorization"]) assert.equal((await fetch(`${base}/.dev/premium/${ID}.b18-candidate.${name}.json`)).status, 404);
    const image = await fetch(`${base}/assets/templates/boda-fiesta-premium/foto3-b18.jpeg`);
    assert.equal(image.status, 200); assert(image.headers.get("content-type").includes("image/jpeg"));
    const app = express(), policy = createStaticPolicy({ root: path.join(__dirname, ".."), express });
    app.use(policy.guard); app.use(policy.serveRoot); app.use((_req, res) => res.status(404).end());
    staticServer = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    const publicPhoto = await fetch(`http://127.0.0.1:${staticServer.address().port}/assets/templates/boda-fiesta-premium/foto3-b18.jpeg`);
    assert.equal(publicPhoto.status, 200);
    assert(publicPhoto.headers.get("content-type").includes("image/jpeg"));
    assert(Buffer.from(await publicPhoto.arrayBuffer()).equals(fs.readFileSync(path.join(__dirname, "../assets/templates/boda-fiesta-premium/foto3-b18.jpeg"))));
    assert.equal(JSON.stringify({ b17, b18, b17Approval, b18Approval }), before);
    console.log("B18 isolated variant, original countdown, private HTTP and animation lifecycle PASS");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const instance of [server, staticServer]) if (instance) await new Promise(resolve => instance.close(resolve));
});
