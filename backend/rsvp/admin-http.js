"use strict";

const { RsvpError, toHttpError } = require("./errors");
const { sendAccessFailure } = require("../http/admin-access");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const uuid = (value) => typeof value === "string" && value.length === 36 && UUID.test(value);
const ROUTES = Object.freeze([
    ["GET", /^\/configuration\/?$/, "readConfiguration", "/configuration"],
    ["POST", /^\/configuration\/?$/, "syncConfiguration", "/configuration"],
    ["GET", /^\/invitations\/?$/, "list", "/invitations"],
    ["POST", /^\/invitations\/?$/, "createInvitation", "/invitations"],
    ["PATCH", /^\/invitations\/([^/]+)\/name\/?$/, "correctName", "/invitations/:invitationId/name"],
    ["PATCH", /^\/invitations\/([^/]+)\/response\/?$/, "correctResponse", "/invitations/:invitationId/response"],
    ["PATCH", /^\/invitations\/([^/]+)\/capacity\/?$/, "correctCapacity", "/invitations/:invitationId/capacity"],
    ["POST", /^\/invitations\/([^/]+)\/revoke\/?$/, "revoke", "/invitations/:invitationId/revoke"],
    ["POST", /^\/invitations\/([^/]+)\/rotate\/?$/, "rotate", "/invitations/:invitationId/rotate"],
    ["DELETE", /^\/invitations\/([^/]+)\/?$/, "deleteInvitation", "/invitations/:invitationId"],
    ["GET", /^\/aggregate\/?$/, "aggregate", "/aggregate"],
    ["GET", /^\/audit\/?$/, "auditList", "/audit"]
]);

function invalid() { throw new RsvpError("RSVP_INVALID_PAYLOAD"); }
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
    return res.end(JSON.stringify(body));
}
function failure(res, error) {
    const result = toHttpError(error);
    return send(res, result.status, result.body);
}
function pick(value, fields) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new RsvpError("RSVP_INTERNAL_ERROR");
    return Object.fromEntries(fields.filter((key) => Object.prototype.hasOwnProperty.call(value, key)).map((key) => [key, value[key]]));
}
function table(value, fields) {
    if (!Array.isArray(value)) throw new RsvpError("RSVP_INTERNAL_ERROR");
    return value.map((row) => pick(row, fields));
}
function shape(body, fields) {
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== fields.length
        || !fields.every((key) => Object.prototype.hasOwnProperty.call(body, key))) invalid();
    return pick(body, fields);
}
function name(value) {
    if (typeof value !== "string" || Array.from(value.trim()).length < 1 || Array.from(value.trim()).length > 120) invalid();
}
function capacity(body) {
    if (!["individual", "group"].includes(body.invitationType) || !positive(body.maxAttendees) || body.maxAttendees > 20
        || (body.invitationType === "individual" && body.maxAttendees !== 1)) invalid();
}
function bodyFor(operation, body) {
    const fields = {
        syncConfiguration: [], createInvitation: ["displayName", "invitationType", "maxAttendees", "requestId"],
        correctName: ["displayName", "expectedRevision"], correctResponse: ["status", "attendeeCount", "expectedRevision"],
        correctCapacity: ["invitationType", "maxAttendees", "expectedRevision"],
        revoke: ["expectedRevision"], rotate: ["expectedRevision"], deleteInvitation: ["expectedRevision"]
    }[operation];
    const result = shape(body, fields);
    if (fields.includes("expectedRevision") && !positive(result.expectedRevision)) invalid();
    if (fields.includes("displayName")) name(result.displayName);
    if (fields.includes("invitationType")) capacity(result);
    if (operation === "createInvitation" && !uuid(result.requestId)) invalid();
    if (operation === "correctResponse" && (!["attending", "not_attending"].includes(result.status)
        || !Number.isSafeInteger(result.attendeeCount) || result.attendeeCount < 0 || result.attendeeCount > 2147483647
        || (result.status === "attending" ? result.attendeeCount < 1 : result.attendeeCount !== 0))) invalid();
    return result;
}
function page(query, list) {
    const allowed = list ? ["limit", "afterId"] : ["limit"];
    if (Object.keys(query).some((key) => !allowed.includes(key))) invalid();
    const result = {};
    if (query.limit !== undefined) {
        if (typeof query.limit !== "string" || !/^\d{1,3}$/.test(query.limit)) invalid();
        result.limit = Number(query.limit);
        if (!positive(result.limit) || result.limit > 200) invalid();
    }
    if (list && query.afterId !== undefined) {
        if (!uuid(query.afterId)) invalid();
        result.afterId = query.afterId;
    }
    return result;
}
function dto(operation, result) {
    switch (operation) {
        case "readConfiguration":
            if (result?.configured === false) throw new RsvpError("MANAGED_CONFIG_NOT_FOUND");
            return pick(result, ["eventId", "eventStatus", "configured", "revision", "timezone", "eventAt", "deadlineAt", "purgeDueAt", "purged"]);
        case "syncConfiguration": return pick(result, ["revision", "sourceVersionId"]);
        case "list": return table(result, ["invitation_id", "display_name", "invitation_type", "max_attendees", "revoked", "revision", "response_status", "attendee_count"]);
        case "createInvitation": {
            if (typeof result?.created !== "boolean") throw new RsvpError("RSVP_INTERNAL_ERROR");
            if (result.created && typeof result.token !== "string") throw new RsvpError("RSVP_INTERNAL_ERROR");
            return pick(result, result.created ? ["invitationId", "revision", "created", "token"] : ["invitationId", "revision", "created"]);
        }
        case "rotate":
            if (typeof result?.token !== "string") throw new RsvpError("RSVP_INTERNAL_ERROR");
            return pick(result, ["revision", "changed", "revoked", "token"]);
        case "deleteInvitation": return pick(result, ["deleted"]);
        case "correctName": return pick(result, ["invitationId", "revision", "changed"]);
        case "correctCapacity": return pick(result, ["revision", "changed", "type", "maxAttendees"]);
        case "aggregate": return table(result, ["event_id", "invitation_count", "attending_count", "not_attending_count", "unanswered_count", "attendee_count", "materialized_at"]);
        case "auditList": return table(result, ["audit_id", "occurred_at", "action", "actor_class"]);
        default: return pick(result, ["revision", "changed", "revoked"]);
    }
}

