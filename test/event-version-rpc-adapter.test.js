const assert = require("assert");
const {
    EventVersionRpcError,
    createEventVersionRpcAdapter
} = require("../js/core/event-version-rpc-adapter");

const EVENT_ID = "client-event";
const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const WORKING_ID = "33333333-3333-4333-8333-333333333333";

function createHarness(responses) {
    const calls = [];
    const queue = Array.isArray(responses) ? [...responses] : [responses];
    const client = {
        async rpc(name, parameters) {
            calls.push({ name, parameters });
            const response = queue.shift();
            if (response instanceof Error) throw response;
            return response;
        }
    };
    return {
        adapter: createEventVersionRpcAdapter(client),
        calls
    };
}

function success(data) {
    return { data: [data], error: null };
}

function failure(code, extra = {}) {
    return {
        data: null,
        error: { code: "P0001", message: code, ...extra }
    };
}

async function expectCode(expectedCode, action) {
    await assert.rejects(action, (error) => {
        assert(error instanceof EventVersionRpcError);
        assert.strictEqual(error.code, expectedCode);
        return true;
    });
}

(async () => {
    const content = {
        schema_version: 2,
        event: { title: "Unchanged" },
        sections: [{ id: "hero", enabled: true }]
    };
    const contentBefore = JSON.stringify(content);
    const createWithNulls = createHarness(success({
        version_id: VERSION_ID,
        version_number: 1
    }));
    const created = await createWithNulls.adapter.createVersion({
        eventId: EVENT_ID,
        content
    });
    assert.deepStrictEqual(createWithNulls.calls, [{
        name: "create_event_version",
        parameters: {
            p_event_id: EVENT_ID,
            p_content: content,
            p_expected_working_version_id: null,
            p_source_version_id: null,
            p_initial_workflow: "draft"
        }
    }]);
    assert.strictEqual(createWithNulls.calls[0].parameters.p_content, content);
    assert.strictEqual(JSON.stringify(content), contentBefore);
    assert.deepStrictEqual(created, {
        versionId: VERSION_ID,
        versionNumber: 1
    });

    const createWithUuids = createHarness(success({
        version_id: VERSION_ID,
        version_number: "2"
    }));
    assert.deepStrictEqual(await createWithUuids.adapter.createVersion({
        eventId: EVENT_ID,
        content,
        expectedWorkingVersionId: WORKING_ID,
        sourceVersionId: SOURCE_ID,
        initialWorkflow: "approved"
    }), {
        versionId: VERSION_ID,
        versionNumber: 2
    });
    assert.deepStrictEqual(createWithUuids.calls[0], {
        name: "create_event_version",
        parameters: {
            p_event_id: EVENT_ID,
            p_content: content,
            p_expected_working_version_id: WORKING_ID,
            p_source_version_id: SOURCE_ID,
            p_initial_workflow: "approved"
        }
    });

    const publish = createHarness(success({
        event_id: EVENT_ID,
        published_version_id: VERSION_ID
    }));
    assert.deepStrictEqual(await publish.adapter.publishVersion({
        eventId: EVENT_ID,
        versionId: VERSION_ID
    }), {
        eventId: EVENT_ID,
        publishedVersionId: VERSION_ID
    });
    assert.deepStrictEqual(publish.calls, [{
        name: "publish_event_version",
        parameters: { p_event_id: EVENT_ID, p_version_id: VERSION_ID }
    }]);

    const rollback = createHarness(success({
        event_id: EVENT_ID,
        published_version_id: SOURCE_ID
    }));
    assert.deepStrictEqual(await rollback.adapter.rollbackVersion({
        eventId: EVENT_ID,
        versionId: SOURCE_ID
    }), {
        eventId: EVENT_ID,
        publishedVersionId: SOURCE_ID
    });
    assert.deepStrictEqual(rollback.calls, [{
        name: "rollback_event_version",
        parameters: { p_event_id: EVENT_ID, p_version_id: SOURCE_ID }
    }]);

    const archive = createHarness(success({
        event_id: EVENT_ID,
        event_status: "archived"
    }));
    assert.deepStrictEqual(await archive.adapter.archiveEvent({ eventId: EVENT_ID }), {
        eventId: EVENT_ID,
        eventStatus: "archived"
    });
    assert.deepStrictEqual(archive.calls, [{
        name: "archive_event",
        parameters: { p_event_id: EVENT_ID }
    }]);

    for (const code of [
        "VERSION_CONFLICT",
        "EVENT_NOT_FOUND",
        "VERSION_NOT_FOUND",
        "EVENT_ARCHIVED",
        "INVALID_EVENT",
        "INVALID_WORKFLOW",
        "VERSION_EVENT_MISMATCH"
    ]) {
        const errors = createHarness(failure(code));
        await expectCode(code, () => errors.adapter.createVersion({
            eventId: EVENT_ID,
            content
        }));
    }

    // SQL reports these three domain scenarios using its existing generic codes.
    const notWorking = createHarness(failure("VERSION_CONFLICT"));
    await expectCode("VERSION_CONFLICT", () => notWorking.adapter.publishVersion({
        eventId: EVENT_ID,
        versionId: VERSION_ID
    }));

    const notApproved = createHarness(failure("INVALID_WORKFLOW"));
    await expectCode("INVALID_WORKFLOW", () => notApproved.adapter.publishVersion({
        eventId: EVENT_ID,
        versionId: VERSION_ID
    }));

    const rollbackNotAllowed = createHarness(failure("INVALID_WORKFLOW"));
    await expectCode("INVALID_WORKFLOW", () => rollbackNotAllowed.adapter.rollbackVersion({
        eventId: EVENT_ID,
        versionId: VERSION_ID
    }));

    const remoteError = {
        code: "XX999",
        message: "database detail that must not be exposed",
        details: "private payload"
    };
    const unknown = createHarness({ data: null, error: remoteError });
    await assert.rejects(
        () => unknown.adapter.archiveEvent({ eventId: EVENT_ID }),
        (error) => {
            assert(error instanceof EventVersionRpcError);
            assert.strictEqual(error.code, undefined);
            assert.strictEqual(error.message, "Versioning persistence operation failed.");
            assert.strictEqual(error.cause, remoteError);
            assert(!JSON.stringify(error).includes("private payload"));
            return true;
        }
    );

    const networkFailure = createHarness(new Error("connection internals"));
    await assert.rejects(
        () => networkFailure.adapter.archiveEvent({ eventId: EVENT_ID }),
        (error) => error instanceof EventVersionRpcError
            && error.code === undefined
            && error.message === "Versioning persistence operation failed."
    );

    assert.throws(
        () => createEventVersionRpcAdapter({}),
        /supabase must implement rpc/
    );

    console.log("event-version-rpc-adapter tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
