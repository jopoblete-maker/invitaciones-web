(function (root, factory) {
    const countdown = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = countdown;
    }

    root.Countdown = countdown;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    let countdownTimers = [];

    function renderPage(section) {
        const data = section?.data || {};
        const targetDateTime = firstString(data.targetDateTime, data.target, data.dateTime);
        if (!targetDateTime) return "";

        const eyebrow = firstString(data.eyebrow, "FALTAN");
        const footer = firstString(data.footer);
        const completedMessage = firstString(data.completedMessage, "Llegó nuestro gran día");

        return `
        <section class="wedding-section wedding-section--countdown" data-section-type="${escapeAttr(section.type)}">
            <div class="wedding-content">
                <div class="countdown-panel" data-countdown-target="${escapeAttr(targetDateTime)}" data-countdown-completed="${escapeAttr(completedMessage)}">
                    ${eyebrow ? `<p class="countdown-eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
                    <div class="countdown-grid" aria-live="polite">
                        <div class="countdown-item"><span data-countdown-unit="days">00</span><label>D&Iacute;AS</label></div>
                        <div class="countdown-item"><span data-countdown-unit="hours">00</span><label>HS</label></div>
                        <div class="countdown-item"><span data-countdown-unit="minutes">00</span><label>MIN</label></div>
                        <div class="countdown-item"><span data-countdown-unit="seconds">00</span><label>SEG</label></div>
                    </div>
                    <p class="countdown-completed" hidden></p>
                    ${footer ? `<p class="countdown-footer">${escapeHtml(footer)}</p>` : ""}
                </div>
            </div>
        </section>
    `;
    }

    function renderLegacyContent() {
        return `
        <div class="countdown" id="countdown">
            <div class="time-card"><span id="dias">00</span><label>Días</label></div>
            <div class="time-card"><span id="horas">00</span><label>Hs</label></div>
            <div class="time-card"><span id="minutos">00</span><label>Min</label></div>
            <div class="time-card"><span id="segundos">00</span><label>Seg</label></div>
        </div>
    `;
    }

    function startLegacy(dateValue) {
        const countdown = document.getElementById("countdown");
        if (!countdown) return;


        const update = () => {
            const remaining = calculateParts(dateValue);
            if (!remaining) return false;

            if (remaining.completed) {
                countdown.innerHTML = '<div class="time-card" style="grid-column: 1 / -1;"><span>Hoy</span><label>Es el día</label></div>';
                return false;
            }

            setCountdownText("dias", remaining.days);
            setCountdownText("horas", remaining.hours);
            setCountdownText("minutos", remaining.minutes);
            setCountdownText("segundos", remaining.seconds);
            return true;
        };

        if (update() !== false) {
            const timer = setInterval(() => {
                if (update() === false) clearInterval(timer);
            }, 1000);
            countdownTimers.push(timer);
        }
    }

    function setCountdownText(id, value) {
        const element = document.getElementById(id);
        if (element) element.innerText = String(value).padStart(2, "0");
    }

    function setupSections() {
        document.querySelectorAll("[data-countdown-target]").forEach((countdown) => {
            const targetDateTime = countdown.dataset.countdownTarget;
            const completedMessage = countdown.dataset.countdownCompleted || "Llegó nuestro gran día";

            const update = () => {
                const remaining = calculateParts(targetDateTime);
                if (!remaining) return false;

                if (remaining.completed) {
                    completeCountdown(countdown, completedMessage);
                    return false;
                }

                setCountdownUnit(countdown, "days", remaining.days);
                setCountdownUnit(countdown, "hours", remaining.hours);
                setCountdownUnit(countdown, "minutes", remaining.minutes);
                setCountdownUnit(countdown, "seconds", remaining.seconds);
                return true;
            };

            if (update() !== false) {
                const timer = setInterval(() => {
                    if (update() === false) clearInterval(timer);
                }, 1000);
                countdownTimers.push(timer);
            }
        });
    }

    function calculateParts(targetDateTime, now = Date.now()) {
        const target = new Date(targetDateTime).getTime();
        const current = now instanceof Date ? now.getTime() : Number(now);
        if (Number.isNaN(target) || Number.isNaN(current)) return null;

        const diff = target - current;
        if (diff <= 0) {
            return {
                completed: true,
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0
            };
        }

        return {
            completed: false,
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000)
        };
    }

    function setCountdownUnit(countdown, unit, value) {
        const element = countdown.querySelector(`[data-countdown-unit="${unit}"]`);
        if (element) element.textContent = String(value).padStart(2, "0");
    }

    function completeCountdown(countdown, message) {
        countdown.classList.add("is-complete");
        const completed = countdown.querySelector(".countdown-completed");
        if (!completed) return;

        completed.textContent = message;
        completed.hidden = false;
    }

    function clearTimers() {
        countdownTimers.forEach((timer) => clearInterval(timer));
        countdownTimers = [];
    }

    function firstString(...values) {
        const value = values.find((item) => typeof item === "string" && item.trim());
        return value ? value.trim() : "";
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

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
    }

    return {
        renderPage,
        renderLegacyContent,
        startLegacy,
        setupSections,
        clearTimers,
        calculateParts
    };
});
