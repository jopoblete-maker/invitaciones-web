"use strict";

const assert = require("assert");
const {
    getWorkingVersion,
    getAvailableAction,
    publicationPhrase,
    isPublicationConfirmed,
    createViewGuard,
    createActionRunner
} = require("../js/core/admin-editorial-workflow");

const EVENT_ID = "workflow-test-event";
const HISTORICAL_ID = "11111111-1111-4111-8111-111111111111";
const WORKING_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "memory-only-secret";

function state(status = "draft", overrides = {}) {
    return {
        eventId: EVENT_ID,
        eventStatus: "active",
        publishedVersionId: HISTORICAL_ID,
        currentWorkingVersionId: WORKING_ID,
        versions: [
            { versionId: HISTORICAL_ID, versionNumber: 1, workflowStatus: "approved" },
            { versionId: WORKING_ID, versionNumber: 2, workflowStatus: status }
        ],
        ...overrides
    };
}

assert.strictEqual(getWorkingVersion(state()).versionId, WORKING_ID);
assert.deepStrictEqual(getAvailableAction(state("draft")), {
    kind: "submit",
    label: "Enviar a revision",
    expectedStatus: "draft",
    targetStatus: "in_review",
    eventId: EVENT_ID,
    versionId: WORKING_ID,
    versionNumber: 2
});
assert.strictEqual(getAvailableAction(state("in_review")).kind, "approve");
assert.deepStrictEqual(getAvailableAction(state("approved")), {
    kind: "publish",
    label: "Publicar",
    expectedStatus: "approved",
    eventId: EVENT_ID,
    versionId: WORKING_ID,
    versionNumber: 2
});
assert.strictEqual(getAvailableAction(state("published")), null);
assert.strictEqual(getAvailableAction(state("draft", { currentWorkingVersionId: null })), null);
assert.notStrictEqual(getAvailableAction(state("draft")).versionId, HISTORICAL_ID);
assert.strictEqual(publicationPhrase(EVENT_ID), `PUBLICAR ${EVENT_ID}`);
assert.strictEqual(isPublicationConfirmed(getAvailableAction(state("approved")), `PUBLICAR ${EVENT_ID}`), true);
assert.strictEqual(isPublicationConfirmed(getAvailableAction(state("approved")), `publicar ${EVENT_ID}`), false);

function clientHarness(initialState = state("draft")) {
    const calls = [];
    let currentState = initialState;
    const client = {
        async getEditorialState(options) {
            calls.push(["getEditorialState", options]);
            return currentState;
        },
        async transitionWorkflow(options) {
            calls.push(["transitionWorkflow", options]);
            currentState = state(options.targetStatus);
            return { eventId: EVENT_ID, versionId: WORKING_ID, workflowStatus: options.targetStatus };
        },
        async publishVersion(options) {
            calls.push(["publishVersion", options]);
            currentState = state("approved", { currentWorkingVersionId: null, publishedVersionId: WORKING_ID });
            return { eventId: EVENT_ID, publishedVersionId: WORKING_ID };
        }
    };
    return { client, calls, setState: (value) => { currentState = value; } };
}

function deferred() {
    let resolve;
    const promise = new Promise((resolver) => { resolve = resolver; });
    return { promise, resolve };
}

