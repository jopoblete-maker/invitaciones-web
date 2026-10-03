const assert = require("assert");
const { createRsvpContext } = require("../backend/rsvp/context");
const eventId = "synthetic-event";
const versionId = "11111111-1111-4111-8111-111111111111";
function content() {
    return { schema_version: 2, id: eventId, event_type: "wedding-civil", plan: "esencial", status: "approved",
        template: { slug: "boda-civil-esencial" }, identity: { title: "Synthetic" },
        schedule: { date: "2027-06-12", time: "18:30", timezone: "America/Buenos_Aires" },
        sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: {} }],
        modules: { rsvp: { enabled: true, mode: "managed", deadline: { date: "2027-06-01", time: "23:59" } } }, media: { items: {} } };
}
let state;
let version;
let failure;
const calls = [];
const context = createRsvpContext({ readRepository: {
    async getEditorialState(id) { calls.push(["state", id]); if (failure) throw failure; return state; },
    async getVersion(id, published) { calls.push(["version", id, published]); return version; }
} });
function reset() {
    calls.length = 0; failure = undefined;
    state = { eventId, eventStatus: "active", publishedVersionId: versionId, revision: 999, datos: content() };
    version = { eventId, versionId, content: content() };
}
let checks = 0;
async function kind(expected) { assert.strictEqual((await context.read(eventId)).kind, expected); checks++; }
async function fails(code) { await assert.rejects(() => context.read(eventId), (error) => error.code === code && !error.cause); checks++; }
(async () => {
    reset(); const result = await context.read(eventId);
    assert.deepStrictEqual(result, { eventId, eventStatus: "active", publishedVersionId: versionId, kind: "managed", mode: "managed",
        timezone: "America/Buenos_Aires", eventAt: "2027-06-12T21:30:00Z", deadlineAt: "2027-06-02T02:59:00Z" }); checks++;
    assert.deepStrictEqual(calls, [["state", eventId], ["version", eventId, versionId]]); checks++;
    assert(!("purgeDueAt" in result) && !("datos" in result) && !("content" in result)); checks++;
    reset(); state = null; await fails("ADMIN_EVENT_NOT_FOUND");
    for (const [code, expected] of [["EVENT_NOT_FOUND", "ADMIN_EVENT_NOT_FOUND"], ["VERSION_NOT_FOUND", "MANAGED_PUBLICATION_REQUIRED"],
        ["VERSION_EVENT_MISMATCH", "MANAGED_PUBLICATION_REQUIRED"], ["SUPABASE_TIMEOUT", "UPSTREAM_TIMEOUT"], ["raw-secret-marker", "RSVP_INTERNAL_ERROR"]]) {
        reset(); failure = { code, message: "raw-secret-marker" }; await fails(expected);
    }
    reset(); state.publishedVersionId = null; await kind("unpublished"); assert.strictEqual(calls.length, 1); checks++;
    reset(); Object.defineProperty(state, "datos", { get() { throw new Error("Legacy fallback must never be read"); } }); await kind("managed");
    reset(); version.content = { schema_version: 1, rsvp: { mode: "managed" } }; await kind("non-v2");
    reset(); version = null; await kind("invalid-publication");
    reset(); version.eventId = "wrong-event"; await kind("invalid-publication");
    reset(); version.versionId = "other-version"; await kind("invalid-publication");
    reset(); version.content.id = "wrong-event"; await kind("invalid-publication");
    reset(); delete version.content.modules.rsvp; await kind("rsvp-absent");
    for (const mode of [undefined, "whatsapp"]) {
        reset(); version.content.modules.rsvp = { enabled: true, deadline: "historic text" };
        if (mode !== undefined) version.content.modules.rsvp.mode = mode;
        await kind("whatsapp");
    }
    reset(); version.content.modules.rsvp.mode = "invalid"; await kind("invalid-publication");
    for (const enabled of [false, undefined]) { reset(); version.content.modules.rsvp.enabled = enabled; await kind("disabled"); }
    reset(); state.eventStatus = "archived"; assert.strictEqual((await context.read(eventId)).eventStatus, "archived"); checks++;
    for (const [date, time] of [["2018-03-11", "02:30"], ["2018-11-04", "01:30"]]) {
        reset(); version.content.schedule = { date, time, timezone: "America/New_York" }; await fails("RSVP_CALENDAR_INVALID");
        reset(); version.content.schedule.timezone = "America/New_York"; version.content.modules.rsvp.deadline = { date, time }; await fails("RSVP_CALENDAR_INVALID");
    }
    reset(); delete version.content.schedule.timezone; await fails("RSVP_CALENDAR_INVALID");
    const previous = process.env.TZ;
    try {
        for (const zone of ["UTC", "Asia/Tokyo"]) {
            process.env.TZ = zone; reset(); assert.deepStrictEqual(await context.read(eventId), result); checks++;
        }
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
    console.log(`rsvp-context: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
