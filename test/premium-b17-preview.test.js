"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { preparePremiumLocalPreview, CANDIDATE_EVENT_ID } = require("../scripts/premium-local-preview");
const { createPreviewServer } = require("../scripts/dev-preview-server");
const { selectInvitationSource } = require("../js/core/invitation-data-source");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const { normalizeEvent } = require("../js/core/event-normalizer");
const renderers = require("../js/core/premium-section-renderers");
const { createPolicy } = require("../js/core/external-link-policy");
const vm = require("node:vm");

// Splitting at the original absolute moveto preserves every drawing command.
const invitationSource = fs.readFileSync(path.join(__dirname, "../js/invitacion.js"), "utf8");
const gown = invitationSource.match(/class="premium-dress-gown" d="([^"]+)"/)[1];
const tie = invitationSource.match(/class="premium-dress-tie" d="([^"]+)"/)[1];
assert.equal(`${gown} ${tie}`, "M17 5h7v14h12V5h7l-2 24 14 36H5l14-36Z M17 43h27 M66 7h26L84 24l9 40-12 8-12-8 9-40Z M72 7l9 17 9-17 M74 43l15-9 M72 55l19-12");

// No commercial/private fixture is required to reproduce the candidate path.
const content = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/premium-preview.synthetic.json"), "utf8"));
content.id = CANDIDATE_EVENT_ID;
delete content.metadata;
const closing = content.sections.find(section => section.id === "cierre");
closing.type = "gallery";
closing.config = {};
closing.data = { items: [
    { media_id: "pair-b17", alt: "Synthetic pair photograph" },
    { media_id: "closing-b17", alt: "Synthetic closing card" }
] };
content.media.items["pair-b17"] = { type: "image", src: "/assets/templates/boda-fiesta-premium/pareja-premium.webp" };
content.media.items["closing-b17"] = { type: "image", src: "/assets/templates/boda-fiesta-premium/cierre-premium.webp" };
const gifts = content.sections.find(section => section.type === "gifts");
const album = content.sections.find(section => section.type === "collaborative-album");
const configuration = { entries: [{ revision: 2, manifest: {
    status: "approved", eventId: content.id, templateSlug: content.template.slug,
    canonicalDigest: canonicalContentDigest(content),
    media: { "pair-b17": content.media.items["pair-b17"], "closing-b17": content.media.items["closing-b17"] },
    gifts: { [gifts.id]: gifts.data }, imageUrls: [], albumUrls: [album.data.url]
} }] };
const inputBefore = JSON.stringify({ content, configuration });
const prepared = preparePremiumLocalPreview(content, configuration, { eventId: CANDIDATE_EVENT_ID });
assert(prepared.accepted);
assert.equal(prepared.content.sections.length, 9);
assert.deepEqual(prepared.presentation.gallerySections.cierre, ["pair-b17", "closing-b17"]);
assert.equal(JSON.stringify({ content, configuration }), inputBefore);
assert.equal(closing.data.items[0].src, undefined);
assert.equal(preparePremiumLocalPreview(content, configuration).accepted, false);
assert.equal(preparePremiumLocalPreview(content, { entries: [] }, { eventId: CANDIDATE_EVENT_ID }).accepted, false);
const altered = structuredClone(content);
altered.media.items["pair-b17"].src = "/assets/templates/boda-fiesta-premium/cierre-premium.webp";
assert.equal(preparePremiumLocalPreview(altered, configuration, { eventId: CANDIDATE_EVENT_ID }).accepted, false);
const revoked = structuredClone(configuration);
revoked.entries[0].manifest.status = "revoked";
assert.equal(preparePremiumLocalPreview(content, revoked, { eventId: CANDIDATE_EVENT_ID }).accepted, false);
const runtime = normalizeEvent(prepared.content);
const escape = value => String(value).replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);
const html = renderers.renderGallery(runtime.sections.find(section => section.id === "cierre"), {
    escapeHtml: escape, escapeAttr: escape,
    authorizedMediaIds: prepared.presentation.gallerySections.cierre, mediaItems: runtime.media.items,
    approvedLocalSources: closing.data.items.map(item => content.media.items[item.media_id].src)
});
assert.equal((html.match(/<section /g) || []).length, 1);
assert.equal((html.match(/<figure>/g) || []).length, 2);
assert(html.indexOf("pareja-premium.webp") < html.indexOf("cierre-premium.webp"));
assert(html.includes('loading="lazy"'));
const albumHtml = renderers.renderCollaborativeAlbum(album, {
    escapeHtml: escape, escapeAttr: escape, albumPolicy: createPolicy({ allowedUrls: [album.data.url] })
});
assert(albumHtml.includes(`href="${album.data.url}"`));
assert(albumHtml.includes('rel="noopener noreferrer"'));
assert.equal(selectInvitationSource(`?devDraft=${CANDIDATE_EVENT_ID}`, "127.0.0.1").mode, "local-premium");
assert.equal(selectInvitationSource(`?devDraft=${CANDIDATE_EVENT_ID}`, "public.example.test").mode, "invalid-preview");
const e2 = structuredClone(content);
e2.sections.find(section => section.id === "fotografia-pareja").data = {
    media_id: "foto-cierre", alt: "Synthetic bridge photograph"
};
const e2Closing = e2.sections.find(section => section.id === "cierre");
e2Closing.type = "closing";
e2Closing.data = { media_id: "pair-b17", imageAlt: "Synthetic pair", title: "¡Te esperamos!", names: "Synthetic pair" };
e2Closing.config = { mediaLayout: "contained" };
const e2Configuration = structuredClone(configuration);
e2Configuration.entries[0].revision = 3;
e2Configuration.entries[0].manifest.canonicalDigest = canonicalContentDigest(e2);
const e2Prepared = preparePremiumLocalPreview(e2, e2Configuration, { eventId: CANDIDATE_EVENT_ID });
assert(e2Prepared.accepted);
assert.equal(e2Prepared.content.sections.length, 9);
assert.deepEqual(e2Prepared.presentation.gallerySections, {});
assert.equal(preparePremiumLocalPreview(e2, configuration, { eventId: CANDIDATE_EVENT_ID }).accepted, false);
assert.equal(selectInvitationSource(`?devDraft=${CANDIDATE_EVENT_ID}&candidate=b17-e2`, "127.0.0.1").url,
    `/__premium-local-preview/${CANDIDATE_EVENT_ID}/b17-e2`);
