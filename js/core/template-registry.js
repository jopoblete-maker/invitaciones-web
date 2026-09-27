(function (root, factory) {
    const registry = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = registry;
    }

    root.TemplateRegistry = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const DEFAULT_TEMPLATE_SLUG = "boda-vertical";
    const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
                variant: {
                    name: "Elegante",
                    themeSlug: "elegante"
                },
                thumbnail: {
                    src: "/assets/templates/boda-vertical/thumbnail.webp",
                    alt: "Vista previa de la plantilla Boda vertical"
                },
                preview: {
                    eventId: "ycor-template-demo-boda-vertical"
                }
            }, "boda-vertical")
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
            catalog: defineCatalogMetadata({
                displayName: "Boda civil",
                description: "Invitación civil romántica en formato vertical, con flores delicadas, tonos suaves y detalles dorados.",
                variant: {
                    name: "Romántica",
                    themeSlug: "romantico"
                },
                thumbnail: {
                    src: "/assets/templates/boda-civil-esencial/thumbnail.webp",
                    alt: "Vista previa de la plantilla Boda civil romántica"
                },
                preview: null
            }, "boda-civil-esencial")
        }
    });

    function deepFreeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    }

    function isValidEventId(value) {
        return typeof value === "string" && EVENT_ID_PATTERN.test(value);
    }

    function isTemplateAssetPath(templateSlug, value) {
        if (!isValidEventId(templateSlug) || typeof value !== "string") return false;
        if (/[\\%?#]/.test(value)) return false;

        const prefix = `/assets/templates/${templateSlug}/`;
        if (!value.startsWith(prefix)) return false;
        const segments = value.slice(prefix.length).split("/");
        return segments.length > 0
            && segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
    }

    function defineCatalogMetadata(catalog, templateSlug) {
        if (catalog === null) return null;

        const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
        const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
        const validThumbnail = isObject(catalog?.thumbnail)
            && isNonEmptyString(catalog.thumbnail.src)
            && isTemplateAssetPath(templateSlug, catalog.thumbnail.src)
            && isNonEmptyString(catalog.thumbnail.alt);
        const validVariant = isObject(catalog?.variant)
            && isNonEmptyString(catalog.variant.name)
            && isNonEmptyString(catalog.variant.themeSlug);
        const validPreview = catalog?.preview === null
            || (isObject(catalog?.preview) && isValidEventId(catalog.preview.eventId));
        const validDisplayName = catalog?.displayName === undefined
            || isNonEmptyString(catalog.displayName);

        if (!isObject(catalog)
            || !validDisplayName
            || !isNonEmptyString(catalog.description)
            || !validVariant
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
        EVENT_ID_PATTERN,
        TEMPLATE_ACTIONS,
        TEMPLATES,
        defineCatalogMetadata,
        isTemplateAssetPath,
        isValidEventId,
        hasTemplate,
        getTemplate,
        listTemplates,
        listCatalogTemplates,
        resolveTemplate
    };
});
