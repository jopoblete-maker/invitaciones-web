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
    const SUPPORTED_ACTIONS = ["maps", "calendar"];

    const TEMPLATES = {
        "boda-vertical": {
            slug: "boda-vertical",
            layout: "paged",
            className: "template-boda-vertical",
            stylesheet: "/css/templates/boda-vertical.css",
            supportedSections: [...SUPPORTED_SECTIONS],
            supportedModules: [...SUPPORTED_MODULES],
            supportedActions: [...SUPPORTED_ACTIONS]
        },
        "cumple-clasico": {
            slug: "cumple-clasico",
            layout: "paged",
            className: "template-cumple-clasico",
            stylesheet: "/css/templates/cumple-clasico.css",
            supportedSections: [...SUPPORTED_SECTIONS],
            supportedModules: [...SUPPORTED_MODULES],
            supportedActions: [...SUPPORTED_ACTIONS]
        },
        "boda-civil-esencial": {
            slug: "boda-civil-esencial",
            layout: "vertical",
            className: "template-boda-civil-esencial",
            defaultTheme: "romantico",
            stylesheet: "/css/templates/boda-civil-esencial.css",
            supportedSections: [...SUPPORTED_SECTIONS],
            supportedModules: [...SUPPORTED_MODULES],
            supportedActions: [...SUPPORTED_ACTIONS]
        }
    };

    function resolveTemplate(value) {
        const slug = String(value || "").trim();
        return TEMPLATES[slug] || TEMPLATES[DEFAULT_TEMPLATE_SLUG];
    }

    return {
        DEFAULT_TEMPLATE_SLUG,
        TEMPLATES,
        resolveTemplate
    };
});
