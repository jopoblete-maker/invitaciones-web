const { isProxy } = require('node:util').types;

const LIMITS = Object.freeze({ maxBytes: 12 * 1024 * 1024, maxDepth: 100, maxValues: 100000 });

/** Node-only, pure inspection; requires unmodified platform intrinsics.
 * Root depth is 0; each property value/array element adds 1. Every occurrence
 * counts as one value (including containers and root); keys are bytes, not values.
 * All limits are inclusive. Shared acyclic references count per occurrence.
 * Matches canonical-content-digest JSON semantics: -0 is 0, finite numbers only,
 * no Unicode normalization, lone surrogates escaped. Does not check event schema.
 * No whole JSON string is allocated; descriptor metadata still costs O(properties).
 */
function inspectSnapshotBudget(snapshot) {
    let bytes = 0, values = 0, maxDepth = 0;
    const active = new Set();
    const reject = () => { throw new TypeError('INVALID_OR_OVERSIZED_SNAPSHOT'); };
    function add(amount) {
        if (amount > LIMITS.maxBytes - bytes) reject();
        bytes += amount;
    }
    function stringBytes(value) {
        add(2); // JSON quotes.
        for (let index = 0; index < value.length; index++) {
            const unit = value.charCodeAt(index);
            if (unit === 34 || unit === 92 || [8, 9, 10, 12, 13].includes(unit)) add(2);
            else if (unit < 32) add(6);
            else if (unit < 128) add(1);
            else if (unit < 2048) add(2);
            else if (unit >= 0xd800 && unit <= 0xdbff) {
                const next = value.charCodeAt(index + 1);
                if (next >= 0xdc00 && next <= 0xdfff) { add(4); index++; }
                else add(6);
            } else if (unit >= 0xdc00 && unit <= 0xdfff) add(6);
            else add(3);
        }
    }
    function visit(value, depth) {
        if (++values > LIMITS.maxValues || depth > LIMITS.maxDepth) reject();
        maxDepth = Math.max(maxDepth, depth);
        if (value === null) { add(4); return; }
        if (typeof value === 'string') { stringBytes(value); return; }
        if (typeof value === 'boolean') { add(value ? 4 : 5); return; }
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) reject();
            add(JSON.stringify(value).length); return; // Bounded primitive number representation.
        }
        if (typeof value !== 'object' || isProxy(value) || active.has(value)) reject();
        const array = Array.isArray(value);
        const prototype = Object.getPrototypeOf(value);
        if (array ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype)) reject();
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const keys = Reflect.ownKeys(descriptors);
        if (keys.some(key => typeof key !== 'string')) reject();
        active.add(value);
        add(2); // Container delimiters.
        if (array) {
            const length = descriptors.length?.value;
            if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1
                || length > LIMITS.maxValues - values) reject();
            for (let index = 0; index < length; index++) {
                const key = String(index);
                if (!Object.hasOwn(descriptors, key)) reject();
                const descriptor = descriptors[key];
                if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) reject();
                if (index) add(1);
                visit(descriptor.value, depth + 1);
            }
        } else {
            if (keys.length > LIMITS.maxValues - values) reject();
            // Sorting matches canonical traversal, without changing the input.
            for (let index = 0, sorted = keys.sort(); index < sorted.length; index++) {
                const key = sorted[index], descriptor = descriptors[key];
                if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) reject();
                if (index) add(1);
                stringBytes(key); add(1); // Name and colon.
                visit(descriptor.value, depth + 1);
            }
        }
        active.delete(value);
    }
    visit(snapshot, 0); // Recursion is capped before traversal beyond depth 100.
    return { bytes, values, maxDepth };
}

module.exports = { LIMITS, inspectSnapshotBudget };
