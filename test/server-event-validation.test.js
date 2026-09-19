const assert = require("assert");
const fs = require("fs");
const Module = require("module");
const path = require("path");

const ADMIN_PASSWORD = "test-secret";
const routes = {};
const database = {
    calls: 0,
    writes: 0,
    savedEvents: [],
    existing: false
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
                return Promise.resolve({ data: database.existing ? { id: "existing" } : null });
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
    database.existing = false;
}

const v2Fixture = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "fixtures", "event-v2-complete.json"),
    "utf8"
));
const demoV2Draft = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "..", ".dev", "drafts", "demo-event-v2.event.json"),
    "utf8"
));

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
    const unknownTemplateResponse = await request(validNewEvent({
        template: { slug: "template-inexistente" }
    }));
    assert.strictEqual(unknownTemplateResponse.statusCode, 400);
    assert(unknownTemplateResponse.body.validationErrors.some((error) => error.includes("template.slug")));
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
    const validV2Response = await request({
        ...v2Fixture,
        password: ADMIN_PASSWORD,
        id: "evento-v2-publicado"
    });
    assert.strictEqual(validV2Response.statusCode, 200);
    assert.strictEqual(database.calls, 2);
    assert.strictEqual(database.writes, 1);
    assert.strictEqual(database.savedEvents[0].datos.schema_version, 2);
    assert.strictEqual(database.savedEvents[0].datos.id, "evento-v2-publicado");
    assert.strictEqual(database.savedEvents[0].datos.tema, undefined);

    resetDatabase();
    const demoV2Response = await request({
        ...demoV2Draft,
        password: ADMIN_PASSWORD,
        id: "ycor-demo-v2-preview"
    });
    assert.strictEqual(demoV2Response.statusCode, 200);
    assert.deepStrictEqual(demoV2Response.body, { success: true, id: "ycor-demo-v2-preview" });
    assert.strictEqual(database.calls, 2);
    assert.strictEqual(database.writes, 1);
    assert.strictEqual(database.savedEvents[0].datos.schema_version, 2);
    assert.strictEqual(database.savedEvents[0].datos.identity.title, "YCOR Demo V2");
    assert.strictEqual(database.savedEvents[0].datos.tema, undefined);

    resetDatabase();
    const invalidV2 = JSON.parse(JSON.stringify(v2Fixture));
    invalidV2.media.items = {};
    const invalidV2Response = await request({ ...invalidV2, password: ADMIN_PASSWORD });
    assert.strictEqual(invalidV2Response.statusCode, 400);
    assert(invalidV2Response.body.validationErrors.some((error) => error.includes("media_id")));
    assert.strictEqual(database.calls, 0);
    assert.strictEqual(database.writes, 0);

    resetDatabase();
    const incompatibleV2 = JSON.parse(JSON.stringify(v2Fixture));
    incompatibleV2.sections[0].type = "gallery";
    const incompatibleResponse = await request({ ...incompatibleV2, password: ADMIN_PASSWORD });
    assert.strictEqual(incompatibleResponse.statusCode, 400);
    assert(incompatibleResponse.body.validationErrors.some((error) => error.includes("type no registrado")));
    assert.strictEqual(database.calls, 0);

    resetDatabase();
    const missingRsvpV2 = JSON.parse(JSON.stringify(v2Fixture));
    delete missingRsvpV2.modules.rsvp;
    const missingRsvpResponse = await request({ ...missingRsvpV2, password: ADMIN_PASSWORD });
    assert.strictEqual(missingRsvpResponse.statusCode, 400);
    assert(missingRsvpResponse.body.validationErrors.some((error) => error.includes("modules.rsvp")));
    assert.strictEqual(database.calls, 0);

    resetDatabase();
    const unknownSchemaResponse = await request(validNewEvent({ schema_version: 3 }));
    assert.strictEqual(unknownSchemaResponse.statusCode, 400);
    assert.strictEqual(database.calls, 0);

    resetDatabase();
    const invalidIdResponse = await request(validNewEvent({ id: "Evento-Invalido" }));
    assert.strictEqual(invalidIdResponse.statusCode, 400);
    assert.strictEqual(database.calls, 0);

    resetDatabase();
    const legacyTrailingHyphenResponse = await request({
        password: ADMIN_PASSWORD,
        id: "evento-legacy-",
        nombre: "Evento legacy existente"
    });
    assert.strictEqual(legacyTrailingHyphenResponse.statusCode, 200);
    assert.strictEqual(database.writes, 1);

    resetDatabase();
    database.existing = true;
    const duplicateResponse = await request(validNewEvent());
    assert.strictEqual(duplicateResponse.statusCode, 409);
    assert.strictEqual(database.writes, 0);

    resetDatabase();
    database.existing = true;
    const overwriteResponse = await request(validNewEvent({ overwrite: true }));
    assert.strictEqual(overwriteResponse.statusCode, 200);
    assert.strictEqual(database.writes, 1);

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
