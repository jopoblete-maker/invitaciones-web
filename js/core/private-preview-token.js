const crypto = require("crypto");

const PURPOSE = "preview";
const DEFAULT_TTL_SECONDS = 300;

function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signPreviewToken({ eventId, versionId, secret, now = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS, nonce } = {}) {
    if (!secret) throw new Error("Preview signing key is required.");
    const expiresAt = Math.floor(now / 1000) + Number(ttlSeconds);
    const payload = { eventId, versionId, purpose: PURPOSE, expiresAt, nonce: nonce || crypto.randomBytes(16).toString("hex") };
    const encoded = encode(payload);
    const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
}

function verifyPreviewToken(token, { secret, now = Date.now() } = {}) {
    if (!secret || typeof token !== "string") return { ok: false, code: "INVALID_TOKEN" };
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return { ok: false, code: "INVALID_TOKEN" };
    const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return { ok: false, code: "INVALID_TOKEN" };
    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (payload.purpose !== PURPOSE) return { ok: false, code: "INVALID_TOKEN" };
        if (!Number.isInteger(payload.expiresAt) || payload.expiresAt <= Math.floor(now / 1000)) return { ok: false, code: "TOKEN_EXPIRED" };
        if (typeof payload.eventId !== "string" || typeof payload.versionId !== "string" || !payload.nonce) return { ok: false, code: "INVALID_TOKEN" };
        return { ok: true, payload };
    } catch {
        return { ok: false, code: "INVALID_TOKEN" };
    }
}

module.exports = { DEFAULT_TTL_SECONDS, signPreviewToken, verifyPreviewToken };
