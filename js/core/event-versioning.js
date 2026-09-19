(function (root, factory) {
    const validator = typeof require === "function"
        ? require("./event-validator")
        : root.EventValidator;
    const versioning = factory(validator);

    if (typeof module === "object" && module.exports) {
        module.exports = versioning;
    }

    root.EventVersioning = versioning;
})(typeof globalThis !== "undefined" ? globalThis : this, function (validator) {
    const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    function domainError(code, message, details) {
        const error = new Error(message);
        error.code = code;
        if (details !== undefined) error.details = details;
        return error;
    }

    function createEventVersioningService(repository, options = {}) {
        if (!repository) throw new TypeError("repository is required.");

        const now = options.now || (() => new Date().toISOString());
        const createVersionId = options.createVersionId || (() => {
            throw new Error("createVersionId is required.");
        });

        function requireEvent(eventId) {
            const event = repository.getEvent(eventId);
            if (!event) throw domainError("EVENT_NOT_FOUND", `Event not found: ${eventId}`);
            return event;
        }

        function requireOwnedVersion(eventId, versionId) {
            const version = repository.getVersion(versionId);
            if (!version) throw domainError("VERSION_NOT_FOUND", `Version not found: ${versionId}`);
            if (version.event_id !== eventId) {
                throw domainError("VERSION_EVENT_MISMATCH", "Version does not belong to event.");
            }
            return version;
        }

        function requireActive(event) {
            if (event.event_status !== "active") {
                throw domainError("EVENT_ARCHIVED", `Event is archived: ${event.id}`);
            }
        }

        function validateContent(content) {
            const validation = validator.validateEventForPersistence(content);
            if (!validation.valid) {
                throw domainError("INVALID_EVENT", "Event content is invalid.", validation.errors);
            }
        }

        function buildVersion(eventId, versionNumber, content, sourceVersionId, timestamp) {
            return {
                id: createVersionId(),
                event_id: eventId,
                version_number: versionNumber,
                content,
                schema_version: content?.schema_version ?? null,
                workflow_status: "draft",
                source_version_id: sourceVersionId || null,
                created_at: timestamp,
                published_at: null
            };
        }

        function createEvent({ id, content }) {
            if (typeof id !== "string" || !EVENT_ID_PATTERN.test(id)) {
                throw domainError("INVALID_EVENT_ID", "Event id must use lowercase letters, numbers and single hyphens.");
            }
            if (repository.getEvent(id)) {
                throw domainError("EVENT_ALREADY_EXISTS", `Event already exists: ${id}`);
            }
            validateContent(content);

            const timestamp = now();
            const version = buildVersion(id, 1, content, null, timestamp);
            const event = {
                id,
                published_version_id: null,
                current_working_version_id: version.id,
                event_status: "active",
                created_at: timestamp,
                updated_at: timestamp
            };
            return repository.createEventWithVersion(event, version);
        }

        function createDraft(eventId) {
            const event = requireEvent(eventId);
            requireActive(event);
            if (event.current_working_version_id && event.current_working_version_id !== event.published_version_id) {
                throw domainError("WORKING_VERSION_EXISTS", "Event already has a working version.");
            }
            if (!event.published_version_id) {
                throw domainError("EVENT_NOT_PUBLISHED", "A draft requires a published source version.");
            }
            const source = requireOwnedVersion(eventId, event.published_version_id);
            return createVersion(eventId, source.content, event.current_working_version_id, source.id);
        }

        function createVersion(eventId, content, expectedWorkingVersionId, sourceVersionId) {
            const event = requireEvent(eventId);
            requireActive(event);
            const expectedId = expectedWorkingVersionId || null;
            if ((event.current_working_version_id || null) !== expectedId) {
                throw domainError("VERSION_CONFLICT", "Working version changed.");
            }
            validateContent(content);
            const history = repository.listVersions(eventId);
            const versionNumber = history.reduce((highest, item) => Math.max(highest, item.version_number), 0) + 1;
            const sourceId = sourceVersionId === undefined
                ? event.current_working_version_id || event.published_version_id || null
                : sourceVersionId;
            if (sourceId) requireOwnedVersion(eventId, sourceId);
            const timestamp = now();
            const version = buildVersion(eventId, versionNumber, content, sourceId, timestamp);
            return repository.addVersionAndSetWorking(eventId, version, expectedId, timestamp);
        }

        function submitForReview(eventId, versionId) {
            requireEvent(eventId);
            const version = requireOwnedVersion(eventId, versionId);
            if (version.workflow_status !== "draft") {
                throw domainError("INVALID_WORKFLOW_TRANSITION", "Only a draft can be submitted for review.");
            }
            return repository.updateVersionMetadata(versionId, { workflow_status: "in_review" });
        }

        function approveVersion(eventId, versionId) {
            requireEvent(eventId);
            const version = requireOwnedVersion(eventId, versionId);
            if (version.workflow_status !== "in_review") {
                throw domainError("INVALID_WORKFLOW_TRANSITION", "Only an in-review version can be approved.");
            }
            return repository.updateVersionMetadata(versionId, { workflow_status: "approved" });
        }

        function publishVersion(eventId, versionId) {
            const event = requireEvent(eventId);
            requireActive(event);
            const version = requireOwnedVersion(eventId, versionId);
            if (version.workflow_status !== "approved") {
                throw domainError("INVALID_WORKFLOW_TRANSITION", "Only an approved version can be published.");
            }
            if (event.current_working_version_id !== versionId) {
                throw domainError("VERSION_CONFLICT", "Only the current working version can be published.");
            }
            validateContent(version.content);
            const timestamp = now();
            if (!version.published_at) {
                repository.updateVersionMetadata(versionId, { published_at: timestamp });
            }
            repository.updateEvent(eventId, {
                published_version_id: versionId,
                current_working_version_id: null,
                updated_at: timestamp
            });
            return getPublishedVersion(eventId);
        }

        function rollbackToVersion(eventId, versionId) {
            const event = requireEvent(eventId);
            requireActive(event);
            const version = requireOwnedVersion(eventId, versionId);
            if (version.workflow_status !== "approved" && !version.published_at) {
                throw domainError("VERSION_NOT_PUBLISHABLE", "Version has never been approved or published.");
            }
            validateContent(version.content);
            repository.updateEvent(eventId, {
                published_version_id: versionId,
                updated_at: now()
            });
            return getPublishedVersion(eventId);
        }

        function archiveEvent(eventId) {
            const event = requireEvent(eventId);
            if (event.event_status === "archived") return event;
            return repository.updateEvent(eventId, { event_status: "archived", updated_at: now() });
        }

        function getPublishedVersion(eventId) {
            const event = requireEvent(eventId);
            requireActive(event);
            if (!event.published_version_id) {
                throw domainError("EVENT_NOT_PUBLISHED", `Event is not published: ${eventId}`);
            }
            return requireOwnedVersion(eventId, event.published_version_id);
        }

        function getWorkingVersion(eventId) {
            const event = requireEvent(eventId);
            if (!event.current_working_version_id) return null;
            return requireOwnedVersion(eventId, event.current_working_version_id);
        }

        function getVersionHistory(eventId) {
            requireEvent(eventId);
            return repository.listVersions(eventId);
        }

        return {
            createEvent,
            createDraft,
            createVersion,
            submitForReview,
            approveVersion,
            publishVersion,
            rollbackToVersion,
            archiveEvent,
            getPublishedVersion,
            getWorkingVersion,
            getVersionHistory
        };
    }

    return { createEventVersioningService };
});
