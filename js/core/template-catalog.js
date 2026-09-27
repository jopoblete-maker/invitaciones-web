(function (root, factory) {
    const catalog = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = catalog;
    }

    root.TemplateCatalog = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const CATEGORY_LABELS = Object.freeze({
        wedding: "Bodas",
        birthday: "Cumpleaños"
    });

    function isObject(value) {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }

    function isNonEmptyString(value) {
        return typeof value === "string" && value.trim().length > 0;
    }

    function hasValidCatalogMetadata(template, themeRegistry, templateRegistry) {
        const catalog = template?.catalog;
        return template?.status === "active"
            && isNonEmptyString(template.slug)
            && isNonEmptyString(template.name)
            && isNonEmptyString(template.category)
            && isNonEmptyString(CATEGORY_LABELS[template.category])
            && isObject(catalog)
            && (catalog.displayName === undefined || isNonEmptyString(catalog.displayName))
            && isNonEmptyString(catalog.description)
            && isObject(catalog.variant)
            && isNonEmptyString(catalog.variant.name)
            && isNonEmptyString(catalog.variant.themeSlug)
            && typeof themeRegistry?.hasTheme === "function"
            && themeRegistry.hasTheme(catalog.variant.themeSlug)
            && isObject(catalog.thumbnail)
            && typeof templateRegistry?.isTemplateAssetPath === "function"
            && templateRegistry.isTemplateAssetPath(template.slug, catalog.thumbnail.src)
            && isNonEmptyString(catalog.thumbnail.alt)
            && (catalog.preview === null
                || (isObject(catalog.preview)
                    && typeof templateRegistry?.isValidEventId === "function"
                    && templateRegistry.isValidEventId(catalog.preview.eventId)));
    }

    function buildCatalogEntries(templateRegistry, themeRegistry) {
        if (!templateRegistry || typeof templateRegistry.listCatalogTemplates !== "function") {
            throw new TypeError("templateRegistry.listCatalogTemplates es obligatorio.");
        }

        return templateRegistry.listCatalogTemplates()
            .filter((template) => hasValidCatalogMetadata(template, themeRegistry, templateRegistry))
            .map((template) => ({
                slug: template.slug,
                name: template.catalog.displayName || template.name,
                category: template.category,
                categoryLabel: CATEGORY_LABELS[template.category],
                description: template.catalog.description,
                variantName: template.catalog.variant.name,
                themeSlug: template.catalog.variant.themeSlug,
                thumbnail: { ...template.catalog.thumbnail },
                previewEventId: template.catalog.preview?.eventId || null
            }));
    }

    function validatePreviewPayload(entry, payload) {
        return isObject(payload)
            && payload.eventId === entry.previewEventId
            && isNonEmptyString(payload.versionId)
            && isObject(payload.content)
            && payload.content.schema_version === 2
            && payload.content.template?.slug === entry.slug
            && payload.content.theme?.slug === entry.themeSlug
            && payload.content.metadata?.demo === true
            && payload.content.metadata?.purpose === "template-catalog-preview";
    }

    async function verifyCatalogPreview(entry, fetchImpl = globalThis.fetch, options = {}) {
        if (!isNonEmptyString(entry?.previewEventId) || typeof fetchImpl !== "function") return false;
        const timeoutMs = options.timeoutMs ?? 5000;
        const AbortControllerCtor = options.AbortControllerCtor || globalThis.AbortController;
        const setTimer = options.setTimeoutImpl || globalThis.setTimeout;
        const clearTimer = options.clearTimeoutImpl || globalThis.clearTimeout;
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof AbortControllerCtor !== "function") {
            return false;
        }

        const controller = new AbortControllerCtor();
        const timeoutId = setTimer(() => controller.abort(), timeoutMs);
        try {
            const response = await fetchImpl(
                `/api/catalogo/previews/${encodeURIComponent(entry.previewEventId)}`,
                { cache: "no-store", signal: controller.signal }
            );
            if (!response.ok) return false;
            return validatePreviewPayload(entry, await response.json());
        } catch (_error) {
            return false;
        } finally {
            clearTimer(timeoutId);
        }
    }

    function catalogPreviewHref(entry, templateRegistry) {
        const preview = templateRegistry?.getCatalogPreview?.(entry?.previewEventId);
        if (!preview || preview.templateSlug !== entry.slug || preview.themeSlug !== entry.themeSlug) return null;
        return `/invitacion.html?catalogPreview=${encodeURIComponent(preview.eventId)}`;
    }

    function probeImage(src, options = {}) {
        const ImageCtor = options.ImageCtor || globalThis.Image;
        const setTimer = options.setTimeoutImpl || globalThis.setTimeout;
        const clearTimer = options.clearTimeoutImpl || globalThis.clearTimeout;
        const timeoutMs = options.timeoutMs ?? 5000;
        if (typeof ImageCtor !== "function" || typeof setTimer !== "function"
            || typeof clearTimer !== "function" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            return Promise.reject(new TypeError("Configuración de imagen inválida."));
        }

        return new Promise((resolve) => {
            const image = new ImageCtor();
            let settled = false;
            let timeoutId;
            const finish = (loaded) => {
                if (settled) return;
                settled = true;
                clearTimer(timeoutId);
                image.onload = null;
                image.onerror = null;
                resolve(loaded);
            };
            image.onload = () => finish(true);
            image.onerror = () => finish(false);
            timeoutId = setTimer(() => finish(false), timeoutMs);
            image.src = src;
        });
    }

    async function filterLoadableThumbnails(entries, loadImage) {
        if (typeof loadImage !== "function") throw new TypeError("loadImage es obligatorio.");
        const results = await Promise.all(entries.map(async (entry) => {
            try {
                return await loadImage(entry.thumbnail.src) ? entry : null;
            } catch (_error) {
                return null;
            }
        }));
        return results.filter(Boolean);
    }

    return {
        CATEGORY_LABELS,
        buildCatalogEntries,
        filterLoadableThumbnails,
        hasValidCatalogMetadata,
        probeImage,
        validatePreviewPayload,
        verifyCatalogPreview,
        catalogPreviewHref
    };
});
