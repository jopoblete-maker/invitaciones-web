const assert = require("assert");
const { DEFAULT_TEMPLATE_SLUG, resolveTemplate } = require("../js/core/template-registry");

const civil = resolveTemplate("boda-civil-esencial");
assert.strictEqual(civil.slug, "boda-civil-esencial");
assert.strictEqual(civil.layout, "vertical");
assert.strictEqual(civil.defaultTheme, "romantico");
assert.strictEqual(civil.stylesheet, "/css/templates/boda-civil-esencial.css");

const legacy = resolveTemplate("boda-vertical");
assert.strictEqual(legacy.slug, "boda-vertical");
assert.strictEqual(legacy.layout, "paged");

const fallback = resolveTemplate("template-desconocido");
assert.strictEqual(fallback.slug, DEFAULT_TEMPLATE_SLUG);
assert.strictEqual(fallback.layout, "paged");

console.log("template-registry test passed");
