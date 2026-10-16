"use strict";
const assert = require("node:assert/strict");
const contract = require("../js/core/editorial-preconditions");
const { createAdminEditorialClient, createWorkingVersionRunner, normalizeEditorialState } = require("../js/core/admin-editorial-client");
const { createActionRunner, getAvailableAction, publicationPhrase } = require("../js/core/admin-editorial-workflow");
const { createEventVersionEditorialService } = require("../js/core/event-version-editorial-service");
const { createEventVersionEditorialHttp } = require("../js/core/event-version-editorial-http");
const { createEventVersionRpcAdapter } = require("../js/core/event-version-rpc-adapter");
const { createEventVersionReadRepository } = require("../js/core/event-version-read-repository-supabase");
const { stateKey } = require("../js/core/admin-event-summary");
const E = "synthetic-atomic", P = "11111111-1111-4111-8111-111111111111", V = "22222222-2222-4222-8222-222222222222";
const HIGH = "9007199254740993", NEXT = "9007199254740994";
const expected = { expectedPublishedVersionId: P, expectedPublicationRevision: HIGH };
const options = { eventId: E, versionId: V, password: "synthetic-only", ...expected };
const state = () => ({ eventId: E, eventStatus: "active", publishedVersionId: P, publicationRevision: HIGH,
    currentWorkingVersionId: V, versions: [{ versionId: P, versionNumber: 1, workflowStatus: "approved" },
        { versionId: V, versionNumber: 2, workflowStatus: "approved" }] });
const published = () => ({ ...state(), publishedVersionId: V, publicationRevision: NEXT, currentWorkingVersionId: null,
    versions: state().versions.map(v => ({ ...v, publishedAt: "2030-01-01T00:00:00Z" })) });
