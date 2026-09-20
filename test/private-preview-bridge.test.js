const assert = require("assert");
const { createPrivatePreviewBridge } = require("../scripts/private-preview-bridge");

const EVENT_ID = "preview-event";
const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const PATH = `/api/preview/eventos/${EVENT_ID}/versions/${VERSION_ID}`;
const SECRET = "server-only-secret";

function callBridge(bridge, pathname = PATH, method = "GET", remoteAddress) {
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
        bridge.handle({ method, socket: remoteAddress ? { remoteAddress } : undefined }, response, pathname);
    });
}

(async () => {
    const requests = [];
    const snapshot = { schema_version: 1, event: { title: "Private" } };
    const bridge = createPrivatePreviewBridge({
        apiBaseUrl: "https://backend.example.test",
        adminPassword: SECRET,
        async fetchImpl(url, options) {
            requests.push({ url: String(url), options });
            return {
                ok: true,
                status: 200,
                async json() {
                    return { eventId: EVENT_ID, versionId: VERSION_ID, content: snapshot };
                }
            };
        }
    });
    assert.strictEqual(bridge.matches(PATH), true);
    const success = await callBridge(bridge);
    assert.strictEqual(success.statusCode, 200);
    assert.strictEqual(success.headers["Cache-Control"], "no-store");
    assert.deepStrictEqual(JSON.parse(success.body), snapshot);
    assert.strictEqual(requests[0].url,
        `https://backend.example.test/api/admin/eventos/${EVENT_ID}/versions/${VERSION_ID}`);
    assert.strictEqual(requests[0].options.method, "GET");
    assert.strictEqual(requests[0].options.headers["X-Admin-Password"], SECRET);
    assert(!success.body.includes(SECRET));
    assert(!success.body.includes("X-Admin-Password"));

    for (const status of [401, 404, 500]) {
        const failed = createPrivatePreviewBridge({
            apiBaseUrl: "https://backend.example.test",
            adminPassword: SECRET,
            fetchImpl: async () => ({ ok: false, status })
        });
        const response = await callBridge(failed);
        assert.strictEqual(response.statusCode, status);
        assert.strictEqual(response.headers["Cache-Control"], "no-store");
        assert(!response.body.includes(SECRET));
        assert(!response.body.includes("SQL"));
    }

    let configurationFetches = 0;
    const missingConfig = createPrivatePreviewBridge({
        fetchImpl: async () => { configurationFetches += 1; }
    });
    const notConfigured = await callBridge(missingConfig);
    assert.strictEqual(notConfigured.statusCode, 503);
    assert.strictEqual(configurationFetches, 0);

    const wrongOwnerResponse = createPrivatePreviewBridge({
        apiBaseUrl: "https://backend.example.test",
        adminPassword: SECRET,
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                eventId: "another-event",
                versionId: VERSION_ID,
                content: snapshot
            })
        })
    });
    assert.strictEqual((await callBridge(wrongOwnerResponse)).statusCode, 502);

    const invalidRequest = await callBridge(bridge,
        "/api/preview/eventos/INVALID!/versions/not-a-uuid");
    assert.strictEqual(invalidRequest.statusCode, 400);
    assert.strictEqual((await callBridge(bridge, PATH, "POST")).statusCode, 405);
    assert.strictEqual((await callBridge(bridge, PATH, "GET", "192.168.1.25")).statusCode, 403);

    console.log("private-preview-bridge tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
