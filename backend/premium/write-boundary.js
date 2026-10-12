const { inspectSnapshotBudget } = require('./snapshot-budget');
const { canonicalSerialize, canonicalContentDigest } = require('./canonical-content-digest');
const { validateSection } = require('../../js/core/premium-section-validator');
const { V2_EVENT_MODEL_KEYS } = require('../../js/core/event-schema');
const { createPolicy } = require('../../js/core/external-link-policy');
const { isProxy } = require('node:util').types;

const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const premiumTypes = ['gallery', 'dress-code', 'gifts', 'collaborative-album'];
const forbidden = new Set(['provider', 'permissions', 'authorization', 'policies', 'policy',
    'context', 'canonicalDigest', 'expectedRevision', 'authorizedMediaIds', 'authorizedGiftData', 'albumPolicy', 'imagePolicy']);
const deny = () => ({ accepted: false });
function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
}
function containsPermissions(value) {
    if (!value || typeof value !== 'object') return false;
    return Object.keys(value).some(key => forbidden.has(key) || containsPermissions(value[key]));
}

/** Private Node composition only. getAuthorizationState(identity) synchronously
 * returns { provider, revision } from current trusted configuration, never a request.
 * No provider is cached across calls. Acceptance covers canonical JSON budget and
 * premium authorization/section contracts, NOT full EventValidator/template checks.
 * Caller must still validate those before persistence. No adapter/HTTP integration.
 */
function createPremiumWriteBoundary({ getAuthorizationState } = {}) {
    if (typeof getAuthorizationState !== 'function') throw new TypeError('INVALID_PRIVATE_AUTHORIZATION_SOURCE');
    function validateForWrite(input) {
        try {
            // Inspect the request shell without reading accessors or proxy traps.
            if (!object(input) || isProxy(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return deny();
            const descriptors = Object.getOwnPropertyDescriptors(input);
            if (Reflect.ownKeys(descriptors).length !== 2 || !own(descriptors, 'eventId') || !own(descriptors, 'content')
                || !['eventId', 'content'].every(key => own(descriptors[key], 'value') && descriptors[key].enumerable)) return deny();
            const eventId = descriptors.eventId.value;
            if (typeof eventId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventId)) return deny();
            inspectSnapshotBudget(descriptors.content.value);
            const content = JSON.parse(canonicalSerialize(descriptors.content.value));
            if (!object(content) || content.schema_version !== 2 || content.id !== eventId
                || Object.keys(content).some(key => !V2_EVENT_MODEL_KEYS.includes(key)) || containsPermissions(content)
                || !object(content.template) || typeof content.template.slug !== 'string'
                || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(content.template.slug)
                || !Array.isArray(content.sections) || !object(content.media) || !object(content.media.items)) return deny();
            const sections = content.sections.filter(section => object(section) && premiumTypes.includes(section.type));
            if (!sections.length || content.sections.some(section => !object(section) || typeof section.id !== 'string')
                || new Set(content.sections.map(section => section.id)).size !== content.sections.length) return deny();
            freeze(content);
            const identity = Object.freeze({ eventId, templateSlug: content.template.slug,
                canonicalDigest: canonicalContentDigest(content) });
            const state = getAuthorizationState(identity);
            if (!state || !Number.isSafeInteger(state.revision) || state.revision < 1) return deny();
            const provider = state.provider, revision = state.revision;
            if (!provider || !['authorize', 'authorizeForValidation', 'verifyOperation'].every(key => typeof provider[key] === 'function')) return deny();
            const mediaItems = Object.create(null), giftSections = Object.create(null), albumSections = Object.create(null);
            const operations = [];
            for (const section of sections) {
                if (!object(section.data)) return deny();
                if (section.type === 'gallery') {
                    if (!Array.isArray(section.data.items)) return deny();
                    for (const item of section.data.items) {
                        if (!object(item) || own(item, 'src') || typeof item.media_id !== 'string'
                            || !own(content.media.items, item.media_id)) return deny();
                        const media = content.media.items[item.media_id];
                        if (!object(media) || media.type !== 'image' || typeof media.src !== 'string') return deny();
                        mediaItems[item.media_id] = { type: media.type, src: media.src };
                        operations.push({ type: 'media', sectionId: section.id, mediaId: item.media_id, src: media.src });
                    }
                } else if (section.type === 'gifts') giftSections[section.id] = section.data;
                else if (section.type === 'collaborative-album') {
                    albumSections[section.id] = { url: section.data.url };
                    operations.push({ type: 'album', sectionId: section.id, url: section.data.url });
                }
            }
            const request = freeze({ identity, expectedRevision: revision, mediaItems, giftSections, albumSections });
            if (provider.authorize(request)?.authorized !== true) return deny();
            for (const operation of operations) {
                freeze(operation);
                const issued = provider.authorizeForValidation(request, operation);
                if (issued?.authorized !== true || provider.verifyOperation(issued.context, request, operation)?.authorized !== true) return deny();
            }
            // These policies are structural checks built only after private verification;
            // no consumer callbacks/context can grant authority here.
            for (const section of sections) {
                const items = section.type === 'gallery' ? section.data.items : [];
                const imageUrls = items.map(item => mediaItems[item.media_id].src).filter(src => !src.startsWith('/assets/'));
                const options = { mediaItems, authorizedMediaIds: items.map(item => item.media_id),
                    imagePolicy: createPolicy({ allowedUrls: imageUrls }),
                    albumPolicy: createPolicy({ allowedUrls: section.type === 'collaborative-album' ? [section.data.url] : [] }) };
                if (!validateSection(section, options).valid) return deny();
            }
            // Detect replacement during private dependency calls; never reuse an old instance.
            const current = getAuthorizationState(identity);
            if (!current || current.provider !== provider || current.revision !== revision) return deny();
            return { accepted: true, content };
        } catch (_) { return deny(); }
    }
    return Object.freeze({ validateForWrite });
}

module.exports = { createPremiumWriteBoundary };
