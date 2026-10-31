"use strict";
// Node-private presentation contract. Only called after operational Premium validation.
const ID = "angel-eli-boda", PROFILE = "angel-eli-v1";
const ADDRESS = "Hernán Cortez 1710";
const LOCATION_ADDRESS = ADDRESS + ", Carlos Spegazzini, Buenos Aires";
const MAPS_URL = "https://maps.app.goo.gl/NCyLci7MA9XXWAwG9";
const TIME = "20:00 hs. a 4:00 a.m hs";
const DRIVE = "https://drive.google.com/drive/folders/16IxkPzVLFbdmBiKsCoyjmjMZU82ByYul?usp=drive_link";
const sections = [["portada", "hero"], ["nuestra-historia", "media-closing"],
    ["fiesta", "event-info"], ["confirmacion", "rsvp"], ["vestimenta", "dress-code"],
    ["regalos", "gifts"], ["carpeta-compartida", "collaborative-album"],
    ["caminata", "media-closing"], ["cierre", "media-closing"]];
const backgrounds = { fiesta: "fiesta", confirmacion: "asistencia", vestimenta: "vestimenta",
    regalos: "regalos", "carpeta-compartida": "carpeta", cierre: "cierre" };
const media = Object.fromEntries(sections.map(([id]) => [id, backgrounds[id]
    ? { type: "image", src: "/assets/events/fondos-sin-texto/" + backgrounds[id] + "-fondo.png" }
    : { type: id === "nuestra-historia" ? "image" : "video", src: "/assets/events/angel-eli/"
        + ({ portada: "portada.mp4", "nuestra-historia": "historia.png", caminata: "angel-eli-caminata.mp4" })[id] }]));
media.musica = { type: "audio", src: "/assets/events/angel-eli/musica.mp3" };
function matchesProfile(content) {
    return content?.id === ID && content.schema_version === 2
        && content.location?.maps_url === MAPS_URL && content.location.address === LOCATION_ADDRESS
        && content.template?.slug === "boda-fiesta-premium" && content.template.variant === PROFILE
        && !Object.hasOwn(content.metadata || {}, "demo") && !Object.hasOwn(content.metadata || {}, "purpose")
        && content.sections?.length === 9 && sections.every(([id, type], i) => {
            const section = content.sections[i];
            return section.id === id && section.type === type && section.enabled === true && section.order === (i + 1) * 10;
        }) && content.sections[2].data?.address === ADDRESS && content.sections[2].data?.timeText === TIME && content.sections[6].data?.url === DRIVE
        && Object.keys(content.media?.items || {}).length === 10
        && Object.entries(media).every(([id, item]) => content.media.items[id]?.type === item.type
            && content.media.items[id]?.src === item.src)
        && content.sections[7].data?.media_id === "caminata"
        && content.modules?.music?.enabled === true && content.modules.music.tracks?.length === 1
        && content.modules.music.tracks[0].media_id === "musica"
        && content.modules?.rsvp?.mode === "whatsapp" && content.modules.rsvp.contacts?.length === 1;
}
function buildPresentation(content) {
    if (content.id === ID && !matchesProfile(content)) throw new Error("Invalid event presentation.");
    const sections = content.sections;
    return {
        giftFields: Object.fromEntries(sections.filter(s => s.type === "gifts").map(s => [s.id, Object.keys(s.data)])),
        albumSections: sections.filter(s => s.type === "collaborative-album").map(s => s.id),
        gallerySections: Object.fromEntries(sections.filter(s => s.type === "gallery").map(s => [s.id, s.data.items.map(i => i.media_id)])),
        ...(content.id === ID ? { eventProfile: PROFILE } : {})
    };
}
module.exports = { ID, PROFILE, TIME, DRIVE, MAPS_URL, ADDRESS, LOCATION_ADDRESS, sections, media, matchesProfile, buildPresentation };
