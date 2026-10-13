"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createPublicEventResolver } = require("../js/core/public-event-resolver");
const { createEventVersionEditorialService } = require("../js/core/event-version-editorial-service");
const { createAuthorizationProvider } = require("../backend/premium/authorization-provider");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const DataSource = require("../js/core/invitation-data-source");
const Normalizer = require("../js/core/event-normalizer");
const Registry = require("../js/core/template-registry");
const Renderer = require("../js/core/section-renderer");
const Premium = require("../js/core/premium-section-renderers");
const Policy = require("../js/core/external-link-policy");

const VERSION = "11111111-1111-4111-8111-111111111111";
function snapshot() {
    return { schema_version: 2, id: "synthetic-public-premium", event_type: "wedding", plan: "premium", status: "draft",
        template: { slug: "boda-fiesta-premium" }, identity: { title: "Synthetic wedding" },
        schedule: { date: "2026-12-05" }, modules: {}, metadata: { internalNote: "private editorial note" },
        media: { items: { photo: { type: "image", src: "/assets/synthetic/photo.webp" } } },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 1, data: {} },
            { id: "gallery", type: "gallery", enabled: true, order: 2,
                data: { items: [{ media_id: "photo", alt: "Synthetic image" }] } },
            { id: "gift", type: "gifts", enabled: true, order: 3,
                data: { title: "Gift", message: "Synthetic gift", cbu: "0".repeat(22) }, config: { allow_copy: true } },
            { id: "album", type: "collaborative-album", enabled: true, order: 4,
                data: { title: "Album", url: "https://album.example.com/synthetic" } },
            { id: "dress", type: "dress-code", enabled: true, order: 5, data: { description: "Formal" } }
        ] };
}
function harness(content = snapshot(), change = () => {}, stateChange) {
    const configuration = { entries: [{ revision: 1, manifest: {
        eventId: content.id, templateSlug: content.template.slug, canonicalDigest: canonicalContentDigest(content), status: "approved",
        media: { photo: { ...content.media.items.photo } }, gifts: { gift: { ...content.sections[2].data } },
        albumUrls: [content.sections[3].data.url]
    } }] };
    const provider = createAuthorizationProvider(configuration);
    let writes = 0, eventReads = 0;
    const adapter = Object.fromEntries(["createEvent", "createVersion", "transitionWorkflow", "publishVersion", "rollbackVersion"]
        .map(method => [method, () => { writes++; }]));
    const service = createEventVersionEditorialService(adapter, { getAuthorizationState: stateChange || (() => ({ provider, revision: 1 })) });
    const event = { id: content.id, event_status: "active", published_version_id: VERSION,
        current_working_version_id: "draft-version", datos: { mustNotLeak: true } };
    const version = { id: VERSION, event_id: content.id, workflow_status: "approved",
        published_at: "2026-10-12T12:00:00Z", content };
    const objects = { event, version, configuration }; change(objects);
    const resolver = createPublicEventResolver({
        async getEvent() { eventReads++; return event; }, async getVersion() { return version; }
    }, { preparePremiumContent: service.preparePremiumContent });
    return { resolver, objects, service, writes: () => writes, eventReads: () => eventReads };
}
const reject = h => assert.rejects(() => h.resolver.resolvePublicEvent("synthetic-public-premium"),
    error => error.code === "PUBLIC_EVENT_NOT_FOUND");

