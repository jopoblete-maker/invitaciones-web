const assert = require('node:assert/strict');
const { createPremiumWriteBoundary } = require('../backend/premium/write-boundary');
const { createAuthorizationProvider } = require('../backend/premium/authorization-provider');
const { canonicalContentDigest } = require('../backend/premium/canonical-content-digest');
const { LIMITS } = require('../backend/premium/snapshot-budget');
function snapshot() {
    return { schema_version: 2, id: 'synthetic-wedding', template: { slug: 'synthetic-premium' },
        media: { items: { photo: { type: 'image', src: '/assets/synthetic/photo.webp' } } },
        sections: [
            { id: 'gallery-a', type: 'gallery', order: 1, enabled: false, data: { items: [{ media_id: 'photo', alt: 'Synthetic photo' }] } },
            { id: 'album-a', type: 'collaborative-album', order: 2, data: { url: 'https://album.example.com/synthetic' } },
            { id: 'gifts-a', type: 'gifts', order: 3, data: { title: 'Gifts', message: 'Synthetic message', alias: 'alias.demo', cbu: '0'.repeat(22) } },
            { id: 'dress-a', type: 'dress-code', order: 4, data: { description: 'Formal' } }
        ] };
}
function harness(content = snapshot(), adjust = value => value) {
    const identity = { eventId: content.id, templateSlug: content.template.slug, canonicalDigest: canonicalContentDigest(content) };
    const manifest = adjust({ ...identity, status: 'approved', media: { photo: { ...content.media.items.photo } },
        gifts: { 'gifts-a': { ...content.sections[2].data } }, albumUrls: [content.sections[1].data.url] });
    const provider = createAuthorizationProvider({ entries: [{ revision: 1, manifest }] });
    let state = { provider, revision: 1 }, calls = 0;
    const boundary = createPremiumWriteBoundary({ getAuthorizationState: () => { calls++; return state; } });
    return { content, boundary, provider, setState: value => { state = value; }, calls: () => calls };
}
const reject = (boundary, content, extra = {}) => assert.deepEqual(boundary.validateForWrite({ eventId: 'synthetic-wedding', content, ...extra }), { accepted: false });
const h = harness(), before = JSON.stringify(h.content);
const success = h.boundary.validateForWrite({ eventId: h.content.id, content: h.content });
assert(success.accepted);
assert.notEqual(success.content, h.content);
assert.equal(canonicalContentDigest(success.content), canonicalContentDigest(h.content));
assert.equal(JSON.stringify(h.content), before);
assert(Object.isFrozen(success.content.sections[0].data.items));
h.content.sections[0].data.items[0].alt = 'Changed original';
assert.equal(success.content.sections[0].data.items[0].alt, 'Synthetic photo');
reject(h.boundary, h.content);
const noState = createPremiumWriteBoundary({ getAuthorizationState: () => null });
reject(noState, snapshot());
for (const adjust of [m => ({ ...m, eventId: 'other' }), m => ({ ...m, templateSlug: 'other' }),
    m => ({ ...m, canonicalDigest: 'b'.repeat(64) }), m => ({ ...m, status: 'revoked' }),
    m => ({ ...m, media: { photo: { type: 'image', src: '/assets/other.webp' } } }),
    m => ({ ...m, albumUrls: ['https://album.example.com/other'] })]) {
    const bad = harness(snapshot(), adjust); reject(bad.boundary, bad.content);
}
for (const field of ['title', 'message', 'alias', 'cbu']) {
    const bad = harness(snapshot(), m => { delete m.gifts['gifts-a'][field]; return m; });
    reject(bad.boundary, bad.content);
}
const revision = harness(); revision.setState({ provider: revision.provider, revision: 2 }); reject(revision.boundary, revision.content);
for (const mutate of [c => { c.id = 'other'; }, c => { c.template.slug = 'other'; },
    c => { c.sections[0].id = 'gallery-b'; }, c => { c.sections[1].id = 'album-b'; },
    c => { c.media.items.photo.src = '/assets/other.webp'; }, c => { c.sections[1].data.url += '/other'; },
    c => { c.permissions = { approved: true }; }, c => { c.sections[0].data.items[0].src = '/assets/synthetic/photo.webp'; }]) {
    const changed = snapshot(); mutate(changed); reject(harness().boundary, changed);
}
const fresh = harness();
// Even a private digest approval cannot make runtime fields or self-permissions canonical.
for (const mutate of [c => { c.sections[0].data.items[0].src = '/assets/synthetic/photo.webp'; },
    c => { c.sections[0].data.approved = true; }, c => { c.metadata = { permissions: { approved: true } }; }]) {
    const content = snapshot(); mutate(content); const approvedInvalid = harness(content);
    reject(approvedInvalid.boundary, content);
}
reject(fresh.boundary, fresh.content, { provider: fresh.provider });
reject(fresh.boundary, fresh.content, { context: { albumPolicy: { isAllowed: () => true } } });
let effects = 0;
const malicious = Object.defineProperty({}, 'sections', { enumerable: true, get() { effects++; } });
const setter = Object.defineProperty({}, 'sections', { enumerable: true, set() { effects++; } });
const proxy = new Proxy(snapshot(), { ownKeys() { effects++; }, getPrototypeOf() { effects++; } });
const cycle = snapshot(); cycle.metadata = cycle;
for (const content of [malicious, setter, proxy, cycle, { ...snapshot(), sections: new Array(1) }]) reject(fresh.boundary, content);
assert.equal(effects, 0);
const shell = Object.defineProperty({ eventId: 'synthetic-wedding' }, 'content', { enumerable: true, get() { effects++; } });
assert.deepEqual(fresh.boundary.validateForWrite(shell), { accepted: false });
assert.equal(effects, 0);
const tooBig = snapshot(); tooBig.metadata = { text: 'a'.repeat(LIMITS.maxBytes) };
reject(fresh.boundary, tooBig);
let deep = null; for (let i = 0; i < 101; i++) deep = { a: deep };
reject(fresh.boundary, { ...snapshot(), metadata: deep });
reject(fresh.boundary, { ...snapshot(), metadata: new Array(100000).fill(null) });
assert.equal(fresh.calls(), 0); // Budget/malicious inputs never reach private state.
const replaced = harness();
replaced.setState({ provider: createAuthorizationProvider(), revision: 1 }); reject(replaced.boundary, replaced.content);
const stable = harness(); let stateReads = 0;
const changing = createPremiumWriteBoundary({ getAuthorizationState: () => ++stateReads === 1
    ? { provider: stable.provider, revision: 1 } : { provider: createAuthorizationProvider(), revision: 1 } });
