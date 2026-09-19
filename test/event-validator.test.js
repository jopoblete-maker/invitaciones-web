const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { validateNewEvent } = require("../js/core/event-validator");
const { TEMPLATES } = require("../js/core/template-registry");

const validEvent = {
    schema_version: 1,
    event: {},
    template: { slug: "boda-civil-esencial" },
    theme: {},
    music: {},
    location: {},
    rsvp: {},
    branding: {},
    sections: [
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "rsvp", type: "rsvp", enabled: false, order: 20, data: {} }
    ]
};

assert.deepStrictEqual(validateNewEvent(validEvent), { valid: true, errors: [] });

Object.keys(TEMPLATES).forEach((slug) => {
    const registeredTemplate = validateNewEvent({
        ...validEvent,
        template: { slug }
    });
    assert.strictEqual(registeredTemplate.valid, true);
});

const unknownTemplate = validateNewEvent({
    ...validEvent,
    template: { slug: "template-inexistente" }
});
assert.strictEqual(unknownTemplate.valid, false);
assert(unknownTemplate.errors.some((error) => error.includes("template.slug")));

const emptyTemplateSlug = validateNewEvent({
    ...validEvent,
    template: { slug: "   " }
});
assert.deepStrictEqual(emptyTemplateSlug.errors, ["template.slug es obligatorio."]);

const invalidSchema = validateNewEvent({ ...validEvent, schema_version: 999 });
assert.strictEqual(invalidSchema.valid, false);
assert(invalidSchema.errors.some((error) => error.includes("schema_version")));

const missingSections = validateNewEvent({ ...validEvent, sections: undefined });
assert.strictEqual(missingSections.valid, false);
assert(missingSections.errors.some((error) => error.includes("sections")));

const duplicateSection = validateNewEvent({
    ...validEvent,
    sections: [
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "hero", type: "location", enabled: true, order: 20, data: {} }
    ]
});
assert.strictEqual(duplicateSection.valid, false);
assert(duplicateSection.errors.some((error) => error.includes("duplicado")));

const invalidOrder = validateNewEvent({
    ...validEvent,
    sections: [
        { id: "hero", type: "hero", enabled: true, order: "abc", data: {} }
    ]
});
assert.strictEqual(invalidOrder.valid, false);
assert(invalidOrder.errors.some((error) => error.includes("order")));

const incompleteOptional = validateNewEvent({
    ...validEvent,
    music: {},
    location: {},
    rsvp: {},
    branding: {}
});
assert.strictEqual(incompleteOptional.valid, true);

const draftPath = path.resolve(__dirname, "..", ".dev", "drafts", "kaly-joha-boda-civil.event.json");
const kalyDraft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
assert.strictEqual(validateNewEvent(kalyDraft).valid, true);

console.log("event-validator test passed");
