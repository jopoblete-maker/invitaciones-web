"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { validateEventForPersistence } = require("../js/core/event-validator");
const EventNormalizer = require("../js/core/event-normalizer");
const SectionRenderer = require("../js/core/section-renderer");
const TemplateRegistry = require("../js/core/template-registry");

const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = path.join(ROOT, ".dev", "drafts", "ycor-template-demo-boda-civil-romantica.event.json");
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));

assert.strictEqual(snapshot.schema_version, 2);
assert.strictEqual(snapshot.event_type, "wedding-civil");
assert.strictEqual(snapshot.template.slug, "boda-civil-esencial");
assert.strictEqual(snapshot.theme.slug, "romantico");
assert.strictEqual(snapshot.metadata.demo, true);
assert.strictEqual(snapshot.metadata.purpose, "template-catalog-preview");
assert.deepStrictEqual(validateEventForPersistence(snapshot), { valid: true, errors: [] });

const template = TemplateRegistry.getTemplate(snapshot.template.slug);
assert.strictEqual(template.catalog.variant.name, "Romántica");
assert.strictEqual(template.catalog.variant.themeSlug, snapshot.theme.slug);
assert.strictEqual(template.catalog.preview, null);

Object.values(snapshot.media.items).forEach((item) => {
    assert(item.src.startsWith("/assets/templates/boda-civil-esencial/demo/"));
    assert.strictEqual(fs.existsSync(path.join(ROOT, item.src.slice(1))), true, item.src);
});
assert.strictEqual(fs.existsSync(path.join(ROOT, "assets", "templates", "boda-civil-esencial", "thumbnail.webp")), true);

const serialized = JSON.stringify(snapshot).toLowerCase();
["kaly", "joha", "moira", "assets/events/", "unsplash"].forEach((forbidden) => {
    assert.strictEqual(serialized.includes(forbidden), false, `Referencia prohibida: ${forbidden}`);
});

const normalized = EventNormalizer.normalizeEvent(snapshot);
assert.deepStrictEqual(
    SectionRenderer.getRenderableSections(normalized.sections).map((section) => section.type),
    ["hero", "event-info", "location", "countdown", "closing"]
);

console.log("boda civil romantica demo test passed");
