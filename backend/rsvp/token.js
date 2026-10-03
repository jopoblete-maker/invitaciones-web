"use strict";

const crypto = require("crypto");
const { RsvpError } = require("./errors");

function unavailable() { throw new RsvpError("RSVP_NOT_AVAILABLE"); }

function decodeToken(token) {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) unavailable();
    const bytes = Buffer.from(token, "base64url");
    if (bytes.length !== 32 || bytes.toString("base64url") !== token) unavailable();
    return bytes;
}

function hashBytes(bytes) {
    if (!Buffer.isBuffer(bytes) || bytes.length !== 32) unavailable();
    return crypto.createHash("sha256").update(bytes).digest();
}

function hashToken(token) { return hashBytes(decodeToken(token)); }

function generateToken() {
    const bytes = crypto.randomBytes(32);
    return { token: bytes.toString("base64url"), tokenHash: hashBytes(bytes) };
}

function readAuthorizationHash(req) {
    const headers = req?.rawHeaders;
    if (!Array.isArray(headers) || headers.length % 2 !== 0) unavailable();
    let authorization;
    let count = 0;
    for (let index = 0; index < headers.length; index += 2) {
        if (typeof headers[index] !== "string" || typeof headers[index + 1] !== "string") unavailable();
        if (headers[index].toLowerCase() === "authorization") {
            authorization = headers[index + 1];
            count++;
        }
    }
    if (count !== 1 || !/^RSVP [A-Za-z0-9_-]{43}$/.test(authorization)) unavailable();
    return hashToken(authorization.slice(5));
}

module.exports = { generateToken, decodeToken, hashBytes, hashToken, readAuthorizationHash };
