const assert = require("assert");
const { createRsvpRpcAdapter } = require("../backend/rsvp/rpc-adapter");
const { toHttpError } = require("../backend/rsvp/errors");
const eventId = "synthetic-event";
const invitationId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const tokenHash = Buffer.alloc(32, 171);
const serialized = "\\x" + "ab".repeat(32);
const date = "2027-06-12T21:30:00Z";
const base = { eventId, invitationId, expectedRevision: 3 };
const e = { p_event_id: eventId };
const i = { ...e, p_invitation_id: invitationId, p_expected_revision: 3 };
const mutate = (action, extra = {}) => ({ ...i, p_action: action, p_status: null, p_attendee_count: null, p_new_token_hash: null, ...extra });
const mutationResult = { revision: 4, changed: true };
const publicResult = { displayName: "Synthetic", type: "group", maxAttendees: 2, revision: 3, timezone: "UTC", deadlineAt: date, closed: false, response: { status: "attending", attendeeCount: 2 } };
const configuration = { eventId, eventStatus: "active", configured: false, revision: 0, timezone: null, eventAt: null, deadlineAt: null, purgeDueAt: null, purged: false };
const cases = [
    ["configure", { eventId, timezone: "UTC", eventAt: date, deadlineAt: date, expectedRevision: 0 }, "rsvp_configure", { ...e, p_timezone: "UTC", p_event_at: date, p_deadline_at: date, p_expected_revision: 0 }, 1, true],
    ["createInvitation", { eventId, requestId, displayName: "Synthetic", invitationType: "group", maxAttendees: 2, tokenHash }, "rsvp_create_invitation", { ...e, p_request_id: requestId, p_display_name: "Synthetic", p_invitation_type: "group", p_max_attendees: 2, p_token_hash: serialized }, { invitationId, revision: 1, created: true }, true],
    ["publicRead", { eventId, tokenHash }, "rsvp_public_read", { ...e, p_token_hash: serialized }, publicResult, false],
    ["publicRespond", { eventId, tokenHash, expectedRevision: 3, status: "attending", attendeeCount: 2 }, "rsvp_public_respond", { ...e, p_token_hash: serialized, p_expected_revision: 3, p_status: "attending", p_attendee_count: 2 }, { revision: 4, status: "attending", attendeeCount: 2 }, true],
    ["correctResponse", { ...base, status: "not_attending", attendeeCount: 0 }, "rsvp_admin_mutate", mutate("CORRECT", { p_status: "not_attending", p_attendee_count: 0 }), mutationResult, true],
    ["rotate", { ...base, tokenHash }, "rsvp_admin_mutate", mutate("ROTATE", { p_new_token_hash: serialized }), mutationResult, true],
    ["revoke", base, "rsvp_admin_mutate", mutate("REVOKE"), { revision: 3, changed: false, revoked: true }, true],
    ["deleteInvitation", base, "rsvp_admin_mutate", mutate("DELETE"), { deleted: true }, true],
    ["correctCapacity", { ...base, invitationType: "individual", maxAttendees: 1 }, "rsvp_admin_correct_capacity", { ...i, p_invitation_type: "individual", p_max_attendees: 1 }, { ...mutationResult, type: "individual", maxAttendees: 1 }, true],
    ["list", { eventId }, "rsvp_admin_list", { ...e, p_after_id: null, p_limit: 50 }, [], false],
    ["purgeDue", {}, "rsvp_purge_due", { p_limit: 50 }, 0, true],
    ["aggregate", { eventId }, "rsvp_admin_aggregate", e, [], false],
    ["auditList", { eventId }, "rsvp_admin_audit_list", { ...e, p_limit: 50 }, [], false],
    ["correctName", { ...base, displayName: "Synthetic renamed" }, "rsvp_admin_correct_name", { ...i, p_display_name: "Synthetic renamed" }, { invitationId, revision: 4, changed: true }, true],
    ["readConfiguration", { eventId }, "rsvp_admin_read_configuration", e, configuration, false]
];
let checks = 0;
let calls = [];
let data;
let sqlError;
let thrown;
const supabase = { rpc(name, parameters) { calls.push({ name, parameters }); return Promise.resolve({ data, error: sqlError }); } };
const adapter = createRsvpRpcAdapter({ supabase, execute: async (query) => { if (thrown) throw thrown; return query; } });
async function fails(fn, code) {
    await assert.rejects(async () => fn(), (error) => {
        assert.strictEqual(error.code, code);
        assert(!JSON.stringify(toHttpError(error)).includes("raw-"));
        assert(!error.cause);
        return true;
    }); checks++;
}
(async () => {
    const names = new Set();
    for (const [method, input, name, parameters, result, write] of cases) {
        calls = []; data = result; sqlError = undefined; thrown = undefined;
        assert.deepStrictEqual(await adapter[method](input), result);
        assert.deepStrictEqual(calls, [{ name, parameters }]);
        assert(!JSON.stringify(parameters).includes("plaintext-token-marker"));
        names.add(name); checks++;
        thrown = Object.assign(new Error("raw-secret-marker"), { code: "SUPABASE_TIMEOUT", details: "raw-token-marker" });
        calls = [];
        await fails(() => adapter[method](input), write ? "RSVP_WRITE_RESULT_UNKNOWN" : "UPSTREAM_TIMEOUT");
        assert.strictEqual(calls.length, 1);
    }
    assert.strictEqual(names.size, 12); checks++;
    thrown = undefined;
    const errors = {
        ADMIN_EVENT_NOT_ACTIVE: "ADMIN_EVENT_NOT_ACTIVE", PII_RETENTION_EXPIRED: "PII_RETENTION_EXPIRED",
        IDEMPOTENCY_KEY_CONSUMED: "IDEMPOTENCY_KEY_CONSUMED", ADMIN_INVITATION_NOT_FOUND: "ADMIN_INVITATION_NOT_FOUND",
        MANAGED_CONFIG_NOT_FOUND: "MANAGED_CONFIG_NOT_FOUND", ADMIN_EVENT_NOT_FOUND: "ADMIN_EVENT_NOT_FOUND",
        CAPACITY_BELOW_CURRENT_ATTENDANCE: "CAPACITY_BELOW_CURRENT_ATTENDANCE", REVISION_CONFLICT: "RSVP_REVISION_CONFLICT",
        INVALID_IANA_TIMEZONE: "RSVP_CALENDAR_INVALID", INVALID_REQUEST_ID: "RSVP_INVALID_PAYLOAD"
    };
    for (const [message, code] of Object.entries(errors)) {
        sqlError = { code: "P0001", message, details: "raw-hash-marker", hint: "raw-query-marker" };
        await fails(() => adapter.readConfiguration({ eventId }), code);
    }
    for (const message of ["RSVP_NOT_AVAILABLE", "RSVP_DEADLINE_CLOSED", "RSVP_EVENT_ARCHIVED", "RSVP_ATTENDEE_LIMIT", "REVISION_CONFLICT", "RSVP_INVALID_PAYLOAD"]) {
        sqlError = { code: "P0001", message };
        const expected = ({ RSVP_ATTENDEE_LIMIT: "RSVP_ATTENDEE_COUNT_INVALID", REVISION_CONFLICT: "RSVP_REVISION_CONFLICT" })[message] || message;
        await fails(() => adapter.publicRespond(cases[3][1]), expected);
    }
    for (const error of [{ code: "P0001", message: "unknown raw-secret-marker" }, { code: "XX000", message: "RSVP_NOT_AVAILABLE" },
        { code: "P0001", message: "raw-message-marker", details: "RSVP_NOT_AVAILABLE" }, { code: "P0001", message: " RSVP_NOT_AVAILABLE " },
        { code: "P0001", message: "ADMIN_INVITATION_NOT_FOUND" }]) {
        sqlError = error;
        await fails(() => adapter.publicRead({ eventId, tokenHash }), "RSVP_INTERNAL_ERROR");
    }
    sqlError = undefined;
    for (const hash of [Buffer.alloc(31), Buffer.alloc(33), "plaintext-token-marker"]) {
        calls = [];
        await fails(() => adapter.publicRead({ eventId, tokenHash: hash }), "RSVP_INVALID_PAYLOAD");
        assert.strictEqual(calls.length, 0);
    }
    for (const input of [{ eventId, limit: 0 }, { eventId, limit: 201 }, { eventId, afterId: "bad" }]) await fails(() => adapter.list(input), "RSVP_INVALID_PAYLOAD");
    for (const invalid of [null, {}, { ...configuration, revision: Number.MAX_SAFE_INTEGER + 1 }]) {
        data = invalid; await fails(() => adapter.readConfiguration({ eventId }), "RSVP_INTERNAL_ERROR");
    }
    data = { ...publicResult, token: "plaintext-token-marker", hash: "raw-hash-marker", response: { ...publicResult.response, secret: "raw-secret-marker" } };
    assert.deepStrictEqual(await adapter.publicRead({ eventId, tokenHash }), publicResult); checks++;
    data = { revision: 4, changed: false };
    assert.deepStrictEqual(await adapter.correctCapacity(cases[8][1]), data); checks++;
    data = [];
    await adapter.list({ eventId, afterId: invitationId, limit: 200 });
    assert.deepStrictEqual(calls.at(-1).parameters, { ...e, p_after_id: invitationId, p_limit: 200 }); checks++;
    const row = { invitation_id: invitationId, display_name: "Synthetic", invitation_type: "group", max_attendees: 2,
        revoked: false, revision: 4, response_status: "attending", attendee_count: 2 };
    data = [{ ...row, token_hash: "raw-hash-marker" }];
    assert.deepStrictEqual(await adapter.list({ eventId }), [row]); checks++;
    data = [{ ...row, response_status: null, attendee_count: null }];
    assert.strictEqual((await adapter.list({ eventId }))[0].response_status, null); checks++;
    data = [{ ...row, attendee_count: 3 }]; await fails(() => adapter.list({ eventId }), "RSVP_INTERNAL_ERROR");
    const aggregate = { event_id: eventId, invitation_count: 2, attending_count: 1, not_attending_count: 0,
        unanswered_count: 1, attendee_count: 2, materialized_at: date };
    data = [aggregate]; assert.deepStrictEqual(await adapter.aggregate({ eventId }), [aggregate]); checks++;
    const audit = { audit_id: invitationId, occurred_at: date, action: "CORRECT_NAME", actor_class: "authenticated_admin" };
    data = [audit]; assert.deepStrictEqual(await adapter.auditList({ eventId }), [audit]); checks++;
    const configured = { ...configuration, configured: true, revision: 7, timezone: "UTC", eventAt: date, deadlineAt: date, purgeDueAt: date, purged: true };
    data = configured; assert.deepStrictEqual(await adapter.readConfiguration({ eventId }), configured); checks++;
    for (const invalid of [{ ...configured, revision: 0 }, { ...configuration, purged: true }, { ...configuration, eventId: "wrong-event" }]) {
        data = invalid; await fails(() => adapter.readConfiguration({ eventId }), "RSVP_INTERNAL_ERROR");
    }
    data = { ...publicResult, response: { status: "not_attending", attendeeCount: 1 } };
    await fails(() => adapter.publicRead({ eventId, tokenHash }), "RSVP_INTERNAL_ERROR");
    let remoteCommitted = false;
    let remoteCalls = 0;
    const lateAdapter = createRsvpRpcAdapter({
        supabase: { rpc() { remoteCalls++; return new Promise((resolve) => setTimeout(() => { remoteCommitted = true; resolve({ data: 1 }); }, 20)); } },
        execute: (query) => Promise.race([query, new Promise((_, reject) => setTimeout(() => reject({ code: "SUPABASE_TIMEOUT" }), 2))])
    });
    await fails(() => lateAdapter.configure(cases[0][1]), "RSVP_WRITE_RESULT_UNKNOWN");
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert(remoteCommitted && remoteCalls === 1); checks++;
    console.log(`rsvp-rpc-adapter: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
