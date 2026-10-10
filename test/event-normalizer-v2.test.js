const assert = require("assert");
const { normalizeEvent } = require("../js/core/event-normalizer");

const v2Event = {
    schema_version: 2,
    id: "evento-v2",
    event_type: "wedding-civil",
    plan: "premium",
    status: "approved",
    template: { slug: "boda-civil-esencial" },
    identity: {
        title: "Ada & Grace",
        subtitle: "Nuestra celebracion",
        message: "Queremos compartir este dia"
    },
    schedule: {
        date: "2027-05-22",
        time: "18:30",
        date_text: "22 DE MAYO",
        time_text: "18:30 hs.",
        timezone: "America/Argentina/Buenos_Aires"
    },
    location: {
        name: "Salon Central",
        address: "Calle 123",
        city: "Buenos Aires",
        maps_url: "https://maps.example.test/place",
        message: "Los esperamos"
    },
    theme: {
        slug: "romantico",
        overrides: {
            text: "#222222",
            surface: "#ffffff",
            shadow: "#111111",
            line: "#cccccc"
        }
    },
    sections: [
        {
            id: "countdown",
            type: "countdown",
            enabled: true,
            order: 20,
            data: { target_datetime: "2027-05-22T18:30:00-03:00" },
            config: {}
        },
        {
            id: "hero",
            type: "hero",
            enabled: true,
            order: 10,
            data: { title: "Ada & Grace", media_id: "cover" },
            config: { mediaLayout: "contained" }
        },
        {
            id: "closing-media",
            type: "media-closing",
            enabled: true,
            order: 30,
            data: { media_id: "closing" },
            config: {}
        }
    ],
    modules: {
        rsvp: {
            enabled: true,
            deadline: "2027-05-01",
            contacts: [{ name: "Ada", phone: "5491100000000" }]
        },
        music: {
            enabled: true,
            playMode: "playlist",
            tracks: [{ media_id: "song", name: "Nuestra cancion" }]
        },
        branding: {
            enabled: true,
            brandName: "YCOR Digital",
            badgeText: "YCOR",
            cta: "Crea tu invitacion",
            serviceText: "Invitaciones digitales",
            whatsapp: "5491155555555",
            whatsappMessage: "Quiero consultar",
            portfolioUrl: "https://example.test/portfolio",
            instagramUrl: "https://example.test/instagram"
        }
    },
    media: {
        items: {
            cover: { type: "image", src: "/media/cover.jpg" },
            closing: { type: "image", src: "/media/closing.gif" },
            song: { type: "audio", src: "/media/song.mp3" }
        }
    },
    metadata: { locale: "es-AR" }
};

const snapshot = JSON.stringify(v2Event);
const normalized = normalizeEvent(v2Event, {
    fontFamilies: { custom: '"Custom", serif' }
});

assert.strictEqual(JSON.stringify(v2Event), snapshot);
assert.strictEqual(normalized.schema_version, 2);
assert.strictEqual(normalized.id, "evento-v2");
assert.strictEqual(normalized.event_type, "wedding-civil");
assert.strictEqual(normalized.plan, "premium");
assert.strictEqual(normalized.status, "approved");
assert.deepStrictEqual(normalized.identity, v2Event.identity);
assert.deepStrictEqual(normalized.schedule, v2Event.schedule);
assert.deepStrictEqual(normalized.modules, v2Event.modules);
assert.deepStrictEqual(normalized.metadata, v2Event.metadata);

assert.strictEqual(normalized.event.type, "wedding-civil");
assert.strictEqual(normalized.event.title, "Ada & Grace");
assert.strictEqual(normalized.event.subtitle, "Nuestra celebracion");
assert.strictEqual(normalized.event.message, "Queremos compartir este dia");
assert.strictEqual(normalized.event.date, "2027-05-22");
assert.strictEqual(normalized.event.dateText, "22 DE MAYO");
assert.strictEqual(normalized.event.timeText, "18:30 hs.");
assert.strictEqual(normalized.nombre, "Ada & Grace");
assert.strictEqual(normalized.subtitulo, "Nuestra celebracion");
assert.strictEqual(normalized.mensaje, "Queremos compartir este dia");
assert.strictEqual(normalized.fechaEvento, "2027-05-22");
assert.strictEqual(normalized.fechaTexto, "22 DE MAYO");
assert.strictEqual(normalized.horarioTexto, "18:30 hs.");

