const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { normalizeEvent, hasNewSchema } = require("../js/core/event-normalizer");
const { TEMPLATES, resolveTemplate } = require("../js/core/template-registry");
const { getRenderableSections } = require("../js/core/section-renderer");
const { validateNewEvent } = require("../js/core/event-validator");

const draftPath = path.resolve(__dirname, "..", ".dev", "drafts", "kaly-joha-boda-civil.event.json");
const raw = JSON.parse(fs.readFileSync(draftPath, "utf8"));
const before = JSON.stringify(raw);
const normalized = normalizeEvent(raw);
const template = resolveTemplate(normalized.template.slug);
const renderableSections = getRenderableSections(normalized.sections);

assert.strictEqual(hasNewSchema(raw), true);
assert.deepStrictEqual(validateNewEvent(raw), { valid: true, errors: [] });
assert.strictEqual(JSON.stringify(raw), before);
assert.strictEqual(normalized.schema_version, 1);
assert.strictEqual(normalized.event.title, "Kaly & Joha");
assert.strictEqual(normalized.event.subtitle, "Uni\u00f3n por Civil");
assert.strictEqual(normalized.event.type, "wedding-civil");
assert.strictEqual(normalized.template.slug, "boda-civil-esencial");
assert.notStrictEqual(normalized.event.type, normalized.template.slug);
assert.strictEqual(template.layout, "vertical");

assert.deepStrictEqual(
    normalized.sections.map((section) => section.type),
    ["hero", "event-info", "location", "rsvp", "closing"]
);
assert.deepStrictEqual(
    renderableSections.map((section) => section.type),
    ["hero", "event-info", "location", "rsvp", "closing"]
);
assert.deepStrictEqual(
    renderableSections
        .filter((section) => section.data?.message === raw.event.message)
        .map((section) => section.type),
    ["event-info"]
);
assert.strictEqual(normalized.sections.some((section) => section.type === "music"), false);

const hero = normalized.sections.find((section) => section.type === "hero");
const eventInfo = normalized.sections.find((section) => section.type === "event-info");
const location = normalized.sections.find((section) => section.type === "location");
const rsvp = normalized.sections.find((section) => section.type === "rsvp");
const closing = normalized.sections.find((section) => section.type === "closing");

assert.strictEqual(hero.data.image, "/assets/events/kaly-joha/02-portada.png");
assert.strictEqual(hero.data.mediaLayout, "contained");
assert.strictEqual(hero.data.showCopy, false);
assert.strictEqual(eventInfo.data.image, "/assets/events/kaly-joha/01-invitacion.png");
assert.strictEqual(eventInfo.data.mediaLayout, "contained");
assert.strictEqual(eventInfo.data.showMessage, false);
assert.strictEqual(location.data.image, undefined);
assert.strictEqual(closing.data.image, "/assets/events/kaly-joha/03-cierre.png");
assert.strictEqual(closing.data.mediaLayout, "contained");
assert.strictEqual(closing.data.message, "Los Esperamos");
assert.strictEqual(closing.enabled, true);
assert.strictEqual(rsvp.enabled, true);
assert.strictEqual(JSON.stringify(TEMPLATES).includes("assets/events/kaly-joha"), false);
assert.strictEqual([hero, eventInfo, closing].every((section) => section.data.image.startsWith("/assets/events/")), true);

