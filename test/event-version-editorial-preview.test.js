const assert = require("assert");
const { createEventVersionEditorialHttp } = require("../js/core/event-version-editorial-http");
const { createAdminOriginPolicy } = require("../js/core/admin-origin-policy");

const password = "secret";
const eventId = "event-one";
const versionId = "11111111-1111-4111-8111-111111111111";
const calls = [];
const readRepository = {
    async listEvents(options) {
        calls.push(["listEvents", options]);
        return { events: [{ eventId, eventStatus: "active", currentWorkingVersionId: versionId, publishedVersionId: null, workingVersion: null, publishedVersion: null }], nextCursor: null };
    },
    async getEditorialState(id) {
        calls.push(["getEditorialState", id]);
        return { eventId: id, eventStatus: "active", currentWorkingVersionId: versionId, publishedVersionId: null, versions: [{ versionId }] };
    },
    async getVersion(id, version) {
        calls.push(["getVersion", id, version]);
        return { eventId: id, versionId: version, content: { private: true } };
    }
};
const http = createEventVersionEditorialHttp({
    service: {},
    readRepository,
    adminPassword: password,
    originPolicy: createAdminOriginPolicy("http://localhost:3000"),
    issuePreviewToken: () => ({ token: "signed-token", expiresAt: "2030-01-01T00:00:00.000Z" })
});
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
async function invoke(handler, options = {}) {
    const res = response();
    const headers = {};
    if (Object.prototype.hasOwnProperty.call(options, "password")) headers["x-admin-password"] = options.password;
    else headers["x-admin-password"] = password;
    headers.origin = "http://localhost:3000";
    await handler({ headers, params: options.params || {}, query: options.query || {} }, res);
    return res;
}
(async () => {
    const unauthorizedList = await invoke(http.listEvents, { password: "wrong" });
    assert.strictEqual(unauthorizedList.statusCode, 401);
    const missingPreview = await invoke(http.requestPreview, { password: undefined, params: { eventId, versionId } });
    assert.strictEqual(missingPreview.statusCode, 401);
    const list = await invoke(http.listEvents, { query: { limit: "10" } });
    assert.strictEqual(list.statusCode, 200);
    assert.strictEqual(list.body.events[0].eventId, eventId);
    const preview = await invoke(http.requestPreview, { params: { eventId, versionId } });
    assert.strictEqual(preview.statusCode, 200);
    assert.strictEqual(preview.body.previewUrl, "/api/preview?token=signed-token");
    assert.deepStrictEqual(calls.slice(-2), [["getEditorialState", eventId], ["getVersion", eventId, versionId]]);
    console.log("event version editorial preview tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
