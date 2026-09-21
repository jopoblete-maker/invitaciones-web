"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { validateEventForPersistence } = require("../js/core/event-validator");
const EventNormalizer = require("../js/core/event-normalizer");
const InvitationDataSource = require("../js/core/invitation-data-source");
const SectionRenderer = require("../js/core/section-renderer");
const TemplateRegistry = require("../js/core/template-registry");
const { handleRequest } = require("../scripts/dev-preview-server");

const ROOT = path.resolve(__dirname, "..");
const DRAFT_NAME = "ycor-template-demo-boda-vertical";
const DRAFT_PATH = path.join(ROOT, ".dev", "drafts", `${DRAFT_NAME}.event.json`);
const TEMPLATE_CSS_PATH = path.join(ROOT, "css", "templates", "boda-vertical.css");
const EXPECTED_SECTIONS = [
    "hero",
    "event-info",
    "location",
    "rsvp",
    "countdown",
    "closing",
    "media-closing"
];
const EXPECTED_ENABLED_SECTIONS = EXPECTED_SECTIONS.filter((type) => type !== "rsvp");

function previewRequest(url) {
    return new Promise((resolve) => {
        const response = {
            statusCode: 200,
            headers: {},
            writeHead(statusCode, headers = {}) {
                this.statusCode = statusCode;
                this.headers = headers;
            },
            end(content = "") {
                resolve({
                    statusCode: this.statusCode,
                    headers: this.headers,
                    body: String(content)
                });
            }
        };
        handleRequest({ url, method: "GET", headers: {} }, response);
    });
}

(async () => {
    assert.strictEqual(fs.existsSync(DRAFT_PATH), true);
    const raw = fs.readFileSync(DRAFT_PATH, "utf8");
    const demo = JSON.parse(raw);

    assert.strictEqual(demo.schema_version, 2);
    assert.strictEqual(demo.id, DRAFT_NAME);
    assert.strictEqual(demo.event_type, "wedding");
    assert.strictEqual(demo.plan, "esencial");
    assert.strictEqual(demo.status, "ready_for_preview");
    assert.strictEqual(demo.template.slug, "boda-vertical");
    assert.strictEqual(demo.theme.slug, "elegante");
    assert.strictEqual(demo.theme.overrides, undefined);
    assert.deepStrictEqual(demo.metadata, {
        locale: "es-AR",
        purpose: "template-catalog-preview",
        demo: true
    });
    assert.deepStrictEqual(validateEventForPersistence(demo), { valid: true, errors: [] });

    assert.deepStrictEqual(demo.sections.map((section) => section.type), EXPECTED_SECTIONS);
    assert.deepStrictEqual(
        demo.sections.filter((section) => section.enabled).map((section) => section.type),
        EXPECTED_ENABLED_SECTIONS
    );
    assert.strictEqual(demo.sections.find((section) => section.type === "rsvp").enabled, false);
    assert.strictEqual(new Set(demo.sections.map((section) => section.id)).size, EXPECTED_SECTIONS.length);
    assert.deepStrictEqual(demo.sections.map((section) => section.order), [10, 20, 30, 40, 50, 60, 70]);

    const template = TemplateRegistry.getTemplate("boda-vertical");
    assert.strictEqual(template.layout, "vertical");
    assert.strictEqual(demo.sections.every((section) => template.supportedSections.includes(section.type)), true);
    assert.strictEqual(Object.keys(demo.modules).every((slug) => template.supportedModules.includes(slug)), true);
    assert.strictEqual(template.supportedSections.includes("rsvp"), true);
    assert.strictEqual(template.supportedModules.includes("rsvp"), true);
    assert.strictEqual(demo.modules.music.enabled, false);
    assert.deepStrictEqual(demo.modules.music.tracks, []);
    assert.strictEqual(demo.modules.rsvp.enabled, true);
    assert.deepStrictEqual(demo.modules.rsvp.contacts, []);
    assert.strictEqual(demo.modules.branding.enabled, true);
    assert.strictEqual(demo.modules.branding.whatsapp, "");
    assert.strictEqual(demo.modules.branding.portfolioUrl, "");
    assert.strictEqual(demo.modules.branding.instagramUrl, "");

    Object.values(demo.media.items).forEach((item) => {
        assert(item.src.startsWith("/assets/templates/boda-vertical/demo/"));
        assert.strictEqual(fs.existsSync(path.join(ROOT, item.src.slice(1))), true, item.src);
    });

    const serialized = JSON.stringify(demo).toLowerCase();
    ["kaly", "joha", "moira", "assets/events/", "assets.example.test", "unsplash"].forEach((forbidden) => {
        assert.strictEqual(serialized.includes(forbidden), false, `Referencia prohibida: ${forbidden}`);
    });
    assert.deepStrictEqual(serialized.match(/https?:\/\/[^\" ]+/g), [
        "https://www.google.com/maps/search/?api=1&query=buenos+aires"
    ]);

    const normalized = EventNormalizer.normalizeEvent(demo);
    assert.deepStrictEqual(
        SectionRenderer.getRenderableSections(normalized.sections).map((section) => section.type),
        EXPECTED_ENABLED_SECTIONS
    );
    assert.strictEqual(normalized.music.tracks.length, 0);
    assert.deepStrictEqual(normalized.contactosRSVP, []);

    const templateCss = fs.readFileSync(TEMPLATE_CSS_PATH, "utf8");
    assert.strictEqual(/\.invitation-dashboard\s*\{/.test(templateCss), false);
    assert.strictEqual(/scroll-snap-type:\s*x\b/.test(templateCss), false);
    assert.strictEqual(/flex:\s*0\s+0\s+100%/.test(templateCss), false);
    assert.strictEqual(/min-width:\s*100vw/.test(templateCss), false);
    assert.strictEqual(/translateX\(/.test(templateCss), false);
    assert.match(templateCss, /\.invitation-shell\s*\{[^}]*height:\s*auto;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*visible;/s);
    assert.match(templateCss, /\.wedding-section\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*100svh;/s);

    assert.deepStrictEqual(template.catalog, {
        description: "Invitación de boda elegante en formato vertical, con ubicación, cuenta regresiva y una experiencia visual adaptable a dispositivos móviles.",
        thumbnail: {
            src: "/assets/templates/boda-vertical/thumbnail.webp",
            alt: "Vista previa de la plantilla Boda vertical"
        },
        preview: null
    });
    assert.deepStrictEqual(
        TemplateRegistry.listCatalogTemplates().map((catalogTemplate) => catalogTemplate.slug),
        ["boda-vertical"]
    );
    assert.strictEqual(
        fs.existsSync(path.join(ROOT, "assets", "templates", "boda-vertical", "thumbnail.webp")),
        true
    );

    assert.deepStrictEqual(
        InvitationDataSource.selectInvitationSource(`?devDraft=${DRAFT_NAME}`, "127.0.0.1"),
        {
            mode: "local-draft",
            url: `/__dev-drafts/${DRAFT_NAME}.event.json`
        }
    );
    assert.strictEqual(
        InvitationDataSource.selectInvitationSource("?devDraft=no-permitido", "127.0.0.1").mode,
        "invalid-preview"
    );

    const preview = await previewRequest(`/__dev-drafts/${DRAFT_NAME}.event.json`);
    assert.strictEqual(preview.statusCode, 200);
    assert.strictEqual(preview.headers["Content-Type"], "application/json; charset=utf-8");
    assert.strictEqual(preview.headers["Cache-Control"], "no-store");
    assert.deepStrictEqual(JSON.parse(preview.body), demo);

    console.log("boda-vertical-demo test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
