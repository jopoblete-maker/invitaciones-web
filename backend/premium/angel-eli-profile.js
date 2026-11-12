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
const REVISION_PROFILE = "angel-eli-2027-v2";
const REVISION_DATE = "Viernes 29 de enero de 2027", REVISION_TARGET = "2027-01-29T20:00:00-03:00";
const REVISION_ADDRESS = "Managua 1375, Carlos Spegazzini";
const REVISION_MAPS_URL = "https://maps.app.goo.gl/6tMZP4sSb8EYQARGA?g_st=ac";
const REVISION_COVER = "/assets/events/angel-eli/portada-4x5-review.mp4";
function matchesRevisionProfile(content) {
    if (content?.id !== ID || content.template?.variant !== REVISION_PROFILE || content.sections?.length !== 10
        || content.schedule?.date !== "2027-01-29" || content.schedule.date_text !== REVISION_DATE || content.schedule.time !== "20:00"
        || content.location?.address !== REVISION_ADDRESS || content.location.maps_url !== REVISION_MAPS_URL
        || content.media?.items?.portada?.src !== REVISION_COVER) return false;
    const countdown = content.sections[1];
    if (countdown.id !== "fecha-y-cuenta-regresiva" || countdown.type !== "countdown" || countdown.enabled !== true
        || countdown.order !== 20 || countdown.data?.target_datetime !== REVISION_TARGET
        || countdown.data.footer !== REVISION_DATE || countdown.data.eyebrow !== "FALTAN") return false;
    if (content.sections.some((s,i)=>s.order !== (i+1)*10) || content.sections[3]?.data?.address !== REVISION_ADDRESS) return false;
    const original = JSON.parse(JSON.stringify(content));
    original.template.variant = PROFILE;
    original.location.address = LOCATION_ADDRESS; original.location.maps_url = MAPS_URL;
    original.media.items.portada.src = media.portada.src;
    original.sections.splice(1,1); original.sections.forEach((s,i)=>s.order=(i+1)*10);
    original.sections[2].data.address = ADDRESS;
    return matchesProfile(original);
}
function buildPresentation(content) {
    if (content.id === ID && !matchesProfile(content) && !matchesRevisionProfile(content)) throw new Error("Invalid event presentation.");
    const sections = content.sections;
    return {
        giftFields: Object.fromEntries(sections.filter(s => s.type === "gifts").map(s => [s.id, Object.keys(s.data)])),
        albumSections: sections.filter(s => s.type === "collaborative-album").map(s => s.id),
        gallerySections: Object.fromEntries(sections.filter(s => s.type === "gallery").map(s => [s.id, s.data.items.map(i => i.media_id)])),
        ...(content.id === ID ? { eventProfile: content.template.variant } : {})
    };
}
module.exports = { REVISION_PROFILE, REVISION_DATE, REVISION_TARGET, REVISION_ADDRESS, REVISION_MAPS_URL, REVISION_COVER, matchesRevisionProfile, ID, PROFILE, TIME, DRIVE, MAPS_URL, ADDRESS, LOCATION_ADDRESS, sections, media, matchesProfile, buildPresentation };
