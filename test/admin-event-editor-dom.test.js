"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const AdminEventEditor = require("../js/core/admin-event-editor");

const EVENT_ID = "synthetic-dom-editor";
const DRAFT_ID = "11111111-1111-4111-8111-111111111111";
const INPUTS = {
    heroTitle: "editorialHeroTitle",
    heroSubtitle: "editorialHeroSubtitle",
    address: "editorialAddress",
    city: "editorialCity",
    closingTitle: "editorialClosingTitle",
    closingMessage: "editorialClosingMessage",
    closingNames: "editorialClosingNames"
};

function snapshot() {
    return {
        schema_version: 2,
        identity: { title: "Original", subtitle: "Subtitulo" },
        location: { address: "Calle 1", city: "Ciudad" },
        sections: [
            { id: "hero", type: "hero", enabled: true, data: { title: "Original", subtitle: "Subtitulo" } },
            { id: "info", type: "event-info", enabled: true, data: { address: "Calle 1", city: "Ciudad" } },
            { id: "venue", type: "location", enabled: true, data: { address: "Calle 1", city: "Ciudad" } },
            { id: "closing", type: "closing", enabled: true, data: { title: "Cierre", message: "Mensaje", names: "A y B" } }
        ],
        untouched: { nested: true }
    };
}

function editorialState() {
    return {
        eventId: EVENT_ID,
        eventStatus: "active",
        currentWorkingVersionId: DRAFT_ID,
        publishedVersionId: null,
        versions: [{ versionId: DRAFT_ID, versionNumber: 3, workflowStatus: "draft" }]
    };
}

function version(overrides = {}) {
    return {
        eventId: EVENT_ID,
        versionId: DRAFT_ID,
        versionNumber: 3,
        workflowStatus: "draft",
        content: snapshot(),
        ...overrides
    };
}

function fakeElement(id) {
    return {
        id,
        value: "",
        hidden: false,
        disabled: false,
        textContent: "",
        listeners: {},
        classList: {
            values: new Set(),
            add(value) { this.values.add(value); },
            remove(value) { this.values.delete(value); },
            contains(value) { return this.values.has(value); }
        },
        addEventListener(type, listener) { this.listeners[type] = listener; },
        setAttribute(name) { if (name === "hidden") this.hidden = true; },
        replaceChildren() {},
        focus() {}
    };
}

function createDomHarness(runner) {
    const ids = [
        ...Object.values(INPUTS),
        ...Object.values(INPUTS).map((id) => `${id}Status`),
        "editorialTextEditor",
        "editorialSaveTextButton",
        "editorialEditorStatus",
        "editorialEventId",
        "editorialReaderStatus",
        "editorialState",
        "editorialReloadStateButton",
        "editorialCreateVersionButton",
        "editorialPreviewButton"
    ];
    const elements = Object.fromEntries(ids.map((id) => [id, fakeElement(id)]));
    elements.editorialTextEditor.reset = () => {
        Object.values(INPUTS).forEach((id) => { elements[id].value = ""; });
    };
    const document = {
        domReady: null,
        addEventListener(type, listener) { if (type === "DOMContentLoaded") this.domReady = listener; },
        getElementById(id) { return elements[id] || null; },
        querySelectorAll(selector) {
            if (selector === ".editorial-field-status") {
                return Object.values(INPUTS).map((id) => elements[`${id}Status`]);
            }
            return [];
        }
    };
    const viewGuard = {
        refreshRequired: false,
        begin(eventId) { return { eventId }; },
        isCurrent() { return true; },
        acceptState() { this.refreshRequired = false; return true; },
        requireRefresh() { this.refreshRequired = true; return true; },
        requiresRefresh() { return this.refreshRequired; },
        reset() {},
        isSelected() { return true; }
    };
    const context = vm.createContext({
        AdminEventEditor,
        Object,
        URL,
        console,
        document,
        window: { location: { origin: "http://localhost" } }
    });
    const script = fs.readFileSync(path.resolve(__dirname, "..", "js", "admin.js"), "utf8");
    vm.runInContext(script, context, { filename: "js/admin.js" });

    const state = editorialState();
    const source = version();
    const model = AdminEventEditor.createEditorModel({ editorialState: state, version: source });
    context.__runner = runner;
    context.__viewGuard = viewGuard;
    context.__state = state;
    context.__source = source;
    context.__model = model;
    context.__pendingRunner = { isPending: () => false };
    context.__renderState = () => {};
    vm.runInContext(`
        administrativePassword = "memory-only-secret";
        adminDraftSaveRunner = __runner;
        adminWorkingVersionRunner = __pendingRunner;
        adminEditorialWorkflowRunner = __pendingRunner;
        adminEditorialViewGuard = __viewGuard;
        currentEditorialState = __state;
        currentEditorialVersion = __source;
        currentEditorialEditorModel = __model;
        currentEditorialDraftValues = editorValuesFromModel(__model);
        renderEditorialState = __renderState;
        renderEditorialTextEditor(__model, currentEditorialDraftValues);
    `, context);
    elements.editorialEventId.value = EVENT_ID;
    return { context, document, elements, model, source, state, viewGuard };
}

