"use strict";

const assert = require("assert");
const EventSchema = require("../js/core/event-schema");
const ModuleRegistry = require("../js/core/module-registry");
const SectionContracts = require("../js/core/section-contracts");
const ThemeRegistry = require("../js/core/theme-registry");
const {
    DEFAULT_TEMPLATE_SLUG,
    TEMPLATE_ACTIONS,
    TEMPLATES,
    defineCatalogMetadata,
    getTemplate,
    hasTemplate,
    listCatalogTemplates,
    listTemplates,
    resolveTemplate
} = require("../js/core/template-registry");

const expectedSlugs = ["boda-vertical", "cumple-clasico", "boda-civil-esencial"];
assert.deepStrictEqual(listTemplates().map((template) => template.slug), expectedSlugs);
assert.strictEqual(hasTemplate("boda-vertical"), true);
assert.strictEqual(hasTemplate(" template-desconocido "), false);
assert.strictEqual(getTemplate("boda-vertical"), TEMPLATES["boda-vertical"]);
assert.strictEqual(getTemplate("template-desconocido"), undefined);

const civil = resolveTemplate("boda-civil-esencial");
assert.strictEqual(civil.slug, "boda-civil-esencial");
assert.strictEqual(civil.layout, "vertical");
assert.strictEqual(civil.defaultTheme, "romantico");
assert.strictEqual(civil.stylesheet, "/css/templates/boda-civil-esencial.css");
assert.deepStrictEqual(civil.supportedEventTypes, ["wedding", "wedding-civil"]);
assert.deepStrictEqual(civil.supportedSections, ["hero", "event-info", "location", "rsvp", "closing", "countdown", "media-closing"]);
assert.deepStrictEqual(civil.requiredSections, ["hero"]);
assert.deepStrictEqual(civil.supportedModules, ["music", "rsvp", "branding"]);
assert.deepStrictEqual(civil.supportedActions, ["maps", "calendar"]);

const wedding = resolveTemplate("boda-vertical");
assert.strictEqual(wedding.slug, "boda-vertical");
assert.strictEqual(wedding.layout, "vertical");

const birthday = resolveTemplate("cumple-clasico");
assert.strictEqual(birthday.layout, "paged");

const fallback = resolveTemplate("template-desconocido");
assert.strictEqual(fallback.slug, DEFAULT_TEMPLATE_SLUG);
assert.strictEqual(fallback.layout, "vertical");

const expectedMetadata = {
    "boda-vertical": { name: "Boda vertical", category: "wedding", eventTypes: ["wedding", "wedding-civil", "other"] },
    "cumple-clasico": { name: "Cumple clasico", category: "birthday", eventTypes: ["birthday"] },
    "boda-civil-esencial": { name: "Boda civil esencial", category: "wedding", eventTypes: ["wedding", "wedding-civil"] }
};

const technicalFields = [
    "slug",
    "name",
    "category",
    "layout",
    "className",
    "stylesheet",
    "defaultTheme",
    "supportedEventTypes",
    "supportedSections",
    "requiredSections",
    "supportedModules",
    "supportedActions",
    "status"
];

Object.values(TEMPLATES).forEach((template) => {
    technicalFields.forEach((field) => {
        assert(Object.prototype.hasOwnProperty.call(template, field), `${template.slug} no contiene ${field}`);
    });
    assert(Object.prototype.hasOwnProperty.call(template, "catalog"));
    assert.strictEqual(template.name, expectedMetadata[template.slug].name);
    assert.strictEqual(template.category, expectedMetadata[template.slug].category);
    assert.strictEqual(template.status, "active");
    assert.deepStrictEqual(template.supportedEventTypes, expectedMetadata[template.slug].eventTypes);
    assert(template.supportedSections.includes("countdown"));
    assert(template.requiredSections.every((type) => template.supportedSections.includes(type)));
    assert(!template.supportedModules.includes("countdown"));
    assert(template.supportedEventTypes.every((type) => EventSchema.V2_EVENT_TYPES.includes(type)));
    assert(template.supportedSections.every((type) => SectionContracts.has(type)));
    assert(template.supportedModules.every((slug) => ModuleRegistry.has(slug)));
    assert(template.supportedActions.every((action) => TEMPLATE_ACTIONS.includes(action)));
    assert(template.defaultTheme === null || ThemeRegistry.has(template.defaultTheme));
    assert(!template.supportedModules.includes("maps"));
    assert(!template.supportedModules.includes("calendar"));
    assert.strictEqual(Object.isFrozen(template), true);
    assert.strictEqual(Object.isFrozen(template.supportedEventTypes), true);
    assert.strictEqual(Object.isFrozen(template.supportedSections), true);
    assert.strictEqual(Object.isFrozen(template.requiredSections), true);
    assert.strictEqual(Object.isFrozen(template.supportedModules), true);
    assert.strictEqual(Object.isFrozen(template.supportedActions), true);
});

