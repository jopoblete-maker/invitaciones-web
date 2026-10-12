const { createHash } = require('node:crypto');
const { isProxy } = require('node:util').types;

// Node only; trusted JSON data and unmodified intrinsics. No getters, toJSON or
// input iterators are called. Limits: depth 100, 100000 values. No schema checks:
// callers must supply the canonical snapshot, never runtime data or policies.
// Keys sort by UTF-16 code units (including numeric keys); arrays retain order.
// Unicode is not normalized. Finite numbers use JSON.stringify; -0 becomes 0,
// as in JSON. Original numeric spellings and duplicate parsed keys are unavailable.
function canonicalSerialize(content) {
    const active = new Set();
    let count = 0;
    const invalid = () => { throw new TypeError('INVALID_CANONICAL_JSON'); };
    function visit(value, depth) {
        if (++count > 100000 || depth > 100) return invalid();
        if (value === null) return 'null';
        if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
        if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : invalid();
        if (typeof value !== 'object' || isProxy(value) || active.has(value)) return invalid();
        const array = Array.isArray(value);
        const prototype = Object.getPrototypeOf(value);
        if (array ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype)) return invalid();
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const keys = Reflect.ownKeys(descriptors);
        if (keys.some(key => typeof key !== 'string')) return invalid();
        active.add(value);
        let result;
        if (array) {
            const length = descriptors.length?.value;
            if (!Number.isSafeInteger(length) || length < 0 || length > 100000 || keys.length !== length + 1) return invalid();
            const values = [];
            for (let index = 0; index < length; index++) {
                const descriptor = descriptors[String(index)];
                if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return invalid();
                values.push(visit(descriptor.value, depth + 1));
            }
            result = '[' + values.join(',') + ']';
        } else {
            result = '{' + keys.sort().map(key => {
                const descriptor = descriptors[key];
                if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return invalid();
                return JSON.stringify(key) + ':' + visit(descriptor.value, depth + 1);
            }).join(',') + '}';
        }
        active.delete(value);
        return result;
    }
    return visit(content, 0);
}

function canonicalContentDigest(content) {
    return createHash('sha256').update(canonicalSerialize(content), 'utf8').digest('hex');
}

module.exports = { canonicalSerialize, canonicalContentDigest };
