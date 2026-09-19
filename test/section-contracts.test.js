const assert = require("assert");
const SectionContracts = require("../js/core/section-contracts");

const expectedTypes = [
    "hero",
    "event-info",
    "location",
    "rsvp",
    "closing",
    "countdown",
    "media-closing"
];

assert.deepStrictEqual(SectionContracts.list().map((contract) => contract.type), expectedTypes);
expectedTypes.forEach((type) => {
    assert.strictEqual(SectionContracts.has(type), true);
    assert.strictEqual(SectionContracts.get(type).type, type);
    assert(Array.isArray(SectionContracts.get(type).allowedDataKeys));
    assert(Array.isArray(SectionContracts.get(type).allowedConfigKeys));
});
assert.strictEqual(SectionContracts.has("gallery"), false);
assert.strictEqual(SectionContracts.get("gallery"), undefined);
assert(SectionContracts.get("countdown").allowedDataKeys.includes("targetDateTime"));
assert(SectionContracts.get("hero").allowedConfigKeys.includes("showCopy"));
assert.strictEqual(Object.isFrozen(SectionContracts.SECTION_CONTRACTS), true);
assert.strictEqual(Object.isFrozen(SectionContracts.get("hero")), true);

const listed = SectionContracts.list();
listed.pop();
assert.strictEqual(SectionContracts.list().length, expectedTypes.length);

console.log("section-contracts test passed");
