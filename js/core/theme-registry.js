(function (root, factory) {
    const registry = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = registry;
    }

    root.ThemeRegistry = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const RUNTIME_TOKEN_KEYS = Object.freeze([
        "primary",
        "secondary",
        "accent",
        "text",
        "muted",
        "surface",
        "surfaceStrong",
        "surfaceSoft",
        "line",
        "shadow",
        "heading",
        "body",
        "button",
        "background"
    ]);

    const THEME_SLUGS = [
        "elegante",
        "frozen",
        "pesca",
        "minimalista",
        "fiesta",
        "vintage",
        "dorado-premium",
        "tropical",
        "botanico",
        "infantil-pastel",
        "mistico",
        "urbano",
        "infantil-dinamico",
        "romantico",
        "corporativo"
    ];

    const THEMES = Object.freeze(Object.fromEntries(THEME_SLUGS.map((slug) => [
        slug,
        Object.freeze({ slug, tokenKeys: RUNTIME_TOKEN_KEYS })
    ])));

    function normalizeSlug(slug) {
        return String(slug || "").trim();
    }

    function has(slug) {
        return Object.prototype.hasOwnProperty.call(THEMES, normalizeSlug(slug));
    }

    function get(slug) {
        return THEMES[normalizeSlug(slug)];
    }

    function list() {
        return Object.values(THEMES);
    }

    return {
        RUNTIME_TOKEN_KEYS,
        THEMES,
        has,
        get,
        list
    };
});
