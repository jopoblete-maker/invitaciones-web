const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { canonicalSerialize: serialize, canonicalContentDigest: digest } = require('../backend/premium/canonical-content-digest');
assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
assert.notEqual(digest({ a: 1 }), digest({ a: 2 }));
assert.notEqual(digest([1, 2]), digest([2, 1]));
assert.equal(serialize({ '2': 2, '10': 10 }), '{"10":10,"2":2}');
assert.equal(serialize([-0, 1.25, 1e30, 'é', '\ud800']), '[0,1.25,1e+30,"é","\\ud800"]');
assert.notEqual(digest('é'), digest('e\u0301'));
assert.equal(digest({}), createHash('sha256').update('{}').digest('hex'));
let effects = 0;
const getter = Object.defineProperty({}, 'private', { enumerable: true, get() { effects++; return 'private'; } });
const arrayGetter = [];
Object.defineProperty(arrayGetter, 0, { enumerable: true, get() { effects++; } });
const iterator = [1];
iterator[Symbol.iterator] = () => { effects++; throw new Error(); };
const proxy = new Proxy({}, { ownKeys() { effects++; throw new Error(); }, getPrototypeOf() { effects++; throw new Error(); } });
const cycle = {}; cycle.self = cycle;
for (const value of [getter, arrayGetter, iterator, proxy, cycle, new Array(1), [undefined], undefined,
    NaN, Infinity, -Infinity, 1n, () => {}, Symbol(), new Date(), new Map(), Object.create({ inherited: 1 }),
    Object.defineProperty({}, 'hidden', { value: 1 }), { toJSON() { effects++; } }]) {
    assert.throws(() => digest(value), error => error.message === 'INVALID_CANONICAL_JSON');
}
assert.equal(effects, 0);
const frozen = Object.freeze({ a: Object.freeze([1, 'synthetic']), b: Object.freeze({ x: true }) });
const before = JSON.stringify(frozen);
assert.equal(digest(frozen), digest(frozen));
assert.equal(JSON.stringify(frozen), before);
const shared = { x: 1 }; assert.equal(serialize([shared, shared]), '[{"x":1},{"x":1}]');
console.log('canonical content digest tests passed');
