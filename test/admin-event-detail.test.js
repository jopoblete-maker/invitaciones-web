"use strict";
const assert = require("assert");
const fs = require("fs");
const Detail = require("../js/core/admin-event-detail");
const Summary = require("../js/core/admin-event-summary");
const Workflow = require("../js/core/admin-editorial-workflow");
const state = { eventId: "synthetic", eventStatus: "active", currentWorkingVersionId: "w", publishedVersionId: "p",
    versions: [{ versionId: "w", versionNumber: 3, workflowStatus: "draft", createdAt: "2028-01-01T12:00Z" },
        { versionId: "p", versionNumber: 2, workflowStatus: "approved", publishedAt: "2028-01-01T12:00Z" },
        { versionId: "h", versionNumber: 1, workflowStatus: "approved", publishedAt: "2027-01-01T12:00Z" }] };
const v2 = { schema_version: 2, identity: { title: "Trabajo" }, event_type: "birthday", schedule: { date: "2028-02-01" }, template: { slug: "cumple-clasico" } };
const v1 = { schema_version: 1, event: { title: "Publicación V1", type: "wedding", date: "2028-03-01" }, template: { slug: "boda-vertical" } };
const model = (overrides = {}, summary = Summary.project({ working: v2, published: v1 })) => {
    const current = { ...state, ...overrides };
    return Detail.buildViewModel({ state: current, summary, action: Workflow.getAvailableAction(current) });
};
assert.strictEqual(model().title, "Trabajo");
assert.strictEqual(model().sourceLabel, "Datos de trabajo");
assert.strictEqual(model({}, Summary.project({ published: v1 })).title, "Publicación V1");
assert.strictEqual(model({}, Summary.project({ published: v1 })).sourceLabel, "Datos publicados");
assert.strictEqual(model({}, Summary.project({ working: { schema_version: 2 } })).title, "Sin título");
assert.strictEqual(model({}, Summary.project()).dateLabel, "Fecha no disponible");
assert.strictEqual(model({}, Summary.project()).sourceLabel, "Sin snapshot descriptivo");
assert.deepStrictEqual(model().versions[0].badges, ["EN TRABAJO"]);
assert.deepStrictEqual(model().versions[1].badges, ["PUBLICADA VIGENTE"]);
assert.deepStrictEqual(model().versions[2].badges, ["HISTÓRICA", "PUBLICADA ANTERIORMENTE"]);
assert.deepStrictEqual(model({ currentWorkingVersionId: "p" }).versions[1].badges, ["PUBLICADA VIGENTE", "EN TRABAJO"]);
assert.strictEqual(model({ currentWorkingVersionId: null }).action, null);
assert.strictEqual(model({ publishedVersionId: null }).publication, "Sin publicación");
assert.strictEqual(model().action.label, "Enviar a revisión");
for (const [status, label] of [["in_review", "Aprobar"], ["approved", "Publicar"]]) {
    const versions = [{ ...state.versions[0], workflowStatus: status }, ...state.versions.slice(1)];
    assert.strictEqual(model({ versions }).action.label, label);
}
assert.strictEqual(Detail.workflowLabel("published"), "Workflow no disponible");
assert.strictEqual(model({ currentWorkingVersionId: null }).publication, "Publicado: hay una versión publicada vigente");
function node(tag) {
    return { tag, children: [], listeners: {}, textContent: "", append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; }, addEventListener(type, handler) { this.listeners[type] = handler; } };
}
const nodes = Object.fromEntries(["eventDetailSummary", "eventDetailVersions", "eventDetailWorkflow", "eventDetailContentStatus"].map((id) => [id, node(id)]));
let callback;
const view = Detail.createDetail({ document: { createElement: node, getElementById: (id) => nodes[id] }, onAction: (action) => { callback = action; } });
const malicious = model({}, { ...Summary.project(), title: "<img onerror=alert(1)>" });
malicious.contentMessage = "Snapshot no disponible";
view.render(malicious);
assert.strictEqual(nodes.eventDetailSummary.children[0].textContent, malicious.title);
assert.strictEqual(nodes.eventDetailSummary.children[0].children.length, 0);
assert.strictEqual(nodes.eventDetailVersions.children[0].children[0].textContent, "Versión 3");
assert.strictEqual(nodes.eventDetailContentStatus.textContent, "Snapshot no disponible");
const actionButton = nodes.eventDetailWorkflow.children[2];
assert.strictEqual(actionButton.className, "btn-submit editorial-workflow-action");
actionButton.listeners.click(); assert.strictEqual(callback.versionId, "w");
view.render({ ...model(), actionDisabled: true });
assert.strictEqual(nodes.eventDetailWorkflow.children[2].disabled, true);
view.render(model({ versions: [], currentWorkingVersionId: null }));
assert.strictEqual(nodes.eventDetailVersions.children[0].textContent, "El evento no tiene versiones.");
const data = Detail.buildViewModel({ state: { ...state, password: "secret", token: "token-marker" }, summary: { ...Summary.project(), token: "token-marker" } });
assert(!JSON.stringify(data).includes("secret")); assert(!JSON.stringify(data).includes("token-marker"));
const source = fs.readFileSync(require.resolve("../js/core/admin-event-detail"), "utf8");
for (const forbidden of ["fetch(", "localStorage", "sessionStorage", "innerHTML", "ADMIN_PASSWORD", "Supabase", "previewToken"]) assert(!source.includes(forbidden));
view.clear(); assert.strictEqual(nodes.eventDetailSummary.children.length, 0);
console.log("admin event detail tests passed");
