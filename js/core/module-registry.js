(function (root, factory) {
    const registry = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = registry;
    }

    root.ModuleRegistry = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const MODULES = createRegistry({
        music: {
            slug: "music",
            configKeys: ["enabled", "source", "tracks", "playMode"]
        },
        rsvp: {
            slug: "rsvp",
            configKeys: ["enabled", "deadline", "contacts"]
        },
        branding: {
            slug: "branding",
            configKeys: ["enabled", "brandName", "badgeText", "cta", "serviceText", "whatsapp", "whatsappMessage", "portfolioUrl", "instagramUrl"]
        }
    });

    function createRegistry(source) {
        return Object.freeze(Object.fromEntries(Object.entries(source).map(([slug, module]) => [
            slug,
            Object.freeze({
                ...module,
                configKeys: Object.freeze([...module.configKeys])
            })
        ])));
    }

    function normalizeSlug(slug) {
        return String(slug || "").trim();
    }

    function has(slug) {
        return Object.prototype.hasOwnProperty.call(MODULES, normalizeSlug(slug));
    }

    function get(slug) {
        return MODULES[normalizeSlug(slug)];
    }

    function list() {
        return Object.values(MODULES);
    }

    return {
        MODULES,
        has,
        get,
        list
    };
});