(async () => {
    const content = snapshot(), original = JSON.stringify(content), h = harness(content);
    const envelope = await h.resolver.resolvePublicEvent(content.id);
    assert.equal(envelope.eventId, content.id); assert.equal(envelope.versionId, VERSION);
    assert.equal(h.eventReads(), 2); assert.equal(h.writes(), 0);
    assert.equal(JSON.stringify(content), original);
    assert(!Object.hasOwn(envelope.content, "metadata"));
    const serialized = JSON.stringify(envelope);
    for (const secret of ["canonicalDigest", "PREMIUM_AUTHORIZATION_CONFIG", "private editorial note", ".dev/", "mustNotLeak"])
        assert(!serialized.includes(secret));
    assert(!Object.hasOwn(envelope.content.sections[1].data.items[0], "src"));
    const source = DataSource.selectInvitationSource(`?id=${content.id}`, "invitaciones.example.test");
    const fetched = await DataSource.loadInvitationSource(source, async () => ({ ok: true, json: async () => envelope }));
    assert.equal(fetched, envelope.content);
    assert.equal(DataSource.getPublicPremiumPresentation(fetched), envelope.presentation);
    assert.equal(DataSource.getPublicPremiumPresentation(structuredClone(fetched)), null);
    for (const altered of [fetched, { ...envelope, eventId: "other-event" }, { ...envelope, versionId: "" },
        { ...envelope, presentation: null }, { ...envelope, content: { ...fetched, id: "other-event" } }]) {
        await assert.rejects(() => DataSource.loadInvitationSource(source, async () => ({ ok: true, json: async () => altered })));
    }

    for (const change of [o => { o.event.event_status = "archived"; }, o => { o.event.event_status = "draft"; },
        o => { o.event.id = "other-event"; }, o => { o.event.published_version_id = null; },
        o => { o.version.id = "other-version"; }, o => { o.version.event_id = "other-event"; },
        o => { o.version.workflow_status = "draft"; }, o => { o.version.published_at = null; },
        o => { o.version.published_at = "invalid"; }, o => { o.version.content.id = "other-event"; },
        o => { o.version.content.sections[2].data.cbu = "1".repeat(22); },
        o => { o.version.content.media.items.photo.src = "/assets/synthetic/other.webp"; },
        o => { o.version.content.sections[3].data.url = "https://album.example.com/other"; },
        o => { o.version.content.template.slug = "unregistered"; },
        o => { o.version.content.metadata.purpose = "local-only-preview"; },
        o => { o.version.content.schedule.date = "invalid"; }]) {
        const bad = harness(snapshot(), change); await reject(bad); assert.equal(bad.writes(), 0);
    }
    await reject(harness(snapshot(), () => {}, () => null));
    const revoked = createAuthorizationProvider();
    await reject(harness(snapshot(), () => {}, () => ({ provider: revoked, revision: 1 })));
    const privatePath = snapshot(); privatePath.identity.title = "Private .dev/referencias/material";
    await reject(harness(privatePath));
    const noAuthority = createPublicEventResolver({ getEvent: async () => h.objects.event, getVersion: async () => h.objects.version });
    await assert.rejects(() => noAuthority.resolvePublicEvent(content.id));
    for (const changed of [{ ...h.objects.event, published_version_id: "new-version" },
        { ...h.objects.event, event_status: "archived" }]) {
        let reads = 0;
        const racing = createPublicEventResolver({ getEvent: async () => ++reads === 1 ? h.objects.event : changed,
            getVersion: async () => h.objects.version }, { preparePremiumContent: h.service.preparePremiumContent });
        await assert.rejects(() => racing.resolvePublicEvent(content.id), error => error.code === "PUBLIC_EVENT_NOT_FOUND");
    }
    const ordinary = { title: "Traditional published invitation" };
    const traditional = createPublicEventResolver({ getEvent: async () => ({ id: "legacy", published_version_id: "v" }),
        getVersion: async () => ({ id: "v", event_id: "legacy", content: ordinary }) });
    assert.deepEqual(await traditional.resolvePublicEvent("legacy"), ordinary);
    const legacyWithPresentation = { nombre: "Traditional", presentation: { theme: "classic" } };
    assert.deepEqual(await DataSource.loadInvitationSource({ mode: "public", eventId: "legacy", url: "/api/eventos/legacy" },
        async () => ({ ok: true, json: async () => legacyWithPresentation })), legacyWithPresentation);

    // Run the actual browser entrypoint and dispatcher with server presentation;
    // replace only DOM/layout helpers, never authorization modules or registries.
    const sandbox = { document: { addEventListener() {} },
        window: { location: { search: `?id=${content.id}`, hostname: "invitaciones.example.test" } },
        InvitationDataSource: DataSource, EventNormalizer: Normalizer, TemplateRegistry: Registry,
        ThemeRegistry: require("../js/core/theme-registry"), Countdown: require("../js/core/countdown"),
        SectionRenderer: Renderer, PremiumSectionRenderers: Premium, ExternalLinkPolicy: Policy,
        fetch: async () => ({ ok: true, json: async () => envelope }), console: { error(error) { throw error; } } };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(require.resolve("../js/invitacion"), "utf8"), sandbox);
    const originalRenderInvitation = sandbox.renderInvitation;
    let rendered;
    sandbox.loadTemplateStylesheet = async () => {};
    sandbox.applyTemplateConfig = sandbox.applyTheme = sandbox.hideLoader = () => {};
    sandbox.renderState = () => { throw new Error("Unexpected render rejection"); };
    sandbox.renderInvitation = (event, template, presentation) => { rendered = { event, template, presentation }; };
    await sandbox.initInvitation();
    assert.equal(rendered.template.slug, "boda-fiesta-premium");
    assert.equal(rendered.presentation, envelope.presentation);
    // Capture the renderer context before DOM decoration to test actual wrappers.
    const captured = {};
    sandbox.getApp = () => ({ set innerHTML(_value) { throw captured; } });
    sandbox.SectionRenderer = { ...Renderer, renderSections(sections, context) { captured.context = context; return []; } };
    sandbox.renderBranding = () => "";
    sandbox.document.getElementById = () => null;
    sandbox.document.title = "";
    assert.throws(() => originalRenderInvitation(rendered.event, rendered.template, rendered.presentation));
    const context = captured.context;
    assert(context);
    const premiumHtml = rendered.event.sections.filter(s => s.type !== "hero")
        .map(s => Renderer.renderSection(s, context)).join("");
    assert(premiumHtml.includes("/assets/synthetic/photo.webp"));
    assert(premiumHtml.includes("premium-gifts") && premiumHtml.includes("premium-dress-code"));
    assert(premiumHtml.includes('rel="noopener noreferrer"'));
    console.log("public premium read tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
