(function (root, factory) {
    const validator = typeof require === "function"
        ? require("./event-validator")
        : root.EventValidator;
    const service = factory(validator);

    if (typeof module === "object" && module.exports) {
        module.exports = service;
    }

    root.EventVersionEditorialService = service;
})(typeof globalThis !== "undefined" ? globalThis : this, function (validator) {
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

    function createEventVersionEditorialService(adapter) {
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

        function createEvent(options = {}) {
            requireString(options.eventId, "eventId");
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.eventId)) {
                throw editorialError("INVALID_EVENT_ID", "eventId is invalid.");
            }
            if (!isPlainObject(options.content)) {
                throw editorialError("INVALID_EVENT", "Event content is invalid.");
            }
            if (Object.prototype.hasOwnProperty.call(options.content, "id")
                && options.content.id !== options.eventId) {
                throw editorialError("INVALID_EVENT", "Event content id does not match eventId.");
            }

            const validation = validator.validateEventForPersistence(options.content);
            if (!validation.valid) {
                throw editorialError("INVALID_EVENT", "Event content is invalid.", validation.errors);
            }
            return adapter.createEvent({
                eventId: options.eventId,
                content: options.content
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

            const validation = validator.validateEventForPersistence(options.content);
            if (!validation.valid) {
                throw editorialError("INVALID_EVENT", "Event content is invalid.", validation.errors);
            }

            return adapter.createVersion({
                eventId: options.eventId,
                content: options.content,
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
            createEvent,
            createVersion,
            transitionWorkflow,
            publishVersion,
            rollbackVersion
        };
    }

    return { createEventVersionEditorialService };
});