function enterValues(harness) {
    const values = {
        heroTitle: "  Titulo ingresado  ",
        heroSubtitle: " Subtitulo ingresado ",
        address: " Calle 99 ",
        city: " Ciudad nueva ",
        closingTitle: " Cierre ingresado ",
        closingMessage: " Mensaje ingresado con espacios ",
        closingNames: " C y D "
    };
    Object.entries(values).forEach(([name, value]) => { harness.elements[INPUTS[name]].value = value; });
    return values;
}

function assertValues(harness, expected) {
    Object.entries(expected).forEach(([name, value]) => {
        assert.strictEqual(harness.elements[INPUTS[name]].value, value, name);
    });
}

(async () => {
    const cancelled = createDomHarness({
        isPending: () => false,
        async run() { return { outcome: "cancelled", state: editorialState() }; },
        requiresRefresh: () => false
    });
    const cancelledValues = enterValues(cancelled);
    await cancelled.context.saveEditorialTexts({ preventDefault() {} });
    assertValues(cancelled, cancelledValues);
    assert.strictEqual(cancelled.elements.editorialTextEditor.hidden, false);
    assert.strictEqual(cancelled.elements.editorialEditorStatus.textContent, "Guardado cancelado. No se realizaron cambios.");

    const invalid = createDomHarness({
        isPending: () => false,
        async run() { throw Object.assign(new Error("invalid"), { status: 422, code: "INVALID_EVENT" }); },
        requiresRefresh: () => false
    });
    const invalidValues = enterValues(invalid);
    await invalid.context.saveEditorialTexts({ preventDefault() {} });
    assertValues(invalid, invalidValues);
    assert.strictEqual(invalid.elements.editorialTextEditor.hidden, false);
    assert.strictEqual(invalid.elements.editorialSaveTextButton.disabled, false);
    assert(invalid.elements.editorialEditorStatus.textContent.includes("incompatible"));

    const uncertain = createDomHarness({
        isPending: () => false,
        async run() { return { outcome: "mutation-unknown" }; },
        requiresRefresh: () => true
    });
    enterValues(uncertain);
    await uncertain.context.saveEditorialTexts({ preventDefault() {} });
    assert.strictEqual(uncertain.elements.editorialTextEditor.hidden, true);
    assertValues(uncertain, Object.fromEntries(Object.keys(INPUTS).map((name) => [name, ""])));
    assert.strictEqual(uncertain.viewGuard.refreshRequired, true);
    assert.strictEqual(vm.runInContext("currentEditorialDraftValues", uncertain.context), null);

    const changedEvent = createDomHarness({ isPending: () => false, requiresRefresh: () => false });
    enterValues(changedEvent);
    changedEvent.context.handleEditorialEventInput({ target: { value: "another-event" } });
    assert.strictEqual(changedEvent.elements.editorialTextEditor.hidden, true);
    assertValues(changedEvent, Object.fromEntries(Object.keys(INPUTS).map((name) => [name, ""])));
    assert.strictEqual(vm.runInContext("currentEditorialDraftValues", changedEvent.context), null);

    const ineligible = createDomHarness({ isPending: () => false, requiresRefresh: () => false });
    enterValues(ineligible);
    ineligible.context.__ineligibleVersion = version({ workflowStatus: "in_review" });
    ineligible.context.__client = { async getVersion() { return ineligible.context.__ineligibleVersion; } };
    vm.runInContext("adminEditorialClient = __client", ineligible.context);
    const loaded = await ineligible.context.loadEditorialTextEditor(ineligible.state, { eventId: EVENT_ID });
    assert.strictEqual(loaded, false);
    assert.strictEqual(ineligible.elements.editorialTextEditor.hidden, true);
    assertValues(ineligible, Object.fromEntries(Object.keys(INPUTS).map((name) => [name, ""])));
    assert.strictEqual(vm.runInContext("currentEditorialDraftValues", ineligible.context), null);

    console.log("admin event editor DOM test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
