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

function response(status, payload, headers = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => headers[name] ?? null },
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

    const mutationCalls = [];
    const mutationClient = createAdminEditorialClient({
        fetchImpl: async (url, options) => {
            mutationCalls.push({ url, options });
            return response(200, url.endsWith("/publish")
                ? { eventId: EVENT_ID, publishedVersionId: VERSION_ID }
                : { eventId: EVENT_ID, versionId: VERSION_ID, workflowStatus: "in_review" });
        }
    });
    await mutationClient.transitionWorkflow({
        eventId: EVENT_ID,
        versionId: VERSION_ID,
        expectedStatus: "draft",
        targetStatus: "in_review",
        password: SECRET
    });
    await mutationClient.publishVersion({ eventId: EVENT_ID, versionId: VERSION_ID, password: SECRET });
    assert.deepStrictEqual(mutationCalls, [{
        url: `/api/admin/eventos/${EVENT_ID}/versions/${VERSION_ID}/workflow`,
        options: {
            method: "POST",
            headers: {
                Accept: "application/json",
                "X-Admin-Password": SECRET,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ expectedStatus: "draft", targetStatus: "in_review" })
        }
    }, {
        url: `/api/admin/eventos/${EVENT_ID}/versions/${VERSION_ID}/publish`,
        options: {
            method: "POST",
            headers: { Accept: "application/json", "X-Admin-Password": SECRET }
        }
    }]);
    assert(mutationCalls.every((call) => !call.url.startsWith("/api/eventos")));

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

    for (const [status, remoteCode, retryAfter] of [
        [409, "VERSION_CONFLICT"],
        [422, "INVALID_EVENT"],
        [429, "RATE_LIMITED", "17"],
        [503, "RATE_LIMIT_UNAVAILABLE"]
    ]) {
        const failingClient = createAdminEditorialClient({
            fetchImpl: async () => response(status, { error: { code: remoteCode } }, { "Retry-After": retryAfter })
        });
        await assert.rejects(
            failingClient.publishVersion({ eventId: EVENT_ID, versionId: VERSION_ID, password: SECRET }),
            (error) => error.code === remoteCode
                && error.status === status
                && (status !== 429 || error.retryAfter === "17")
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
