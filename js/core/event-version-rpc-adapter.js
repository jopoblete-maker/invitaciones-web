(function (root, factory) {
    const adapter = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = adapter;
    }

    root.EventVersionRpcAdapter = adapter;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const ERROR_MESSAGES = Object.freeze({
        EVENT_NOT_FOUND: "Event not found.",
        EVENT_ALREADY_EXISTS: "Event already exists.",
        INVALID_EVENT_ID: "Event id is invalid.",
        EVENT_ARCHIVED: "Event is archived.",
        VERSION_CONFLICT: "The working version changed.",
        INVALID_EVENT: "Event content is invalid.",
        INVALID_WORKFLOW: "The version workflow does not allow this operation.",
        VERSION_NOT_FOUND: "Version not found.",
        VERSION_EVENT_MISMATCH: "Version does not belong to event."
    });

    class EventVersionRpcError extends Error {
        constructor(message, options = {}) {
            super(message);
            this.name = "EventVersionRpcError";
            if (options.code) this.code = options.code;
            if (options.cause !== undefined) {
                Object.defineProperty(this, "cause", {
                    value: options.cause,
                    enumerable: false
                });
            }
        }
    }

    function knownErrorCode(error) {
        if (!error || typeof error !== "object") return null;

        for (const field of ["message", "details", "hint", "code"]) {
            const value = error[field];
            if (typeof value !== "string") continue;
            const candidate = value.trim().toUpperCase();
            if (Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, candidate)) {
                return candidate;
            }
        }

        return null;
    }

    function normalizeError(error) {
        if (error instanceof EventVersionRpcError) return error;

        const code = knownErrorCode(error);
        if (code) {
            return new EventVersionRpcError(ERROR_MESSAGES[code], { code, cause: error });
        }

        return new EventVersionRpcError("Versioning persistence operation failed.", {
            cause: error
        });
    }

    function requireSingleRow(data) {
        if (!Array.isArray(data) || data.length !== 1
            || !data[0] || typeof data[0] !== "object" || Array.isArray(data[0])) {
            throw new EventVersionRpcError("Versioning persistence operation failed.");
        }
        return data[0];
    }

    function normalizeVersionNumber(value) {
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < 1) {
            throw new EventVersionRpcError("Versioning persistence operation failed.");
        }
        return number;
    }

    function createEventVersionRpcAdapter(supabase) {
        if (!supabase || typeof supabase.rpc !== "function") {
            throw new TypeError("supabase must implement rpc.");
        }

        async function execute(name, parameters, normalize) {
            try {
                const response = await supabase.rpc(name, parameters);
                if (!response || typeof response !== "object") {
                    throw new EventVersionRpcError("Versioning persistence operation failed.");
                }
                if (response.error) throw response.error;
                return normalize(requireSingleRow(response.data));
            } catch (error) {
                throw normalizeError(error);
            }
        }

        function createEvent({ eventId, content }) {
            return execute("create_versioned_event", {
                p_event_id: eventId,
                p_content: content
            }, (row) => ({
                eventId: row.event_id,
                versionId: row.version_id,
                versionNumber: normalizeVersionNumber(row.version_number),
                workflowStatus: row.workflow_status
            }));
        }

        function createVersion({
            eventId,
            content,
            expectedWorkingVersionId = null,
            sourceVersionId = null,
            initialWorkflow = "draft"
        }) {
            return execute("create_event_version", {
                p_event_id: eventId,
                p_content: content,
                p_expected_working_version_id: expectedWorkingVersionId,
                p_source_version_id: sourceVersionId,
                p_initial_workflow: initialWorkflow
            }, (row) => ({
                versionId: row.version_id,
                versionNumber: normalizeVersionNumber(row.version_number)
            }));
        }

        function publishVersion({ eventId, versionId }) {
            return execute("publish_event_version", {
                p_event_id: eventId,
                p_version_id: versionId
            }, (row) => ({
                eventId: row.event_id,
                publishedVersionId: row.published_version_id
            }));
        }

        function rollbackVersion({ eventId, versionId }) {
            return execute("rollback_event_version", {
                p_event_id: eventId,
                p_version_id: versionId
            }, (row) => ({
                eventId: row.event_id,
                publishedVersionId: row.published_version_id
            }));
        }

        function transitionWorkflow({ eventId, versionId, expectedStatus, targetStatus }) {
            return execute("transition_event_version_workflow", {
                p_event_id: eventId,
                p_version_id: versionId,
                p_expected_status: expectedStatus,
                p_target_status: targetStatus
            }, (row) => ({
                eventId: row.event_id,
                versionId: row.version_id,
                workflowStatus: row.workflow_status
            }));
        }

        function archiveEvent({ eventId }) {
            return execute("archive_event", {
                p_event_id: eventId
            }, (row) => ({
                eventId: row.event_id,
                eventStatus: row.event_status
            }));
        }

        return {
            createEvent,
            createVersion,
            publishVersion,
            rollbackVersion,
            transitionWorkflow,
            archiveEvent
        };
    }

    return {
        EventVersionRpcError,
        createEventVersionRpcAdapter
    };
});
