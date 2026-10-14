"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Summary = require("../js/core/admin-event-summary");
const Detail = require("../js/core/admin-event-detail");

function fixture(id = "synthetic-a", premium = false) {
    const state = { eventId: id, eventStatus: "active", currentWorkingVersionId: `${id}-work`, publishedVersionId: `${id}-pub`,
        versions: [{ versionId: `${id}-work`, versionNumber: 2, workflowStatus: "draft", publishedAt: null },
            { versionId: `${id}-pub`, versionNumber: 1, workflowStatus: "approved", publishedAt: "2026-01-01T00:00:00Z" }] };
    const version = { ...state.versions[0], eventId: id, content: { id, schema_version: 2,
        identity: { title: id }, template: { slug: premium ? "boda-fiesta-premium" : "boda-vertical" },
        sections: [{ id: "last", type: premium ? "gifts" : "closing", order: 2, enabled: false },
            { id: "first", type: "hero", order: 0, enabled: true }] } };
    return { state, version };
}
function input(f) {
    return { state: f.state, summary: Summary.project({ working: f.version.content }),
        snapshotFacts: Summary.describeSnapshot(f.state, f.version), templateKnown: true };
}
const a = fixture(), b = fixture("synthetic-b", true);
const before = JSON.stringify({ a, b });
const info = Summary.editorial(input(a));
assert.equal(info.sectionCount, "2");
assert.match(info.sectionOrder[0], /first.*orden 0/);
assert.match(info.sectionOrder[1], /last.*deshabilitada/);
assert.match(info.candidate, /synthetic-a-work.*draft/);
assert.match(info.replaced, /synthetic-a-pub.*approved/);
assert(Summary.editorial(input(b)).warnings.includes("Requiere autorización del contenido exacto. No verificada desde este panel"));
assert.equal(Summary.describeSnapshot(a.state, b.version), null);
for (const change of [{ eventId: "other" }, { versionId: "missing" }, { versionNumber: 9 }, { workflowStatus: "approved" },
    { content: { ...a.version.content, id: "other" } }]) {
    assert.equal(Summary.describeSnapshot(a.state, { ...a.version, ...change }), null);
}
for (const mutate of [s => { s.currentWorkingVersionId = "other"; }, s => { s.eventStatus = "archived"; },
    s => { s.versions[0].workflowStatus = "approved"; }, s => { s.publishedVersionId = null; }]) {
    const original = input(a), state = structuredClone(a.state); mutate(state);
    const stale = Summary.editorial({ ...original, state });
    assert.equal(stale.sectionCount, "No verificado");
    assert.equal(stale.template, "No verificado");
}
assert.equal(Summary.editorial({ ...input(a), templateKnown: false }).template, "No verificado");
assert.equal(Summary.editorial({ ...input(a), snapshotFacts: null }).candidateContent, "No verificado");
for (const sections of [null, [], [{ id: "x", type: "hero" }],
    [a.version.content.sections[0], a.version.content.sections[0]]]) {
    const changed = fixture(); changed.version.content.sections = sections;
    assert.equal(Summary.editorial(input(changed)).sectionCount, "No verificado");
}
for (const publishedAt of [null, "invalid"]) {
    const changed = fixture(); changed.state.versions[1].publishedAt = publishedAt;
    assert.equal(Summary.editorial(input(changed)).published, "No verificado");
    assert.equal(Summary.editorial(input(changed)).replaced, "No verificado");
}
const missing = fixture(); missing.state.versions = [];
assert.equal(Summary.editorial(input(missing)).working, "No verificado");
const unknown = fixture(); unknown.version.content.template.slug = "unregistered-template";
assert.equal(Detail.buildViewModel(input(unknown)).editorialSummary.template, "No verificado");
const noWork = fixture(); noWork.state.currentWorkingVersionId = null;
assert.equal(Summary.editorial(input(noWork)).candidate, "Ninguna versión de trabajo");
const conflicting = fixture(); conflicting.state.publishedVersionId = conflicting.state.currentWorkingVersionId;
assert.equal(Summary.editorial(input(conflicting)).candidate, "No verificado");
assert.equal(Summary.editorial(input(conflicting)).published, "No verificado");
const premiumWithoutSections = fixture("synthetic-premium", true);
premiumWithoutSections.version.content.sections = [];
assert(Detail.buildViewModel(input(premiumWithoutSections)).editorialSummary.warnings.includes(
    "Requiere autorización del contenido exacto. No verificada desde este panel"));

function element(tag) {
    return { tag, children: [], append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; }, addEventListener() {} };
}
const nodes = Object.fromEntries(["eventDetailSummary", "eventDetailVersions", "eventDetailWorkflow", "eventDetailContentStatus",
    "eventDetailCapabilities", "eventDetailEditorialSummary"].map(id => [id, element(id)]));
const view = Detail.createDetail({ document: { createElement: element, getElementById: id => nodes[id] },
    onAction() { throw Error("No operations expected"); } });
const action = { eventId: a.state.eventId, versionId: a.version.versionId, kind: "submit", label: "Review" };
view.render(Detail.buildViewModel({ ...input(a), action, actionDisabled: true }));
assert.equal(nodes.eventDetailWorkflow.children.at(-1).disabled, true);
const flatten = node => [node, ...node.children.flatMap(flatten)];
assert(flatten(nodes.eventDetailEditorialSummary).every(n => ["eventDetailEditorialSummary", "p", "ul", "li"].includes(n.tag)));
view.render(Detail.buildViewModel(input(b)));
assert(!JSON.stringify(nodes.eventDetailEditorialSummary).includes("synthetic-a"));
view.clear(); assert.equal(nodes.eventDetailEditorialSummary.children.length, 0);
assert.equal(JSON.stringify({ a, b }), before);

// Exercise the actual asynchronous detail loader, without authentication, network or application startup.
async function staleResponses() {
    const pending = new Map(), rendered = [];
    const context = vm.createContext({ AdminEventSummary: Summary,
        document: { addEventListener() {}, getElementById() { return {}; } } });
    vm.runInContext(fs.readFileSync(require.resolve("../js/admin.js"), "utf8"), context);
    context.client = { getVersion({ eventId }) { return new Promise(resolve => pending.set(eventId, resolve)); } };
    context.record = state => rendered.push(state.eventId);
    vm.runInContext("adminEditorialClient = client; renderDetailPresentation = record;", context);
    const select = f => {
        context.selection = f.state;
        vm.runInContext("currentEditorialState = selection; detailRevision++; detailDescription = null;", context);
        return vm.runInContext("loadDetailDescription(currentEditorialState, detailRevision)", context);
    };
    const loadA = select(a), loadB = select(b);
    pending.get(b.state.eventId)(b.version); await loadB;
    pending.get(a.state.eventId)(a.version); await loadA;
    assert.deepEqual(rendered, [b.state.eventId]);
    assert.equal(vm.runInContext("detailDescription.snapshotFacts.eventId", context), b.state.eventId);
    const c = fixture("synthetic-c"); const loadC = select(c);
    c.state.versions[0].workflowStatus = "approved";
    pending.get(c.state.eventId)(c.version); await loadC;
    assert.equal(vm.runInContext("detailDescription", context), null);
    assert.deepEqual(rendered, [b.state.eventId]);
}
staleResponses().then(() => console.log("editorial summary: scope, contradictions, stale responses and disabled controls PASS"))
    .catch(error => { console.error(error); process.exitCode = 1; });