const receipt = () => ({ eventId: E, publishedVersionId: V, publicationRevision: NEXT });
const response = (status, value) => ({ status, ok: status >= 200 && status < 300, json: async () => value });
const runOptions = { ...options, requestedKind: "publish", expectedStatus: "approved" };
function workflow() {
    const h = { state: state(), posts: [], reads: 0 };
    h.client = { async getEditorialState() { h.reads++; return structuredClone(h.state); },
        async transitionWorkflow() { throw Error("Unexpected transition"); },
        async publishVersion(value) { h.posts.push(value); h.state = published(); return receipt(); } };
    h.runner = confirm => createActionRunner({ client: h.client, confirmPublication: confirm || (() => publicationPhrase(E)) });
    return h;
}
function serviceHarness() {
    const calls = [], reads = [];
    const adapter = Object.fromEntries(["createEvent", "createVersion", "transitionWorkflow", "publishVersion", "rollbackVersion"]
        .map(method => [method, async value => { calls.push({ method, value }); return receipt(); }]));
    const service = createEventVersionEditorialService(adapter, { readRepository: { async getVersion(eventId, versionId) {
        reads.push({ eventId, versionId }); return { eventId, versionId, content: { nombre: "Synthetic legacy" } };
    } } });
    return { service, calls, reads };
}
async function http(service, body, rollback = false, params = { eventId: E, versionId: V }) {
    const handlers = createEventVersionEditorialHttp({ service, readRepository: {},
        adminAccess: { async authorize() { return { ok: true, origin: "https://synthetic.invalid" }; } } });
    const res = { status(n) { this.http = n; return this; }, json(value) { this.body = value; return this; } };
    await handlers[rollback ? "rollbackVersion" : "publishVersion"]({ params, body }, res);
    return res;
}
(async () => {
    for (const value of ["0", "1", HIGH, "9223372036854775807"]) assert(contract.revision(value));
    for (const value of [undefined, null, 0, 9007199254740992, "", "01", "-1", "1.0", "1e3", " 1", "1\n", "9223372036854775808"])
        assert.equal(contract.revision(value), false, String(value));
    assert.equal(contract.resultingRevision(expected, V), NEXT);
    assert.equal(contract.resultingRevision(expected, P), HIGH);
    assert.deepEqual(contract.expectations({ expectedPublishedVersionId: null, expectedPublicationRevision: "0" }),
        { expectedPublishedVersionId: null, expectedPublicationRevision: "0" });
    for (const rollback of [false, true]) {
        const full = { ...options, ...(rollback ? { expectedWorkingVersionId: null } : {}) };
        for (const key of Object.keys(contract.expectations(full, rollback))) {
            const missing = { ...full }; delete missing[key];
            assert.throws(() => contract.expectations(missing, rollback), { code: "PRECONDITION_REQUIRED" });
            const h = serviceHarness();
            await assert.rejects(h.service[rollback ? "rollbackVersion" : "publishVersion"](missing), { code: "PRECONDITION_REQUIRED" });
            assert.equal(h.calls.length, 0); assert.equal(h.reads.length, 0);
            const r = await http(h.service, missing, rollback); assert.equal(r.http, 428);
            assert.equal(r.body.error.code, "PRECONDITION_REQUIRED"); assert.equal(h.calls.length, 0);
        }
        for (const bad of [{ expectedPublicationRevision: null }, { expectedPublicationRevision: 1 },
            { expectedPublishedVersionId: undefined }, { expectedPublishedVersionId: "invalid" },
            { versionId: "invalid" }, ...(rollback ? [{ expectedWorkingVersionId: "invalid" }, { expectedWorkingVersionId: undefined }] : [])]) {
            const h = serviceHarness(); const value = { ...full, ...bad };
            await assert.rejects(h.service[rollback ? "rollbackVersion" : "publishVersion"](value), { code: "INVALID_REQUEST" });
            assert.equal(h.reads.length, 0); assert.equal(h.calls.length, 0);
            // The publish destination comes from the URL; its UUID check is covered below at the client/adapter.
            if (!Object.hasOwn(bad, "versionId")) assert.equal((await http(h.service, value, rollback)).http, 400);
        }
        const h = serviceHarness(); const valid = await http(h.service, full, rollback);
        assert.equal(valid.http, 200); assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0].value.expectedPublicationRevision, HIGH);
        assert.equal(h.calls[0].value.expectedPublishedVersionId, P);
        if (rollback) assert.equal(h.calls[0].value.expectedWorkingVersionId, null);
    }
    for (const [code, status] of [["PRECONDITION_REQUIRED", 428], ["INVALID_REQUEST", 400], ["VERSION_CONFLICT", 409]]) {
        const r = await http({ async publishVersion() { throw Object.assign(Error("private-detail"), { code }); } }, expected);
        assert.equal(r.http, status); assert.equal(r.body.error.code, code); assert(!JSON.stringify(r.body).includes("private-detail"));
    }

    for (const rollback of [false, true]) {
        const calls = []; const full = { ...options, ...(rollback ? { expectedWorkingVersionId: null } : {}) };
        const adapter = createEventVersionRpcAdapter({ async rpc(name, parameters) {
            calls.push({ name, parameters }); return { data: [{ event_id: E, published_version_id: V, publication_revision: NEXT }], error: null };
        } });
        assert.deepEqual(await adapter[rollback ? "rollbackVersion" : "publishVersion"](full), receipt());
        assert.deepEqual(calls, [{ name: rollback ? "rollback_event_version" : "publish_event_version_audited", parameters: {
            p_event_id: E, p_version_id: V, p_expected_published_version_id: P, p_expected_publication_revision: HIGH,
            ...(rollback ? { p_expected_working_version_id: null } : { p_admin_identity: "shared-admin-credential", p_ip: null, p_origin: null, p_action: "PUBLISH_VERSION" })
        } }]);
        assert.throws(() => adapter[rollback ? "rollbackVersion" : "publishVersion"]({ eventId: E, versionId: V }), { code: "PRECONDITION_REQUIRED" });
        assert.equal(calls.length, 1);
    }
    for (const wrong of [{ event_id: "other" }, { published_version_id: P }, { publication_revision: HIGH },
        { publication_revision: 9007199254740994 }, { publication_revision: undefined }]) {
        let posts = 0;
        const a = createEventVersionRpcAdapter({ async rpc() { posts++; return { data: [{ event_id: E, published_version_id: V, publication_revision: NEXT, ...wrong }] }; } });
        await assert.rejects(a.publishVersion(options)); assert.equal(posts, 1);
    }
    let attempts = 0;
    const unavailable = createEventVersionRpcAdapter({ async rpc() { attempts++; return { error: { code: "42883", message: "No matching signature" } }; } });
    await assert.rejects(unavailable.publishVersion(options)); assert.equal(attempts, 1);

    for (const bad of [{}, { ...expected, expectedPublicationRevision: 1 }, { ...expected, versionId: "not-a-uuid" }]) {
        let calls = 0; const c = createAdminEditorialClient({ fetchImpl: async () => { calls++; throw Error("Must not fetch"); } });
        await assert.rejects(c.publishVersion({ eventId: E, versionId: V, password: "synthetic", ...bad })); assert.equal(calls, 0);
    }
    for (const [status, code] of [[428, "PRECONDITION_REQUIRED"], [400, "INVALID_REQUEST"], [409, "VERSION_CONFLICT"]]) {
        let calls = 0; const c = createAdminEditorialClient({ fetchImpl: async () => { calls++; return response(status, { error: { code } }); } });
        await assert.rejects(c.publishVersion(options), e => e.status === status && e.code === code); assert.equal(calls, 1);
    }
    const sent = []; const c = createAdminEditorialClient({ fetchImpl: async (_url, request) => { sent.push(JSON.parse(request.body)); return response(200, receipt()); } });
    assert.deepEqual(await c.publishVersion(options), receipt()); assert.deepEqual(sent, [expected]);
    assert.equal(normalizeEditorialState(state()).publicationRevision, HIGH);
    assert.throws(() => normalizeEditorialState({ ...state(), publicationRevision: 1 }), { code: "INVALID_RESPONSE" });
    const missingRevision = state(); delete missingRevision.publicationRevision;
    assert.equal(getAvailableAction(normalizeEditorialState(missingRevision)), null);
    assert.notEqual(stateKey(state()), stateKey({ ...state(), publicationRevision: "9007199254740995" }));

    const good = workflow(); let confirmed;
    const result = await good.runner(action => { confirmed = action; return publicationPhrase(E); }).run(runOptions);
    assert.equal(result.outcome, "success"); assert.equal(good.posts.length, 1);
    assert.equal(confirmed.expectedPublicationRevision, HIGH); assert.equal(confirmed.expectedPublishedVersionId, P);
    assert.equal(good.posts[0].expectedPublicationRevision, confirmed.expectedPublicationRevision);
    assert.equal(good.posts[0].expectedPublishedVersionId, confirmed.expectedPublishedVersionId);
    // A -> B -> A preserves the pointer but must invalidate the confirmed revision.
    const aba = workflow(); const abaRunner = aba.runner(() => { aba.state.publicationRevision = "9007199254740995"; return publicationPhrase(E); });
    assert.equal((await abaRunner.run(runOptions)).outcome, "stale"); assert.equal(aba.posts.length, 0);
    const absent = workflow(); delete absent.state.publicationRevision;
    await assert.rejects(absent.runner().run(runOptions)); assert.equal(absent.posts.length, 0);
    for (const wrong of [{ publicationRevision: HIGH }, { eventId: "other" }, { publishedVersionId: P }]) {
        const h = workflow(); h.client.publishVersion = async value => { h.posts.push(value); h.state = published(); return { ...receipt(), ...wrong }; };
        const r = h.runner(); assert.equal((await r.run(runOptions)).outcome, "mutation-unknown");
        assert.equal(r.requiresRefresh(E), true); assert.equal((await r.run(runOptions)).outcome, "refresh-required"); assert.equal(h.posts.length, 1);
    }
    for (const wrong of [HIGH, "9007199254740995"]) {
        const h = workflow(); h.client.publishVersion = async value => { h.posts.push(value); h.state = { ...published(), publicationRevision: wrong }; return receipt(); };
        const r = h.runner(); assert.equal((await r.run(runOptions)).outcome, "mutation-unknown");
        await r.refresh({ eventId: E }); assert.equal(r.requiresRefresh(E), true); assert.equal(h.posts.length, 1);
        h.state = published(); await r.refresh({ eventId: E }); assert.equal(r.requiresRefresh(E), false);
    }
    for (const status of [400, 428, 409]) {
        const h = workflow(); h.client.publishVersion = async value => { h.posts.push(value); throw Object.assign(Error("Rejected"), { status, rejectionConfirmed: true }); };
        const r = h.runner(); if (status === 409) assert.equal((await r.run(runOptions)).outcome, "conflict");
        else await assert.rejects(r.run(runOptions));
        assert.equal(h.posts.length, 1); assert.equal(r.requiresRefresh(E), false);
    }
    for (const revision of [HIGH, 9007199254740992]) {
        const queries = [];
        const repository = createEventVersionReadRepository({ from(table) {
            queries.push(table); return { select(columns) { queries.push(columns); return this; }, eq() { return this; },
                maybeSingle: async () => ({ data: { id: E, event_status: "active", published_version_id: null, current_working_version_id: null, publication_revision: revision } }),
                order: async () => ({ data: [] }) };
        } });
        if (typeof revision === "string") assert.equal((await repository.getEditorialState(E)).publicationRevision, HIGH);
        else await assert.rejects(repository.getEditorialState(E), { code: "INVALID_RESPONSE" });
        assert.equal(queries[0], "admin_event_publication_state"); assert(queries[1].includes("publication_revision"));
    }
    // C3 reproduction: a status with an empty/crossed/unknown error is ambiguous.
    const invalidErrors = [null, [], {}, { error: [] }, { error: "INVALID_REQUEST" },
        { error: { code: 400 } }, { error: { code: "UNKNOWN" } },
        { rejectionConfirmed: true }, { error: { code: "UNKNOWN", rejectionConfirmed: true } }];
    for (const [status, properCode, crossedCode] of [[400, "INVALID_REQUEST", "PRECONDITION_REQUIRED"],
        [428, "PRECONDITION_REQUIRED", "INVALID_REQUEST"], [409, "VERSION_CONFLICT", "INVALID_REQUEST"]]) {
        for (const malformed of [...invalidErrors, { error: { code: crossedCode } },
            { error: { code: properCode, message: 123 } }, { error: { code: properCode, message: "" } },
            { error: { code: "EVENT_ALREADY_EXISTS" } }, "INVALID_JSON", "INCONSISTENT_OK"]) {
            let current = state(), readsFail = false, posts = 0;
            const realClient = createAdminEditorialClient({ fetchImpl: async (_url, request) => {
                if (request.method === "GET") {
                    if (readsFail) throw Error("Synthetic unavailable");
                    return response(200, current);
                }
                posts++;
                if (malformed === "INVALID_JSON") return { ok: false, status, json: async () => { throw Error("private-detail"); } };
                if (malformed === "INCONSISTENT_OK") return { ok: true, status, json: async () => ({ error: { code: properCode } }) };
                return response(status, malformed);
            } });
            const runner = createActionRunner({ client: realClient, confirmPublication: () => publicationPhrase(E) });
            assert.equal((await runner.run(runOptions)).outcome, "mutation-unknown");
            assert.equal(runner.requiresRefresh(E), true);
            await runner.refresh(options); assert.equal(runner.requiresRefresh(E), true);
            readsFail = true; await assert.rejects(runner.refresh(options)); assert.equal(runner.requiresRefresh(E), true);
            assert.equal((await runner.run(runOptions)).outcome, "refresh-required"); assert.equal(posts, 1);
            readsFail = false; current = published(); await runner.refresh(options);
            assert.equal(runner.requiresRefresh(E), false); assert.equal(posts, 1);
        }
        let posts = 0;
        const realClient = createAdminEditorialClient({ fetchImpl: async (_url, request) => {
            if (request.method === "GET") return response(200, state());
            posts++; return response(status, { error: { code: properCode, message: "Synthetic rejection" } });
        } });
        const runner = createActionRunner({ client: realClient, confirmPublication: () => publicationPhrase(E) });
        if (status === 409) assert.equal((await runner.run(runOptions)).outcome, "conflict");
        else await assert.rejects(runner.run(runOptions), e => e.rejectionConfirmed === true && e.status === status);
        assert.equal(runner.requiresRefresh(E), false); assert.equal(posts, 1);
    }
    // Status-only exceptions from another client are never proof of rejection either.
    for (const status of [400, 428, 409]) {
        const h = workflow(); h.client.publishVersion = async () => { throw Object.assign(Error("Unknown"), { status }); };
        const runner = h.runner(); assert.equal((await runner.run(runOptions)).outcome, "mutation-unknown");
        await runner.refresh(options); assert.equal(runner.requiresRefresh(E), true);
    }

    // Canonical UUIDs are established before capture; event IDs retain exact identity.
    const CP = "aabbccdd-aabb-4ccc-8ddd-aabbccddeeff", CV = "fabcdeff-abcd-4fab-8cde-abcdefabcdef";
    const opaqueEvent = "Synthetic-Event-ID";
    const caps = { expectedPublishedVersionId: CP.toUpperCase(), expectedPublicationRevision: "8", expectedWorkingVersionId: CV.toUpperCase() };
    assert.equal(contract.canonicalUuid(CP.toUpperCase()), CP);
    assert.throws(() => contract.canonicalUuid("invalid"), { code: "INVALID_REQUEST" });
    assert.deepEqual(contract.expectations(caps, true), { expectedPublishedVersionId: CP, expectedPublicationRevision: "8", expectedWorkingVersionId: CV });
    assert.equal(contract.resultingRevision(caps, CP), "8");
    assert.equal(contract.receipt({ eventId: opaqueEvent, publishedVersionId: CP.toUpperCase(), publicationRevision: "8" }, opaqueEvent, CP, caps), true);
    const rpcCalls = [], snapshotReads = [];
    const adapter = createEventVersionRpcAdapter({ async rpc(name, parameters) {
        rpcCalls.push({ name, parameters });
        return { data: [{ event_id: opaqueEvent, published_version_id: parameters.p_version_id.toUpperCase(),
            publication_revision: parameters.p_version_id === CP ? "8" : "9" }] };
    } });
    const service = createEventVersionEditorialService(adapter, { readRepository: { async getVersion(eventId, versionId) {
        snapshotReads.push({ eventId, versionId });
        return { eventId, versionId: versionId.toUpperCase(), content: { nombre: "Synthetic legacy" } };
    } } });
    for (const rollback of [false, true]) {
        const target = rollback ? CP : CV;
        const r = await http(service, { ...caps, versionId: target.toUpperCase() }, rollback,
            { eventId: opaqueEvent, versionId: target.toUpperCase() });
        assert.equal(r.http, 200); assert.equal(r.body.eventId, opaqueEvent); assert.equal(r.body.publishedVersionId, target);
        assert.equal(r.body.publicationRevision, rollback ? "8" : "9");
        const call = rpcCalls.at(-1).parameters;
        assert.equal(call.p_event_id, opaqueEvent); assert.equal(call.p_version_id, target);
        assert.equal(call.p_expected_published_version_id, CP);
        if (rollback) assert.equal(call.p_expected_working_version_id, CV);
        assert.equal(snapshotReads.at(-1).versionId, target);
    }
    const mixedState = () => ({ ...state(), eventId: opaqueEvent, publishedVersionId: CP.toUpperCase(), currentWorkingVersionId: CV.toUpperCase(),
        versions: [{ versionId: CP, versionNumber: 1, workflowStatus: "approved" }, { versionId: CV.toUpperCase(), versionNumber: 2, workflowStatus: "approved" }] });
    let currentCase = mixedState(), normalizedConfirmation, casePosts = 0;
    const caseClient = createAdminEditorialClient({ fetchImpl: async (url, request) => {
        if (request.method === "GET") return response(200, currentCase);
        casePosts++; assert(url.includes(CV)); const body = JSON.parse(request.body);
        assert.equal(body.expectedPublishedVersionId, CP); assert.equal(body.expectedPublicationRevision, HIGH);
        currentCase = { ...mixedState(), currentWorkingVersionId: null, publishedVersionId: CV.toUpperCase(), publicationRevision: NEXT,
            versions: mixedState().versions.map(v => ({ ...v, publishedAt: "2030-01-01T00:00:00Z" })) };
        return response(200, { eventId: opaqueEvent, publishedVersionId: CV.toUpperCase(), publicationRevision: NEXT });
    } });
    const caseRunner = createActionRunner({ client: caseClient, confirmPublication: action => {
        normalizedConfirmation = action; return publicationPhrase(opaqueEvent);
    } });
    const caseResult = await caseRunner.run({ ...runOptions, eventId: opaqueEvent, versionId: CV.toUpperCase(), observedState: mixedState() });
    assert.equal(caseResult.outcome, "success"); assert.equal(casePosts, 1);
    assert.equal(normalizedConfirmation.versionId, CV); assert.equal(normalizedConfirmation.expectedPublishedVersionId, CP);
    assert.equal(caseResult.state.eventId, opaqueEvent);
    assert.throws(() => normalizeEditorialState({ ...mixedState(),
        versions: [mixedState().versions[0], { ...mixedState().versions[1], versionId: CP.toUpperCase() }] }), { code: "INVALID_RESPONSE" });
    const readerQueries = [];
    const canonicalReader = createEventVersionReadRepository({ from(table) {
        return { select() { return this; }, eq(column, value) { readerQueries.push({ table, column, value }); return this; },
            async maybeSingle() { return { data: table === "admin_event_publication_state"
                ? { id: opaqueEvent, event_status: "active", published_version_id: CP.toUpperCase(), current_working_version_id: CV.toUpperCase(), publication_revision: "8" }
                : { id: CV.toUpperCase(), event_id: opaqueEvent, version_number: 2, workflow_status: "approved", content: { synthetic: true } } }; },
            async order() { return { data: [{ id: CP.toUpperCase(), version_number: 1, workflow_status: "approved" },
                { id: CV.toUpperCase(), version_number: 2, workflow_status: "approved" }] }; } };
    } });
    const canonicalState = await canonicalReader.getEditorialState(opaqueEvent);
    assert.equal(canonicalState.eventId, opaqueEvent); assert.equal(canonicalState.publishedVersionId, CP);
    assert.equal(canonicalState.currentWorkingVersionId, CV); assert.equal(canonicalState.versions[1].versionId, CV);
    const canonicalSnapshot = await canonicalReader.getVersion(opaqueEvent, CV.toUpperCase());
    assert.equal(canonicalSnapshot.eventId, opaqueEvent); assert.equal(canonicalSnapshot.versionId, CV);
    assert.equal(readerQueries.at(-1).value, CV);

    // Creation and workflow transitions do not write the published pointer.
    // The existing expectedWorkingVersionId / expectedStatus guards remain sufficient.
    const unversionedRevision = state(); delete unversionedRevision.publicationRevision;
    let workingState = unversionedRevision, creations = 0;
    const CREATED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const creator = createWorkingVersionRunner({ client: {
        async getEditorialState() { return workingState; },
        async getVersion() { return { eventId: E, versionId: V, versionNumber: 2, content: { synthetic: true } }; },
        async createVersion(value) {
            assert.equal(value.expectedWorkingVersionId, V); assert.equal(value.sourceVersionId, V);
            assert.equal(Object.hasOwn(value, "expectedPublicationRevision"), false); creations++;
            workingState = { ...workingState, currentWorkingVersionId: CREATED };
            return { versionId: CREATED, versionNumber: 3 };
        }
    }, confirmCreation: () => true });
    assert.equal((await creator.run({ observedState: unversionedRevision, password: "synthetic" })).outcome, "success");
    assert.equal(creations, 1); assert.equal(workingState.publishedVersionId, P);
    assert.equal(Object.hasOwn(workingState, "publicationRevision"), false);
    const staleCreator = createWorkingVersionRunner({ client: {
        async getEditorialState() { return { ...unversionedRevision, currentWorkingVersionId: CREATED }; },
        async getVersion() { return { versionNumber: 2, content: { synthetic: true } }; },
        async createVersion() { throw Error("Must not write a stale working pointer"); }
    }, confirmCreation: () => true });
    assert.equal((await staleCreator.run({ observedState: unversionedRevision, password: "synthetic" })).outcome, "stale");
    for (const [workflowStatus, requestedKind, targetStatus] of [["draft", "submit", "in_review"], ["in_review", "approve", "approved"]]) {
        let current = { ...unversionedRevision, versions: unversionedRevision.versions.map(v => v.versionId === V ? { ...v, workflowStatus } : v) };
        let transitions = 0;
        const runner = createActionRunner({ client: {
            async getEditorialState() { return current; },
            async publishVersion() { throw Error("Must not publish without revision"); },
            async transitionWorkflow(value) { assert.equal(value.expectedStatus, workflowStatus); transitions++;
                current = { ...current, versions: current.versions.map(v => v.versionId === V ? { ...v, workflowStatus: targetStatus } : v) };
                return { eventId: E, versionId: V, workflowStatus: targetStatus }; }
        }, confirmPublication: () => { throw Error("Unexpected publication"); } });
        assert.equal((await runner.run({ ...runOptions, requestedKind, expectedStatus: workflowStatus })).outcome, "success");
        assert.equal(current.publishedVersionId, P); assert.equal(transitions, 1);
    }
    console.log("atomic editorial contract PASS: C3 reproductions, coherent errors, canonical UUIDs, independent draft creation and no unsafe retries");
})().catch(error => { console.error(error); process.exitCode = 1; });
