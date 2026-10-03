const assert = require("assert");
const { RsvpError, toHttpError, DEFINITIONS } = require("../backend/rsvp/errors");
const statuses = {
    RSVP_NOT_AVAILABLE: 404, RSVP_DEADLINE_CLOSED: 409, RSVP_REVISION_CONFLICT: 409,
    RSVP_EVENT_ARCHIVED: 409, RSVP_ATTENDEE_COUNT_INVALID: 422, RSVP_CALENDAR_INVALID: 422,
    RSVP_RATE_LIMITED: 429, RSVP_RATE_LIMIT_UNAVAILABLE: 503, RSVP_WRITE_RESULT_UNKNOWN: 504,
    RSVP_INTERNAL_ERROR: 500, RSVP_INVALID_PAYLOAD: 400,
    UPSTREAM_TIMEOUT: 504, ADMIN_EVENT_NOT_ACTIVE: 409, PII_RETENTION_EXPIRED: 410,
    IDEMPOTENCY_KEY_CONSUMED: 409, ADMIN_INVITATION_NOT_FOUND: 404,
    MANAGED_CONFIG_NOT_FOUND: 409, ADMIN_EVENT_NOT_FOUND: 404, CAPACITY_BELOW_CURRENT_ATTENDANCE: 409,
    MANAGED_PUBLICATION_REQUIRED: 409, MANAGED_NOT_ENABLED: 409
};
const httpCodes = {
    RSVP_CALENDAR_INVALID: "INVALID_MANAGED_CALENDAR"
};
let checks = 0;
for (const [code, status] of Object.entries(statuses)) {
    const error = new RsvpError(code);
    assert.strictEqual(error.code, code);
    assert.strictEqual(toHttpError(error).status, status);
    assert.strictEqual(toHttpError(error).body.error.code, httpCodes[code] || code);
    error.message = "raw-secret-marker";
    error.details = "raw-details-marker";
    error.hint = "raw-hint-marker";
    error.cause = new Error("raw-cause-marker");
    error.stack = "raw-stack-marker";
    error.detail = "raw-detail-marker";
    error.query = "raw-query-marker";
    error.token = "raw-token-marker";
    error.tokenHash = "raw-hash-marker";
    error.Authorization = "raw-authorization-marker";
    error.displayName = "raw-pii-marker";
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
assert.strictEqual(toHttpError(new RsvpError("RSVP_REVISION_CONFLICT")).body.error.code, "RSVP_REVISION_CONFLICT"); checks++;
const readTimeout = toHttpError(new RsvpError("UPSTREAM_TIMEOUT"));
const writeTimeout = toHttpError(new RsvpError("RSVP_WRITE_RESULT_UNKNOWN"));
assert.strictEqual(readTimeout.status, 504);
assert.strictEqual(writeTimeout.status, 504);
assert.notDeepStrictEqual(readTimeout.body, writeTimeout.body); checks++;
const publicUnavailable = toHttpError(new RsvpError("RSVP_NOT_AVAILABLE"));
const adminMissing = toHttpError(new RsvpError("ADMIN_INVITATION_NOT_FOUND"));
assert.strictEqual(publicUnavailable.status, 404);
assert.strictEqual(adminMissing.status, 404);
assert.strictEqual(publicUnavailable.body.error.code, "RSVP_NOT_AVAILABLE");
assert.strictEqual(adminMissing.body.error.code, "ADMIN_INVITATION_NOT_FOUND"); checks++;
for (const condition of ["missing", "revoked", "rotated", "deleted", "wrong-event"]) {
    const error = new RsvpError("RSVP_NOT_AVAILABLE");
    error.details = condition;
    assert.deepStrictEqual(toHttpError(error), publicUnavailable);
    checks++;
}
for (const code of ["unknown", "RSVP_UNKNOWN", "raw-secret-marker", "toString", "__proto__"]) {
    const error = new RsvpError(code);
    assert.strictEqual(error.code, "RSVP_INTERNAL_ERROR");
    assert.deepStrictEqual(toHttpError(error), { status: 500, body: { error: { code: "RSVP_INTERNAL_ERROR", message: "Ocurrió un error interno." } } });
    checks++;
}
assert.deepStrictEqual(Object.keys(DEFINITIONS).sort(), Object.keys(statuses).sort()); checks++;
console.log(`rsvp-errors: ${checks} checks passed`);
