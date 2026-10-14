"use strict";
const assert = require("node:assert/strict");
const Detail = require("../js/core/admin-event-detail");
const Workflow = require("../js/core/admin-editorial-workflow");

function input(id, template, premium = false) {
    const state = { eventId: id, eventStatus: "active", currentWorkingVersionId: `${id}-v1`, publishedVersionId: null,
        versions: [{ versionId: `${id}-v1`, versionNumber: 1, workflowStatus: "draft" }] };
    return { state, summary: { title: id, source: "working", template }, action: Workflow.getAvailableAction(state),
        snapshotFacts: { eventId: id, versionId: `${id}-v1`, templateSlug: template, schemaVersion: 2, premium },
        editorModel: { eventId: id, versionId: `${id}-v1`, eligible: true, fields: { title: { blocked: false } } } };
}
const standard = input("synthetic-a", "boda-vertical");
const premium = input("synthetic-b", "boda-fiesta-premium", true);
const before = JSON.stringify({ standard, premium });
const status = (model, label) => model.capabilities.find(row => row.label === label).status;
const a = Detail.buildViewModel(standard), b = Detail.buildViewModel(premium);
assert(status(a, "Edición de textos").startsWith("Disponible"));
assert(status(a, "Transición editorial").startsWith("Disponible"));
assert(status(b, "Edición de textos").includes("Requiere autorización premium"));
assert(status(b, "Transición editorial").includes("no verificada"));
assert(status(b, "Vista previa temporal").startsWith("No verificada"));
assert(status(b, "Gestión RSVP Managed").startsWith("No implementada en este panel"));
assert(status(b, "Límites comerciales del plan").startsWith("No verificados"));
for (const facts of [undefined, { ...standard.snapshotFacts, eventId: "synthetic-b" },
    { ...standard.snapshotFacts, versionId: "stale" }, { ...standard.snapshotFacts, templateSlug: "unknown" }]) {
    assert(status(Detail.buildViewModel({ ...standard, snapshotFacts: facts }), "Edición de textos").startsWith("No verificada"));
}
assert(status(Detail.buildViewModel({ ...standard, editorModel: premium.editorModel }), "Edición de textos").startsWith("No disponible"));
assert(status(Detail.buildViewModel({ ...standard, actionDisabled: true }), "Transición editorial").startsWith("Temporalmente bloqueada"));
assert(status(Detail.buildViewModel({ ...standard, action: premium.action }), "Transición editorial").startsWith("No disponible"));
assert(status(Detail.buildViewModel({ ...standard, state: { ...standard.state, eventStatus: "archived" }, action: null }), "Vista previa temporal").startsWith("No disponible"));
assert(status(Detail.buildViewModel({ ...standard, snapshotFacts: { ...standard.snapshotFacts, schemaVersion: 1 } }), "Edición de textos").startsWith("No disponible"));
assert(status(Detail.buildViewModel({ ...standard, snapshotFacts: { ...standard.snapshotFacts, premium: true } }), "Edición de textos").startsWith("Requiere autorización premium"));

function element(tag) {
    return { tag, children: [], textContent: "", append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; }, addEventListener() {} };
}
const nodes = Object.fromEntries(["eventDetailSummary", "eventDetailVersions", "eventDetailWorkflow",
    "eventDetailContentStatus", "eventDetailCapabilities"].map(id => [id, element(id)]));
const view = Detail.createDetail({ document: { getElementById: id => nodes[id], createElement: element },
    onAction() { throw Error("Informational presentation must not execute operations"); } });
view.render(a);
assert(nodes.eventDetailCapabilities.children.every(node => node.tag === "li"));
assert.equal(nodes.eventDetailWorkflow.children[2].disabled, false);
view.render({ ...b, actionDisabled: true });
assert.equal(nodes.eventDetailWorkflow.children[2].disabled, true);
assert(nodes.eventDetailCapabilities.children.some(node => node.textContent.includes("Requiere autorización premium")));
view.render(a);
assert(!nodes.eventDetailCapabilities.children.some(node => node.textContent.includes("Requiere autorización premium")));
assert.equal(nodes.eventDetailCapabilities.children.length, 7);
view.clear(); assert.equal(nodes.eventDetailCapabilities.children.length, 0);
assert.equal(JSON.stringify({ standard, premium }), before);
const secretInput = { ...standard, snapshotFacts: { ...standard.snapshotFacts, token: "PRIVATE_MARKER" },
    editorModel: { ...standard.editorModel, password: "PRIVATE_MARKER" } };
assert(!JSON.stringify(Detail.buildViewModel(secretInput)).includes("PRIVATE_MARKER"));
console.log("event capability presentation: scope, uncertainty, no controls and two-event isolation PASS");
