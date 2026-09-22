const assert = require("assert");
const { createEventVersionReadRepository } = require("../js/core/event-version-read-repository-supabase");

const rows = [
    { id: "event-a", event_status: "active", updated_at: "2027-01-01T00:00:00.000Z", current_working_version_id: null, published_version_id: null },
    { id: "event-b", event_status: "active", updated_at: "2027-01-01T00:00:00.000Z", current_working_version_id: null, published_version_id: null },
    { id: "event-c", event_status: "archived", updated_at: "2027-01-01T00:00:00.000Z", current_working_version_id: null, published_version_id: null },
    { id: "event-d", event_status: "active", updated_at: "2026-12-31T00:00:00.000Z", current_working_version_id: null, published_version_id: null }
];
function client() {
    return {
        from(table) {
            const query = { table, start: 0, end: 50, cursor: null };
            const builder = {
                select() { return this; },
                order() { return this; },
                or(value) { query.cursor = value; return this; },
                range(start, end) { query.start = start; query.end = end; return this; },
                eq() { return this; },
                then(resolve, reject) {
                    if (table === "eventos") {
                        let result = rows.slice();
                        if (query.cursor) {
                            const match = query.cursor.match(/updated_at\.lt\.([^,]+),and\(updated_at\.eq\.([^,]+),id\.gt\.([^)]+)\)/);
                            assert(match);
                            result = result.filter((row) => row.updated_at < match[1]
                                || (row.updated_at === match[2] && row.id > match[3]));
                        }
                        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
                    }
                    return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                }
            };
            return builder;
        }
    };
}
(async () => {
    const repository = createEventVersionReadRepository(client(), { cursorSecret: "cursor-secret" });
    const first = await repository.listEvents({ limit: 2 });
    assert.deepStrictEqual(first.events.map((event) => event.eventId), ["event-a", "event-b"]);
    assert(first.nextCursor);
    const second = await repository.listEvents({ limit: 2, cursor: first.nextCursor });
    assert.deepStrictEqual(second.events.map((event) => event.eventId), ["event-c", "event-d"]);
    assert.strictEqual(second.nextCursor, null);
    await assert.rejects(() => repository.listEvents({ cursor: "invalid" }), (error) => error.code === "INVALID_CURSOR");
    console.log("event version list pagination tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
