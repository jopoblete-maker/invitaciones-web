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
assert.strictEqual(ThemeRegistry.DEFAULT_THEME_SLUG, "fiesta");
assert.strictEqual(ThemeRegistry.hasTheme("fiesta"), true);
assert.strictEqual(ThemeRegistry.getTheme("fiesta").status, "active");
assert.strictEqual(ThemeRegistry.listThemes().length, expectedSlugs.length);
assert.strictEqual(ThemeRegistry.resolveTheme("theme-inexistente"), ThemeRegistry.getTheme("fiesta"));
assert.strictEqual(ThemeRegistry.resolveTheme("theme-inexistente", { fallback: false }), undefined);
assert.strictEqual(ThemeRegistry.resolveTheme("minimal"), ThemeRegistry.getTheme("minimalista"));
assert.strictEqual(ThemeRegistry.resolveTheme("infantil").status, "legacy");
assert.strictEqual(ThemeRegistry.hasTheme("minimal"), false);
assert.strictEqual(ThemeRegistry.hasTheme("infantil"), false);
assert.strictEqual(new Set(expectedSlugs).size, expectedSlugs.length);
assert(Object.keys(ThemeRegistry.LEGACY_ALIASES).every((slug) => !ThemeRegistry.hasTheme(slug)));
ThemeRegistry.listThemes().forEach((theme) => {
    assert.strictEqual(theme.status, "active");
    assert.deepStrictEqual(Object.keys(theme.tokens), ThemeRegistry.RUNTIME_TOKEN_KEYS);
    assert.strictEqual(Object.isFrozen(theme), true);
    assert.strictEqual(Object.isFrozen(theme.tokens), true);
});
assert.strictEqual(Object.isFrozen(ThemeRegistry.THEMES), true);
assert.strictEqual(Object.isFrozen(ThemeRegistry.RUNTIME_TOKEN_KEYS), true);

const listed = ThemeRegistry.list();
listed.shift();
assert.strictEqual(ThemeRegistry.list().length, expectedSlugs.length);

console.log("theme-registry test passed");
