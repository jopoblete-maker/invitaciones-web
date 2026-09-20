const assert = require("assert");
const {
    createEventVersionEditorialService
} = require("../js/core/event-version-editorial-service");
const {
    createEventVersionEditorialHttp
} = require("../js/core/event-version-editorial-http");

const ADMIN_PASSWORD = "editor-secret";
const EVENT_ID = "event-one";
const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const WORKING_ID = "22222222-2222-4222-8222-222222222222";

function codedError(code, message = code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function validContent() {
    return {
        schema_version: 1,
        event: {},
        template: { slug: "boda-civil-esencial" },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
        ]
    };
}

function createHarness() {
    const calls = [];
    const failures = {};
    const adapter = {
        async createEvent(options) {
            calls.push(["createEvent", options]);
            if (failures.createEvent) throw failures.createEvent;
            return {
                eventId: options.eventId,
                versionId: VERSION_ID,
                versionNumber: 1,
                workflowStatus: "draft"
            };
        },
        async createVersion(options) {
            calls.push(["createVersion", options]);
            if (failures.createVersion) throw failures.createVersion;
            return { versionId: VERSION_ID, versionNumber: 2 };
        },
        async transitionWorkflow(options) {
            calls.push(["transitionWorkflow", options]);
            if (failures.transitionWorkflow) throw failures.transitionWorkflow;
            return {
                eventId: options.eventId,
                versionId: options.versionId,
                workflowStatus: options.targetStatus
            };
        },
        async publishVersion(options) {
            calls.push(["publishVersion", options]);
            if (failures.publishVersion) throw failures.publishVersion;
            return { eventId: options.eventId, publishedVersionId: options.versionId };
        },
        async rollbackVersion(options) {
            calls.push(["rollbackVersion", options]);
            if (failures.rollbackVersion) throw failures.rollbackVersion;
            return { eventId: options.eventId, publishedVersionId: options.versionId };
        }
    };
    const readRepository = {
        async getEditorialState(eventId) {
            calls.push(["getEditorialState", { eventId }]);
            if (failures.getEditorialState) throw failures.getEditorialState;
            return {
                eventId,
                eventStatus: "active",
                publishedVersionId: VERSION_ID,
                currentWorkingVersionId: WORKING_ID,
                versions: [{ versionId: VERSION_ID, workflowStatus: "approved" }]
            };
        },
        async getVersion(eventId, versionId) {
            calls.push(["getVersion", { eventId, versionId }]);
            if (failures.getVersion) throw failures.getVersion;
            return { eventId, versionId, content: { private: true } };
        }
    };
    const service = createEventVersionEditorialService(adapter);
    const http = createEventVersionEditorialHttp({
        service,
        readRepository,
        adminPassword: ADMIN_PASSWORD
    });
    return { calls, failures, http };
}

function responseDouble() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

async function request(handler, { password, params = {}, body = {} } = {}) {
    const response = responseDouble();
    const headers = {};
    if (password !== undefined) headers["x-admin-password"] = password;
    await handler({ headers, params, body }, response);
    return response;
}

