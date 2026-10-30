"use strict";
// Fixed local presentation contract, separate from operational Premium authorization.
const ID = "angel-eli-boda";
const PROFILE = "angel-eli-local-v1";
const sections = [
    ["portada", "hero", "Portada", "portada.mp4", "video"],
    ["nuestra-historia", "media-closing", "Nuestra historia", "historia.png", "image"],
    ["fotografia-pareja", "media-closing", "Fotografía de pareja", "pareja.png", "image"],
    ["fiesta", "event-info", "Fiesta y ubicación", "fiesta.png", "image"],
    ["confirmacion", "rsvp", "Confirmación", "confirmacion.png", "image"],
    ["vestimenta", "dress-code", "Vestimenta", "vestimenta.png", "image"],
    ["regalos", "gifts", "Regalos", "regalos.png", "image"],
    ["carpeta-compartida", "media-closing", "Carpeta compartida", "carpeta.png", "image"],
    ["cierre", "media-closing", "Cierre", "cierre.png", "image"]
];
function matchesProfile(content) {
    return content?.id === ID && content.template?.variant === PROFILE
        && content.template.slug === "boda-fiesta-premium"
        && !Object.hasOwn(content.metadata || {}, "demo") && !Object.hasOwn(content.metadata || {}, "purpose")
        && content.status === "ready_for_preview"
        && content.sections?.length === sections.length
        && sections.every(([id, type, , file, mediaType], index) => {
            const section = content.sections[index], media = content.media?.items?.[id];
            return section?.id === id && section.type === type && section.enabled === true
                && section.order === (index + 1) * 10 && media?.type === mediaType
                && media.src === "/assets/events/angel-eli/" + file;
        })
        && Object.keys(content.media?.items || {}).length === 10
        && content.media.items.musica?.type === "audio"
        && content.media.items.musica.src === "/assets/events/angel-eli/musica.mp3"
        && content.modules?.music?.enabled === true
        && content.modules.music.tracks?.length === 1
        && content.modules.music.tracks[0].media_id === "musica"
        && content.modules?.rsvp?.mode === "whatsapp"
        && content.modules.rsvp.contacts?.length === 1;
}
module.exports = { ID, PROFILE, sections, matchesProfile };
