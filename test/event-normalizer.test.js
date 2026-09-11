const assert = require("assert");
const { CURRENT_SCHEMA_VERSION } = require("../js/core/event-schema");
const { hasNewSchema, normalizeEvent } = require("../js/core/event-normalizer");

const normalized = normalizeEvent({
    schema_version: CURRENT_SCHEMA_VERSION,
    event: {
        type: "generic",
        title: "Evento de prueba",
        subtitle: "Subtitulo de prueba",
        date: "2026-01-01",
        dateText: "1 DE ENERO",
        timeText: "18:00"
    },
    template: {
        slug: "cumple-clasico"
    },
    sections: [
        { id: "rsvp", type: "rsvp", enabled: true, order: 30, data: {} },
        { id: "hero", type: "hero", enabled: true, order: 10, data: {} },
        { id: "location", type: "location", enabled: false, order: 20, data: {} }
    ],
    music: {
        playMode: "playlist",
        tracks: [{ src: "https://example.test/audio.mp3", name: "Pista de prueba" }]
    },
    location: {
        name: "Lugar de prueba",
        address: "Direccion de prueba",
        mapsUrl: "https://example.test/maps"
    },
    rsvp: {
        deadline: "Fecha limite de prueba",
        contacts: [{ name: "Contacto de prueba", phone: "5491100000000" }]
    }
});

assert.strictEqual(normalized.schema_version, CURRENT_SCHEMA_VERSION);
assert.strictEqual(normalized.event.type, "generic");
assert.strictEqual(normalized.template.slug, "cumple-clasico");
assert.deepStrictEqual(normalized.sections.map((section) => section.id), ["hero", "location", "rsvp"]);
assert.strictEqual(normalized.sections[1].enabled, false);
assert.strictEqual(normalized.music.playMode, "playlist");
assert.strictEqual(normalized.music.tracks.length, 1);
assert.strictEqual(normalized.location.mapsUrl, "https://example.test/maps");
assert.strictEqual(normalized.rsvp.contacts[0].telefono, "5491100000000");

console.log("event-normalizer new schema test passed");

const legacyRawEvent = {
    id: "fixture-legacy",
    template_slug: "boda-vertical",
    tipo: "birthday",
    nombre: "Evento Legacy",
    subtitulo: "Celebracion de prueba",
    mensaje: "Mensaje legacy de prueba",
    fechaEvento: "2026-02-03",
    fechaTexto: "3 DE FEBRERO",
    horarioTexto: "19:30",
    lugarNombre: "Lugar legacy",
    lugarDireccion: "Direccion legacy",
    googleMapsUrl: "https://example.test/legacy-maps",
    confirmacionLimite: "Fecha limite legacy",
    fontFamily: "playfair",
    estilos: {
        colorFondo: "#ffffff",
        colorTexto: "#333333"
    },
    layoutConfig: {
        capa1: { objectPosition: "50% 20%", scale: 1.05, align: "flex-end", offsetY: 75, contentScale: "large" },
        audioButton: { verticalEdge: "bottom", horizontalEdge: "right", verticalOffset: 12, horizontalOffset: 14 }
    },
    multimedia: {
        capas: {
            portada: "https://example.test/portada.jpg",
            encuentro: "https://example.test/encuentro.jpg",
            confirmacion: "https://example.test/confirmacion.jpg"
        },
        audios: [{ src: "https://example.test/legacy-audio.mp3", name: "Audio legacy" }],
        audioPlayMode: "selector"
    },
    contactosRSVP: [
        { nombre: "Contacto A", telefono: "5491111111111" },
        { nombre: "Contacto B", telefono: "5492222222222" }
    ]
};
const legacySnapshot = JSON.stringify(legacyRawEvent);
const normalizedLegacy = normalizeEvent(legacyRawEvent);

