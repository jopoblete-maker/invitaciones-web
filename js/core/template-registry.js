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
            layout: "vertical",
            className: "template-boda-vertical",
            stylesheet: "/css/templates/boda-vertical.css",
            defaultTheme: null,
            supportedEventTypes: ["wedding", "wedding-civil", "other"],
            supportedSections: [...SUPPORTED_SECTIONS],
            requiredSections: ["hero"],
            supportedModules: [...SUPPORTED_MODULES],
            supportedActions: [...TEMPLATE_ACTIONS],
            status: "active",
            catalog: defineCatalogMetadata({
                description: "Invitación de boda elegante en formato vertical, con ubicación, cuenta regresiva y una experiencia visual adaptable a dispositivos móviles.",
                thumbnail: {
                    src: "/assets/templates/boda-vertical/thumbnail.webp",
                    alt: "Vista previa de la plantilla Boda vertical"
                },
                preview: null
            })
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
            status: "active",
            catalog: defineCatalogMetadata(null)
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
            status: "active",
            catalog: defineCatalogMetadata(null)
        }
    });

    function deepFreeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    }

    function defineCatalogMetadata(catalog) {
        if (catalog === null) return null;

        const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
        const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
        const validThumbnail = isObject(catalog?.thumbnail)
            && isNonEmptyString(catalog.thumbnail.src)
            && catalog.thumbnail.src.startsWith("/")
            && isNonEmptyString(catalog.thumbnail.alt);
        const validPreview = catalog?.preview === null
            || (isObject(catalog?.preview) && isNonEmptyString(catalog.preview.eventId));

        if (!isObject(catalog)
            || !isNonEmptyString(catalog.description)
            || !validThumbnail
            || !validPreview) {
            throw new TypeError("Metadata comercial de template invalida.");
        }

        return deepFreeze(catalog);
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

    function listCatalogTemplates() {
        return listTemplates().filter((template) => template.status === "active" && template.catalog !== null);
    }

    function resolveTemplate(value) {
        return getTemplate(value) || TEMPLATES[DEFAULT_TEMPLATE_SLUG];
    }

    return {
        DEFAULT_TEMPLATE_SLUG,
        TEMPLATE_ACTIONS,
        TEMPLATES,
        defineCatalogMetadata,
        hasTemplate,
        getTemplate,
        listTemplates,
        listCatalogTemplates,
        resolveTemplate
    };
});
