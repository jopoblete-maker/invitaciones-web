"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const TemplateRegistry = require("../js/core/template-registry");
const ThemeRegistry = require("../js/core/theme-registry");
const TemplateCatalog = require("../js/core/template-catalog");

const ROOT = path.resolve(__dirname, "..");

function template(overrides = {}) {
    return {
        slug: "demo-template",
        name: "Demo",
        category: "wedding",
        status: "active",
        catalog: {
            description: "Una variante sintética.",
            variant: { name: "Clásica", themeSlug: "elegante" },
            thumbnail: {
                src: "/assets/templates/demo-template/thumbnail.webp",
                alt: "Vista previa sintética"
            },
            preview: { eventId: "demo-template-preview" }
        },
        ...overrides
    };
}

function registryWith(templates) {
    return {
        listCatalogTemplates: () => templates,
        isTemplateAssetPath: TemplateRegistry.isTemplateAssetPath,
        isValidEventId: TemplateRegistry.isValidEventId
    };
}

(async () => {
    const entries = TemplateCatalog.buildCatalogEntries(TemplateRegistry, ThemeRegistry);
    assert.deepStrictEqual(entries.map((entry) => `${entry.name} / ${entry.variantName}`), [
        "Boda vertical / Elegante",
        "Cumpleaños / Fiesta clásica",
        "Boda civil / Romántica"
    ]);
    assert.strictEqual(TemplateRegistry.getTemplate("boda-civil-esencial").name, "Boda civil esencial");
    assert.deepStrictEqual(entries.map((entry) => entry.categoryLabel), ["Bodas", "Cumpleaños", "Bodas"]);
    entries.forEach((entry) => {
        assert.strictEqual(Object.prototype.hasOwnProperty.call(entry, "demoEventId"), false);
        assert.strictEqual(fs.existsSync(path.join(ROOT, entry.thumbnail.src.slice(1))), true);
    });
    assert.strictEqual(entries[0].previewEventId, "ycor-template-demo-boda-vertical");
    assert.strictEqual(entries[1].previewEventId, null);
    assert.deepStrictEqual(
        TemplateRegistry.getCatalogPreview("ycor-template-demo-boda-vertical"),
        {
            eventId: "ycor-template-demo-boda-vertical",
            templateSlug: "boda-vertical",
            themeSlug: "elegante"
        }
    );
    assert.strictEqual(TemplateRegistry.getCatalogPreview("unknown-preview"), undefined);
    assert.strictEqual(
        TemplateCatalog.catalogPreviewHref(entries[0], TemplateRegistry),
        "/invitacion.html?catalogPreview=ycor-template-demo-boda-vertical"
    );
    assert.strictEqual(TemplateCatalog.catalogPreviewHref(entries[1], TemplateRegistry), null);

    const incomplete = [
        template({ catalog: null }),
        template({ status: "inactive" }),
        template({ category: "unknown" }),
        template({ catalog: { ...template().catalog, displayName: "" } }),
        template({ catalog: { ...template().catalog, variant: { name: "Demo", themeSlug: "unknown" } } }),
        template({ catalog: { ...template().catalog, description: "" } }),
        template({ catalog: { ...template().catalog, variant: { name: "", themeSlug: "elegante" } } }),
        template({ catalog: { ...template().catalog, thumbnail: { src: "", alt: "Demo" } } }),
        template({ catalog: { ...template().catalog, thumbnail: { src: "/assets/events/client/hero.webp", alt: "Cliente" } } }),
        template({ catalog: { ...template().catalog, thumbnail: { src: "/assets/templates/demo-template/../client/hero.webp", alt: "Cliente" } } }),
        template({ catalog: { ...template().catalog, thumbnail: { src: "/assets/templates/demo-template/%2e%2e/client/hero.webp", alt: "Cliente" } } }),
        template({ catalog: { ...template().catalog, thumbnail: { src: "/assets/templates/demo-template/thumbnail.webp?x=1", alt: "Demo" } } }),
        template({ catalog: { ...template().catalog, preview: {} } })
    ];
    assert.deepStrictEqual(TemplateCatalog.buildCatalogEntries(registryWith(incomplete), ThemeRegistry), []);

    const fallbackName = TemplateCatalog.buildCatalogEntries(registryWith([template()]), ThemeRegistry);
    assert.strictEqual(fallbackName[0].name, "Demo");

    const loadable = await TemplateCatalog.filterLoadableThumbnails([
        { thumbnail: { src: "/valid.webp" } },
        { thumbnail: { src: "/missing.webp" } }
    ], async (src) => src === "/valid.webp");
    assert.deepStrictEqual(loadable.map((entry) => entry.thumbnail.src), ["/valid.webp"]);

    let pendingImage;
    let timeoutCallback;
    let clearedTimeout;
    class PendingImage {
        constructor() {
            pendingImage = this;
        }
    }
    const timedOut = TemplateCatalog.probeImage("/pending.webp", {
        ImageCtor: PendingImage,
        timeoutMs: 25,
        setTimeoutImpl(callback, milliseconds) {
            assert.strictEqual(milliseconds, 25);
            timeoutCallback = callback;
            return 17;
        },
        clearTimeoutImpl(timeoutId) {
            clearedTimeout = timeoutId;
        }
    });
    timeoutCallback();
    assert.strictEqual(await timedOut, false);
    assert.strictEqual(clearedTimeout, 17);
    assert.strictEqual(pendingImage.onload, null);
    assert.strictEqual(pendingImage.onerror, null);

    let loadedImage;
    class LoadedImage {
        constructor() {
            loadedImage = this;
        }

        set src(_value) {
            this.onload();
        }
    }
    assert.strictEqual(await TemplateCatalog.probeImage("/loaded.webp", {
        ImageCtor: LoadedImage,
        setTimeoutImpl: () => 23,
        clearTimeoutImpl: (timeoutId) => assert.strictEqual(timeoutId, 23)
    }), true);
    assert.strictEqual(loadedImage.onload, null);
    assert.strictEqual(loadedImage.onerror, null);

    const serializedCatalog = JSON.stringify(entries).toLowerCase();
    ["kaly", "joha", "moira", "assets/events/"].forEach((clientReference) => {
        assert.strictEqual(serializedCatalog.includes(clientReference), false);
    });
    const validPayload = {
        eventId: entries[0].previewEventId,
        versionId: "published-version",
        content: {
            schema_version: 2,
            template: { slug: entries[0].slug },
            theme: { slug: entries[0].themeSlug },
            metadata: { demo: true, purpose: "template-catalog-preview" }
        }
    };
    const calls = [];
    assert.strictEqual(await TemplateCatalog.verifyCatalogPreview(entries[0], async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => validPayload };
    }), true);
    assert.strictEqual(calls[0].url, "/api/catalogo/previews/ycor-template-demo-boda-vertical");
    assert.strictEqual(calls[0].options.cache, "no-store");

    for (const payload of [
        { ...validPayload, eventId: "another-event" },
        { ...validPayload, versionId: "" },
        { ...validPayload, content: { ...validPayload.content, schema_version: 1 } },
        { ...validPayload, content: { ...validPayload.content, template: { slug: "other" } } },
        { ...validPayload, content: { ...validPayload.content, theme: { slug: "other" } } },
        { ...validPayload, content: { ...validPayload.content, metadata: { demo: false, purpose: "template-catalog-preview" } } },
        { ...validPayload, content: { ...validPayload.content, metadata: { demo: true, purpose: "other" } } }
    ]) {
        assert.strictEqual(await TemplateCatalog.verifyCatalogPreview(
            entries[0],
            async () => ({ ok: true, json: async () => payload })
        ), false);
    }
    assert.strictEqual(await TemplateCatalog.verifyCatalogPreview(
        entries[0],
        async () => ({ ok: false })
    ), false);
    let absentPreviewCalls = 0;
    assert.strictEqual(await TemplateCatalog.verifyCatalogPreview(entries[1], async () => {
        absentPreviewCalls += 1;
        return { ok: true };
    }), false);
    assert.strictEqual(absentPreviewCalls, 0);
    assert.strictEqual(await TemplateCatalog.verifyCatalogPreview(
        entries[0],
        async () => { throw new Error("network"); }
    ), false);
    let aborted = false;
    let previewTimeoutCallback;
    class AbortControllerDouble {
        constructor() {
            this.signal = {};
        }
        abort() {
            aborted = true;
            this.signal.reject(new Error("aborted"));
        }
    }
    const pending = TemplateCatalog.verifyCatalogPreview(
        entries[0],
        (_url, { signal }) => new Promise((_resolve, reject) => {
            signal.reject = reject;
        }),
        {
            timeoutMs: 10,
            AbortControllerCtor: AbortControllerDouble,
            setTimeoutImpl(callback) { previewTimeoutCallback = callback; return 31; },
            clearTimeoutImpl() {}
        }
    );
    previewTimeoutCallback();
    assert.strictEqual(aborted, true);
    assert.strictEqual(await pending, false);

    console.log("template catalog tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
