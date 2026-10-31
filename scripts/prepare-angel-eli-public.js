"use strict";
// Explicit local preparation only. No environment, network or editorial writes.
const fs = require("node:fs"), path = require("node:path");
const { canonicalContentDigest } = require("../backend/premium/canonical-content-digest");
const profile = require("../backend/premium/angel-eli-profile");
const localProfile = require("./angel-eli-preview-profile");
function buildFinalSnapshot(original) {
    if (!localProfile.matchesProfile(original)) throw new Error("Original local profile required.");
    const content = structuredClone(original);
    content.template.variant = profile.PROFILE;
    content.location.maps_url = profile.MAPS_URL;
    content.location.address = profile.LOCATION_ADDRESS;
    content.sections = content.sections.filter(s => s.id !== "fotografia-pareja");
    content.sections.splice(7, 0, { id: "caminata", type: "media-closing", enabled: true, order: 80,
        data: { media_id: "caminata", alt: "Caminata de Ángel y Eli" } });
    content.sections.forEach((s, i) => s.order = (i + 1) * 10);
    content.sections[2].data.timeText = profile.TIME;
    content.sections[2].data.address = profile.ADDRESS;
    content.sections[6].type = "collaborative-album";
    content.sections[6].data = { title: "Carpeta compartida", description: "Fotos y videos de la fiesta",
        button_label: "Subir aquí", url: profile.DRIVE };
    content.media.items = structuredClone(profile.media);
    if (!profile.matchesProfile(content)) throw new Error("Invalid final profile.");
    return content;
}
function addAuthorization(configuration, content) {
    if (!profile.matchesProfile(content) || !Array.isArray(configuration?.entries)) throw new Error("Invalid private input.");
    const result = structuredClone(configuration), digest = canonicalContentDigest(content);
    const same = result.entries.filter(e => e.manifest?.eventId === content.id
        && e.manifest.templateSlug === content.template.slug && e.manifest.canonicalDigest === digest);
    if (same.length) {
        const current = same.reduce((a, b) => a.revision > b.revision ? a : b);
        if (current.manifest.status !== "approved") throw new Error("Final digest revoked; explicit authorization required.");
        return result;
    }
    result.entries.push({ revision: 1, manifest: { status: "approved", eventId: content.id,
        templateSlug: content.template.slug, canonicalDigest: digest, media: {},
        gifts: Object.fromEntries(content.sections.filter(s => s.type === "gifts").map(s => [s.id, s.data])),
        imageUrls: [], albumUrls: [profile.DRIVE] } });
    return result;
}
if (require.main === module) {
    const [eventFile, authorizationFile] = process.argv.slice(2);
    if (!eventFile || !authorizationFile) throw new Error("Pass private original event and configuration paths.");
    const content = buildFinalSnapshot(JSON.parse(fs.readFileSync(eventFile, "utf8")));
    const configuration = addAuthorization(JSON.parse(fs.readFileSync(authorizationFile, "utf8")), content);
    const output = path.resolve(__dirname, "../.dev/premium");
    fs.mkdirSync(output, { recursive: true });
    // Refuse overwriting previously prepared private artifacts without review.
    fs.writeFileSync(path.join(output, "angel-eli-public.event.json"), JSON.stringify(content, null, 2) + "\n", { flag: "wx" });
    fs.writeFileSync(path.join(output, "angel-eli-public.authorization.json"), JSON.stringify(configuration, null, 2) + "\n", { flag: "wx" });
    console.log("Private final snapshot and combined local authorization prepared; no publication.");
}
module.exports = { buildFinalSnapshot, addAuthorization };