assert.strictEqual(hasNewSchema(legacyRawEvent), false);
assert.strictEqual(JSON.stringify(legacyRawEvent), legacySnapshot);
assert.ok(Array.isArray(normalizedLegacy.sections));
assert.deepStrictEqual(
    normalizedLegacy.sections.map((section) => section.id),
    ["legacy-capa-1", "legacy-capa-2", "legacy-capa-3"]
);
assert.deepStrictEqual(
    normalizedLegacy.sections.map((section) => section.type),
    ["hero", "location", "rsvp"]
);
assert.deepStrictEqual(
    normalizedLegacy.sections.map((section) => section.order),
    [10, 20, 30]
);
assert.strictEqual(normalizedLegacy.template.slug, "boda-vertical");
assert.strictEqual(normalizedLegacy.event.type, "birthday");
assert.notStrictEqual(normalizedLegacy.event.type, normalizedLegacy.template.slug);
assert.strictEqual(normalizedLegacy.multimedia.capas.portada, "https://example.test/portada.jpg");
assert.strictEqual(normalizedLegacy.multimedia.capas.encuentro, "https://example.test/encuentro.jpg");
assert.strictEqual(normalizedLegacy.multimedia.capas.confirmacion, "https://example.test/confirmacion.jpg");
assert.strictEqual(normalizedLegacy.media.capas.portada, "https://example.test/portada.jpg");
assert.strictEqual(normalizedLegacy.music.tracks[0].src, "https://example.test/legacy-audio.mp3");
assert.strictEqual(normalizedLegacy.multimedia.audios[0].src, "https://example.test/legacy-audio.mp3");
assert.strictEqual(normalizedLegacy.sections.some((section) => section.type === "music"), false);
assert.strictEqual(normalizedLegacy.location.name, "Lugar legacy");
assert.strictEqual(normalizedLegacy.location.address, "Direccion legacy");
assert.strictEqual(normalizedLegacy.location.mapsUrl, "https://example.test/legacy-maps");
assert.strictEqual(normalizedLegacy.googleMapsUrl, "https://example.test/legacy-maps");
assert.strictEqual(normalizedLegacy.rsvp.contacts.length, 2);
assert.strictEqual(normalizedLegacy.contactosRSVP[0].telefono, "5491111111111");
assert.strictEqual(normalizedLegacy.nombre, "Evento Legacy");
assert.strictEqual(normalizedLegacy.subtitulo, "Celebracion de prueba");
assert.strictEqual(normalizedLegacy.mensaje, "Mensaje legacy de prueba");
assert.strictEqual(normalizedLegacy.fechaEvento, "2026-02-03");
assert.strictEqual(normalizedLegacy.fechaTexto, "3 DE FEBRERO");
assert.strictEqual(normalizedLegacy.horarioTexto, "19:30");
assert.strictEqual(normalizedLegacy.lugarNombre, "Lugar legacy");
assert.strictEqual(normalizedLegacy.lugarDireccion, "Direccion legacy");
assert.strictEqual(normalizedLegacy.confirmacionLimite, "Fecha limite legacy");
assert.strictEqual(normalizedLegacy.layoutConfig.capa1.objectPosition, "50% 20%");
assert.strictEqual(normalizedLegacy.layoutConfig.audioButton.verticalEdge, "bottom");

const partialLegacy = normalizeEvent({
    id: "fixture-legacy-partial",
    multimedia: {
        personajeHeader: "https://example.test/partial-portada.jpg"
    }
});

assert.ok(Array.isArray(partialLegacy.sections));
assert.strictEqual(partialLegacy.sections.length, 3);
assert.strictEqual(partialLegacy.multimedia.capas.portada, "https://example.test/partial-portada.jpg");
assert.strictEqual(partialLegacy.template.slug, "");
assert.strictEqual(partialLegacy.location.mapsUrl, "");
assert.deepStrictEqual(partialLegacy.rsvp.contacts, []);

console.log("event-normalizer legacy test passed");
