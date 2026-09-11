const assert = require("assert");
const { normalizeEvent } = require("../js/core/event-normalizer");
const { resolveTemplate } = require("../js/core/template-registry");
const {
    SECTION_RENDERER_REGISTRY,
    getRenderableSections,
    renderSections,
    renderSection
} = require("../js/core/section-renderer");

const renderers = {
    hero: (section, context) => `hero:${section.id}:${context.pageIndex}/${context.pageCount}`,
    eventInfo: (section, context) => `event-info:${section.id}:${context.pageIndex}/${context.pageCount}`,
    location: (section, context) => `location:${section.id}:${context.pageIndex}/${context.pageCount}`,
    rsvp: (section, context) => `rsvp:${section.id}:${context.pageIndex}/${context.pageCount}`,
    closing: (section, context) => `closing:${section.id}:${context.pageIndex}/${context.pageCount}`
};

const legacy = normalizeEvent({
    nombre: "Legacy",
    fechaEvento: "2026-02-03",
    lugarNombre: "Lugar",
    multimedia: {
        capas: {
            portada: "https://example.test/portada.jpg",
            encuentro: "https://example.test/encuentro.jpg",
            confirmacion: "https://example.test/confirmacion.jpg"
        }
    },
    contactosRSVP: [{ nombre: "Contacto", telefono: "5491111111111" }]
});

assert.deepStrictEqual(
    getRenderableSections(legacy.sections).map((section) => section.type),
    ["hero", "location", "rsvp"]
);
assert.deepStrictEqual(
    renderSections(legacy.sections, { renderers }),
    ["hero:legacy-capa-1:0/3", "location:legacy-capa-2:1/3", "rsvp:legacy-capa-3:2/3"]
);

const schemaFiveSections = normalizeEvent({
    schema_version: 1,
    event: { title: "Nuevo schema" },
    sections: [
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "event-info", type: "event-info", enabled: true, order: 20, data: {} },
        { id: "location", type: "location", enabled: true, order: 30, data: {} },
        { id: "rsvp", type: "rsvp", enabled: true, order: 40, data: {} },
        { id: "closing", type: "closing", enabled: true, order: 50, data: {} }
    ],
    music: {
        tracks: [{ src: "https://example.test/audio.mp3", name: "Audio" }]
    }
});

assert.deepStrictEqual(
    renderSections(schemaFiveSections.sections, { renderers }),
    [
        "hero:hero:0/5",
        "event-info:event-info:1/5",
        "location:location:2/5",
        "rsvp:rsvp:3/5",
        "closing:closing:4/5"
    ]
);
assert.strictEqual(schemaFiveSections.sections.some((section) => section.type === "music"), false);

const withDisabled = getRenderableSections([
    { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
    { id: "rsvp", type: "rsvp", enabled: false, order: 20, data: {} }
]);
assert.deepStrictEqual(withDisabled.map((section) => section.id), ["hero"]);

const warnings = [];
assert.deepStrictEqual(
    getRenderableSections([
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "unknown", type: "unknown", enabled: true, order: 20, data: {} }
    ], { warn: (message) => warnings.push(message) }).map((section) => section.id),
    ["hero"]
);
assert.strictEqual(warnings.length, 1);
assert.strictEqual(renderSection({ id: "unknown", type: "unknown", enabled: true, data: {} }, { warn: () => {} }), "");
assert.deepStrictEqual(renderSections([], { renderers }), []);
assert.deepStrictEqual(
    renderSections([{ id: "only", type: "hero", enabled: true, order: 10, data: {} }], { renderers }),
    ["hero:only:0/1"]
);
assert.deepStrictEqual(Object.keys(SECTION_RENDERER_REGISTRY), ["hero", "event-info", "location", "rsvp", "closing"]);

const civilTemplate = resolveTemplate("boda-civil-esencial");
const legacyTemplate = resolveTemplate("boda-vertical");
assert.strictEqual(civilTemplate.layout, "vertical");
assert.strictEqual(legacyTemplate.layout, "paged");

const navForTemplate = (template, pageCount) => template.layout === "vertical" ? "" : `dots:${pageCount}`;
assert.strictEqual(navForTemplate(civilTemplate, 5), "");
assert.strictEqual(navForTemplate(legacyTemplate, 3), "dots:3");

console.log("section-renderer test passed");