assert.equal(selectInvitationSource(`?devDraft=${CANDIDATE_EVENT_ID}&candidate=unknown`, "127.0.0.1").mode, "invalid-preview");
assert.equal(selectInvitationSource(`?devDraft=${CANDIDATE_EVENT_ID}&candidate=b17-e2`, "public.example.test").mode, "invalid-preview");
const e4 = structuredClone(e2);
e4.modules.branding = { enabled: true, brandName: "YCOR Digital", badgeText: "YCOR Digital ✦ Pedí la tuya",
    cta: "Synthetic commercial message", serviceText: "Invitaciones digitales", whatsapp: "5491100000000" };
const e4Configuration = structuredClone(e2Configuration);
e4Configuration.entries[0].revision = 4;
e4Configuration.entries[0].manifest.canonicalDigest = canonicalContentDigest(e4);
assert(preparePremiumLocalPreview(e4, e4Configuration, { eventId: CANDIDATE_EVENT_ID }).accepted);
assert.equal(preparePremiumLocalPreview(e4, e2Configuration, { eventId: CANDIDATE_EVENT_ID }).accepted, false);
assert.equal(selectInvitationSource(`?devDraft=${CANDIDATE_EVENT_ID}&candidate=b17-e4`, "127.0.0.1").url,
    `/__premium-local-preview/${CANDIDATE_EVENT_ID}/b17-e4`);
assert.equal(selectInvitationSource(`?devDraft=${CANDIDATE_EVENT_ID}&candidate=b17-e4`, "public.example.test").mode, "invalid-preview");

