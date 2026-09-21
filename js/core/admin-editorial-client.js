(function (root, factory) {
    const client = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = client;
    }

    root.AdminEditorialClient = client;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    class AdminEditorialApiError extends Error {
        constructor(code, message, status) {
            super(message);
            this.name = "AdminEditorialApiError";
            this.code = code;
            if (status !== undefined) this.status = status;
        }
    }

    function parseJson(response) {
        return response.json().catch(() => null);
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

    function errorForStatus(status) {
        const messages = {
            401: ["UNAUTHORIZED", "Credencial administrativa invalida."],
            403: ["FORBIDDEN", "Acceso administrativo rechazado."],
            404: ["EVENT_NOT_FOUND", "Evento no encontrado."],
            500: ["SERVER_ERROR", "Error del servidor administrativo."]
        };
        const [code, message] = messages[status]
            || (status >= 500
                ? ["SERVER_ERROR", "Error del servidor administrativo."]
                : ["REQUEST_ERROR", "No se pudo consultar el evento administrativo."]);
        return new AdminEditorialApiError(code, message, status);
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
                await parseJson(response);
                throw errorForStatus(response.status);
            }
            return normalizeEditorialState(await parseJson(response));
        }

        return { getEditorialState };
    }

    return {
        AdminEditorialApiError,
        createAdminEditorialClient,
        normalizeEditorialState
    };
});
