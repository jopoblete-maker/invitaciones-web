class EditorialApiError extends Error {
    constructor(code, message, status) {
        super(message);
        this.name = "EditorialApiError";
        this.code = code;
        if (status !== undefined) this.status = status;
    }
}

function normalizeBaseUrl(value) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new EditorialApiError("CONFIG_ERROR", "YCOR_API_BASE_URL no esta configurada.");
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new EditorialApiError("CONFIG_ERROR", "YCOR_API_BASE_URL debe ser una URL valida.");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new EditorialApiError("CONFIG_ERROR", "YCOR_API_BASE_URL debe usar http o https.");
    }
    return url.toString().replace(/\/+$/, "");
}

function errorForResponse(status, payload) {
    const remoteCode = payload?.error?.code;
    const byStatus = {
        401: ["UNAUTHORIZED", "Credencial administrativa invalida."],
        404: ["EVENT_NOT_FOUND", "Evento inexistente."],
        409: remoteCode === "EVENT_ALREADY_EXISTS"
            ? ["EVENT_ALREADY_EXISTS", "El evento ya existe."]
            : [
                remoteCode === "EVENT_ARCHIVED" ? "EVENT_ARCHIVED" : "VERSION_CONFLICT",
                remoteCode === "EVENT_ARCHIVED"
                    ? "El evento esta archivado."
                    : "Conflicto de version: la version de trabajo cambio."
            ],
        422: ["INVALID_EVENT", "El evento no es valido."],
        500: ["BACKEND_ERROR", "Error interno del backend."]
    };
    const [code, message] = byStatus[status]
        || ["HTTP_ERROR", `La API editorial respondio HTTP ${status}.`];
    return new EditorialApiError(code, message, status);
}

async function parseJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function createEventEditorialApiClient({ baseUrl, adminPassword, fetchImpl = globalThis.fetch } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (typeof adminPassword !== "string" || adminPassword === "") {
        throw new EditorialApiError("CONFIG_ERROR", "YCOR_ADMIN_PASSWORD no esta configurada.");
    }
    if (typeof fetchImpl !== "function") {
        throw new EditorialApiError("CONFIG_ERROR", "fetch no esta disponible.");
    }

    async function request(pathname, options = {}) {
        let response;
        try {
            response = await fetchImpl(`${normalizedBaseUrl}${pathname}`, {
                ...options,
                headers: {
                    Accept: "application/json",
                    "X-Admin-Password": adminPassword,
                    ...(options.body ? { "Content-Type": "application/json" } : {})
                }
            });
        } catch {
            throw new EditorialApiError(
                "NETWORK_ERROR",
                "No se pudo conectar con la API editorial."
            );
        }

        const payload = await parseJson(response);
        if (!response.ok) throw errorForResponse(response.status, payload);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw new EditorialApiError("INVALID_RESPONSE", "Respuesta invalida de la API editorial.");
        }
        return payload;
    }

    function getEditorialState(eventId) {
        return request(`/api/admin/eventos/${encodeURIComponent(eventId)}`);
    }

    function createVersion(eventId, payload) {
        return request(`/api/admin/eventos/${encodeURIComponent(eventId)}/versions`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    function createEvent(eventId, content) {
        return request("/api/admin/eventos", {
            method: "POST",
            body: JSON.stringify({ eventId, content })
        });
    }

    return { getEditorialState, createVersion, createEvent };
}

module.exports = {
    EditorialApiError,
    createEventEditorialApiClient,
    normalizeBaseUrl
};
