"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Summary = require("../js/core/admin-event-summary");
const Dashboard = require("../js/core/admin-dashboard");
const Workflow = require("../js/core/admin-editorial-workflow");
const Editor = require("../js/core/admin-event-editor");
const EditorialClient = require("../js/core/admin-editorial-client");
const Detail = require("../js/core/admin-event-detail");
const source = fs.readFileSync(path.join(__dirname, "..", "js", "admin.js"), "utf8");
function element(tag) {
    return { tag, dataset: {}, value: "", textContent: "", children: [], listeners: {}, hidden: false, disabled: false,
        classList: { add() {}, remove() {} }, append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; }, addEventListener(type, listener) { this.listeners[type] = listener; },
        setAttribute(name) { if (name === "hidden") this.hidden = true; }, removeAttribute() {}, focus(options) { this.focusOptions = options; }, reset() {} };
}
function harness(client) {
    const elements = new Map();
    let ready;
    const document = { addEventListener(_type, listener) { ready = listener; }, createElement: element,
        getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); }, querySelectorAll() { return []; } };
    const opened = [];
    const context = vm.createContext({ document, console, URL, Object,
        Option: function (label, value) { return { textContent: label, value }; },
        AdminEventSummary: Summary, AdminDashboard: Dashboard, AdminEventDetail: Detail, AdminEditorialWorkflow: Workflow, AdminEventEditor: Editor,
        AdminEventCreate: require("../js/core/admin-event-create"), AdminEventCreateBuilder: require("../js/core/admin-event-create-builder"),
        AdminEditorialClient: { ...EditorialClient, createAdminEditorialClient: () => client },
        window: { location: { origin: "http://synthetic.local" }, open(...args) { opened.push(args); }, confirm() { return true; } } });
    vm.runInContext(source, context);
    ready();
    function login() {
        document.getElementById("loginPassword").value = "synthetic-memory-credential";
        document.getElementById("authForm").listeners.submit({ preventDefault() {} });
    }
    login();
    return { context, document, opened, login, read: (expression) => vm.runInContext(expression, context) };
}
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const summary = (id, working = `work-${id}`, published = `pub-${id}`) => ({ eventId: id, eventStatus: "active", currentWorkingVersionId: working, publishedVersionId: published,
    workingVersion: working ? { workflowStatus: "draft", versionNumber: 2 } : null, publishedVersion: published ? { workflowStatus: "published", versionNumber: 1 } : null });
