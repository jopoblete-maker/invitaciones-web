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
const albumUrl = 'https://album.example.com/folder/synthetic';
const albumManifest = { ...manifest, status: 'approved', albumUrls: [albumUrl] };
const albumConfig = { entries: [{ revision: 3, manifest: albumManifest }] };
const albumProvider = createAuthorizationProvider(albumConfig);
const albumRequest = { ...request, expectedRevision: 3, albumSections: { album: { url: albumUrl } } };
assert(albumProvider.authorize(albumRequest).authorized);
const operation = { type: 'album', sectionId: 'album', url: albumUrl };
const projection = albumProvider.authorizeForValidation(albumRequest, operation);
assert(projection.authorized);
assert.equal(projection.revision, 3);
assert.deepEqual(Object.keys(projection.context), []);
assert(albumProvider.verifyOperation(projection.context, albumRequest, operation).authorized);
for (const context of [{ ...projection.context }, {}, { albumPolicy: { isAllowed: () => true } },
    new Proxy(projection.context, { get() { throw new Error('Must not run'); } })]) {
    assert.deepEqual(albumProvider.verifyOperation(context, albumRequest, operation), denied);
}
for (const change of [{ sectionId: 'other' }, { url: 'https://album.example.com/other' }, { type: 'media' }]) {
    assert.deepEqual(albumProvider.verifyOperation(projection.context, albumRequest, { ...operation, ...change }), denied);
}
for (const key of Object.keys(identity)) {
    assert.deepEqual(albumProvider.verifyOperation(projection.context, { ...albumRequest, identity: { ...identity, [key]: 'different' } }, operation), denied);
}
assert.deepEqual(albumProvider.verifyOperation(projection.context, { ...albumRequest, expectedRevision: 4 }, operation), denied);
assert.deepEqual(createAuthorizationProvider(albumConfig).verifyOperation(projection.context, albumRequest, operation), denied);
const mediaOperation = { type: 'media', sectionId: 'gallery-a', mediaId: 'photo', src: mediaItems.photo.src };
const mediaProjection = albumProvider.authorizeForValidation(albumRequest, mediaOperation);
assert(mediaProjection.authorized);
assert(albumProvider.verifyOperation(mediaProjection.context, albumRequest, mediaOperation).authorized);
assert.deepEqual(albumProvider.verifyOperation(mediaProjection.context, albumRequest, { ...mediaOperation, sectionId: 'gallery-b' }), denied);
assert.deepEqual(albumProvider.verifyOperation(mediaProjection.context, albumRequest, { ...mediaOperation, src: '/assets/other.webp' }), denied);
for (const privateValue of [giftSections.gifts.alias, giftSections.gifts.cbu, identity.canonicalDigest]) assert(!JSON.stringify(projection).includes(privateValue));
for (const key of Object.keys(identity)) assert.deepEqual(albumProvider.authorizeForValidation({ ...albumRequest, identity: { ...identity, [key]: 'different' } }, operation), denied);
for (const albumSections of [{ album: {} }, { album: { url: 'https://album.example.com/other' } },
    { album: { url: 'javascript:alert(1)' } }, { album: { url: albumUrl, approved: true } }]) {
    assert.deepEqual(albumProvider.authorizeForValidation({ ...albumRequest, albumSections }, operation), denied);
}
assert.deepEqual(provider.authorizeForValidation({ ...request, albumSections: { album: { url: albumUrl } } }, operation), denied);
const revokedAlbum = createAuthorizationProvider({ entries: [...albumConfig.entries,
    { revision: 4, manifest: { ...albumManifest, status: 'revoked' } }] });
assert.deepEqual(revokedAlbum.authorizeForValidation({ ...albumRequest, expectedRevision: 4 }, operation), denied);
assert.deepEqual(revokedAlbum.verifyOperation(projection.context, albumRequest, operation), denied);
let albumEffects = 0;
const maliciousUrls = [];
Object.defineProperty(maliciousUrls, 0, { enumerable: true, get() { albumEffects++; } });
assert.deepEqual(createAuthorizationProvider({ entries: [{ revision: 3, manifest: { ...albumManifest, albumUrls: maliciousUrls } }] }).authorize(albumRequest), denied);
assert.deepEqual(albumProvider.authorizeForValidation(new Proxy(albumRequest, { ownKeys() { albumEffects++; } }), operation), denied);
const maliciousOperation = Object.defineProperty({}, 'type', { enumerable: true, get() { albumEffects++; } });
assert.deepEqual(albumProvider.authorizeForValidation(albumRequest, maliciousOperation), denied);
assert.deepEqual(albumProvider.verifyOperation(projection.context, albumRequest, maliciousOperation), denied);
assert.equal(albumEffects, 0);
const original = JSON.stringify(albumRequest);
albumProvider.authorizeForValidation(albumRequest, operation);
assert.equal(JSON.stringify(albumRequest), original);
console.log('premium authorization provider tests passed');
