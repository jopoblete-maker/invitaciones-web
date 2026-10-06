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
const source = fs.readFileSync(path.join(__dirname, "..", "js", "admin.js"), "utf8");
function element(tag) {
    return { tag, value: "", textContent: "", children: [], listeners: {}, hidden: false, disabled: false,
        classList: { add() {}, remove() {} }, append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; }, addEventListener(type, listener) { this.listeners[type] = listener; },
        setAttribute(name) { if (name === "hidden") this.hidden = true; }, focus() {}, reset() {} };
}
function harness(client) {
    const elements = new Map();
    let ready;
    const document = { addEventListener(_type, listener) { ready = listener; }, createElement: element,
        getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); }, querySelectorAll() { return []; } };
    const opened = [];
    const context = vm.createContext({ document, console, URL, Object,
        Option: function (label, value) { return { textContent: label, value }; },
        AdminEventSummary: Summary, AdminDashboard: Dashboard, AdminEditorialWorkflow: Workflow, AdminEventEditor: Editor,
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
    await h.context.manageDashboardEvent("one");
    assert.strictEqual(h.document.getElementById("editorialEventId").value, "one");
    assert.strictEqual(h.document.getElementById("editorialDetail").hidden, false);
    assert.strictEqual(h.read("currentEditorialState.eventId"), "one");
    await h.context.returnToDashboard();
    assert.strictEqual(h.document.getElementById("adminDashboard").hidden, false);
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
    console.log("admin dashboard coordinator tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