(async () => {
    const auth = createHarness();
    const missingPassword = await request(auth.http.getEditorialState, {
        params: { eventId: EVENT_ID }
    });
    assert.strictEqual(missingPassword.statusCode, 401);
    assert.strictEqual(auth.calls.length, 0);
    const wrongPassword = await request(auth.http.getEditorialState, {
        password: "wrong",
        params: { eventId: EVENT_ID }
    });
    assert.strictEqual(wrongPassword.statusCode, 401);
    assert.strictEqual(auth.calls.length, 0);
    const state = await request(auth.http.getEditorialState, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID }
    });
    assert.strictEqual(state.statusCode, 200);
    assert.strictEqual(state.body.currentWorkingVersionId, WORKING_ID);
    assert.strictEqual(Object.hasOwn(state.body.versions[0], "content"), false);

    const newEvent = createHarness();
    const newEventContent = validContent();
    const unauthorizedCreate = await request(newEvent.http.createEvent, {
        body: { eventId: EVENT_ID, content: newEventContent }
    });
    assert.strictEqual(unauthorizedCreate.statusCode, 401);
    assert.strictEqual(newEvent.calls.length, 0);
    const createdEvent = await request(newEvent.http.createEvent, {
        password: ADMIN_PASSWORD,
        body: { eventId: EVENT_ID, content: newEventContent }
    });
    assert.strictEqual(createdEvent.statusCode, 201);
    assert.deepStrictEqual(createdEvent.body, {
        eventId: EVENT_ID,
        versionId: VERSION_ID,
        versionNumber: 1,
        workflowStatus: "draft"
    });
    assert.strictEqual(newEvent.calls[0][1].content, newEventContent);
    newEvent.failures.createEvent = codedError("EVENT_ALREADY_EXISTS");
    assert.strictEqual((await request(newEvent.http.createEvent, {
        password: ADMIN_PASSWORD,
        body: { eventId: EVENT_ID, content: newEventContent }
    })).statusCode, 409);
    const invalidNewEvent = await request(createHarness().http.createEvent, {
        password: ADMIN_PASSWORD,
        body: { eventId: EVENT_ID, content: { schema_version: 999 } }
    });
    assert.strictEqual(invalidNewEvent.statusCode, 422);

    const create = createHarness();
    const createdNull = await request(create.http.createVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID },
        body: { content: validContent(), expectedWorkingVersionId: null }
    });
    assert.strictEqual(createdNull.statusCode, 201);
    assert.deepStrictEqual(createdNull.body, { versionId: VERSION_ID, versionNumber: 2 });
    assert.strictEqual(create.calls[0][1].expectedWorkingVersionId, null);
    const createdUuid = await request(create.http.createVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID },
        body: { content: validContent(), expectedWorkingVersionId: WORKING_ID }
    });
    assert.strictEqual(createdUuid.statusCode, 201);
    assert.strictEqual(create.calls[1][1].expectedWorkingVersionId, WORKING_ID);

    const missingExpected = await request(create.http.createVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID },
        body: { content: validContent() }
    });
    assert.strictEqual(missingExpected.statusCode, 400);
    const invalidContent = await request(create.http.createVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID },
        body: { content: { schema_version: 999 }, expectedWorkingVersionId: null }
    });
    assert.strictEqual(invalidContent.statusCode, 422);
    create.failures.createVersion = codedError("VERSION_CONFLICT");
    const conflict = await request(create.http.createVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID },
        body: { content: validContent(), expectedWorkingVersionId: WORKING_ID }
    });
    assert.strictEqual(conflict.statusCode, 409);

    const workflow = createHarness();
    for (const [expectedStatus, targetStatus] of [
        ["draft", "in_review"],
        ["in_review", "approved"]
    ]) {
        const response = await request(workflow.http.transitionWorkflow, {
            password: ADMIN_PASSWORD,
            params: { eventId: EVENT_ID, versionId: VERSION_ID },
            body: { expectedStatus, targetStatus }
        });
        assert.strictEqual(response.statusCode, 200);
        assert.strictEqual(response.body.workflowStatus, targetStatus);
    }
    workflow.failures.transitionWorkflow = codedError("INVALID_WORKFLOW");
    assert.strictEqual((await request(workflow.http.transitionWorkflow, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID, versionId: VERSION_ID },
        body: { expectedStatus: "draft", targetStatus: "approved" }
    })).statusCode, 409);

    for (const code of ["VERSION_CONFLICT", "INVALID_WORKFLOW", "VERSION_NOT_FOUND"] ) {
        const publish = createHarness();
        publish.failures.publishVersion = codedError(code);
        const response = await request(publish.http.publishVersion, {
            password: ADMIN_PASSWORD,
            params: { eventId: EVENT_ID, versionId: VERSION_ID }
        });
        assert.strictEqual(response.statusCode, code === "VERSION_NOT_FOUND" ? 404 : 409);
    }
    const publish = createHarness();
    assert.strictEqual((await request(publish.http.publishVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID, versionId: VERSION_ID }
    })).statusCode, 200);

    for (const code of ["INVALID_WORKFLOW", "VERSION_NOT_FOUND"]) {
        const rollback = createHarness();
        rollback.failures.rollbackVersion = codedError(code);
        const response = await request(rollback.http.rollbackVersion, {
            password: ADMIN_PASSWORD,
            params: { eventId: EVENT_ID },
            body: { versionId: VERSION_ID }
        });
        assert.strictEqual(response.statusCode, code === "VERSION_NOT_FOUND" ? 404 : 409);
    }
    const rollback = createHarness();
    assert.strictEqual((await request(rollback.http.rollbackVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID },
        body: { versionId: VERSION_ID }
    })).statusCode, 200);

    const versionRead = createHarness();
    const privateWithoutAuth = await request(versionRead.http.getVersion, {
        params: { eventId: EVENT_ID, versionId: VERSION_ID }
    });
    assert.strictEqual(privateWithoutAuth.statusCode, 401);
    assert.strictEqual(versionRead.calls.length, 0);
    const privateWithAuth = await request(versionRead.http.getVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID, versionId: VERSION_ID }
    });
    assert.strictEqual(privateWithAuth.statusCode, 200);
    assert.deepStrictEqual(privateWithAuth.body.content, { private: true });
    versionRead.failures.getVersion = codedError("VERSION_EVENT_MISMATCH");
    assert.strictEqual((await request(versionRead.http.getVersion, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID, versionId: VERSION_ID }
    })).statusCode, 404);

    const secureFailure = createHarness();
    secureFailure.failures.getEditorialState = new Error(
        `SQL failed with ${ADMIN_PASSWORD} and SUPABASE_KEY`
    );
    const unexpected = await request(secureFailure.http.getEditorialState, {
        password: ADMIN_PASSWORD,
        params: { eventId: EVENT_ID }
    });
    assert.strictEqual(unexpected.statusCode, 500);
    assert.deepStrictEqual(unexpected.body, {
        error: { code: "INTERNAL_ERROR", message: "Unexpected server error." }
    });
    assert(!JSON.stringify(unexpected.body).includes(ADMIN_PASSWORD));
    assert(!JSON.stringify(unexpected.body).includes("SUPABASE_KEY"));

    console.log("event-version-editorial-http tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
