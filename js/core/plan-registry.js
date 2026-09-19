(function (root, factory) {
    const registry = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = registry;
    }

    root.PlanRegistry = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const PLAN_SLUGS = ["esencial", "premium", "experiencia-ia"];

    const PLANS = Object.freeze(Object.fromEntries(PLAN_SLUGS.map((slug) => [
        slug,
        createPendingPlan(slug)
    ])));

    function createPendingPlan(slug) {
        return Object.freeze({
            slug,
            allowedSections: null,
            allowedModules: null,
            mediaLimits: Object.freeze({
                status: "pending",
                maxItems: null,
                maxBytes: null
            }),
            brandingRules: Object.freeze({
                status: "pending",
                required: null,
                removable: null,
                customizable: null
            }),
            aiCapabilities: Object.freeze({
                status: "pending",
                allowed: Object.freeze([])
            })
        });
    }

    function normalizeSlug(slug) {
        return String(slug || "").trim();
    }

    function has(slug) {
        return Object.prototype.hasOwnProperty.call(PLANS, normalizeSlug(slug));
    }

    function get(slug) {
        return PLANS[normalizeSlug(slug)];
    }

    function list() {
        return Object.values(PLANS);
    }

    return {
        PLANS,
        has,
        get,
        list
    };
});
