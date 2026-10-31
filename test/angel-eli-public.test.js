"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const profile = require("../backend/premium/angel-eli-profile");
const { buildFinalSnapshot, addAuthorization } = require("../scripts/prepare-angel-eli-public");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const { createPublicPreview } = require("../scripts/angel-eli-public-preview");
const { signPreviewToken } = require("../js/core/private-preview-token");
const source = require("../js/core/invitation-data-source"), artwork = require("../js/events/angel-eli-presentation");
const fixture = require("./fixtures/angel-eli.synthetic.json");
const fresh = () => buildFinalSnapshot(fixture);
const configuration = content => addAuthorization({ entries: [] }, content);
async function start(options = {}) {
    const content = options.content || fresh();
    const h = createPublicPreview({ content, configuration: options.configuration || configuration(content), ...options });
    await new Promise(resolve => h.server.listening ? resolve() : h.server.once("listening", resolve));
    h.base = "http://127.0.0.1:" + h.server.address().port;
    return h;
}
test("final snapshot preserves source, contains nine canonical sections and drives the existing adapter exactly once", () => {
    const before = JSON.stringify(fixture), content = fresh();
    assert.equal(JSON.stringify(fixture), before); assert(profile.matchesProfile(content));
    assert.deepEqual(content.sections.map(s => s.id), profile.sections.map(s => s[0]));
    assert.equal(content.sections.filter(s => s.id === "caminata").length, 1);
    assert.equal(content.location.maps_url, "https://maps.app.goo.gl/NCyLci7MA9XXWAwG9");
    assert.equal(content.location.address, "Hernán Cortez 1710, Carlos Spegazzini, Buenos Aires");
    assert.equal(content.sections[2].data.address, "Hernán Cortez 1710");
    assert.equal(require("../js/core/event-normalizer").normalizeEvent(content).googleMapsUrl, content.location.maps_url);
    assert.equal(content.sections[2].data.timeText, profile.TIME); assert.equal(content.sections[6].data.url, profile.DRIVE);
    assert.equal(artwork.getPresentationSections(content.sections).length, 8);
    assert.equal(content.schedule.time, fixture.schedule.time); // Ceremony and Fiesta are different approved times.
    const presentation = profile.buildPresentation(content);
    for (const [s, host] of [[source.selectInvitationSource("?id=" + content.id, "example.test"), "example.test"],
        [source.selectInvitationSource("?previewToken=signed", "example.test"), "example.test"]]) {
        assert(artwork.isAuthorizedContext(s, content, presentation, host));
        assert(!artwork.isAuthorizedContext(s, content, {}, host));
    }
    for (const change of [c => c.sections.reverse(), c => c.sections[2].data.timeText = "18:30", c => c.sections[6].data.url += "bad",
        c => c.media.items.caminata.src = "/assets/other.mp4", c => c.template.variant = "angel-eli-local-v1", c => c.location.maps_url = "https://maps.example.test/outdated", c => c.sections[2].data.address = "Old address", c => c.location.address = "Old address"]) {
        const c = fresh(); change(c); assert(!profile.matchesProfile(c)); assert.throws(() => profile.buildPresentation(c));
    }
});
test("private approval is additive, keeps other scopes/revocations intact and refuses to reactivate the same revoked digest", () => {
    const other = { revision: 8, manifest: { eventId: "other-private-scope", status: "revoked" } };
    const input = { entries: [other] }, before = JSON.stringify(input), content = fresh();
    const combined = addAuthorization(input, content);
    assert.equal(JSON.stringify(input), before); assert.deepEqual(combined.entries[0], other);
    assert.equal(combined.entries[1].manifest.canonicalDigest, canonicalContentDigest(content));
    assert.deepEqual(addAuthorization(combined, content), combined);
    combined.entries.push({ revision: 2, manifest: { ...combined.entries[1].manifest, status: "revoked" } });
    assert.throws(() => addAuthorization(combined, content));
});
test("actual server public and signed-preview routes render trusted association without exposing private scope or allowing writes", async () => {
    const h = await start();
    try {
        assert(h.logs.some(args => args[0] === "PREMIUM_STARTUP_AUTHORIZATION PASS"));
        for (const query of ["?id=angel-eli-boda", "?previewToken=" + h.token]) {
            const selected = source.selectInvitationSource(query, "example.test");
            const raw = await fetch(h.base + selected.url); assert.equal(raw.status, 200);
            assert.equal(raw.headers.get("cache-control"), "no-store");
            const payload = await raw.json(); assert.equal(payload.presentation.eventProfile, profile.PROFILE);
            assert.deepEqual(payload.presentation.albumSections, ["carpeta-compartida"]);
            assert(!JSON.stringify(payload).includes("canonicalDigest")); assert(!JSON.stringify(payload).includes(".dev/"));
            const c = await source.loadInvitationSource(selected, (url, options) => fetch(h.base + url, options));
            const p = selected.mode === "public" ? source.getPublicPremiumPresentation(c) : source.getPrivatePremiumPresentation(c);
            assert(artwork.isAuthorizedContext(selected, c, p, "example.test"));
            assert.equal(source.getPublicPremiumPresentation(structuredClone(c)), null);
            assert.equal(source.getPrivatePremiumPresentation(structuredClone(c)), null);
        }
        assert.equal((await fetch(h.base + "/api/admin/eventos", { method: "POST" })).status, 405);
        assert.equal(h.writes.length, 0);
        await assert.rejects(source.loadInvitationSource(source.selectInvitationSource("?previewToken=fake", "example.test"),
            async () => ({ ok: true, json: async () => fresh() })));
    } finally { await h.close(); }
});
test("real HTTP permits exactly the approved nineteen resources and retains private/unknown/traversal/alternate-extension blocks plus MP4 Range", async () => {
    const h = await start();
    try {
        const assets = fs.readdirSync(path.resolve(__dirname, "../assets/events/angel-eli")).map(n => "/assets/events/angel-eli/" + n)
            .concat(fs.readdirSync(path.resolve(__dirname, "../assets/events/fondos-sin-texto")).map(n => "/assets/events/fondos-sin-texto/" + n),
                ["/css/events/angel-eli.css", "/js/events/angel-eli-presentation.js"]);
        assert.equal(assets.length, 19);
        for (const url of assets) { const res = await fetch(h.base + url); assert.equal(res.status, 200, url); await res.arrayBuffer(); }
        for (const url of ["/assets/events/angel-eli/", "/assets/events/angel-eli/private.json", "/assets/events/angel-eli/portada.webm",
            "/assets/events/fondos-sin-texto/private.png", "/.dev/premium/angel-eli-public.event.json",
            "/.dev/premium/angel-eli-public.authorization.json", "/%252edev/premium/angel-eli-public.event.json",
            "/backend/premium/angel-eli-profile.js", "/scripts/prepare-angel-eli-public.js", "/.env",
            "/assets/events/angel-eli/portada.mp4.bak", "/assets/events/angel-eli/portada.mp4/extra"]) {
            assert.equal((await fetch(h.base + url)).status, 404, url);
        }
        for (const file of ["portada.mp4", "angel-eli-caminata.mp4"]) {
            const res = await fetch(h.base + "/assets/events/angel-eli/" + file, { headers: { range: "bytes=0-99" } });
            assert.equal(res.status, 206); assert.match(res.headers.get("content-range"), /^bytes 0-99\//);
            assert.equal((await res.arrayBuffer()).byteLength, 100);
        }
    } finally { await h.close(); }
});
test("public and signed preview deny missing, wrong-digest, revoked and changed-content approvals", async () => {
    const content = fresh(), approved = configuration(content), revoked = structuredClone(approved);
    revoked.entries.push({ revision: 2, manifest: { ...revoked.entries[0].manifest, status: "revoked" } });
    const wrong = structuredClone(approved); wrong.entries[0].manifest.canonicalDigest = "a".repeat(64);
    const changed = fresh(); changed.identity.title = "Changed after approval";
    for (const options of [{ configuration: { entries: [] } }, { configuration: wrong }, { configuration: revoked },
        { configuration: approved, content: changed }]) {
        const h = await start(options);
        try {
            assert.equal((await fetch(h.base + "/api/eventos/angel-eli-boda")).status, 404);
            assert.equal((await fetch(h.base + "/api/preview?token=" + h.token)).status, 403);
            assert.equal(h.writes.length, 0);
        } finally { await h.close(); }
    }
});
test("signed preview denies invalid/expired/cross-event tokens and archived or wrong-owner versions; draft preview is not public", async () => {
    const h = await start();
    try {
        for (const token of [h.token.slice(0, -1) + (h.token.endsWith("A") ? "B" : "A"),
            signPreviewToken({ eventId: "angel-eli-boda", versionId: h.versionId, secret: h.secret, now: 0 }),
            signPreviewToken({ eventId: "another-event", versionId: h.versionId, secret: h.secret }),
            signPreviewToken({ eventId: "angel-eli-boda", versionId: "22222222-2222-4222-8222-222222222222", secret: h.secret })]) {
            const res = await fetch(h.base + "/api/preview?token=" + token); assert(res.status >= 400);
        }
    } finally { await h.close(); }
    for (const options of [{ eventStatus: "archived" }, { versionEventId: "another-event" }]) {
        const h = await start(options);
        try {
            assert.equal((await fetch(h.base + "/api/eventos/angel-eli-boda")).status, 404);
            assert((await fetch(h.base + "/api/preview?token=" + h.token)).status >= 400);
        } finally { await h.close(); }
    }
    const draft = await start({ workflowStatus: "draft", published: false });
    try {
        assert.equal((await fetch(draft.base + "/api/eventos/angel-eli-boda")).status, 404);
        assert.equal((await fetch(draft.base + "/api/preview?token=" + draft.token)).status, 200);
    } finally { await draft.close(); }
});

test("an otherwise authorized snapshot with an inconsistent final contract cannot receive a public or preview profile", async () => {
    const content = fresh(); content.sections[2].data.timeText = "18:30";
    const cfg = configuration(fresh()); cfg.entries[0].manifest.canonicalDigest = canonicalContentDigest(content);
    const h = await start({ content, configuration: cfg });
    try {
        assert.equal((await fetch(h.base + "/api/eventos/angel-eli-boda")).status, 404);
        assert.equal((await fetch(h.base + "/api/preview?token=" + h.token)).status, 403);
    } finally { await h.close(); }
});
test("client refuses content-declared or missing final profile and unbound/cross-event preview responses", async () => {
    const content = fresh(), presentation = profile.buildPresentation(content);
    content.eventProfile = profile.PROFILE;
    const publicSource = source.selectInvitationSource("?id=angel-eli-boda", "example.test");
    for (const payload of [content, { eventId: content.id, versionId: "version", content,
        presentation: { ...presentation, eventProfile: undefined } }]) {
        await assert.rejects(source.loadInvitationSource(publicSource, async () => ({ ok: true, json: async () => payload })));
    }
    const selected = { mode: "private-preview", eventId: "another-event", versionId: "version", url: "/api/preview?token=x" };
    await assert.rejects(source.loadInvitationSource(selected, async () => ({ ok: true,
        json: async () => ({ eventId: content.id, versionId: "version", content, presentation }) })));
    assert.equal(source.getPublicPremiumPresentation(content), null);
    assert.equal(source.getPrivatePremiumPresentation(content), null);
});
