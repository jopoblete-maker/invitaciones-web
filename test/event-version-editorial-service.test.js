const assert = require("assert");
const {
    createEventVersionEditorialService
} = require("../js/core/event-version-editorial-service");

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const WORKING_ID = "22222222-2222-4222-8222-222222222222";

function validContent() {
    return {
        schema_version: 1,
        event: {},
        template: { slug: "boda-civil-esencial" },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
        ]
    };
}

function createHarness() {
    const calls = [];
    const adapter = {};
    for (const method of [
        "createVersion",
        "transitionWorkflow",
        "publishVersion",
        "rollbackVersion"
    ]) {
        adapter[method] = async (options) => {
            calls.push({ method, options });
            return { method, ...options };
        };
    }
    return {
        calls,
        service: createEventVersionEditorialService(adapter)
    };
}

async function expectCode(code, action) {
    await assert.rejects(action, (error) => error.code === code, `Expected ${code}`);
}

(async () => {
    const nullWorking = createHarness();
    const content = validContent();
    const before = JSON.stringify(content);
    await nullWorking.service.createVersion({
        eventId: "event-one",
        content,
        expectedWorkingVersionId: null
    });
    assert.deepStrictEqual(nullWorking.calls, [{
        method: "createVersion",
        options: {
            eventId: "event-one",
            content,
            expectedWorkingVersionId: null,
            sourceVersionId: null,
            initialWorkflow: "draft"
        }
    }]);
    assert.strictEqual(nullWorking.calls[0].options.content, content);
    assert.strictEqual(JSON.stringify(content), before);

    const uuidWorking = createHarness();
    await uuidWorking.service.createVersion({
        eventId: "event-one",
        content,
        expectedWorkingVersionId: WORKING_ID,
        sourceVersionId: VERSION_ID,
        initialWorkflow: "draft"
    });
    assert.strictEqual(uuidWorking.calls[0].options.expectedWorkingVersionId, WORKING_ID);
    assert.strictEqual(uuidWorking.calls[0].options.sourceVersionId, VERSION_ID);

    const missingExpected = createHarness();
    await expectCode("INVALID_REQUEST", () => missingExpected.service.createVersion({
        eventId: "event-one",
        content
    }));
    assert.strictEqual(missingExpected.calls.length, 0);
    await expectCode("INVALID_REQUEST", () => createHarness().service.createVersion({
        eventId: "event-one",
        content,
        expectedWorkingVersionId: null,
        initialWorkflow: "approved"
    }));
    const invalidContent = createHarness();
    await expectCode("INVALID_EVENT", () => invalidContent.service.createVersion({
        eventId: "event-one",
        content: { schema_version: 999 },
        expectedWorkingVersionId: null
    }));
    assert.strictEqual(invalidContent.calls.length, 0);

    const operations = createHarness();
    await operations.service.transitionWorkflow({
        eventId: "event-one",
        versionId: VERSION_ID,
        expectedStatus: "draft",
        targetStatus: "in_review"
    });
    await operations.service.transitionWorkflow({
        eventId: "event-one",
        versionId: VERSION_ID,
        expectedStatus: "in_review",
        targetStatus: "approved"
    });
    await operations.service.publishVersion({ eventId: "event-one", versionId: VERSION_ID });
    await operations.service.rollbackVersion({ eventId: "event-one", versionId: VERSION_ID });
    assert.deepStrictEqual(operations.calls.map((call) => call.method), [
        "transitionWorkflow",
        "transitionWorkflow",
        "publishVersion",
        "rollbackVersion"
    ]);

    console.log("event-version-editorial-service tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
