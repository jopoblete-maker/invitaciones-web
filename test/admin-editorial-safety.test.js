"use strict";
const assert = require("node:assert/strict");
const { createActionRunner, publicationPhrase } = require("../js/core/admin-editorial-workflow");
const { createAdminEditorialClient } = require("../js/core/admin-editorial-client");
const E = "synthetic-event", V = "synthetic-working", P = "synthetic-published";
const state = (id = E, workflowStatus = "approved") => ({ eventId: id, eventStatus: "active", currentWorkingVersionId: V,
    publishedVersionId: P, versions: [{ versionId: P, versionNumber: 1, workflowStatus: "approved", publishedAt: "2026-01-01T00:00:00Z" },
        { versionId: V, versionNumber: 2, workflowStatus, publishedAt: null }] });
const published = id => ({ ...state(id), currentWorkingVersionId: null, publishedVersionId: V,
    versions: state(id).versions.map(v => ({ ...v, publishedAt: "2026-01-02T00:00:00Z" })) });
const options = { eventId: E, versionId: V, password: "synthetic-only", requestedKind: "publish", expectedStatus: "approved" };
const receipt = { eventId: E, publishedVersionId: V };
const response = (status, payload) => ({ status, ok: status >= 200 && status < 300, json: async () => payload });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
function harness() {
    const h = { current: state(), reads: 0, posts: 0 };
    h.client = { async getEditorialState() { h.reads++; return structuredClone(h.current); },
        async transitionWorkflow(args) { h.posts++; h.current.versions[1].workflowStatus = args.targetStatus;
            return { eventId: args.eventId, versionId: args.versionId, workflowStatus: args.targetStatus }; },
        async publishVersion() { h.posts++; h.current = published(E); return receipt; } };
    h.make = (confirm = () => publicationPhrase(E)) => createActionRunner({ client: h.client, confirmPublication: confirm });
    return h;
}
(async () => {
    const good = harness(), goodRunner = good.make();
    assert.equal((await goodRunner.run(options)).outcome, "success");
    assert.equal(good.reads, 3); assert.equal(good.posts, 1); assert.equal(goodRunner.requiresRefresh(E), false);
    for (const [requestedKind, expectedStatus, targetStatus] of [["submit", "draft", "in_review"], ["approve", "in_review", "approved"]]) {
        const h = harness(); h.current = state(E, expectedStatus);
        const result = await h.make().run({ ...options, requestedKind, expectedStatus });
        assert.equal(result.outcome, "success"); assert.equal(result.state.versions[1].workflowStatus, targetStatus);
        assert.equal(h.posts, 1);
    }
    // Exact pointers, state, version identity and number must survive operator confirmation.
    for (const mutate of [s => { s.publishedVersionId = null; }, s => { s.eventStatus = "archived"; },
        s => { s.currentWorkingVersionId = null; }, s => { s.versions[1].workflowStatus = "in_review"; },
        s => { s.versions[1].versionNumber = 3; }]) {
        const h = harness(), runner = h.make(() => { mutate(h.current); return publicationPhrase(E); });
        assert.equal((await runner.run(options)).outcome, "stale"); assert.equal(h.posts, 0);
    }
    const observed = harness(); const old = state(); old.publishedVersionId = null;
    assert.equal((await observed.make().run({ ...options, observedState: old })).outcome, "stale"); assert.equal(observed.posts, 0);
    const selected = harness(); let current = true;
    assert.equal((await selected.make(() => { current = false; return publicationPhrase(E); })
        .run({ ...options, isCurrent: () => current })).outcome, "stale-view"); assert.equal(selected.posts, 0);

    for (const wrong of [state(), { ...published(E), publishedVersionId: P },
        { ...published(E), currentWorkingVersionId: P }, published("crossed-event"),
        { ...published(E), versions: published(E).versions.map(v => ({ ...v, publishedAt: null })) }]) {
        const h = harness(); h.client.publishVersion = async () => { h.posts++; h.current = wrong; return receipt; };
        const runner = h.make(), result = await runner.run(options);
        assert.notEqual(result.outcome, "success"); assert.equal(runner.requiresRefresh(E), true);
        assert.equal((await runner.run(options)).outcome, "refresh-required"); assert.equal(h.posts, 1);
    }
    const wrongTransition = harness(); wrongTransition.current = state(E, "draft");
    wrongTransition.client.transitionWorkflow = async () => { wrongTransition.posts++; return { eventId: E, versionId: V, workflowStatus: "in_review" }; };
    const wrongTransitionRunner = wrongTransition.make();
    assert.equal((await wrongTransitionRunner.run({ ...options, requestedKind: "submit", expectedStatus: "draft" })).outcome, "mutation-unknown");

    // Unknown results stay blocked even after an unchanged GET or a failed reconciliation.
    for (const error of [{ code: "TIMEOUT" }, { code: "NETWORK_ERROR" }, { code: "INVALID_RESPONSE" }, { status: 500 }]) {
        const h = harness(); h.client.publishVersion = async () => { h.posts++; throw Object.assign(new Error("synthetic"), error); };
        const runner = h.make();
        assert.equal((await runner.run(options)).outcome, "mutation-unknown");
        await runner.refresh({ eventId: E }); assert.equal(runner.requiresRefresh(E), true);
        assert.equal((await runner.run(options)).outcome, "refresh-required"); assert.equal(h.posts, 1);
        const get = h.client.getEditorialState; h.client.getEditorialState = async () => { throw Error("synthetic-offline"); };
        await assert.rejects(runner.refresh({ eventId: E })); assert.equal(runner.requiresRefresh(E), true);
        h.client.getEditorialState = get; h.current = published(E);
        await runner.refresh({ eventId: E, isCurrent: () => false }); assert.equal(runner.requiresRefresh(E), true);
        await runner.refresh({ eventId: E }); assert.equal(runner.requiresRefresh(E), false); assert.equal(h.posts, 1);
    }
    const crossRecovery = harness(); crossRecovery.client.publishVersion = async () => { throw Error("synthetic"); };
    const crossRunner = crossRecovery.make(); await crossRunner.run(options); crossRecovery.current = published("crossed-event");
    await assert.rejects(crossRunner.refresh({ eventId: E })); assert.equal(crossRunner.requiresRefresh(E), true);
    crossRecovery.current = state("synthetic-other");
    const other = await crossRunner.run({ ...options, eventId: "synthetic-other", isCurrent: () => false });
    assert.equal(other.outcome, "stale-view"); assert.equal(crossRunner.requiresRefresh(E), true);

    const gate = deferred(), simultaneous = harness();
    const runner = simultaneous.make(async () => { await gate.promise; return publicationPhrase(E); });
    const first = runner.run(options);
    assert.equal((await runner.run(options)).outcome, "busy");
    await assert.rejects(runner.refresh({ eventId: E }), e => e.code === "BUSY");
    gate.resolve(); assert.equal((await first).outcome, "success"); assert.equal(simultaneous.posts, 1);

    const conflict = harness(); let failRecovery = true;
    conflict.client.publishVersion = async () => {
        conflict.posts++; throw Object.assign(Error("Synthetic conflict"), { status: 409 });
    };
    const read = conflict.client.getEditorialState;
    conflict.client.getEditorialState = async () => {
        if (conflict.reads >= 2 && failRecovery) throw Error("Synthetic recovery unavailable");
        return read();
    };
    const conflictRunner = conflict.make();
    assert.equal((await conflictRunner.run(options)).outcome, "conflict-refresh-failed");
    assert.equal((await conflictRunner.run(options)).outcome, "refresh-required"); assert.equal(conflict.posts, 1);
    failRecovery = false; await conflictRunner.refresh(options); assert.equal(conflictRunner.requiresRefresh(E), false);
    const auth = harness(); auth.client.publishVersion = async () => { auth.posts++; throw Object.assign(Error("Synthetic rejected"), { status: 401 }); };
    const authRunner = auth.make(); await assert.rejects(authRunner.run(options));
    assert.equal(auth.posts, 1); assert.equal(authRunner.requiresRefresh(E), false);

    for (const [status, payload] of [[200, {}], [200, { ...receipt, eventId: "other" }],
        [200, { ...receipt, publishedVersionId: "other" }], [201, receipt], [500, { error: { code: "SERVER_ERROR" } }]]) {
        let posts = 0; const client = createAdminEditorialClient({ fetchImpl: async () => { posts++; return response(status, payload); } });
        await assert.rejects(client.publishVersion(options)); assert.equal(posts, 1);
    }
    for (const payload of [{ eventId: E, versionId: "other", workflowStatus: "in_review" },
        { eventId: E, versionId: V, workflowStatus: "approved" }]) {
        const client = createAdminEditorialClient({ fetchImpl: async () => response(200, payload) });
        await assert.rejects(client.transitionWorkflow({ ...options, expectedStatus: "draft", targetStatus: "in_review" }));
    }
    const json = createAdminEditorialClient({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw Error("private-marker"); } }) });
    await assert.rejects(json.publishVersion(options), e => e.code === "INVALID_RESPONSE" && !e.message.includes("private-marker"));
    const invalidState = createAdminEditorialClient({ fetchImpl: async () => response(200, { ...state(), publishedVersionId: undefined }) });
    await assert.rejects(invalidState.getEditorialState(options), e => e.code === "INVALID_RESPONSE");

    // Timeout before POST sends no mutation. A timed-out POST can still finish remotely.
    let posts = 0;
    const before = createAdminEditorialClient({ editorialTimeoutMs: 15, fetchImpl: (_url, o) => {
        if (o.method === "POST") posts++;
        return new Promise(() => {});
    } });
    const beforeRunner = createActionRunner({ client: before, confirmPublication: () => publicationPhrase(E) });
    await assert.rejects(beforeRunner.run(options), e => e.code === "TIMEOUT"); assert.equal(posts, 0); assert.equal(beforeRunner.requiresRefresh(E), false);
    let preflightReads = 0;
    const secondReadTimeout = createAdminEditorialClient({ editorialTimeoutMs: 15, fetchImpl: (_url, o) => {
        if (o.method === "POST") posts++;
        return ++preflightReads === 1 ? Promise.resolve(response(200, state())) : new Promise(() => {});
    } });
    const secondRunner = createActionRunner({ client: secondReadTimeout, confirmPublication: () => publicationPhrase(E) });
    await assert.rejects(secondRunner.run(options), e => e.code === "TIMEOUT"); assert.equal(posts, 0);
    for (const phase of ["transport", "json"]) {
        let server = state(), signal; posts = 0; const late = deferred();
        const client = createAdminEditorialClient({ editorialTimeoutMs: 15, fetchImpl: async (_url, o) => {
            assert.equal(o.redirect, "error");
            if (o.method === "GET") return response(200, server);
            posts++; signal = o.signal;
            if (phase === "transport") return late.promise;
            return { ok: true, status: 200, json: () => late.promise };
        } });
        const timeoutRunner = createActionRunner({ client, confirmPublication: () => publicationPhrase(E) });
        assert.equal((await timeoutRunner.run(options)).outcome, "mutation-unknown"); assert.equal(signal.aborted, true);
        await timeoutRunner.refresh(options); assert.equal(timeoutRunner.requiresRefresh(E), true);
        assert.equal((await timeoutRunner.run(options)).outcome, "refresh-required"); assert.equal(posts, 1);
        server = published(E); late.resolve(phase === "transport" ? response(200, receipt) : receipt);
        await timeoutRunner.refresh(options); assert.equal(timeoutRunner.requiresRefresh(E), false); assert.equal(posts, 1);
    }
    console.log("editorial safety PASS: exact preconditions, receipts, postconditions, timeouts, reconciliation and no duplicate POST");
})().catch(error => { console.error(error); process.exitCode = 1; });
