(function (root, factory) {
    const resolver = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = resolver;
    }

    root.PublicEventResolver = resolver;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function resolverError(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    function isPlainObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createPublicEventResolver(repository, options = {}) {
        if (!repository || typeof repository.getEvent !== "function"
            || typeof repository.getVersion !== "function") {
            throw new TypeError("repository must implement getEvent and getVersion.");
        }

        const onFallback = typeof options.onFallback === "function"
            ? options.onFallback
            : () => {};
        const validatePublishedContent = typeof options.validatePublishedContent === "function"
            ? options.validatePublishedContent
            : () => ({ valid: true });
        const preparePremiumContent = typeof module === "object" && module.exports
            && typeof options.preparePremiumContent === "function" ? options.preparePremiumContent : null;
        const premiumTypes = ["gallery", "dress-code", "gifts", "collaborative-album"];
        function isPremium(content) {
            return content?.template?.slug === "boda-fiesta-premium"
                || (Array.isArray(content?.sections) && content.sections.some(section => premiumTypes.includes(section?.type)));
        }
        function unavailable() {
            throw resolverError("PUBLIC_EVENT_NOT_FOUND", "Public invitation unavailable.");
        }

        function legacyFallback(event, reason) {
            // Premium never falls back to legacy/draft data or bypasses approval.
            if (isPremium(event.datos)) return unavailable();
            if (!isPlainObject(event.datos)) {
                throw resolverError(
                    "PUBLIC_EVENT_INVALID_CONTENT",
                    `No valid public content is available for event: ${event.id}`
                );
            }

            onFallback({
                eventId: event.id,
                reason,
                publishedVersionId: event.published_version_id || null
            });
            return cloneJson(event.datos);
        }

        async function resolvePublicEvent(eventId) {
            const event = await repository.getEvent(eventId);
            if (!event || event.event_status === "archived") {
                throw resolverError("PUBLIC_EVENT_NOT_FOUND", `Public event not found: ${eventId}`);
            }

            if (!event.published_version_id) {
                if (event.current_working_version_id) {
                    throw resolverError(
                        "PUBLIC_EVENT_NOT_FOUND",
                        `Public event not found: ${eventId}`
                    );
                }
                return legacyFallback(event, "missing-published-pointer");
            }

            const version = await repository.getVersion(event.published_version_id);
            if (isPremium(version?.content)) {
                if (event.id !== eventId || event.event_status !== "active"
                    || !version || version.id !== event.published_version_id || version.event_id !== eventId
                    || version.workflow_status !== "approved" || typeof version.published_at !== "string"
                    || !Number.isFinite(Date.parse(version.published_at))
                    || version.content.template?.slug !== "boda-fiesta-premium"
                    || version.content.metadata?.purpose === "local-only-preview" || !preparePremiumContent) return unavailable();
                try {
                    preparePremiumContent(eventId, version.content);
                    // Recheck the published pointer after authorization; never
                    // disclose an archived event or a superseded version.
                    const current = await repository.getEvent(eventId);
                    if (!current || current.id !== eventId || current.event_status !== "active"
                        || current.published_version_id !== version.id) return unavailable();
                    const canonical = preparePremiumContent(eventId, version.content);
                    const sections = canonical.sections;
                    const giftFields = Object.fromEntries(sections.filter(s => s.type === "gifts")
                        .map(s => [s.id, Object.keys(s.data)]));
                    const albumSections = sections.filter(s => s.type === "collaborative-album").map(s => s.id);
                    const gallerySections = Object.fromEntries(sections.filter(s => s.type === "gallery")
                        .map(s => [s.id, s.data.items.map(item => item.media_id)]));
                    // Metadata is editorial/internal, not public presentation.
                    const content = cloneJson(canonical);
                    delete content.metadata;
                    if (/\.dev[\\/]/i.test(JSON.stringify(content))) return unavailable();
                    return { eventId, versionId: version.id, content,
                        presentation: { giftFields, albumSections, gallerySections } };
                } catch (_) { return unavailable(); }
            }
            if (!version) {
                return legacyFallback(event, "published-version-not-found");
            }
            if (version.event_id !== event.id) {
                return legacyFallback(event, "published-version-owner-mismatch");
            }
            if (!isPlainObject(version.content)) {
                return legacyFallback(event, "published-version-content-invalid");
            }

            return cloneJson(version.content);
        }

        async function resolveCatalogPreview(eventId, expected) {
            const event = await repository.getEvent(eventId);
            if (!event || event.event_status !== "active" || !event.published_version_id) {
                throw resolverError("CATALOG_PREVIEW_NOT_FOUND", `Catalog preview not found: ${eventId}`);
            }

            const version = await repository.getVersion(event.published_version_id);
            if (!version
                || version.id !== event.published_version_id
                || version.event_id !== event.id) {
                throw resolverError("CATALOG_PREVIEW_NOT_FOUND", `Catalog preview not found: ${eventId}`);
            }

            const content = version.content;
            const validation = isPlainObject(content) ? validatePublishedContent(content) : { valid: false };
            if (!isPlainObject(expected)
                || !isPlainObject(content)
                || content.schema_version !== 2
                || validation?.valid !== true
                || content.template?.slug !== expected.templateSlug
                || content.theme?.slug !== expected.themeSlug
                || content.metadata?.demo !== true
                || content.metadata?.purpose !== "template-catalog-preview") {
                throw resolverError("CATALOG_PREVIEW_INVALID_CONTENT", `Catalog preview is invalid: ${eventId}`);
            }

            return { eventId: event.id, versionId: version.id, content: cloneJson(content) };
        }

        return { resolvePublicEvent, resolveCatalogPreview };
    }

    return {
        createPublicEventResolver,
        isPlainObject
    };
});
