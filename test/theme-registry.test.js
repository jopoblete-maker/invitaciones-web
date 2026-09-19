const assert = require("assert");
const ThemeRegistry = require("../js/core/theme-registry");

const expectedSlugs = [
    "elegante",
    "frozen",
    "pesca",
    "minimalista",
    "fiesta",
    "vintage",
    "dorado-premium",
    "tropical",
    "botanico",
    "infantil-pastel",
    "mistico",
    "urbano",
    "infantil-dinamico",
    "romantico",
    "corporativo"
];

assert.deepStrictEqual(ThemeRegistry.list().map((theme) => theme.slug), expectedSlugs);
assert.strictEqual(ThemeRegistry.has("botanico"), true);
assert.strictEqual(ThemeRegistry.has("romantico"), true);
assert.strictEqual(ThemeRegistry.has("theme-inexistente"), false);
assert.strictEqual(ThemeRegistry.get("theme-inexistente"), undefined);
assert(ThemeRegistry.get("botanico").tokenKeys.includes("primary"));
assert(ThemeRegistry.get("botanico").tokenKeys.includes("background"));
assert.strictEqual(Object.isFrozen(ThemeRegistry.THEMES), true);
assert.strictEqual(Object.isFrozen(ThemeRegistry.RUNTIME_TOKEN_KEYS), true);

const listed = ThemeRegistry.list();
listed.shift();
assert.strictEqual(ThemeRegistry.list().length, expectedSlugs.length);

console.log("theme-registry test passed");
