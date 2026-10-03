const assert = require("assert");
const crypto = require("crypto");
const { generateToken, decodeToken, hashBytes, hashToken, readAuthorizationHash } = require("../backend/rsvp/token");
const { toHttpError } = require("../backend/rsvp/errors");
let checks = 0;
function check(fn) { fn(); checks++; }
function rejected(fn) {
    check(() => assert.throws(fn, (error) => error.code === "RSVP_NOT_AVAILABLE" && toHttpError(error).status === 404));
}
const zero = Buffer.alloc(32);
const canonical = zero.toString("base64url");
const randomBytes = crypto.randomBytes;
try {
    crypto.randomBytes = (size) => { assert.strictEqual(size, 32); return Buffer.from(zero); };
    const generated = generateToken();
    check(() => assert.strictEqual(generated.token, canonical));
    check(() => assert.strictEqual(generated.tokenHash.toString("hex"), "66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925"));
} finally { crypto.randomBytes = randomBytes; }
const first = generateToken();
const second = generateToken();
check(() => assert(first.token !== second.token));
check(() => assert.strictEqual(first.token.length, 43));
check(() => assert(/^[A-Za-z0-9_-]+$/.test(first.token) && !first.token.includes("=")));
check(() => assert.strictEqual(decodeToken(first.token).length, 32));
check(() => assert.strictEqual(decodeToken(first.token).toString("base64url"), first.token));
check(() => assert.strictEqual(first.tokenHash.length, 32));
check(() => assert.deepStrictEqual(hashToken(first.token), first.tokenHash));
check(() => assert(!crypto.createHash("sha256").update(first.token).digest().equals(first.tokenHash)));
check(() => assert.deepStrictEqual(readAuthorizationHash({ rawHeaders: ["AUTHORIZATION", `RSVP ${canonical}`] }), hashToken(canonical)));
for (const token of [undefined, null, 12, "", canonical.slice(1), canonical + "A", canonical + "=", "!" + canonical.slice(1), canonical + "\n", canonical.slice(0, 42) + "B"]) {
    rejected(() => decodeToken(token));
}
for (const bytes of [Buffer.alloc(31), Buffer.alloc(33), new Uint8Array(32), "bytes"]) rejected(() => hashBytes(bytes));
for (const headers of [undefined, [], ["Authorization"], ["Authorization", `RSVP ${canonical}`, "authorization", `RSVP ${canonical}`],
    ["Authorization", `Bearer ${canonical}`], ["Authorization", `rsvp ${canonical}`], ["Authorization", `RSVP  ${canonical}`],
    ["Authorization", ` RSVP ${canonical}`], ["Authorization", `RSVP\t${canonical}`], ["Authorization", `RSVP ${canonical} `],
    ["Authorization", `RSVP ${canonical}, RSVP ${canonical}`], ["Authorization", null]]) {
    rejected(() => readAuthorizationHash({ rawHeaders: headers, headers: { authorization: `RSVP ${canonical}` } }));
}
console.log(`rsvp-token: ${checks} checks passed`);
