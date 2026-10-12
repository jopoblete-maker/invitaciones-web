const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { resolveAuthorization, resolveValidationContext } = require('../js/core/premium-authorization');

const identity = { eventId: 'synthetic-wedding', templateSlug: 'synthetic-template', canonicalDigest: 'opaque-synthetic-digest' };
const media = { type: 'image', src: '/assets/events/synthetic/photo.webp' };
const gifts = { title: 'Regalos', message: 'Mensaje sintético', alias: 'alias.demo', cbu: '0'.repeat(22) };
const manifest = { status: 'approved', ...identity, media: { photo: media }, gifts: { gifts } };
const request = { identity, manifest, mediaItems: { photo: { ...media } }, giftSections: { gifts: { ...gifts } } };
const reject = value => assert.deepEqual(resolveAuthorization(value), { authorized: false, code: 'PREMIUM_AUTHORIZATION_DENIED' });
const accept = value => assert.deepEqual(resolveAuthorization(value), { authorized: true, code: 'PREMIUM_AUTHORIZATION_APPROVED' });
accept(request);
for (const key of Object.keys(identity)) reject({ ...request, identity: { ...identity, [key]: 'different' } });
for (const value of [undefined, null, {}, { ...manifest, status: 'revoked' }, { ...manifest, status: 'pending' }]) reject({ ...request, manifest: value });
for (const value of [undefined, null, [], {}, { ...request, permissions: manifest }]) reject(value);
reject({ ...request, mediaItems: { other: media } });
for (const change of [{ src: '/assets/events/synthetic/other.webp' }, { type: 'audio' }]) {
    reject({ ...request, mediaItems: { photo: { ...media, ...change } } });
}
reject({ ...request, mediaItems: { photo: { ...media, authorized: true } } });
for (const key of Object.keys(gifts)) {
    const approved = { [key]: gifts[key], ...(key === 'title' ? { message: gifts.message } : {}) };
    const permitted = { ...request, manifest: { ...manifest, gifts: { gifts: approved } }, giftSections: { gifts: approved } };
    accept(permitted);
    reject({ ...permitted, giftSections: { gifts: { ...gifts } } });
    reject({ ...request, giftSections: { gifts: { ...gifts, [key]: key === 'cbu' ? '1'.repeat(22) : 'different' } } });
}
reject({ ...request, giftSections: { other: gifts } });
reject({ ...request, giftSections: { gifts: { ...gifts, authorizedGiftData: gifts } } });
for (const key of ['identity', 'manifest', 'mediaItems', 'giftSections']) {
    reject({ ...request, [key]: Object.create(request[key]) });
}
reject({ ...request, manifest: { ...manifest, gifts: { gifts: Object.assign(Object.create({ title: gifts.title }), { message: gifts.message }) } } });
reject({ ...request, mediaItems: { photo: Object.create(media) } });
reject({ ...request, giftSections: { gifts: Object.defineProperty({ message: gifts.message }, 'alias', { value: gifts.alias }) } });
for (const key of ['snapshot', 'body', 'query', 'storage']) reject({ ...request, [key]: { manifest } });
reject({ ...request, identity: { ...identity, eventId: '../other' } });
reject({ ...request, identity: Object.defineProperty({}, 'eventId', { get() { throw new Error('Must not execute'); }, enumerable: true }) });
for (const src of ['javascript:alert(1)', 'data:image/png;base64,AA', 'https://images.example.com/photo.webp']) {
    reject({ ...request, manifest: { ...manifest, media: { photo: { type: 'image', src } } } });
}
const external = { type: 'image', src: 'https://images.example.com/photo.webp' };
accept({ ...request, manifest: { ...manifest, media: { photo: external }, imageUrls: [external.src] }, mediaItems: { photo: external } });
reject({ ...request, manifest: { ...manifest, imageUrls: ['javascript:alert(1)'] } });
let accessorCalls = 0;
const accessorUrls = [];
Object.defineProperty(accessorUrls, '0', { enumerable: true, get() { accessorCalls++; return external.src; } });
reject({ ...request, manifest: { ...manifest, imageUrls: accessorUrls } });
assert.equal(accessorCalls, 0);
const setterUrls = [];
Object.defineProperty(setterUrls, '0', { enumerable: true, set() { accessorCalls++; } });
reject({ ...request, manifest: { ...manifest, imageUrls: setterUrls } });
const iteratorUrls = [external.src];
iteratorUrls[Symbol.iterator] = () => { accessorCalls++; throw new Error('Must not iterate'); };
reject({ ...request, manifest: { ...manifest, imageUrls: iteratorUrls } });
assert.equal(accessorCalls, 0);
for (const urls of [new Array(1), [undefined], [null], [123], [{}], [new String(external.src)],
    Object.assign([external.src], { extra: true }), Object.create([external.src]),
    Object.setPrototypeOf([external.src], Object.create(Array.prototype))]) {
    reject({ ...request, manifest: { ...manifest, imageUrls: urls } });
}
const proxy = value => new Proxy(value, {
    get() { accessorCalls++; throw new Error('Unexpected proxy get'); },
    ownKeys() { accessorCalls++; throw new Error('Unexpected proxy keys'); },
    getPrototypeOf() { accessorCalls++; throw new Error('Unexpected proxy prototype'); },
    getOwnPropertyDescriptor() { accessorCalls++; throw new Error('Unexpected proxy descriptor'); }
});
reject(proxy(request));
reject({ ...request, manifest: proxy(manifest) });
reject({ ...request, manifest: { ...manifest, imageUrls: proxy([external.src]) } });
assert.equal(accessorCalls, 0);
reject({ ...request, manifest: { ...manifest, gifts: { gifts: { title: 'Only heading' } } } });
function freeze(value) { Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); }); return Object.freeze(value); }
const before = JSON.stringify(request);
freeze(request);
accept(request);
assert.equal(JSON.stringify(request), before);
assert.deepEqual(resolveAuthorization(request), resolveAuthorization(request));
const result = resolveAuthorization({ ...request, giftSections: { gifts: { ...gifts, alias: 'private-marker' } } });
assert(!JSON.stringify(result).includes('private-marker'));
assert(!JSON.stringify(result).includes(gifts.cbu));

