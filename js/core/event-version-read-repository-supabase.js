(function (root, factory) {
    const repository = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = repository;
    }

    root.EventVersionReadRepositorySupabase = repository;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function repositoryError(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    function normalizeVersionMetadata(row) {
        return {
            versionId: row.id,
            versionNumber: row.version_number,
            workflowStatus: row.workflow_status,
            createdAt: row.created_at,
            publishedAt: row.published_at,
            sourceVersionId: row.source_version_id
        };
    }

    function createEventVersionReadRepository(supabase, options = {}) {
        if (!supabase || typeof supabase.from !== "function") {
            throw new TypeError("supabase must implement from.");
        }
        const execute = typeof options.execute === "function"
            ? options.execute
            : (query) => query;

        async function getEditorialState(eventId) {
            const eventResult = await execute(supabase
                .from("eventos")
                .select("id, event_status, published_version_id, current_working_version_id")
                .eq("id", eventId)
                .maybeSingle());
            if (eventResult.error) throw eventResult.error;
            if (!eventResult.data) {
                throw repositoryError("EVENT_NOT_FOUND", "Event not found.");
            }

            const versionsResult = await execute(supabase
                .from("event_versions")
                .select("id, version_number, workflow_status, created_at, published_at, source_version_id")
                .eq("event_id", eventId)
                .order("version_number", { ascending: true }));
            if (versionsResult.error) throw versionsResult.error;

            return {
                eventId: eventResult.data.id,
                eventStatus: eventResult.data.event_status,
                publishedVersionId: eventResult.data.published_version_id,
                currentWorkingVersionId: eventResult.data.current_working_version_id,
                versions: (versionsResult.data || []).map(normalizeVersionMetadata)
            };
        }

        async function getVersion(eventId, versionId) {
            const result = await execute(supabase
                .from("event_versions")
                .select("id, event_id, version_number, workflow_status, created_at, published_at, source_version_id, content")
                .eq("id", versionId)
                .maybeSingle());
            if (result.error) throw result.error;
            if (!result.data) {
                throw repositoryError("VERSION_NOT_FOUND", "Version not found.");
            }
            if (result.data.event_id !== eventId) {
                throw repositoryError("VERSION_EVENT_MISMATCH", "Version does not belong to event.");
            }

            return {
                eventId: result.data.event_id,
                ...normalizeVersionMetadata(result.data),
                content: result.data.content
            };
        }

        return { getEditorialState, getVersion };
    }

    return { createEventVersionReadRepository };
});
