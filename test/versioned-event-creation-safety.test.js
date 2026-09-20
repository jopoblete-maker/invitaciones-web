const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createEventVersioningService } = require("../js/core/event-versioning");
const {
    createMemoryEventVersionRepository
} = require("../js/core/event-version-repository-memory");
const { createPublicEventResolver } = require("../js/core/public-event-resolver");
const { createPrivatePreviewBridge } = require("../scripts/private-preview-bridge");

const EVENT_ID = "new-versioned-event";
const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const content = {
    schema_version: 1,
    event: {},
    template: { slug: "boda-civil-esencial" },
    sections: [
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
    ]
};

function callBridge(bridge, pathname) {
    return new Promise((resolve) => {
        const response = {
            statusCode: 200,
            headers: {},
            writeHead(statusCode, headers) {
                this.statusCode = statusCode;
                this.headers = headers;
            },
            end(body = "") {
                resolve({ statusCode: this.statusCode, body: String(body) });
            }
        };
        bridge.handle({ method: "GET", socket: { remoteAddress: "127.0.0.1" } }, response, pathname);
    });
}

(async () => {
    const repository = createMemoryEventVersionRepository();
    const service = createEventVersioningService(repository, {
        now: () => "2026-09-19T00:00:00.000Z",
        createVersionId: () => VERSION_ID
    });
    const before = JSON.stringify(content);
    const created = service.createEvent({ id: EVENT_ID, content });
    assert.strictEqual(created.event.event_status, "active");
    assert.strictEqual(created.event.published_version_id, null);
    assert.strictEqual(created.event.current_working_version_id, VERSION_ID);
    assert.strictEqual(created.version.version_number, 1);
    assert.strictEqual(created.version.workflow_status, "draft");
    assert.strictEqual(created.version.source_version_id, null);
    assert.strictEqual(created.version.published_at, null);
    assert.strictEqual(JSON.stringify(content), before);

    const publicResolver = createPublicEventResolver({
        async getEvent(id) {
            const event = repository.getEvent(id);
            return event ? { ...event, datos: content } : null;
        },
        async getVersion(id) {
            return repository.getVersion(id);
        }
    });
    await assert.rejects(
        publicResolver.resolvePublicEvent(EVENT_ID),
        (error) => error.code === "PUBLIC_EVENT_NOT_FOUND"
    );

    const previewBridge = createPrivatePreviewBridge({
        apiBaseUrl: "https://backend.example.test",
        adminPassword: "server-only-secret",
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            async json() {
                const version = repository.getVersion(VERSION_ID);
                return {
                    eventId: EVENT_ID,
                    versionId: VERSION_ID,
                    content: version.content
                };
            }
        })
    });
    const preview = await callBridge(
        previewBridge,
        `/api/preview/eventos/${EVENT_ID}/versions/${VERSION_ID}`
    );
    assert.strictEqual(preview.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(preview.body), content);

    const sql = fs.readFileSync(path.resolve(
        __dirname,
        "..",
        "docs",
        "sql",
        "phase-3f",
        "03-create-versioned-event.sql"
    ), "utf8");
    for (const contract of [
        "CREATE OR REPLACE FUNCTION public.create_versioned_event",
        "VALUES (p_event_id, p_content, NULL, NULL, 'active')",
        "1,",
        "'draft'",
        "REVOKE ALL ON FUNCTION public.create_versioned_event(text, jsonb) FROM PUBLIC",
        "GRANT EXECUTE ON FUNCTION public.create_versioned_event(text, jsonb)"
    ]) {
        assert(sql.includes(contract), `Missing SQL contract: ${contract}`);
    }

    console.log("versioned event creation safety tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
