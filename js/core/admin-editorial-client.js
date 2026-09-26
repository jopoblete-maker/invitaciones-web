(function (root, factory) {
    const client = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = client;
    }

    root.AdminEditorialClient = client;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    class AdminEditorialApiError extends Error {
        constructor(code, message, status, options = {}) {
            super(message);
            this.name = "AdminEditorialApiError";
            this.code = code;
            if (status !== undefined) this.status = status;
            if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter;
        }
    }

    function parseJson(response) {
        return response.json().catch(() => null);
    }

    function isPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    function normalizeVersion(version) {
        if (!version || typeof version !== "object") {
            throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
        }
        return {
            versionId: version.versionId,
            versionNumber: version.versionNumber,
            workflowStatus: version.workflowStatus,
            createdAt: version.createdAt,
            publishedAt: version.publishedAt,
            sourceVersionId: version.sourceVersionId ?? null
        };
    }

    function normalizeEditorialState(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)
            || typeof payload.eventId !== "string" || typeof payload.eventStatus !== "string"
            || !Array.isArray(payload.versions)) {
            throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
        }

        return {
            eventId: payload.eventId,
            eventStatus: payload.eventStatus,
            currentWorkingVersionId: payload.currentWorkingVersionId ?? null,
            publishedVersionId: payload.publishedVersionId ?? null,
            versions: payload.versions.map(normalizeVersion)
        };
    }

    function normalizeEventSummary(event) {
        if (!event || typeof event !== "object" || typeof event.eventId !== "string") {
            throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
        }
        return {
            eventId: event.eventId,
            eventStatus: event.eventStatus,
            currentWorkingVersionId: event.currentWorkingVersionId ?? null,
            publishedVersionId: event.publishedVersionId ?? null,
            workingVersion: event.workingVersion || null,
            publishedVersion: event.publishedVersion || null
        };
    }

    function errorForStatus(status, payload, response) {
        const messages = {
            401: ["UNAUTHORIZED", "Credencial administrativa invalida."],
            403: ["FORBIDDEN", "Acceso administrativo rechazado."],
            404: ["EVENT_NOT_FOUND", "Evento no encontrado."],
            409: ["VERSION_CONFLICT", "El estado de la version cambio. Actualiza e intenta nuevamente."],
            410: ["TOKEN_EXPIRED", "La vista previa ha expirado."],
            422: ["INVALID_EVENT", "El contenido del evento no es valido."],
            429: ["RATE_LIMITED", "Se alcanzo el limite de solicitudes."],
            503: ["RATE_LIMIT_UNAVAILABLE", "El servicio editorial no esta disponible."],
            500: ["SERVER_ERROR", "Error del servidor administrativo."]
        };
        const [fallbackCode, message] = messages[status]
            || (status >= 500
                ? ["SERVER_ERROR", "Error del servidor administrativo."]
                : ["REQUEST_ERROR", "No se pudo consultar el evento administrativo."]);
        const remoteCode = payload?.error?.code;
        const code = typeof remoteCode === "string" && remoteCode ? remoteCode : fallbackCode;
        const retryAfter = status === 429 && response?.headers?.get
            ? response.headers.get("Retry-After") || undefined
            : undefined;
        return new AdminEditorialApiError(code, message, status, { retryAfter });
    }

    function createAdminEditorialClient({ fetchImpl = globalThis.fetch } = {}) {
        if (typeof fetchImpl !== "function") {
            throw new TypeError("fetchImpl must be a function.");
        }

        async function getEditorialState({ eventId, password } = {}) {
            if (typeof eventId !== "string" || eventId.trim() === "") {
                throw new AdminEditorialApiError("INVALID_REQUEST", "Debe indicar un ID de evento.");
            }
            if (typeof password !== "string" || password === "") {
                throw new AdminEditorialApiError("UNAUTHORIZED", "Credencial administrativa invalida.");
            }

            let response;
            try {
                response = await fetchImpl(`/api/admin/eventos/${encodeURIComponent(eventId.trim())}`, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "X-Admin-Password": password
                    }
                });
            } catch {
                throw new AdminEditorialApiError("NETWORK_ERROR", "No se pudo consultar el evento administrativo.");
            }

            if (!response || typeof response.ok !== "boolean") {
                throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            }
            if (!response.ok) {
                const payload = await parseJson(response);
                throw errorForStatus(response.status, payload, response);
            }
            return normalizeEditorialState(await parseJson(response));
        }

        async function listEvents({ password, limit = 50, cursor } = {}) {
            if (typeof password !== "string" || password === "") throw new AdminEditorialApiError("UNAUTHORIZED", "Credencial administrativa invalida.");
            const params = new URLSearchParams({ limit: String(limit) });
            if (cursor) params.set("cursor", cursor);
            let response;
            try {
                response = await fetchImpl(`/api/admin/eventos?${params}`, {
                    method: "GET", headers: { Accept: "application/json", "X-Admin-Password": password }
                });
            } catch { throw new AdminEditorialApiError("NETWORK_ERROR", "No se pudo consultar los eventos administrativos."); }
            if (!response || typeof response.ok !== "boolean") throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            if (!response.ok) { const payload = await parseJson(response); throw errorForStatus(response.status, payload, response); }
            const payload = await parseJson(response);
            if (!payload || !Array.isArray(payload.events)) throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            return { events: payload.events.map(normalizeEventSummary), nextCursor: payload.nextCursor ?? null };
        }

        async function getVersion({ eventId, versionId, password } = {}) {
            if (!eventId || !versionId) throw new AdminEditorialApiError("INVALID_REQUEST", "Debe indicar evento y version.");
            if (typeof password !== "string" || password === "") throw new AdminEditorialApiError("UNAUTHORIZED", "Credencial administrativa invalida.");
            let response;
            try {
                response = await fetchImpl(
                    `/api/admin/eventos/${encodeURIComponent(eventId)}/versions/${encodeURIComponent(versionId)}`,
                    {
                        method: "GET",
                        headers: { Accept: "application/json", "X-Admin-Password": password }
                    }
                );
            } catch {
                throw new AdminEditorialApiError("NETWORK_ERROR", "No se pudo obtener el snapshot de la version.");
            }
            if (!response || typeof response.ok !== "boolean") throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            const payload = await parseJson(response);
            if (!response.ok) throw errorForStatus(response.status, payload, response);
            if (!payload || payload.eventId !== eventId || payload.versionId !== versionId || !isPlainObject(payload.content)) {
                throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta de version invalida.");
            }
            return payload;
        }

        async function createVersion({ eventId, content, expectedWorkingVersionId, sourceVersionId, password } = {}) {
            if (!eventId || !sourceVersionId || !isPlainObject(content)) {
                throw new AdminEditorialApiError("INVALID_REQUEST", "Debe indicar evento, fuente y contenido.");
            }
            if (expectedWorkingVersionId !== null && typeof expectedWorkingVersionId !== "string") {
                throw new AdminEditorialApiError("INVALID_REQUEST", "La version de trabajo observada es invalida.");
            }
            if (typeof password !== "string" || password === "") throw new AdminEditorialApiError("UNAUTHORIZED", "Credencial administrativa invalida.");
            let response;
            try {
                response = await fetchImpl(`/api/admin/eventos/${encodeURIComponent(eventId)}/versions`, {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "X-Admin-Password": password
                    },
                    body: JSON.stringify({
                        content,
                        sourceVersionId,
                        expectedWorkingVersionId,
                        initialWorkflow: "draft"
                    })
                });
            } catch {
                throw new AdminEditorialApiError("NETWORK_ERROR", "No se pudo crear la version de trabajo.");
            }
            if (!response || typeof response.ok !== "boolean") throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            const payload = await parseJson(response);
            if (!response.ok) throw errorForStatus(response.status, payload, response);
            if (!payload || typeof payload.versionId !== "string" || typeof payload.versionNumber !== "number") {
                throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta de creacion invalida.");
            }
            return { versionId: payload.versionId, versionNumber: payload.versionNumber };
        }

        async function requestPreview({ eventId, versionId, password } = {}) {
            if (!eventId || !versionId) throw new AdminEditorialApiError("INVALID_REQUEST", "Debe indicar evento y version.");
            if (typeof password !== "string" || password === "") throw new AdminEditorialApiError("UNAUTHORIZED", "Credencial administrativa invalida.");
            let response;
            try {
                response = await fetchImpl(`/api/admin/eventos/${encodeURIComponent(eventId)}/versions/${encodeURIComponent(versionId)}/preview`, {
                    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-Admin-Password": password }, body: "{}"
                });
            } catch { throw new AdminEditorialApiError("NETWORK_ERROR", "No se pudo solicitar la vista previa."); }
            if (!response || typeof response.ok !== "boolean") throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            if (!response.ok) { const payload = await parseJson(response); throw errorForStatus(response.status, payload, response); }
            const payload = await parseJson(response);
            if (!payload || typeof payload.previewUrl !== "string" || typeof payload.expiresAt !== "string") throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta de preview invalida.");
            return payload;
        }

        async function sendWorkflowRequest({ eventId, versionId, password, pathSuffix, body } = {}) {
            if (!eventId || !versionId) throw new AdminEditorialApiError("INVALID_REQUEST", "Debe indicar evento y version.");
            if (typeof password !== "string" || password === "") throw new AdminEditorialApiError("UNAUTHORIZED", "Credencial administrativa invalida.");
            let response;
            try {
                response = await fetchImpl(
                    `/api/admin/eventos/${encodeURIComponent(eventId)}/versions/${encodeURIComponent(versionId)}/${pathSuffix}`,
                    {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            "X-Admin-Password": password,
                            ...(body ? { "Content-Type": "application/json" } : {})
                        },
                        ...(body ? { body: JSON.stringify(body) } : {})
                    }
                );
            } catch {
                throw new AdminEditorialApiError("NETWORK_ERROR", "No se pudo completar la operacion editorial.");
            }
            if (!response || typeof response.ok !== "boolean") throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            const payload = await parseJson(response);
            if (!response.ok) throw errorForStatus(response.status, payload, response);
            if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AdminEditorialApiError("INVALID_RESPONSE", "Respuesta administrativa invalida.");
            return payload;
        }

        function transitionWorkflow({ eventId, versionId, expectedStatus, targetStatus, password } = {}) {
            if (!expectedStatus || !targetStatus) throw new AdminEditorialApiError("INVALID_REQUEST", "Debe indicar la transicion editorial.");
            return sendWorkflowRequest({
                eventId,
                versionId,
                password,
                pathSuffix: "workflow",
                body: { expectedStatus, targetStatus }
            });
        }

        function publishVersion({ eventId, versionId, password } = {}) {
            return sendWorkflowRequest({ eventId, versionId, password, pathSuffix: "publish" });
        }

        return { getEditorialState, listEvents, getVersion, createVersion, requestPreview, transitionWorkflow, publishVersion };
    }

    function workingVersionSource(state) {
        if (!state || state.eventStatus !== "active") return null;
        return state.currentWorkingVersionId || state.publishedVersionId || null;
    }

    function sameCreationState(left, right) {
        return Boolean(left && right
            && left.eventId === right.eventId
            && left.eventStatus === right.eventStatus
            && left.currentWorkingVersionId === right.currentWorkingVersionId
            && left.publishedVersionId === right.publishedVersionId);
    }

    function createWorkingVersionRunner({ client, confirmCreation } = {}) {
        if (!client || typeof client.getVersion !== "function"
            || typeof client.getEditorialState !== "function"
            || typeof client.createVersion !== "function") {
            throw new TypeError("client must implement the working-version contract.");
        }
        if (typeof confirmCreation !== "function") throw new TypeError("confirmCreation must be a function.");

        let pending = false;
        const recoveryEventIds = new Set();

        async function refreshAfterConflict(error, eventId, password) {
            try {
                const state = await client.getEditorialState({ eventId, password });
                return { outcome: "conflict", state, error };
            } catch (refreshError) {
                return { outcome: "conflict-refresh-failed", error, refreshError };
            }
        }

        async function run({ observedState, password, isCurrent = () => true } = {}) {
            if (pending) return { outcome: "busy" };
            const sourceVersionId = workingVersionSource(observedState);
            if (!sourceVersionId) return { outcome: "unavailable" };
            const eventId = observedState.eventId;
            if (recoveryEventIds.has(eventId)) return { outcome: "refresh-required" };
            const expectedWorkingVersionId = observedState.currentWorkingVersionId;
            pending = true;
            try {
                const source = await client.getVersion({ eventId, versionId: sourceVersionId, password });
                if (!isCurrent()) return { outcome: "stale-view" };

                const stateBeforeConfirmation = await client.getEditorialState({ eventId, password });
                if (!isCurrent()) return { outcome: "stale-view" };
                if (!sameCreationState(observedState, stateBeforeConfirmation)) {
                    return { outcome: "stale", state: stateBeforeConfirmation };
                }

                const confirmed = await confirmCreation({
                    eventId,
                    sourceVersionId,
                    sourceVersionNumber: source.versionNumber,
                    expectedWorkingVersionId,
                    replacesWorkingVersion: expectedWorkingVersionId !== null
                });
                if (!confirmed) return { outcome: "cancelled", state: stateBeforeConfirmation };
                if (!isCurrent()) return { outcome: "stale-view" };

                const stateBeforePost = await client.getEditorialState({ eventId, password });
                if (!isCurrent()) return { outcome: "stale-view" };
                if (!sameCreationState(observedState, stateBeforePost)) {
                    return { outcome: "stale", state: stateBeforePost };
                }

                let created;
                try {
                    created = await client.createVersion({
                        eventId,
                        content: source.content,
                        sourceVersionId,
                        expectedWorkingVersionId,
                        password
                    });
                } catch (error) {
                    if (error?.status === 409) return await refreshAfterConflict(error, eventId, password);
                    if (error?.code === "NETWORK_ERROR" && error?.status === undefined) {
                        recoveryEventIds.add(eventId);
                        return { outcome: "mutation-unknown", error, sourceVersionId };
                    }
                    throw error;
                }

                try {
                    const state = await client.getEditorialState({ eventId, password });
                    return { outcome: "success", state, created, sourceVersionId };
                } catch (refreshError) {
                    recoveryEventIds.add(eventId);
                    return { outcome: "accepted-refresh-failed", created, sourceVersionId, refreshError };
                }
            } finally {
                pending = false;
            }
        }

        async function refresh({ eventId, password, isCurrent = () => true } = {}) {
            const state = await client.getEditorialState({ eventId, password });
            if (isCurrent()) recoveryEventIds.delete(eventId);
            return state;
        }

        return {
            run,
            refresh,
            isPending: () => pending,
            requiresRefresh: (eventId) => recoveryEventIds.has(eventId)
        };
    }

    return {
        AdminEditorialApiError,
        createAdminEditorialClient,
        createWorkingVersionRunner,
        workingVersionSource,
        normalizeEditorialState
    };
});
