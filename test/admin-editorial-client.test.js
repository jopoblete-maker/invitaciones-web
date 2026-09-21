"use strict";

const assert = require("assert");
const {
    AdminEditorialApiError,
    createAdminEditorialClient,
    normalizeEditorialState
} = require("../js/core/admin-editorial-client");

const SECRET = "admin-secret-for-test";
const EVENT_ID = "ycor-template-demo-boda-vertical";
const VERSION_ID = "ba9e2d4a-ad0a-4df7-a144-27bd98dc2800";

function response(status, payload) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload
    };
}

const state = {
    eventId: EVENT_ID,
    eventStatus: "active",
    currentWorkingVersionId: null,
    publishedVersionId: VERSION_ID,
    versions: [{
        versionId: VERSION_ID,
        versionNumber: 1,
        workflowStatus: "approved",
        createdAt: "2030-01-01T00:00:00.000Z",
        publishedAt: "2030-01-02T00:00:00.000Z",
        sourceVersionId: null
    }]
};

assert.deepStrictEqual(normalizeEditorialState(state), state);
assert.throws(
    () => normalizeEditorialState({ eventId: EVENT_ID }),
    (error) => error instanceof AdminEditorialApiError && error.code === "INVALID_RESPONSE"
);

(async () => {
    const calls = [];
    const client = createAdminEditorialClient({
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            return response(200, state);
        }
    });

    assert.deepStrictEqual(await client.getEditorialState({ eventId: EVENT_ID, password: SECRET }), state);
    assert.deepStrictEqual(calls, [{
        url: `/api/admin/eventos/${EVENT_ID}`,
        options: {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-Admin-Password": SECRET
            }
        }
    }]);
    assert.strictEqual(calls[0].options.body, undefined);

    for (const [status, code, message] of [
        [401, "UNAUTHORIZED", "Credencial administrativa invalida."],
        [403, "FORBIDDEN", "Acceso administrativo rechazado."],
        [500, "SERVER_ERROR", "Error del servidor administrativo."]
    ]) {
        const failingClient = createAdminEditorialClient({
            fetchImpl: async () => response(status, { error: { message: SECRET } })
        });
        await assert.rejects(
            failingClient.getEditorialState({ eventId: EVENT_ID, password: SECRET }),
            (error) => error.code === code
                && error.status === status
                && error.message === message
                && !error.message.includes(SECRET)
        );
    }

    const networkClient = createAdminEditorialClient({ fetchImpl: async () => { throw new Error(SECRET); } });
    await assert.rejects(
        networkClient.getEditorialState({ eventId: EVENT_ID, password: SECRET }),
        (error) => error.code === "NETWORK_ERROR" && !error.message.includes(SECRET)
    );

    console.log("admin-editorial-client test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
