"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const { preparePremiumLocalPreview, EVENT_ID } = require("../scripts/premium-local-preview");
const { createPreviewServer } = require("../scripts/dev-preview-server");
const { selectInvitationSource, loadInvitationSource, getLocalPremiumPresentation } = require("../js/core/invitation-data-source");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const Countdown = require("../js/core/countdown");
const { createPolicy } = require("../js/core/external-link-policy");
const PremiumRenderers = require("../js/core/premium-section-renderers");
const Templates = require("../js/core/template-registry");
const Dispatcher = require("../js/core/section-renderer");
const { normalizeEvent } = require("../js/core/event-normalizer");

const root = path.resolve(__dirname, "..");
const content = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/premium-preview.synthetic.json"), "utf8"));
assert.equal(content.identity.subtitle, "Nuestra Boda");
assert.equal(content.sections.find(section => section.id === "portada").data.subtitle, "Nuestra Boda");
assert.equal(Templates.getTemplate("boda-fiesta-premium").name, "Nuestra Boda · demo local");
const configuration = { entries: [{ revision: 1, manifest: {
    status: "approved", eventId: content.id, templateSlug: content.template.slug,
    canonicalDigest: canonicalContentDigest(content), media: {},
    gifts: { "regalos-pendientes": { ...content.sections.find(section => section.type === "gifts").data } },
    imageUrls: [], albumUrls: [content.sections.find(section => section.type === "collaborative-album").data.url]
} }] };
const before = JSON.stringify({ content, configuration });
const prepared = preparePremiumLocalPreview(content, configuration);
assert(prepared.accepted);
assert(JSON.stringify(prepared.content) === JSON.stringify(content) || canonicalContentDigest(prepared.content) === canonicalContentDigest(content));
assert(Object.isFrozen(prepared.content.sections[0].data));
assert(JSON.stringify({ content, configuration }) === before);
assert.deepEqual(preparePremiumLocalPreview(content, { entries: [] }), { accepted: false });
assert.deepEqual(preparePremiumLocalPreview({ ...content, id: "other" }, configuration), { accepted: false });
assert.deepEqual(preparePremiumLocalPreview({ ...content, identity: { title: "Changed" } }, configuration), { accepted: false });
const revoked = JSON.parse(JSON.stringify(configuration)); revoked.entries[0].manifest.status = "revoked";
assert.deepEqual(preparePremiumLocalPreview(content, revoked), { accepted: false });
assert(!JSON.stringify(prepared).includes("canonicalDigest"));
assert(!JSON.stringify(prepared).includes("manifest"));
assert.equal(content.sections.length, 9);
assert.deepEqual(Object.keys(content.media.items), ["musica-boda", "foto-pareja", "foto-cierre"]);
assert.equal(content.media.items["musica-boda"].type, "audio");
const runtime = normalizeEvent(prepared.content);
assert.equal(runtime.multimedia.audios.length, 1);
assert.equal(runtime.multimedia.audios[0].src, "/assets/templates/boda-fiesta-premium/musica-boda.mp3");
for (const id of ["fotografia-pareja", "cierre"]) {
    const canonical = content.sections.find(section => section.id === id);
    const normalized = runtime.sections.find(section => section.id === id);
    assert.equal(canonical.type, "media-closing");
    assert.equal(canonical.data.src, undefined);
    assert.equal(canonical.data.title, undefined);
    assert.equal(normalized.data.src, content.media.items[canonical.data.media_id].src);
}
assert.equal(content.schedule.time, "18:00");
assert.equal(content.schedule.timezone, "America/Argentina/Buenos_Aires");
const countdown = content.sections.find(section => section.id === "cuenta-regresiva");
assert.equal(countdown.type, "countdown");
assert.equal(countdown.data.targetDateTime, "2026-12-05T18:00:00-03:00");
const target = Date.parse(countdown.data.targetDateTime);
assert.equal(new Date(target).toISOString(), "2026-12-05T21:00:00.000Z");
assert.deepEqual(Countdown.calculateParts(countdown.data.targetDateTime, target - 93784000),
    { completed: false, days: 1, hours: 2, minutes: 3, seconds: 4 });
