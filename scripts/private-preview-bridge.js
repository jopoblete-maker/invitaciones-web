const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-?$/;
const VERSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREVIEW_PATH_PATTERN = /^\/api\/preview\/eventos\/([^/]+)\/versions\/([^/]+)$/;

function sendJson(res, status, body) {
    const content = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(content),
        "Cache-Control": "no-store"
    });
    res.end(content);
}

function safeError(status, code, message) {
    return { status, body: { error: { code, message } } };
}

function parseApiBaseUrl(value) {
    if (typeof value !== "string" || value.trim() === "") return null;
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
}

function isLoopbackAddress(address) {
    return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
}

function createPrivatePreviewBridge({ apiBaseUrl, adminPassword, fetchImpl = globalThis.fetch } = {}) {
    const baseUrl = parseApiBaseUrl(apiBaseUrl);

    function matches(pathname) {
        return PREVIEW_PATH_PATTERN.test(pathname);
    }

    async function handle(req, res, pathname) {
        const match = pathname.match(PREVIEW_PATH_PATTERN);
        if (!match) return false;

        if ((req.method || "GET") !== "GET") {
            sendJson(res, 405, {
                error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }
            });
            return true;
        }

        const remoteAddress = req.socket?.remoteAddress;
        if (remoteAddress && !isLoopbackAddress(remoteAddress)) {
            sendJson(res, 403, {
                error: { code: "PREVIEW_LOCAL_ONLY", message: "Private preview is local only." }
            });
            return true;
        }

        const eventId = match[1];
        const versionId = match[2];
        if (!EVENT_ID_PATTERN.test(eventId) || !VERSION_ID_PATTERN.test(versionId)) {
            sendJson(res, 400, {
                error: { code: "INVALID_PREVIEW_REQUEST", message: "Invalid preview request." }
            });
            return true;
        }

        if (!baseUrl || typeof adminPassword !== "string" || adminPassword === ""
            || typeof fetchImpl !== "function") {
            const error = safeError(
                503,
                "PREVIEW_NOT_CONFIGURED",
                "Private preview is not configured."
            );
            sendJson(res, error.status, error.body);
            return true;
        }

        const backendUrl = new URL(
            `/api/admin/eventos/${encodeURIComponent(eventId)}/versions/${encodeURIComponent(versionId)}`,
            baseUrl
        );

        try {
            const backendResponse = await fetchImpl(backendUrl, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "X-Admin-Password": adminPassword
                },
                cache: "no-store"
            });

            if (!backendResponse.ok) {
                const status = [401, 404, 409].includes(backendResponse.status)
                    ? backendResponse.status
                    : backendResponse.status >= 500 ? 500 : 502;
                const error = safeError(
                    status,
                    `PREVIEW_BACKEND_${status}`,
                    "Private preview could not be loaded."
                );
                sendJson(res, error.status, error.body);
                return true;
            }

            const payload = await backendResponse.json();
            const validPayload = payload
                && payload.eventId === eventId
                && payload.versionId === versionId
                && payload.content
                && typeof payload.content === "object"
                && !Array.isArray(payload.content);
            if (!validPayload) {
                const error = safeError(
                    502,
                    "INVALID_PREVIEW_RESPONSE",
                    "Private preview returned an invalid response."
                );
                sendJson(res, error.status, error.body);
                return true;
            }

            sendJson(res, 200, payload.content);
            return true;
        } catch {
            const error = safeError(
                502,
                "PREVIEW_BACKEND_UNAVAILABLE",
                "Private preview backend is unavailable."
            );
            sendJson(res, error.status, error.body);
            return true;
        }
    }

    return { matches, handle };
}

module.exports = { createPrivatePreviewBridge };
