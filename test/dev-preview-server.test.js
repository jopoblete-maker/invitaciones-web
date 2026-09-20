const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
    createPreviewRequestHandler,
    handleRequest,
    validateDraftContent
} = require("../scripts/dev-preview-server");

function previewRequest(url, handler = handleRequest) {
    return new Promise((resolve) => {
        const response = {
            statusCode: 200,
            headers: {},
            writeHead(statusCode, headers = {}) {
                this.statusCode = statusCode;
                this.headers = headers;
            },
            end(content = "") {
                resolve({
                    statusCode: this.statusCode,
                    headers: this.headers,
                    body: String(content)
                });
            }
        };
        handler({ url, method: "GET", headers: {} }, response);
    });
}

(async () => {
    const response = await previewRequest("/__dev-drafts/demo-event-v2.event.json");
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.headers["Content-Type"], "application/json; charset=utf-8");
    const draft = JSON.parse(response.body);
    assert.strictEqual(draft.schema_version, 2);
    assert.strictEqual(draft.identity.title, "YCOR Demo V2");

    const invalidV2 = JSON.parse(JSON.stringify(draft));
    delete invalidV2.modules.rsvp;
    const invalidResult = validateDraftContent(JSON.stringify(invalidV2));
    assert.strictEqual(invalidResult.valid, false);
    assert.strictEqual(invalidResult.status, 422);
    assert.strictEqual(invalidResult.body.error, "El draft no es valido para preview.");
    assert(invalidResult.body.validationErrors.some((error) => error.includes("modules.rsvp")));

    const invalidJson = validateDraftContent("{");
    assert.strictEqual(invalidJson.valid, false);
    assert.strictEqual(invalidJson.status, 400);
    assert(invalidJson.body.validationErrors.length > 0);

    const v1Path = path.resolve(__dirname, "..", ".dev", "drafts", "kaly-joha-boda-civil.event.json");
    const v1Result = validateDraftContent(fs.readFileSync(v1Path, "utf8"));
    assert.strictEqual(v1Result.valid, true);
    assert.strictEqual(v1Result.body.schema_version, 1);

    const legacyResult = validateDraftContent(JSON.stringify({
        id: "legacy-preview",
        nombre: "Legacy Preview"
    }));
    assert.strictEqual(legacyResult.valid, true);
    assert.strictEqual(legacyResult.body.schema_version, undefined);

    const hiddenFile = await previewRequest("/.env");
    assert.strictEqual(hiddenFile.statusCode, 404);

    const privateHandler = createPreviewRequestHandler({
        apiBaseUrl: "https://backend.example.test",
        adminPassword: "server-only-test-secret",
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                eventId: "mock-event",
                versionId: "11111111-1111-4111-8111-111111111111",
                content: { id: "mock-event", nombre: "Persisted Preview" }
            })
        })
    });
    const privatePreview = await previewRequest(
        "/api/preview/eventos/mock-event/versions/11111111-1111-4111-8111-111111111111",
        privateHandler
    );
    assert.strictEqual(privatePreview.statusCode, 200);
    assert.strictEqual(privatePreview.headers["Cache-Control"], "no-store");
    assert.strictEqual(JSON.parse(privatePreview.body).nombre, "Persisted Preview");
    assert(!privatePreview.body.includes("server-only-test-secret"));

    const dataSourceScript = fs.readFileSync(
        path.resolve(__dirname, "..", "js", "core", "invitation-data-source.js"),
        "utf8"
    );
    assert(dataSourceScript.includes('"demo-event-v2"'));

    console.log("dev preview validation test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