(async () => {
    const viewGuard = createViewGuard();
    const operationA = viewGuard.begin("event-a");
    const operationB = viewGuard.begin("event-b");
    let visibleState = null;
    const responseA = deferred();
    const responseB = deferred();
    const applyResponse = async (operation, pendingResponse) => {
        const response = await pendingResponse;
        if (viewGuard.acceptState(operation, response)) visibleState = response;
    };
    const applyA = applyResponse(operationA, responseA.promise);
    const applyB = applyResponse(operationB, responseB.promise);
    responseB.resolve({ eventId: "event-b" });
    await applyB;
    responseA.resolve({ eventId: "event-a" });
    await applyA;
    assert.strictEqual(visibleState.eventId, "event-b");
    assert.strictEqual(viewGuard.isCurrent(operationA), false);
    assert.strictEqual(viewGuard.isSelected("event-b"), true);
    assert.strictEqual(viewGuard.isSelected("event-a"), false);

    const transition = clientHarness();
    const transitionRunner = createActionRunner({ client: transition.client, confirmPublication: () => null });
    const transitioned = await transitionRunner.run({
        eventId: EVENT_ID,
        versionId: WORKING_ID,
        password: SECRET,
        requestedKind: "submit",
        expectedStatus: "draft"
    });
    assert.strictEqual(transitioned.outcome, "success");
    assert.deepStrictEqual(transition.calls, [
        ["getEditorialState", { eventId: EVENT_ID, password: SECRET }],
        ["transitionWorkflow", {
            eventId: EVENT_ID,
            versionId: WORKING_ID,
            expectedStatus: "draft",
            targetStatus: "in_review",
            password: SECRET
        }],
        ["getEditorialState", { eventId: EVENT_ID, password: SECRET }]
    ]);
    assert.strictEqual(transitioned.state.versions[1].workflowStatus, "in_review");

    const approval = clientHarness(state("in_review"));
    const approvalRunner = createActionRunner({ client: approval.client, confirmPublication: () => null });
    const approved = await approvalRunner.run({
        eventId: EVENT_ID,
        versionId: WORKING_ID,
        password: SECRET,
        requestedKind: "approve",
        expectedStatus: "in_review"
    });
    assert.strictEqual(approved.outcome, "success");
    assert.strictEqual(approval.calls.filter(([name]) => name === "transitionWorkflow").length, 1);
    assert.strictEqual(approval.calls.filter(([name]) => name === "publishVersion").length, 0);
    assert.strictEqual(getAvailableAction(approved.state).kind, "publish");

    for (const confirmation of [null, "", `PUBLICAR otro-evento`]) {
        const cancelled = clientHarness(state("approved"));
        const runner = createActionRunner({ client: cancelled.client, confirmPublication: () => confirmation });
        const result = await runner.run({
            eventId: EVENT_ID,
            versionId: WORKING_ID,
            password: SECRET,
            requestedKind: "publish",
            expectedStatus: "approved"
        });
        assert.strictEqual(result.outcome, "cancelled");
        assert.deepStrictEqual(cancelled.calls.map(([name]) => name), ["getEditorialState"]);
    }

    const publication = clientHarness(state("approved"));
    const publicationRunner = createActionRunner({
        client: publication.client,
        confirmPublication: (action) => publicationPhrase(action.eventId)
    });
    const published = await publicationRunner.run({
        eventId: EVENT_ID,
        versionId: WORKING_ID,
        password: SECRET,
        requestedKind: "publish",
        expectedStatus: "approved"
    });
    assert.strictEqual(published.outcome, "success");
    assert.strictEqual(publication.calls.filter(([name]) => name === "publishVersion").length, 1);
    assert.deepStrictEqual(publication.calls[1], ["publishVersion", {
        eventId: EVENT_ID,
        versionId: WORKING_ID,
        password: SECRET
    }]);
    assert.strictEqual(published.state.currentWorkingVersionId, null);

    let releaseRead;
    const firstRead = new Promise((resolve) => { releaseRead = resolve; });
    const simultaneousCalls = [];
    const simultaneousClient = {
        async getEditorialState(options) {
            simultaneousCalls.push(["getEditorialState", options]);
            await firstRead;
            return state("draft");
        },
        async transitionWorkflow(options) {
            simultaneousCalls.push(["transitionWorkflow", options]);
            return {};
        },
        async publishVersion() { throw new Error("unexpected publish"); }
    };
    const simultaneousRunner = createActionRunner({ client: simultaneousClient, confirmPublication: () => null });
    const simultaneousOptions = {
        eventId: EVENT_ID,
        versionId: WORKING_ID,
        password: SECRET,
        requestedKind: "submit",
        expectedStatus: "draft"
    };
    const firstRun = simultaneousRunner.run(simultaneousOptions);
    const secondRun = await simultaneousRunner.run(simultaneousOptions);
    assert.deepStrictEqual(secondRun, { outcome: "busy" });
    releaseRead();
    await firstRun;
    assert.strictEqual(simultaneousCalls.filter(([name]) => name === "transitionWorkflow").length, 1);

    const conflict = clientHarness();
    let mutationAttempts = 0;
    conflict.client.transitionWorkflow = async () => {
        mutationAttempts += 1;
        conflict.setState(state("in_review"));
        const error = new Error("conflict");
        error.code = "VERSION_CONFLICT";
        error.status = 409;
        throw error;
    };
    const conflictRunner = createActionRunner({ client: conflict.client, confirmPublication: () => null });
    const conflicted = await conflictRunner.run(simultaneousOptions);
    assert.strictEqual(conflicted.outcome, "conflict");
    assert.strictEqual(mutationAttempts, 1);
    assert.strictEqual(conflicted.state.versions[1].workflowStatus, "in_review");

    const stale = clientHarness(state("in_review"));
    const staleRunner = createActionRunner({ client: stale.client, confirmPublication: () => null });
    const staleResult = await staleRunner.run(simultaneousOptions);
    assert.strictEqual(staleResult.outcome, "stale");
    assert.deepStrictEqual(stale.calls.map(([name]) => name), ["getEditorialState"]);

    const replacementId = "33333333-3333-4333-8333-333333333333";
    const replaced = clientHarness(state("draft", {
        currentWorkingVersionId: replacementId,
        versions: [
            { versionId: HISTORICAL_ID, versionNumber: 1, workflowStatus: "approved" },
            { versionId: replacementId, versionNumber: 3, workflowStatus: "draft" }
        ]
    }));
    const replacedRunner = createActionRunner({ client: replaced.client, confirmPublication: () => null });
    const replacedResult = await replacedRunner.run(simultaneousOptions);
    assert.strictEqual(replacedResult.outcome, "stale");
    assert.deepStrictEqual(replaced.calls.map(([name]) => name), ["getEditorialState"]);

    let refreshReads = 0;
    let acceptedMutations = 0;
    const refreshClient = {
        async getEditorialState() {
            refreshReads += 1;
            if (refreshReads === 1) return state("draft");
            if (refreshReads === 2) throw new Error("refresh unavailable");
            return state("in_review");
        },
        async transitionWorkflow() {
            acceptedMutations += 1;
            return { eventId: EVENT_ID, versionId: WORKING_ID, workflowStatus: "in_review" };
        },
        async publishVersion() { throw new Error("unexpected publish"); }
    };
    const refreshRunner = createActionRunner({ client: refreshClient, confirmPublication: () => null });
    const refreshResult = await refreshRunner.run(simultaneousOptions);
    assert.strictEqual(refreshResult.outcome, "accepted-refresh-failed");
    assert.strictEqual(acceptedMutations, 1);

    const refreshGuard = createViewGuard();
    const failedRefreshOperation = refreshGuard.begin(EVENT_ID);
    assert.strictEqual(refreshGuard.requireRefresh(failedRefreshOperation), true);
    assert.strictEqual(refreshGuard.requiresRefresh(), true);
    const retryOperation = refreshGuard.begin(EVENT_ID);
    const recoveredState = await refreshClient.getEditorialState({ eventId: EVENT_ID, password: SECRET });
    assert.strictEqual(refreshGuard.acceptState(retryOperation, recoveredState), true);
    assert.strictEqual(refreshGuard.requiresRefresh(), false);
    assert.strictEqual(acceptedMutations, 1);
    assert.strictEqual(refreshReads, 3);

    let publicationReads = 0;
    let acceptedPublications = 0;
    const publicationRefreshClient = {
        async getEditorialState() {
            publicationReads += 1;
            if (publicationReads === 1) return state("approved");
            throw new Error("publication refresh unavailable");
        },
        async transitionWorkflow() { throw new Error("unexpected transition"); },
        async publishVersion() {
            acceptedPublications += 1;
            return { eventId: EVENT_ID, publishedVersionId: WORKING_ID };
        }
    };
    const publicationRefreshRunner = createActionRunner({
        client: publicationRefreshClient,
        confirmPublication: (action) => publicationPhrase(action.eventId)
    });
    const publicationRefreshResult = await publicationRefreshRunner.run({
        eventId: EVENT_ID,
        versionId: WORKING_ID,
        password: SECRET,
        requestedKind: "publish",
        expectedStatus: "approved"
    });
    assert.strictEqual(publicationRefreshResult.outcome, "accepted-refresh-failed");
    assert.strictEqual(acceptedPublications, 1);
    assert.strictEqual(publicationReads, 2);

    console.log("admin editorial workflow tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
