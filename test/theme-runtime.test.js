"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ThemeRegistry = require("../js/core/theme-registry");
const EventNormalizer = require("../js/core/event-normalizer");
const TemplateRegistry = require("../js/core/template-registry");

const expectedHashes = {
    elegante: "fb9615e2c9523e5fb76e8b50736a9b6caf3ee53046f1e02d98c389bf6c0fcd89",
    frozen: "3bdc4dbedf7bac40ad3588e4f5dcdbeaa8df09787499e7f1fbc1bde4576c0d43",
    pesca: "af15c27a866fc020ead7a44b570cd2cabf5d69e301d9003599716ed1db877693",
    minimalista: "e3a58e652fe49d263c680b9328fa015057374446f67e6f07e54dccef8e014ccd",
    fiesta: "9e59fd80ae3645c8ab755ba127957292ed729161be50de702a0bd69228636e75",
    vintage: "0c6e335fb8d9a89b4afa683d3e6824837e8a8c3f17bf0423b2cfe38a026416ec",
    "dorado-premium": "dc7afc61905d5912db65d4c1bf92afd657a9820cf25746d5522b49a265d6dbf9",
    tropical: "2880fdb3aa56241f6cf52ed3d1ca94d9805b95b0c381aa4feeed215009656464",
    botanico: "200fec575b05610f97a3070c9ef9ee486655bd0db30c1fa21822b9c662705acf",
    "infantil-pastel": "0d0ea981feb07805f89ac7778f020da4395534fc8db9d1e9722c38a6cf28ed50",
    mistico: "6e9964e460a4de6ac7e811df2aeaeb3f3215e96cbb09fc325a585e07c13dfd50",
    urbano: "12bf668d9b6d3898c18eaf07f8cff8cc23c8a8c8292d8094e1ac0de9f2481262",
    "infantil-dinamico": "efff3413ab314297d2e826518f1edbef0a6867cacde6d5014b68260479db9872",
    romantico: "88ee0940b44cd06dbc041f6f37fc1f3269b560ec01bccce6f2090ab70faf5b1e",
    corporativo: "d4b7a1a030521e5cad02518f0b54c613e8ad3af0f0d6b0ccc6cba77db88bd99a"
};

assert.deepStrictEqual(ThemeRegistry.listThemes().map((theme) => theme.slug), Object.keys(expectedHashes));
ThemeRegistry.listThemes().forEach((theme) => {
    assert.strictEqual(theme.status, "active");
    assert.deepStrictEqual(Object.keys(theme.tokens), ThemeRegistry.RUNTIME_TOKEN_KEYS);
    assert.strictEqual(Object.isFrozen(theme), true);
    assert.strictEqual(Object.isFrozen(theme.tokens), true);
    const hash = crypto.createHash("sha256").update(JSON.stringify(theme.tokens)).digest("hex");
    assert.strictEqual(hash, expectedHashes[theme.slug], `${theme.slug} cambio sus tokens visuales`);
});

assert.strictEqual(ThemeRegistry.hasTheme("minimal"), false);
assert.strictEqual(ThemeRegistry.getTheme("minimal"), undefined);
assert.strictEqual(ThemeRegistry.resolveTheme("minimal"), ThemeRegistry.getTheme("minimalista"));
assert.strictEqual(ThemeRegistry.resolveTheme("infantil").status, "legacy");
assert.strictEqual(
    crypto.createHash("sha256").update(JSON.stringify(ThemeRegistry.resolveTheme("infantil").tokens)).digest("hex"),
    "52b7196770beb8a2f983d419f15f31bd03d011842c5d9466c756aea9a697d717"
);
assert(!ThemeRegistry.listThemes().some((theme) => theme.slug === "infantil"));
assert.strictEqual(ThemeRegistry.resolveTheme("desconocido"), ThemeRegistry.getTheme("fiesta"));
assert.strictEqual(ThemeRegistry.resolveTheme("desconocido", { fallback: false }), undefined);
assert.strictEqual(ThemeRegistry.getTheme("desconocido"), undefined);

const variables = new Map();
const meta = { content: "", setAttribute(name, value) { this[name] = value; } };
const browserContext = {
    console,
    URL,
    URLSearchParams,
    ThemeRegistry,
    document: {
        addEventListener() {},
        documentElement: { style: { setProperty(name, value) { variables.set(name, value); } } },
        body: { dataset: {} },
        querySelector(selector) { return selector === 'meta[name="theme-color"]' ? meta : null; }
    },
    window: {}
};
vm.createContext(browserContext);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", "js", "invitacion.js"), "utf8"), browserContext);

const kaly = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "..", ".dev", "drafts", "kaly-joha-boda-civil.event.json"),
    "utf8"
));
const normalizedKaly = EventNormalizer.normalizeEvent(kaly, {
    fontFamilies: { "cormorant-garamond": '"Cormorant Garamond", serif' }
});
const civilTemplate = TemplateRegistry.resolveTemplate(normalizedKaly.template.slug);

assert.strictEqual(civilTemplate.defaultTheme, "romantico");
assert.strictEqual(browserContext.inferTheme(normalizedKaly, "kaly-joha", civilTemplate), "botanico");
browserContext.applyTheme("botanico", normalizedKaly.fontFamily, normalizedKaly.estilos);

assert.strictEqual(variables.get("--primary-color"), "#4f8a5b");
assert.strictEqual(variables.get("--secondary-color"), "#edf7e8");
assert.strictEqual(variables.get("--accent-color"), "#244b31");
assert.strictEqual(variables.get("--muted-color"), "#66806a");
assert.strictEqual(variables.get("--text-color"), "#25352f");
assert.strictEqual(variables.get("--canvas-background"), "#fbfbf7");
assert.strictEqual(variables.get("--title-shadow-color"), "#1f2d28");
assert.strictEqual(variables.get("--decorative-border-color"), "#c1a35f");
assert.strictEqual(variables.get("--font-heading"), '"Cormorant Garamond", serif');
assert.strictEqual(variables.get("--font-body"), '"Poppins", sans-serif');
assert.strictEqual(variables.get("--font-primary"), '"Cormorant Garamond", serif');
assert.strictEqual(variables.get("--button-gradient"), ThemeRegistry.getTheme("botanico").tokens.button);
assert.notStrictEqual(variables.get("--button-gradient"), normalizedKaly.estilos.colorBoton);

const ignoredOverrides = Object.fromEntries(
    ThemeRegistry.RUNTIME_TOKEN_KEYS
        .filter((key) => !["text", "surface", "line", "shadow"].includes(key))
        .map((key) => [key, `ignored-${key}`])
);
const beforeIgnored = Object.fromEntries(variables);
browserContext.applyTheme("botanico", normalizedKaly.fontFamily, {
    ...normalizedKaly.estilos,
    ...ignoredOverrides
});
assert.deepStrictEqual(Object.fromEntries(variables), beforeIgnored);

assert.strictEqual(browserContext.inferTheme({ tema: "minimal" }, "legacy", {}), "minimal");
assert.strictEqual(browserContext.inferTheme({ tema: "infantil" }, "legacy", {}), "infantil");
assert.strictEqual(browserContext.inferTheme({}, "evento", { defaultTheme: "romantico" }), "romantico");
assert.strictEqual(browserContext.inferTheme({ nombre: "Noche de nieve" }, "evento", {}), "frozen");
assert.strictEqual(browserContext.inferTheme({}, "evento", {}), "fiesta");

console.log("theme-runtime test passed");