assert.strictEqual(normalized.music.playMode, "selector");
assert.strictEqual(normalized.music.source, "");
assert.strictEqual(normalized.music.tracks.length, 1);
assert.strictEqual(normalized.music.tracks[0].src, "/assets/events/kaly-joha/musica.mp3");
assert.strictEqual(normalized.music.tracks[0].name, "Música");
assert.strictEqual(normalized.music.tracks[0].src.startsWith("/assets/"), true);
assert.deepStrictEqual(normalized.multimedia.audios, [{
    src: "/assets/events/kaly-joha/musica.mp3",
    name: "Música"
}]);
assert.strictEqual(normalized.location.name, "Registro Civil");
assert.strictEqual(normalized.location.address, "Del Carmen 475");
assert.strictEqual(normalized.location.city, "Cañuelas");
assert.strictEqual(normalized.lugarCiudad, "Cañuelas");
assert.strictEqual(normalized.location.mapsUrl, "https://maps.app.goo.gl/kh3SMJyQ9WeGPJPf7");
assert.strictEqual(normalized.googleMapsUrl, "https://maps.app.goo.gl/kh3SMJyQ9WeGPJPf7");
assert.strictEqual(normalized.rsvp.deadline, "15/11/2026");
assert.strictEqual(normalized.confirmacionLimite, "15/11/2026");
assert.deepStrictEqual(normalized.rsvp.contacts, [{ nombre: "Joha", telefono: "1157339281" }]);
assert.deepStrictEqual(normalized.contactosRSVP, [{ nombre: "Joha", telefono: "1157339281" }]);
assert.strictEqual(normalized.theme.styles.colorFondo, "#fbfbf7");
assert.strictEqual(normalized.theme.styles.colorBordeDecorativo, "#c1a35f");

const invitationScript = fs.readFileSync(path.resolve(__dirname, "..", "js", "invitacion.js"), "utf8");
const browserContext = {
    console,
    URLSearchParams,
    document: { addEventListener() {} },
    window: {}
};
vm.createContext(browserContext);
vm.runInContext(invitationScript, browserContext);

const locationHtml = browserContext.renderLocationPage(location, {
    event: normalized,
    pageCount: renderableSections.length,
    renderBrochureNavigation: () => ""
});
assert(!locationHtml.includes("Dirección"));
assert(!locationHtml.includes("Del Carmen 475"));
assert(!locationHtml.includes("Cañuelas"));
assert(locationHtml.includes("data-map-url=\"https://maps.app.goo.gl/kh3SMJyQ9WeGPJPf7\""));
assert(locationHtml.includes("Cómo Llegar"));
assert(locationHtml.includes("Agendar Evento"));
assert(locationHtml.includes("https://calendar.google.com/calendar/render?"));
assert(!locationHtml.includes("Horario"));
assert(!locationHtml.includes("<p class=\"detail-value\">11:30 hs.</p>"));

const eventInfoHtml = browserContext.renderEventInfoPage(eventInfo, {
    event: normalized,
    pageCount: renderableSections.length,
    getSectionImage: () => eventInfo.data.image,
    renderBrochureNavigation: () => ""
});
assert(eventInfoHtml.includes("Dirección"));
assert(eventInfoHtml.includes("Del Carmen 475"));
assert(eventInfoHtml.includes("Cañuelas"));
assert(eventInfoHtml.indexOf("Del Carmen 475") < eventInfoHtml.indexOf("Cañuelas"));
assert(!eventInfoHtml.includes("Lugar"));
assert(!eventInfoHtml.includes("Registro Civil"));

const rsvpHtml = browserContext.renderConfirmationPage(rsvp, {
    event: normalized,
    templateConfig: template,
    pageCount: renderableSections.length,
    renderBrochureNavigation: () => ""
});
assert(rsvpHtml.includes("Hasta el 15/11/2026"));
assert(rsvpHtml.includes("Confirmar con Joha"));
assert(rsvpHtml.includes("https://wa.me/5491157339281"));

const closingHtml = browserContext.renderClosingPage(closing, {
    event: normalized,
    pageIndex: renderableSections.indexOf(closing),
    pageCount: renderableSections.length,
    getSectionImage: () => closing.data.image,
    renderBrochureNavigation: () => ""
});
assert(closingHtml.includes("Los Esperamos"));
assert(closingHtml.includes("/assets/events/kaly-joha/03-cierre.png"));

const legacyLocationHtml = browserContext.renderLocationPage(location, {
    event: {
        ...normalized,
        sections: normalized.sections.filter((section) => section.type !== "event-info")
    },
    pageCount: 1,
    renderBrochureNavigation: () => ""
});
assert(legacyLocationHtml.includes("Horario"));
assert(legacyLocationHtml.includes("<p class=\"detail-value\">11:30 hs.</p>"));

console.log("kaly-joha-draft test passed");
