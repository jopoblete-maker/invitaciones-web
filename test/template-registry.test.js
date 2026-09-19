const assert = require("assert");
const { DEFAULT_TEMPLATE_SLUG, TEMPLATES, resolveTemplate } = require("../js/core/template-registry");

const civil = resolveTemplate("boda-civil-esencial");
assert.strictEqual(civil.slug, "boda-civil-esencial");
assert.strictEqual(civil.layout, "vertical");
assert.strictEqual(civil.defaultTheme, "romantico");
assert.strictEqual(civil.stylesheet, "/css/templates/boda-civil-esencial.css");
assert.deepStrictEqual(civil.supportedSections, ["hero", "event-info", "location", "rsvp", "closing", "countdown", "media-closing"]);
assert.deepStrictEqual(civil.supportedModules, ["music", "rsvp", "branding"]);
assert.deepStrictEqual(civil.supportedActions, ["maps", "calendar"]);

const legacy = resolveTemplate("boda-vertical");
assert.strictEqual(legacy.slug, "boda-vertical");
assert.strictEqual(legacy.layout, "paged");

const fallback = resolveTemplate("template-desconocido");
assert.strictEqual(fallback.slug, DEFAULT_TEMPLATE_SLUG);
assert.strictEqual(fallback.layout, "paged");

Object.values(TEMPLATES).forEach((template) => {
    assert(template.supportedSections.includes("countdown"));
    assert(!template.supportedModules.includes("countdown"));
    assert(template.supportedActions.includes("maps"));
    assert(template.supportedActions.includes("calendar"));
    assert(!template.supportedModules.includes("maps"));
    assert(!template.supportedModules.includes("calendar"));
});

console.log("template-registry test passed");
