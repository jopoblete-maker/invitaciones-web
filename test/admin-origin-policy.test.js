const assert = require("assert");
const { createAdminOriginPolicy, normalizeOrigin } = require("../js/core/admin-origin-policy");

assert.strictEqual(normalizeOrigin(" HTTPS://EXAMPLE.COM/ "), "https://example.com");
assert.strictEqual(normalizeOrigin("https://example.com/path"), null);
assert.strictEqual(normalizeOrigin("*"), null);

const policy = createAdminOriginPolicy(
    "https://invitaciones-web-nl0b.onrender.com, http://localhost:3000"
);
const request = (headers) => ({ headers });

assert.deepStrictEqual(policy.validateRequest(request({
    origin: "https://INVITACIONES-WEB-NL0B.ONRENDER.COM/"
})), { ok: true, origin: "https://invitaciones-web-nl0b.onrender.com" });
assert.deepStrictEqual(policy.validateRequest(request({
    referer: "http://localhost:3000/admin.html?x=1"
})), { ok: true, origin: "http://localhost:3000" });
assert.strictEqual(policy.validateRequest(request({ origin: "https://invitaciones-web-nl0b.onrender.com.evil.example" })).ok, false);
assert.strictEqual(policy.validateRequest(request({ origin: "https://evil.example" })).ok, false);
assert.strictEqual(policy.validateRequest(request({})).ok, false);
assert.strictEqual(policy.validateRequest(request({ referer: "not-a-url" })).ok, false);

assert.strictEqual(createAdminOriginPolicy(undefined).validateRequest(request({ origin: "http://localhost:3000" })).ok, false);
assert.strictEqual(createAdminOriginPolicy("*").validateRequest(request({ origin: "http://localhost:3000" })).ok, false);

console.log("admin-origin-policy tests passed");
