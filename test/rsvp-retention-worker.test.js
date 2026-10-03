const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { runRetention } = require("../backend/rsvp/retention-worker");
const { createRsvpRpcAdapter } = require("../backend/rsvp/rpc-adapter");
const { RsvpError } = require("../backend/rsvp/errors");
let checks = 0;
function scripted(values) {
    const calls = [];
    return { calls, adapter: { async purgeDue(options) {
        calls.push(options);
        assert(values.length > 0, "Unexpected extra batch");
        const value = values.shift();
        if (value instanceof Error) throw value;
        return value;
    } } };
}
async function result(values, batchSize, expected) {
    const fixture = scripted(values.slice());
    assert.deepStrictEqual(await runRetention({ adapter: fixture.adapter, ...(batchSize === undefined ? {} : { batchSize }) }), expected);
    assert.deepStrictEqual(fixture.calls, Array.from({ length: expected.batches }, () => ({ limit: batchSize ?? 50 })));
    checks++;
}
(async () => {
    await result([0], undefined, { processed: 0, batches: 1, aborted: false });
    await result([12], undefined, { processed: 12, batches: 1, aborted: false });
    await result([50, 3], undefined, { processed: 53, batches: 2, aborted: false });
    await result([50, 50, 50, 0], undefined, { processed: 150, batches: 4, aborted: false });
    await result([2, 2, 1], 2, { processed: 5, batches: 3, aborted: false });
    await result([1, 0], 1, { processed: 1, batches: 2, aborted: false });
    await result([100, 4], 100, { processed: 104, batches: 2, aborted: false });
    for (const batchSize of [0, -1, 1.5, "50", NaN, Infinity, -Infinity, null, 101, Number.MAX_SAFE_INTEGER + 1, {}, true]) {
        const fixture = scripted([]);
        await assert.rejects(() => runRetention({ adapter: fixture.adapter, batchSize }), (error) => error.code === "RSVP_INVALID_PAYLOAD");
        assert.strictEqual(fixture.calls.length, 0); checks++;
    }
    for (const adapter of [undefined, {}, { purgeDue: true }]) {
        await assert.rejects(() => runRetention({ adapter }), TypeError); checks++;
    }
    for (const signal of [null, {}, { aborted: false }]) {
        const fixture = scripted([]);
        await assert.rejects(() => runRetention({ adapter: fixture.adapter, signal }), (error) => error.code === "RSVP_INVALID_PAYLOAD");
        assert.strictEqual(fixture.calls.length, 0); checks++;
    }
    const before = new AbortController(); before.abort("raw-reason");
    const untouched = scripted([]);
    assert.deepStrictEqual(await runRetention({ adapter: untouched.adapter, signal: before.signal }), { processed: 0, batches: 0, aborted: true });
    assert.strictEqual(untouched.calls.length, 0); checks++;
    const between = new AbortController();
    let calls = 0;
    assert.deepStrictEqual(await runRetention({ signal: between.signal, batchSize: 2, adapter: { async purgeDue(options) {
        assert.deepStrictEqual(options, { limit: 2 }); calls++; between.abort(); return 2;
    } } }), { processed: 2, batches: 1, aborted: true });
    assert.strictEqual(calls, 1); checks++;
    // Abort during an in-flight RPC waits for its real result; it cannot cancel it.
    const during = new AbortController();
    let release;
    let started = 0;
    const pending = runRetention({ signal: during.signal, adapter: { purgeDue() {
        started++; return new Promise((resolve) => { release = resolve; });
    } } });
    during.abort(); let settled = false;
    pending.then(() => { settled = true; });
    await Promise.resolve(); assert.strictEqual(settled, false); checks++;
    release(7);
    assert.deepStrictEqual(await pending, { processed: 7, batches: 1, aborted: true });
    assert.strictEqual(started, 1); checks++;
    for (const code of ["RSVP_WRITE_RESULT_UNKNOWN", "RSVP_INTERNAL_ERROR", "PII_RETENTION_EXPIRED"]) {
        const error = new RsvpError(code);
        const fixture = scripted([50, error, 0]);
        await assert.rejects(() => runRetention({ adapter: fixture.adapter }), (caught) => {
            assert.strictEqual(caught, error);
            assert(!Object.prototype.hasOwnProperty.call(caught, "processed") && !Object.prototype.hasOwnProperty.call(caught, "batches"));
            return true;
        });
        assert.strictEqual(fixture.calls.length, 2); checks++;
    }
    // An abort does not turn an unknown write into a successful aborted result.
    const abortedUnknown = new AbortController();
    const unknown = new RsvpError("RSVP_WRITE_RESULT_UNKNOWN");
    await assert.rejects(() => runRetention({ signal: abortedUnknown.signal, adapter: { async purgeDue() {
        abortedUnknown.abort(); throw unknown;
    } } }), (error) => error === unknown); checks++;
    const unsafe = scripted([new Error("raw-Supabase-secret")]);
    await assert.rejects(() => runRetention({ adapter: unsafe.adapter }), (error) => error.code === "RSVP_INTERNAL_ERROR" && !error.cause && !error.message.includes("raw-"));
    assert.strictEqual(unsafe.calls.length, 1); checks++;
    for (const value of [-1, 51, 0.5, "0", null, undefined, NaN, Infinity, {}, { processed: 1 }]) {
        const fixture = scripted([value]);
        await assert.rejects(() => runRetention({ adapter: fixture.adapter }), (error) => error.code === "RSVP_INTERNAL_ERROR");
        assert.strictEqual(fixture.calls.length, 1); checks++;
    }
    const consecutive = scripted([3, 0]);
    assert.deepStrictEqual(await runRetention({ adapter: consecutive.adapter }), { processed: 3, batches: 1, aborted: false });
    assert.deepStrictEqual(await runRetention({ adapter: consecutive.adapter }), { processed: 0, batches: 1, aborted: false }); checks++;
    const independent = await Promise.all([runRetention({ adapter: scripted([2]).adapter }), runRetention({ adapter: scripted([4]).adapter })]);
    assert.deepStrictEqual(independent.map((value) => value.processed), [2, 4]); checks++;
    // Exercise the frozen adapter's exact RPC arguments and WRITE timeout mapping.
    const rpcCalls = [];
    const realAdapter = createRsvpRpcAdapter({ supabase: { rpc(name, parameters) {
        rpcCalls.push({ name, parameters }); return Promise.resolve({ data: 0, error: null });
    } }, execute: (query) => query });
    const empty = await runRetention({ adapter: realAdapter });
    assert.deepStrictEqual(rpcCalls, [{ name: "rsvp_purge_due", parameters: { p_limit: 50 } }]);
    assert.deepStrictEqual(Object.keys(empty), ["processed", "batches", "aborted"]); checks++;
    let timeoutCalls = 0;
    const timeoutAdapter = createRsvpRpcAdapter({ supabase: { rpc() { timeoutCalls++; return Promise.resolve({ data: 50 }); } },
        execute: async () => { throw { code: "SUPABASE_TIMEOUT", message: "raw-timeout" }; } });
    await assert.rejects(() => runRetention({ adapter: timeoutAdapter }), (error) => error.code === "RSVP_WRITE_RESULT_UNKNOWN" && !error.cause);
    assert.strictEqual(timeoutCalls, 1); checks++;
    const source = fs.readFileSync(path.join(__dirname, "../backend/rsvp/retention-worker.js"), "utf8");
    for (const pattern of [/setInterval/, /setTimeout/, /process\.env/, /createClient/, /console\./, /require\(["']express/, /\.from\(/]) assert(!pattern.test(source));
    const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    assert(!serverSource.includes("retention-worker") && !serverSource.includes("runRetention")); checks++;
    console.log(`rsvp-retention-worker: ${checks} checks passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
