(function () {
    "use strict";

    function element(tagName, className, text) {
        const node = document.createElement(tagName);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function renderEntry(entry) {
        const article = element("article", "catalog-card");
        const image = element("img", "catalog-card__image");
        image.src = entry.thumbnail.src;
        image.alt = entry.thumbnail.alt;
        image.width = 720;
        image.height = 1280;

        const body = element("div", "catalog-card__body");
        const category = element("p", "catalog-card__category", entry.categoryLabel);
        const title = element("h2", "catalog-card__title", `${entry.name} / ${entry.variantName}`);
        const description = element("p", "catalog-card__description", entry.description);
        body.append(category, title, description);
        article.append(image, body);
        return article;
    }

    async function initCatalog() {
        const root = document.getElementById("catalogGrid");
        const status = document.getElementById("catalogStatus");
        try {
            const entries = TemplateCatalog.buildCatalogEntries(TemplateRegistry, ThemeRegistry);
            if (entries.length === 0) {
                root.replaceChildren();
                status.hidden = false;
                status.textContent = "No hay diseños catalogados.";
                return;
            }

            const visibleEntries = await TemplateCatalog.filterLoadableThumbnails(
                entries,
                (src) => TemplateCatalog.probeImage(src)
            );
            root.replaceChildren(...visibleEntries.map(renderEntry));
            status.hidden = visibleEntries.length > 0;
            if (visibleEntries.length === 0) status.textContent = "No se pudo cargar la imagen del diseño.";
        } catch (error) {
            console.error(error);
            root.replaceChildren();
            status.hidden = false;
            status.textContent = "No se pudo cargar el catálogo.";
        }
    }

    document.addEventListener("DOMContentLoaded", initCatalog);
})();
