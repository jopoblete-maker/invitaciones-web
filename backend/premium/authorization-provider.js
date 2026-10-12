const { canonicalSerialize } = require('./canonical-content-digest');
const { resolveAuthorization } = require('../../js/core/premium-authorization');

// Private Node-only in-memory provider. Configuration must come from a trusted
// caller, never an event/request. No file, network or environment access.
// Highest revision wins per exact event/template/digest scope, including revocation.
// Recreate the provider to install new approvals; old instances do not auto-refresh.
const deny = () => ({ authorized: false, code: 'PREMIUM_AUTHORIZATION_DENIED' });
const exactKeys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const scopeKey = identity => JSON.stringify([identity.eventId, identity.templateSlug, identity.canonicalDigest]);

function createAuthorizationProvider(configuration = { entries: [] }) {
    const entries = new Map();
    const issued = new WeakMap();
    let valid = true;
    try {
        // Safe serialization validates descriptors/proxies before any consumption;
        // parse creates an isolated JSON copy that cannot be changed by the caller.
        const copy = JSON.parse(canonicalSerialize(configuration));
        if (!exactKeys(copy, ['entries']) || !Array.isArray(copy.entries)) throw new Error();
        const revisions = new Set();
        for (const entry of copy.entries) {
            if (!exactKeys(entry, ['revision', 'manifest']) || !Number.isSafeInteger(entry.revision)
                || entry.revision < 1 || !entry.manifest || !['approved', 'revoked'].includes(entry.manifest.status)) throw new Error();
            const manifest = entry.manifest;
            const identity = { eventId: manifest.eventId, templateSlug: manifest.templateSlug, canonicalDigest: manifest.canonicalDigest };
            if (!/^[a-f0-9]{64}$/.test(identity.canonicalDigest || '')
                || !resolveAuthorization({ identity, manifest: { ...manifest, status: 'approved' } }).authorized) throw new Error();
            const key = scopeKey(identity);
            const revisionKey = JSON.stringify([key, entry.revision]);
            if (revisions.has(revisionKey)) throw new Error();
            revisions.add(revisionKey);
            if (!entries.has(key) || entries.get(key).revision < entry.revision) entries.set(key, entry);
        }
    } catch (_) { valid = false; entries.clear(); }

    function decide(request) {
        if (!valid) return deny();
        try {
            const copy = JSON.parse(canonicalSerialize(request));
            const requestKeys = ['identity', 'expectedRevision', 'mediaItems', 'giftSections'];
            if (Object.hasOwn(copy || {}, 'albumSections')) requestKeys.push('albumSections');
            if (!exactKeys(copy, requestKeys)
                || !exactKeys(copy.identity, ['eventId', 'templateSlug', 'canonicalDigest'])
                || !Number.isSafeInteger(copy.expectedRevision) || copy.expectedRevision < 1) return deny();
            const entry = entries.get(scopeKey(copy.identity));
            if (!entry || entry.revision !== copy.expectedRevision || entry.manifest.status !== 'approved') return deny();
            const input = { identity: copy.identity, manifest: entry.manifest,
                mediaItems: copy.mediaItems, giftSections: copy.giftSections };
            if (Object.hasOwn(copy, 'albumSections')) input.albumSections = copy.albumSections;
            const result = resolveAuthorization(input);
            return result.authorized ? { ...result, revision: entry.revision } : deny();
        } catch (_) { return deny(); }
    }
    function operationAllowed(request, operation) {
        if (!operation || typeof operation.sectionId !== 'string' || !operation.sectionId.trim()) return false;
        if (operation.type === 'album' && exactKeys(operation, ['type', 'sectionId', 'url'])) {
            return Object.hasOwn(request.albumSections || {}, operation.sectionId)
                && request.albumSections[operation.sectionId].url === operation.url;
        }
        if (operation.type === 'media' && exactKeys(operation, ['type', 'sectionId', 'mediaId', 'src'])) {
            return Object.hasOwn(request.mediaItems, operation.mediaId)
                && request.mediaItems[operation.mediaId].type === 'image'
                && request.mediaItems[operation.mediaId].src === operation.src;
        }
        return false;
    }
    // Node-private calls only: trusted caller supplies canonical references and scope.
    // Context is an opaque lookup reference, never a policy or stand-alone credential.
    function authorizeForValidation(request, operation) {
        try {
            const requestText = canonicalSerialize(request);
            const operationText = canonicalSerialize(operation);
            const copy = JSON.parse(requestText);
            const action = JSON.parse(operationText);
            const result = decide(copy);
            if (!result.authorized || !operationAllowed(copy, action)) return deny();
            const context = Object.freeze(Object.create(null));
            issued.set(context, { requestText, operationText });
            return { ...result, context };
        } catch (_) { return deny(); }
    }
    function verifyOperation(context, request, operation) {
        // WeakMap lookup does not inspect properties or run proxy traps.
        const binding = issued.get(context);
        if (!binding) return deny();
        try {
            if (canonicalSerialize(request) !== binding.requestText
                || canonicalSerialize(operation) !== binding.operationText) return deny();
            return decide(request); // Recheck current private approval/revision.
        } catch (_) { return deny(); }
    }
    return Object.freeze({ authorize: decide, authorizeForValidation, verifyOperation });
}

module.exports = { createAuthorizationProvider };
