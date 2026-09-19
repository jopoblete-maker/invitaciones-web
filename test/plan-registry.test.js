const assert = require("assert");
const PlanRegistry = require("../js/core/plan-registry");

assert.deepStrictEqual(PlanRegistry.list().map((plan) => plan.slug), [
    "esencial",
    "premium",
    "experiencia-ia"
]);

PlanRegistry.list().forEach((plan) => {
    assert.strictEqual(plan.allowedSections, null);
    assert.strictEqual(plan.allowedModules, null);
    assert.strictEqual(plan.mediaLimits.status, "pending");
    assert.strictEqual(plan.mediaLimits.maxItems, null);
    assert.strictEqual(plan.mediaLimits.maxBytes, null);
    assert.strictEqual(plan.brandingRules.status, "pending");
    assert.strictEqual(plan.aiCapabilities.status, "pending");
    assert.deepStrictEqual(plan.aiCapabilities.allowed, []);
    assert.strictEqual(Object.isFrozen(plan), true);
});

assert.strictEqual(PlanRegistry.has("esencial"), true);
assert.strictEqual(PlanRegistry.has("unknown"), false);
assert.strictEqual(PlanRegistry.get("unknown"), undefined);
assert.strictEqual(Object.isFrozen(PlanRegistry.PLANS), true);

const listed = PlanRegistry.list();
listed.push({ slug: "inventado" });
assert.strictEqual(PlanRegistry.list().length, 3);

console.log("plan-registry test passed");
