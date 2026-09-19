const assert = require("assert");
const {
    createEventVersionReadRepository
} = require("../js/core/event-version-read-repository-supabase");

const VERSION_ID = "11111111-1111-4111-8111-111111111111";

function createClient({ event = null, versions = [], version = null } = {}) {
    const queries = [];
    return {
        queries,
        from(table) {
            const query = { table, columns: null, filters: [], order: null };
            queries.push(query);
            const builder = {
                select(columns) {
                    query.columns = columns;
                    return this;
                },
                eq(column, value) {
                    query.filters.push([column, value]);
                    return this;
                },
                order(column, options) {
                    query.order = [column, options];
                    return this;
                },
                maybeSingle() {
                    const data = table === "eventos" ? event : version;
                    return Promise.resolve({ data, error: null });
                },
                then(resolve, reject) {
                    return Promise.resolve({ data: versions, error: null }).then(resolve, reject);
                }
            };
            return builder;
        }
    };
}

async function expectCode(code, action) {
    await assert.rejects(action, (error) => error.code === code, `Expected ${code}`);
}

(async () => {
    const client = createClient({
        event: {
            id: "event-one",
            event_status: "active",
            published_version_id: VERSION_ID,
            current_working_version_id: null
        },
        versions: [{
            id: VERSION_ID,
            version_number: 1,
            workflow_status: "approved",
            created_at: "2027-01-01T00:00:00Z",
            published_at: "2027-01-02T00:00:00Z",
            source_version_id: null,
            content: { mustNotAppear: true }
        }],
        version: {
            id: VERSION_ID,
            event_id: "event-one",
            version_number: 1,
            workflow_status: "approved",
            created_at: "2027-01-01T00:00:00Z",
            published_at: "2027-01-02T00:00:00Z",
            source_version_id: null,
            content: { private: true }
        }
    });
    const repository = createEventVersionReadRepository(client);
    const state = await repository.getEditorialState("event-one");
    assert.deepStrictEqual(state, {
        eventId: "event-one",
        eventStatus: "active",
        publishedVersionId: VERSION_ID,
        currentWorkingVersionId: null,
        versions: [{
            versionId: VERSION_ID,
            versionNumber: 1,
            workflowStatus: "approved",
            createdAt: "2027-01-01T00:00:00Z",
            publishedAt: "2027-01-02T00:00:00Z",
            sourceVersionId: null
        }]
    });
    assert.strictEqual(Object.hasOwn(state.versions[0], "content"), false);
    assert(!client.queries[1].columns.includes("content"));
    assert.deepStrictEqual(client.queries[1].order, ["version_number", { ascending: true }]);

    const privateVersion = await repository.getVersion("event-one", VERSION_ID);
    assert.deepStrictEqual(privateVersion.content, { private: true });
    assert.strictEqual(privateVersion.eventId, "event-one");
    assert.strictEqual(privateVersion.versionId, VERSION_ID);

    await expectCode("EVENT_NOT_FOUND", () => createEventVersionReadRepository(
        createClient()
    ).getEditorialState("missing"));
    await expectCode("VERSION_NOT_FOUND", () => createEventVersionReadRepository(
        createClient()
    ).getVersion("event-one", VERSION_ID));
    await expectCode("VERSION_EVENT_MISMATCH", () => createEventVersionReadRepository(
        createClient({ version: { id: VERSION_ID, event_id: "another-event" } })
    ).getVersion("event-one", VERSION_ID));

    console.log("event-version-read-repository-supabase tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
