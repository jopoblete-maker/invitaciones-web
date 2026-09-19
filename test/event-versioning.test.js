const assert = require("assert");
const { createEventVersioningService } = require("../js/core/event-versioning");
const { createMemoryEventVersionRepository } = require("../js/core/event-version-repository-memory");

function createHarness() {
    let id = 0;
    let tick = 0;
    const repository = createMemoryEventVersionRepository();
    const service = createEventVersioningService(repository, {
        createVersionId: () => `version-${++id}`,
        now: () => `2027-01-01T00:00:0${tick++}.000Z`
    });
    return { repository, service };
}

function validContent(title = "Invitation") {
    return {
        schema_version: 1,
        event: { title },
        template: { slug: "boda-civil-esencial" },
        sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: {} }]
    };
}

function expectCode(code, action) {
    assert.throws(action, (error) => error.code === code, `Expected ${code}`);
}

function reviewAndApprove(service, eventId, versionId) {
    service.submitForReview(eventId, versionId);
    service.approveVersion(eventId, versionId);
}

{
    const { repository, service } = createHarness();
    const original = validContent("V1");
    const created = service.createEvent({ id: "event-one", content: original, actor: "test" });
    assert.strictEqual(created.version.version_number, 1);
    assert.strictEqual(created.version.workflow_status, "draft");
    assert.strictEqual(created.event.current_working_version_id, created.version.id);
    assert.strictEqual(created.event.published_version_id, null);
    expectCode("EVENT_ALREADY_EXISTS", () => service.createEvent({ id: "event-one", content: original }));
    expectCode("INVALID_EVENT_ID", () => service.createEvent({ id: "Bad Id", content: original }));
    expectCode("INVALID_EVENT", () => service.createEvent({ id: "invalid", content: { schema_version: 99 } }));

    original.event.title = "mutated input";
    assert.strictEqual(service.getWorkingVersion("event-one").content.event.title, "V1");
    const returned = service.getWorkingVersion("event-one");
    returned.content.event.title = "mutated output";
    assert.strictEqual(service.getWorkingVersion("event-one").content.event.title, "V1");
    const history = service.getVersionHistory("event-one");
    history[0].content.event.title = "mutated history";
    assert.strictEqual(repository.getVersion(created.version.id).content.event.title, "V1");
    expectCode("IMMUTABLE_VERSION_FIELD", () => repository.updateVersionMetadata(created.version.id, {
        content: validContent("forbidden")
    }));
}

// Narrative business case: published V1 stays live while V2 is prepared, then rollback restores V1.
{
    const { repository, service } = createHarness();
    const first = service.createEvent({ id: "client-event", content: validContent("V1 public") });
    reviewAndApprove(service, "client-event", first.version.id);
    service.publishVersion("client-event", first.version.id);
    assert.strictEqual(service.getWorkingVersion("client-event"), null);
    assert.strictEqual(service.getPublishedVersion("client-event").content.event.title, "V1 public");

    const second = service.createDraft("client-event");
    assert.strictEqual(second.version.version_number, 2);
    assert.strictEqual(second.version.source_version_id, first.version.id);
    assert.strictEqual(second.event.current_working_version_id, second.version.id);
    assert.strictEqual(second.event.published_version_id, first.version.id);
    assert.strictEqual(service.getPublishedVersion("client-event").content.event.title, "V1 public");
    expectCode("WORKING_VERSION_EXISTS", () => service.createDraft("client-event"));

    reviewAndApprove(service, "client-event", second.version.id);
    service.publishVersion("client-event", second.version.id);
    assert.strictEqual(service.getPublishedVersion("client-event").id, second.version.id);
    assert.strictEqual(service.getWorkingVersion("client-event"), null);
    assert.deepStrictEqual(service.getVersionHistory("client-event").map((item) => item.id), [
        first.version.id,
        second.version.id
    ]);

    service.rollbackToVersion("client-event", first.version.id);
    assert.strictEqual(service.getPublishedVersion("client-event").id, first.version.id);
    assert.strictEqual(service.getVersionHistory("client-event").length, 2);
    assert(repository.getVersion(second.version.id));

    const eventBeforeArchive = repository.getEvent("client-event");
    service.archiveEvent("client-event");
    const archived = repository.getEvent("client-event");
    assert.strictEqual(archived.event_status, "archived");
    assert.strictEqual(archived.published_version_id, eventBeforeArchive.published_version_id);
    assert.strictEqual(service.getVersionHistory("client-event").length, 2);
    expectCode("EVENT_ARCHIVED", () => service.getPublishedVersion("client-event"));
}

{
    const { service } = createHarness();
    const first = service.createEvent({ id: "conflict-event", content: validContent("V1") });
    const second = service.createVersion(
        "conflict-event",
        validContent("V2 saved content"),
        first.version.id
    );
    assert.strictEqual(second.version.version_number, 2);
    assert.strictEqual(second.version.source_version_id, first.version.id);
    assert.strictEqual(service.getWorkingVersion("conflict-event").id, second.version.id);
    expectCode("VERSION_CONFLICT", () => service.createVersion(
        "conflict-event",
        validContent("V3 stale content"),
        first.version.id
    ));
    expectCode("INVALID_WORKFLOW_TRANSITION", () => service.publishVersion("conflict-event", second.version.id));
}

{
    const { service } = createHarness();
    const first = service.createEvent({ id: "owner-one", content: validContent("Owner one") });
    service.createEvent({ id: "owner-two", content: validContent("Owner two") });
    expectCode("VERSION_EVENT_MISMATCH", () => service.publishVersion("owner-two", first.version.id));
    expectCode("EVENT_NOT_PUBLISHED", () => service.getPublishedVersion("owner-one"));
    expectCode("EVENT_NOT_FOUND", () => service.getPublishedVersion("missing-event"));
}

{
    const { service } = createHarness();
    const legacy = service.createEvent({ id: "legacy-event", content: { nombre: "Legacy" } });
    assert.strictEqual(legacy.version.schema_version, null);

    const v2Content = require("./fixtures/event-v2-complete.json");
    const v2 = service.createEvent({ id: "v2-event", content: v2Content });
    assert.strictEqual(v2.version.schema_version, 2);
}

console.log("event-versioning tests passed");
