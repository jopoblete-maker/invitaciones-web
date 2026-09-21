const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { validateDraftContent } = require("../scripts/dev-preview-server");
const {
    buildPayload,
    loadDraft,
    publishDraft
} = require("../scripts/publish-event-draft");
const { validateEventForPersistence } = require("../js/core/event-validator");
const EventNormalizer = require("../js/core/event-normalizer");
const TemplateRegistry = require("../js/core/template-registry");
const SectionRenderer = require("../js/core/section-renderer");
const CalendarActions = require("../js/core/calendar-actions");

const draftPath = path.resolve(__dirname, "..", ".dev", "drafts", "demo-event-v2.event.json");
const raw = fs.readFileSync(draftPath, "utf8");
const demo = JSON.parse(raw);
const snapshot = JSON.stringify(demo);

(async () => {
    const preview = validateDraftContent(raw);
    assert.strictEqual(preview.valid, true);
    assert.strictEqual(preview.body.schema_version, 2);

    const publisherDraft = loadDraft("demo-event-v2");
    assert.deepStrictEqual(publisherDraft, demo);
    let requestCalled = false;
    const dryRun = await publishDraft({
        draft: "demo-event-v2",
        id: "ycor-demo-v2-preview",
        target: "http://127.0.0.1:3000",
        dryRun: true,
        overwrite: false
    }, () => {
        requestCalled = true;
    });
    assert.deepStrictEqual(dryRun.validation, { valid: true, errors: [] });
    assert.strictEqual(requestCalled, false);

    const payload = buildPayload({
        draft: publisherDraft,
        id: "ycor-demo-v2-preview",
        password: "mock-secret",
        overwrite: false
    });
    assert.strictEqual(payload.id, "ycor-demo-v2-preview");
    assert.strictEqual(payload.password, "mock-secret");

    const { password, overwrite, ...canonicalEvent } = payload;
    assert.strictEqual(password, "mock-secret");
    assert.strictEqual(overwrite, undefined);
    const serverValidation = validateEventForPersistence(canonicalEvent);
    assert.deepStrictEqual(serverValidation, { valid: true, errors: [] });

    const mockPersistence = [];
    mockPersistence.push({ id: canonicalEvent.id, datos: canonicalEvent });
    assert.strictEqual(mockPersistence.length, 1);
    assert.strictEqual(mockPersistence[0].datos.schema_version, 2);

    const normalized = EventNormalizer.normalizeEvent(mockPersistence[0].datos);
    assert.strictEqual(normalized.schema_version, 2);
    assert.deepStrictEqual(normalized.identity, demo.identity);
    assert.strictEqual(normalized.nombre, "YCOR Demo V2");
    assert.strictEqual(normalized.music.tracks[0].src, demo.media.items["demo-audio"].src);
    assert.strictEqual(normalized.branding.enabled, true);
    assert.strictEqual(normalized.googleMapsUrl, demo.location.maps_url);
    assert(CalendarActions.getCalendarDetails(normalized));

    const template = TemplateRegistry.resolveTemplate(normalized.template.slug);
    assert.strictEqual(template.slug, "boda-vertical");
    assert.strictEqual(template.layout, "vertical");
    assert(template.supportedActions.includes("maps"));
    assert(template.supportedActions.includes("calendar"));
    ["music", "rsvp", "branding"].forEach((module) => {
        assert(template.supportedModules.includes(module));
    });

    const expectedTypes = [
        "hero",
        "event-info",
        "location",
        "countdown",
        "rsvp",
        "closing",
        "media-closing"
    ];
    const renderable = SectionRenderer.getRenderableSections(normalized.sections);
    assert.deepStrictEqual(renderable.map((section) => section.type), expectedTypes);
    assert(renderable.every((section) => SectionRenderer.SECTION_RENDERER_REGISTRY[section.type]));

    const rendererKeys = Object.values(SectionRenderer.SECTION_RENDERER_REGISTRY);
    const renderers = Object.fromEntries(rendererKeys.map((key) => [key, (section) => section.type]));
    assert.deepStrictEqual(SectionRenderer.renderSections(normalized.sections, { renderers }), expectedTypes);

    assert.strictEqual(JSON.stringify(demo), snapshot);
    assert.strictEqual(JSON.stringify(preview.body), snapshot);
    console.log("demo v2 operational cycle test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
