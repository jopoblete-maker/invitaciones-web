const assert = require("assert");
const {
    EditorialApiError,
    createEventEditorialApiClient,
    normalizeBaseUrl
} = require("../scripts/event-editorial-api-client");

const SECRET = "editorial-secret-value";
const VERSION_ID = "11111111-1111-4111-8111-111111111111";

function response(status, payload) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() { return payload; }
    };
}

assert.strictEqual(normalizeBaseUrl("https://example.test///"), "https://example.test");
assert.throws(() => normalizeBaseUrl("file:///tmp/api"), /http o https/);
assert.throws(() => createEventEditorialApiClient({
    baseUrl: "https://example.test",
    adminPassword: ""
}), (error) => error instanceof EditorialApiError && error.code === "CONFIG_ERROR");

(async () => {
    const calls = [];
    const client = createEventEditorialApiClient({
        baseUrl: "https://example.test/",
        adminPassword: SECRET,
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            if (url.endsWith("/api/admin/eventos")) {
                return response(201, {
                    eventId: "new-event",
                    versionId: VERSION_ID,
                    versionNumber: 1,
                    workflowStatus: "draft"
                });
            }
            if (options.method === "POST") {
                return response(201, { versionId: VERSION_ID, versionNumber: 3 });
            }
            return response(200, {
                eventId: "existing-event",
                eventStatus: "active",
                publishedVersionId: null,
                currentWorkingVersionId: null,
                versions: []
            });
        }
    });

    const state = await client.getEditorialState("existing-event");
    assert.strictEqual(state.currentWorkingVersionId, null);
    const snapshot = { schema_version: 2, status: "active", nested: { keep: true } };
    const snapshotBefore = JSON.stringify(snapshot);
    const created = await client.createVersion("existing-event", {
        content: snapshot,
        expectedWorkingVersionId: null,
        sourceVersionId: null
    });
    assert.deepStrictEqual(created, { versionId: VERSION_ID, versionNumber: 3 });
    assert.strictEqual(calls[0].url, "https://example.test/api/admin/eventos/existing-event");
    assert.strictEqual(calls[0].options.method, undefined);
    assert.strictEqual(calls[0].options.headers["X-Admin-Password"], SECRET);
    assert.strictEqual(
        calls[1].url,
        "https://example.test/api/admin/eventos/existing-event/versions"
    );
    assert.strictEqual(calls[1].options.method, "POST");
    assert.strictEqual(calls[1].options.headers["X-Admin-Password"], SECRET);
    assert.strictEqual(calls[1].options.body.includes(SECRET), false);
    assert.deepStrictEqual(JSON.parse(calls[1].options.body), {
        content: snapshot,
        expectedWorkingVersionId: null,
        sourceVersionId: null
    });
    assert.strictEqual(JSON.stringify(snapshot), snapshotBefore);

    const createdEvent = await client.createEvent("new-event", snapshot);
    assert.deepStrictEqual(createdEvent, {
        eventId: "new-event",
        versionId: VERSION_ID,
        versionNumber: 1,
        workflowStatus: "draft"
    });
    assert.strictEqual(calls[2].url, "https://example.test/api/admin/eventos");
    assert.strictEqual(calls[2].options.headers["X-Admin-Password"], SECRET);
    assert.deepStrictEqual(JSON.parse(calls[2].options.body), {
        eventId: "new-event",
        content: snapshot
    });
    assert.strictEqual(calls[2].options.body.includes(SECRET), false);

    const cases = [
        [401, "UNAUTHORIZED", "Credencial administrativa invalida."],
        [404, "EVENT_NOT_FOUND", "Evento inexistente."],
        [409, "VERSION_CONFLICT", "Conflicto de version: la version de trabajo cambio."],
        [422, "INVALID_EVENT", "El evento no es valido."],
        [500, "BACKEND_ERROR", "Error interno del backend."]
    ];
    for (const [status, code, message] of cases) {
        const failingClient = createEventEditorialApiClient({
            baseUrl: "https://example.test",
            adminPassword: SECRET,
            fetchImpl: async () => response(status, {
                error: { code, message: `remote ${SECRET}` }
            })
        });
        await assert.rejects(
            failingClient.getEditorialState("existing-event"),
            (error) => error.code === code
                && error.status === status
                && error.message === message
                && !JSON.stringify(error).includes(SECRET)
                && !error.message.includes(SECRET)
        );
    }

    const archivedClient = createEventEditorialApiClient({
        baseUrl: "https://example.test",
        adminPassword: SECRET,
        fetchImpl: async () => response(409, { error: { code: "EVENT_ARCHIVED" } })
    });
    await assert.rejects(
        archivedClient.getEditorialState("existing-event"),
        (error) => error.code === "EVENT_ARCHIVED" && error.status === 409
    );

    const duplicateClient = createEventEditorialApiClient({
        baseUrl: "https://example.test",
        adminPassword: SECRET,
        fetchImpl: async () => response(409, {
            error: { code: "EVENT_ALREADY_EXISTS", message: `remote ${SECRET}` }
        })
    });
    await assert.rejects(
        duplicateClient.createEvent("new-event", snapshot),
        (error) => error.code === "EVENT_ALREADY_EXISTS"
            && error.status === 409
            && !error.message.includes(SECRET)
    );

    const networkClient = createEventEditorialApiClient({
        baseUrl: "https://example.test",
        adminPassword: SECRET,
        fetchImpl: async () => { throw new Error(`socket ${SECRET}`); }
    });
    await assert.rejects(
        networkClient.getEditorialState("existing-event"),
        (error) => error.code === "NETWORK_ERROR"
            && !error.message.includes(SECRET)
            && !JSON.stringify(error).includes(SECRET)
    );

    console.log("event-editorial-api-client tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