assert.strictEqual(normalized.template.slug, "boda-civil-esencial");
assert.strictEqual(normalized.template_slug, "boda-civil-esencial");
assert.strictEqual(normalized.theme.slug, "romantico");
assert.deepStrictEqual(normalized.theme.overrides, v2Event.theme.overrides);
assert.strictEqual(normalized.tema, "romantico");
assert.strictEqual(normalized.estilos.colorTexto, "#222222");
assert.strictEqual(normalized.estilos.colorFondo, "#ffffff");

assert.strictEqual(normalized.location.name, "Salon Central");
assert.strictEqual(normalized.location.address, "Calle 123");
assert.strictEqual(normalized.location.city, "Buenos Aires");
assert.strictEqual(normalized.location.maps_url, "https://maps.example.test/place");
assert.strictEqual(normalized.location.mapsUrl, "https://maps.example.test/place");
assert.strictEqual(normalized.location.message, "Los esperamos");
assert.strictEqual(normalized.lugarNombre, "Salon Central");
assert.strictEqual(normalized.lugarDireccion, "Calle 123");
assert.strictEqual(normalized.lugarCiudad, "Buenos Aires");
assert.strictEqual(normalized.googleMapsUrl, "https://maps.example.test/place");

assert.strictEqual(normalized.rsvp.deadline, "2027-05-01");
assert.deepStrictEqual(normalized.rsvp.contacts, [{ nombre: "Ada", telefono: "5491100000000" }]);
assert.deepStrictEqual(normalized.contactosRSVP, normalized.rsvp.contacts);
assert.strictEqual(normalized.confirmacionLimite, "2027-05-01");

assert.strictEqual(normalized.music.playMode, "playlist");
assert.deepStrictEqual(normalized.music.tracks, [{
    media_id: "song",
    name: "Nuestra cancion",
    src: "/media/song.mp3"
}]);
assert.deepStrictEqual(normalized.multimedia.audios, normalized.music.tracks);
assert.strictEqual(normalized.multimedia.audioPlayMode, "playlist");

assert.strictEqual(normalized.branding.enabled, true);
assert.strictEqual(normalized.branding.brandName, "YCOR Digital");
assert.strictEqual(normalized.branding.whatsapp, "5491155555555");
assert.deepStrictEqual(normalized.media.items, v2Event.media.items);

assert.deepStrictEqual(normalized.sections.map((section) => section.id), ["hero", "countdown", "closing-media"]);
assert.strictEqual(normalized.sections[0].data.media_id, "cover");
assert.strictEqual(normalized.sections[0].data.image, "/media/cover.jpg");
assert.deepStrictEqual(normalized.sections[0].config, { mediaLayout: "contained" });
assert.strictEqual(normalized.sections[1].data.target_datetime, "2027-05-22T18:30:00-03:00");
assert.strictEqual(normalized.sections[1].data.targetDateTime, "2027-05-22T18:30:00-03:00");
assert.strictEqual(normalized.sections[2].data.media_id, "closing");
assert.strictEqual(normalized.sections[2].data.src, "/media/closing.gif");

const minimal = normalizeEvent({
    schema_version: 2,
    identity: { title: "Evento minimo" },
    schedule: { date: "2027-06-01", timezone: "UTC" },
    template: { slug: "boda-vertical" },
    sections: [{ id: "hero", type: "hero", enabled: true, order: 10, data: {} }],
    modules: {},
    media: { items: {} }
});

assert.strictEqual(minimal.schema_version, 2);
assert.strictEqual(minimal.schedule.time, undefined);
assert.strictEqual(minimal.event.timeText, "");
assert.strictEqual(minimal.horarioTexto, "");
assert(!JSON.stringify(minimal).includes("12:00"));
assert.strictEqual(minimal.nombre, "Evento minimo");
assert.deepStrictEqual(minimal.media.items, {});

const allThemeOverrides = Object.fromEntries([
    "primary", "secondary", "accent", "text", "muted", "surface", "surfaceStrong",
    "surfaceSoft", "line", "shadow", "heading", "body", "button", "background"
].map((key) => [key, `value-${key}`]));
const normalizedOverrides = normalizeEvent({
    ...v2Event,
    theme: { slug: "romantico", overrides: allThemeOverrides }
});
assert.deepStrictEqual(normalizedOverrides.theme.overrides, allThemeOverrides);
assert.deepStrictEqual(normalizedOverrides.estilos, {
    colorTexto: "value-text",
    colorFondo: "value-surface",
    colorSombra: "value-shadow",
    colorBordeDecorativo: "value-line"
});

