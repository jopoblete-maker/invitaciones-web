const assert = require('node:assert/strict');
const { LIMITS, inspectSnapshotBudget: inspect } = require('../backend/premium/snapshot-budget');
const { canonicalSerialize } = require('../backend/premium/canonical-content-digest');

const reject = value => assert.throws(() => inspect(value), error => error instanceof TypeError
    && error.message === 'INVALID_OR_OVERSIZED_SNAPSHOT');
const match = value => assert.equal(inspect(value).bytes, Buffer.byteLength(canonicalSerialize(value), 'utf8'));
assert.deepEqual(inspect({ a: [1, true, null] }), { bytes: 19, values: 5, maxDepth: 2 });
const exact = 'a'.repeat(LIMITS.maxBytes - 2);
assert.equal(inspect(exact).bytes, LIMITS.maxBytes);
reject(exact + 'a');
function nested(depth) { let value = null; for (let index = 0; index < depth; index++) value = { a: value }; return value; }
assert.equal(inspect(nested(100)).maxDepth, 100);
reject(nested(101));
assert.equal(inspect(new Array(99999).fill(null)).values, 100000);
reject(new Array(100000).fill(null));
for (const value of [null, false, -0, 1e30, 1e-7, Number.MAX_VALUE, Number.MIN_VALUE,
    { '10': [1, { x: 'é😀' }], '2': true, '日本語': '\n\t\b\f\r"\\\u0000\u001f',
        surrogate: '\ud800X\udfff', pair: '\ud83d\ude00', separator: '\u2028\u2029' },
    JSON.parse('{"__proto__":1,"constructor":2}'), Object.create(null)]) match(value);
let effects = 0;
const getter = Object.defineProperty({}, 'private', { enumerable: true, get() { effects++; } });
const setter = Object.defineProperty({}, 'private', { enumerable: true, set() { effects++; } });
const arrayGetter = [];
Object.defineProperty(arrayGetter, 0, { enumerable: true, get() { effects++; } });
const iterator = [1]; iterator[Symbol.iterator] = () => { effects++; throw new Error(); };
const proxy = new Proxy({}, { ownKeys() { effects++; }, getPrototypeOf() { effects++; }, get() { effects++; } });
const revoked = Proxy.revocable({}, {}); revoked.revoke();
const cycle = {}; cycle.self = cycle;
for (const value of [getter, setter, arrayGetter, iterator, proxy, revoked.proxy, cycle, new Array(1),
    NaN, Infinity, -Infinity, undefined, 1n, () => {}, Symbol(), new Date(), new Map(), new String('x'),
    [undefined], Object.create({ inherited: true }), Object.assign([1], { extra: true }),
    Object.defineProperty({}, 'hidden', { value: 1 }), { toJSON() { effects++; } }]) reject(value);
assert.equal(effects, 0);
const shared = Object.freeze({ a: 'synthetic' });
const frozen = Object.freeze([shared, shared]);
const before = JSON.stringify(frozen);
assert.deepEqual(inspect(frozen), inspect(frozen));
assert.equal(inspect(frozen).values, 5);
assert.equal(JSON.stringify(frozen), before);
match(frozen);
// Exhaustive UTF-16 single code units plus pairs: exact JSON escaping/UTF-8 cost.
for (let unit = 0; unit <= 0xffff; unit++) match(String.fromCharCode(unit));
console.log('premium snapshot budget tests passed');
