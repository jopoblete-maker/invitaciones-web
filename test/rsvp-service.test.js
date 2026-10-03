const assert = require("assert");
const { createRsvpService } = require("../backend/rsvp/service");
const { RsvpError, toHttpError } = require("../backend/rsvp/errors");
const tokens = require("../backend/rsvp/token");
const eventId = "synthetic-event";
const invitationId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const base = { eventId, invitationId, expectedRevision: 4 };
const create = { eventId, requestId, displayName: "Synthetic", invitationType: "group", maxAttendees: 2 };
const calls = [];
let contextCalls = 0;
let generated = [];
let current;
let contextError;
let adapterError;
let created;
const results = {
    readConfiguration: { eventId, revision: 7, configured: true }, configure: 8,
    list: [], createInvitation: { invitationId, revision: 1, created: true },
    correctName: { invitationId, revision: 5, changed: true }, correctCapacity: { revision: 5, changed: true },
    correctResponse: { revision: 5, changed: true }, revoke: { revision: 5, changed: true }, rotate: { revision: 5, changed: true },
    deleteInvitation: { deleted: true }, publicRead: { revision: 4, response: null }, publicRespond: { revision: 5, status: "attending", attendeeCount: 2 },
    aggregate: [], auditList: []
};
const adapter = Object.fromEntries(Object.keys(results).map((name) => [name, async (options) => {
    calls.push({ name, options });
    if (adapterError) throw adapterError;
    if (name === "createInvitation") return { ...results[name], created };
    return results[name];
}]));
const service = createRsvpService({ adapter,
    context: { async read() { contextCalls++; if (contextError) throw contextError; return current; } },
    token: { hashToken: tokens.hashToken, generateToken() { const result = tokens.generateToken(); generated.push(result); return result; } }
});
function reset() {
    calls.length = 0; contextCalls = 0; generated = []; contextError = undefined; adapterError = undefined; created = true;
    current = { eventId, eventStatus: "active", kind: "managed", mode: "managed", publishedVersionId: "synthetic-version",
        editorialRevision: 999, timezone: "UTC", eventAt: "2027-06-12T18:30:00Z", deadlineAt: "2027-06-01T23:59:00Z" };
}
let checks = 0;
async function fail(fn, code) {
    await assert.rejects(async () => fn(), (error) => {
        assert.strictEqual(error.code, code);
        const serialized = JSON.stringify(toHttpError(error));
        assert(!serialized.includes("Synthetic") && !serialized.includes("raw-") && !error.cause);
        for (const item of generated) assert(!serialized.includes(item.token));
        return true;
    }); checks++;
}
(async () => {
    reset(); assert.deepStrictEqual(await service.readConfiguration({ eventId }), results.readConfiguration);
    assert.strictEqual(contextCalls, 0); checks++;
    reset(); assert.deepStrictEqual(await service.syncConfiguration({ eventId }), { revision: 8, sourceVersionId: "synthetic-version" });
    assert.deepStrictEqual(calls, [{ name: "readConfiguration", options: { eventId } }, { name: "configure", options: {
        eventId, timezone: "UTC", eventAt: current.eventAt, deadlineAt: current.deadlineAt, expectedRevision: 7
    } }]); checks++;
    const regular = [
        ["list", { eventId, limit: 50 }], ["correctName", { ...base, displayName: "Synthetic" }],
        ["correctCapacity", { ...base, invitationType: "individual", maxAttendees: 1 }],
        ["correctResponse", { ...base, status: "not_attending", attendeeCount: 0 }], ["revoke", base], ["deleteInvitation", base],
        ["aggregate", { eventId }], ["auditList", { eventId, limit: 50 }]
    ];
    for (const [name, options] of regular) {
        reset(); assert.deepStrictEqual(await service[name](options), results[name]);
        assert.deepStrictEqual(calls, [{ name, options }]);
        assert(!calls.some((call) => call.name === "configure")); checks++;
    }
    reset(); const first = await service.createInvitation(create);
    assert.strictEqual(generated.length, 1); assert.strictEqual(first.token, generated[0].token);
    assert.strictEqual(calls[0].options.requestId, requestId);
    assert.deepStrictEqual(calls[0].options.tokenHash, tokens.hashToken(first.token));
    assert(!("token" in calls[0].options)); checks++;
    reset(); created = false; const replay = await service.createInvitation({ ...create, displayName: "Other synthetic payload" });
    assert.deepStrictEqual(replay, { invitationId, revision: 1, created: false });
    assert(!("token" in replay)); assert.strictEqual(calls.length, 1); checks++;
    reset(); await fail(() => service.createInvitation({ ...create, requestId: undefined }), "RSVP_INVALID_PAYLOAD");
    assert.strictEqual(generated.length, 0); assert.strictEqual(calls.length, 0); checks++;
    reset(); const rotated = await service.rotate(base);
    assert.strictEqual(generated.length, 1); assert.strictEqual(rotated.token, generated[0].token);
    assert(!("revoked" in rotated)); assert.strictEqual(calls[0].options.expectedRevision, 4);
    assert.deepStrictEqual(calls[0].options.tokenHash, tokens.hashToken(rotated.token)); checks++;
    const publicToken = tokens.generateToken().token;
    for (const name of ["publicRead", "publicRespond"]) {
        reset(); const options = { eventId, token: publicToken, expectedRevision: 4, status: "attending", attendeeCount: 2 };
        assert.deepStrictEqual(await service[name](options), results[name]);
        const { token, ...rest } = options;
        assert.deepStrictEqual(calls[0].options, { ...rest, tokenHash: tokens.hashToken(token) });
        assert(!JSON.stringify(calls).includes(publicToken)); checks++;
    }
    const blocked = [
        ["syncConfiguration", { eventId }], ["createInvitation", create], ["correctName", { ...base, displayName: "Synthetic" }],
        ["correctCapacity", { ...base, invitationType: "group", maxAttendees: 2 }],
        ["correctResponse", { ...base, status: "attending", attendeeCount: 2 }], ["revoke", base], ["rotate", base]
    ];
    for (const [name, options] of blocked) {
        reset(); current.eventStatus = "archived";
        await fail(() => service[name](options), "ADMIN_EVENT_NOT_ACTIVE");
        assert.strictEqual(calls.length, 0); assert.strictEqual(generated.length, 0);
    }
    for (const name of ["list", "deleteInvitation", "readConfiguration", "aggregate", "auditList"]) {
        reset(); current.eventStatus = "archived"; current.kind = "whatsapp";
        assert.deepStrictEqual(await service[name](base), results[name]); assert.strictEqual(contextCalls, 0); checks++;
    }
    reset(); current.eventStatus = "archived";
    assert.deepStrictEqual(await service.publicRead({ eventId, token: publicToken }), results.publicRead); checks++;
    reset(); current.eventStatus = "archived"; adapterError = new RsvpError("RSVP_EVENT_ARCHIVED");
    await fail(() => service.publicRespond({ eventId, token: publicToken, expectedRevision: 4, status: "attending", attendeeCount: 2 }), "RSVP_EVENT_ARCHIVED");
    assert.strictEqual(calls.length, 1); checks++;
    for (const condition of ["missing", "revoked", "rotated", "deleted", "wrong-event"]) {
        reset(); current.eventStatus = "archived"; adapterError = new RsvpError("RSVP_NOT_AVAILABLE"); adapterError.details = condition;
        await fail(() => service.publicRespond({ eventId, token: publicToken, expectedRevision: 4, status: "attending", attendeeCount: 2 }), "RSVP_NOT_AVAILABLE");
    }
    for (const code of ["ADMIN_EVENT_NOT_FOUND", "MANAGED_PUBLICATION_REQUIRED", "MANAGED_NOT_ENABLED", "RSVP_CALENDAR_INVALID"]) {
        reset(); contextError = new RsvpError(code);
        await fail(() => service.publicRead({ eventId, token: publicToken }), "RSVP_NOT_AVAILABLE");
        assert.strictEqual(calls.length, 0);
    }
    for (const kind of ["unpublished", "non-v2", "invalid-publication", "whatsapp", "rsvp-absent", "disabled"]) {
        reset(); current.kind = kind;
        await fail(() => service.syncConfiguration({ eventId }), ["unpublished", "non-v2", "invalid-publication"].includes(kind) ? "MANAGED_PUBLICATION_REQUIRED" : "MANAGED_NOT_ENABLED");
        await fail(() => service.publicRead({ eventId, token: publicToken }), "RSVP_NOT_AVAILABLE");
    }
    for (const [name, options] of [["createInvitation", create], ["rotate", base]]) {
        reset(); adapterError = new RsvpError("RSVP_WRITE_RESULT_UNKNOWN");
        await fail(() => service[name](options), "RSVP_WRITE_RESULT_UNKNOWN");
        assert.strictEqual(calls.length, 1); assert.strictEqual(generated.length, 1); checks++;
    }
    reset(); adapterError = new RsvpError("RSVP_REVISION_CONFLICT"); await fail(() => service.correctName({ ...base, displayName: "Synthetic" }), "RSVP_REVISION_CONFLICT");
    assert.strictEqual(calls.length, 1); assert.strictEqual(calls[0].options.expectedRevision, 4); checks++;
    reset(); adapterError = new RsvpError("PII_RETENTION_EXPIRED"); await fail(() => service.deleteInvitation(base), "PII_RETENTION_EXPIRED");
    reset(); await fail(() => service.publicRead({ eventId, token: "bad" }), "RSVP_NOT_AVAILABLE"); assert.strictEqual(contextCalls, 0); checks++;
    reset(); contextError = new RsvpError("UPSTREAM_TIMEOUT"); await fail(() => service.publicRead({ eventId, token: publicToken }), "UPSTREAM_TIMEOUT");
    console.log(`rsvp-service: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
