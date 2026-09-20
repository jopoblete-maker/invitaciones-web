const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
    buildPayload,
    environmentForMode,
    loadDraft,
    normalizeTarget,
    parseArgs,
    publishDraft,
    resolveDraftPath,
    resolveSourceVersionId,
    validatePublicId
} = require("../scripts/publish-event-draft");

const WORKING_ID = "11111111-1111-4111-8111-111111111111";
const PUBLISHED_ID = "22222222-2222-4222-8222-222222222222";
const CREATED_ID = "33333333-3333-4333-8333-333333333333";

assert.strictEqual(validatePublicId("existing-event"), true);
assert.strictEqual(validatePublicId("Existing"), false);
assert.strictEqual(validatePublicId("../event"), false);
assert.throws(() => resolveDraftPath("../event"), /draft/i);
assert(resolveDraftPath("demo-event-v2").endsWith("demo-event-v2.event.json"));
assert.strictEqual(normalizeTarget("https://example.test/"), "https://example.test");
assert.throws(() => loadDraft("publisher-file-does-not-exist"), /no encontrado/i);

const originalReadFileSyncForInvalidJson = fs.readFileSync;
fs.readFileSync = (filePath, encoding) => String(filePath).endsWith("invalid-json.event.json")
    ? "{"
    : originalReadFileSyncForInvalidJson(filePath, encoding);
try {
    assert.throws(() => loadDraft("invalid-json"), /JSON invalido/i);
} finally {
    fs.readFileSync = originalReadFileSyncForInvalidJson;
}

assert.deepStrictEqual(parseArgs([
    "--draft", "demo-event-v2",
    "--id", "existing-event",
    "--dry-run"
]), {
    overwrite: false,
    dryRun: true,
    legacy: false,
    draft: "demo-event-v2",
    id: "existing-event"
});
assert.deepStrictEqual(parseArgs(["--help"]), {
    overwrite: false,
    dryRun: false,
    legacy: false,
    help: true
});
assert.strictEqual(environmentForMode(false, {
    YCOR_API_BASE_URL: "https://api.test",
    YCOR_ADMIN_PASSWORD: "preferred",
    ADMIN_PASSWORD: "legacy"
}).password, "preferred");
assert.strictEqual(environmentForMode(false, { ADMIN_PASSWORD: "legacy" }).password, "legacy");
assert.strictEqual(resolveSourceVersionId({
    currentWorkingVersionId: WORKING_ID,
    publishedVersionId: PUBLISHED_ID
}), WORKING_ID);
assert.strictEqual(resolveSourceVersionId({
    currentWorkingVersionId: null,
    publishedVersionId: PUBLISHED_ID
}), PUBLISHED_ID);
assert.strictEqual(resolveSourceVersionId({
    currentWorkingVersionId: null,
    publishedVersionId: null
}), null);

const fixturePath = path.resolve(__dirname, "fixtures", "event-v2-complete.json");
const validDraft = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

async function withDraft(name, value, callback) {
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = (filePath, encoding) => String(filePath).endsWith(`${name}.event.json`)
        ? JSON.stringify(value)
        : originalReadFileSync(filePath, encoding);
    try {
        return await callback();
    } finally {
        fs.readFileSync = originalReadFileSync;
    }
}

function options(overrides = {}) {
    return {
        draft: "publisher-test",
        id: "existing-event",
        dryRun: false,
        overwrite: false,
        legacy: false,
        ...overrides
    };
}

function dependencies(overrides = {}) {
    return {
        env: {
            YCOR_API_BASE_URL: "https://api.example.test/",
            YCOR_ADMIN_PASSWORD: "editorial-secret"
        },
        ...overrides
    };
}

function clientFactoryFor(state, calls, createResult = {
    versionId: CREATED_ID,
    versionNumber: 2
}) {
    return (configuration) => {
        calls.push({ type: "configuration", configuration });
        return {
            async getEditorialState(eventId) {
                calls.push({ type: "get", eventId });
                return state;
            },
            async createVersion(eventId, payload) {
                calls.push({ type: "create", eventId, payload });
                return createResult;
            }
        };
    };
}

