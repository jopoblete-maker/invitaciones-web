(function (root, factory) {
    const workflow = factory(typeof module === "object" && module.exports
        ? require("./editorial-preconditions") : root.EditorialPreconditions);

    if (typeof module === "object" && module.exports) {
        module.exports = workflow;
    }

    root.AdminEditorialWorkflow = workflow;
})(typeof globalThis !== "undefined" ? globalThis : this, function (preconditions) {
    const ACTIONS = Object.freeze({
        draft: Object.freeze({ kind: "submit", label: "Enviar a revision", expectedStatus: "draft", targetStatus: "in_review" }),
        in_review: Object.freeze({ kind: "approve", label: "Aprobar", expectedStatus: "in_review", targetStatus: "approved" }),
        approved: Object.freeze({ kind: "publish", label: "Publicar", expectedStatus: "approved" })
    });

    function getWorkingVersion(editorialState) {
        editorialState = preconditions.normalizeState(editorialState);
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
        // Workflow transitions retain expectedStatus; only publication changes
        // the published pointer and therefore requires a publication revision.
        if (definition.kind === "publish" && !preconditions.revision(editorialState.publicationRevision)) return null;
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
        const recovery = new Map();

        function validState(state, eventId) {
            const pointer = value => value === null || typeof value === "string" && value.length > 0;
            return Boolean(state && state.eventId === eventId && ["active", "archived"].includes(state.eventStatus)
                && (!Object.prototype.hasOwnProperty.call(state, "publicationRevision") || preconditions.revision(state.publicationRevision))
                && pointer(state.currentWorkingVersionId) && pointer(state.publishedVersionId)
                && !(state.currentWorkingVersionId && state.currentWorkingVersionId === state.publishedVersionId)
                && Array.isArray(state.versions) && state.versions.every(v => v && typeof v.versionId === "string"
                    && v.versionId.length > 0 && Number.isSafeInteger(v.versionNumber) && v.versionNumber > 0
                    && ["draft", "in_review", "approved"].includes(v.workflowStatus))
                && new Set(state.versions.map(v => v.versionId)).size === state.versions.length
                && new Set(state.versions.map(v => v.versionNumber)).size === state.versions.length
                && [state.currentWorkingVersionId, state.publishedVersionId].every(id => id === null || state.versions.some(v => v.versionId === id)));
        }

        function invalidResponse() {
            return Object.assign(new Error("No se pudo verificar el estado editorial."), { code: "INVALID_RESPONSE" });
        }

        async function readState(eventId, password) {
            const state = preconditions.normalizeState(await client.getEditorialState({ eventId, password }));
            if (!validState(state, eventId)) throw invalidResponse();
            return state;
        }

        function sameOperationState(left, right) {
            const version = state => getWorkingVersion(state);
            return left.eventId === right.eventId && left.eventStatus === right.eventStatus
                && left.publicationRevision === right.publicationRevision
                && left.currentWorkingVersionId === right.currentWorkingVersionId && left.publishedVersionId === right.publishedVersionId
                && version(left)?.versionId === version(right)?.versionId
                && version(left)?.versionNumber === version(right)?.versionNumber
                && version(left)?.workflowStatus === version(right)?.workflowStatus;
        }

        function completed(state, action, before) {
            if (!validState(state, action.eventId) || state.eventStatus !== "active") return false;
            const version = state.versions.find(v => v.versionId === action.versionId);
            if (!version || version.versionNumber !== action.versionNumber) return false;
            if (action.kind === "publish") {
                return state.publicationRevision === preconditions.resultingRevision({ expectedPublicationRevision: before.publicationRevision,
                    expectedPublishedVersionId: before.publishedVersionId }, action.versionId)
                    && state.publishedVersionId === action.versionId && state.currentWorkingVersionId === null
                    && version.workflowStatus === "approved" && typeof version.publishedAt === "string"
                    && Number.isFinite(Date.parse(version.publishedAt));
            }
            return state.publicationRevision === before.publicationRevision
                && state.currentWorkingVersionId === action.versionId && state.publishedVersionId === before.publishedVersionId
                && version.workflowStatus === action.targetStatus;
        }

        function validReceipt(receipt, action, before) {
            return Boolean(receipt && receipt.eventId === action.eventId && (action.kind === "publish"
                ? preconditions.receipt(receipt, action.eventId, action.versionId, {
                    expectedPublishedVersionId: before.publishedVersionId, expectedPublicationRevision: before.publicationRevision })
                : receipt.versionId === action.versionId && receipt.workflowStatus === action.targetStatus));
        }

        async function run({ eventId, versionId, password, requestedKind, expectedStatus, observedState, isCurrent = () => true } = {}) {
            versionId = preconditions.normalizeVersionId(versionId);
            observedState = preconditions.normalizeState(observedState);
            if (pending) return { outcome: "busy" };
            if (recovery.has(eventId)) return { outcome: "refresh-required" };
            pending = true;
            try {
                const freshState = await readState(eventId, password);
                if (requestedKind === "publish" && !preconditions.revision(freshState.publicationRevision)) throw invalidResponse();
                if (!isCurrent()) return { outcome: "stale-view" };
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
                if (observedState && (!validState(observedState, eventId) || !sameOperationState(observedState, freshState))) {
                    return { outcome: "stale", state: freshState };
                }
                const confirmedState = Object.freeze({ ...freshState, versions: Object.freeze(freshState.versions.map(v => Object.freeze({ ...v }))) });

                if (action.kind === "publish") {
                    const confirmation = await confirmPublication(Object.freeze({ ...action,
                        expectedPublishedVersionId: confirmedState.publishedVersionId,
                        expectedPublicationRevision: confirmedState.publicationRevision }));
                    if (!isPublicationConfirmed(action, confirmation)) {
                        return { outcome: "cancelled", state: freshState };
                    }
                }
                if (!isCurrent()) return { outcome: "stale-view" };
                const beforePost = await readState(eventId, password);
                if (!isCurrent()) return { outcome: "stale-view" };
                if (!sameOperationState(confirmedState, beforePost)) return { outcome: "stale", state: beforePost };

                // Retain uncertainty before sending; no subsequent attempt may bypass reconciliation.
                recovery.set(eventId, { action, before: confirmedState, conflict: false });
                try {
                    const receipt = action.kind === "publish"
                        ? await client.publishVersion({ eventId: action.eventId, versionId: action.versionId, password,
                            expectedPublishedVersionId: confirmedState.publishedVersionId,
                            expectedPublicationRevision: confirmedState.publicationRevision })
                        : await client.transitionWorkflow({
                            eventId: action.eventId,
                            versionId: action.versionId,
                            expectedStatus: action.expectedStatus,
                            targetStatus: action.targetStatus,
                            password
                        });
                    if (!validReceipt(receipt, action, confirmedState)) throw invalidResponse();
                } catch (error) {
                    if (error?.rejectionConfirmed === true && error.status === 409) {
                        recovery.get(eventId).conflict = true;
                        try {
                            const state = await reconcile(eventId, password, () => true);
                            return { outcome: "conflict", state, error };
                        } catch (refreshError) { return { outcome: "conflict-refresh-failed", error, refreshError }; }
                    }
                    if (error?.rejectionConfirmed === true && [400, 401, 403, 404, 413, 415, 422, 428, 429].includes(error.status)) {
                        recovery.delete(eventId);
                        throw error;
                    }
                    return { outcome: "mutation-unknown", action, error };
                }

                try {
                    const state = await readState(eventId, password);
                    if (!completed(state, action, confirmedState)) return { outcome: "mutation-unknown", action, state };
                    recovery.delete(eventId);
                    return { outcome: "success", state, action };
                } catch (refreshError) {
                    return { outcome: "accepted-refresh-failed", action, refreshError };
                }
            } finally {
                pending = false;
            }
        }

        async function refresh({ eventId, password, isCurrent = () => true } = {}) {
            if (pending) throw Object.assign(new Error("Operacion editorial en curso."), { code: "BUSY" });
            return reconcile(eventId, password, isCurrent);
        }

        async function reconcile(eventId, password, isCurrent) {
            const entry = recovery.get(eventId);
            const state = await readState(eventId, password);
            // An unchanged GET after a timeout is NOT evidence that the POST will never complete.
            if (isCurrent() && entry && recovery.get(eventId) === entry
                && (entry.conflict || completed(state, entry.action, entry.before))) recovery.delete(eventId);
            return state;
        }

        return { run, refresh, isPending: () => pending, requiresRefresh: eventId => recovery.has(eventId) };
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
