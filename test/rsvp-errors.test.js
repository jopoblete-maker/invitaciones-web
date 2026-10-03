const assert = require("assert");
const { RsvpError, toHttpError, DEFINITIONS } = require("../backend/rsvp/errors");
const statuses = {
    RSVP_NOT_AVAILABLE: 404, RSVP_DEADLINE_CLOSED: 409, RSVP_REVISION_CONFLICT: 409,
    RSVP_EVENT_ARCHIVED: 409, RSVP_ATTENDEE_COUNT_INVALID: 422, RSVP_CALENDAR_INVALID: 422,
    RSVP_RATE_LIMITED: 429, RSVP_RATE_LIMIT_UNAVAILABLE: 503, RSVP_WRITE_RESULT_UNKNOWN: 504,
    RSVP_INTERNAL_ERROR: 500, RSVP_INVALID_PAYLOAD: 400
};
let checks = 0;
for (const [code, status] of Object.entries(statuses)) {
    const error = new RsvpError(code);
    assert.strictEqual(error.code, code);
    assert.strictEqual(toHttpError(error).status, status);
    error.message = "raw-secret-marker";
    error.details = "raw-details-marker";
    error.hint = "raw-hint-marker";
    error.cause = new Error("raw-cause-marker");
    error.stack = "raw-stack-marker";
    assert(!JSON.stringify(toHttpError(error)).includes("raw-"));
    checks++;
}
for (const raw of [new Error("raw-password-marker"), { code: "RSVP_NOT_AVAILABLE", message: "raw-token-marker" }, null, "raw-error"]) {
    assert.strictEqual(toHttpError(raw).status, 500);
    assert(!JSON.stringify(toHttpError(raw)).includes("raw-"));
    checks++;
}
assert.strictEqual(new RsvpError("unknown").code, "RSVP_INTERNAL_ERROR"); checks++;
assert(Object.isFrozen(DEFINITIONS) && Object.values(DEFINITIONS).every(Object.isFrozen)); checks++;
assert.strictEqual(toHttpError(new RsvpError("RSVP_REVISION_CONFLICT")).body.error.code, "REVISION_CONFLICT"); checks++;
console.log(`rsvp-errors: ${checks} checks passed`);
