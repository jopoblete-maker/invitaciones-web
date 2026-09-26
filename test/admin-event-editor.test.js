"use strict";

const assert = require("assert");
const { AdminEditorialApiError } = require("../js/core/admin-editorial-client");
const {
    AdminEventEditorError,
    applyEdits,
    createDraftSaveRunner,
    createEditorModel
} = require("../js/core/admin-event-editor");

const EVENT_ID = "synthetic-editor-event";
const DRAFT_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_ID = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "synthetic-password";

function snapshot(overrides = {}) {
    return {
        schema_version: 2,
        id: EVENT_ID,
        event_type: "wedding",
        status: "approved",
        identity: { title: "Titulo original", subtitle: "Subtitulo original", untouched: "identity" },
        schedule: { date: "2030-03-14", time: "20:00", date_text: "14 DE MARZO", time_text: "20:00 hs." },
        location: { name: "Salon sintetico", address: "Calle 1", city: "Ciudad inicial", maps_url: "https://example.test/map" },
        template: { slug: "boda-civil-esencial" },
        theme: { slug: "romantico" },
        sections: [
            { id: "hero-primary", type: "hero", enabled: true, order: 10, data: { title: "Titulo original", subtitle: "Subtitulo original", media_id: "cover" }, config: {} },
            { id: "event-details", type: "event-info", enabled: true, order: 20, data: { address: "Calle 1", city: "Ciudad inicial", dateText: "14 DE MARZO" }, config: {} },
            { id: "venue", type: "location", enabled: true, order: 30, data: { address: "Calle 1", city: "Ciudad inicial" }, config: { show_maps: true } },
            { id: "farewell", type: "closing", enabled: true, order: 40, data: { title: "Hasta pronto", message: "Gracias", names: "A y B", media_id: "cover" }, config: {} }
        ],
        modules: {},
        media: { items: { cover: { type: "image", src: "https://example.test/cover.jpg", untouched: true } } },
        metadata: { nested: { preserve: [1, 2, 3] } },
        ...overrides
    };
}

function state({ working = DRAFT_ID, status = "draft" } = {}) {
    return {
        eventId: EVENT_ID,
        eventStatus: "active",
        currentWorkingVersionId: working,
        publishedVersionId: null,
        versions: working ? [{ versionId: working, versionNumber: 4, workflowStatus: status }] : []
    };
}

function version(content = snapshot(), overrides = {}) {
    return {
        eventId: EVENT_ID,
        versionId: DRAFT_ID,
        versionNumber: 4,
        workflowStatus: "draft",
        content,
        ...overrides
    };
}

function editableValues(model, overrides = {}) {
    return {
        heroTitle: model.fields.heroTitle.value,
        heroSubtitle: model.fields.heroSubtitle.value,
        address: model.fields.address.value,
        city: model.fields.city.value,
        closingTitle: model.fields.closingTitle.value,
        closingMessage: model.fields.closingMessage.value,
        closingNames: model.fields.closingNames.value,
        ...overrides
    };
}

function expectCode(action, code) {
    assert.throws(action, (error) => error instanceof AdminEventEditorError && error.code === code);
}

function runnerHarness({ states, confirm = true, createError, finalError, finalErrorCount = 1 } = {}) {
    const calls = [];
    const confirmations = [];
    const queuedStates = [...(states || [state(), state(), state({ working: CREATED_ID })])];
    let remainingFinalErrors = finalError ? finalErrorCount : 0;
    const client = {
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
            return { versionId: CREATED_ID, versionNumber: 5 };
        }
    };
    const runner = createDraftSaveRunner({
        client,
        confirmSave(details) {
            confirmations.push(details);
            return confirm;
        }
    });
    return { calls, confirmations, runner };
}

