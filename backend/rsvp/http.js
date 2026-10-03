"use strict";

const { RsvpError, toHttpError } = require("./errors");
const { readAuthorizationHash } = require("./token");
const { validEventId } = require("./public-rate-limit");
const PUBLIC_ERRORS = new Set(["RSVP_NOT_AVAILABLE", "RSVP_DEADLINE_CLOSED", "RSVP_REVISION_CONFLICT",
    "RSVP_EVENT_ARCHIVED", "RSVP_ATTENDEE_COUNT_INVALID", "RSVP_INVALID_PAYLOAD", "RSVP_RATE_LIMITED",
    "RSVP_RATE_LIMIT_UNAVAILABLE", "UPSTREAM_TIMEOUT", "RSVP_WRITE_RESULT_UNKNOWN", "RSVP_INTERNAL_ERROR"]);

function privacy(res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.removeHeader("ETag");
    res.removeHeader("Last-Modified");
}
function send(res, status, body) {
    privacy(res);
    res.status(status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    // Avoid Express's automatic ETag generation for sensitive responses.
    return res.end(JSON.stringify(body));
}
function failure(res, error) {
    const safe = error instanceof RsvpError && PUBLIC_ERRORS.has(error.code)
        ? error : new RsvpError("RSVP_INTERNAL_ERROR");
    const result = toHttpError(safe);
    return send(res, result.status, result.body);
}
function authorization(req) {
    readAuthorizationHash(req);
    for (let index = 0; index < req.rawHeaders.length; index += 2) {
        if (req.rawHeaders[index].toLowerCase() === "authorization") return req.rawHeaders[index + 1].slice(5);
    }
}
function payload(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== 3
        || !["status", "attendeeCount", "expectedRevision"].every((key) => Object.prototype.hasOwnProperty.call(body, key))
        || !["attending", "not_attending"].includes(body.status)
        || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1
        || !Number.isSafeInteger(body.attendeeCount) || body.attendeeCount < 0 || body.attendeeCount > 2147483647
        || (body.status === "attending" ? body.attendeeCount < 1 : body.attendeeCount !== 0)) {
        throw new RsvpError("RSVP_INVALID_PAYLOAD");
    }
    return { status: body.status, attendeeCount: body.attendeeCount, expectedRevision: body.expectedRevision };
}

function createRsvpPublicHttp({ service, limiter, express }) {
    if (typeof service?.publicRead !== "function" || typeof service?.publicRespond !== "function"
        || typeof limiter?.consume !== "function" || typeof express?.json !== "function") throw new TypeError("Public RSVP dependencies are required.");
    const parse = express.json({ limit: 2048, inflate: false, strict: true, type: "application/json" });
    async function handle(req, res, operation) {
        privacy(res);
        try {
            const eventId = req.params?.eventId;
            if (!validEventId(eventId)) throw new RsvpError("RSVP_NOT_AVAILABLE");
            let rate;
            try { rate = await limiter.consume({ eventId, operation }); }
            catch (_error) { throw new RsvpError("RSVP_RATE_LIMIT_UNAVAILABLE"); }
            if (!rate || typeof rate.allowed !== "boolean") throw new RsvpError("RSVP_RATE_LIMIT_UNAVAILABLE");
            if (!rate.allowed) {
                if (!Number.isSafeInteger(rate.retryAfterSeconds) || rate.retryAfterSeconds < 1 || rate.retryAfterSeconds > 86400) throw new RsvpError("RSVP_RATE_LIMIT_UNAVAILABLE");
                res.setHeader("Retry-After", String(rate.retryAfterSeconds));
                throw new RsvpError("RSVP_RATE_LIMITED");
            }
            const token = authorization(req);
            // Query parameters are ignored; Authorization is the only credential.
            if (operation === "GET") {
                const result = await service.publicRead({ eventId, token });
                const { displayName, type, maxAttendees, revision, timezone, deadlineAt, closed } = result;
                const response = result.response === null ? null
                    : { status: result.response.status, attendeeCount: result.response.attendeeCount };
                return send(res, 200, { displayName, type, maxAttendees, revision, timezone, deadlineAt, closed, response });
            }
            if (!req.is("application/json")) throw new RsvpError("RSVP_INVALID_PAYLOAD");
            await new Promise((resolve, reject) => parse(req, res, (error) => error
                ? reject(new RsvpError("RSVP_INVALID_PAYLOAD")) : resolve()));
            const result = await service.publicRespond({ eventId, token, ...payload(req.body) });
            return send(res, 200, { revision: result.revision, status: result.status, attendeeCount: result.attendeeCount });
        } catch (error) { return failure(res, error); }
    }
    // Route-parameter decoding happens before dispatch; isolate URI errors from
    // the generic parser/logger error handler for these two paths as well.
    function errorHandler(error, req, res, next) {
        if (["GET", "POST"].includes(req.method) && /^\/api\/eventos\/[^/]+\/rsvp\/?(?:\?|$)/.test(req.url)) {
            return failure(res, new RsvpError("RSVP_NOT_AVAILABLE"));
        }
        return next(error);
    }
    return Object.freeze({ get: (req, res) => handle(req, res, "GET"), post: (req, res) => handle(req, res, "POST"), errorHandler });
}

module.exports = { createRsvpPublicHttp };
