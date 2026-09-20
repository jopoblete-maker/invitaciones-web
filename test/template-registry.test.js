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
    getTemplate,
    hasTemplate,
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

const legacy = resolveTemplate("boda-vertical");
assert.strictEqual(legacy.slug, "boda-vertical");
assert.strictEqual(legacy.layout, "paged");

const fallback = resolveTemplate("template-desconocido");
assert.strictEqual(fallback.slug, DEFAULT_TEMPLATE_SLUG);
assert.strictEqual(fallback.layout, "paged");

const expectedMetadata = {
    "boda-vertical": { name: "Boda vertical", category: "wedding", eventTypes: ["wedding", "wedding-civil", "other"] },
    "cumple-clasico": { name: "Cumple clasico", category: "birthday", eventTypes: ["birthday"] },
    "boda-civil-esencial": { name: "Boda civil esencial", category: "wedding", eventTypes: ["wedding", "wedding-civil"] }
};

Object.values(TEMPLATES).forEach((template) => {
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

console.log("template-registry test passed");
