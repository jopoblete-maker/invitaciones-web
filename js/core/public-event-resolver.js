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

        function legacyFallback(event, reason) {
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
                return legacyFallback(event, "missing-published-pointer");
            }

            const version = await repository.getVersion(event.published_version_id);
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

        return { resolvePublicEvent };
    }

    return {
        createPublicEventResolver,
        isPlainObject
    };
});
