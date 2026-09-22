const assert = require("assert");
const Module = require("module");

const routes = {};
const rpcCalls = [];

function createExpressStub() {
    return {
        use() {},
        get(path, handler) {
            routes[`GET ${path}`] = handler;
        },
        post(path, handler) {
            routes[`POST ${path}`] = handler;
        },
        put(path, handler) {
            routes[`PUT ${path}`] = handler;
        },
        listen() {}
    };
}

createExpressStub.json = () => (_req, _res, next) => next();
createExpressStub.urlencoded = () => (_req, _res, next) => next();
createExpressStub.static = () => (_req, _res, next) => next();

const supabase = {
    from() {
        return {
            select() { return this; },
            eq() { return this; },
            maybeSingle() { return Promise.resolve({ data: null, error: null }); },
            upsert() { return Promise.resolve({ error: null }); },
            order() { return Promise.resolve({ data: [], error: null }); }
        };
    },
    rpc(name, parameters) {
        rpcCalls.push({ name, parameters });
        if (name === "create_versioned_event") {
            return Promise.resolve({
                data: [{
                    event_id: "new-event",
                    version_id: "11111111-1111-4111-8111-111111111111",
                    version_number: 1,
                    workflow_status: "draft"
                }],
                error: null
            });
        }
        return Promise.resolve({
            data: [{
                version_id: "11111111-1111-4111-8111-111111111111",
                version_number: 2
            }],
            error: null
        });
    }
};

const originalLoad = Module._load;
const previousEnvironment = {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
};

process.env.ADMIN_PASSWORD = "test-secret";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-key";

Module._load = function loadWithDoubles(request, parent, isMain) {
    if (request === "express") return createExpressStub;
    if (request === "@supabase/supabase-js") return { createClient: () => supabase };
    return originalLoad.call(this, request, parent, isMain);
};

try {
    require("../server");
} finally {
    Module._load = originalLoad;
    for (const [name, value] of Object.entries(previousEnvironment)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
}

const expectedRoutes = [
    "POST /api/admin/eventos",
    "GET /api/admin/eventos/:eventId",
    "POST /api/admin/eventos/:eventId/versions",
    "GET /api/admin/eventos/:eventId/versions/:versionId",
    "POST /api/admin/eventos/:eventId/versions/:versionId/workflow",
    "POST /api/admin/eventos/:eventId/versions/:versionId/publish",
    "POST /api/admin/eventos/:eventId/rollback"
];
for (const route of expectedRoutes) {
    assert.strictEqual(typeof routes[route], "function", `Missing ${route}`);
}

function responseDouble() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

(async () => {
    for (const route of expectedRoutes) {
        const response = responseDouble();
        await routes[route]({ headers: {}, params: {}, body: {} }, response);
        assert.strictEqual(response.statusCode, 401, `${route} must require authentication`);
    }
    assert.strictEqual(typeof routes["GET /api/eventos/:id"], "function");
    assert.strictEqual(typeof routes["POST /api/eventos"], "function");
    assert.strictEqual(typeof routes["PUT /api/eventos"], "function");

    const createEventResponse = responseDouble();
    const newEventContent = {
        schema_version: 1,
        event: {},
        template: { slug: "boda-civil-esencial" },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
        ]
    };
    await routes["POST /api/admin/eventos"]({
        headers: { "x-admin-password": "test-secret" },
        params: {},
        body: { eventId: "new-event", content: newEventContent }
    }, createEventResponse);
    assert.strictEqual(createEventResponse.statusCode, 201);
    assert.deepStrictEqual(createEventResponse.body, {
        eventId: "new-event",
        versionId: "11111111-1111-4111-8111-111111111111",
        versionNumber: 1,
        workflowStatus: "draft"
    });

    const createResponse = responseDouble();
    const content = {
        schema_version: 1,
        event: {},
        template: { slug: "boda-civil-esencial" },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
        ]
    };
    await routes["POST /api/admin/eventos/:eventId/versions"]({
        headers: { "x-admin-password": "test-secret" },
        params: { eventId: "event-one" },
        body: { content, expectedWorkingVersionId: null }
    }, createResponse);
    assert.strictEqual(createResponse.statusCode, 201);
    assert.deepStrictEqual(createResponse.body, {
        versionId: "11111111-1111-4111-8111-111111111111",
        versionNumber: 2
    });
    assert.deepStrictEqual(rpcCalls, [
        {
            name: "create_versioned_event",
            parameters: { p_event_id: "new-event", p_content: newEventContent }
        },
        {
            name: "create_event_version_audited",
            parameters: {
                p_event_id: "event-one",
                p_content: content,
                p_expected_working_version_id: null,
                p_source_version_id: null,
                p_initial_workflow: "draft",
                p_admin_identity: "shared-admin-credential",
                p_ip: null,
                p_origin: null,
                p_action: "CREATE_VERSION"
            }
        }
    ]);
    console.log("server editorial routes tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
