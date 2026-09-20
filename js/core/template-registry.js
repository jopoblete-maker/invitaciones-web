(function (root, factory) {
    const registry = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = registry;
    }

    root.TemplateRegistry = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const DEFAULT_TEMPLATE_SLUG = "boda-vertical";
    const SUPPORTED_SECTIONS = ["hero", "event-info", "location", "rsvp", "closing", "countdown", "media-closing"];
    const SUPPORTED_MODULES = ["music", "rsvp", "branding"];
    const TEMPLATE_ACTIONS = Object.freeze(["maps", "calendar"]);

    const TEMPLATES = deepFreeze({
        "boda-vertical": {
            slug: "boda-vertical",
            name: "Boda vertical",
            category: "wedding",
            layout: "paged",
            className: "template-boda-vertical",
            stylesheet: "/css/templates/boda-vertical.css",
            defaultTheme: null,
            supportedEventTypes: ["wedding", "wedding-civil", "other"],
            supportedSections: [...SUPPORTED_SECTIONS],
            requiredSections: ["hero"],
            supportedModules: [...SUPPORTED_MODULES],
            supportedActions: [...TEMPLATE_ACTIONS],
            status: "active"
        },
        "cumple-clasico": {
            slug: "cumple-clasico",
            name: "Cumple clasico",
            category: "birthday",
            layout: "paged",
            className: "template-cumple-clasico",
            stylesheet: "/css/templates/cumple-clasico.css",
            defaultTheme: null,
            supportedEventTypes: ["birthday"],
            supportedSections: [...SUPPORTED_SECTIONS],
            requiredSections: ["hero"],
            supportedModules: [...SUPPORTED_MODULES],
            supportedActions: [...TEMPLATE_ACTIONS],
            status: "active"
        },
        "boda-civil-esencial": {
            slug: "boda-civil-esencial",
            name: "Boda civil esencial",
            category: "wedding",
            layout: "vertical",
            className: "template-boda-civil-esencial",
            defaultTheme: "romantico",
            stylesheet: "/css/templates/boda-civil-esencial.css",
            supportedEventTypes: ["wedding", "wedding-civil"],
            supportedSections: [...SUPPORTED_SECTIONS],
            requiredSections: ["hero"],
            supportedModules: [...SUPPORTED_MODULES],
            supportedActions: [...TEMPLATE_ACTIONS],
            status: "active"
        }
    });

    function deepFreeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    }

    function normalizeSlug(value) {
        return String(value || "").trim();
    }

    function hasTemplate(value) {
        return Object.prototype.hasOwnProperty.call(TEMPLATES, normalizeSlug(value));
    }

    function getTemplate(value) {
        return TEMPLATES[normalizeSlug(value)];
    }

    function listTemplates() {
        return Object.values(TEMPLATES);
    }

    function resolveTemplate(value) {
        return getTemplate(value) || TEMPLATES[DEFAULT_TEMPLATE_SLUG];
    }

    return {
        DEFAULT_TEMPLATE_SLUG,
        TEMPLATE_ACTIONS,
        TEMPLATES,
        hasTemplate,
        getTemplate,
        listTemplates,
        resolveTemplate
    };
});
