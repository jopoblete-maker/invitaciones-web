(function (root, factory) {
    const repository = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = repository;
    }

    root.EventVersionRepositoryMemory = repository;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function deepFreeze(value) {
        if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    }

    function repositoryError(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    function createMemoryEventVersionRepository() {
        const events = new Map();
        const versions = new Map();

        function storedCopy(value) {
            return deepFreeze(clone(value));
        }

        function getEvent(id) {
            return clone(events.get(id) || null);
        }

        function getVersion(id) {
            return clone(versions.get(id) || null);
        }

        function listVersions(eventId) {
            return Array.from(versions.values())
                .filter((version) => version.event_id === eventId)
                .sort((left, right) => left.version_number - right.version_number)
                .map(clone);
        }

        function createEventWithVersion(event, version) {
            if (events.has(event.id)) {
                throw repositoryError("EVENT_ALREADY_EXISTS", `Event already exists: ${event.id}`);
            }
            if (versions.has(version.id)) {
                throw repositoryError("VERSION_ALREADY_EXISTS", `Version already exists: ${version.id}`);
            }
            if (version.event_id !== event.id) {
                throw repositoryError("VERSION_EVENT_MISMATCH", "Initial version does not belong to event.");
            }

            versions.set(version.id, storedCopy(version));
            events.set(event.id, storedCopy(event));
            return { event: getEvent(event.id), version: getVersion(version.id) };
        }

        function addVersionAndSetWorking(eventId, version, expectedWorkingVersionId, updatedAt) {
            const event = events.get(eventId);
            if (!event) throw repositoryError("EVENT_NOT_FOUND", `Event not found: ${eventId}`);
            const actualWorkingId = event.current_working_version_id || null;
            const expectedId = expectedWorkingVersionId || null;
            if (actualWorkingId !== expectedId) {
                throw repositoryError("VERSION_CONFLICT", "Working version changed.");
            }
            if (versions.has(version.id)) {
                throw repositoryError("VERSION_ALREADY_EXISTS", `Version already exists: ${version.id}`);
            }
            if (version.event_id !== eventId) {
                throw repositoryError("VERSION_EVENT_MISMATCH", "Version does not belong to event.");
            }

            versions.set(version.id, storedCopy(version));
            events.set(eventId, storedCopy({
                ...event,
                current_working_version_id: version.id,
                updated_at: updatedAt
            }));
            return { event: getEvent(eventId), version: getVersion(version.id) };
        }

        function updateEvent(eventId, changes) {
            const event = events.get(eventId);
            if (!event) throw repositoryError("EVENT_NOT_FOUND", `Event not found: ${eventId}`);
            const allowed = ["published_version_id", "current_working_version_id", "event_status", "updated_at"];
            Object.keys(changes).forEach((key) => {
                if (!allowed.includes(key)) {
                    throw repositoryError("IMMUTABLE_EVENT_FIELD", `Event field cannot be changed: ${key}`);
                }
            });
            events.set(eventId, storedCopy({ ...event, ...clone(changes) }));
            return getEvent(eventId);
        }

        function updateVersionMetadata(versionId, changes) {
            const version = versions.get(versionId);
            if (!version) throw repositoryError("VERSION_NOT_FOUND", `Version not found: ${versionId}`);
            const allowed = ["workflow_status", "published_at"];
            Object.keys(changes).forEach((key) => {
                if (!allowed.includes(key)) {
                    throw repositoryError("IMMUTABLE_VERSION_FIELD", `Version field cannot be changed: ${key}`);
                }
            });
            versions.set(versionId, storedCopy({ ...version, ...clone(changes) }));
            return getVersion(versionId);
        }

        return {
            getEvent,
            getVersion,
            listVersions,
            createEventWithVersion,
            addVersionAndSetWorking,
            updateEvent,
            updateVersionMetadata
        };
    }

    return { createMemoryEventVersionRepository };
});