(async () => {
    const original = snapshot();
    const originalJson = JSON.stringify(original);
    const model = createEditorModel({ editorialState: state(), version: version(original) });
    assert.strictEqual(model.eligible, true);
    assert.deepStrictEqual(Object.fromEntries(Object.entries(model.fields).map(([name, item]) => [name, item.value])), {
        heroTitle: "Titulo original",
        heroSubtitle: "Subtitulo original",
        address: "Calle 1",
        city: "Ciudad inicial",
        closingTitle: "Hasta pronto",
        closingMessage: "Gracias",
        closingNames: "A y B"
    });
    assert(Object.values(model.fields).every((item) => item.blocked === false));

    const projected = applyEdits(model, editableValues(model, {
        heroTitle: "  Titulo nuevo  ",
        heroSubtitle: " Subtitulo nuevo ",
        address: " Calle 99 ",
        city: " Ciudad nueva ",
        closingTitle: " Cierre nuevo ",
        closingMessage: " Mensaje nuevo ",
        closingNames: " C y D "
    }));
    assert.deepStrictEqual(projected.changedFields, [
        "heroTitle", "heroSubtitle", "address", "city", "closingTitle", "closingMessage", "closingNames"
    ]);
    assert.strictEqual(projected.content.identity.title, "Titulo nuevo");
    assert.strictEqual(projected.content.identity.subtitle, "Subtitulo nuevo");
    assert.strictEqual(projected.content.sections.find((item) => item.id === "hero-primary" && item.type === "hero").data.title, "Titulo nuevo");
    assert.strictEqual(projected.content.sections.find((item) => item.id === "hero-primary" && item.type === "hero").data.subtitle, "Subtitulo nuevo");
    assert.strictEqual(projected.content.location.address, "Calle 99");
    assert.strictEqual(projected.content.location.city, "Ciudad nueva");
    assert.strictEqual(projected.content.sections.find((item) => item.id === "event-details" && item.type === "event-info").data.address, "Calle 99");
    assert.strictEqual(projected.content.sections.find((item) => item.id === "venue" && item.type === "location").data.city, "Ciudad nueva");
    assert.deepStrictEqual(projected.content.sections.find((item) => item.id === "farewell" && item.type === "closing").data, {
        title: "Cierre nuevo", message: "Mensaje nuevo", names: "C y D", media_id: "cover"
    });
    assert.deepStrictEqual(projected.content.schedule, original.schedule);
    assert.deepStrictEqual(projected.content.media, original.media);
    assert.deepStrictEqual(projected.content.metadata, original.metadata);
    assert.strictEqual(JSON.stringify(original), originalJson);
    assert.notStrictEqual(projected.content, original);

    expectCode(() => applyEdits(model, editableValues(model)), "NO_CHANGES");
    expectCode(() => applyEdits(model, editableValues(model, { heroTitle: "   " })), "INVALID_FIELD");
    expectCode(() => applyEdits(model, editableValues(model, { closingMessage: "x".repeat(601) })), "INVALID_FIELD");
    expectCode(() => applyEdits(model, { ...editableValues(model), city: 42 }), "INVALID_FIELD");

    assert.strictEqual(createEditorModel({ editorialState: state(), version: version({ schema_version: 1, sections: [] }) }).eligible, false);
    assert.strictEqual(createEditorModel({ editorialState: state(), version: version({ legacy: true }) }).eligible, false);
    assert.strictEqual(createEditorModel({ editorialState: state(), version: version(snapshot(), { workflowStatus: "in_review" }) }).eligible, false);
    assert.strictEqual(createEditorModel({ editorialState: state({ working: CREATED_ID }), version: version() }).eligible, false);
    assert.strictEqual(createEditorModel({ editorialState: state(), version: version(snapshot({ status: "published" })) }).eligible, true);

    const duplicateHeroContent = snapshot();
    duplicateHeroContent.sections.push({ id: "hero-secondary", type: "hero", enabled: true, order: 11, data: {}, config: {} });
    const duplicateHero = createEditorModel({ editorialState: state(), version: version(duplicateHeroContent) });
    assert.strictEqual(duplicateHero.fields.heroTitle.blocked, true);
    assert.strictEqual(duplicateHero.fields.heroSubtitle.blocked, true);
    assert.strictEqual(duplicateHero.fields.closingTitle.blocked, false);

    const duplicateLocationContent = snapshot();
    duplicateLocationContent.sections.push({ id: "venue-secondary", type: "location", enabled: true, order: 31, data: {}, config: {} });
    const duplicateLocation = createEditorModel({ editorialState: state(), version: version(duplicateLocationContent) });
    assert.strictEqual(duplicateLocation.fields.address.blocked, true);
    assert.strictEqual(duplicateLocation.fields.city.blocked, true);

    const duplicateClosingContent = snapshot();
    duplicateClosingContent.sections.push({ id: "farewell-secondary", type: "closing", enabled: true, order: 41, data: {}, config: {} });
    const duplicateClosing = createEditorModel({ editorialState: state(), version: version(duplicateClosingContent) });
    assert.strictEqual(duplicateClosing.fields.closingTitle.blocked, true);
    assert.strictEqual(duplicateClosing.fields.closingMessage.blocked, true);
    assert.strictEqual(duplicateClosing.fields.closingNames.blocked, true);

    const inconsistentContent = snapshot();
    inconsistentContent.sections.find((item) => item.type === "hero").data.title = "Otra copia";
    assert.strictEqual(createEditorModel({ editorialState: state(), version: version(inconsistentContent) }).fields.heroTitle.blocked, true);

    const successful = runnerHarness();
    const successResult = await successful.runner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    });
    assert.strictEqual(successResult.outcome, "success");
    assert.deepStrictEqual(successful.confirmations, [{ eventId: EVENT_ID, sourceVersionId: DRAFT_ID, sourceVersionNumber: 4 }]);
    const createCall = successful.calls.find(([name]) => name === "createVersion")[1];
    assert.strictEqual(createCall.eventId, EVENT_ID);
    assert.strictEqual(createCall.sourceVersionId, DRAFT_ID);
    assert.strictEqual(createCall.expectedWorkingVersionId, DRAFT_ID);
    assert.strictEqual(createCall.content, projected.content);
    assert.strictEqual(createCall.password, PASSWORD);

    const cancelled = runnerHarness({ confirm: false, states: [state()] });
    assert.strictEqual((await cancelled.runner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "cancelled");
    assert.strictEqual(cancelled.calls.some(([name]) => name === "createVersion"), false);

    const stale = runnerHarness({ states: [state({ working: CREATED_ID })] });
    assert.strictEqual((await stale.runner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "stale");
    assert.strictEqual(stale.confirmations.length, 0);

    const staleAfterConfirmation = runnerHarness({ states: [state(), state({ working: CREATED_ID })] });
    assert.strictEqual((await staleAfterConfirmation.runner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "stale");
    assert.strictEqual(staleAfterConfirmation.confirmations.length, 1);
    assert.strictEqual(staleAfterConfirmation.calls.some(([name]) => name === "createVersion"), false);

    let selectedView = true;
    const changedViewRunner = createDraftSaveRunner({
        client: {
            async getEditorialState() { selectedView = false; return state(); },
            async createVersion() { throw new Error("must not create"); }
        },
        confirmSave: () => { throw new Error("must not confirm"); }
    });
    assert.strictEqual((await changedViewRunner.run({
        observedState: state(),
        sourceVersion: version(),
        content: projected.content,
        password: PASSWORD,
        isCurrent: () => selectedView
    })).outcome, "stale-view");

    let releaseRead;
    const readGate = new Promise((resolve) => { releaseRead = resolve; });
    let busyCreates = 0;
    const busyRunner = createDraftSaveRunner({
        client: {
            async getEditorialState() { await readGate; return state(); },
            async createVersion() { busyCreates += 1; return { versionId: CREATED_ID, versionNumber: 5 }; }
        },
        confirmSave: () => true
    });
    const pending = busyRunner.run({ observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD });
    assert.strictEqual((await busyRunner.run({ observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD })).outcome, "busy");
    releaseRead();
    assert.strictEqual((await pending).outcome, "success");
    assert.strictEqual(busyCreates, 1);

    let uncertainCreates = 0;
    let uncertainReads = 0;
    const uncertainRunner = createDraftSaveRunner({
        client: {
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
        confirmSave: () => true
    });
    assert.strictEqual((await uncertainRunner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "mutation-unknown");
    assert.strictEqual((await uncertainRunner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "refresh-required");
    assert.strictEqual(uncertainCreates, 1);
    await assert.rejects(uncertainRunner.refresh({ eventId: EVENT_ID, password: PASSWORD }), (error) => error.code === "NETWORK_ERROR");
    assert.strictEqual(uncertainRunner.requiresRefresh(EVENT_ID), true);
    await uncertainRunner.refresh({ eventId: EVENT_ID, password: PASSWORD });
    assert.strictEqual(uncertainRunner.requiresRefresh(EVENT_ID), false);
    assert.strictEqual(uncertainCreates, 1);

    const refreshFailure = new Error("refresh failed after 201");
    const accepted = runnerHarness({ finalError: refreshFailure });
    assert.strictEqual((await accepted.runner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "accepted-refresh-failed");
    assert.strictEqual(accepted.runner.requiresRefresh(EVENT_ID), true);
    assert.strictEqual(accepted.calls.filter(([name]) => name === "createVersion").length, 1);
    assert.strictEqual((await accepted.runner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "refresh-required");
    assert.strictEqual(accepted.calls.filter(([name]) => name === "createVersion").length, 1);
    const recoveredAfterAccepted = await accepted.runner.refresh({ eventId: EVENT_ID, password: PASSWORD });
    assert.strictEqual(recoveredAfterAccepted.currentWorkingVersionId, CREATED_ID);
    assert.strictEqual(accepted.runner.requiresRefresh(EVENT_ID), false);
    assert.strictEqual(accepted.calls.filter(([name]) => name === "createVersion").length, 1);

    const conflict = runnerHarness({
        states: [state(), state(), state({ working: CREATED_ID })],
        createError: new AdminEditorialApiError("VERSION_CONFLICT", "conflict", 409)
    });
    assert.strictEqual((await conflict.runner.run({
        observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD
    })).outcome, "conflict");
    assert.strictEqual(conflict.calls.filter(([name]) => name === "createVersion").length, 1);

    const incompatible = runnerHarness({ createError: new AdminEditorialApiError("INVALID_EVENT", "invalid", 422) });
    await assert.rejects(
        incompatible.runner.run({ observedState: state(), sourceVersion: version(), content: projected.content, password: PASSWORD }),
        (error) => error.status === 422
    );
    assert.strictEqual(incompatible.calls.filter(([name]) => name === "createVersion").length, 1);

    console.log("admin event editor test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
