"use strict";
// Reads only this event's private local version and verifies working asset bytes.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const { ID, matchesProfile } = require("./angel-eli-preview-profile");
const ROOT = path.resolve(__dirname, "..");
function loadAngelEliLocalInput() {
    const read = suffix => {
        const file = path.join(ROOT, ".dev", "premium", ID + "." + suffix + ".json");
        if (fs.statSync(file).size > 12 * 1024 * 1024) throw new Error("Local preview unavailable.");
        return JSON.parse(fs.readFileSync(file, "utf8"));
    };
    const content = read("event"), configuration = read("authorization"), version = read("local-version");
    if (!matchesProfile(content) || version.eventId !== ID || version.published !== false
        || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(version.versionId) || version.contentDigest !== canonicalContentDigest(content)
        || Object.keys(version.resources || {}).length !== 10) throw new Error("Local preview unavailable.");
    for (const item of Object.values(content.media.items)) {
        const resource = version.resources[item.src];
        if (!resource || !/^[a-f0-9]{64}$/.test(resource.sha256)) throw new Error("Local preview unavailable.");
        const file = path.join(ROOT, item.src.slice(1));
        const bytes = fs.readFileSync(file);
        if (bytes.length !== resource.bytes || crypto.createHash("sha256").update(bytes).digest("hex") !== resource.sha256)
            throw new Error("Local preview unavailable.");
    }
    return { content, configuration };
}
module.exports = { loadAngelEliLocalInput };