// Premium normalization is runtime-only and must not modify canonical snapshots.
const photoItems = Object.assign(Object.create({ inherited: { type: "image", src: "/assets/inherited.jpg" } }), {
    first: { type: "image", src: "/assets/first.jpg" },
    second: { type: "image", src: "/assets/second.webp" },
    audio: { type: "audio", src: "/assets/audio.mp3" },
    invalid: "https://example.test/image.jpg",
    bad: { type: "image", src: 123 },
    empty: { type: "image", src: "", url: "/assets/fallback.jpg" }
});
const galleryItems = ["second", "first", "missing", "inherited", "audio", "invalid", "bad", "empty"]
    .map((media_id) => ({ media_id, alt: `Texto ${media_id}`, caption: `Detalle ${media_id}`, src: "/assets/untrusted.jpg" }));
galleryItems.push(null, 42);
const premiumSections = [
    { id: "gallery", type: "gallery", enabled: false, order: 40, data: { items: galleryItems }, config: {} },
    { id: "dress", type: "dress-code", enabled: true, order: 50,
        data: { description: "Formal", reserved_colors: [{ color: "Blanco", reserved_for: "La novia" }] }, config: {} },
    ...[true, false, undefined].map((allow_copy, index) => ({ id: `gifts-${index}`, type: "gifts", enabled: true, order: 60 + index,
        data: { message: "Regalo sintético", alias: "alias.demo", cbu: "0".repeat(22) },
        config: allow_copy === undefined ? {} : { allow_copy } })),
    { id: "album", type: "collaborative-album", enabled: true, order: 70,
        data: { url: "https://album.example.test/demo", title: "Recuerdos", description: "Fotos y videos", button_label: "Abrir" }, config: {} }
];
const premiumSnapshot = { ...v2Event, media: { items: photoItems }, sections: premiumSections };
function freezeTree(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.values(value).forEach(freezeTree); Object.freeze(value);
    }
    return value;
}
const beforePremium = JSON.stringify(premiumSnapshot);
freezeTree(premiumSnapshot);
const forbiddenCalls = [];
const savedEffects = { fetch: globalThis.fetch, log: console.log, warn: console.warn, error: console.error };
globalThis.fetch = () => { forbiddenCalls.push("fetch"); throw new Error("Unexpected fetch"); };
console.log = console.warn = console.error = () => forbiddenCalls.push("log");
let premium;
try { premium = normalizeEvent(premiumSnapshot); }
finally { globalThis.fetch = savedEffects.fetch; Object.assign(console, { log: savedEffects.log, warn: savedEffects.warn, error: savedEffects.error }); }
assert.deepStrictEqual(forbiddenCalls, []);
assert.strictEqual(JSON.stringify(premiumSnapshot), beforePremium);
assert.deepStrictEqual(premium.media.items, photoItems);
assert.strictEqual(premium.media.items, photoItems);
const gallery = premium.sections[0];
assert.strictEqual(gallery.enabled, false); assert.strictEqual(gallery.order, 40);
assert.notStrictEqual(gallery.data.items, galleryItems);
gallery.data.items.slice(0, 8).forEach((item, index) => {
    assert.notStrictEqual(item, galleryItems[index]);
    assert.strictEqual(item.media_id, galleryItems[index].media_id);
    assert.strictEqual(item.alt, galleryItems[index].alt);
    assert.strictEqual(item.caption, galleryItems[index].caption);
    if (index >= 2) assert.strictEqual(Object.hasOwn(item, "src"), false);
});
assert.strictEqual(gallery.data.items[0].src, "/assets/second.webp");
assert.strictEqual(gallery.data.items[1].src, "/assets/first.jpg");
assert.strictEqual(gallery.data.items[8], null); assert.strictEqual(gallery.data.items[9], 42);
premium.sections.slice(1).forEach((section, index) => {
    assert.deepStrictEqual(section.data, premiumSections[index + 1].data);
    assert.deepStrictEqual(section.config, premiumSections[index + 1].config);
});
assert.deepStrictEqual(normalizeEvent(premiumSnapshot), premium);
assert.deepStrictEqual(normalizeEvent(premium).sections, premium.sections);
console.log("event-normalizer v2 test passed");
