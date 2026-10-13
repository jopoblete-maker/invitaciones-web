"use strict";

const { createPremiumWriteBoundary } = require("../backend/premium/write-boundary");
const { createAuthorizationProvider } = require("../backend/premium/authorization-provider");
const { inspectSnapshotBudget } = require("../backend/premium/snapshot-budget");
const { canonicalSerialize } = require("../backend/premium/canonical-content-digest");
const { validateV2Event } = require("../js/core/event-validator");
const { normalizeEvent } = require("../js/core/event-normalizer");
const { createPolicy } = require("../js/core/external-link-policy");

const EVENT_ID = "kaly-joha-boda-fiesta-demo";
const TEMPLATE_SLUG = "boda-fiesta-premium";

// Private Node composition. configuration comes from a fixed local file, never
// an HTTP request. This demo approves dress-code, explicit gifts and the exact album destination: other capabilities
// remain inert until their materials and exact destinations receive approval.
function preparePremiumLocalPreview(content, configuration) {
    try {
        inspectSnapshotBudget(content);
        inspectSnapshotBudget(configuration);
        const privateCopy = JSON.parse(canonicalSerialize(configuration));
        const provider = createAuthorizationProvider(privateCopy);
        const boundary = createPremiumWriteBoundary({
            getAuthorizationState: () => ({ provider, revision: 1 })
        });
        const result = boundary.validateForWrite({ eventId: EVENT_ID, content });
        if (!result.accepted || result.content.template.slug !== TEMPLATE_SLUG
            || result.content.metadata?.demo !== true || result.content.metadata?.purpose !== "local-only-preview") return { accepted: false };
        const premium = result.content.sections.filter(section => ["gallery", "dress-code", "gifts", "collaborative-album"].includes(section.type));
        if (premium.some(section => !["dress-code", "gifts", "collaborative-album"].includes(section.type))) return { accepted: false };
        const bySectionId = Object.fromEntries(premium.map(section => [section.id,
            section.type === "gifts" ? { authorizedGiftData: section.data }
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
        return { accepted: true, content: result.content, presentation: { giftFields, albumSections } };
    } catch (_) {
        return { accepted: false };
    }
}

module.exports = { EVENT_ID, TEMPLATE_SLUG, preparePremiumLocalPreview };
