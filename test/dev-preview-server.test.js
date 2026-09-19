const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { handleRequest, validateDraftContent } = require("../scripts/dev-preview-server");

function previewRequest(url) {
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
        handleRequest({ url, headers: {} }, response);
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

    const invitationScript = fs.readFileSync(path.resolve(__dirname, "..", "js", "invitacion.js"), "utf8");
    assert(invitationScript.includes('"demo-event-v2"'));

    console.log("dev preview validation test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
