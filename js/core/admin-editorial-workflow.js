(function (root, factory) {
    const workflow = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = workflow;
    }

    root.AdminEditorialWorkflow = workflow;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const ACTIONS = Object.freeze({
        draft: Object.freeze({ kind: "submit", label: "Enviar a revision", expectedStatus: "draft", targetStatus: "in_review" }),
        in_review: Object.freeze({ kind: "approve", label: "Aprobar", expectedStatus: "in_review", targetStatus: "approved" }),
        approved: Object.freeze({ kind: "publish", label: "Publicar", expectedStatus: "approved" })
    });

    function getWorkingVersion(editorialState) {
        if (!editorialState || editorialState.eventStatus !== "active"
            || typeof editorialState.currentWorkingVersionId !== "string"
            || !Array.isArray(editorialState.versions)) {
            return null;
        }
        return editorialState.versions.find(
            (version) => version?.versionId === editorialState.currentWorkingVersionId
        ) || null;
    }

    function getAvailableAction(editorialState) {
        const version = getWorkingVersion(editorialState);
        const definition = version && ACTIONS[version.workflowStatus];
        if (!definition) return null;
        return Object.freeze({
            ...definition,
            eventId: editorialState.eventId,
            versionId: version.versionId,
            versionNumber: version.versionNumber
        });
    }

    function publicationPhrase(eventId) {
        return `PUBLICAR ${eventId}`;
    }

    function isPublicationConfirmed(action, value) {
        return action?.kind === "publish" && value === publicationPhrase(action.eventId);
    }

    function createViewGuard() {
        let generation = 0;
        let selectedEventId = null;
        let refreshRequired = false;

        function begin(eventId) {
            generation += 1;
            selectedEventId = eventId;
            return Object.freeze({ eventId, generation });
        }

        function isCurrent(operation) {
            return Boolean(operation
                && operation.generation === generation
                && operation.eventId === selectedEventId);
        }

        function acceptState(operation, state) {
            if (!isCurrent(operation) || state?.eventId !== operation.eventId) return false;
            refreshRequired = false;
            return true;
        }

        function requireRefresh(operation) {
            if (!isCurrent(operation)) return false;
            refreshRequired = true;
            return true;
        }

        function reset() {
            generation += 1;
            selectedEventId = null;
            refreshRequired = false;
        }

        return {
            begin,
            isCurrent,
            isSelected: (eventId) => eventId === selectedEventId,
            acceptState,
            requireRefresh,
            reset,
            requiresRefresh: () => refreshRequired
        };
    }

    function createActionRunner({ client, confirmPublication } = {}) {
        if (!client || typeof client.getEditorialState !== "function"
            || typeof client.transitionWorkflow !== "function"
            || typeof client.publishVersion !== "function") {
            throw new TypeError("client must implement the editorial workflow contract.");
        }
        if (typeof confirmPublication !== "function") {
            throw new TypeError("confirmPublication must be a function.");
        }

        let pending = false;

        async function run({ eventId, versionId, password, requestedKind, expectedStatus } = {}) {
            if (pending) return { outcome: "busy" };
            pending = true;
            try {
                const freshState = await client.getEditorialState({ eventId, password });
                const action = getAvailableAction(freshState);
                if (freshState.eventId !== eventId
                    || freshState.currentWorkingVersionId !== versionId
                    || !action
                    || action.eventId !== eventId
                    || action.versionId !== versionId
                    || action.kind !== requestedKind
                    || action.expectedStatus !== expectedStatus) {
                    return { outcome: "stale", state: freshState };
                }

                if (action.kind === "publish") {
                    const confirmation = await confirmPublication(action);
                    if (!isPublicationConfirmed(action, confirmation)) {
                        return { outcome: "cancelled", state: freshState };
                    }
                    try {
                        await client.publishVersion({ eventId: action.eventId, versionId: action.versionId, password });
                    } catch (error) {
                        return await handleMutationError(error, { eventId, password });
                    }
                } else {
                    try {
                        await client.transitionWorkflow({
                            eventId: action.eventId,
                            versionId: action.versionId,
                            expectedStatus: action.expectedStatus,
                            targetStatus: action.targetStatus,
                            password
                        });
                    } catch (error) {
                        return await handleMutationError(error, { eventId, password });
                    }
                }

                try {
                    const state = await client.getEditorialState({ eventId, password });
                    return { outcome: "success", state, action };
                } catch (refreshError) {
                    return { outcome: "accepted-refresh-failed", action, refreshError };
                }
            } finally {
                pending = false;
            }
        }

        async function handleMutationError(error, { eventId, password }) {
            if (error?.status !== 409) throw error;
            try {
                const state = await client.getEditorialState({ eventId, password });
                return { outcome: "conflict", state, error };
            } catch (refreshError) {
                return { outcome: "conflict-refresh-failed", error, refreshError };
            }
        }

        return { run, isPending: () => pending };
    }

    return {
        getWorkingVersion,
        getAvailableAction,
        publicationPhrase,
        isPublicationConfirmed,
        createViewGuard,
        createActionRunner
    };
});
