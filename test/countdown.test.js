const assert = require("assert");
const Countdown = require("../js/core/countdown");

const remaining = Countdown.calculateParts(
    "2026-12-04T11:30:00",
    new Date("2026-12-03T10:29:20").getTime()
);
assert.deepStrictEqual(remaining, {
    completed: false,
    days: 1,
    hours: 1,
    minutes: 0,
    seconds: 40
});

assert.deepStrictEqual(
    Countdown.calculateParts("2026-12-04T11:30:00", new Date("2026-12-04T11:30:00")),
    { completed: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
);
assert.strictEqual(Countdown.calculateParts("fecha-invalida"), null);

const sectionHtml = Countdown.renderPage({
    type: "countdown",
    data: {
        targetDateTime: "2026-12-04T11:30:00",
        eyebrow: "FALTAN",
        footer: "PARA NUESTRO GRAN DÍA",
        completedMessage: "¡Llegó nuestro gran día!"
    }
});
assert(sectionHtml.includes('data-section-type="countdown"'));
assert(sectionHtml.includes('data-countdown-target="2026-12-04T11:30:00"'));
assert(sectionHtml.includes('data-countdown-completed="¡Llegó nuestro gran día!"'));
assert(sectionHtml.includes("FALTAN"));
assert(sectionHtml.includes("PARA NUESTRO GRAN DÍA"));
assert(sectionHtml.includes('data-countdown-unit="days">00'));
assert.strictEqual(Countdown.renderPage({ type: "countdown", data: {} }), "");

const legacyHtml = Countdown.renderLegacyContent();
assert(legacyHtml.includes('id="countdown"'));
assert(legacyHtml.includes('id="dias">00'));
assert(legacyHtml.includes('id="horas">00'));
assert(legacyHtml.includes('id="minutos">00'));
assert(legacyHtml.includes('id="segundos">00'));

function createSectionCountdown(target, completedMessage) {
    const units = Object.fromEntries(
        ["days", "hours", "minutes", "seconds"].map((unit) => [unit, { textContent: "00" }])
    );
    const completed = { textContent: "", hidden: true };
    const classes = new Set();

    return {
        dataset: {
            countdownTarget: target,
            countdownCompleted: completedMessage
        },
        units,
        completed,
        classes,
        classList: {
            add(value) {
                classes.add(value);
            }
        },
        querySelector(selector) {
            const unitMatch = selector.match(/^\[data-countdown-unit="(.+)"\]$/);
            if (unitMatch) return units[unitMatch[1]];
            if (selector === ".countdown-completed") return completed;
            return null;
        }
    };
}

const originalDocument = global.document;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
const createdTimers = [];
const clearedTimers = [];
const legacyCountdown = { innerHTML: "" };
const legacyUnits = {
    dias: { innerText: "00" },
    horas: { innerText: "00" },
    minutos: { innerText: "00" },
    segundos: { innerText: "00" }
};
let sectionCountdowns = [];

global.document = {
    querySelectorAll() {
        return sectionCountdowns;
    },
    getElementById(id) {
        if (id === "countdown") return legacyCountdown;
        return legacyUnits[id] || null;
    }
};
global.setInterval = () => {
    const timer = { id: createdTimers.length + 1 };
    createdTimers.push(timer);
    return timer;
};
global.clearInterval = (timer) => {
    clearedTimers.push(timer);
};

try {
    Countdown.clearTimers();

    const futureFirst = createSectionCountdown("2999-12-04T11:30:00", "Primero");
    const futureSecond = createSectionCountdown("2999-12-05T12:45:30", "Segundo");
    const completedSection = createSectionCountdown("2000-01-01T00:00:00", "Finalizado");
    sectionCountdowns = [futureFirst, futureSecond, completedSection];

    Countdown.setupSections();

    [futureFirst, futureSecond].forEach((countdown) => {
        assert.notStrictEqual(countdown.units.days.textContent, "00");
        assert.strictEqual(countdown.completed.hidden, true);
        assert.strictEqual(countdown.classes.has("is-complete"), false);
    });
    assert.notStrictEqual(futureFirst.units, futureSecond.units);
    assert.strictEqual(completedSection.classes.has("is-complete"), true);
    assert.strictEqual(completedSection.completed.textContent, "Finalizado");
    assert.strictEqual(completedSection.completed.hidden, false);

    Countdown.startLegacy("2000-01-01T00:00:00");
    assert(legacyCountdown.innerHTML.includes("Hoy"));
    assert(legacyCountdown.innerHTML.includes("Es el día"));

    legacyCountdown.innerHTML = "";
    Countdown.startLegacy("2999-12-06T15:45:20");
    assert.notStrictEqual(legacyUnits.dias.innerText, "00");
    assert.strictEqual(createdTimers.length, 3);

    Countdown.clearTimers();
    assert.deepStrictEqual(clearedTimers, createdTimers);
} finally {
    Countdown.clearTimers();
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
}

console.log("countdown test passed");
