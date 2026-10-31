"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { ID, PROFILE, sections, matchesProfile } = require("../scripts/angel-eli-preview-profile");
const { preparePremiumLocalPreview } = require("../scripts/premium-local-preview");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const { createPreviewServer } = require("../scripts/dev-preview-server");
const source = require("../js/core/invitation-data-source");
const artwork = require("../js/events/angel-eli-presentation");
const { normalizeEvent } = require("../js/core/event-normalizer");
const fixture = require("./fixtures/angel-eli.synthetic.json");
const fresh = () => structuredClone(fixture);
function approval(content) {
    return { entries: [{ revision: 1, manifest: { status: "approved", eventId: content.id,
        templateSlug: content.template.slug, canonicalDigest: canonicalContentDigest(content),
        media: Object.fromEntries(Object.entries(content.media.items).filter(([, item]) => item.type === "image")),
        gifts: { regalos: content.sections.find(s => s.type === "gifts").data }, imageUrls: [], albumUrls: [] } }] };
}
const prepare = (c, a = approval(c)) => preparePremiumLocalPreview(c, a, { eventId: ID });
test("authorized source is preserved; eight artwork sections exclude the duplicate before the walking video is added", () => {
    const c = fresh(), before = JSON.stringify(c), result = prepare(c);
    assert(result.accepted); assert(matchesProfile(c));
    assert.equal(JSON.stringify(c), before);
    assert.equal(result.presentation.eventProfile, PROFILE);
    assert.deepEqual(result.presentation.albumSections, []);
    assert.deepEqual(c.sections.map(s => [s.id, s.type]), sections.map(s => s.slice(0, 2)));
    assert(!c.sections.some(s => ["countdown", "collaborative-album"].includes(s.type)));
    const runtime = normalizeEvent(result.content);
    assert.equal(runtime.sections.length, 9);
    const presented = artwork.getPresentationSections(runtime.sections);
    assert.equal(presented.length, 8);
    assert.deepEqual(presented.map(s => s.id), ["portada", "nuestra-historia", "fiesta", "confirmacion",
        "vestimenta", "regalos", "carpeta-compartida", "cierre"]);
    assert.equal(presented[1], runtime.sections[1]);
    assert.equal(runtime.sections.length, 9);
    assert.equal(JSON.stringify(c), before);
    assert.equal(runtime.multimedia.audios.length, 1);
    assert.equal(runtime.contactosRSVP.length, 1);
    assert.equal(runtime.contactosRSVP[0].telefono, "5491100000000");
    assert(!JSON.stringify(result.presentation).includes("1111111111111111111111"));
    assert(!JSON.stringify(result).includes("canonicalDigest"));
});
test("private authorization rejects cross-event, changed content, empty and revoked approval", () => {
    const c = fresh(), a = approval(c);
    assert.equal(prepare({ ...c, id: "another-synthetic-event" }, a).accepted, false);
    const changed = fresh(); changed.identity.title = "Changed";
    assert.equal(prepare(changed, a).accepted, false);
    assert.equal(prepare(c, { entries: [] }).accepted, false);
    a.entries[0].manifest.status = "revoked";
    assert.equal(prepare(c, a).accepted, false);
});
test("fixed media paths, pending folder and section order cannot be substituted", () => {
    for (const mutate of [
        c => c.media.items.portada.src = "/assets/another/cover.mp4",
        c => c.media.items.musica.src = "https://remote.example.test/audio.mp3",
        c => c.sections.reverse(),
        c => c.sections[7].type = "collaborative-album",
        c => c.template.variant = "b18-client-corrections",
        c => c.metadata = { demo: true },
        c => c.modules.music.tracks.push({ media_id: "other" })
    ]) { const c = fresh(); mutate(c); assert.equal(prepare(c).accepted, false); }
});
test("artwork requires loopback plus trusted response association and exact source/profile", () => {
    const c = fresh(), p = prepare(c).presentation;
    const local = source.selectInvitationSource("?devDraft=" + ID, "127.0.0.1");
    assert(artwork.isAuthorizedContext(local, c, p, "127.0.0.1"));
    for (const [s, content, presentation, host] of [
        [local, c, p, "example.test"],
        [{ ...local, mode: "public" }, c, p, "127.0.0.1"],
        [local, { ...c, id: "another" }, p, "127.0.0.1"],
        [local, c, {}, "127.0.0.1"],
        [{ ...local, url: "/other" }, c, p, "127.0.0.1"]
    ]) assert.equal(artwork.isAuthorizedContext(s, content, presentation, host), false);
    assert.equal(source.selectInvitationSource("?devDraft=" + ID, "example.test").mode, "invalid-preview");
    assert.equal(source.selectInvitationSource("?devDraft=" + ID + "&candidate=b18", "127.0.0.1").mode, "invalid-preview");
    assert.equal(source.getLocalPremiumPresentation(c), null);
});
test("local GET uses existing validation; private files, mutation and production static routes remain blocked", async () => {
    let loads = 0; const c = fresh();
    const server = createPreviewServer({ apiBaseUrl: "", adminPassword: "",
        loadAngelEliInput: () => { loads++; return { content: c, configuration: approval(c) }; } });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    try {
        const s = source.selectInvitationSource("?devDraft=" + ID, "localhost");
        const data = await source.loadInvitationSource(s, (url, options) => fetch(base + url, options));
        assert.equal(data.id, ID);
        assert.equal(source.getLocalPremiumPresentation(data).eventProfile, PROFILE);
        assert.equal(loads, 1);
        // In-memory loopback tests only; never hit editorial endpoints.
        assert.equal((await fetch(base + s.url, { method: "POST" })).status, 405);
        assert.equal(loads, 1);
        for (const file of ["event", "authorization", "local-version"])
            assert.equal((await fetch(base + "/.dev/premium/" + ID + "." + file + ".json")).status, 404);
        const { createStaticPolicy } = require("../backend/http/static-policy");
        const express = require("express"), app = express(), policy = createStaticPolicy({ root: path.join(__dirname, ".."), express });
        app.use(policy.guard); app.use(policy.serveRoot); app.use((_req, res) => res.status(404).end());
        const publicServer = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
        try {
            for (const file of ["/assets/events/angel-eli/portada.mp4", "/js/events/angel-eli-presentation.js", s.url])
                assert.equal((await fetch("http://127.0.0.1:" + publicServer.address().port + file)).status, 404);
        } finally { publicServer.closeAllConnections(); await new Promise(resolve => publicServer.close(resolve)); }
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
test("shared RSVP, styles, renderer and protected references remain byte-identical to baseline", () => {
    const crypto = require("node:crypto");
    const protectedHashes = {
        "js/core/rsvp.js": "d2dc412e225a3a3b67e956e6c68881ca5d9661a0b8b95fc4ea78fd500f999231",
        "css/templates/boda-fiesta-premium.css": "be29be39531847eb4b599f420f0139a7583180db97e4ae0bd923ec285b431b02",
        "css/templates/boda-civil-esencial.css": "e296dc1f1fa4e71b53907a51c16c3cdd0c6e3d7a2147028f84041aa2e61b059b",
        "js/core/section-renderer.js": "ce54687ef5c3901844b29955fb030bdbffe32f337ead327c7ae1061d96627710",
        "js/core/template-registry.js": "8638d7eee7cdbdca5d7151d3378f4cf471028a95355e2b0d62f4bd2a11ff3b03",
        // Reviewed merged baseline: preserves active 85d604a catalog/commercial and main 76c546f editorial-preconditions.
        "backend/http/static-policy.js": "ffcf0f9bde6a3ea3cb53edbf520b2e77d90385073e0b5b7eeefc001c626cfaf1",
    };
    for (const [file, expected] of Object.entries(protectedHashes)) {
        assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "..", file), "utf8").replace(/\r\n/g, "\n")).digest("hex"), expected);
    }
});
