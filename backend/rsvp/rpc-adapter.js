"use strict";

const { RsvpError } = require("./errors");

const SQL_ERRORS = Object.freeze({
    RSVP_NOT_AVAILABLE: "RSVP_NOT_AVAILABLE", RSVP_DEADLINE_CLOSED: "RSVP_DEADLINE_CLOSED",
    REVISION_CONFLICT: "RSVP_REVISION_CONFLICT", RSVP_EVENT_ARCHIVED: "RSVP_EVENT_ARCHIVED",
    RSVP_INVALID_PAYLOAD: "RSVP_INVALID_PAYLOAD", RSVP_ATTENDEE_LIMIT: "RSVP_ATTENDEE_COUNT_INVALID",
    INVALID_MANAGED_CONFIGURATION: "RSVP_CALENDAR_INVALID", INVALID_IANA_TIMEZONE: "RSVP_CALENDAR_INVALID",
    ADMIN_EVENT_NOT_ACTIVE: "ADMIN_EVENT_NOT_ACTIVE", PII_RETENTION_EXPIRED: "PII_RETENTION_EXPIRED",
    IDEMPOTENCY_KEY_CONSUMED: "IDEMPOTENCY_KEY_CONSUMED", ADMIN_INVITATION_NOT_FOUND: "ADMIN_INVITATION_NOT_FOUND",
    MANAGED_CONFIG_NOT_FOUND: "MANAGED_CONFIG_NOT_FOUND", ADMIN_EVENT_NOT_FOUND: "ADMIN_EVENT_NOT_FOUND",
    CAPACITY_BELOW_CURRENT_ATTENDANCE: "CAPACITY_BELOW_CURRENT_ATTENDANCE",
    INVALID_REQUEST_ID: "RSVP_INVALID_PAYLOAD", INVALID_PAGE_SIZE: "RSVP_INVALID_PAYLOAD",
    INVALID_INVITATION_PAYLOAD: "RSVP_INVALID_PAYLOAD", INVALID_DISPLAY_NAME: "RSVP_INVALID_PAYLOAD",
    INVALID_INVITATION_CAPACITY: "RSVP_INVALID_PAYLOAD"
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value) => typeof value === "string";
const bool = (value) => typeof value === "boolean";
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const revision = (value) => integer(value) && value > 0;
const uuid = (value) => text(value) && value.length === 36 && UUID.test(value);
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value));
const status = (value) => value === "attending" || value === "not_attending";
const type = (value) => value === "individual" || value === "group";
const capacity = (value) => integer(value) && value >= 1 && value <= 20;
const nullable = (test) => (value) => value === null || test(value);

function requireValue(condition) { if (!condition) throw new RsvpError("RSVP_INVALID_PAYLOAD"); }
function requireRequestId(value) { requireValue(uuid(value)); }
function bytea(value) {
    requireValue(Buffer.isBuffer(value) && value.length === 32);
    return "\\x" + value.toString("hex");
}
function object(data, fields, optional = {}) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new RsvpError("RSVP_INTERNAL_ERROR");
    const result = {};
    for (const [key, test] of Object.entries(fields)) {
        if (!Object.prototype.hasOwnProperty.call(data, key) || !test(data[key])) throw new RsvpError("RSVP_INTERNAL_ERROR");
        result[key] = data[key];
    }
    for (const [key, test] of Object.entries(optional)) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (!test(data[key])) throw new RsvpError("RSVP_INTERNAL_ERROR");
            result[key] = data[key];
        }
    }
    return result;
}
function rows(data, fields) {
    if (!Array.isArray(data)) throw new RsvpError("RSVP_INTERNAL_ERROR");
    return data.map((row) => object(row, fields));
}
function validAttendance(responseStatus, count, maxAttendees) {
    return integer(count) && count <= maxAttendees
        && ((responseStatus === "attending" && count >= 1) || (responseStatus === "not_attending" && count === 0));
}
function validInvitation(invitationType, maxAttendees) {
    return capacity(maxAttendees) && (invitationType !== "individual" || maxAttendees === 1);
}

