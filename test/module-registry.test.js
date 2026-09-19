const assert = require("assert");
const ModuleRegistry = require("../js/core/module-registry");

assert.deepStrictEqual(ModuleRegistry.list().map((module) => module.slug), ["music", "rsvp", "branding"]);
["music", "rsvp", "branding"].forEach((slug) => {
    assert.strictEqual(ModuleRegistry.has(slug), true);
    assert.strictEqual(ModuleRegistry.get(slug).slug, slug);
    assert(Array.isArray(ModuleRegistry.get(slug).configKeys));
});
assert(ModuleRegistry.get("music").configKeys.includes("tracks"));
assert(ModuleRegistry.get("rsvp").configKeys.includes("contacts"));
assert(ModuleRegistry.get("branding").configKeys.includes("whatsapp"));
assert.strictEqual(ModuleRegistry.has("countdown"), false);
assert.strictEqual(ModuleRegistry.has("maps"), false);
assert.strictEqual(ModuleRegistry.has("calendar"), false);
assert.strictEqual(ModuleRegistry.get("unknown"), undefined);
assert.strictEqual(Object.isFrozen(ModuleRegistry.MODULES), true);
assert.strictEqual(Object.isFrozen(ModuleRegistry.get("music").configKeys), true);

const listed = ModuleRegistry.list();
listed.length = 0;
assert.strictEqual(ModuleRegistry.list().length, 3);

console.log("module-registry test passed");