// Execute the module with hostile effectful globals; dependencies remain the approved pure modules.
const effects = [];
const effect = () => { effects.push('effect'); throw new Error('Unexpected effect'); };
const sandbox = { URL, console: { log: effect, warn: effect, error: effect }, fetch: effect,
document: { querySelector: effect }, localStorage: { getItem: effect }, navigator: { clipboard: { writeText: effect } } };
vm.createContext(sandbox);
const load = name => {
    if (name === 'node:util') return require(name);
    assert(['./external-link-policy', './premium-section-validator', './premium-authorization'].includes(name));
    const source = fs.readFileSync(require.resolve('../js/core/' + name.slice(2)), 'utf8');
    const factory = vm.runInContext('(function(require, module) {\n' + source + '\n})', sandbox);
    const module = { exports: {} };
    factory(load, module);
    return module.exports;
};
sandbox.resolveAuthorization = load('./premium-authorization').resolveAuthorization;
const vmInput = { ...request, manifest: { ...manifest, media: { photo: external }, imageUrls: [external.src] }, mediaItems: { photo: external } };
const vmResult = vm.runInContext(`resolveAuthorization(JSON.parse(${JSON.stringify(JSON.stringify(vmInput))}))`, sandbox);
assert.equal(vmResult.authorized, true);
assert.equal(vmResult.code, 'PREMIUM_AUTHORIZATION_APPROVED');
assert.deepEqual(effects, []);
const albumUrl = 'https://album.example.com/folder/synthetic?view=guest#photos';
const albumRequest = { ...request, manifest: { ...manifest, albumUrls: [albumUrl] },
    albumSections: { album: { url: albumUrl } } };
accept(albumRequest);
for (const url of [undefined, '', 'https://album.example.com/other', 'https://album.example.com/',
    albumUrl + 'extra', 'http://album.example.com/folder', 'javascript:alert(1)', 'data:text/html,test']) {
    reject({ ...albumRequest, albumSections: { album: { url } } });
}
reject({ ...albumRequest, manifest });
reject({ ...albumRequest, manifest: { ...albumRequest.manifest, status: 'revoked' } });
reject({ ...albumRequest, albumSections: { album: { url: albumUrl, authorized: true } } });
for (const urls of [accessorUrls, setterUrls, iteratorUrls, new Array(1), proxy([albumUrl]),
    Object.assign([albumUrl], { extra: true }), Object.create([albumUrl])]) {
    reject({ ...albumRequest, manifest: { ...manifest, albumUrls: urls } });
}
reject({ ...albumRequest, albumSections: { album: Object.create({ url: albumUrl }) } });
reject({ ...albumRequest, albumSections: { album: Object.defineProperty({}, 'url', { enumerable: true, get() { accessorCalls++; } }) } });
for (const url of ['javascript:alert(1)', 'https://*.example.com/folder']) reject({ ...albumRequest, manifest: { ...manifest, albumUrls: [url] } });
assert.equal(accessorCalls, 0);
const albumBefore = JSON.stringify(albumRequest);
const projected = resolveValidationContext(albumRequest);
assert(projected.authorized);
assert.equal(Object.hasOwn(projected, 'context'), false);
assert(!JSON.stringify(projected).includes(gifts.alias));
assert(!JSON.stringify(projected).includes(identity.canonicalDigest));
assert.equal(JSON.stringify(albumRequest), albumBefore);
assert.equal(resolveValidationContext({ ...albumRequest, manifest: undefined }).authorized, false);
console.log('premium authorization tests passed');
