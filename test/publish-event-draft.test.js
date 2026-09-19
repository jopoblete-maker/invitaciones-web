const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
    buildPayload,
    normalizeTarget,
    parseArgs,
    publishDraft,
    resolveDraftPath,
    validatePublicId
} = require("../scripts/publish-event-draft");

assert.strictEqual(validatePublicId("kaly-joha"), true);
assert.strictEqual(validatePublicId("kaly"), true);
assert.strictEqual(validatePublicId("Kaly"), false);
assert.strictEqual(validatePublicId("kaly-joha-"), false);
assert.strictEqual(validatePublicId("../kaly"), false);

assert.throws(() => resolveDraftPath("../kaly"), /draft/i);
assert.throws(() => resolveDraftPath("C:\\temp\\kaly"), /draft/i);
assert(resolveDraftPath("kaly-joha-boda-civil").endsWith("kaly-joha-boda-civil.event.json"));

assert.strictEqual(normalizeTarget("http://127.0.0.1:3000/"), "http://127.0.0.1:3000");
assert.strictEqual(normalizeTarget("https://example.com/base//"), "https://example.com/base");

assert.deepStrictEqual(parseArgs([
    "--draft", "kaly-joha-boda-civil",
    "--id", "kaly-joha",
    "--target", "http://127.0.0.1:3000",
    "--dry-run",
    "--overwrite"
]), {
    overwrite: true,
    dryRun: true,
    draft: "kaly-joha-boda-civil",
    id: "kaly-joha",
    target: "http://127.0.0.1:3000"
});

const draft = {
    schema_version: 1,
    event: {},
    template: { slug: "boda-civil-esencial" },
    sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: {} }]
};
const payload = buildPayload({
    draft,
    id: "kaly-joha",
    password: "secret",
    overwrite: false
});
assert.strictEqual(payload.id, "kaly-joha");
assert.strictEqual(payload.password, "secret");
assert.strictEqual(payload.schema_version, 1);
assert.strictEqual(payload.datos, undefined);
assert.strictEqual(payload.overwrite, undefined);
assert.strictEqual(draft.password, undefined);

const overwritePayload = buildPayload({
    draft,
    id: "kaly-joha",
    password: "secret",
    overwrite: true
});
assert.strictEqual(overwritePayload.overwrite, true);

const protectedPayload = buildPayload({
    draft: { ...draft, id: "draft-id", password: "draft-password", overwrite: true },
    id: "operational-id",
    password: "operational-password",
    overwrite: false
});
assert.strictEqual(protectedPayload.id, "operational-id");
assert.strictEqual(protectedPayload.password, "operational-password");
assert.strictEqual(protectedPayload.overwrite, undefined);

const fixturePath = path.resolve(__dirname, "fixtures", "event-v2-complete.json");
const v2Fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

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

function successfulResponse(id) {
    return {
        ok: true,
        status: 200,
        async json() {
            return { success: true, id };
        }
    };
}

(async () => {
    let called = false;
    const dryRun = await publishDraft({
        draft: "kaly-joha-boda-civil",
        id: "kaly-joha",
        target: "http://127.0.0.1:3000",
        dryRun: true,
        overwrite: false
    }, () => {
        called = true;
    });

    assert.strictEqual(called, false);
    assert.strictEqual(dryRun.dryRun, true);
    assert.strictEqual(dryRun.validation.valid, true);
    assert(dryRun.summary.some((line) => line === "status: VALID"));
    assert(dryRun.summary.every((line) => !line.includes("secret")));

    const previousPassword = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "operational-secret";
    try {
        let v1Request;
        const v1Result = await withDraft("valid-v1", draft, () => publishDraft({
            draft: "valid-v1",
            id: "published-v1",
            target: "https://example.test",
            dryRun: false,
            overwrite: true
        }, async (url, options) => {
            v1Request = { url, options };
            return successfulResponse("published-v1");
        }));
        assert.strictEqual(v1Result.validation.valid, true);
        assert.strictEqual(v1Request.url, "https://example.test/api/eventos");
        assert.strictEqual(JSON.parse(v1Request.options.body).overwrite, true);

        let invalidV1Called = false;
        const invalidV1 = await withDraft("invalid-v1", { ...draft, schema_version: 99 }, () => publishDraft({
            draft: "invalid-v1",
            id: "invalid-v1",
            target: "https://example.test",
            dryRun: false,
            overwrite: false
        }, () => {
            invalidV1Called = true;
        }));
        assert.strictEqual(invalidV1.validation.valid, false);
        assert.strictEqual(invalidV1.skipped, true);
        assert.strictEqual(invalidV1Called, false);

        let v2Request;
        const v2Result = await withDraft("complete-v2", v2Fixture, () => publishDraft({
            draft: "complete-v2",
            id: "published-v2",
            target: "https://example.test",
            dryRun: false,
            overwrite: false
        }, async (url, options) => {
            v2Request = { url, options };
            return successfulResponse("published-v2");
        }));
        assert.deepStrictEqual(v2Result.validation, { valid: true, errors: [] });
        const v2Payload = JSON.parse(v2Request.options.body);
        assert.strictEqual(v2Payload.schema_version, 2);
        assert.strictEqual(v2Payload.id, "published-v2");
        assert.strictEqual(v2Payload.password, "operational-secret");
        assert.strictEqual(v2Payload.overwrite, undefined);

        let invalidV2Called = false;
        const invalidV2Draft = JSON.parse(JSON.stringify(v2Fixture));
        invalidV2Draft.media.items = {};
        const invalidV2 = await withDraft("invalid-v2", invalidV2Draft, () => publishDraft({
            draft: "invalid-v2",
            id: "invalid-v2",
            target: "https://example.test",
            dryRun: false,
            overwrite: false
        }, () => {
            invalidV2Called = true;
        }));
        assert.strictEqual(invalidV2.validation.valid, false);
        assert.strictEqual(invalidV2Called, false);

        let unknownSchemaCalled = false;
        const unknownSchema = await withDraft("unknown-schema", { ...draft, schema_version: 3 }, () => publishDraft({
            draft: "unknown-schema",
            id: "unknown-schema",
            target: "https://example.test",
            dryRun: false,
            overwrite: false
        }, () => {
            unknownSchemaCalled = true;
        }));
        assert.strictEqual(unknownSchema.validation.valid, false);
        assert.strictEqual(unknownSchemaCalled, false);
    } finally {
        if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
        else process.env.ADMIN_PASSWORD = previousPassword;
    }

    console.log("publish-event-draft test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
