(function () {
    "use strict";
    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function renderEntry(entry, previewAvailable) {
        const article = element("article", "catalog-card");
        const image = element("img", "catalog-card__image");
        image.src = entry.thumbnail.src; image.alt = entry.thumbnail.alt;
        image.width = 720; image.height = 1280; image.loading = "lazy"; image.decoding = "async";
        const body = element("div", "catalog-card__body");
        body.append(element("p", "catalog-card__category", entry.categoryLabel),
            element("h3", "catalog-card__title", entry.name + " / " + entry.variantName),
            element("p", "catalog-card__description", entry.description));
        if (previewAvailable) {
            const href = TemplateCatalog.catalogPreviewHref(entry, TemplateRegistry);
            if (href) { const link = element("a", "catalog-card__action", "Ver invitación"); link.href = href; body.append(link); }
        }
        if (!previewAvailable) body.append(element("p", "catalog-preview-state", "Vista interactiva no disponible. La imagen muestra el diseño de referencia."));
        body.append(CommercialUI.createRequestActions(document, CommercialContact.templateRequest(entry.slug, TemplateRegistry)));
        article.append(image, body); return article;
    }
    function createImageViewer() {
        const dialog = document.getElementById("sampleViewer");
        const image = document.getElementById("sampleViewerImage");
        const title = document.getElementById("sampleViewerTitle");
        const status = document.getElementById("sampleViewerStatus");
        const actions = document.getElementById("sampleViewerActions");
        const scroll = document.getElementById("sampleViewerScroll");
        const zoom = document.getElementById("sampleViewerZoom");
        let opener = null;
        zoom.addEventListener("click", () => {
            const enabled = scroll.classList.toggle("is-zoomed");
            zoom.setAttribute("aria-pressed", String(enabled));
            zoom.textContent = enabled ? "Ajustar al ancho" : "Ver a tamaño original";
        });
        dialog.querySelector("[data-viewer-close]").addEventListener("click", () => dialog.close());
        dialog.addEventListener("close", () => {
            image.onload = image.onerror = null;
            image.removeAttribute("src"); actions.replaceChildren();
            scroll.classList.remove("is-zoomed"); zoom.setAttribute("aria-pressed", "false");
            zoom.textContent = "Ver a tamaño original"; document.body.classList.remove("catalog-viewer-open");
            opener?.focus(); opener = null;
        });
        dialog.addEventListener("keydown", event => {
            if (event.key !== "Tab") return;
            const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), summary, input:not([disabled]), textarea:not([disabled]), [tabindex="0"]')]
                .filter(node => { const closed = node.closest("details:not([open])"); return node.getClientRects().length > 0 && (!closed || node === closed.querySelector("summary")); });
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        return {
            open(entry, button) {
                if (typeof dialog.showModal !== "function") return;
                opener = button;
                title.textContent = "Diseño " + entry.number + " — " + entry.name;
                status.textContent = "Cargando imagen completa…";
                image.alt = "Muestra visual completa: " + entry.name + ". Sus controles ilustrados no son interactivos.";
                image.width = entry.image.width; image.height = entry.image.height;
                image.onload = () => { status.textContent = ""; };
                image.onerror = () => { status.textContent = "No se pudo cargar la imagen completa. Cerrá y volvé a abrir la muestra para intentarlo nuevamente."; };
                actions.replaceChildren(CommercialUI.createRequestActions(document, CommercialContact.sampleRequest(entry.id, CatalogSamples)));
                dialog.showModal(); document.body.classList.add("catalog-viewer-open");
                scroll.scrollTop = 0; scroll.scrollLeft = 0;
                image.src = entry.image.src;
            },
            supported: () => typeof dialog.showModal === "function"
        };
    }
    function renderSample(entry, viewer) {
        const article = element("article", "catalog-card catalog-card--sample");
        article.dataset.sampleId = entry.id;
        const imageLink = element("a", "catalog-sample-open");
        imageLink.href = entry.image.src;
        imageLink.setAttribute("aria-label", "Ampliar muestra " + entry.number + ": " + entry.name);
        const image = element("img", "catalog-card__image");
        image.loading = "lazy"; image.decoding = "async";
        image.width = entry.thumbnail.width; image.height = entry.thumbnail.height;
        image.alt = "Muestra " + entry.number + ": " + entry.name;
        const imageError = element("p", "catalog-image-error");
        imageError.hidden = true; imageError.setAttribute("role", "status");
        imageError.textContent = "No se pudo cargar esta muestra. Podés intentar ampliarla o consultar por su número.";
        image.addEventListener("error", () => { imageError.hidden = false; });
        image.src = entry.thumbnail.src;
        imageLink.append(image);
        imageLink.addEventListener("click", event => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !viewer.supported()) return;
            event.preventDefault(); viewer.open(entry, imageLink);
        });
        const body = element("div", "catalog-card__body");
        const enlarge = element("button", "catalog-card__action catalog-enlarge", "Ampliar muestra");
        enlarge.type = "button";
        enlarge.addEventListener("click", () => {
            if (viewer.supported()) viewer.open(entry, enlarge);
            else imageLink.click();
        });
        body.append(element("p", "catalog-design-label", "Diseño " + entry.number),
            element("p", "catalog-card__category", entry.categoryLabel),
            element("h4", "catalog-card__title", entry.name),
            element("p", "catalog-card__description", "Referencia visual. Los textos y controles dibujados forman parte de la imagen."),
            enlarge, imageError,
            CommercialUI.createRequestActions(document, CommercialContact.sampleRequest(entry.id, CatalogSamples)));
        article.append(imageLink, body); return article;
    }
    function initSamples() {
        const root = document.getElementById("sampleGroups");
        const filters = document.getElementById("sampleFilters");
        const status = document.getElementById("sampleStatus");
        const all = TemplateCatalog.buildSampleEntries(CatalogSamples);
        const categories = CatalogSamples.categories();
        const viewer = createImageViewer();
        let current = null;
        function show(categoryId) {
            if (current === categoryId) return;
            current = categoryId;
            const visible = all.filter(entry => categoryId === "all" || entry.category === categoryId);
            filters.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === categoryId)));
            const groups = categories.filter(category => visible.some(entry => entry.category === category.id)).map(category => {
                const section = element("section", "catalog-sample-group");
                const heading = element("h3", "catalog-category-title", category.label);
                heading.id = "sample-category-" + category.id; section.setAttribute("aria-labelledby", heading.id);
                const grid = element("div", "catalog-grid");
                grid.append(...visible.filter(entry => entry.category === category.id).map(entry => renderSample(entry, viewer)));
                section.append(heading, grid); return section;
            });
            root.replaceChildren(...groups);
            status.textContent = visible.length + (visible.length === 1 ? " muestra" : " muestras") + (categoryId === "all" ? " en todas las categorías." : " en " + categories.find(c => c.id === categoryId).label + ".");
        }
        for (const category of [{ id: "all", label: "Todas" }, ...categories]) {
            const button = element("button", "catalog-filter", category.label);
            button.type = "button"; button.dataset.category = category.id;
            button.setAttribute("aria-pressed", "false"); button.setAttribute("aria-controls", "sampleGroups");
            button.addEventListener("click", () => show(category.id)); filters.append(button);
        }
        show("all");
    }
    async function initCatalog() {
        try { initSamples(); } catch (_) {
            document.getElementById("sampleStatus").textContent = "No se pudieron cargar las muestras. Podés contactarnos para conocer los diseños.";
        }
        const root = document.getElementById("catalogGrid"), status = document.getElementById("catalogStatus");
        try {
            const entries = TemplateCatalog.buildCatalogEntries(TemplateRegistry, ThemeRegistry);
            if (!entries.length) { root.replaceChildren(); status.hidden = false; status.textContent = "No hay diseños catalogados."; return; }
            const visible = await TemplateCatalog.filterLoadableThumbnails(entries, src => TemplateCatalog.probeImage(src));
            const previews = await Promise.all(visible.map(entry => TemplateCatalog.verifyCatalogPreview(entry)));
            root.replaceChildren(...visible.map((entry, index) => renderEntry(entry, previews[index])));
            status.hidden = visible.length > 0;
            if (!visible.length) status.textContent = "No se pudo cargar la imagen del diseño.";
        } catch (error) {
            console.error(error); root.replaceChildren(); status.hidden = false; status.textContent = "No se pudo cargar el catálogo.";
        }
    }
    document.addEventListener("DOMContentLoaded", initCatalog);
})();