assert.strictEqual(Object.isFrozen(TEMPLATES), true);
assert.throws(() => { civil.name = "Mutado"; }, TypeError);
assert.throws(() => { civil.supportedSections.push("inventada"); }, TypeError);
assert.throws(() => { civil.requiredSections.length = 0; }, TypeError);
assert.throws(() => { civil.supportedModules[0] = "inventado"; }, TypeError);
assert.throws(() => { civil.supportedActions.pop(); }, TypeError);
assert.strictEqual(getTemplate("boda-civil-esencial").name, "Boda civil esencial");
const listed = listTemplates();
listed.pop();
assert.strictEqual(listTemplates().length, 3);

assert.strictEqual(typeof listCatalogTemplates, "function");
assert.deepStrictEqual(listCatalogTemplates().map((template) => template.slug), ["boda-vertical"]);
assert.deepStrictEqual(wedding.catalog, {
    description: "Invitación de boda elegante en formato vertical, con ubicación, cuenta regresiva y una experiencia visual adaptable a dispositivos móviles.",
    thumbnail: {
        src: "/assets/templates/boda-vertical/thumbnail.webp",
        alt: "Vista previa de la plantilla Boda vertical"
    },
    preview: {
        eventId: "ycor-template-demo-boda-vertical"
    }
});
assert.strictEqual(Object.isFrozen(wedding.catalog), true);
assert.strictEqual(Object.isFrozen(wedding.catalog.thumbnail), true);
assert.strictEqual(Object.isFrozen(wedding.catalog.preview), true);
assert.throws(() => { wedding.catalog.preview.eventId = "mutado"; }, TypeError);
assert.deepStrictEqual(getTemplate("boda-vertical").catalog.preview, {
    eventId: "ycor-template-demo-boda-vertical"
});
assert.strictEqual(birthday.catalog, null);
assert.strictEqual(civil.catalog, null);
const catalogListed = listCatalogTemplates();
catalogListed.push({ slug: "template-ajeno" });
assert.deepStrictEqual(listCatalogTemplates().map((template) => template.slug), ["boda-vertical"]);
assert.strictEqual(listTemplates().length, 3);

const catalogWithoutPreview = defineCatalogMetadata({
    description: "Plantilla demo",
    thumbnail: {
        src: "/assets/templates/demo/thumbnail.webp",
        alt: "Vista previa de plantilla demo"
    },
    preview: null
});
assert.strictEqual(Object.isFrozen(catalogWithoutPreview), true);
assert.strictEqual(Object.isFrozen(catalogWithoutPreview.thumbnail), true);
assert.throws(() => { catalogWithoutPreview.description = "Mutada"; }, TypeError);
assert.throws(() => { catalogWithoutPreview.thumbnail.src = "/otro.webp"; }, TypeError);

const catalogWithPreview = defineCatalogMetadata({
    description: "Plantilla demo",
    thumbnail: {
        src: "/assets/templates/demo/thumbnail.webp",
        alt: "Vista previa de plantilla demo"
    },
    preview: {
        eventId: "ycor-template-demo-demo"
    }
});
assert.strictEqual(Object.isFrozen(catalogWithPreview.preview), true);
assert.throws(() => { catalogWithPreview.preview.eventId = "mutado"; }, TypeError);

const validCatalogBase = {
    description: "Plantilla demo",
    thumbnail: {
        src: "/assets/templates/demo/thumbnail.webp",
        alt: "Vista previa de plantilla demo"
    },
    preview: null
};
[
    { ...validCatalogBase, description: "" },
    { ...validCatalogBase, thumbnail: undefined },
    { ...validCatalogBase, thumbnail: { ...validCatalogBase.thumbnail, src: "" } },
    { ...validCatalogBase, thumbnail: { ...validCatalogBase.thumbnail, src: "https://example.test/demo.webp" } },
    { ...validCatalogBase, thumbnail: { ...validCatalogBase.thumbnail, alt: "" } },
    { ...validCatalogBase, preview: {} },
    { ...validCatalogBase, preview: { eventId: "" } }
].forEach((catalog) => {
    assert.throws(() => defineCatalogMetadata(catalog), TypeError);
});

console.log("template-registry test passed");