const content = (title) => ({ schema_version: 1, event: { title, type: "wedding", date: "2028-01-01" }, template: { slug: "boda-vertical" } });
(async () => {
    const reads = [], cursors = [];
    const client = {
        async listEvents({ cursor }) {
            cursors.push(cursor);
            return cursor ? { events: [summary("one"), summary("three", null, null)], nextCursor: null }
                : { events: [summary("one"), summary("two")], nextCursor: "cursor-two" };
        },
        async getVersion({ eventId, versionId }) {
            reads.push(`${eventId}/${versionId}`);
            if (versionId === "work-two") throw Object.assign(new Error("Synthetic missing snapshot"), { code: "VERSION_NOT_FOUND" });
            return { eventId, versionId, workflowStatus: "draft", content: content(eventId) };
        },
        async getEditorialState({ eventId }) { return { ...summary(eventId), versions: [{ versionId: `work-${eventId}`, workflowStatus: "draft", versionNumber: 2 }] }; },
        async requestPreview() { return { previewUrl: "/api/preview?token=synthetic-temporary", expiresAt: "2028-01-01T00:00:00Z" }; },
        async createVersion() {}, async transitionWorkflow() {}, async publishVersion() {}
    };
    const h = harness(client);
    await h.context.loadEditorialEvents();
    assert.strictEqual(h.read("dashboardEvents.length"), 2);
    assert.strictEqual(h.read("dashboardEvents[1].summary.source"), "published");
    assert.strictEqual(h.document.getElementById("dashboardLoadMore").hidden, false);
    await h.context.loadEditorialEvents({ more: true });
    assert.deepStrictEqual(cursors, [undefined, "cursor-two"]);
    assert.strictEqual(h.read("dashboardEvents.length"), 3);
    assert.strictEqual(h.read("dashboardEvents[2].summary.source"), "none");
    assert.strictEqual(h.document.getElementById("dashboardLoadMore").hidden, true);
    assert.strictEqual(reads.filter((value) => value === "one/work-one").length, 1);
    await h.context.loadEditorialEvents();
    assert.strictEqual(reads.filter((value) => value === "two/work-two").length, 1);
    h.document.getElementById("dashboardSearch").listeners.input({ target: { value: "one" } });
    const scrolls = [];
    h.context.window.scrollY = 320;
    h.context.window.scrollTo = (x, y) => scrolls.push([x, y]);
    h.document.activeElement = h.document.getElementById("dashboardSearch");
    h.document.activeElement.id = "dashboardSearch";
    await h.context.manageDashboardEvent("one");
    assert.strictEqual(h.document.getElementById("editorialEventId").value, "one");
    assert.strictEqual(h.document.getElementById("editorialDetail").hidden, false);
    assert.strictEqual(h.read("currentEditorialState.eventId"), "one");
    assert.strictEqual(h.document.getElementById("eventDetailTechnical").open, false);
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children[0].textContent, "one");
    assert(h.document.getElementById("eventDetailContentStatus").textContent.includes("V1"));
    await h.context.manageDashboardEvent("two");
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children.at(-1).textContent, "Datos publicados");
    await h.context.manageDashboardEvent("one");
    await h.context.returnToDashboard();
    assert.strictEqual(h.document.getElementById("adminDashboard").hidden, false);
    assert.strictEqual(h.document.getElementById("dashboardCount").textContent, "1 visibles · 2 cargados");
    assert.strictEqual(h.read("dashboardNextCursor"), "cursor-two");
    assert.deepStrictEqual(scrolls.at(-1), [0, 320]);
    assert.strictEqual(h.document.getElementById("dashboardSearch").focusOptions.preventScroll, true);
    h.document.getElementById("dashboardOpenDetail").listeners.click();
    assert.strictEqual(h.document.getElementById("eventDetailTechnical").open, true);
    await h.context.previewDashboardEvent("one");
    assert.strictEqual(h.opened.length, 1);
    assert.strictEqual(h.opened[0][0], "/invitacion.html?previewToken=synthetic-temporary");
    assert.strictEqual(h.opened[0][2], "noopener,noreferrer");
    assert(!h.read("JSON.stringify(dashboardEvents)").includes("synthetic-temporary"));

    // Page failure preserves accumulated data and the cursor so the user can retry.
    await h.context.loadEditorialEvents();
    const list = client.listEvents;
    client.listEvents = async () => { throw new Error("Synthetic offline"); };
    await h.context.loadEditorialEvents({ more: true });
    assert.strictEqual(h.read("dashboardEvents.length"), 2);
    assert.strictEqual(h.read("dashboardNextCursor"), "cursor-two");
    assert.strictEqual(h.document.getElementById("dashboardLoadMore").disabled, false);
    client.listEvents = list;

    // No late preview window after logout.
    const pendingPreview = deferred();
    client.requestPreview = () => pendingPreview.promise;
    const preview = h.context.previewDashboardEvent("one");
    h.document.getElementById("btnLogout").listeners.click();
    pendingPreview.resolve({ previewUrl: "/api/preview?token=late", expiresAt: "2028-01-01T00:00:00Z" });
    await preview;
    assert.strictEqual(h.opened.length, 1);
    assert.strictEqual(h.read("administrativePassword"), "");
    assert.strictEqual(h.read("dashboardSnapshots.size"), 0);
    assert.strictEqual(h.document.getElementById("editorialEventSelect").children.length, 1);

    // A snapshot completing after logout cannot repopulate data or start its fallback.
    h.login();
    const pendingSnapshot = deferred();
    const snapshotStarted = deferred();
    let delayedReads = 0;
    client.listEvents = async () => ({ events: [summary("delayed")], nextCursor: null });
    client.getVersion = () => { delayedReads++; snapshotStarted.resolve(); return pendingSnapshot.promise; };
    const loading = h.context.loadEditorialEvents();
    await snapshotStarted.promise;
    h.document.getElementById("btnLogout").listeners.click();
    pendingSnapshot.resolve({ content: null });
    await loading;
    assert.strictEqual(delayedReads, 1);
    assert.strictEqual(h.read("dashboardEvents.length"), 0);
    assert.strictEqual(h.read("dashboardSnapshots.size"), 0);
    assert.strictEqual(h.document.getElementById("adminForm").hidden, true);

    // Invalid credentials encountered in descriptive reads terminate the session.
    h.login();
    client.getVersion = async () => { throw Object.assign(new Error("Acceso rechazado"), { code: "UNAUTHORIZED" }); };
    await h.context.loadEditorialEvents();
    assert.strictEqual(h.read("administrativePassword"), "");
    assert.strictEqual(h.document.getElementById("authPanel").hidden, false);

    // Fresh pointers, descriptive fallback and editor inputs independent of general renders.
    h.login();
    const v2 = (title) => ({ schema_version: 2, identity: { title, subtitle: "" },
        sections: [{ id: "hero", type: "hero", enabled: true, data: { title, subtitle: "" } }] });
    let fresh = { ...summary("fresh", "draft-v1", "pub-fresh"), versions: [
        { versionId: "draft-v1", versionNumber: 1, workflowStatus: "draft" },
        { versionId: "pub-fresh", versionNumber: 0, workflowStatus: "approved", publishedAt: "2028-01-01T12:00Z" }] };
    client.getEditorialState = async () => fresh;
    client.getVersion = async ({ eventId, versionId }) => ({ eventId, versionId, versionNumber: 1,
        workflowStatus: fresh.versions.find((entry) => entry.versionId === versionId)?.workflowStatus || "approved",
        content: versionId === "pub-fresh" ? content("Published fallback") : v2(versionId) });
    await h.context.manageDashboardEvent("fresh");
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children[0].textContent, "draft-v1");
    const input = h.document.getElementById("editorialHeroTitle");
    input.value = "Unsubmitted input";
    const inputIds = ["editorialHeroTitle", "editorialHeroSubtitle", "editorialAddress", "editorialCity", "editorialClosingTitle", "editorialClosingMessage", "editorialClosingNames"];
    const preservedInputs = inputIds.map((id) => {
        const node = h.document.getElementById(id);
        node.value = `Unsubmitted ${id}`;
        return node;
    });
    h.read("renderEditorialState(currentEditorialState)");
    assert.strictEqual(h.document.getElementById("editorialHeroTitle"), input);
    inputIds.forEach((id, index) => {
        assert.strictEqual(h.document.getElementById(id), preservedInputs[index]);
        assert.strictEqual(preservedInputs[index].value, `Unsubmitted ${id}`);
    });
    fresh = { ...fresh, currentWorkingVersionId: "draft-v2", versions: [{ versionId: "draft-v2", versionNumber: 2, workflowStatus: "draft" }, ...fresh.versions] };
    await h.context.loadEditorialState();
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children[0].textContent, "draft-v2");
    fresh = { ...fresh, versions: fresh.versions.map((version) => version.versionId === "draft-v2" ? { ...version, workflowStatus: "in_review" } : version) };
    await h.context.loadEditorialState();
    assert.strictEqual(h.document.getElementById("editorialTextEditor").hidden, true);
    assert.strictEqual(h.document.getElementById("eventDetailWorkflow").children[2].textContent, "Aprobar");
    assert(h.document.getElementById("eventDetailContentStatus").textContent.includes("borrador"));
    fresh = { ...fresh, versions: fresh.versions.map((version) => version.versionId === "draft-v2" ? { ...version, workflowStatus: "approved" } : version) };
    await h.context.loadEditorialState();
    assert.strictEqual(h.document.getElementById("eventDetailWorkflow").children[2].textContent, "Publicar");
    fresh = { ...fresh, currentWorkingVersionId: null, publishedVersionId: "draft-v2" };
    await h.context.loadEditorialState();
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children[0].textContent, "draft-v2");
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children.at(-1).textContent, "Datos publicados");
    assert.strictEqual(h.document.getElementById("eventDetailWorkflow").children[2].tag, "p");
    fresh = { ...fresh, publishedVersionId: "pub-fresh" };
    fresh = { ...fresh, currentWorkingVersionId: null };
    await h.context.loadEditorialState();
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children[0].textContent, "Published fallback");
    assert.strictEqual(h.document.getElementById("editorialTextEditor").hidden, true);
    assert(h.document.getElementById("eventDetailContentStatus").textContent.includes("V1"));
    fresh = { ...fresh, eventStatus: "archived" };
    await h.context.loadEditorialState();
    assert.strictEqual(h.document.getElementById("editorialPreviewButton").disabled, true);
    fresh = { ...fresh, eventStatus: "active", publishedVersionId: null };
    await h.context.loadEditorialState();
    assert.strictEqual(h.document.getElementById("editorialPreviewButton").disabled, true);
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children[0].textContent, "Sin título");

    // Snapshot errors leave versions available, and a delayed description cannot replace another event.
    fresh = { ...fresh, currentWorkingVersionId: "missing" };
    client.getVersion = async () => { throw new Error("Synthetic snapshot failure"); };
    await h.context.loadEditorialState();
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(h.document.getElementById("editorialState").hidden, false);
    assert(h.document.getElementById("eventDetailContentStatus").textContent.includes("Snapshot no disponible"));
    assert(h.document.getElementById("eventDetailDescriptionStatus").textContent.includes("descripción"));
    const delayed = deferred(), began = deferred();
    client.getVersion = ({ eventId, versionId }) => {
        if (eventId === "fresh") { began.resolve(); return delayed.promise; }
        return Promise.resolve({ eventId, versionId, content: content("Second event"), workflowStatus: "approved" });
    };
    const oldLoad = h.context.loadEditorialState();
    await began.promise;
    fresh = { eventId: "second", eventStatus: "active", currentWorkingVersionId: null, publishedVersionId: "second-pub", versions: [] };
    await h.context.manageDashboardEvent("second");
    await new Promise((resolve) => setImmediate(resolve));
    delayed.resolve({ eventId: "fresh", versionId: "missing", content: content("Late event") });
    await oldLoad;
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children[0].textContent, "Second event");
    const logoutGate = deferred(), logoutStarted = deferred();
    client.getVersion = () => { logoutStarted.resolve(); return logoutGate.promise; };
    const logoutLoad = h.context.loadEditorialState();
    await logoutStarted.promise;
    h.document.getElementById("btnLogout").listeners.click();
    logoutGate.resolve({ content: content("After logout") });
    await logoutLoad;
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(h.document.getElementById("eventDetailSummary").children.length, 0);
    console.log("admin dashboard coordinator tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