function createRsvpAdminHttp({ service, adminAccess, express }) {
    if (!service || ROUTES.some((route) => typeof service[route[2]] !== "function")
        || typeof adminAccess?.authorize !== "function" || typeof express?.json !== "function") throw new TypeError("Existing RSVP service and admin access are required.");
    const parse = express.json({ limit: 2048, inflate: false, strict: true, type: "application/json" });
    async function handle(req, res, next) {
        const suffix = req.url.split("?")[0];
        const route = ROUTES.find((entry) => entry[0] === req.method && entry[1].test(suffix));
        if (!route) return next();
        privacy(res);
        try {
            const [method, pattern, operation, logicalPath] = route;
            const mutate = method !== "GET";
            // Sync explicitly requires password first. Other mutations retain
            // the editorial origin-first order, using the same access object.
            const access = await adminAccess.authorize(req, { mutate,
                endpoint: `${method} /api/admin/eventos/:eventId/rsvp${logicalPath}`,
                action: operation, originFirst: operation !== "syncConfiguration" });
            if (!access.ok) {
                // Preserve the shared access response without Express ETags.
                return sendAccessFailure({ setHeader: res.setHeader.bind(res),
                    status: (status) => ({ json: (body) => send(res, status, body) }) }, access);
            }
            const eventId = req.params?.eventId;
            if (typeof eventId !== "string" || eventId.length > 128 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventId)) invalid();
            const options = { eventId };
            const match = pattern.exec(suffix);
            if (match[1]) {
                let invitationId;
                try { invitationId = decodeURIComponent(match[1]); } catch (_error) { invalid(); }
                if (!uuid(invitationId)) invalid();
                options.invitationId = invitationId;
            }
            if (mutate) {
                if (!req.is("application/json")) invalid();
                await new Promise((resolve, reject) => parse(req, res, (error) => error
                    ? reject(new RsvpError("RSVP_INVALID_PAYLOAD")) : resolve()));
                Object.assign(options, bodyFor(operation, req.body));
            } else if (operation === "list" || operation === "auditList") {
                Object.assign(options, page(req.query || {}, operation === "list"));
            }
            const result = await service[operation](options);
            return send(res, operation === "createInvitation" && result.created === true ? 201 : 200, dto(operation, result));
        } catch (error) { return failure(res, error); }
    }
    function errorHandler(error, req, res, next) {
        if (/^\/api\/admin\/eventos\/[^/]+\/rsvp(?:\/|\?|$)/.test(req.url)) {
            return failure(res, new RsvpError("RSVP_INVALID_PAYLOAD"));
        }
        return next(error);
    }
    return Object.freeze({ handle, errorHandler });
}

module.exports = { createRsvpAdminHttp };
