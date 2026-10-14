"use strict";

const { createPremiumWriteBoundary } = require("../backend/premium/write-boundary");
const { createAuthorizationProvider } = require("../backend/premium/authorization-provider");
const { inspectSnapshotBudget } = require("../backend/premium/snapshot-budget");
const { canonicalSerialize } = require("../backend/premium/canonical-content-digest");
const { validateV2Event } = require("../js/core/event-validator");
const { normalizeEvent } = require("../js/core/event-normalizer");
const { createPolicy } = require("../js/core/external-link-policy");

const EVENT_ID = "kaly-joha-boda-fiesta-demo";
const CANDIDATE_EVENT_ID = "kaly-joha-nuestra-boda";
const TEMPLATE_SLUG = "boda-fiesta-premium";

// Private Node composition. configuration comes from a fixed local file, never
// an HTTP request. This demo approves dress-code, explicit gifts and the exact album destination: other capabilities
// remain inert until their materials and exact destinations receive approval.
function preparePremiumLocalPreview(content, configuration, { eventId = EVENT_ID } = {}) {
    try {
        if (![EVENT_ID, CANDIDATE_EVENT_ID].includes(eventId)) return { accepted: false };
        inspectSnapshotBudget(content);
        inspectSnapshotBudget(configuration);
        const privateCopy = JSON.parse(canonicalSerialize(configuration));
        const provider = createAuthorizationProvider(privateCopy);
        const boundary = createPremiumWriteBoundary({
            getAuthorizationState: identity => {
                const revisions = (privateCopy.entries || []).filter(entry => entry.manifest?.eventId === identity.eventId
                    && entry.manifest.templateSlug === identity.templateSlug
                    && entry.manifest.canonicalDigest === identity.canonicalDigest).map(entry => entry.revision);
                const revision = Math.max(0, ...revisions);
                return revision > 0 ? { provider, revision } : null;
            }
        });
        const result = boundary.validateForWrite({ eventId, content });
        if (!result.accepted || result.content.template.slug !== TEMPLATE_SLUG
            || (eventId === EVENT_ID && (result.content.metadata?.demo !== true
                || result.content.metadata?.purpose !== "local-only-preview"))
            || (eventId === CANDIDATE_EVENT_ID && (Object.hasOwn(result.content.metadata || {}, "demo")
                || Object.hasOwn(result.content.metadata || {}, "purpose")))) return { accepted: false };
        const premium = result.content.sections.filter(section => ["gallery", "dress-code", "gifts", "collaborative-album"].includes(section.type));
        const bySectionId = Object.fromEntries(premium.map(section => [section.id,
            section.type === "gallery" ? { authorizedMediaIds: section.data.items.map(item => item.media_id),
                mediaItems: result.content.media.items, imagePolicy: createPolicy({ allowedUrls: section.data.items
                    .map(item => result.content.media.items[item.media_id].src).filter(src => !src.startsWith("/assets/")) }) }
                : section.type === "gifts" ? { authorizedGiftData: section.data }
                : section.type === "collaborative-album" ? { albumUrl: section.data.url,
                    albumPolicy: createPolicy({ allowedUrls: [section.data.url] }) } : {}]));
        if (!validateV2Event(result.content, { bySectionId }).valid) return { accepted: false };
        const runtime = normalizeEvent(result.content);
        if (runtime.sections.length !== result.content.sections.length) return { accepted: false };
        // Return only the immutable canonical content. No provider, manifest,
        // digest, policies or opaque authorization contexts leave this boundary.
        // Display hints come only after private authorization. They contain field
        // names, not credentials, policies, financial values or private scope.
        const giftFields = Object.fromEntries(premium.filter(section => section.type === "gifts")
            .map(section => [section.id, Object.keys(section.data)]));
        const albumSections = premium.filter(section => section.type === "collaborative-album").map(section => section.id);
        const gallerySections = Object.fromEntries(premium.filter(section => section.type === "gallery")
            .map(section => [section.id, section.data.items.map(item => item.media_id)]));
        return { accepted: true, content: result.content, presentation: { giftFields, albumSections, gallerySections } };
    } catch (_) {
        return { accepted: false };
    }
}

module.exports = { EVENT_ID, CANDIDATE_EVENT_ID, TEMPLATE_SLUG, preparePremiumLocalPreview };
