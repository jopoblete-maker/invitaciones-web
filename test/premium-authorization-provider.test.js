const assert = require('node:assert/strict');
const { createAuthorizationProvider } = require('../backend/premium/authorization-provider');
const { canonicalContentDigest } = require('../backend/premium/canonical-content-digest');
const { resolveAuthorization } = require('../js/core/premium-authorization');
const identity = { eventId: 'synthetic-event', templateSlug: 'synthetic-template', canonicalDigest: canonicalContentDigest({ title: 'Synthetic' }) };
const mediaItems = { photo: { type: 'image', src: '/assets/synthetic/photo.webp' } };
const giftSections = { gifts: { message: 'Synthetic gift', alias: 'alias.demo', cbu: '0'.repeat(22) } };
const manifest = { ...identity, status: 'approved', media: mediaItems, gifts: giftSections };
const entry = { revision: 1, manifest };
const config = { entries: [entry] };
const request = { identity, expectedRevision: 1, mediaItems, giftSections };
const denied = { authorized: false, code: 'PREMIUM_AUTHORIZATION_DENIED' };
const provider = createAuthorizationProvider(config);
assert.deepEqual(provider.authorize(request), { authorized: true, code: 'PREMIUM_AUTHORIZATION_APPROVED', revision: 1 });
assert(resolveAuthorization({ identity, manifest, mediaItems, giftSections }).authorized);
assert.deepEqual(createAuthorizationProvider().authorize(request), denied);
for (const key of Object.keys(identity)) assert.deepEqual(provider.authorize({ ...request, identity: { ...identity, [key]: 'different' } }), denied);
for (const revision of [0, -1, 2, 1.5, '1', null]) assert.deepEqual(provider.authorize({ ...request, expectedRevision: revision }), denied);
for (const configuration of [null, {}, { entries: null }, { entries: [entry, entry] },
    { entries: [{ ...entry, revision: 0 }] }, { entries: [{ ...entry, manifest: { ...manifest, extra: true } }] },
    { entries: [{ ...entry, manifest: { ...manifest, status: 'revoked' } }] }]) {
    assert.deepEqual(createAuthorizationProvider(configuration).authorize(request), denied);
}
const revoked = createAuthorizationProvider({ entries: [entry, { revision: 2, manifest: { ...manifest, status: 'revoked' } }] });
assert.deepEqual(revoked.authorize(request), denied);
assert.deepEqual(revoked.authorize({ ...request, expectedRevision: 2 }), denied);
const revised = createAuthorizationProvider({ entries: [{ revision: 2, manifest }, entry] });
assert.deepEqual(revised.authorize(request), denied);
assert(revised.authorize({ ...request, expectedRevision: 2 }).authorized);
for (const key of ['body', 'query', 'storage', 'content']) assert.deepEqual(provider.authorize({ ...request, [key]: manifest }), denied);
assert.deepEqual(provider.authorize({ ...request, mediaItems: { photo: { ...mediaItems.photo, src: '/assets/other.webp' } } }), denied);
assert.deepEqual(provider.authorize({ ...request, giftSections: { gifts: { ...giftSections.gifts, alias: 'private-marker' } } }), denied);
let effects = 0;
const getter = Object.defineProperty({}, 'entries', { enumerable: true, get() { effects++; } });
assert.deepEqual(createAuthorizationProvider(getter).authorize(request), denied);
const proxy = new Proxy(config, { ownKeys() { effects++; }, getPrototypeOf() { effects++; } });
assert.deepEqual(createAuthorizationProvider(proxy).authorize(request), denied);
assert.deepEqual(provider.authorize(new Proxy(request, { ownKeys() { effects++; } })), denied);
assert.equal(effects, 0);
const before = JSON.stringify(request);
assert.deepEqual(provider.authorize(request), provider.authorize(request));
assert.equal(JSON.stringify(request), before);
manifest.status = 'revoked';
assert(provider.authorize(request).authorized); // Private copy unaffected; updates require a new instance.
assert.deepEqual(createAuthorizationProvider(config).authorize(request), denied);
assert(!JSON.stringify(provider).includes('alias.demo'));
assert(!JSON.stringify(provider.authorize({ ...request, expectedRevision: 'private-marker' })).includes('private-marker'));
console.log('premium authorization provider tests passed');
