const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { normalizeEvent } = require("../js/core/event-normalizer");
const Rsvp = require("../js/core/rsvp");

const whatsappIcon = '<svg data-test-icon="whatsapp"></svg>';

function normalizePhone(value) {
    let phone = String(value || "").replace(/\D/g, "");
    if (!phone) return "";
    if (phone.startsWith("0")) phone = phone.slice(1);
    if (!phone.startsWith("549")) phone = `549${phone}`;
    return phone;
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

const dependencies = { normalizePhone, escapeHtml, whatsappIcon };

assert.strictEqual(Rsvp.renderContent({ contactosRSVP: [] }, dependencies), "");

const normalizedValues = [];
const injectedHtml = Rsvp.renderContent({
    contactosRSVP: [{ nombre: "Ana", telefono: "raw-phone" }],
    confirmacionLimite: "20/11/2026"
}, {
    ...dependencies,
    normalizePhone(value) {
        normalizedValues.push(value);
        return "5491112345678";
    }
});
assert.deepStrictEqual(normalizedValues, ["raw-phone"]);
assert(injectedHtml.includes('class="button rsvp-button"'));
assert(injectedHtml.includes('href="https://wa.me/5491112345678"'));
assert(injectedHtml.includes('data-phone="5491112345678"'));
assert(injectedHtml.includes('target="_blank"'));
assert(injectedHtml.includes('rel="noopener noreferrer"'));
assert(injectedHtml.includes(whatsappIcon));
assert(injectedHtml.includes("Confirmar con Ana"));
assert(injectedHtml.includes("Hasta el 20/11/2026"));

const multipleHtml = Rsvp.renderContent({
    contactosRSVP: [
        { nombre: "Ana & José", telefono: "11 1111-1111" },
        { nombre: "", telefono: "011 2222-2222" },
        { nombre: "Sin teléfono", telefono: "" }
    ],
    confirmacionLimite: "Antes de <mañana>"
}, dependencies);
assert.strictEqual((multipleHtml.match(/class="button rsvp-button"/g) || []).length, 2);
assert(multipleHtml.includes("Confirmar con Ana &amp; José"));
assert(multipleHtml.includes("Confirmar asistencia"));
assert(multipleHtml.includes("Antes de &lt;mañana&gt;"));
assert(!multipleHtml.includes("Sin teléfono"));

const withoutDeadline = Rsvp.renderContent({
    contactosRSVP: [{ nombre: "Ana", telefono: "5491111111111" }],
    confirmacionLimite: ""
}, dependencies);
assert(!withoutDeadline.includes("Hasta el"));

const wrappedHtml = Rsvp.render({
    contactosRSVP: [{ nombre: "Ana", telefono: "5491111111111" }]
}, dependencies);
assert(wrappedHtml.includes('class="invitation-section"'));
assert(wrappedHtml.includes('class="rsvp-block"'));

function createButton(phone) {
    return {
        dataset: { phone },
        listener: null,
        addEventListener(type, listener) {
            assert.strictEqual(type, "click");
            this.listener = listener;
        }
    };
}

const buttons = [createButton("5491111111111"), createButton("5492222222222")];
const opened = [];
const originalDocument = global.document;
const originalWindow = global.window;

global.document = {
    querySelectorAll(selector) {
        assert.strictEqual(selector, ".rsvp-button");
        return buttons;
    }
};
global.window = {
    open(...args) {
        opened.push(args);
    }
};

try {
    Rsvp.setupConfirmation();
    buttons.forEach((button) => assert.strictEqual(typeof button.listener, "function"));

    let prevented = 0;
    buttons.forEach((button) => button.listener({
        preventDefault() {
            prevented += 1;
        }
    }));

    assert.strictEqual(prevented, 2);
    assert.strictEqual(opened.length, 2);
    assert.deepStrictEqual(opened.map((entry) => entry.slice(1)), [
        ["_blank", "noopener,noreferrer"],
        ["_blank", "noopener,noreferrer"]
    ]);
    assert(opened[0][0].startsWith("https://wa.me/5491111111111?text="));
    assert(opened[1][0].startsWith("https://wa.me/5492222222222?text="));
    assert.strictEqual(
        new URL(opened[0][0]).searchParams.get("text"),
        "Confirmo mi asistencia al evento."
    );
} finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
}

const legacy = normalizeEvent({
    nombre: "Evento legacy",
    fecha: "2026-10-10",
    confirmacionLimite: "01/10/2026",
    confirmacion: {
        nombre1: "Contacto legacy",
        tel1: "11 3333-3333"
    }
});
const legacyHtml = Rsvp.renderContent(legacy, dependencies);
assert(legacyHtml.includes("Confirmar con Contacto legacy"));
assert(legacyHtml.includes("https://wa.me/5491133333333"));
assert(legacyHtml.includes("Hasta el 01/10/2026"));

const draftPath = path.resolve(__dirname, "..", ".dev", "drafts", "kaly-joha-boda-civil.event.json");
const kaly = normalizeEvent(JSON.parse(fs.readFileSync(draftPath, "utf8")));
const kalyHtml = Rsvp.renderContent(kaly, dependencies);
assert(kalyHtml.includes("Confirmar con Joha"));
assert(kalyHtml.includes("https://wa.me/5491140931362"));
assert(kalyHtml.includes("Hasta el 15/11/2026"));

console.log("rsvp test passed");
