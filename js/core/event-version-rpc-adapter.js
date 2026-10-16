(function (root, factory) {
    const adapter = factory(typeof module === "object" && module.exports
        ? require("./editorial-preconditions") : root.EditorialPreconditions);

    if (typeof module === "object" && module.exports) {
        module.exports = adapter;
    }

    root.EventVersionRpcAdapter = adapter;
})(typeof globalThis !== "undefined" ? globalThis : this, function (preconditions) {
    const ERROR_MESSAGES = Object.freeze({
        PRECONDITION_REQUIRED: "Explicit editorial preconditions are required.",
        INVALID_REQUEST: "Invalid editorial preconditions.",
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

        function auditContext(context = {}, action) {
            return {
                p_admin_identity: context.adminIdentity || "shared-admin-credential",
                p_ip: context.ip ?? null,
                p_origin: context.origin ?? null,
                p_action: action
            };
        }

        function createVersion({
            eventId,
            content,
            expectedWorkingVersionId = null,
            sourceVersionId = null,
            initialWorkflow = "draft",
            adminIdentity,
            ip,
            origin
        }) {
            return execute("create_event_version_audited", {
                p_event_id: eventId,
                p_content: content,
                p_expected_working_version_id: expectedWorkingVersionId,
                p_source_version_id: sourceVersionId,
                p_initial_workflow: initialWorkflow,
                ...auditContext({ adminIdentity, ip, origin }, "CREATE_VERSION")
            }, (row) => ({
                versionId: row.version_id,
                versionNumber: normalizeVersionNumber(row.version_number)
            }));
        }

        function pointerMutation(options = {}, rollback) {
            const { eventId, adminIdentity, ip, origin } = options;
            const expected = preconditions.expectations(options, rollback);
            const versionId = preconditions.canonicalUuid(options.versionId);
            return execute(rollback ? "rollback_event_version" : "publish_event_version_audited", {
                p_event_id: eventId,
                p_version_id: versionId,
                p_expected_published_version_id: expected.expectedPublishedVersionId,
                p_expected_publication_revision: expected.expectedPublicationRevision,
                ...(rollback ? { p_expected_working_version_id: expected.expectedWorkingVersionId }
                    : auditContext({ adminIdentity, ip, origin }, "PUBLISH_VERSION"))
            }, row => {
                const result = { eventId: row.event_id, publishedVersionId: preconditions.normalizeVersionId(row.published_version_id),
                    publicationRevision: row.publication_revision };
                if (!preconditions.receipt(result, eventId, versionId, expected)) {
                    throw new EventVersionRpcError("Invalid editorial receipt.");
                }
                return result;
            });
        }

        function publishVersion(options) { return pointerMutation(options, false); }
        function rollbackVersion(options) { return pointerMutation(options, true); }

        function transitionWorkflow({
            eventId,
            versionId,
            expectedStatus,
            targetStatus,
            adminIdentity,
            ip,
            origin
        }) {
            const action = targetStatus === "approved" ? "APPROVE_VERSION" : "CHANGE_WORKFLOW";
            return execute("transition_event_version_workflow_audited", {
                p_event_id: eventId,
                p_version_id: versionId,
                p_expected_status: expectedStatus,
                p_target_status: targetStatus,
                ...auditContext({ adminIdentity, ip, origin }, action)
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
