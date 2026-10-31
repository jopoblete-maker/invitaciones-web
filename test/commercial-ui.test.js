"use strict";
const assert = require("node:assert/strict");
const UI = require("../js/comercial");
const Contact = require("../js/core/commercial-contact");
class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.attrs = {}; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener(k, f) { this.listeners[k] = f; }
    focus() { this.focused = true; }
    select() { this.selected = true; }
}
function find(root, tag) { return root.children.flatMap(n => [...(n.tagName === tag ? [n] : []), ...find(n, tag)]); }
(async () => {
    const selection = new Node("p");
    let copied;
    const doc = { createElement: tag => new Node(tag), getElementById: id => id === "catalogSelection" ? selection : null,
        defaultView: { navigator: { clipboard: { async writeText(v) { copied = v; } } } } };
    const request = Contact.templateRequest("synthetic", { getTemplate: slug => ({ slug, name: "Plantilla sintética", status: "active", catalog: { variant: { name: "Variante" } } }) });
    const root = UI.createRequestActions(doc, request);
    const link = find(root, "a")[0];
    assert.equal(link.href, request.href);
    assert.equal(link.rel, "noopener noreferrer");
    link.listeners.click();
    assert(selection.textContent.includes("Plantilla sintética · Variante"));
    const buttons = find(root, "button");
    await buttons[0].listeners.click();
    assert.equal(copied, "5491157339281");
    await buttons[1].listeners.click();
    assert.equal(copied, request.message);
    doc.defaultView.navigator.clipboard = null;
    await buttons[0].listeners.click();
    const input = find(root, "input")[0];
    assert(input.focused && input.selected && input.readOnly);
    await buttons[1].listeners.click();
    assert(find(root, "textarea")[0].selected);
    assert(root.children.some(n => n.attrs.role === "status"));
    console.log("commercial UI: selection, explicit copy and manual fallback PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
