"use strict";

const defaultToken = require("./token");
const { RsvpError } = require("./errors");
const { requireRequestId } = require("./rpc-adapter");

function createRsvpService({ adapter, context, token = defaultToken }) {
    const operations = ["readConfiguration", "configure", "list", "createInvitation", "correctName", "correctCapacity",
        "revoke", "rotate", "deleteInvitation", "publicRead", "publicRespond", "correctResponse", "aggregate", "auditList"];
    if (!adapter || operations.some((name) => typeof adapter[name] !== "function") || typeof context?.read !== "function"
        || typeof token.generateToken !== "function" || typeof token.hashToken !== "function") throw new TypeError("RSVP operational dependencies are required.");

    async function managed(eventId, active) {
        const current = await context.read(eventId);
        if (active && current.eventStatus !== "active") throw new RsvpError("ADMIN_EVENT_NOT_ACTIVE");
        if (["unpublished", "non-v2", "invalid-publication"].includes(current.kind)) throw new RsvpError("MANAGED_PUBLICATION_REQUIRED");
        if (current.kind !== "managed") throw new RsvpError("MANAGED_NOT_ENABLED");
        return current;
    }
    async function activeMutation(name, options) {
        await managed(options.eventId, true);
        return adapter[name](options);
    }
    async function publicOperation(name, options) {
        const tokenHash = token.hashToken(options.token);
        try { await managed(options.eventId, false); }
        catch (error) {
            if (error instanceof RsvpError && ["ADMIN_EVENT_NOT_FOUND", "MANAGED_PUBLICATION_REQUIRED", "MANAGED_NOT_ENABLED", "RSVP_CALENDAR_INVALID"].includes(error.code)) {
                throw new RsvpError("RSVP_NOT_AVAILABLE");
            }
            throw error;
        }
        // SQL validates token membership before archived/deadline errors.
        const { token: _plaintext, ...parameters } = options;
        return adapter[name]({ ...parameters, tokenHash });
    }
    return Object.freeze({
        readConfiguration: (options) => adapter.readConfiguration(options),
        async syncConfiguration({ eventId }) {
            const current = await managed(eventId, true);
            const settings = await adapter.readConfiguration({ eventId });
            const revision = await adapter.configure({ eventId, timezone: current.timezone, eventAt: current.eventAt,
                deadlineAt: current.deadlineAt, expectedRevision: settings.revision });
            return { revision, sourceVersionId: current.publishedVersionId };
        },
        list: (options) => adapter.list(options),
        async createInvitation(options) {
            requireRequestId(options.requestId);
            await managed(options.eventId, true);
            const generated = token.generateToken();
            const result = await adapter.createInvitation({ eventId: options.eventId, requestId: options.requestId,
                displayName: options.displayName, invitationType: options.invitationType, maxAttendees: options.maxAttendees, tokenHash: generated.tokenHash });
            return result.created ? { ...result, token: generated.token } : result;
        },
        correctName: (options) => activeMutation("correctName", options),
        correctCapacity: (options) => activeMutation("correctCapacity", options),
        correctResponse: (options) => activeMutation("correctResponse", options),
        revoke: (options) => activeMutation("revoke", options),
        async rotate(options) {
            await managed(options.eventId, true);
            const generated = token.generateToken();
            const result = await adapter.rotate({ eventId: options.eventId, invitationId: options.invitationId,
                expectedRevision: options.expectedRevision, tokenHash: generated.tokenHash });
            return { ...result, token: generated.token };
        },
        deleteInvitation: (options) => adapter.deleteInvitation(options),
        publicRead: (options) => publicOperation("publicRead", options),
        publicRespond: (options) => publicOperation("publicRespond", options),
        aggregate: (options) => adapter.aggregate(options),
        auditList: (options) => adapter.auditList(options)
    });
}

module.exports = { createRsvpService };
