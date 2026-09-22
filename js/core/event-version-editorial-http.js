(function (root, factory) {
    const http = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = http;
    }

    root.EventVersionEditorialHttp = http;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const STATUS_BY_CODE = Object.freeze({
        INVALID_REQUEST: 400,
        INVALID_EVENT_ID: 400,
        EVENT_ALREADY_EXISTS: 409,
        EVENT_NOT_FOUND: 404,
        VERSION_NOT_FOUND: 404,
        VERSION_EVENT_MISMATCH: 404,
        VERSION_CONFLICT: 409,
        INVALID_WORKFLOW: 409,
        EVENT_ARCHIVED: 409,
        INVALID_EVENT: 422,
        RATE_LIMIT_UNAVAILABLE: 503,
        RATE_LIMITED: 429,
        PREVIEW_NOT_CONFIGURED: 503,
        INVALID_CURSOR: 400,
        CURSOR_NOT_CONFIGURED: 503
    });

    const MESSAGE_BY_CODE = Object.freeze({
        INVALID_REQUEST: "Invalid request.",
        INVALID_EVENT_ID: "Event id is invalid.",
        EVENT_ALREADY_EXISTS: "Event already exists.",
        EVENT_NOT_FOUND: "Event not found.",
        VERSION_NOT_FOUND: "Version not found.",
        VERSION_EVENT_MISMATCH: "Version not found.",
        VERSION_CONFLICT: "The working version changed.",
        INVALID_WORKFLOW: "The workflow operation is not allowed.",
        EVENT_ARCHIVED: "Event is archived.",
        INVALID_EVENT: "Event content is invalid.",
        RATE_LIMIT_UNAVAILABLE: "Rate limit service unavailable.",
        RATE_LIMITED: "Too many requests."
    });

    function createEventVersionEditorialHttp({ service, readRepository, adminPassword, originPolicy, rateLimiter, issuePreviewToken, previewTtlSeconds = 300 }) {
        if (!service || !readRepository) {
            throw new TypeError("service and readRepository are required.");
        }
        if (typeof adminPassword !== "string" || adminPassword === "") {
            throw new TypeError("adminPassword is required.");
        }
        if (!originPolicy || typeof originPolicy.validateRequest !== "function") {
            throw new TypeError("originPolicy is required.");
        }
        if (!rateLimiter || typeof rateLimiter.consume !== "function") {
            throw new TypeError("rateLimiter is required.");
        }

        function requestPassword(req) {
            if (req && typeof req.get === "function") {
                return req.get("X-Admin-Password");
            }
            return req?.headers?.["x-admin-password"];
        }

        function sendError(res, error) {
            const status = STATUS_BY_CODE[error?.code] || 500;
            const code = STATUS_BY_CODE[error?.code] ? error.code : "INTERNAL_ERROR";
            const message = MESSAGE_BY_CODE[code] || "Unexpected server error.";
            return res.status(status).json({ error: { code, message } });
        }

        function protect(handler, { mutate = false, endpoint, action } = {}) {
            return async function protectedEditorialHandler(req, res) {
                let validatedOrigin = null;
                if (mutate) {
                    const origin = originPolicy.validateRequest(req);
                    if (!origin.ok) {
                        return res.status(403).json({
                            error: { code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed." }
                        });
                    }
                    validatedOrigin = origin.origin;
                }
                if (requestPassword(req) !== adminPassword) {
                    return res.status(401).json({
                        error: { code: "UNAUTHORIZED", message: "Unauthorized." }
                    });
                }
                try {
                    if (mutate) {
                        const rate = await rateLimiter.consume({
                            origin: validatedOrigin,
                            endpoint,
                            action: typeof action === "function" ? action(req) : action
                        });
                        if (!rate.allowed) {
                            res.setHeader("Retry-After", String(rate.retryAfterSeconds));
                            return res.status(429).json({
                                error: { code: "RATE_LIMITED", message: "Too many requests." }
                            });
                        }
                    }
                    return await handler(req, res, validatedOrigin);
                } catch (error) {
                    return sendError(res, error);
                }
            };
        }

        const getEditorialState = protect(async (req, res) => {
            const result = await readRepository.getEditorialState(req.params.eventId);
            return res.status(200).json(result);
        });

        const listEvents = protect(async (req, res) => {
            const result = await readRepository.listEvents({
                limit: req.query?.limit,
                cursor: req.query?.cursor
            });
            return res.status(200).json(result);
        });

        const requestPreview = protect(async (req, res) => {
            if (typeof issuePreviewToken !== "function") {
                const error = new Error("Preview is not configured.");
                error.code = "PREVIEW_NOT_CONFIGURED";
                throw error;
            }
            const { eventId, versionId } = req.params;
            const state = await readRepository.getEditorialState(eventId);
            if (state.eventStatus === "archived") {
                const error = new Error("Event is archived.");
                error.code = "EVENT_ARCHIVED";
                throw error;
            }
            await readRepository.getVersion(eventId, versionId);
            const token = issuePreviewToken({ eventId, versionId, ttlSeconds: previewTtlSeconds });
            return res.status(200).json({
                previewUrl: `/api/preview?token=${encodeURIComponent(token.token)}`,
                expiresAt: token.expiresAt,
                eventId,
                versionId
            });
        });

        const createEvent = protect(async (req, res) => {
            const body = req.body || {};
            const result = await service.createEvent({
                eventId: body.eventId,
                content: body.content
            });
            return res.status(201).json(result);
        });

        const createVersion = protect(async (req, res, origin) => {
            const body = req.body || {};
            const options = {
                eventId: req.params.eventId,
                content: body.content,
                sourceVersionId: body.sourceVersionId,
                initialWorkflow: body.initialWorkflow,
                adminIdentity: "shared-admin-credential",
                origin
            };
            if (Object.prototype.hasOwnProperty.call(body, "expectedWorkingVersionId")) {
                options.expectedWorkingVersionId = body.expectedWorkingVersionId;
            }
            const result = await service.createVersion(options);
            return res.status(201).json(result);
        }, { mutate: true, endpoint: "POST /api/admin/eventos/:eventId/versions", action: "CREATE_VERSION" });

        const getVersion = protect(async (req, res) => {
            const result = await readRepository.getVersion(
                req.params.eventId,
                req.params.versionId
            );
            return res.status(200).json(result);
        });

        const transitionWorkflow = protect(async (req, res, origin) => {
            const body = req.body || {};
            const result = await service.transitionWorkflow({
                eventId: req.params.eventId,
                versionId: req.params.versionId,
                expectedStatus: body.expectedStatus,
                targetStatus: body.targetStatus,
                adminIdentity: "shared-admin-credential",
                origin
            });
            return res.status(200).json(result);
        }, {
            mutate: true,
            endpoint: "POST /api/admin/eventos/:eventId/versions/:versionId/workflow",
            action: (req) => req.body?.targetStatus === "approved" && req.body?.expectedStatus === "in_review"
                ? "APPROVE_VERSION" : "CHANGE_WORKFLOW"
        });

        const publishVersion = protect(async (req, res, origin) => {
            const result = await service.publishVersion({
                eventId: req.params.eventId,
                versionId: req.params.versionId,
                adminIdentity: "shared-admin-credential",
                origin
            });
            return res.status(200).json(result);
        }, { mutate: true, endpoint: "POST /api/admin/eventos/:eventId/versions/:versionId/publish", action: "PUBLISH_VERSION" });

        const rollbackVersion = protect(async (req, res) => {
            const result = await service.rollbackVersion({
                eventId: req.params.eventId,
                versionId: req.body?.versionId
            });
            return res.status(200).json(result);
        });

        return {
            createEvent,
            getEditorialState,
            listEvents,
            requestPreview,
            createVersion,
            getVersion,
            transitionWorkflow,
            publishVersion,
            rollbackVersion
        };
    }

    return { createEventVersionEditorialHttp };
});
