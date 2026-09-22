const assert = require("assert");
const { signPreviewToken, verifyPreviewToken } = require("../js/core/private-preview-token");

const options = {
    eventId: "event-one",
    versionId: "11111111-1111-4111-8111-111111111111",
    secret: "preview-secret",
    now: 1700000000000,
    ttlSeconds: 300,
    nonce: "nonce-one"
};
const token = signPreviewToken(options);
const valid = verifyPreviewToken(token, { secret: options.secret, now: options.now });
assert.strictEqual(valid.ok, true);
assert.deepStrictEqual(valid.payload, {
    eventId: options.eventId,
    versionId: options.versionId,
    purpose: "preview",
    expiresAt: 1700000300,
    nonce: options.nonce
});
assert.strictEqual(verifyPreviewToken(token, { secret: "wrong", now: options.now }).code, "INVALID_TOKEN");
assert.strictEqual(verifyPreviewToken(token, { secret: options.secret, now: 1700000300000 }).code, "TOKEN_EXPIRED");
const [encoded] = token.split(".");
const wrongPurpose = Buffer.from(JSON.stringify({ eventId: options.eventId, versionId: options.versionId, purpose: "other", expiresAt: 1700000300, nonce: options.nonce })).toString("base64url");
assert.strictEqual(verifyPreviewToken(`${wrongPurpose}.${token.split(".")[1]}`, { secret: options.secret, now: options.now }).code, "INVALID_TOKEN");
assert(encoded);
console.log("private preview token tests passed");
