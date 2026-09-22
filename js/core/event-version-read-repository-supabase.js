(function (root, factory) {
    const repository = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = repository;
    }

    root.EventVersionReadRepositorySupabase = repository;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const crypto = typeof require === "function" ? require("crypto") : null;
    const CURSOR_PURPOSE = "admin-events-cursor";
    function repositoryError(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    function encodeCursor(row, secret) {
        if (!secret || !crypto) throw repositoryError("CURSOR_NOT_CONFIGURED", "Cursor signing is not configured.");
        const payload = Buffer.from(JSON.stringify({ purpose: CURSOR_PURPOSE, updatedAt: row.updated_at, id: row.id })).toString("base64url");
        const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
        return `${payload}.${signature}`;
    }

    function decodeCursor(cursor, secret) {
        if (!secret || !crypto) throw repositoryError("CURSOR_NOT_CONFIGURED", "Cursor signing is not configured.");
        if (typeof cursor !== "string" || cursor.length > 512) throw repositoryError("INVALID_CURSOR", "Cursor is invalid.");
        try {
            const [payload, signature] = cursor.split(".");
            if (!payload || !signature) throw new Error();
            const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
            const actualBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expected);
            if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) throw new Error();
            const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
            if (!value || value.purpose !== CURSOR_PURPOSE || typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))
                || typeof value.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*-?$/.test(value.id)) throw new Error();
            return value;
        } catch {
            throw repositoryError("INVALID_CURSOR", "Cursor is invalid.");
        }
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

        async function listEvents({ limit = 50, cursor = null } = {}) {
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
            let query = supabase.from("eventos")
                .select("id, event_status, published_version_id, current_working_version_id, updated_at")
                .order("updated_at", { ascending: false })
                .order("id", { ascending: true });
            if (cursor) {
                const position = decodeCursor(cursor, options.cursorSecret);
                if (typeof query.or !== "function") throw repositoryError("INVALID_CURSOR", "Cursor is not supported.");
                const updatedAt = position.updatedAt;
                const id = position.id;
                query = query.or(`updated_at.lt.${updatedAt},and(updated_at.eq.${updatedAt},id.gt.${id})`);
            }
            if (typeof query.range === "function") query = query.range(0, safeLimit);
            const result = await execute(query);
            if (result.error) throw result.error;
            const rows = Array.isArray(result.data) ? result.data : [];
            const events = [];
            for (const row of rows.slice(0, safeLimit + 1)) {
                const versionsResult = await execute(supabase
                    .from("event_versions")
                    .select("id, version_number, workflow_status, created_at, published_at, source_version_id")
                    .eq("event_id", row.id)
                    .order("version_number", { ascending: true }));
                if (versionsResult.error) throw versionsResult.error;
                const versions = (versionsResult.data || []).map(normalizeVersionMetadata);
                const byId = new Map(versions.map((version) => [version.versionId, version]));
                events.push({
                    eventId: row.id,
                    eventStatus: row.event_status,
                    currentWorkingVersionId: row.current_working_version_id ?? null,
                    publishedVersionId: row.published_version_id ?? null,
                    workingVersion: byId.get(row.current_working_version_id) || null,
                    publishedVersion: byId.get(row.published_version_id) || null
                });
            }
            const page = events.slice(0, safeLimit);
            return {
                events: page,
                nextCursor: rows.length > safeLimit ? encodeCursor(rows[safeLimit - 1], options.cursorSecret) : null
            };
        }

        return { getEditorialState, getVersion, listEvents };
    }

    return { createEventVersionReadRepository };
});