for (const now of [target, target + 1, target + 86400000]) {
    assert.deepEqual(Countdown.calculateParts(countdown.data.targetDateTime, now),
        { completed: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
}
assert(!JSON.stringify(content.schedule).includes("18:30"));
assert(!JSON.stringify(content.sections).includes("18:30"));
assert.equal(content.location.maps_url, "https://maps.example.test/synthetic");
assert.equal(content.modules.rsvp.mode, "whatsapp");
assert.equal(content.modules.rsvp.contacts.length, 1);
assert.equal(content.sections.find(section => section.id === "regalos-pendientes").type, "gifts");
assert.deepEqual(prepared.presentation.giftFields["regalos-pendientes"].sort(), ["cbu", "message", "title"]);
assert(!JSON.stringify(prepared.presentation).includes(content.sections.find(section => section.type === "gifts").data.cbu));
const manipulated = JSON.parse(JSON.stringify(content));
manipulated.sections.find(section => section.type === "gifts").data.cbu = "0000000000000000000000";
const renewedDigest = JSON.parse(JSON.stringify(configuration));
renewedDigest.entries[0].manifest.canonicalDigest = canonicalContentDigest(manipulated);
assert.equal(preparePremiumLocalPreview(manipulated, renewedDigest).accepted, false);
for (const field of ["title", "message"]) {
    const changed = JSON.parse(JSON.stringify(content));
    changed.sections.find(section => section.type === "gifts").data[field] = "Unapproved synthetic text";
    const approval = JSON.parse(JSON.stringify(configuration));
    approval.entries[0].manifest.canonicalDigest = canonicalContentDigest(changed);
    assert.equal(preparePremiumLocalPreview(changed, approval).accepted, false);
}
assert.equal(getLocalPremiumPresentation({ ...content, presentation: prepared.presentation }), null);
const album = content.sections.find(section => section.id === "album-pendiente");
assert.equal(album.type, "collaborative-album");
assert.equal(album.data.title, "Carpeta Compartida");
assert.equal(album.data.description, "Carpeta sintética de fotografías y videos.");
assert.equal(album.data.button_label, "Subir Aquí");
assert.equal(album.data.url, "https://album.example.test/synthetic");
assert.deepEqual(prepared.presentation.albumSections, [album.id]);
const noAlbumApproval = JSON.parse(JSON.stringify(configuration));
noAlbumApproval.entries[0].manifest.albumUrls = [];
assert.equal(preparePremiumLocalPreview(content, noAlbumApproval).accepted, false);
const otherAlbum = JSON.parse(JSON.stringify(content));
otherAlbum.sections.find(section => section.id === album.id).data.url = "https://album.example.test/not-approved";
const otherDigest = JSON.parse(JSON.stringify(configuration));
otherDigest.entries[0].manifest.canonicalDigest = canonicalContentDigest(otherAlbum);
assert.equal(preparePremiumLocalPreview(otherAlbum, otherDigest).accepted, false);
assert(!Templates.listCatalogTemplates().some(template => template.slug === "boda-fiesta-premium"));
const dress = content.sections.find(section => section.type === "dress-code");
assert.equal(Dispatcher.renderSection(dress, { renderers: { dressCode: () => "yes" } }), "");
assert.equal(Dispatcher.renderSection(dress, { templateConfig: { slug: "boda-fiesta-premium" }, renderers: { dressCode: () => "yes" } }), "yes");
assert.equal(selectInvitationSource(`?devDraft=${EVENT_ID}`, "example.test").mode, "invalid-preview");
assert.equal(selectInvitationSource(`?devDraft=${EVENT_ID}`, "127.0.0.1").mode, "local-premium");

// Exercise the actual browser controller: manual mode starts silent, an explicit
// click plays, while the existing default still attempts initial playback.
let plays = 0;
const audio = { paused: true, play() { plays++; return Promise.resolve(); }, pause() {}, removeAttribute() {} };
const widget = { classList: { add() {}, remove() {} } };
const button = { classList: { toggle() {} }, setAttribute() {} };
const selector = {};
const elements = { bgMusic: audio, audioWidget: widget, btnMusic: button, audioTrackSelector: selector };
const browser = { document: { addEventListener() {}, getElementById: id => elements[id], querySelectorAll: () => [] } };
vm.createContext(browser);
vm.runInContext(fs.readFileSync(path.join(root, "js/invitacion.js"), "utf8"), browser);
const albumContext = { escapeHtml: browser.escapeHtml, escapeAttr: browser.escapeAttr,
    albumPolicy: createPolicy({ allowedUrls: [album.data.url] }) };
const albumHtml = PremiumRenderers.renderCollaborativeAlbum(album, albumContext);
assert(albumHtml.includes(`href="${album.data.url}"`));
assert(albumHtml.includes('target="_blank" rel="noopener noreferrer"'));
assert(albumHtml.includes(album.data.description));
assert.equal(PremiumRenderers.renderCollaborativeAlbum(album, { ...albumContext, albumPolicy: undefined }), "");
for (const id of ["fotografia-pareja", "cierre"]) {
    const section = runtime.sections.find(section => section.id === id);
    const html = browser.renderMediaClosingPage(section, { pageIndex: id === "cierre" ? 8 : 2 });
    assert(html.includes('loading="lazy"'));
    assert(html.includes('decoding="async"'));
    assert(html.includes(section.data.src));
    assert(!html.includes("<h1") && !html.includes("<h2"));
}
browser.setupMusic([{ src: "/synthetic-test-only.mp3" }], "selector", true);
assert.equal(plays, 0);
button.onclick(); assert.equal(plays, 1);
browser.setupMusic([{ src: "/synthetic-test-only.mp3" }], "selector");
assert.equal(plays, 2);

function get(port, route, method = "GET") {
    return new Promise((resolve, reject) => {
        const request = http.request({ host: "127.0.0.1", port, path: route, method }, response => {
            let body = "";
            response.setEncoding("utf8"); response.on("data", value => { body += value; });
            response.on("end", () => resolve({ status: response.statusCode, body, contentType: response.headers["content-type"] }));
        }).on("error", reject);
        request.end();
    });
}

(async () => {
    const server = createPreviewServer({ loadPremiumPreviewInput: () => ({ content, configuration }) });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
        const port = server.address().port;
        const response = await get(port, `/__premium-local-preview/${EVENT_ID}`);
        assert.equal(response.status, 200);
        const payload = JSON.parse(response.body);
        assert(canonicalContentDigest(payload.content) === canonicalContentDigest(content));
        const loaded = await loadInvitationSource(selectInvitationSource(`?devDraft=${EVENT_ID}`, "127.0.0.1"),
            async () => ({ ok: true, json: async () => payload }));
        assert.equal(loaded, payload.content);
        assert.deepEqual(getLocalPremiumPresentation(loaded).giftFields["regalos-pendientes"].sort(), ["cbu", "message", "title"]);
        assert.equal(getLocalPremiumPresentation(JSON.parse(JSON.stringify(loaded))), null);
        await assert.rejects(loadInvitationSource(selectInvitationSource(`?devDraft=${EVENT_ID}`, "127.0.0.1"),
            async () => ({ ok: true, json: async () => content })), /Vista previa no disponible/);
        assert(!response.body.includes("canonicalDigest"));
        assert.equal((await get(port, `/__premium-local-preview/${EVENT_ID}`, "POST")).status, 405);
        for (const route of [
            `/.dev/premium/${EVENT_ID}.authorization.json`,
            "/.dev/referencias/kaly-joha-referencia.mp4",
            "/.dev/referencias/kaly-joha-portada-original.png",
            `/__dev-fixtures/..%5cpremium%5c${EVENT_ID}.authorization.json`,
            "/__dev-fixtures/..%5creferencias%5ckaly-joha-referencia.mp4",
            `/__dev-drafts/${EVENT_ID}.event.json`,
            "/scripts/premium-local-preview.js", "/backend/premium/authorization-provider.js"
        ]) assert.equal((await get(port, route)).status, 404, route);
        assert.equal((await get(port, "/invitacion.html")).status, 200);
        assert.equal((await get(port, "/css/templates/boda-fiesta-premium.css")).status, 200);
        const cover = await get(port, "/assets/templates/boda-fiesta-premium/portada-original.webp");
        assert.equal(cover.status, 200);
        assert.equal(cover.contentType, "image/webp");
        for (const asset of ["nuestra-boda-fotografia.webp", "cierre-puente.webp"]) {
            const image = await get(port, `/assets/templates/boda-fiesta-premium/${asset}`);
            assert.equal(image.status, 200);
            assert.equal(image.contentType, "image/webp");
        }
        for (const filename of ["Nuestra Boda entre luces y flores (2) (1).png", "Paseo romántico hacia el árbol en flor (1).png"]) {
            assert.equal((await get(port, `/.dev/referencias/${encodeURIComponent(filename)}`)).status, 404);
        }
        const music = await get(port, "/assets/templates/boda-fiesta-premium/musica-boda.mp3");
        assert.equal(music.status, 200);
        assert.equal(music.contentType, "audio/mpeg");
        assert.equal((await get(port, "/.dev/referencias/WhatsApp%20Audio%202026-10-12%20at%2016.38.29.mpeg")).status, 404);
        assert.equal((await get(port, "/__dev-drafts/kaly-joha-boda-civil.event.json")).status, 200);
    } finally { await new Promise(resolve => server.close(resolve)); }
    // Injection supplies inputs, never acceptance: private validation still runs.
    for (const input of [{ content, configuration: { entries: [] } },
        { content: { ...content, id: "other-event" }, configuration }]) {
        const deniedServer = createPreviewServer({ loadPremiumPreviewInput: () => input });
        await new Promise(resolve => deniedServer.listen(0, "127.0.0.1", resolve));
        try {
            const response = await get(deniedServer.address().port,
                `/__premium-local-preview/${EVENT_ID}?authorization=approved`);
            assert.equal(response.status, 422);
            assert(!response.body.includes("canonicalDigest") && !response.body.includes("1111111111111111111111"));
        } finally { await new Promise(resolve => deniedServer.close(resolve)); }
    }
    console.log("premium local preview tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
