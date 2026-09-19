const assert = require("assert");
const {
    CURRENT_SCHEMA_VERSION,
    V2_SCHEMA_VERSION,
    V2_EVENT_MODEL_KEYS,
    V2_EVENT_STATUSES,
    V2_EVENT_TYPES
} = require("../js/core/event-schema");
const { validateNewEvent } = require("../js/core/event-validator");

assert.strictEqual(CURRENT_SCHEMA_VERSION, 1);
assert.strictEqual(V2_SCHEMA_VERSION, 2);
assert.deepStrictEqual(V2_EVENT_MODEL_KEYS, [
    "schema_version",
    "id",
    "event_type",
    "plan",
    "status",
    "template",
    "identity",
    "schedule",
    "location",
    "theme",
    "sections",
    "modules",
    "media",
    "metadata"
]);
assert.deepStrictEqual(V2_EVENT_STATUSES, [
    "draft",
    "ready_for_preview",
    "in_review",
    "changes_requested",
    "approved",
    "published",
    "archived"
]);
assert.deepStrictEqual(V2_EVENT_TYPES, [
    "wedding",
    "wedding-civil",
    "birthday",
    "corporate",
    "other"
]);
assert.strictEqual(Object.isFrozen(V2_EVENT_MODEL_KEYS), true);
assert.strictEqual(Object.isFrozen(V2_EVENT_STATUSES), true);
assert.strictEqual(Object.isFrozen(V2_EVENT_TYPES), true);

const v2Validation = validateNewEvent({
    schema_version: 2,
    event: {},
    template: { slug: "boda-vertical" },
    sections: []
});
assert.strictEqual(v2Validation.valid, false);
assert(v2Validation.errors.some((error) => error.includes("schema_version no soportado")));

console.log("event-schema v2 declarations test passed");
