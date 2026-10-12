// Server/caller supplies the trusted identity and approval; snapshot permissions are never read.
const { createPolicy } = require('./external-link-policy');
const { validateSection } = require('./premium-section-validator');
const { isProxy } = require('node:util').types;

// Contract: trusted, previously JSON-parsed data and unmodified platform intrinsics.
// Portable JS reflection cannot inspect arbitrary proxies without running traps.
// This Node-only resolver rejects proxies using the native predicate before reflection.

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function record(value) {
    if (!value || typeof value !== 'object' || isProxy(value) || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    return Reflect.ownKeys(value).every(key => typeof key === 'string'
        && own(Object.getOwnPropertyDescriptor(value, key), 'value')
        && Object.getOwnPropertyDescriptor(value, key).enumerable);
}
function shape(value, required, optional = []) {
    return record(value) && required.every(key => own(value, key))
        && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
const nonempty = value => typeof value === 'string' && value.length > 0
    && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const denied = () => ({ authorized: false, code: 'PREMIUM_AUTHORIZATION_DENIED' });

function approvedUrls(value) {
    if (isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length;
    if (!length || !own(length, 'value') || !Number.isSafeInteger(length.value)
        || length.value < 0 || Reflect.ownKeys(descriptors).length !== length.value + 1) return null;
    const copy = [];
    for (let index = 0; index < length.value; index++) {
        const key = String(index);
        if (!own(descriptors, key)) return null;
        const descriptor = descriptors[key];
        if (!own(descriptor, 'value') || !descriptor.enumerable || typeof descriptor.value !== 'string') return null;
        copy.push(descriptor.value);
    }
    return copy;
}

/** Exact, independent approvals. No digest calculation, persistence or browser transport. */
function resolveAuthorization(input) {
    if (!shape(input, ['identity', 'manifest'], ['mediaItems', 'giftSections'])) return denied();
    const { identity, manifest } = input;
    const scope = ['eventId', 'templateSlug', 'canonicalDigest'];
    if (!shape(identity, scope) || !scope.every(key => nonempty(identity[key]))
        || !['eventId', 'templateSlug'].every(key => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity[key]))
        || !shape(manifest, ['status', ...scope, 'media', 'gifts'], ['imageUrls'])
        || manifest.status !== 'approved'
        || !scope.every(key => manifest[key] === identity[key])
        || !record(manifest.media) || !record(manifest.gifts)) return denied();

    let imagePolicy;
    const urls = own(manifest, 'imageUrls') ? approvedUrls(manifest.imageUrls) : [];
    if (urls === null) return denied();
    try { imagePolicy = createPolicy({ allowedUrls: urls }); }
    catch (_) { return denied(); }
    // Validate every approval, including unused entries, before accepting the manifest.
    for (const [id, media] of Object.entries(manifest.media)) {
        if (!nonempty(id) || !shape(media, ['type', 'src']) || media.type !== 'image'
            || !nonempty(media.src) || !validateSection({ id: 'approval', type: 'gallery', order: 0,
                data: { items: [{ media_id: id, alt: 'Approved photograph' }] } }, {
                mediaItems: { [id]: media }, authorizedMediaIds: [id], imagePolicy
            }).valid) return denied();
    }
    for (const [id, data] of Object.entries(manifest.gifts)) {
        if (!nonempty(id) || !record(data) || !validateSection({ id, type: 'gifts', order: 0, data }).valid) return denied();
    }

    const mediaItems = input.mediaItems === undefined ? {} : input.mediaItems;
    const giftSections = input.giftSections === undefined ? {} : input.giftSections;
    if (!record(mediaItems) || !record(giftSections)) return denied();
    for (const [id, media] of Object.entries(mediaItems)) {
        if (!own(manifest.media, id) || !shape(media, ['type', 'src'])) return denied();
        const approved = manifest.media[id];
        if (media.type !== approved.type || media.src !== approved.src) return denied();
    }
    for (const [id, data] of Object.entries(giftSections)) {
        if (!own(manifest.gifts, id) || !record(data)
            || !validateSection({ id, type: 'gifts', order: 0, data }).valid) return denied();
        const approved = manifest.gifts[id];
        if (!Object.keys(data).every(key => own(approved, key) && data[key] === approved[key])) return denied();
    }
    // Return a decision only: no private values, permissions or financial fingerprints.
    return { authorized: true, code: 'PREMIUM_AUTHORIZATION_APPROVED' };
}

module.exports = { resolveAuthorization };
