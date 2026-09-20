"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ThemeRegistry = require("../js/core/theme-registry");

const invitationScript = fs.readFileSync(
    path.resolve(__dirname, "..", "js", "invitacion.js"),
    "utf8"
);

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(value) {
        this.values.add(value);
    }

    toggle(value, force) {
        if (force) this.values.add(value);
        else this.values.delete(value);
    }

    contains(value) {
        return this.values.has(value);
    }
}

class FakeLink {
    constructor(href = null) {
        this.attributes = new Map();
        this.dataset = {};
        this.listeners = new Map();
        this.sheet = null;
        this.id = "template-stylesheet";
        this.rel = "stylesheet";
        if (href) this.attributes.set("href", href);
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, value);
    }

    dispatch(type) {
        [...(this.listeners.get(type) || [])].forEach((listener) => listener({ type, target: this }));
    }

    listenerCount(type) {
        return this.listeners.get(type)?.size || 0;
    }
}

function createRuntime(options = {}) {
    let stylesheetLink = options.link === undefined ? new FakeLink() : options.link;
    const app = { classList: new FakeClassList(), dataset: {}, innerHTML: "" };
    const loader = { classList: new FakeClassList(), addEventListener() {}, remove() {} };
    const calls = [];
    const template = {
        slug: "cumple-clasico",
        layout: "paged",
        className: "template-cumple-clasico",
        stylesheet: "/css/templates/cumple-clasico.css",
        defaultTheme: null
    };
    const event = {
        template: { slug: template.slug },
        tema: "fiesta",
        fontFamily: "",
        estilos: {}
    };
    const document = {
        addEventListener() {},
        body: { dataset: {} },
        documentElement: { style: { setProperty() {} } },
        head: {
            appendChild(node) {
                stylesheetLink = node;
            }
        },
        createElement(tagName) {
            assert.strictEqual(tagName, "link");
            return new FakeLink();
        },
        getElementById(id) {
            if (id === "template-stylesheet") return stylesheetLink;
            if (id === "app") return app;
            if (id === "loadingOverlay") return loader;
            return null;
        },
        querySelector() {
            return null;
        }
    };
    const context = {
        console: { error() {} },
        URL,
        URLSearchParams,
        ThemeRegistry,
        InvitationDataSource: {
            selectInvitationSource() {
                return { mode: "public", eventId: "stylesheet-test", privatePreview: false };
            },
            async loadInvitationSource() {
                return {};
            }
        },
        EventNormalizer: { normalizeEvent() { return event; } },
        TemplateRegistry: { resolveTemplate() { return template; } },
        document,
        fetch() {},
        window: {
            location: { search: "?id=stylesheet-test", hostname: "localhost" },
            setTimeout() {}
        }
    };

    vm.createContext(context);
    vm.runInContext(invitationScript, context);
    context.applyTheme = () => calls.push("theme");
    context.renderInvitation = () => calls.push("render");
    context.hideLoader = () => calls.push("hide-loader");
    context.renderState = (message) => calls.push(`state:${message}`);

    return {
        app,
        calls,
        context,
        document,
        getLink: () => stylesheetLink,
        template
    };
}

async function flushBootstrap() {
    await Promise.resolve();
    await Promise.resolve();
}

(async () => {
    const alreadyLoadedLink = new FakeLink("/css/templates/cumple-clasico.css");
    alreadyLoadedLink.sheet = {};
    const alreadyLoaded = createRuntime({ link: alreadyLoadedLink });
    assert.strictEqual(
        await alreadyLoaded.context.loadTemplateStylesheet(alreadyLoaded.template),
        alreadyLoadedLink
    );
    assert.strictEqual(alreadyLoadedLink.dataset.loadedHref, alreadyLoaded.template.stylesheet);
    assert.strictEqual(alreadyLoadedLink.listenerCount("load"), 0);

    const changed = createRuntime({ link: new FakeLink("/css/templates/boda-vertical.css") });
    let changeResolved = false;
    const initialChangedPromise = changed.context.loadTemplateStylesheet(changed.template);
    const changedPromise = initialChangedPromise
        .then((link) => {
            changeResolved = true;
            return link;
        });
    await Promise.resolve();
    assert.strictEqual(changeResolved, false);
    assert.strictEqual(changed.context.loadTemplateStylesheet(changed.template), initialChangedPromise);
    assert.strictEqual(changed.getLink().getAttribute("href"), changed.template.stylesheet);
    assert.strictEqual(changed.getLink().listenerCount("load"), 1);
    assert.strictEqual(changed.getLink().listenerCount("error"), 1);
    changed.getLink().dispatch("load");
    assert.strictEqual(await changedPromise, changed.getLink());
    assert.strictEqual(changeResolved, true);
    assert.strictEqual(changed.getLink().listenerCount("load"), 0);
    assert.strictEqual(changed.getLink().listenerCount("error"), 0);

    const repeated = changed.context.loadTemplateStylesheet(changed.template);
    assert.strictEqual(await repeated, changed.getLink());
    assert.strictEqual(changed.getLink().listenerCount("load"), 0);

    const failed = createRuntime();
    const failedPromise = failed.context.loadTemplateStylesheet(failed.template);
    const expectedFailure = assert.rejects(failedPromise, /No se pudo cargar el stylesheet/);
    failed.getLink().dispatch("error");
    await expectedFailure;
    assert.strictEqual(failed.getLink().listenerCount("load"), 0);
    assert.strictEqual(failed.getLink().listenerCount("error"), 0);

    const created = createRuntime({ link: null });
    const createdPromise = created.context.loadTemplateStylesheet(created.template);
    assert.strictEqual(created.getLink().getAttribute("href"), created.template.stylesheet);
    created.getLink().dispatch("load");
    await createdPromise;

    const bootstrap = createRuntime();
    const bootstrapPromise = bootstrap.context.initInvitation();
    await flushBootstrap();
    assert.strictEqual(bootstrap.document.body.dataset.template, bootstrap.template.slug);
    assert.strictEqual(bootstrap.app.classList.contains(bootstrap.template.className), true);
    assert.deepStrictEqual(bootstrap.calls, []);
    bootstrap.getLink().dispatch("load");
    await bootstrapPromise;
    assert.deepStrictEqual(bootstrap.calls, ["theme", "render", "hide-loader"]);

    const controlledError = createRuntime();
    const controlledErrorPromise = controlledError.context.initInvitation();
    await flushBootstrap();
    controlledError.getLink().dispatch("error");
    await controlledErrorPromise;
    assert.deepStrictEqual(controlledError.calls, ["state:Invitaci\u00f3n no encontrada"]);

    const invitationHtml = fs.readFileSync(path.resolve(__dirname, "..", "invitacion.html"), "utf8");
    const stylesheetTag = invitationHtml.match(/<link\s+id="template-stylesheet"[^>]*>/)?.[0] || "";
    assert(stylesheetTag);
    assert(!stylesheetTag.includes("href="));
    assert(!stylesheetTag.includes("boda-vertical.css"));

    console.log("template-stylesheet-runtime test passed");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
