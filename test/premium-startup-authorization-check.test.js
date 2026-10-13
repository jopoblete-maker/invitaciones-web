"use strict";

const assert = require("node:assert/strict");
const { checkPremiumStartupAuthorization } = require("../backend/premium/startup-authorization-check");
const { createAuthorizationProvider } = require("../backend/premium/authorization-provider");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");

const reference = {
    schema_version: 2, id: "synthetic-startup", event_type: "wedding", plan: "premium",
    status: "draft", template: { slug: "boda-fiesta-premium" },
    identity: { title: "Synthetic startup reference" }, schedule: { date: "2026-12-05" },
    modules: {}, media: { items: {} }, sections: [
        { id: "hero", type: "hero", enabled: true, order: 1, data: {} },
        { id: "gift", type: "gifts", enabled: true, order: 2,
            data: { title: "Synthetic gift", message: "Synthetic message", cbu: "0".repeat(22) } }
    ]
};
const configuration = { entries: [{ revision: 1, manifest: {
    eventId: reference.id, templateSlug: reference.template.slug,
    canonicalDigest: canonicalContentDigest(reference), status: "approved", media: {},
    gifts: { gift: { ...reference.sections[1].data } }
} }] };
const provider = createAuthorizationProvider(configuration);
const referenceText = JSON.stringify(reference);
const options = { enabled: "true", referenceText, getAuthorizationState: () => ({ provider, revision: 1 }) };
const before = JSON.stringify({ reference, configuration });
assert.equal(checkPremiumStartupAuthorization(options), "PASS");
assert.equal(checkPremiumStartupAuthorization(options), "PASS");
assert.equal(JSON.stringify({ reference, configuration }), before);
let calls = 0;
for (const enabled of [undefined, "", "false"]) {
    assert.equal(checkPremiumStartupAuthorization({ enabled, referenceText,
        getAuthorizationState: () => { calls++; throw new Error(); } }), "DISABLED");
}
assert.equal(calls, 0);
for (const enabled of ["TRUE", "1", "invalid", true]) {
    assert.equal(checkPremiumStartupAuthorization({ ...options, enabled }), "FAIL");
}
for (const text of [undefined, "", "not-json", "null", "{}", JSON.stringify(configuration),
    '"' + "x".repeat(12 * 1024 * 1024) + '"',
    JSON.stringify({ ...reference, id: "another-event" }),
    JSON.stringify({ ...reference, identity: { title: "Unapproved change" } }),
    JSON.stringify({ ...reference, template: { slug: "boda-vertical" } }),
    JSON.stringify({ ...reference, metadata: { demo: false } }),
    JSON.stringify({ ...reference, metadata: { purpose: "local-only-preview" } })]) {
    assert.equal(checkPremiumStartupAuthorization({ ...options, referenceText: text }), "FAIL");
}
assert.equal(checkPremiumStartupAuthorization({ ...options, getAuthorizationState: undefined }), "FAIL");
assert.equal(checkPremiumStartupAuthorization({ ...options, getAuthorizationState: () => null }), "FAIL");
assert.equal(checkPremiumStartupAuthorization({ ...options,
    getAuthorizationState: () => { throw new Error("Synthetic private details"); } }), "FAIL");
const revoked = structuredClone(configuration);
revoked.entries.push({ revision: 2, manifest: { ...revoked.entries[0].manifest, status: "revoked" } });
const revokedProvider = createAuthorizationProvider(revoked);
assert.equal(checkPremiumStartupAuthorization({ ...options,
    getAuthorizationState: () => ({ provider: revokedProvider, revision: 2 }) }), "FAIL");
assert.equal(checkPremiumStartupAuthorization({ ...options,
    getAuthorizationState: () => ({ provider, revision: 2 }) }), "FAIL");
console.log("premium startup authorization check tests passed");
