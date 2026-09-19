const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { normalizeEvent, hasNewSchema } = require("../js/core/event-normalizer");
const { TEMPLATES, resolveTemplate } = require("../js/core/template-registry");
const { getRenderableSections } = require("../js/core/section-renderer");
const { validateNewEvent } = require("../js/core/event-validator");
const CalendarActions = require("../js/core/calendar-actions");
const Countdown = require("../js/core/countdown");
const Rsvp = require("../js/core/rsvp");

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
    ["hero", "event-info", "location", "rsvp", "closing", "countdown", "media-closing"]
);
assert.deepStrictEqual(
    renderableSections.map((section) => section.type),
    ["hero", "event-info", "location", "rsvp", "closing", "countdown", "media-closing"]
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
const countdown = normalized.sections.find((section) => section.type === "countdown");
const mediaClosing = normalized.sections.find((section) => section.type === "media-closing");

assert.strictEqual(hero.data.image, "/assets/events/kaly-joha/02-portada.gif");
assert.strictEqual(hero.data.mediaLayout, "contained");
assert.strictEqual(hero.data.showCopy, false);
assert.strictEqual(eventInfo.data.image, "/assets/events/kaly-joha/01-invitacion.gif");
assert.strictEqual(eventInfo.data.mediaLayout, "contained");
assert.strictEqual(eventInfo.data.showMessage, false);
assert.strictEqual(location.data.image, undefined);
assert.strictEqual(closing.data.image, "/assets/events/kaly-joha/03-cierre.gif");
assert.strictEqual(closing.data.mediaLayout, "contained");
assert.strictEqual(closing.data.message, undefined);
assert.strictEqual(closing.enabled, true);
assert.strictEqual(closing.order, 50);
assert.strictEqual(countdown.enabled, true);
assert.strictEqual(countdown.order, 55);
assert.strictEqual(countdown.data.targetDateTime, "2026-12-04T11:30:00");
assert.strictEqual(countdown.data.eyebrow, "FALTAN");
assert.strictEqual(countdown.data.footer, "PARA NUESTRO GRAN DÍA");
assert.strictEqual(countdown.data.completedMessage, "¡Llegó nuestro gran día!");
assert.strictEqual(countdown.data.days, undefined);
assert.strictEqual(countdown.data.hours, undefined);
assert.strictEqual(countdown.data.minutes, undefined);
assert.strictEqual(countdown.data.seconds, undefined);
assert.strictEqual(mediaClosing.enabled, true);
assert.strictEqual(mediaClosing.order, 60);
assert.strictEqual(mediaClosing.data.src, "/assets/events/kaly-joha/cierre-animado.gif");
assert.strictEqual(mediaClosing.data.alt, "Cierre de la invitación de Kaly y Joha");
assert(renderableSections.indexOf(mediaClosing) > renderableSections.indexOf(closing));
assert(renderableSections.indexOf(countdown) > renderableSections.indexOf(closing));
assert(renderableSections.indexOf(countdown) < renderableSections.indexOf(mediaClosing));
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
assert.deepStrictEqual(normalized.rsvp.contacts, [{ nombre: "Joha", telefono: "5491140931362" }]);
assert.deepStrictEqual(normalized.contactosRSVP, [{ nombre: "Joha", telefono: "5491140931362" }]);
assert.strictEqual(normalized.branding.enabled, true);
assert.strictEqual(normalized.branding.brandName, "YCOR Digital");
assert.strictEqual(normalized.branding.badgeText, "YCOR Digital ✦ Pedí la tuya");
assert.strictEqual(normalized.branding.cta, "¿Querés una invitación como esta para tu evento?");
assert.strictEqual(normalized.branding.serviceText, "Invitaciones digitales");
assert.strictEqual(normalized.branding.whatsapp, "5491157339281");
assert.strictEqual(normalized.branding.whatsappMessage, "");
assert.strictEqual(normalized.branding.portfolioUrl, "");
assert.strictEqual(normalized.branding.instagramUrl, "");
assert.strictEqual(normalized.theme.styles.colorFondo, "#fbfbf7");
assert.strictEqual(normalized.theme.styles.colorBordeDecorativo, "#c1a35f");

const invitationScript = fs.readFileSync(path.resolve(__dirname, "..", "js", "invitacion.js"), "utf8");
const browserContext = {
    console,
    URL,
    URLSearchParams,
    CalendarActions,
    Countdown,
    Rsvp,
    document: { addEventListener() {} },
    window: {}
};
vm.createContext(browserContext);
vm.runInContext(invitationScript, browserContext);

const brandingHtml = browserContext.renderBranding(normalized);
assert(brandingHtml.includes("data-branding-widget"));
assert(brandingHtml.includes("aria-expanded=\"false\""));
assert(brandingHtml.includes("YCOR Digital ✦ Pedí la tuya"));
assert(brandingHtml.includes("¿Querés una invitación como esta para tu evento?"));
assert(brandingHtml.includes("Invitaciones digitales"));
assert(brandingHtml.includes("Ped&iacute; la tuya por WhatsApp"));
assert(brandingHtml.includes("https://wa.me/5491157339281?text="));
assert(!brandingHtml.includes("Portfolio"));
assert(!brandingHtml.includes("Instagram"));
assert.strictEqual(browserContext.renderBranding({ ...normalized, branding: undefined }), "");
assert.strictEqual(browserContext.renderBranding({ ...normalized, branding: { enabled: false, badgeText: "YCOR" } }), "");

const contextualMessage = browserContext.buildBrandingWhatsappMessage(normalized);
assert(contextualMessage.includes("Kaly & Joha"));
assert(!invitationScript.includes("vi la invitación de Kaly & Joha"));
assert.strictEqual(
    browserContext.buildBrandingWhatsappUrl({
        ...normalized.branding,
        whatsapp: "11 2222-3333"
    }, normalized),
    `https://wa.me/5491122223333?text=${encodeURIComponent(contextualMessage)}`
);
assert.strictEqual(
    browserContext.buildBrandingWhatsappUrl(normalized.branding, normalized),
    `https://wa.me/5491157339281?text=${encodeURIComponent(contextualMessage)}`
);
assert.strictEqual(browserContext.safeExternalUrl("javascript:alert(1)"), "");
assert.strictEqual(browserContext.safeExternalUrl("https://example.test"), "https://example.test");

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
assert(rsvpHtml.includes("https://wa.me/5491140931362"));
assert(!rsvpHtml.includes("https://wa.me/5491157339281"));

const closingHtml = browserContext.renderClosingPage(closing, {
    event: normalized,
    pageIndex: renderableSections.indexOf(closing),
    pageCount: renderableSections.length,
    getSectionImage: () => closing.data.image,
    renderBrochureNavigation: () => ""
});
assert(!closingHtml.includes("Los Esperamos"));
assert(closingHtml.includes("/assets/events/kaly-joha/03-cierre.gif"));

const countdownHtml = Countdown.renderPage(countdown, {
    event: normalized,
    pageIndex: renderableSections.indexOf(countdown),
    pageCount: renderableSections.length,
    renderBrochureNavigation: () => ""
});
assert(countdownHtml.includes("data-section-type=\"countdown\""));
assert(countdownHtml.includes("data-countdown-target=\"2026-12-04T11:30:00\""));
assert(countdownHtml.includes("FALTAN"));
assert(countdownHtml.includes("PARA NUESTRO GRAN DÍA"));
assert(countdownHtml.includes("data-countdown-unit=\"days\""));
assert(!countdownHtml.includes("82"));

const remaining = Countdown.calculateParts(
    "2026-12-04T11:30:00",
    new Date("2026-12-03T10:29:20").getTime()
);
assert.strictEqual(remaining.completed, false);
assert.strictEqual(remaining.days, 1);
assert.strictEqual(remaining.hours, 1);
assert.strictEqual(remaining.minutes, 0);
assert.strictEqual(remaining.seconds, 40);

const completed = Countdown.calculateParts(
    "2026-12-04T11:30:00",
    new Date("2026-12-04T11:30:00").getTime()
);
assert.strictEqual(completed.completed, true);
assert.strictEqual(completed.days, 0);
assert.strictEqual(completed.hours, 0);
assert.strictEqual(completed.minutes, 0);
assert.strictEqual(completed.seconds, 0);

const mediaClosingHtml = browserContext.renderMediaClosingPage(mediaClosing, {
    event: normalized,
    pageIndex: renderableSections.indexOf(mediaClosing),
    pageCount: renderableSections.length,
    renderBrochureNavigation: () => ""
});
assert(mediaClosingHtml.includes("<img"));
assert(mediaClosingHtml.includes("/assets/events/kaly-joha/cierre-animado.gif"));
assert(mediaClosingHtml.includes("Cierre de la invitación de Kaly y Joha"));
assert(!mediaClosingHtml.includes("<a "));
assert(!mediaClosingHtml.includes("onclick"));

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
