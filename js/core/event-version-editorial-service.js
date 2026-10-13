(function (root, factory) {
    const validator = typeof require === "function"
        ? require("./event-validator")
        : root.EventValidator;
    // Private dependencies exist only in Node. Browser callers cannot inject
    // an authorization provider or turn structural options into credentials.
    const privatePremium = typeof module === "object" && module.exports ? {
        createBoundary: require("../../backend/premium/write-boundary").createPremiumWriteBoundary,
        inspectBudget: require("../../backend/premium/snapshot-budget").inspectSnapshotBudget,
        createPolicy: require("./external-link-policy").createPolicy
    } : null;
    const service = factory(validator, privatePremium);

    if (typeof module === "object" && module.exports) {
        module.exports = service;
    }

    root.EventVersionEditorialService = service;
})(typeof globalThis !== "undefined" ? globalThis : this, function (validator, privatePremium) {
    function editorialError(code, message, details) {
        const error = new Error(message);
        error.code = code;
        if (details !== undefined) error.details = details;
        return error;
    }

    function isPlainObject(value) {
        return Boolean(value && typeof value === "object" && !Array.isArray(value));
    }

    function requireString(value, name) {
        if (typeof value !== "string" || value.trim() === "") {
            throw editorialError("INVALID_REQUEST", `${name} is required.`);
        }
    }

    function requireNullableString(value, name) {
        if (value !== null) requireString(value, name);
    }

    // dependencies belongs to trusted Node composition, never HTTP options/body.
    // getAuthorizationState returns the current private provider and revision.
    function createEventVersionEditorialService(adapter, dependencies = {}) {
        const requiredMethods = [
            "createEvent",
            "createVersion",
            "transitionWorkflow",
            "publishVersion",
            "rollbackVersion"
        ];
        if (!adapter || requiredMethods.some((method) => typeof adapter[method] !== "function")) {
            throw new TypeError(`adapter must implement ${requiredMethods.join(", ")}.`);
        }

        const boundary = privatePremium && typeof dependencies.getAuthorizationState === "function"
            ? privatePremium.createBoundary({ getAuthorizationState: dependencies.getAuthorizationState }) : null;
        const premiumTypes = ["gallery", "dress-code", "gifts", "collaborative-album"];

        function prepareContent(eventId, content) {
            // Inspect JSON before reading content fields or calculating any digest.
            // Ordinary JSON V1/V2/legacy retains its existing persistence path.
            if (privatePremium) {
                try { privatePremium.inspectBudget(content); }
                catch (_) { throw editorialError("INVALID_EVENT", "Event content is invalid."); }
            }
            const premium = Array.isArray(content?.sections)
                && content.sections.some(section => premiumTypes.includes(section?.type));
            if (!premium) {
                const validation = validator.validateEventForPersistence(content);
                if (!validation.valid) {
                    throw editorialError("INVALID_EVENT", "Event content is invalid.", validation.errors);
                }
                return content;
            }
            try {
                if (!boundary) throw new Error();
                const result = boundary.validateForWrite({ eventId, content });
                if (!result.accepted) throw new Error();
                const canonical = result.content;
                // Structural assertions come exclusively from the privately
                // accepted canonical copy, including disabled premium sections.
                const bySectionId = Object.fromEntries(canonical.sections
                    .filter(section => premiumTypes.includes(section.type))
                    .map(section => {
                        let options = {};
                        if (section.type === "gallery") {
                            const ids = section.data.items.map(item => item.media_id);
                            options = { authorizedMediaIds: ids, mediaItems: canonical.media.items,
                                imagePolicy: privatePremium.createPolicy({ allowedUrls: ids
                                    .map(id => canonical.media.items[id].src).filter(src => !src.startsWith("/assets/")) }) };
                        } else if (section.type === "gifts") {
                            options = { authorizedGiftData: section.data };
                        } else if (section.type === "collaborative-album") {
                            options = { albumUrl: section.data.url,
                                albumPolicy: privatePremium.createPolicy({ allowedUrls: [section.data.url] }) };
                        }
                        return [section.id, options];
                    }));
                if (!validator.validateV2Event(canonical, { bySectionId }).valid) throw new Error();
                // Recheck current private state after full structural validation.
                // No asynchronous gap or consumer callback occurs before the write.
                if (!boundary.validateForWrite({ eventId, content: canonical }).accepted) throw new Error();
                return canonical;
            } catch (_) {
                // No manifests, private scope, values or validation details escape.
                throw editorialError("PREMIUM_AUTHORIZATION_DENIED", "Premium content cannot be persisted.");
            }
        }

        function createEvent(options = {}) {
            requireString(options.eventId, "eventId");
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.eventId)) {
                throw editorialError("INVALID_EVENT_ID", "eventId is invalid.");
            }
            if (!isPlainObject(options.content)) {
                throw editorialError("INVALID_EVENT", "Event content is invalid.");
            }
            const content = prepareContent(options.eventId, options.content);
            if (Object.prototype.hasOwnProperty.call(content, "id")
                && content.id !== options.eventId) {
                throw editorialError("INVALID_EVENT", "Event content id does not match eventId.");
            }

            return adapter.createEvent({
                eventId: options.eventId,
                content
            });
        }

        async function createVersion(options = {}) {
            requireString(options.eventId, "eventId");
            if (!Object.prototype.hasOwnProperty.call(options, "expectedWorkingVersionId")) {
                throw editorialError(
                    "INVALID_REQUEST",
                    "expectedWorkingVersionId must be provided explicitly."
                );
            }
            requireNullableString(options.expectedWorkingVersionId, "expectedWorkingVersionId");
            if (options.sourceVersionId !== undefined) {
                requireNullableString(options.sourceVersionId, "sourceVersionId");
            }

            const initialWorkflow = options.initialWorkflow === undefined
                ? "draft"
                : options.initialWorkflow;
            if (initialWorkflow !== "draft") {
                throw editorialError("INVALID_REQUEST", "initialWorkflow must be draft.");
            }
            if (!isPlainObject(options.content)) {
                throw editorialError("INVALID_EVENT", "Event content is invalid.");
            }

            const content = prepareContent(options.eventId, options.content);

            return adapter.createVersion({
                eventId: options.eventId,
                content,
                expectedWorkingVersionId: options.expectedWorkingVersionId,
                sourceVersionId: options.sourceVersionId ?? null,
                initialWorkflow,
                ...(options.adminIdentity ? { adminIdentity: options.adminIdentity } : {}),
                ...(options.origin ? { origin: options.origin } : {})
            });
        }

        function transitionWorkflow(options = {}) {
            requireString(options.eventId, "eventId");
            requireString(options.versionId, "versionId");
            requireString(options.expectedStatus, "expectedStatus");
            requireString(options.targetStatus, "targetStatus");
            return adapter.transitionWorkflow({
                eventId: options.eventId,
                versionId: options.versionId,
                expectedStatus: options.expectedStatus,
                targetStatus: options.targetStatus,
                ...(options.adminIdentity ? { adminIdentity: options.adminIdentity } : {}),
                ...(options.origin ? { origin: options.origin } : {})
            });
        }

        function publishVersion(options = {}) {
            requireString(options.eventId, "eventId");
            requireString(options.versionId, "versionId");
            return adapter.publishVersion({
                eventId: options.eventId,
                versionId: options.versionId,
                ...(options.adminIdentity ? { adminIdentity: options.adminIdentity } : {}),
                ...(options.origin ? { origin: options.origin } : {})
            });
        }

        function rollbackVersion(options = {}) {
            requireString(options.eventId, "eventId");
            requireString(options.versionId, "versionId");
            return adapter.rollbackVersion({
                eventId: options.eventId,
                versionId: options.versionId
            });
        }

        return {
            // Read-only reuse of the same private authorization/full validation
            // path. No adapter invocation and no private contexts are returned.
            preparePremiumContent: prepareContent,
            createEvent,
            createVersion,
            transitionWorkflow,
            publishVersion,
            rollbackVersion
        };
    }

    return { createEventVersionEditorialService };
});
