const assert = require("assert");
const Module = require("module");

const routes = {};
const rows = {
    eventos: new Map(),
    event_versions: new Map()
};
const queries = [];

function createExpressStub() {
    return {
        use() {},
        get(path, handler) {
            routes[`GET ${path}`] = handler;
        },
        post() {},
        put() {},
        listen() {}
    };
}

createExpressStub.json = () => (_req, _res, next) => next();
createExpressStub.urlencoded = () => (_req, _res, next) => next();
createExpressStub.static = () => (_req, _res, next) => next();

const supabase = {
    from(table) {
        const query = { table, columns: null, id: null };
        queries.push(query);
        return {
            select(columns) {
                query.columns = columns;
                return this;
            },
            eq(column, value) {
                assert.strictEqual(column, "id");
                query.id = value;
                return this;
            },
            maybeSingle() {
                return Promise.resolve({
                    data: rows[table]?.get(query.id) || null,
                    error: null
                });
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

process.env.ADMIN_PASSWORD = "test-secret";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-key";

Module._load = function loadWithDoubles(request, parent, isMain) {
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

const readEvent = routes["GET /api/eventos/:id"];
assert.strictEqual(typeof readEvent, "function");

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

async function request(id) {
    const response = responseDouble();
    await readEvent({ params: { id } }, response);
    return response;
}

function reset() {
    rows.eventos.clear();
    rows.event_versions.clear();
    queries.length = 0;
}

(async () => {
    reset();
    rows.eventos.set("versioned", {
        id: "versioned",
        datos: { source: "legacy" },
        published_version_id: "version-1",
        event_status: "active"
    });
    rows.event_versions.set("version-1", {
        id: "version-1",
        event_id: "versioned",
        content: { source: "version" }
    });
    const versioned = await request("versioned");
    assert.strictEqual(versioned.statusCode, 200);
    assert.deepStrictEqual(versioned.body, { source: "version" });
    assert.deepStrictEqual(queries.map((query) => query.table), ["eventos", "event_versions"]);
    assert.strictEqual(
        queries[0].columns,
        "id, datos, published_version_id, current_working_version_id, event_status"
    );
    assert.strictEqual(queries[1].columns, "id, event_id, content");

    reset();
    rows.eventos.set("legacy-", {
        id: "legacy-",
        datos: { source: "legacy" },
        published_version_id: null,
        event_status: "active"
    });
    const originalWarn = console.warn;
    console.warn = () => {};
    let legacy;
    try {
        legacy = await request("legacy-");
    } finally {
        console.warn = originalWarn;
    }
    assert.strictEqual(legacy.statusCode, 200);
    assert.deepStrictEqual(legacy.body, { source: "legacy" });
    assert.deepStrictEqual(queries.map((query) => query.table), ["eventos"]);

    reset();
    rows.eventos.set("new-event", {
        id: "new-event",
        datos: { mustNotLeak: "draft" },
        published_version_id: null,
        current_working_version_id: "draft-v1",
        event_status: "active"
    });
    const unpublished = await request("new-event");
    assert.strictEqual(unpublished.statusCode, 404);
    assert.match(unpublished.body.error, /no encontrada$/);
    assert.deepStrictEqual(queries.map((query) => query.table), ["eventos"]);

    reset();
    rows.eventos.set("archived", {
        id: "archived",
        datos: { mustNotLeak: true },
        published_version_id: "version-1",
        event_status: "archived"
    });
    const archived = await request("archived");
    assert.strictEqual(archived.statusCode, 404);
    assert.deepStrictEqual(archived.body, { error: "Invitación no encontrada" });
    assert.deepStrictEqual(queries.map((query) => query.table), ["eventos"]);

    reset();
    rows.eventos.set("invalid", {
        id: "invalid",
        datos: null,
        published_version_id: null,
        event_status: "active"
    });
    const originalError = console.error;
    console.error = () => {};
    let invalid;
    try {
        invalid = await request("invalid");
    } finally {
        console.error = originalError;
    }
    assert.strictEqual(invalid.statusCode, 500);
    assert.deepStrictEqual(invalid.body, { error: "Invitación no disponible" });

    reset();
    const missing = await request("missing");
    assert.strictEqual(missing.statusCode, 404);
    assert.deepStrictEqual(missing.body, { error: "Invitación no encontrada" });

    console.log("server public event read tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
