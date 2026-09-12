const assert = require("assert");
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

    console.log("publish-event-draft test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
