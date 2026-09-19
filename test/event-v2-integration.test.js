const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { validateV2Event } = require("../js/core/event-validator");
const EventNormalizer = require("../js/core/event-normalizer");
const TemplateRegistry = require("../js/core/template-registry");
const SectionRenderer = require("../js/core/section-renderer");

const fixturePath = path.resolve(__dirname, "fixtures", "event-v2-complete.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const fixtureSnapshot = JSON.stringify(fixture);

const validation = validateV2Event(fixture);
assert.deepStrictEqual(validation, { valid: true, errors: [] });
assert.strictEqual(JSON.stringify(fixture), fixtureSnapshot);

const normalized = EventNormalizer.normalizeEvent(fixture);
assert.strictEqual(JSON.stringify(fixture), fixtureSnapshot);
assert.strictEqual(normalized.schema_version, 2);
assert.deepStrictEqual(normalized.identity, fixture.identity);
assert.deepStrictEqual(normalized.schedule, fixture.schedule);
assert.deepStrictEqual(normalized.modules, fixture.modules);
assert.deepStrictEqual(normalized.metadata, fixture.metadata);
assert.deepStrictEqual(normalized.media.items, fixture.media.items);
assert.strictEqual(normalized.event.title, fixture.identity.title);
assert.strictEqual(normalized.nombre, fixture.identity.title);
assert.strictEqual(normalized.fechaEvento, fixture.schedule.date);
assert.strictEqual(normalized.horarioTexto, fixture.schedule.time_text);
assert.strictEqual(normalized.schedule.timezone, "America/Argentina/Buenos_Aires");
assert.strictEqual(normalized.location.mapsUrl, fixture.location.maps_url);
assert.strictEqual(normalized.googleMapsUrl, fixture.location.maps_url);
assert.strictEqual(normalized.rsvp.deadline, fixture.modules.rsvp.deadline);
assert.strictEqual(normalized.contactosRSVP[0].telefono, fixture.modules.rsvp.contacts[0].phone);
assert.strictEqual(normalized.branding.brandName, fixture.modules.branding.brandName);
assert.strictEqual(normalized.music.tracks[0].src, fixture.media.items["background-audio"].src);
assert.strictEqual(normalized.multimedia.audios[0].src, fixture.media.items["background-audio"].src);
assert.strictEqual(
    normalized.sections.find((section) => section.id === "hero").data.image,
    fixture.media.items["cover-image"].src
);
assert.strictEqual(
    normalized.sections.find((section) => section.id === "countdown").data.targetDateTime,
    fixture.sections.find((section) => section.id === "countdown").data.target_datetime
);

const registrySnapshot = JSON.stringify(TemplateRegistry.TEMPLATES);
const template = TemplateRegistry.resolveTemplate(normalized.template.slug);
assert.strictEqual(template.slug, fixture.template.slug);
assert.strictEqual(template.layout, "vertical");
["hero", "event-info", "location", "rsvp", "countdown", "closing"].forEach((type) => {
    assert(template.supportedSections.includes(type));
});
["music", "rsvp", "branding"].forEach((slug) => {
    assert(template.supportedModules.includes(slug));
});
assert.deepStrictEqual(template.supportedActions, ["maps", "calendar"]);
assert.strictEqual(JSON.stringify(TemplateRegistry.TEMPLATES), registrySnapshot);

const sectionsSnapshot = JSON.stringify(normalized.sections);
const warnings = [];
const renderable = SectionRenderer.getRenderableSections(normalized.sections, {
    warn: (message) => warnings.push(message)
});
assert.deepStrictEqual(
    renderable.map((section) => section.id),
    ["hero", "event-info", "location", "rsvp", "countdown", "closing"]
);
assert(renderable.every((section) => section.enabled));
assert(renderable.every((section) => template.supportedSections.includes(section.type)));
assert(renderable.every((section) => SectionRenderer.SECTION_RENDERER_REGISTRY[section.type]));
assert.strictEqual(warnings.length, 0);

const rendererKeys = Object.values(SectionRenderer.SECTION_RENDERER_REGISTRY);
const renderers = Object.fromEntries(rendererKeys.map((key) => [
    key,
    (section, context) => `${key}:${section.id}:${context.pageIndex}/${context.pageCount}`
]));
assert.deepStrictEqual(
    SectionRenderer.renderSections(normalized.sections, { renderers }),
    [
        "hero:hero:0/6",
        "eventInfo:event-info:1/6",
        "location:location:2/6",
        "rsvp:rsvp:3/6",
        "countdown:countdown:4/6",
        "closing:closing:5/6"
    ]
);
assert.strictEqual(JSON.stringify(normalized.sections), sectionsSnapshot);

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

const invalidMedia = clone(fixture);
invalidMedia.sections.find((section) => section.id === "hero").data.media_id = "missing-image";
const invalidMediaResult = validateV2Event(invalidMedia);
assert.strictEqual(invalidMediaResult.valid, false);
assert(invalidMediaResult.errors.some((error) => error.includes("data.media_id")));

const incompatibleSection = clone(fixture);
incompatibleSection.sections.find((section) => section.id === "closing").type = "gallery";
const incompatibleSectionResult = validateV2Event(incompatibleSection);
assert.strictEqual(incompatibleSectionResult.valid, false);
assert(incompatibleSectionResult.errors.some((error) => error.includes("type no registrado")));

const missingRsvpModule = clone(fixture);
delete missingRsvpModule.modules.rsvp;
const missingRsvpResult = validateV2Event(missingRsvpModule);
assert.strictEqual(missingRsvpResult.valid, false);
assert(missingRsvpResult.errors.some((error) => error.includes("modules.rsvp es requerido")));

assert.strictEqual(JSON.stringify(fixture), fixtureSnapshot);
assert.strictEqual(JSON.stringify(TemplateRegistry.TEMPLATES), registrySnapshot);

console.log("event v2 isolated pipeline integration test passed");