// Exercise the existing renderer and its animation lifecycle without real timers.
let enter, preferenceChanged, reduced = false;
const timers = new Map();
let nextTimer = 0;
const writing = { textContent: "Synthetic pair" };
const classes = new Set();
const closingElement = { querySelector: () => writing,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
const dressClasses = new Set();
const dressElement = { classList: { add: name => dressClasses.add(name), remove: name => dressClasses.delete(name) } };
const unobserved = [];
const browser = { document: { addEventListener() {} }, window: { matchMedia: () => ({
    get matches() { return reduced; }, addEventListener: (_name, callback) => { preferenceChanged = callback; }, removeEventListener() {}
}) }, IntersectionObserver: class {
    constructor(callback) { enter = callback; }
    observe() {} unobserve(element) { unobserved.push(element); } disconnect() {}
}, setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout: id => timers.delete(id) };
vm.createContext(browser);
vm.runInContext(fs.readFileSync(path.join(rootDirectory(), "js/invitacion.js"), "utf8"), browser);
browser.getApp = () => ({ querySelector: selector => selector === "[data-premium-closing]" ? closingElement : dressElement });
const closingHtml = browser.renderClosingPage(normalizeEvent(e2).sections.find(section => section.id === "cierre"), {
    templateConfig: { slug: "boda-fiesta-premium" }, event: { id: CANDIDATE_EVENT_ID },
    getSectionImage: section => section.data.image, pageIndex: 8, renderBrochureNavigation: () => ""
});
assert(closingHtml.includes("data-premium-closing"));
assert(closingHtml.includes('aria-hidden="true" data-premium-writing'));
assert(closingHtml.includes('class="premium-accessible-text">Synthetic pair'));
assert.equal((closingHtml.match(/<h2 /g) || []).length, 1);
const legacyHtml = browser.renderClosingPage({ type: "closing", data: { title: "Ordinary", names: "Legacy" } }, {
    getSectionImage: () => "", renderBrochureNavigation: () => ""
});
assert(!legacyHtml.includes("data-premium-closing"));
const marketing = browser.renderBranding(normalizeEvent(e4));
assert(marketing.includes("YCOR Digital ✦ Pedí la tuya"));
assert(marketing.includes('aria-expanded="false"'));
assert(marketing.includes('data-branding-close'));
assert(marketing.includes('href="https://wa.me/5491100000000?text='));
assert(!marketing.includes("wedding-section"));
browser.setupPremiumEntryAnimations();
assert.equal(writing.textContent, "");
assert(dressClasses.has("is-animation-ready"));
enter([{ target: dressElement, isIntersecting: false }]); assert.equal(timers.size, 0);
enter([{ target: dressElement, isIntersecting: true }]);
assert(dressClasses.has("is-visible"));
assert.deepEqual(unobserved, [dressElement]);
enter([{ target: dressElement, isIntersecting: true }]);
assert.equal(unobserved.length, 1, "Entry runs once even when repeated intersection records arrive");
assert.equal(timers.size, 0, "Dress Code never rewrites its text through timers");
enter([{ target: closingElement, isIntersecting: true }]);
assert(classes.has("is-visible"));
const first = timers.entries().next().value; timers.delete(first[0]); first[1]();
assert.equal(writing.textContent, "S");
reduced = true; preferenceChanged();
assert.equal(writing.textContent, "Synthetic pair");
assert.equal(timers.size, 0);
assert(!dressClasses.has("is-animation-ready"));
browser.setupPremiumEntryAnimations();
assert.equal(writing.textContent, "Synthetic pair");
assert(!classes.has("is-animation-ready"));
assert(dressClasses.has("is-visible"));
// Missing observer falls back to visible text, without animation or timers.
reduced = false;
browser.IntersectionObserver = undefined;
browser.setupPremiumEntryAnimations();
assert(!dressClasses.has("is-animation-ready"));
assert.equal(timers.size, 0);
function rootDirectory() { return path.resolve(__dirname, ".."); }

let server;
(async () => {
    let loads = 0;
    server = createPreviewServer({ loadPremiumCandidateInput: () => { loads++; return { content, configuration }; },
        loadPremiumE2CandidateInput: () => ({ content: e2, configuration: e2Configuration }),
        loadPremiumE4CandidateInput: () => ({ content: e4, configuration: e4Configuration }) });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/__premium-local-preview/${CANDIDATE_EVENT_ID}`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.content.sections.length, 9);
    assert.deepEqual(payload.presentation.gallerySections.cierre, ["pair-b17", "closing-b17"]);
    assert(!JSON.stringify(payload).includes("canonicalDigest"));
    assert(!JSON.stringify(payload).includes("manifest"));
    assert.equal((await fetch(`${base}/__premium-local-preview/${CANDIDATE_EVENT_ID}`, { method: "POST" })).status, 405);
    assert.equal(loads, 1);
    const e2Response = await fetch(`${base}/__premium-local-preview/${CANDIDATE_EVENT_ID}/b17-e2`);
    assert.equal(e2Response.status, 200);
    const e2Payload = await e2Response.json();
    assert.equal(e2Payload.content.sections.length, 9);
    assert.equal(e2Payload.content.sections[8].type, "closing");
    assert(!JSON.stringify(e2Payload).includes("canonicalDigest"));
    const e4Response = await fetch(`${base}/__premium-local-preview/${CANDIDATE_EVENT_ID}/b17-e4`);
    assert.equal(e4Response.status, 200);
    const e4Payload = await e4Response.json();
    assert.equal(e4Payload.content.sections.length, 9);
    assert.equal(e4Payload.content.modules.branding.enabled, true);
    assert(!JSON.stringify(e4Payload).includes("canonicalDigest"));
    assert.equal((await fetch(`${base}/__premium-local-preview/${CANDIDATE_EVENT_ID}/b17-e4`, { method: "POST" })).status, 405);
    for (const route of [
        "/.dev/premium/kaly-joha-nuestra-boda.b17-candidate.event.json",
        "/.dev/premium/kaly-joha-nuestra-boda.b17-candidate.authorization.json",
        "/.dev/premium/kaly-joha-nuestra-boda.b17-e2-candidate.authorization.json",
        "/.dev/premium/kaly-joha-nuestra-boda.b17-e4-candidate.authorization.json",
        "/__dev-drafts/../premium/kaly-joha-nuestra-boda.b17-candidate.event.json",
        "/backend/premium/authorization-provider.js"
    ]) assert.equal((await fetch(base + route)).status, 404);
    for (const name of ["fiesta-decorativa", "asistencia-decorativa", "carpeta-decorativa", "pareja-premium", "cierre-decorativo-b17-e1", "fiesta-decorativa-b17-e4", "asistencia-decorativa-b17-e4"]) {
        const resource = await fetch(`${base}/assets/templates/boda-fiesta-premium/${name}.webp`);
        assert.equal(resource.status, 200);
        assert(resource.headers.get("content-type").includes("image/webp"));
        await resource.arrayBuffer();
    }
    console.log("B17 candidate: scoped authorization, nine sections, ordered gallery and HTTP privacy PASS");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});
