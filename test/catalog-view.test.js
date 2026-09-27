"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(ROOT, "js", "catalogo.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "catalogo.html"), "utf8");

class FakeNode {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.className = "";
        this.textContent = "";
        this.hidden = false;
    }

    append(...children) {
        this.children.push(...children);
    }

    replaceChildren(...children) {
        this.children = children;
    }
}

function findByTag(node, tagName) {
    return node.children.flatMap((child) => [
        ...(child.tagName === tagName.toUpperCase() ? [child] : []),
        ...findByTag(child, tagName)
    ]);
}

async function renderCatalog({ entries, loadableEntries }) {
    const root = new FakeNode("div");
    const status = new FakeNode("p");
    let onReady;
    let probeCalls = 0;
    const document = {
        addEventListener(type, listener) {
            if (type === "DOMContentLoaded") onReady = listener;
        },
        createElement(tagName) {
            return new FakeNode(tagName);
        },
        getElementById(id) {
            return id === "catalogGrid" ? root : status;
        }
    };
    const context = {
        console,
        document,
        TemplateRegistry: {},
        ThemeRegistry: {},
        TemplateCatalog: {
            buildCatalogEntries: () => entries,
            filterLoadableThumbnails: async (received, loadImage) => {
                assert.strictEqual(received, entries);
                if (received.length > 0) await loadImage(received[0].thumbnail.src);
                return loadableEntries;
            },
            probeImage: async () => {
                probeCalls += 1;
                return loadableEntries.length > 0;
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(script, context);
    await onReady();
    return { probeCalls, root, status };
}

(async () => {
    const entry = {
        slug: "boda-vertical",
        name: "Boda vertical",
        categoryLabel: "Bodas",
        description: "Invitación sintética.",
        variantName: "Elegante",
        thumbnail: { src: "/assets/templates/boda-vertical/thumbnail.webp", alt: "Demo" }
    };

    const visible = await renderCatalog({ entries: [entry], loadableEntries: [entry] });
    assert.strictEqual(visible.root.children.length, 1);
    assert.strictEqual(visible.status.hidden, true);
    assert.strictEqual(visible.probeCalls, 1);
    assert.strictEqual(findByTag(visible.root, "a").length, 0);

    const empty = await renderCatalog({ entries: [], loadableEntries: [] });
    assert.strictEqual(empty.status.hidden, false);
    assert.strictEqual(empty.status.textContent, "No hay diseños catalogados.");
    assert.strictEqual(empty.probeCalls, 0);

    const failedImage = await renderCatalog({ entries: [entry], loadableEntries: [] });
    assert.strictEqual(failedImage.status.hidden, false);
    assert.strictEqual(failedImage.status.textContent, "No se pudo cargar la imagen del diseño.");
    assert.strictEqual(failedImage.root.children.length, 0);

    assert(html.includes('id="catalogStatus"'));
    assert(html.includes('role="status"'));
    assert(html.includes('/js/core/template-registry.js'));
    assert(html.includes('/js/core/theme-registry.js'));
    assert(html.includes('/js/core/template-catalog.js'));
    assert(html.includes('/js/catalogo.js'));
    assert(!html.includes("Ver invitación"));
    assert(!script.includes("fetch("));
    assert(!script.includes("previewHref"));
    assert(!script.includes("verifyPublicPreview"));

    console.log("catalog view tests passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