function createRsvpRpcAdapter({ supabase, execute }) {
    if (!supabase || typeof supabase.rpc !== "function" || typeof execute !== "function") {
        throw new TypeError("An existing Supabase client and timeout executor are required.");
    }
    async function call(name, parameters, write, decode, publicOperation = false) {
        let response;
        try { response = await execute(supabase.rpc(name, parameters)); }
        catch (error) {
            throw new RsvpError(error?.code === "SUPABASE_TIMEOUT"
                ? (write ? "RSVP_WRITE_RESULT_UNKNOWN" : "UPSTREAM_TIMEOUT") : "RSVP_INTERNAL_ERROR");
        }
        if (response?.error) {
            const error = response.error;
            const code = error.code === "P0001" && Object.prototype.hasOwnProperty.call(SQL_ERRORS, error.message)
                ? SQL_ERRORS[error.message] : "RSVP_INTERNAL_ERROR";
            const publicCodes = ["RSVP_NOT_AVAILABLE", "RSVP_DEADLINE_CLOSED", "RSVP_REVISION_CONFLICT", "RSVP_EVENT_ARCHIVED", "RSVP_INVALID_PAYLOAD", "RSVP_ATTENDEE_COUNT_INVALID"];
            throw new RsvpError(publicOperation && !publicCodes.includes(code) ? "RSVP_INTERNAL_ERROR" : code);
        }
        if (!response || !Object.prototype.hasOwnProperty.call(response, "data")) throw new RsvpError("RSVP_INTERNAL_ERROR");
        return decode(response.data);
    }
    function event(eventId) { requireValue(text(eventId) && eventId.length <= 128 && eventId.trim() === eventId && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventId)); return { p_event_id: eventId }; }
    function invitation(options) {
        requireValue(uuid(options.invitationId) && revision(options.expectedRevision));
        return { ...event(options.eventId), p_invitation_id: options.invitationId, p_expected_revision: options.expectedRevision };
    }
    function responseFields(options) {
        requireValue(status(options.status) && integer(options.attendeeCount) && options.attendeeCount <= 2147483647);
        return { p_status: options.status, p_attendee_count: options.attendeeCount };
    }
    function limit(value, max) { requireValue(integer(value) && value >= 1 && value <= max); return value; }
    function mutation(options, action, extra = {}) {
        return call("rsvp_admin_mutate", {
            ...invitation(options), p_action: action, p_status: null, p_attendee_count: null, p_new_token_hash: null, ...extra
        }, true, (data) => action === "DELETE" ? object(data, { deleted: (value) => value === true })
            : object(data, { revision, changed: bool }, { revoked: bool }));
    }
    const adapter = {
        configure(options) {
            requireValue(integer(options.expectedRevision) && text(options.timezone) && timestamp(options.eventAt) && timestamp(options.deadlineAt));
            return call("rsvp_configure", { ...event(options.eventId), p_timezone: options.timezone,
                p_event_at: options.eventAt, p_deadline_at: options.deadlineAt, p_expected_revision: options.expectedRevision }, true,
            (data) => { if (!revision(data)) throw new RsvpError("RSVP_INTERNAL_ERROR"); return data; });
        },
        createInvitation(options) {
            requireRequestId(options.requestId);
            requireValue(text(options.displayName) && type(options.invitationType) && capacity(options.maxAttendees));
            return call("rsvp_create_invitation", { ...event(options.eventId), p_request_id: options.requestId,
                p_display_name: options.displayName, p_invitation_type: options.invitationType,
                p_max_attendees: options.maxAttendees, p_token_hash: bytea(options.tokenHash) }, true,
            (data) => object(data, { invitationId: uuid, revision, created: bool }));
        },
        publicRead(options) {
            return call("rsvp_public_read", { ...event(options.eventId), p_token_hash: bytea(options.tokenHash) }, false, (data) => {
                const result = object(data, { displayName: text, type, maxAttendees: capacity, revision, timezone: text, deadlineAt: timestamp, closed: bool,
                    response: (value) => value === null || Boolean(value && status(value.status) && integer(value.attendeeCount)) });
                if (result.response !== null) result.response = object(result.response, { status, attendeeCount: integer });
                if (!validInvitation(result.type, result.maxAttendees)
                    || (result.response !== null && !validAttendance(result.response.status, result.response.attendeeCount, result.maxAttendees))) throw new RsvpError("RSVP_INTERNAL_ERROR");
                return result;
            }, true);
        },
        publicRespond(options) {
            requireValue(revision(options.expectedRevision));
            return call("rsvp_public_respond", { ...event(options.eventId), p_token_hash: bytea(options.tokenHash),
                p_expected_revision: options.expectedRevision, ...responseFields(options) }, true,
            (data) => object(data, { revision, status, attendeeCount: integer }), true);
        },
        correctResponse(options) { return mutation(options, "CORRECT", responseFields(options)); },
        rotate(options) { return mutation(options, "ROTATE", { p_new_token_hash: bytea(options.tokenHash) }); },
        revoke(options) { return mutation(options, "REVOKE"); },
        deleteInvitation(options) { return mutation(options, "DELETE"); },
        correctCapacity(options) {
            requireValue(type(options.invitationType) && capacity(options.maxAttendees));
            return call("rsvp_admin_correct_capacity", { ...invitation(options), p_invitation_type: options.invitationType, p_max_attendees: options.maxAttendees }, true,
                (data) => {
                    const result = object(data, { revision, changed: bool }, { type, maxAttendees: capacity });
                    if (result.changed && (!type(result.type) || !validInvitation(result.type, result.maxAttendees))) throw new RsvpError("RSVP_INTERNAL_ERROR");
                    return result;
                });
        },
        list({ eventId, afterId = null, limit: pageSize = 50 }) {
            requireValue(afterId === null || uuid(afterId));
            return call("rsvp_admin_list", { ...event(eventId), p_after_id: afterId, p_limit: limit(pageSize, 200) }, false,
                (data) => rows(data, { invitation_id: uuid, display_name: text, invitation_type: type, max_attendees: capacity,
                    revoked: bool, revision, response_status: nullable(status), attendee_count: nullable(integer) }).map((row) => {
                    if (!validInvitation(row.invitation_type, row.max_attendees) || (row.response_status === null
                        ? row.attendee_count !== null : !validAttendance(row.response_status, row.attendee_count, row.max_attendees))) throw new RsvpError("RSVP_INTERNAL_ERROR");
                    return row;
                }));
        },
        purgeDue({ limit: batchSize = 50 } = {}) {
            return call("rsvp_purge_due", { p_limit: limit(batchSize, 100) }, true,
                (data) => { if (!integer(data) || data > batchSize) throw new RsvpError("RSVP_INTERNAL_ERROR"); return data; });
        },
        aggregate({ eventId }) {
            return call("rsvp_admin_aggregate", event(eventId), false, (data) => rows(data, { event_id: text,
                invitation_count: integer, attending_count: integer, not_attending_count: integer,
                unanswered_count: integer, attendee_count: integer, materialized_at: timestamp }));
        },
        auditList({ eventId, limit: pageSize = 50 }) {
            return call("rsvp_admin_audit_list", { ...event(eventId), p_limit: limit(pageSize, 200) }, false,
                (data) => rows(data, { audit_id: uuid, occurred_at: timestamp,
                    action: (value) => ["CONFIGURE", "CREATE", "CORRECT", "CORRECT_CAPACITY", "CORRECT_NAME", "ROTATE", "REVOKE", "DELETE", "PURGE"].includes(value),
                    actor_class: (value) => ["authenticated_admin", "retention_worker"].includes(value) }));
        },
        correctName(options) {
            requireValue(text(options.displayName));
            return call("rsvp_admin_correct_name", { ...invitation(options), p_display_name: options.displayName }, true,
                (data) => object(data, { invitationId: uuid, revision, changed: bool }));
        },
        readConfiguration({ eventId }) {
            return call("rsvp_admin_read_configuration", event(eventId), false, (data) => {
                const result = object(data, {
                eventId: text, eventStatus: (value) => value === "active" || value === "archived", configured: bool, revision: integer,
                timezone: nullable(text), eventAt: nullable(timestamp), deadlineAt: nullable(timestamp), purgeDueAt: nullable(timestamp), purged: bool
                });
                if (result.eventId !== eventId || (result.configured
                    ? !revision(result.revision) || [result.timezone, result.eventAt, result.deadlineAt, result.purgeDueAt].some((value) => value === null)
                    : result.revision !== 0 || result.purged || [result.timezone, result.eventAt, result.deadlineAt, result.purgeDueAt].some((value) => value !== null))) throw new RsvpError("RSVP_INTERNAL_ERROR");
                return result;
            });
        }
    };
    return Object.freeze(adapter);
}

module.exports = { createRsvpRpcAdapter, requireRequestId };
