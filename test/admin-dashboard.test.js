"use strict";
const assert = require("assert");
const Dashboard = require("../js/core/admin-dashboard");
const Summary = require("../js/core/admin-event-summary");
const event = (id, status = "active", workflow = "draft") => ({ eventId: id, eventStatus: status,
    currentWorkingVersionId: `work-${id}`, publishedVersionId: `pub-${id}`, workingVersion: { workflowStatus: workflow, versionNumber: 2 }, publishedVersion: { versionNumber: 1 },
    summary: Summary.project({ working: { schema_version: 2, identity: { title: "Celebración" }, event_type: "birthday", template: { slug: "cumple-clasico" }, schedule: { date: "2028-01-01" } } }) });
const events = [event("one"), event("two", "active", "in_review"), event("three", "archived"), { eventId: "four", eventStatus: "active", summary: Summary.project() }];
assert.deepStrictEqual(Dashboard.metrics(events, new Date("2027-01-01T12:00Z")), { active: 3, draft: 1, review: 1, published: 2, upcoming: 2 });
assert.strictEqual(Dashboard.filterEvents(events, { text: "celebracion" }).length, 3);
assert.strictEqual(Dashboard.filterEvents(events, { text: "one" })[0].eventId, "one");
assert.strictEqual(Dashboard.filterEvents(events, { text: "birthday" }).length, 3);
assert.strictEqual(Dashboard.filterEvents(events, { text: "cumple-clasico", status: "active", workflow: "in_review" })[0].eventId, "two");
assert.strictEqual(Dashboard.filterEvents(events, { workflow: "none" })[0].eventId, "four");
const merged = Dashboard.mergeEvents(events, [{ ...events[0], eventStatus: "archived" }, event("five")]);
assert.strictEqual(merged.length, 5);
assert.strictEqual(merged[0].eventStatus, "archived");
assert.strictEqual(events[0].eventStatus, "active");
assert.strictEqual(Dashboard.canPreview(events[2]), false);
assert.strictEqual(Dashboard.canPreview(events[3]), false);

function node(tag) {
    return { tag, dataset: {}, children: [], listeners: {}, hidden: false, disabled: false, value: "", textContent: "",
        append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
        addEventListener(type, listener) { this.listeners[type] = listener; } };
}
const ids = ["dashboardMetrics", "dashboardRows", "dashboardCount", "dashboardStatus", "dashboardLoadMore", "loadEditorialEvents", "dashboardSearch", "dashboardStatusFilter", "dashboardWorkflowFilter"];
const elements = Object.fromEntries(ids.map((id) => [id, node(id)]));
const selected = [], previews = []; let more = 0;
const view = Dashboard.createDashboard({ document: { createElement: node, getElementById: (id) => elements[id] }, onManage: (id) => selected.push(id), onPreview: (id) => previews.push(id), onLoadMore: () => more++ });
const malicious = event("<img src=x onerror=alert(1)>");
malicious.summary.title = "<script>alert(1)</script>";
view.update({ events: [malicious, events[3]], nextCursor: "signed-cursor", message: "Loaded" });
const row = elements.dashboardRows.children[0];
assert.strictEqual(row.children[0].children[0].textContent, malicious.summary.title);
assert.strictEqual(row.children[0].children[0].children.length, 0);
assert.strictEqual(row.children[0].children[1].textContent, malicious.eventId);
assert.strictEqual(elements.dashboardRows.children[1].children[0].children[0].textContent, "Sin título");
row.children[6].children[0].listeners.click();
row.children[6].children[1].listeners.click();
assert.deepStrictEqual(selected, [malicious.eventId]);
assert.deepStrictEqual(previews, [malicious.eventId]);
assert.strictEqual(elements.dashboardRows.children[1].children[6].children[1].disabled, true);
assert.strictEqual(elements.dashboardLoadMore.hidden, false);
elements.dashboardLoadMore.listeners.click(); assert.strictEqual(more, 1);
view.update({ loading: true }); elements.dashboardLoadMore.listeners.click(); assert.strictEqual(more, 1);
assert.strictEqual(elements.loadEditorialEvents.disabled, true);
view.update({ loading: false, nextCursor: null });
assert.strictEqual(elements.dashboardLoadMore.hidden, true);
elements.dashboardLoadMore.listeners.click(); assert.strictEqual(more, 1);
elements.dashboardSearch.listeners.input({ target: { value: "missing" } });
assert.strictEqual(elements.dashboardCount.textContent, "0 visibles · 2 cargados");
assert.strictEqual(elements.dashboardRows.children[0].children[0].colSpan, 7);
view.reset();
assert.strictEqual(elements.dashboardCount.textContent, "0 visibles · 0 cargados");
assert.strictEqual(elements.dashboardSearch.value, "");
console.log("admin dashboard tests passed");
