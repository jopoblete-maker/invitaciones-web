"use strict";

const assert = require("assert");
const {
    AdminEditorialApiError,
    createWorkingVersionRunner,
    workingVersionSource
} = require("../js/core/admin-editorial-client");

const EVENT_ID = "a7-b2-working-version-test";
const PUBLISHED_ID = "11111111-1111-4111-8111-111111111111";
const WORKING_ID = "22222222-2222-4222-8222-222222222222";
const CREATED_ID = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "test-secret";
const CONTENT = Object.freeze({ schema_version: 1, event: {}, template: { slug: "test" }, sections: [] });

function state({ working = null, published = PUBLISHED_ID } = {}) {
    return {
        eventId: EVENT_ID,
        eventStatus: "active",
        currentWorkingVersionId: working,
        publishedVersionId: published,
        versions: []
    };
}

function createHarness({ observed = state(), states, confirm = true, createError, finalError, finalErrorCount = 1 } = {}) {
    const calls = [];
    const confirmations = [];
    const queuedStates = [...(states || [observed, observed, state({ working: CREATED_ID })])];
    let remainingFinalErrors = finalError ? finalErrorCount : 0;
    const client = {
        async getVersion(options) {
            calls.push(["getVersion", options]);
            return { eventId: EVENT_ID, versionId: options.versionId, versionNumber: 7, content: CONTENT };
        },
        async getEditorialState(options) {
            calls.push(["getEditorialState", options]);
            if (remainingFinalErrors > 0 && queuedStates.length === 1) {
                remainingFinalErrors -= 1;
                throw finalError;
            }
            return queuedStates.shift();
        },
        async createVersion(options) {
            calls.push(["createVersion", options]);
            if (createError) throw createError;
            return { versionId: CREATED_ID, versionNumber: 8 };
        }
    };
    const runner = createWorkingVersionRunner({
        client,
        confirmCreation(details) {
            confirmations.push(details);
            return confirm;
        }
    });
    return { runner, calls, confirmations };
}

