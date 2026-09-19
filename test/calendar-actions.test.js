const assert = require("assert");
const { normalizeEvent } = require("../js/core/event-normalizer");
const {
    getCalendarDetails,
    parseEventDate,
    formatCalendarDate
} = require("../js/core/calendar-actions");

const start = parseEventDate("2026-12-04", "11:30 hs.");
assert(start instanceof Date);
assert.strictEqual(start.getFullYear(), 2026);
assert.strictEqual(start.getMonth(), 11);
assert.strictEqual(start.getDate(), 4);
assert.strictEqual(start.getHours(), 11);
assert.strictEqual(start.getMinutes(), 30);

const defaultTime = parseEventDate("2026-12-04", "");
assert.strictEqual(defaultTime.getHours(), 12);
assert.strictEqual(defaultTime.getMinutes(), 0);

assert.strictEqual(parseEventDate("04/12/2026", "11:30"), null);
assert.strictEqual(parseEventDate("2026-12-04", "24:00"), null);
assert.strictEqual(parseEventDate("2026-12-04", "11:60"), null);

const event = {
    nombre: "Kaly & Joha",
    subtitulo: "Unión por Civil",
    fechaEvento: "2026-12-04",
    horarioTexto: "11:30 hs.",
    lugarNombre: "Registro Civil",
    lugarDireccion: "Del Carmen 475"
};
const details = getCalendarDetails(event);
assert.strictEqual(details.title, "Kaly & Joha");
assert.strictEqual(details.location, "Registro Civil - Del Carmen 475");
assert.strictEqual(details.end.getTime() - details.start.getTime(), 2 * 60 * 60 * 1000);

const calendarUrl = new URL(details.googleUrl);
assert.strictEqual(calendarUrl.origin, "https://calendar.google.com");
assert.strictEqual(calendarUrl.pathname, "/calendar/render");
assert.strictEqual(calendarUrl.searchParams.get("action"), "TEMPLATE");
assert.strictEqual(calendarUrl.searchParams.get("text"), event.nombre);
assert.strictEqual(calendarUrl.searchParams.get("location"), "Registro Civil - Del Carmen 475");
assert.strictEqual(calendarUrl.searchParams.get("details"), event.subtitulo);
assert.strictEqual(
    calendarUrl.searchParams.get("dates"),
    `${formatCalendarDate(details.start)}/${formatCalendarDate(details.end)}`
);

assert.strictEqual(getCalendarDetails({ nombre: "Sin fecha" }), null);

const legacy = normalizeEvent({
    nombre: "Evento legacy",
    subtitulo: "Celebración",
    fecha: "2026-10-10",
    horario: "20:15 hs.",
    lugar: "Salón Central",
    direccion: "Calle 123"
});
const legacyDetails = getCalendarDetails(legacy);
assert.strictEqual(legacyDetails.title, "Evento legacy");
assert.strictEqual(legacyDetails.location, "Salón Central - Calle 123");
assert.strictEqual(legacyDetails.start.getHours(), 20);
assert.strictEqual(legacyDetails.start.getMinutes(), 15);

console.log("calendar-actions test passed");
