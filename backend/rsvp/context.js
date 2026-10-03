"use strict";

const { validateEventForPersistence } = require("../../js/core/event-validator");
const { resolveManagedCalendar } = require("./calendar");
const { RsvpError } = require("./errors");

function createRsvpContext({ readRepository, validatePublishedContent = validateEventForPersistence, resolveCalendar = resolveManagedCalendar }) {
    if (!readRepository || typeof readRepository.getEditorialState !== "function" || typeof readRepository.getVersion !== "function") {
        throw new TypeError("An existing canonical read repository is required.");
    }
    async function read(eventId) {
        try {
            const state = await readRepository.getEditorialState(eventId);
            if (!state) throw new RsvpError("ADMIN_EVENT_NOT_FOUND");
            if (state.eventId !== eventId || !["active", "archived"].includes(state.eventStatus)) throw new RsvpError("RSVP_INTERNAL_ERROR");
            const base = { eventId, eventStatus: state.eventStatus, publishedVersionId: state.publishedVersionId || null };
            if (!base.publishedVersionId) return { ...base, kind: "unpublished" };
            const version = await readRepository.getVersion(eventId, base.publishedVersionId);
            if (!version || version.eventId !== eventId || version.versionId !== base.publishedVersionId) return { ...base, kind: "invalid-publication" };
            const content = version.content;
            if (!content || content.schema_version !== 2) return { ...base, kind: "non-v2" };
            if (content.id !== undefined && content.id !== eventId) return { ...base, kind: "invalid-publication" };
            const config = content.modules?.rsvp;
            const mode = config?.mode === undefined ? "whatsapp" : config.mode;
            if (mode === "managed" && config.enabled !== true) return { ...base, kind: "disabled", mode };
            const calendar = mode === "managed" ? resolveCalendar(content.schedule, config.deadline) : null;
            if (!validatePublishedContent(content)?.valid) return { ...base, kind: "invalid-publication" };
            if (!config) return { ...base, kind: "rsvp-absent", mode: "whatsapp" };
            if (mode === "whatsapp") return { ...base, kind: "whatsapp", mode };
            if (mode !== "managed") return { ...base, kind: "invalid-publication" };
            return { ...base, kind: "managed", mode, ...calendar };
        } catch (error) {
            if (error instanceof RsvpError) throw error;
            const code = error?.code === "EVENT_NOT_FOUND" ? "ADMIN_EVENT_NOT_FOUND"
                : ["VERSION_NOT_FOUND", "VERSION_EVENT_MISMATCH"].includes(error?.code) ? "MANAGED_PUBLICATION_REQUIRED"
                : error?.code === "SUPABASE_TIMEOUT" ? "UPSTREAM_TIMEOUT" : "RSVP_INTERNAL_ERROR";
            throw new RsvpError(code);
        }
    }
    return Object.freeze({ read });
}

module.exports = { createRsvpContext };