reject(changing, stable.content);
const seen = [];
const tracedProvider = { authorize: stable.provider.authorize,
    authorizeForValidation(request, operation) { seen.push({ ...operation }); return stable.provider.authorizeForValidation(request, operation); },
    verifyOperation: stable.provider.verifyOperation };
const traced = createPremiumWriteBoundary({ getAuthorizationState: () => ({ provider: tracedProvider, revision: 1 }) });
assert(traced.validateForWrite({ eventId: stable.content.id, content: stable.content }).accepted);
assert.deepEqual(seen, [
    { type: 'media', sectionId: 'gallery-a', mediaId: 'photo', src: '/assets/synthetic/photo.webp' },
    { type: 'album', sectionId: 'album-a', url: 'https://album.example.com/synthetic' }
]);
const counterfeit = { ...tracedProvider, authorizeForValidation: () => ({ authorized: true, context: {} }) };
reject(createPremiumWriteBoundary({ getAuthorizationState: () => ({ provider: counterfeit, revision: 1 }) }), stable.content);
const serialized = JSON.stringify(success);
assert(!serialized.includes('canonicalDigest') && !serialized.includes('context'));
assert.equal(JSON.stringify(noState.validateForWrite({ eventId: 'synthetic-wedding', content: snapshot() })), '{"accepted":false}');
console.log('premium write boundary tests passed');
