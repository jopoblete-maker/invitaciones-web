(function (root, factory) {
    const registry = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = registry;
    }

    root.TemplateRegistry = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const DEFAULT_TEMPLATE_SLUG = "boda-vertical";

    const TEMPLATES = {
        "boda-vertical": {
            slug: "boda-vertical",
            layout: "paged",
            className: "template-boda-vertical",
            stylesheet: "/css/templates/boda-vertical.css"
        },
        "cumple-clasico": {
            slug: "cumple-clasico",
            layout: "paged",
            className: "template-cumple-clasico",
            stylesheet: "/css/templates/cumple-clasico.css"
        },
        "boda-civil-esencial": {
            slug: "boda-civil-esencial",
            layout: "vertical",
            className: "template-boda-civil-esencial",
            defaultTheme: "romantico",
            stylesheet: "/css/templates/boda-civil-esencial.css"
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
