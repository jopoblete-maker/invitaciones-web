const assert = require("assert");
const fs = require("fs");
const path = require("path");
const InvitationDataSource = require("../js/core/invitation-data-source");
const EventNormalizer = require("../js/core/event-normalizer");
const TemplateRegistry = require("../js/core/template-registry");
const SectionRenderer = require("../js/core/section-renderer");

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const v2 = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "fixtures", "event-v2-complete.json"),
    "utf8"
));
const snapshots = [
    {
        id: "legacy-preview",
        nombre: "Legacy Preview",
        tema: "romantico",
        template_slug: "boda-vertical",
        multimedia: { capas: {} }
    },
    {
        id: "v1-preview",
        schema_version: 1,
        event: { title: "V1 Preview" },
        template: { slug: "boda-civil-esencial" },
        sections: [
            { id: "hero", type: "hero", enabled: true, order: 10, data: {} }
        ]
    },
    v2
];

(async () => {
    for (const snapshot of snapshots) {
        const before = JSON.stringify(snapshot);
        const source = InvitationDataSource.selectInvitationSource(
            `?preview=1&eventId=mock-event&versionId=${VERSION_ID}`,
            "localhost"
        );
        const loaded = await InvitationDataSource.loadInvitationSource(source, async () => ({
            ok: true,
            json: async () => snapshot
        }));
        const normalized = EventNormalizer.normalizeEvent(loaded);
        const template = TemplateRegistry.resolveTemplate(
            normalized.template.slug || normalized.template_slug
        );
        const renderable = SectionRenderer.getRenderableSections(normalized.sections);
        const rendererKeys = Object.values(SectionRenderer.SECTION_RENDERER_REGISTRY);
        const renderers = Object.fromEntries(rendererKeys.map((key) => [
            key,
            (section) => `${key}:${section.id}`
        ]));
        const rendered = SectionRenderer.renderSections(renderable, { renderers });

        assert(template);
        assert(renderable.length > 0);
        assert.strictEqual(rendered.length, renderable.length);
        assert.strictEqual(JSON.stringify(snapshot), before);
    }

    console.log("persisted-preview-pipeline tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