(async () => {
    assert.strictEqual(workingVersionSource(state()), PUBLISHED_ID);
    assert.strictEqual(workingVersionSource(state({ working: WORKING_ID })), WORKING_ID);
    assert.strictEqual(workingVersionSource(state({ published: null })), null);

    const unavailable = createHarness({ observed: state({ published: null }) });
    assert.strictEqual((await unavailable.runner.run({
        observedState: state({ published: null }),
        password: PASSWORD
    })).outcome, "unavailable");
    assert.strictEqual(unavailable.calls.length, 0);

    const published = createHarness();
    const publishedResult = await published.runner.run({ observedState: state(), password: PASSWORD });
    assert.strictEqual(publishedResult.outcome, "success");
    assert.deepStrictEqual(published.confirmations, [{
        eventId: EVENT_ID,
        sourceVersionId: PUBLISHED_ID,
        sourceVersionNumber: 7,
        expectedWorkingVersionId: null,
        replacesWorkingVersion: false
    }]);
    const publishedCreate = published.calls.find(([name]) => name === "createVersion")[1];
    assert.strictEqual(publishedCreate.content, CONTENT);
    assert.strictEqual(publishedCreate.sourceVersionId, PUBLISHED_ID);
    assert.strictEqual(publishedCreate.expectedWorkingVersionId, null);
    assert.strictEqual(publishedCreate.password, PASSWORD);

    const workingObserved = state({ working: WORKING_ID });
    const cancelled = createHarness({ observed: workingObserved, states: [workingObserved], confirm: false });
    assert.strictEqual((await cancelled.runner.run({ observedState: workingObserved, password: PASSWORD })).outcome, "cancelled");
    assert.strictEqual(cancelled.confirmations[0].sourceVersionId, WORKING_ID);
    assert.strictEqual(cancelled.confirmations[0].expectedWorkingVersionId, WORKING_ID);
    assert.strictEqual(cancelled.confirmations[0].replacesWorkingVersion, true);
    assert.strictEqual(cancelled.calls.some(([name]) => name === "createVersion"), false);

    const changedBeforeConfirmation = state({ working: CREATED_ID });
    const staleEarly = createHarness({ observed: workingObserved, states: [changedBeforeConfirmation] });
    const staleEarlyResult = await staleEarly.runner.run({ observedState: workingObserved, password: PASSWORD });
    assert.strictEqual(staleEarlyResult.outcome, "stale");
    assert.strictEqual(staleEarly.confirmations.length, 0);
    assert.strictEqual(staleEarly.calls.some(([name]) => name === "createVersion"), false);

    const staleLate = createHarness({ observed: workingObserved, states: [workingObserved, changedBeforeConfirmation] });
    const staleLateResult = await staleLate.runner.run({ observedState: workingObserved, password: PASSWORD });
    assert.strictEqual(staleLateResult.outcome, "stale");
    assert.strictEqual(staleLate.confirmations.length, 1);
    assert.strictEqual(staleLate.calls.some(([name]) => name === "createVersion"), false);

    let releaseSnapshot;
    const snapshotGate = new Promise((resolve) => { releaseSnapshot = resolve; });
    let createCount = 0;
    const busyRunner = createWorkingVersionRunner({
        client: {
            async getVersion() { await snapshotGate; return { versionNumber: 1, content: CONTENT }; },
            async getEditorialState() { return state(); },
            async createVersion() { createCount += 1; return { versionId: CREATED_ID, versionNumber: 2 }; }
        },
        confirmCreation: () => true
    });
    const firstRun = busyRunner.run({ observedState: state(), password: PASSWORD });
    assert.strictEqual((await busyRunner.run({ observedState: state(), password: PASSWORD })).outcome, "busy");
    releaseSnapshot();
    assert.strictEqual((await firstRun).outcome, "success");
    assert.strictEqual(createCount, 1);

    const viewChanged = createHarness();
    let current = true;
    viewChanged.runner = createWorkingVersionRunner({
        client: {
            async getVersion() { current = false; return { versionNumber: 1, content: CONTENT }; },
            async getEditorialState() { throw new Error("must not refresh"); },
            async createVersion() { throw new Error("must not create"); }
        },
        confirmCreation: () => { throw new Error("must not confirm"); }
    });
    assert.strictEqual((await viewChanged.runner.run({
        observedState: state(),
        password: PASSWORD,
        isCurrent: () => current
    })).outcome, "stale-view");

    const refreshFailure = new Error("refresh failed after create");
    const accepted = createHarness({ finalError: refreshFailure, finalErrorCount: 2 });
    const acceptedResult = await accepted.runner.run({ observedState: state(), password: PASSWORD });
    assert.strictEqual(acceptedResult.outcome, "accepted-refresh-failed");
    assert.strictEqual(acceptedResult.refreshError, refreshFailure);
    assert.strictEqual(accepted.calls.filter(([name]) => name === "createVersion").length, 1);
    assert.strictEqual(accepted.runner.requiresRefresh(EVENT_ID), true);
    assert.strictEqual((await accepted.runner.run({ observedState: state(), password: PASSWORD })).outcome, "refresh-required");
    assert.strictEqual(accepted.calls.filter(([name]) => name === "createVersion").length, 1);
    await assert.rejects(
        accepted.runner.refresh({ eventId: EVENT_ID, password: PASSWORD }),
        (error) => error === refreshFailure
    );
    assert.strictEqual(accepted.runner.requiresRefresh(EVENT_ID), true);
    const acceptedRecoveredState = await accepted.runner.refresh({ eventId: EVENT_ID, password: PASSWORD });
    assert.strictEqual(acceptedRecoveredState.currentWorkingVersionId, CREATED_ID);
    assert.strictEqual(accepted.runner.requiresRefresh(EVENT_ID), false);

    let uncertainReads = 0;
    let uncertainCreates = 0;
    const uncertainRunner = createWorkingVersionRunner({
        client: {
            async getVersion() { return { versionNumber: 1, content: CONTENT }; },
            async getEditorialState() {
                uncertainReads += 1;
                if (uncertainReads <= 2) return state();
                if (uncertainReads === 3) throw new AdminEditorialApiError("NETWORK_ERROR", "read failed");
                return state({ working: CREATED_ID });
            },
            async createVersion() {
                uncertainCreates += 1;
                throw new AdminEditorialApiError("NETWORK_ERROR", "response lost");
            }
        },
        confirmCreation: () => true
    });
    const uncertainResult = await uncertainRunner.run({ observedState: state(), password: PASSWORD });
    assert.strictEqual(uncertainResult.outcome, "mutation-unknown");
    assert.strictEqual(uncertainCreates, 1);
    assert.strictEqual(uncertainRunner.requiresRefresh(EVENT_ID), true);
    assert.strictEqual((await uncertainRunner.run({ observedState: state(), password: PASSWORD })).outcome, "refresh-required");
    assert.strictEqual(uncertainCreates, 1);
    await assert.rejects(
        uncertainRunner.refresh({ eventId: EVENT_ID, password: PASSWORD }),
        (error) => error.code === "NETWORK_ERROR"
    );
    assert.strictEqual(uncertainRunner.requiresRefresh(EVENT_ID), true);
    assert.strictEqual((await uncertainRunner.refresh({ eventId: EVENT_ID, password: PASSWORD })).currentWorkingVersionId, CREATED_ID);
    assert.strictEqual(uncertainRunner.requiresRefresh(EVENT_ID), false);
    assert.strictEqual(uncertainCreates, 1);

    const conflictError = new AdminEditorialApiError("VERSION_CONFLICT", "conflict", 409);
    const conflictState = state({ working: CREATED_ID });
    const conflict = createHarness({
        states: [state(), state(), conflictState],
        createError: conflictError
    });
    const conflictResult = await conflict.runner.run({ observedState: state(), password: PASSWORD });
    assert.strictEqual(conflictResult.outcome, "conflict");
    assert.strictEqual(conflictResult.state, conflictState);
    assert.strictEqual(conflict.calls.filter(([name]) => name === "createVersion").length, 1);

    let releaseConflictRefresh;
    const conflictRefreshGate = new Promise((resolve) => { releaseConflictRefresh = resolve; });
    let conflictStateReads = 0;
    const pendingConflictRunner = createWorkingVersionRunner({
        client: {
            async getVersion() { return { versionNumber: 1, content: CONTENT }; },
            async getEditorialState() {
                conflictStateReads += 1;
                if (conflictStateReads < 3) return state();
                await conflictRefreshGate;
                return conflictState;
            },
            async createVersion() { throw conflictError; }
        },
        confirmCreation: () => true
    });
    const pendingConflict = pendingConflictRunner.run({ observedState: state(), password: PASSWORD });
    while (conflictStateReads < 3) await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual((await pendingConflictRunner.run({ observedState: state(), password: PASSWORD })).outcome, "busy");
    releaseConflictRefresh();
    assert.strictEqual((await pendingConflict).outcome, "conflict");

    const incompatible = createHarness({
        createError: new AdminEditorialApiError("INVALID_EVENT", "invalid", 422)
    });
    await assert.rejects(
        incompatible.runner.run({ observedState: state(), password: PASSWORD }),
        (error) => error.status === 422 && error.code === "INVALID_EVENT"
    );
    assert.strictEqual(incompatible.calls.filter(([name]) => name === "createVersion").length, 1);

    console.log("admin working-version creation test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
