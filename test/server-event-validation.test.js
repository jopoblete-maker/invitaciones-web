const assert = require("assert");
const Module = require("module");

const ADMIN_PASSWORD = "test-secret";
const routes = {};
const database = {
    calls: 0,
    writes: 0,
    savedEvents: []
};

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
        database.calls += 1;
        return {
            select() {
                return this;
            },
            eq() {
                return this;
            },
            maybeSingle() {
                return Promise.resolve({ data: null });
            },
            upsert(record) {
                database.writes += 1;
                database.savedEvents.push(record);
                return Promise.resolve({ error: null });
            },
            single() {
                return Promise.resolve({ data: null, error: new Error("not found") });
            }
        };
    }
};

const originalLoad = Module._load;
const previousEnvironment = {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
};

process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-key";

Module._load = function loadWithServerDoubles(request, parent, isMain) {
    if (request === "express") return createExpressStub;
    if (request === "@supabase/supabase-js") {
        return { createClient: () => supabase };
    }
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

const saveEvent = routes["POST /api/eventos"];
assert.strictEqual(typeof saveEvent, "function");

function validNewEvent(overrides = {}) {
    return {
        password: ADMIN_PASSWORD,
        id: "evento-new-schema",
        schema_version: 1,
        event: {},
        template: { slug: "boda-civil-esencial" },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
        ],
        ...overrides
    };
}

function createResponse() {
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

async function request(payload) {
    const response = createResponse();
    await saveEvent({ body: payload }, response);
    return response;
}

function resetDatabase() {
    database.calls = 0;
    database.writes = 0;
    database.savedEvents = [];
}

(async () => {
    resetDatabase();
    const validResponse = await request(validNewEvent());
    assert.strictEqual(validResponse.statusCode, 200);
    assert.deepStrictEqual(validResponse.body, { success: true, id: "evento-new-schema" });
    assert.strictEqual(database.calls, 2);
    assert.strictEqual(database.writes, 1);

    resetDatabase();
    const invalidResponse = await request(validNewEvent({ schema_version: 999 }));
    assert.strictEqual(invalidResponse.statusCode, 400);
    assert.strictEqual(invalidResponse.body.error, "El evento new-schema no es válido.");
    assert(invalidResponse.body.validationErrors.some((error) => error.includes("schema_version")));
    assert.strictEqual(database.calls, 0);
    assert.strictEqual(database.writes, 0);

    resetDatabase();
    const sectionsWithoutSchema = validNewEvent();
    delete sectionsWithoutSchema.schema_version;
    const missingSchemaResponse = await request(sectionsWithoutSchema);
    assert.strictEqual(missingSchemaResponse.statusCode, 400);
    assert(missingSchemaResponse.body.validationErrors.some((error) => error.includes("schema_version")));
    assert.strictEqual(database.calls, 0);
    assert.strictEqual(database.writes, 0);

    resetDatabase();
    const legacyResponse = await request({
        password: ADMIN_PASSWORD,
        id: "evento-legacy",
        nombre: "Evento legacy",
        template_slug: "boda-vertical",
        tema: "romantico",
        multimedia: { capas: {} },
        confirmacion: { nombre1: "Ana", tel1: "5491112345678" }
    });
    assert.strictEqual(legacyResponse.statusCode, 200);
    assert.strictEqual(database.writes, 1);
    assert.strictEqual(database.savedEvents[0].datos.nombre, "Evento legacy");

    resetDatabase();
    const unauthorizedResponse = await request(validNewEvent({ password: "incorrect" }));
    assert.strictEqual(unauthorizedResponse.statusCode, 401);
    assert.strictEqual(database.calls, 0);
    assert.strictEqual(database.writes, 0);

    resetDatabase();
    const oversizedResponse = await request({
        password: ADMIN_PASSWORD,
        id: "evento-grande",
        multimedia: { imagen: "x".repeat((12 * 1024 * 1024) + 1) }
    });
    assert.strictEqual(oversizedResponse.statusCode, 413);
    assert.strictEqual(database.calls, 0);
    assert.strictEqual(database.writes, 0);

    console.log("server-event-validation test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