(async () => {
    let httpCalls = 0;
    const dryRun = await withDraft("publisher-test", validDraft, () => publishDraft(
        options({ dryRun: true }),
        {
            env: {},
            fetchImpl: async () => { httpCalls += 1; },
            clientFactory: () => { httpCalls += 1; }
        }
    ));
    assert.strictEqual(dryRun.dryRun, true);
    assert.strictEqual(dryRun.validation.valid, true);
    assert.strictEqual(httpCalls, 0);
    assert(dryRun.summary.includes("mode: versioned create draft"));

    let invalidHttpCalls = 0;
    const invalidDraft = JSON.parse(JSON.stringify(validDraft));
    invalidDraft.media.items = {};
    const invalidResult = await withDraft("publisher-test", invalidDraft, () => publishDraft(
        options(),
        dependencies({
            fetchImpl: async () => { invalidHttpCalls += 1; },
            clientFactory: () => { invalidHttpCalls += 1; }
        })
    ));
    assert.strictEqual(invalidResult.validation.valid, false);
    assert.strictEqual(invalidResult.skipped, true);
    assert.strictEqual(invalidHttpCalls, 0);

    await assert.rejects(
        withDraft("publisher-test", validDraft, () => publishDraft(options(), { env: {} })),
        /YCOR_API_BASE_URL/
    );
    await assert.rejects(
        withDraft("publisher-test", validDraft, () => publishDraft(
            options({ target: "https://api.example.test" }),
            { env: {} }
        )),
        /YCOR_ADMIN_PASSWORD/
    );

    const noWorkingCalls = [];
    const noWorking = await withDraft("publisher-test", validDraft, () => publishDraft(
        options(),
        dependencies({
            clientFactory: clientFactoryFor({
                eventId: "existing-event",
                eventStatus: "active",
                currentWorkingVersionId: null,
                publishedVersionId: null
            }, noWorkingCalls)
        })
    ));
    const noWorkingCreate = noWorkingCalls.find((call) => call.type === "create");
    assert.strictEqual(noWorkingCreate.payload.expectedWorkingVersionId, null);
    assert.strictEqual(noWorkingCreate.payload.sourceVersionId, null);
    assert.deepStrictEqual(noWorkingCreate.payload.content, validDraft);
    assert.strictEqual(noWorkingCreate.payload.content.status, validDraft.status);
    assert.strictEqual(noWorkingCreate.payload.password, undefined);
    assert.strictEqual(noWorkingCreate.payload.initialWorkflow, undefined);
    assert.deepStrictEqual(noWorking.response, { versionId: CREATED_ID, versionNumber: 2 });
    assert.strictEqual(noWorking.createdEvent, false);

    const newEventCalls = [];
    const newEvent = await withDraft("publisher-test", validDraft, () => publishDraft(
        options({ id: "new-event" }),
        dependencies({
            clientFactory: (configuration) => {
                newEventCalls.push({ type: "configuration", configuration });
                return {
                    async getEditorialState(eventId) {
                        newEventCalls.push({ type: "get", eventId });
                        const error = new Error("Evento inexistente.");
                        error.code = "EVENT_NOT_FOUND";
                        error.status = 404;
                        throw error;
                    },
                    async createEvent(eventId, content) {
                        newEventCalls.push({ type: "createEvent", eventId, content });
                        return {
                            eventId,
                            versionId: CREATED_ID,
                            versionNumber: 1,
                            workflowStatus: "draft"
                        };
                    }
                };
            }
        })
    ));
    assert.strictEqual(newEvent.createdEvent, true);
    assert.deepStrictEqual(newEvent.response, {
        eventId: "new-event",
        versionId: CREATED_ID,
        versionNumber: 1,
        workflowStatus: "draft"
    });
    const newEventCreate = newEventCalls.find((call) => call.type === "createEvent");
    assert.strictEqual(newEventCreate.eventId, "new-event");
    assert.deepStrictEqual(newEventCreate.content, validDraft);
    assert.strictEqual(newEventCalls.some((call) => call.type === "create"), false);

    const httpNewEventCalls = [];
    const httpNewEvent = await withDraft("publisher-test", validDraft, () => publishDraft(
        options({ id: "http-new-event" }),
        dependencies({
            fetchImpl: async (url, requestOptions) => {
                httpNewEventCalls.push({ url, options: requestOptions });
                if (httpNewEventCalls.length === 1) {
                    return {
                        ok: false,
                        status: 404,
                        async json() {
                            return { error: { code: "EVENT_NOT_FOUND" } };
                        }
                    };
                }
                return {
                    ok: true,
                    status: 201,
                    async json() {
                        return {
                            eventId: "http-new-event",
                            versionId: CREATED_ID,
                            versionNumber: 1,
                            workflowStatus: "draft"
                        };
                    }
                };
            }
        })
    ));
    assert.strictEqual(httpNewEvent.createdEvent, true);
    assert.deepStrictEqual(httpNewEventCalls.map((call) => call.url), [
        "https://api.example.test/api/admin/eventos/http-new-event",
        "https://api.example.test/api/admin/eventos"
    ]);
    assert(httpNewEventCalls.every((call) => (
        call.options.headers["X-Admin-Password"] === "editorial-secret"
    )));
    const httpCreateBody = JSON.parse(httpNewEventCalls[1].options.body);
    assert.strictEqual(httpCreateBody.eventId, "http-new-event");
    assert.deepStrictEqual(httpCreateBody.content, validDraft);
    assert.strictEqual(httpNewEventCalls[1].options.body.includes("editorial-secret"), false);
    assert.strictEqual(httpNewEventCalls.some((call) => call.url.endsWith("/api/eventos")), false);

    let duplicateAttempts = 0;
    await assert.rejects(
        withDraft("publisher-test", validDraft, () => publishDraft(
            options({ id: "new-event" }),
            dependencies({
                clientFactory: () => ({
                    async getEditorialState() {
                        const error = new Error("Evento inexistente.");
                        error.code = "EVENT_NOT_FOUND";
                        throw error;
                    },
                    async createEvent() {
                        duplicateAttempts += 1;
                        const error = new Error("El evento ya existe.");
                        error.code = "EVENT_ALREADY_EXISTS";
                        throw error;
                    }
                })
            })
        )),
        (error) => error.code === "EVENT_ALREADY_EXISTS"
    );
    assert.strictEqual(duplicateAttempts, 1);

    const workingCalls = [];
    await withDraft("publisher-test", validDraft, () => publishDraft(
        options(),
        dependencies({
            clientFactory: clientFactoryFor({
                eventId: "existing-event",
                eventStatus: "active",
                currentWorkingVersionId: WORKING_ID,
                publishedVersionId: PUBLISHED_ID
            }, workingCalls)
        })
    ));
    const workingCreate = workingCalls.find((call) => call.type === "create");
    assert.strictEqual(workingCreate.payload.expectedWorkingVersionId, WORKING_ID);
    assert.strictEqual(workingCreate.payload.sourceVersionId, WORKING_ID);

    const publishedCalls = [];
    await withDraft("publisher-test", validDraft, () => publishDraft(
        options(),
        dependencies({
            clientFactory: clientFactoryFor({
                eventId: "existing-event",
                eventStatus: "active",
                currentWorkingVersionId: null,
                publishedVersionId: PUBLISHED_ID
            }, publishedCalls)
        })
    ));
    assert.strictEqual(
        publishedCalls.find((call) => call.type === "create").payload.sourceVersionId,
        PUBLISHED_ID
    );

    let conflictCreateCalls = 0;
    await assert.rejects(
        withDraft("publisher-test", validDraft, () => publishDraft(
            options(),
            dependencies({
                clientFactory: () => ({
                    async getEditorialState() {
                        return { currentWorkingVersionId: WORKING_ID, publishedVersionId: null };
                    },
                    async createVersion() {
                        conflictCreateCalls += 1;
                        const error = new Error("Conflicto de version: la version de trabajo cambio.");
                        error.code = "VERSION_CONFLICT";
                        throw error;
                    }
                })
            })
        )),
        (error) => error.code === "VERSION_CONFLICT"
    );
    assert.strictEqual(conflictCreateCalls, 1);

    await assert.rejects(
        withDraft("publisher-test", validDraft, () => publishDraft(
            options({ overwrite: true }),
            dependencies({ clientFactory: () => { throw new Error("no debe ejecutarse"); } })
        )),
        /--legacy/
    );

    let legacyRequest;
    const legacyResult = await withDraft("publisher-test", validDraft, () => publishDraft(
        options({ legacy: true, overwrite: true }),
        {
            env: {
                YCOR_API_BASE_URL: "https://legacy.example.test/",
                ADMIN_PASSWORD: "legacy-secret"
            },
            fetchImpl: async (url, requestOptions) => {
                legacyRequest = { url, options: requestOptions };
                return {
                    ok: true,
                    status: 200,
                    async json() { return { success: true, id: "existing-event" }; }
                };
            }
        }
    ));
    assert.strictEqual(legacyResult.mode, "legacy");
    assert.strictEqual(legacyRequest.url, "https://legacy.example.test/api/eventos");
    const legacyPayload = JSON.parse(legacyRequest.options.body);
    assert.strictEqual(legacyPayload.password, "legacy-secret");
    assert.strictEqual(legacyPayload.overwrite, true);

    const originalDraft = JSON.parse(JSON.stringify(validDraft));
    await withDraft("publisher-test", originalDraft, () => publishDraft(
        options(),
        dependencies({
            clientFactory: clientFactoryFor({
                currentWorkingVersionId: null,
                publishedVersionId: null
            }, [])
        })
    ));
    assert.deepStrictEqual(originalDraft, validDraft);

    const legacyPayloadUnit = buildPayload({
        draft: validDraft,
        id: "existing-event",
        password: "legacy-secret",
        overwrite: false
    });
    assert.strictEqual(legacyPayloadUnit.id, "existing-event");
    assert.strictEqual(legacyPayloadUnit.password, "legacy-secret");
    assert.strictEqual(validDraft.password, undefined);

    console.log("publish-event-draft test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
