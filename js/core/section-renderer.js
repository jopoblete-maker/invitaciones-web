(function (root, factory) {
    const sectionRenderer = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = sectionRenderer;
    }

    root.SectionRenderer = sectionRenderer;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const SECTION_RENDERER_REGISTRY = {
        hero: "hero",
        "event-info": "eventInfo",
        location: "location",
        rsvp: "rsvp",
        closing: "closing",
        countdown: "countdown",
        "media-closing": "mediaClosing",
        gallery: "gallery",
        "dress-code": "dressCode",
        gifts: "gifts",
        "collaborative-album": "collaborativeAlbum"
    };

    function getRenderableSections(sections, context = {}) {
        if (!Array.isArray(sections)) return [];

        return sections.filter((section) => {
            if (!section || section.enabled === false) return false;
            if (isPremium(section.type) && context.templateConfig?.slug !== "boda-fiesta-premium") return false;
            if (SECTION_RENDERER_REGISTRY[section.type]) return true;

            warn(context, `Section type desconocido ignorado: ${section.type || "(sin tipo)"}`);
            return false;
        });
    }

    function renderSections(sections, context = {}) {
        return getRenderableSections(sections, context)
            .map((section, index, renderableSections) => renderSection(section, {
                ...context,
                pageIndex: index,
                pageCount: renderableSections.length
            }))
            .filter(Boolean);
    }

    function renderSection(section, context = {}) {
        if (isPremium(section?.type) && context.templateConfig?.slug !== "boda-fiesta-premium") return "";
        const rendererKey = SECTION_RENDERER_REGISTRY[section?.type];
        if (!rendererKey) {
            warn(context, `Section type desconocido ignorado: ${section?.type || "(sin tipo)"}`);
            return "";
        }

        const renderer = context.renderers?.[rendererKey];
        if (typeof renderer !== "function") {
            warn(context, `Renderer no disponible para section type: ${section.type}`);
            return "";
        }

        return renderer(section, context);
    }

    function warn(context, message) {
        if (typeof context.warn === "function") {
            context.warn(message);
        }
    }

    function isPremium(type) {
        return ["gallery", "dress-code", "gifts", "collaborative-album"].includes(type);
    }

    return {
        SECTION_RENDERER_REGISTRY,
        getRenderableSections,
        renderSections,
        renderSection
    };
});
